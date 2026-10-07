import { describe, it, expect } from "vitest";
import {
  createOffer,
  deleteOffer,
  getOffer,
  getOffers,
  parseSavedPlan,
  saveNegotiationPlan,
  updateOffer,
} from "../offers-service";
import { buildLocalNegotiationPlan } from "../negotiation";
import { getReminders } from "../reminders-service";
import type { CreateOfferInput } from "../types";

const VALID: CreateOfferInput = {
  company: "Acme",
  jobTitle: "Backend Engineer",
  workMode: "Hybrid",
  currency: "USD",
  baseSalary: 100_000,
  annualBonus: 10_000,
  signingBonus: 5_000,
  equityValue: 80_000,
  equityVestYears: 4,
  retirementMatchPct: 5,
  otherBenefitsValue: 2_000,
  growthRating: 4,
  workLifeRating: 3,
  cultureRating: 5,
  status: "Pending",
};

describe("createOffer — validation", () => {
  it("rejects a missing company with field errors", async () => {
    await expect(createOffer("offer-val-user", { ...VALID, company: "  " })).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
      fields: { company: "Company name is required" },
    });
  });

  it("rejects zero/negative money, bad ratings, bad currency and bad deadline", async () => {
    await expect(createOffer("offer-val-user", { ...VALID, baseSalary: 0 })).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
    await expect(createOffer("offer-val-user", { ...VALID, signingBonus: -1 })).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
    await expect(createOffer("offer-val-user", { ...VALID, growthRating: 6 })).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
    await expect(createOffer("offer-val-user", { ...VALID, currency: "dollars" })).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
    await expect(createOffer("offer-val-user", { ...VALID, deadline: "next friday" })).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });
});

describe("offers-service — CRUD workflow (local persistence)", () => {
  it("creates, lists, updates (incl. clearing optional fields) and deletes", async () => {
    const userId = "offer-crud-user";
    const created = await createOffer(userId, { ...VALID, deadline: "2026-12-01", ptoDays: 24, notes: "great team" });
    expect(created.id).toBeDefined();
    expect(created.userId).toBe(userId);

    expect((await getOffers(userId)).map((o) => o.id)).toEqual([created.id]);
    expect((await getOffer(userId, created.id))?.company).toBe("Acme");

    const updated = await updateOffer(userId, created.id, { baseSalary: 120_000, status: "Negotiating", deadline: null, notes: null });
    expect(updated.baseSalary).toBe(120_000);
    expect(updated.status).toBe("Negotiating");
    expect(updated.deadline).toBeUndefined();
    expect(updated.notes).toBeUndefined();
    expect(updated.ptoDays).toBe(24);

    await deleteOffer(userId, created.id);
    expect(await getOffers(userId)).toEqual([]);
    expect(await getOffer(userId, created.id)).toBeNull();
  });

  it("scopes offers to the signed-in user", async () => {
    const created = await createOffer("offer-owner", VALID);
    expect(await getOffers("offer-other")).toEqual([]);
    await expect(updateOffer("offer-other", created.id, { baseSalary: 1 })).rejects.toMatchObject({ type: "NOT_FOUND" });
    await expect(deleteOffer("offer-other", created.id)).rejects.toMatchObject({ type: "NOT_FOUND" });
  });

  it("rejects invalid updates", async () => {
    const created = await createOffer("offer-upd-user", VALID);
    await expect(updateOffer("offer-upd-user", created.id, { growthRating: 0 })).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });
});

describe("offers-service — saved negotiation plan", () => {
  it("round-trips a plan and tolerates malformed data", async () => {
    const userId = "offer-plan-user";
    const offer = await createOffer(userId, VALID);
    const plan = buildLocalNegotiationPlan(offer, { tone: "collaborative", priorities: ["Base salary"], competingOffers: [] });
    expect(plan.source).toBe("template");
    expect(plan.counter.target).toBe(110_000);
    expect(plan.email.body).toContain("Acme");

    const saved = await saveNegotiationPlan(userId, offer.id, plan);
    const restored = parseSavedPlan(saved);
    expect(restored?.counter.target).toBe(110_000);
    expect(restored?.email.subject).toBe(plan.email.subject);

    expect(parseSavedPlan({ negotiationPlan: "{not json" })).toBeNull();
    expect(parseSavedPlan({ negotiationPlan: JSON.stringify({ strategy: "x" }) })).toBeNull();
    expect(parseSavedPlan({ negotiationPlan: undefined })).toBeNull();
  });
});

describe("offers-service — deadline reminder integration", () => {
  it("creates one deadline reminder for a linked application and does not duplicate it", async () => {
    const userId = "offer-reminder-user";
    const { createApplicationApi } = await import("../api-client");
    const app = await createApplicationApi(userId, {
      company: "Linked",
      jobTitle: "Dev",
      applicationSource: "LinkedIn",
      status: "Offer",
    });

    const offer = await createOffer(userId, { ...VALID, applicationId: app.id, deadline: "2026-12-01" });
    let reminders = (await getReminders(userId, app.id)).filter((r) => r.type === "deadline");
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.reminderDate).toBe("2026-12-01T09:00");

    await updateOffer(userId, offer.id, { deadline: "2026-12-01" });
    reminders = (await getReminders(userId, app.id)).filter((r) => r.type === "deadline");
    expect(reminders).toHaveLength(1);

    await updateOffer(userId, offer.id, { deadline: "2026-12-05" });
    reminders = (await getReminders(userId, app.id)).filter((r) => r.type === "deadline");
    expect(reminders).toHaveLength(2);
  });

  it("never fails the offer save when the application link is unusable", async () => {
    const offer = await createOffer("offer-badlink-user", { ...VALID, applicationId: "missing-app", deadline: "2026-12-01" });
    expect(offer.id).toBeDefined();
  });
});

describe("buildLocalNegotiationPlan", () => {
  it("adapts to tone, leverage and aggressive targets", async () => {
    const offer = await createOffer("offer-tone-user", VALID);
    const firm = buildLocalNegotiationPlan(offer, { tone: "firm", priorities: ["Signing bonus"], competingOffers: [], targetBase: 140_000 });
    expect(firm.email.body).toContain("I would need a base salary of");
    expect(firm.counter.aggressive).toBe(true);
    expect(firm.risks.join(" ")).toContain("25%");
    expect(firm.pushbackResponses).toHaveLength(3);

    const warm = buildLocalNegotiationPlan(offer, { tone: "enthusiastic", priorities: [], competingOffers: [offer], applicantName: "Alex" });
    expect(warm.email.body).toContain("Alex");
    expect(warm.email.body).toContain("other opportunities");
  });
});
