import { describe, it, expect } from "vitest";
import {
  annualTotalComp,
  compareOffers,
  firstYearComp,
  fourYearComp,
  formatMoney,
  haveSameCurrency,
  parseSalaryRange,
  suggestCounter,
  DEFAULT_WEIGHTS,
} from "../offer-math";
import type { OfferDocument } from "../types";

function offer(overrides: Partial<OfferDocument> = {}): OfferDocument {
  return {
    id: "o1",
    userId: "u1",
    company: "Acme",
    jobTitle: "Engineer",
    workMode: "Hybrid",
    currency: "USD",
    baseSalary: 100_000,
    annualBonus: 0,
    signingBonus: 0,
    equityValue: 0,
    equityVestYears: 4,
    retirementMatchPct: 0,
    otherBenefitsValue: 0,
    growthRating: 3,
    workLifeRating: 3,
    cultureRating: 3,
    status: "Pending",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("annualTotalComp", () => {
  it("spreads equity over vesting and adds match, bonus and benefits", () => {
    expect(
      annualTotalComp({
        baseSalary: 100_000,
        annualBonus: 10_000,
        equityValue: 80_000,
        equityVestYears: 4,
        retirementMatchPct: 5,
        otherBenefitsValue: 2_000,
      }),
    ).toBe(137_000);
  });

  it("is defensive against bad input", () => {
    expect(annualTotalComp({})).toBe(0);
    expect(annualTotalComp({ baseSalary: -5, equityValue: 400, equityVestYears: 0 })).toBe(100);
    expect(annualTotalComp({ baseSalary: Number.NaN })).toBe(0);
  });

  it("derives first-year and four-year values", () => {
    const o = { baseSalary: 100_000, signingBonus: 20_000 };
    expect(firstYearComp(o)).toBe(120_000);
    expect(fourYearComp(o)).toBe(420_000);
  });
});

describe("compareOffers", () => {
  it("ranks by weighted score and flags the best value per row", () => {
    const cash = offer({ id: "cash", company: "CashCo", baseSalary: 200_000, growthRating: 2, workLifeRating: 2, cultureRating: 2 });
    const happy = offer({ id: "happy", company: "HappyCo", baseSalary: 150_000, growthRating: 5, workLifeRating: 5, cultureRating: 5 });

    const money = compareOffers([happy, cash], { compensation: 100, growth: 0, workLife: 0, culture: 0 });
    expect(money[0]?.offer.id).toBe("cash");
    expect(money[0]?.rank).toBe(1);
    expect(money[0]?.bestIn).toContain("baseSalary");
    expect(money[1]?.bestIn).not.toContain("baseSalary");

    const life = compareOffers([happy, cash], { compensation: 0, growth: 50, workLife: 50, culture: 0 });
    expect(life[0]?.offer.id).toBe("happy");
  });

  it("normalises weights and falls back to equal weights when all are zero", () => {
    const a = offer({ id: "a", baseSalary: 100_000, growthRating: 5, workLifeRating: 5, cultureRating: 5 });
    const b = offer({ id: "b", baseSalary: 100_000, growthRating: 1, workLifeRating: 1, cultureRating: 1 });
    const zero = compareOffers([b, a], { compensation: 0, growth: 0, workLife: 0, culture: 0 });
    expect(zero[0]?.offer.id).toBe("a");
    const scaled = compareOffers([a, b], { compensation: 4, growth: 2.5, workLife: 2, culture: 1.5 });
    const base = compareOffers([a, b], DEFAULT_WEIGHTS);
    expect(scaled[0]?.weightedScore).toBe(base[0]?.weightedScore);
  });

  it("does not celebrate rows where every offer is equal", () => {
    const result = compareOffers([offer({ id: "a" }), offer({ id: "b" })]);
    expect(result.every((item) => item.bestIn.length === 0)).toBe(true);
  });

  it("handles empty input and a single offer", () => {
    expect(compareOffers([])).toEqual([]);
    expect(compareOffers([offer()])[0]?.rank).toBe(1);
  });

  it("reports whether currencies match", () => {
    expect(haveSameCurrency([offer(), offer({ id: "x" })])).toBe(true);
    expect(haveSameCurrency([offer(), offer({ id: "x", currency: "INR" })])).toBe(false);
  });
});

describe("suggestCounter (mirrors the backend)", () => {
  it("uses the 10% rule of thumb by default", () => {
    expect(suggestCounter(1_000_000)).toMatchObject({
      floor: 1_050_000,
      target: 1_100_000,
      opening: 1_155_000,
      raisePct: 10,
      aggressive: false,
    });
  });

  it("adds leverage and matches a competing base (capped at +25%)", () => {
    expect(suggestCounter(1_000_000, { hasLeverage: true }).target).toBe(1_150_000);
    expect(suggestCounter(1_000_000, { competingBases: [1_300_000] }).target).toBe(1_250_000);
  });

  it("respects a user target, flags aggressive asks and never lowers the base", () => {
    const aggressive = suggestCounter(100_000, { targetBase: 140_000 });
    expect(aggressive.target).toBe(140_000);
    expect(aggressive.aggressive).toBe(true);
    expect(suggestCounter(100_000, { targetBase: 90_000 }).target).toBe(100_000);
  });

  it("returns zeros without a base", () => {
    expect(suggestCounter(0).target).toBe(0);
  });
});

describe("parseSalaryRange", () => {
  it("parses common formats", () => {
    expect(parseSalaryRange("$150k-$180k")).toMatchObject({ min: 150_000, max: 180_000, midpoint: 165_000, currency: "USD" });
    expect(parseSalaryRange("₹1,960,000–₹2,800,000 INR")).toMatchObject({ min: 1_960_000, max: 2_800_000, currency: "INR" });
    expect(parseSalaryRange("12-18 LPA")).toMatchObject({ min: 1_200_000, max: 1_800_000, currency: "INR" });
    expect(parseSalaryRange("150-180k")).toMatchObject({ min: 150_000, max: 180_000 });
    expect(parseSalaryRange("$120,000")).toMatchObject({ midpoint: 120_000 });
  });

  it("returns null instead of guessing", () => {
    expect(parseSalaryRange("negotiable")).toBeNull();
    expect(parseSalaryRange("10 years")).toBeNull();
    expect(parseSalaryRange("")).toBeNull();
    expect(parseSalaryRange(undefined)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats lakhs for INR and K/M elsewhere", () => {
    expect(formatMoney(2_450_000, "INR")).toBe("₹24.5L");
    expect(formatMoney(20_000_000, "INR")).toBe("₹2Cr");
    expect(formatMoney(137_000)).toBe("$137K");
    expect(formatMoney(5_000, "EUR")).toBe("€5,000");
  });
});
