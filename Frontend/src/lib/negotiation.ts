/**
 * negotiation.ts — salary-negotiation coach.
 *
 * generateNegotiationPlan() asks the backend (Gemini) for a plan; if the AI is unavailable
 * (not signed in, offline, quota, malformed output) it falls back to a deterministic template so
 * the feature always works end to end.
 *
 * Numbers always come from suggestCounter() — the AI only writes the words around them.
 */
import { z } from "zod";
import { aiRequest } from "./ai";
import { formatMoney, suggestCounter, annualTotalComp } from "./offer-math";
import type { CounterSuggestion } from "./offer-math";
import type { NegotiationPlan, NegotiationTone, OfferDocument } from "./types";

export const NEGOTIATION_PRIORITIES = [
  "Base salary",
  "Signing bonus",
  "Equity",
  "Annual bonus",
  "Extra PTO",
  "Remote flexibility",
  "Start date",
] as const;

export interface NegotiationOptions {
  tone: NegotiationTone;
  targetBase?: number | undefined;
  leverage?: string | undefined;
  candidateHighlights?: string | undefined;
  priorities: string[];
  /** Other offers the candidate holds (same currency) — used as honest leverage. */
  competingOffers: OfferDocument[];
  applicantName?: string | undefined;
}

const aiPlanSchema = z.object({
  strategy: z.string().min(1),
  counter: z.object({
    floor: z.number(),
    target: z.number(),
    opening: z.number(),
    raisePct: z.number(),
    aggressive: z.boolean(),
    rationale: z.string(),
  }),
  talkingPoints: z.array(z.string()),
  email: z.object({ subject: z.string(), body: z.string() }),
  phoneScript: z.string(),
  pushbackResponses: z.array(z.object({ objection: z.string(), response: z.string() })),
  risks: z.array(z.string()),
});

export function computeCounter(offer: OfferDocument, options: Pick<NegotiationOptions, "targetBase" | "leverage" | "competingOffers">): CounterSuggestion {
  return suggestCounter(offer.baseSalary, {
    targetBase: options.targetBase,
    competingBases: options.competingOffers.map((o) => o.baseSalary),
    hasLeverage: Boolean(options.leverage?.trim()),
  });
}

export async function generateNegotiationPlan(
  userId: string,
  offer: OfferDocument,
  options: NegotiationOptions,
): Promise<NegotiationPlan> {
  void userId; // auth comes from the Firebase session inside aiRequest
  const counter = computeCounter(offer, options);

  try {
    const response = await aiRequest<unknown>(
      "/ai/negotiate",
      {
        applicantName: options.applicantName?.trim() ?? "",
        company: offer.company,
        jobTitle: offer.jobTitle,
        currency: offer.currency,
        baseSalary: offer.baseSalary,
        annualBonus: offer.annualBonus,
        signingBonus: offer.signingBonus,
        equityValue: offer.equityValue,
        equityVestYears: offer.equityVestYears,
        ptoDays: offer.ptoDays,
        workMode: offer.workMode,
        targetBase: options.targetBase,
        tone: options.tone,
        leverage: options.leverage?.trim() || undefined,
        candidateHighlights: options.candidateHighlights?.trim() || undefined,
        competingOffers: options.competingOffers.slice(0, 4).map((o) => ({
          company: o.company,
          baseSalary: o.baseSalary,
          totalComp: annualTotalComp(o),
        })),
        priorities: options.priorities.slice(0, 5),
      },
      45000,
    );
    const parsed = aiPlanSchema.safeParse(response);
    if (parsed.success && (parsed.data.email.body.trim() || parsed.data.phoneScript.trim())) {
      return { ...parsed.data, source: "ai", generatedAt: new Date().toISOString() };
    }
  } catch {
    // Use the offline template below.
  }
  return buildLocalNegotiationPlan(offer, options, counter);
}

// ---------------------------------------------------------------------------
// Offline template
// ---------------------------------------------------------------------------

