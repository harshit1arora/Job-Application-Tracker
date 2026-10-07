/**
 * offer-math.ts — pure, framework-free maths for offer comparison and counter-offers.
 *
 * Everything here is deterministic and side-effect free, so it works identically in demo
 * (localStorage) mode and against the API, and is easy to unit-test.
 *
 * `annualTotalComp` and `suggestCounter` intentionally mirror
 * Backend_FastAPI/services/negotiation_logic.py (same rules, same wording) so that the
 * offline fallback never disagrees with the server.
 */
import type { OfferDocument } from "./types";

export type CompInputs = Pick<
  OfferDocument,
  | "baseSalary"
  | "annualBonus"
  | "signingBonus"
  | "equityValue"
  | "equityVestYears"
  | "retirementMatchPct"
  | "otherBenefitsValue"
>;

const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const positive = (value: unknown): number => Math.max(0, num(value));

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Python-style rounding (half to even) so results match the backend exactly. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

// ---------------------------------------------------------------------------
// Compensation
// ---------------------------------------------------------------------------

/** Steady-state yearly compensation (no signing bonus). Equity is spread over its vest period. */
export function annualTotalComp(offer: Partial<CompInputs>): number {
  const base = positive(offer.baseSalary);
  const vest = num(offer.equityVestYears, 4) > 0 ? num(offer.equityVestYears, 4) : 4;
  return round2(
    base +
      positive(offer.annualBonus) +
      positive(offer.equityValue) / vest +
      (base * positive(offer.retirementMatchPct)) / 100 +
      positive(offer.otherBenefitsValue),
  );
}

/** Year-one cash+equity value: steady-state plus the one-off signing bonus. */
export function firstYearComp(offer: Partial<CompInputs>): number {
  return round2(annualTotalComp(offer) + positive(offer.signingBonus));
}

