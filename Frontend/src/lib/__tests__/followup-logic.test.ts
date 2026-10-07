import { describe, it, expect } from "vitest";
import {
  DAY_MS,
  DEFAULT_FOLLOWUP_SETTINGS,
  buildFollowUpItem,
  buildLocalFollowUpEmail,
  buildReminderMessage,
  evaluateFollowUps,
  itemsNeedingReminder,
  snoozeDate,
  thresholdFor,
  toEpochMs,
} from "../followup-logic";
import type { ApplicationDocument, FollowUpLog, ReminderDocument } from "../types";

const NOW = new Date("2026-10-07T12:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * DAY_MS).toISOString();

function app(overrides: Partial<ApplicationDocument> = {}): ApplicationDocument {
  return {
    id: "a1",
    userId: "u1",
    company: "Acme",
    jobTitle: "Engineer",
    applicationSource: "LinkedIn",
    status: "Applied",
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
    ...overrides,
  } as ApplicationDocument;
}

function reminder(overrides: Partial<ReminderDocument> = {}): ReminderDocument {
  return {
    id: "r1",
    userId: "u1",
    applicationId: "a1",
    reminderDate: daysAgo(0),
    type: "follow-up",
    isCompleted: false,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...overrides,
  } as ReminderDocument;
}

function log(overrides: Partial<FollowUpLog> = {}): FollowUpLog {
  return { id: "l1", userId: "u1", applicationId: "a1", channel: "email", createdAt: daysAgo(10), ...overrides };
}

const evaluate = (apps: ApplicationDocument[], reminders: ReminderDocument[] = [], logs: FollowUpLog[] = [], settings = DEFAULT_FOLLOWUP_SETTINGS) =>
  evaluateFollowUps({ applications: apps, reminders, logs, settings, now: NOW });

describe("thresholdFor", () => {
  it("maps statuses to their limits and ignores the rest", () => {
    expect(thresholdFor("Applied", DEFAULT_FOLLOWUP_SETTINGS)).toBe(7);
    expect(thresholdFor("Under Review", DEFAULT_FOLLOWUP_SETTINGS)).toBe(10);
    expect(thresholdFor("Interview", DEFAULT_FOLLOWUP_SETTINGS)).toBe(4);
    expect(thresholdFor("Saved", DEFAULT_FOLLOWUP_SETTINGS)).toBeNull();
    expect(thresholdFor("Offer", DEFAULT_FOLLOWUP_SETTINGS)).toBeNull();
    expect(thresholdFor("Rejected", DEFAULT_FOLLOWUP_SETTINGS)).toBeNull();
  });
});

describe("toEpochMs", () => {
  it("accepts ISO strings and numbers, and returns 0 for junk", () => {
    expect(toEpochMs("2026-10-07T12:00:00Z")).toBe(NOW);
    expect(toEpochMs(NOW)).toBe(NOW);
    expect(toEpochMs("nope")).toBe(0);
    expect(toEpochMs(undefined)).toBe(0);
    expect(toEpochMs(Number.NaN)).toBe(0);
  });
});

describe("evaluateFollowUps", () => {
  it("flags quiet applications as due with the days quiet", () => {
    const result = evaluate([app()]);
    expect(result.due).toHaveLength(1);
    expect(result.due[0]).toMatchObject({ daysQuiet: 30, thresholdDays: 7, followUpNumber: 1, sentCount: 0 });
  });

  it("puts recent applications in 'upcoming' with days until due", () => {
    const result = evaluate([app({ updatedAt: daysAgo(2), createdAt: daysAgo(2) })]);
    expect(result.due).toHaveLength(0);
    expect(result.upcoming[0]).toMatchObject({ daysQuiet: 2, daysUntilDue: 5 });
  });

  it("skips statuses that never need chasing", () => {
    const result = evaluate([app({ status: "Offer" }), app({ id: "a2", status: "Rejected" }), app({ id: "a3", status: "Saved" })]);
    expect(result).toEqual({ due: [], exhausted: [], snoozed: [], upcoming: [] });
  });

  it("restarts the quiet clock after a logged follow-up and counts them", () => {
    const result = evaluate([app()], [], [log({ createdAt: daysAgo(3) })]);
    expect(result.due).toHaveLength(0);
    expect(result.upcoming[0]).toMatchObject({ daysQuiet: 3, sentCount: 1, followUpNumber: 2 });

    const later = evaluate([app()], [], [log({ createdAt: daysAgo(8) })]);
    expect(later.due[0]).toMatchObject({ followUpNumber: 2, daysQuiet: 8 });
  });

  it("moves applications to 'exhausted' once max follow-ups were sent", () => {
    const logs = [log({ id: "1", createdAt: daysAgo(30) }), log({ id: "2", createdAt: daysAgo(20) }), log({ id: "3", createdAt: daysAgo(10) })];
    const result = evaluate([app()], [], logs);
    expect(result.due).toHaveLength(0);
    expect(result.exhausted).toHaveLength(1);
    expect(result.exhausted[0]?.sentCount).toBe(3);
  });

  it("treats a future open follow-up reminder as a snooze, but ignores completed or past ones", () => {
    const future = new Date(NOW + 2 * DAY_MS).toISOString();
    expect(evaluate([app()], [reminder({ reminderDate: future })]).snoozed).toHaveLength(1);
    expect(evaluate([app()], [reminder({ reminderDate: future, isCompleted: true })]).due).toHaveLength(1);
    expect(evaluate([app()], [reminder({ reminderDate: daysAgo(1) })]).due).toHaveLength(1);
    expect(evaluate([app()], [reminder({ reminderDate: future, type: "deadline" })]).due).toHaveLength(1);
  });

  it("returns nothing when the feature is disabled", () => {
    const result = evaluate([app()], [], [], { ...DEFAULT_FOLLOWUP_SETTINGS, enabled: false });
    expect(result.due).toHaveLength(0);
  });

  it("honours custom thresholds and accepts numeric (local demo) timestamps", () => {
    const settings = { ...DEFAULT_FOLLOWUP_SETTINGS, appliedDays: 3 };
    const numeric = app({ createdAt: (NOW - 4 * DAY_MS) as unknown as string, updatedAt: (NOW - 4 * DAY_MS) as unknown as string });
    expect(evaluate([numeric], [], [], settings).due).toHaveLength(1);
  });

  it("sorts the most overdue first", () => {
    const result = evaluate([
      app({ id: "slight", updatedAt: daysAgo(8), createdAt: daysAgo(8) }),
      app({ id: "worst", updatedAt: daysAgo(40), createdAt: daysAgo(40) }),
    ]);
    expect(result.due.map((i) => i.application.id)).toEqual(["worst", "slight"]);
  });
});

describe("itemsNeedingReminder", () => {
  it("is idempotent: skips applications that already have an open follow-up reminder", () => {
    const quiet = [app(), app({ id: "a2" })];
    const evaluation = evaluate(quiet);
    expect(itemsNeedingReminder(evaluation, []).map((i) => i.application.id).sort()).toEqual(["a1", "a2"]);
    const withOpen = [reminder({ applicationId: "a1", reminderDate: daysAgo(1) })];
    expect(itemsNeedingReminder(evaluation, withOpen).map((i) => i.application.id)).toEqual(["a2"]);
    const completed = [reminder({ applicationId: "a1", isCompleted: true })];
    expect(itemsNeedingReminder(evaluation, completed)).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("builds a reminder message and a manual item", () => {
    const item = evaluate([app()]).due[0]!;
    expect(buildReminderMessage(item)).toBe("Follow up with Acme (Engineer) — quiet for 30 days");
    const manual = buildFollowUpItem(app({ updatedAt: daysAgo(1), createdAt: daysAgo(1) }), [log()], DEFAULT_FOLLOWUP_SETTINGS, NOW);
    expect(manual).toMatchObject({ daysQuiet: 1, followUpNumber: 2, sentCount: 1 });
  });

  it("snoozes to 09:00 local, N days ahead", () => {
    const value = snoozeDate(NOW, 3);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T09:00$/);
  });
});

describe("buildLocalFollowUpEmail", () => {
  const base = { company: "Acme", jobTitle: "Engineer", status: "Applied" as const, tone: "polite" as const };

  it("escalates across follow-up numbers", () => {
    expect(buildLocalFollowUpEmail({ ...base, followUpNumber: 1 }).subject).toContain("Following up");
    expect(buildLocalFollowUpEmail({ ...base, followUpNumber: 2 }).subject).toContain("Checking in again");
    const last = buildLocalFollowUpEmail({ ...base, followUpNumber: 3 });
    expect(last.subject).toContain("Closing the loop");
    expect(last.body).toContain("last note");
  });

  it("personalises greeting and sign-off, with safe placeholders", () => {
    const named = buildLocalFollowUpEmail({ ...base, followUpNumber: 1, recruiterName: "Priya", applicantName: "Alex" });
    expect(named.body).toContain("Dear Priya,");
    expect(named.body).toContain("Alex");
    const anon = buildLocalFollowUpEmail({ ...base, followUpNumber: 1, tone: "friendly" });
    expect(anon.body).toContain("Hi there,");
    expect(anon.body).toContain("[Your name]");
  });

  it("adapts the opening to the application status", () => {
    expect(buildLocalFollowUpEmail({ ...base, status: "Interview", followUpNumber: 1 }).body).toContain("interview");
  });
});