export function buildLocalNegotiationPlan(
  offer: OfferDocument,
  options: NegotiationOptions,
  counter: CounterSuggestion = computeCounter(offer, options),
): NegotiationPlan {
  const money = (value: number) => formatMoney(value, offer.currency);
  const name = options.applicantName?.trim() || "[Your name]";
  const role = offer.jobTitle;
  const company = offer.company;
  const hasCompeting = options.competingOffers.length > 0;
  const nonBase = options.priorities.filter((p) => p !== "Base salary");
  const flexibilityAsk =
    nonBase.length > 0
      ? nonBase.map((p) => p.toLowerCase()).join(", ")
      : "a signing bonus, equity or additional PTO";

  const opening =
    options.tone === "firm"
      ? `Thank you for the offer for the ${role} role at ${company}. I'd like to be direct so we can move quickly: to accept, I would need a base salary of ${money(counter.target)}.`
      : options.tone === "enthusiastic"
        ? `Thank you so much for the offer for the ${role} role at ${company} — I'm genuinely excited about the team and the work, and I'd love to make this happen.`
        : `Thank you for the offer for the ${role} position at ${company}. I'm excited about the role and the team.`;

  const ask =
    options.tone === "firm"
      ? `That reflects the scope of the role${options.candidateHighlights?.trim() ? " and what I bring" : ""}.`
      : `After reviewing the full package, I'd like to discuss the base salary. Based on the scope of the role${hasCompeting ? " and the other opportunities I'm considering" : ""}, I was hoping for a base closer to ${money(counter.opening)}.`;

  const highlights = options.candidateHighlights?.trim()
    ? `A few things I'd highlight: ${options.candidateHighlights.trim()}`
    : "";

  const flex =
    options.tone === "firm"
      ? `If the base is fixed, I'm open to discussing ${flexibilityAsk} to close the gap.`
      : `If there is limited flexibility on base, I'm also open to discussing ${flexibilityAsk}.`;

  const close =
    options.tone === "enthusiastic"
      ? "I'm confident we can find something that works for both sides and I'm eager to get started. Could we find a time to talk this week?"
      : "I'm confident we can find an arrangement that works for both of us. Could we find a time to talk this week?";

  const emailBody = [
    "Hi [Recruiter name],",
    opening,
    ask,
    highlights,
    flex,
    close,
    `Best regards,\n${name}`,
  ]
    .filter((part) => part.length > 0)
    .join("\n\n");

  const talkingPoints = [
    `Open by thanking them and restating your enthusiasm for the ${role} role.`,
    `Anchor on a base of ${money(counter.opening)}; you would be happy to land near ${money(counter.target)}.`,
    ...(options.candidateHighlights?.trim()
      ? [`Tie the ask to concrete value: ${options.candidateHighlights.trim()}`]
      : ["Tie the ask to concrete, specific value you bring (projects, results, scope)."]),
    ...(options.leverage?.trim() ? [`Leverage you noted: ${options.leverage.trim()}`] : []),
    ...(hasCompeting
      ? [`You hold ${options.competingOffers.length} other offer(s); mention them honestly and without naming figures you can't back up.`]
      : []),
    `If base is capped, pivot to ${flexibilityAsk}.`,
    "After each ask, pause and let them respond — silence is part of the process.",
  ].slice(0, 7);

  const phoneScript = [
    `"Thank you again for the offer — I'm really excited about the ${role} role at ${company}."`,
    `"I'd like to talk about the base salary. Given the scope of the role, I was hoping for around ${money(counter.opening)}."`,
    `"If there's a constraint on base, I'd be glad to look at ${flexibilityAsk} together."`,
    `"What flexibility do you have, and what would you need from me to move forward?"`,
  ].join("\n\n");

  const deadlineLine = offer.deadline ? ` by ${offer.deadline}` : "";
  const pushbackResponses = [
    {
      objection: "This is already the top of the band for this level.",
      response: `I appreciate that. Could you help me understand how the level and band were set? If base is capped, I'd like to explore ${flexibilityAsk} so the total package reflects the value I'd bring.`,
    },
    {
      objection: "We can't negotiate on compensation.",
      response: `Understood. Are there other parts of the package with flexibility — such as ${flexibilityAsk}, or a review of compensation after six months?`,
    },
    {
      objection: `We need your decision${deadlineLine || " soon"}.`,
      response: `I'm very interested and want to give you a confident yes. Could we agree on a short extension so I can finalize my decision? I can commit to a firm answer by a specific date.`,
    },
  ];

  const risks = [
    ...(counter.aggressive
      ? [`Your target is more than 25% above the current base — expect pushback and have a smaller fallback ready (floor ${money(counter.floor)}).`]
      : []),
    "Never bluff about competing offers; recruiters may ask for details.",
    "Get final agreed terms in writing before declining other opportunities.",
    "Offers can be withdrawn in rare cases — negotiate respectfully and stay positive.",
  ].slice(0, 4);

  return {
    strategy:
      `Lead with enthusiasm, then make one clear ask. ${counter.rationale} ` +
      `Open at ${money(counter.opening)}, target ${money(counter.target)}, and treat ${money(counter.floor)} as the lowest counter worth sending. ` +
      `If base can't move, trade toward ${flexibilityAsk}.`,
    counter,
    talkingPoints,
    email: {
      subject: `Re: ${role} offer — ${company}`,
      body: emailBody,
    },
    phoneScript,
    pushbackResponses,
    risks,
    source: "template",
    generatedAt: new Date().toISOString(),
  };
}
