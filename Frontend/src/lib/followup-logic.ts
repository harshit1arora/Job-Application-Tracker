/**
 * followup-logic.ts — pure rules for "Smart Follow-up" automation.
 *
 * Decides which applications have gone quiet, how many follow-ups were already sent and which
 * ones still need an automatic reminder. No I/O: the caller passes in applications, reminders and
 * follow-up logs, plus a clock, so behaviour is fully deterministic and unit-testable.
 *
 * "Last activity" of an application = the most recent of
 *   - its updatedAt (status change, notes edit, ...)  — used as the proxy for "last contact"
 *   - its createdAt
 *   - the newest logged follow-up
 */
import type {
  ApplicationDocument,
  ApplicationStatus,
  FollowUpEvaluation,
  FollowUpItem,
  FollowUpLog,
  FollowUpSettings,
  FollowUpTone,
  ReminderDocument,
} from "./types";

export const DAY_MS = 86_400_000;

export const DEFAULT_FOLLOWUP_SETTINGS: FollowUpSettings = {
  enabled: true,
  appliedDays: 7,
  underReviewDays: 10,
  interviewDays: 4,
  maxFollowUps: 3,
  autoCreateReminders: true,
  defaultTone: "polite",
};

/** Accepts ISO strings or epoch-ms numbers (local demo data uses numbers); returns 0 if unusable. */
export function toEpochMs(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Days of silence before an application in `status` should be nudged; null = never nudged. */
export function thresholdFor(status: ApplicationStatus, settings: FollowUpSettings): number | null {
  switch (status) {
    case "Applied":
      return settings.appliedDays;
    case "Under Review":
      return settings.underReviewDays;
    case "Interview":
      return settings.interviewDays;
    default:
      return null; // Saved / Offer / Rejected don't need chasing
  }
}

export interface EvaluateInput {
  applications: ApplicationDocument[];
  reminders: ReminderDocument[];
  logs: FollowUpLog[];
  settings: FollowUpSettings;
  now?: number;
}

export function evaluateFollowUps(input: EvaluateInput): FollowUpEvaluation {
  const { applications, reminders, logs, settings } = input;
  const now = input.now ?? Date.now();
  const result: FollowUpEvaluation = { due: [], exhausted: [], snoozed: [], upcoming: [] };
  if (!settings.enabled) return result;

  const logsByApp = new Map<string, FollowUpLog[]>();
  for (const log of logs) {
    const list = logsByApp.get(log.applicationId) ?? [];
    list.push(log);
    logsByApp.set(log.applicationId, list);
  }

  const openRemindersByApp = new Map<string, ReminderDocument[]>();
  for (const reminder of reminders) {
    if (reminder.type !== "follow-up" || reminder.isCompleted) continue;
    const list = openRemindersByApp.get(reminder.applicationId) ?? [];
    list.push(reminder);
    openRemindersByApp.set(reminder.applicationId, list);
  }

  for (const application of applications) {
    const thresholdDays = thresholdFor(application.status, settings);
    if (thresholdDays === null) continue;

    const appLogs = logsByApp.get(application.id) ?? [];
    const lastActivityAt = Math.max(
      toEpochMs(application.updatedAt),
      toEpochMs(application.createdAt),
      ...appLogs.map((log) => toEpochMs(log.createdAt)),
    );
    if (lastActivityAt <= 0) continue;

    const daysQuiet = Math.max(0, Math.floor((now - lastActivityAt) / DAY_MS));
    const sentCount = appLogs.length;

    const futureReminders = (openRemindersByApp.get(application.id) ?? [])
      .map((reminder) => ({ reminder, at: toEpochMs(reminder.reminderDate) }))
      .filter(({ at }) => at > now)
      .sort((a, b) => a.at - b.at);

    const item: FollowUpItem = {
      application,
      daysQuiet,
      thresholdDays,
      followUpNumber: sentCount + 1,
      sentCount,
      lastActivityAt,
      daysUntilDue: Math.max(0, thresholdDays - daysQuiet),
      snoozedUntil: futureReminders[0]?.reminder.reminderDate,
    };

    if (daysQuiet < thresholdDays) {
      result.upcoming.push(item);
    } else if (sentCount >= settings.maxFollowUps) {
      result.exhausted.push(item);
    } else if (futureReminders.length > 0) {
      result.snoozed.push(item);
    } else {
      result.due.push(item);
    }
  }

  result.due.sort((a, b) => b.daysQuiet - b.thresholdDays - (a.daysQuiet - a.thresholdDays));
  result.exhausted.sort((a, b) => b.daysQuiet - a.daysQuiet);
  result.snoozed.sort((a, b) => toEpochMs(a.snoozedUntil) - toEpochMs(b.snoozedUntil));
  result.upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  return result;
}

/**
 * Build a FollowUpItem for ONE application regardless of whether it has crossed its threshold —
 * used for manual "draft a follow-up now" actions.
 */
export function buildFollowUpItem(
  application: ApplicationDocument,
  logs: FollowUpLog[],
  settings: FollowUpSettings,
  now: number = Date.now(),
): FollowUpItem {
  const appLogs = logs.filter((log) => log.applicationId === application.id);
  const thresholdDays = thresholdFor(application.status, settings) ?? 0;
  const lastActivityAt = Math.max(
    toEpochMs(application.updatedAt),
    toEpochMs(application.createdAt),
    ...appLogs.map((log) => toEpochMs(log.createdAt)),
  );
  const daysQuiet = lastActivityAt > 0 ? Math.max(0, Math.floor((now - lastActivityAt) / DAY_MS)) : 0;
  return {
    application,
    daysQuiet,
    thresholdDays,
    followUpNumber: appLogs.length + 1,
    sentCount: appLogs.length,
    lastActivityAt,
    daysUntilDue: Math.max(0, thresholdDays - daysQuiet),
    snoozedUntil: undefined,
  };
}

/**
 * Items that should get an automatic reminder: due, and not already carrying ANY open follow-up
 * reminder (so repeated scans are idempotent and never create duplicates).
 */
export function itemsNeedingReminder(
  evaluation: FollowUpEvaluation,
  reminders: ReminderDocument[],
): FollowUpItem[] {
  const withOpenReminder = new Set(
    reminders.filter((r) => r.type === "follow-up" && !r.isCompleted).map((r) => r.applicationId),
  );
  return evaluation.due.filter((item) => !withOpenReminder.has(item.application.id));
}

export function buildReminderMessage(item: FollowUpItem): string {
  const days = item.daysQuiet === 1 ? "1 day" : `${item.daysQuiet} days`;
  const text = `Follow up with ${item.application.company} (${item.application.jobTitle}) — quiet for ${days}`;
  return text.slice(0, 500);
}

/** "YYYY-MM-DDTHH:mm" in the user's local time — the format the reminder form/calendar uses. */
export function toLocalReminderString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Snooze target: `days` from now at 09:00 local time. */
export function snoozeDate(now: number, days: number): string {
  const target = new Date(now + days * DAY_MS);
  target.setHours(9, 0, 0, 0);
  return toLocalReminderString(target);
}

// ---------------------------------------------------------------------------
// Offline email template (used when the AI backend is unavailable)
// ---------------------------------------------------------------------------

export interface FollowUpEmailContext {
  company: string;
  jobTitle: string;
  status: ApplicationStatus;
  followUpNumber: number;
  tone: FollowUpTone;
  applicantName?: string | undefined;
  recruiterName?: string | undefined;
}

export function buildLocalFollowUpEmail(ctx: FollowUpEmailContext): { subject: string; body: string } {
  const company = ctx.company.trim() || "your company";
  const role = ctx.jobTitle.trim() || "the role";
  const recruiter = ctx.recruiterName?.trim();
  const sender = ctx.applicantName?.trim() || "[Your name]";
  const stage = Math.max(1, Math.round(ctx.followUpNumber));

  const greeting =
    ctx.tone === "friendly"
      ? `Hi ${recruiter || "there"},`
      : ctx.tone === "direct"
        ? `Hello ${recruiter || "Hiring Team"},`
        : `Dear ${recruiter || "Hiring Team"},`;
  const opener =
    ctx.tone === "friendly"
      ? "Hope your week is going well!"
      : ctx.tone === "direct"
        ? ""
        : "I hope you are doing well.";

  const context =
    ctx.status === "Interview"
      ? `Thank you again for the opportunity to interview for the ${role} position at ${company}.`
      : ctx.status === "Under Review"
        ? `I am writing to check in on my application for the ${role} position at ${company}.`
        : `I recently applied for the ${role} position at ${company} and wanted to follow up.`;

  let ask: string;
  let subject: string;
  if (stage === 1) {
    subject = `Following up on my ${role} application`;
    ask =
      "I remain very interested in the role. Could you share an update on the status of my application or the expected timeline for next steps?";
  } else if (stage === 2) {
    subject = `Checking in again — ${role} at ${company}`;
    ask =
      "I wanted to reiterate my interest in the role and my enthusiasm for contributing to the team. I would be glad to provide any additional information that would help, and would appreciate any update on the timeline.";
  } else {
    subject = `Closing the loop — ${role} application`;
    ask =
      "I understand that priorities can change, so this will be my last note for now. If the position is still open I would welcome the chance to talk; otherwise I appreciate your time and hope our paths cross again.";
  }

  const body = [greeting, opener, context, ask, `Thank you for your time.\n\nBest regards,\n${sender}`]
    .filter((part) => part.length > 0)
    .join("\n\n");
  return { subject, body };
}
