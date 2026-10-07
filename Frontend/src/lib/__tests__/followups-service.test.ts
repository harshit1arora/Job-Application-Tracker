import { describe, it, expect } from "vitest";
import {
  createFollowUpLog,
  deleteFollowUpLog,
  generateFollowUpEmail,
  getDueFollowUpCount,
  getFollowUpLogs,
  getFollowUpSettings,
  getFollowUpSnapshot,
  markFollowUpSent,
  saveFollowUpSettings,
  scanAndCreateReminders,
  snoozeFollowUp,
} from "../followups-service";
import { DAY_MS, DEFAULT_FOLLOWUP_SETTINGS } from "../followup-logic";
import { getReminders } from "../reminders-service";

async function makeApp(userId: string, status: "Applied" | "Under Review" | "Interview" | "Offer" = "Applied", company = "Acme") {
  const { createApplicationApi } = await import("../api-client");
  return createApplicationApi(userId, { company, jobTitle: "Engineer", applicationSource: "LinkedIn", status });
}

describe("follow-up settings", () => {
  it("returns defaults, persists changes and validates input", async () => {
    const userId = "fu-settings";
    expect(await getFollowUpSettings(userId)).toEqual(DEFAULT_FOLLOWUP_SETTINGS);

    const saved = await saveFollowUpSettings(userId, { ...DEFAULT_FOLLOWUP_SETTINGS, appliedDays: 5, defaultTone: "friendly" });
    expect(saved.appliedDays).toBe(5);
    expect((await getFollowUpSettings(userId)).defaultTone).toBe("friendly");

    await expect(saveFollowUpSettings(userId, { ...DEFAULT_FOLLOWUP_SETTINGS, appliedDays: 0 })).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
    });
    await expect(saveFollowUpSettings(userId, { ...DEFAULT_FOLLOWUP_SETTINGS, maxFollowUps: 99 })).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
    });
    expect(await getFollowUpSettings("fu-settings-other")).toEqual(DEFAULT_FOLLOWUP_SETTINGS);
  });
});

describe("follow-up log", () => {
  it("creates, lists newest-first and deletes", async () => {
    const userId = "fu-log";
    const app = await makeApp(userId);
    const first = await createFollowUpLog(userId, { applicationId: app.id, channel: "email", subject: "Hi", body: "Checking in" });
    expect(first.id).toBeDefined();
    expect((await getFollowUpLogs(userId, app.id)).map((l) => l.id)).toEqual([first.id]);
    expect(await getFollowUpLogs("fu-log-other")).toEqual([]);

    await deleteFollowUpLog(userId, first.id);
    expect(await getFollowUpLogs(userId)).toEqual([]);
    await expect(deleteFollowUpLog(userId, first.id)).rejects.toMatchObject({ type: "NOT_FOUND" });
  });

  it("validates input", async () => {
    await expect(createFollowUpLog("fu-log", { applicationId: "", channel: "email" })).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
    await expect(createFollowUpLog("fu-log", { applicationId: "a", channel: "pigeon" as never })).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });
});