/** Four-year value assuming today's package stays flat (a comparison aid, not a forecast). */
export function fourYearComp(offer: Partial<CompInputs>): number {
  return round2(annualTotalComp(offer) * 4 + positive(offer.signingBonus));
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface ComparisonWeights {
  compensation: number;
  growth: number;
  workLife: number;
  culture: number;
}

export const DEFAULT_WEIGHTS: ComparisonWeights = {
  compensation: 40,
  growth: 25,
  workLife: 20,
  culture: 15,
};

export type BestMetric =
  | "baseSalary"
  | "annualTotal"
  | "firstYear"
  | "annualBonus"
  | "signingBonus"
  | "equityValue"
  | "ptoDays";

export interface OfferMetrics {
  annualTotal: number;
  firstYear: number;
  fourYear: number;
  equityPerYear: number;
}

export interface ComparedOffer {
  offer: OfferDocument;
  metrics: OfferMetrics;
  scores: { compensation: number; growth: number; workLife: number; culture: number };
  weightedScore: number;
  rank: number;
  bestIn: BestMetric[];
}

export function computeMetrics(offer: OfferDocument): OfferMetrics {
  const vest = num(offer.equityVestYears, 4) > 0 ? num(offer.equityVestYears, 4) : 4;
  return {
    annualTotal: annualTotalComp(offer),
    firstYear: firstYearComp(offer),
    fourYear: fourYearComp(offer),
    equityPerYear: round2(positive(offer.equityValue) / vest),
  };
}

/** True when every offer uses the same currency (money can only be compared within one currency). */
export function haveSameCurrency(offers: Array<Pick<OfferDocument, "currency">>): boolean {
  return new Set(offers.map((o) => o.currency)).size <= 1;
}

const clampRating = (rating: unknown): number => Math.min(5, Math.max(1, num(rating, 3)));

function metricValue(item: ComparedOffer, metric: BestMetric): number | null {
  switch (metric) {
    case "baseSalary":
      return num(item.offer.baseSalary);
    case "annualTotal":
      return item.metrics.annualTotal;
    case "firstYear":
      return item.metrics.firstYear;
    case "annualBonus":
      return num(item.offer.annualBonus);
    case "signingBonus":
      return num(item.offer.signingBonus);
    case "equityValue":
      return num(item.offer.equityValue);
    case "ptoDays":
      return typeof item.offer.ptoDays === "number" ? item.offer.ptoDays : null;
  }
}

const BEST_METRICS: BestMetric[] = [
  "baseSalary",
  "annualBonus",
  "signingBonus",
  "equityValue",
  "annualTotal",
  "firstYear",
  "ptoDays",
];

/**
 * Rank offers by a weighted score.
 *  - compensation score = yearly total comp relative to the best offer in the set (0-100)
 *  - growth / work-life / culture scores = the 1-5 rating scaled to 0-100
 * Weights are normalised, so they never need to add up to 100. All-zero weights fall back to equal.
 * Returned list is sorted best-first.
 */
export function compareOffers(
  offers: OfferDocument[],
  weights: ComparisonWeights = DEFAULT_WEIGHTS,
): ComparedOffer[] {
  if (offers.length === 0) return [];

  const w = {
    compensation: positive(weights.compensation),
    growth: positive(weights.growth),
    workLife: positive(weights.workLife),
    culture: positive(weights.culture),
  };
  const weightSum = w.compensation + w.growth + w.workLife + w.culture;
  const norm = weightSum > 0 ? w : { compensation: 1, growth: 1, workLife: 1, culture: 1 };
  const normSum = weightSum > 0 ? weightSum : 4;

  const withMetrics = offers.map((offer) => ({ offer, metrics: computeMetrics(offer) }));
  const maxTotal = Math.max(...withMetrics.map((o) => o.metrics.annualTotal), 0);

  const scored: ComparedOffer[] = withMetrics.map(({ offer, metrics }) => {
    const scores = {
      compensation: maxTotal > 0 ? (metrics.annualTotal / maxTotal) * 100 : 0,
      growth: (clampRating(offer.growthRating) / 5) * 100,
      workLife: (clampRating(offer.workLifeRating) / 5) * 100,
      culture: (clampRating(offer.cultureRating) / 5) * 100,
    };
    const weighted =
      (scores.compensation * norm.compensation +
        scores.growth * norm.growth +
        scores.workLife * norm.workLife +
        scores.culture * norm.culture) /
      normSum;
    return {
      offer,
      metrics,
      scores,
      weightedScore: Math.round(weighted * 10) / 10,
      rank: 0,
      bestIn: [],
    };
  });

  if (scored.length > 1) {
    for (const metric of BEST_METRICS) {
      const values = scored.map((item) => metricValue(item, metric));
      const present = values.filter((v): v is number => v !== null);
      if (present.length < 2) continue;
      const max = Math.max(...present);
      const min = Math.min(...present);
      if (max <= 0 || max === min) continue; // nothing to celebrate when everything is equal
      scored.forEach((item, index) => {
        if (values[index] === max) item.bestIn.push(metric);
      });
    }
  }

  scored.sort(
    (a, b) => b.weightedScore - a.weightedScore || b.metrics.annualTotal - a.metrics.annualTotal,
  );
  scored.forEach((item, index) => {
    item.rank = index + 1;
  });
  return scored;
}

// ---------------------------------------------------------------------------
// Counter-offer suggestion (mirrors services/negotiation_logic.suggest_counter)
// ---------------------------------------------------------------------------

export const MAX_RAISE_PCT = 0.25;
const BASE_RAISE_PCT = 0.1;
const LEVERAGE_BONUS_PCT = 0.05;
const OPENING_ANCHOR_PCT = 0.05;

export interface CounterSuggestion {
  floor: number;
  target: number;
  opening: number;
  raisePct: number;
  aggressive: boolean;
  rationale: string;
}

function roundStep(value: number, reference: number): number {
  const step = reference >= 50_000 ? 1000 : reference >= 5_000 ? 100 : 10;
  return roundHalfEven(value / step) * step;
}

export function suggestCounter(
  baseSalary: number,
  options: { targetBase?: number | undefined; competingBases?: number[]; hasLeverage?: boolean } = {},
): CounterSuggestion {
  const base = positive(baseSalary);
  if (base <= 0) {
    return {
      floor: 0,
      target: 0,
      opening: 0,
      raisePct: 0,
      aggressive: false,
      rationale: "Add a base salary to get a counter-offer suggestion.",
    };
  }

  const competing = (options.competingBases ?? []).map((b) => num(b)).filter((b) => b > 0);
  const bestCompeting = competing.length > 0 ? Math.max(...competing) : 0;
  const leveraged = Boolean(options.hasLeverage) || competing.length > 0;

  const userTarget = num(options.targetBase);
  let target: number;
  let rationale: string;
  if (userTarget > 0) {
    target = userTarget;
    rationale = "Using the target base you entered.";
  } else {
    const pct = BASE_RAISE_PCT + (leveraged ? LEVERAGE_BONUS_PCT : 0);
    target = base * (1 + pct);
    rationale =
      `Rule of thumb: asking about ${roundHalfEven(pct * 100)}% above the initial base is common` +
      (leveraged ? " when you hold a competing offer or other leverage." : ".");
    if (bestCompeting > base) {
      const matched = Math.min(bestCompeting, base * (1 + MAX_RAISE_PCT));
      if (matched > target) {
        target = matched;
        rationale = "Matching the strongest competing base salary (capped at +25%).";
      }
    }
  }
  target = Math.max(target, base);

  let opening = userTarget > 0 ? target : target * (1 + OPENING_ANCHOR_PCT);
  if (userTarget <= 0) opening = Math.min(opening, base * (1 + MAX_RAISE_PCT + OPENING_ANCHOR_PCT));
  const floor = base + (target - base) / 2;

  const targetR = roundStep(target, base);
  const openingR = Math.max(roundStep(opening, base), targetR);
  const floorR = Math.min(roundStep(floor, base), targetR);
  const raisePct = ((targetR - base) / base) * 100;
  return {
    floor: floorR,
    target: targetR,
    opening: openingR,
    raisePct: Math.round(raisePct * 10) / 10,
    aggressive: raisePct > MAX_RAISE_PCT * 100 + 1e-9,
    rationale,
  };
}

// ---------------------------------------------------------------------------
// Helpers for pre-filling an offer from a tracked application
// ---------------------------------------------------------------------------

const CURRENCY_HINTS: Array<[RegExp, string]> = [
  [/₹|\bINR\b|\bLPA\b|\blakh/i, "INR"],
  [/€|\bEUR\b/i, "EUR"],
  [/£|\bGBP\b/i, "GBP"],
  [/\bCAD\b|C\$/i, "CAD"],
  [/\bAUD\b|A\$/i, "AUD"],
  [/\bSGD\b|S\$/i, "SGD"],
  [/\bAED\b/i, "AED"],
  [/\$|\bUSD\b/i, "USD"],
];

export interface ParsedSalaryRange {
  min: number;
  max: number;
  midpoint: number;
  currency?: string;
}

/**
 * Parse free-text salary ranges such as "$150k-$180k", "₹1,960,000–₹2,800,000 INR" or "12-18 LPA".
 * Returns null when the text is ambiguous rather than guessing.
 */
export function parseSalaryRange(text: string | null | undefined): ParsedSalaryRange | null {
  if (!text) return null;
  const matches = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(lpa|lakhs?|l|k|m)?\b/gi)];
  if (matches.length === 0) return null;

  const multiplier = (suffix: string | undefined): number => {
    switch ((suffix ?? "").toLowerCase()) {
      case "k":
        return 1_000;
      case "m":
        return 1_000_000;
      case "lpa":
      case "lakh":
      case "lakhs":
      case "l":
        return 100_000;
      default:
        return 1;
    }
  };

  const raw = matches.slice(0, 2).map((m) => ({
    value: Number((m[1] ?? "").replace(/,/g, "")),
    suffix: m[2],
  }));
  if (raw.some((r) => !Number.isFinite(r.value))) return null;

  // "150-180k": the unit written after the second number applies to both.
  const trailing = raw[raw.length - 1]?.suffix;
  const values = raw.map((r) => r.value * multiplier(r.suffix ?? (r.value < 1000 ? trailing : undefined)));
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min < 1000) return null; // too small to be an annual figure — don't guess

  const currency = CURRENCY_HINTS.find(([pattern]) => pattern.test(text))?.[1];
  const result: ParsedSalaryRange = { min, max, midpoint: Math.round((min + max) / 2) };
  if (currency) result.currency = currency;
  return result;
}

const SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  SGD: "S$",
  AED: "AED ",
};

/** Compact money formatting that keeps lakhs readable for INR (e.g. ₹24.5L) and K/M elsewhere. */
export function formatMoney(value: number, currency = "USD"): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const abs = Math.abs(num(value));
  const sign = value < 0 ? "-" : "";
  if (currency === "INR") {
    if (abs >= 10_000_000) return `${sign}${symbol}${trim(abs / 10_000_000)}Cr`;
    if (abs >= 100_000) return `${sign}${symbol}${trim(abs / 100_000)}L`;
    return `${sign}${symbol}${Math.round(abs).toLocaleString("en-IN")}`;
  }
  if (abs >= 1_000_000) return `${sign}${symbol}${trim(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}${symbol}${trim(abs / 1_000)}K`;
  return `${sign}${symbol}${Math.round(abs).toLocaleString("en-US")}`;
}

function trim(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}