describe("scanAndCreateReminders — automation end to end", () => {
  const future = () => Date.now() + 10 * DAY_MS; // pretend 10 days have passed

  it("creates exactly one follow-up reminder per quiet application and is idempotent", async () => {
    const userId = "fu-scan";
    const quiet = await makeApp(userId, "Applied", "QuietCo");
    await makeApp(userId, "Offer", "OfferCo"); // never chased

    const now = future();
    const first = await scanAndCreateReminders(userId, { now });
    expect(first.created).toHaveLength(1);
    expect(first.created[0]?.applicationId).toBe(quiet.id);
    expect(first.created[0]?.type).toBe("follow-up");
    expect(first.created[0]?.message).toContain("QuietCo");

    const second = await scanAndCreateReminders(userId, { now });
    expect(second.created).toHaveLength(0);
    expect((await getReminders(userId, quiet.id)).filter((r) => r.type === "follow-up")).toHaveLength(1);
  });

  it("does nothing for recent applications, and respects the enabled / auto-create settings", async () => {
    const userId = "fu-scan-settings";
    await makeApp(userId);
    expect((await scanAndCreateReminders(userId)).created).toHaveLength(0); // brand-new application

    await saveFollowUpSettings(userId, { ...DEFAULT_FOLLOWUP_SETTINGS, autoCreateReminders: false });
    const auto = await scanAndCreateReminders(userId, { now: future() });
    expect(auto.skipped).toBe("auto-off");
    expect(auto.created).toHaveLength(0);

    const forced = await scanAndCreateReminders(userId, { now: future(), force: true });
    expect(forced.created).toHaveLength(1);

    await saveFollowUpSettings(userId, { ...DEFAULT_FOLLOWUP_SETTINGS, enabled: false });
    expect((await scanAndCreateReminders(userId, { now: future(), force: true })).skipped).toBe("disabled");
  });

  it("shares one in-flight scan between concurrent callers (no duplicates)", async () => {
    const userId = "fu-scan-race";
    const app = await makeApp(userId);
    const now = future();
    const [a, b] = await Promise.all([scanAndCreateReminders(userId, { now }), scanAndCreateReminders(userId, { now })]);
    expect(a.created.length + b.created.length === 1 || a === b).toBe(true);
    expect((await getReminders(userId, app.id)).filter((r) => r.type === "follow-up")).toHaveLength(1);
  });
});

describe("follow-up actions", () => {
  const future = () => Date.now() + 10 * DAY_MS;

  it("mark-as-sent logs the follow-up, completes open reminders and restarts the clock", async () => {
    const userId = "fu-sent";
    const app = await makeApp(userId);
    const now = future();
    await scanAndCreateReminders(userId, { now });

    let snap = await getFollowUpSnapshot(userId, now);
    expect(snap.evaluation.due).toHaveLength(1);
    expect(await getDueFollowUpCount(userId)).toBeGreaterThanOrEqual(0);

    const item = snap.evaluation.due[0]!;
    const log = await markFollowUpSent(userId, item, { channel: "email", tone: "polite", subject: "Hi", body: "Checking in" });
    expect(log.applicationId).toBe(app.id);

    const reminders = (await getReminders(userId, app.id)).filter((r) => r.type === "follow-up");
    expect(reminders.every((r) => r.isCompleted)).toBe(true);

    snap = await getFollowUpSnapshot(userId, Date.now() + DAY_MS);
    expect(snap.logs).toHaveLength(1);
    expect(snap.evaluation.due).toHaveLength(0); // clock restarted by the log
  });

  it("snooze reschedules the open reminder instead of creating a duplicate", async () => {
    const userId = "fu-snooze";
    const app = await makeApp(userId);
    const now = future();
    await scanAndCreateReminders(userId, { now });
    const item = (await getFollowUpSnapshot(userId, now)).evaluation.due[0]!;

    await snoozeFollowUp(userId, item, 3, now);
    const reminders = (await getReminders(userId, app.id)).filter((r) => r.type === "follow-up" && !r.isCompleted);
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.reminderDate).toMatch(/T09:00$/);

    const snap = await getFollowUpSnapshot(userId, now);
    expect(snap.evaluation.due).toHaveLength(0);
    expect(snap.evaluation.snoozed).toHaveLength(1);
  });

  it("snooze creates a reminder when none exists", async () => {
    const userId = "fu-snooze-new";
    const app = await makeApp(userId);
    const now = future();
    const item = (await getFollowUpSnapshot(userId, now)).evaluation.due[0]!;
    await snoozeFollowUp(userId, item, 2, now);
    expect((await getReminders(userId, app.id)).filter((r) => r.type === "follow-up")).toHaveLength(1);
  });
});

describe("generateFollowUpEmail", () => {
  it("falls back to the offline template when the AI is unreachable", async () => {
    const userId = "fu-draft";
    const app = await makeApp(userId);
    const draft = await generateFollowUpEmail(
      { application: app, daysQuiet: 9, followUpNumber: 2 },
      { tone: "friendly", applicantName: "Alex", recruiterName: "Priya" },
    );
    expect(draft.source).toBe("template");
    expect(draft.subject).toContain("Checking in again");
    expect(draft.body).toContain("Hi Priya,");
    expect(draft.body).toContain("Alex");
  });
});
