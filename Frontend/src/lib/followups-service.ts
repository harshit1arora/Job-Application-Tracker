/**
 * followups-service.ts — Smart follow-up automation.
 *
 * Responsibilities
 *  - settings (per user) and a log of follow-ups that were actually sent
 *  - evaluate which applications have gone quiet (pure rules live in followup-logic.ts)
 *  - auto-create follow-up reminders for quiet applications (idempotent)
 *  - snooze / mark-as-sent actions
 *  - AI-drafted follow-up emails with an offline template fallback
 *
 * Persistence is API-first (FastAPI) with a localStorage fallback in demo/offline mode, like the
 * rest of the data layer. Reminders reuse the existing reminders API so they appear on the
 * Tracker calendar automatically.
 */
import { apiRequest, isDemoMode, shouldUseLocalPersistence } from "./api-client";
import { aiRequest } from "./ai";
import { getSafeStorage } from "./storage";
import { getApplications } from "./applications-service";
import {
  createReminder,
  getReminders,
  markReminderComplete,
  updateReminder,
} from "./reminders-service";
import {
  DEFAULT_FOLLOWUP_SETTINGS,
  buildLocalFollowUpEmail,
  buildReminderMessage,
  evaluateFollowUps,
  itemsNeedingReminder,
  snoozeDate,
  toLocalReminderString,
  toEpochMs,
} from "./followup-logic";
import { createFollowUpLogSchema, followUpSettingsSchema } from "./validation";
import { AppError } from "./types";
import type {
  ApplicationStatus,
  CreateFollowUpLogInput,
  FollowUpChannel,
  FollowUpEvaluation,
  FollowUpItem,
  FollowUpLog,
  FollowUpSettings,
  FollowUpTone,
  ReminderDocument,
} from "./types";

export const FOLLOWUPS_CHANGED_EVENT = "jobpilot:followups-changed";

function emitChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FOLLOWUPS_CHANGED_EVENT));
  window.dispatchEvent(new Event("jobpilot:data-changed"));
}

// ---------------------------------------------------------------------------
// Local persistence helpers
// ---------------------------------------------------------------------------

const settingsKey = (userId: string) => `jobpilot_followup_settings_${userId}`;
const logsKey = (userId: string) => `jobpilot_followup_logs_${userId}`;

function readJson<T>(key: string, fallback: T): T {
  const storage = getSafeStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    throw new AppError("SERVER_ERROR", "Could not save follow-up data in this browser.");
  }
}

async function withLocalFallback<T>(remote: () => Promise<T>, local: () => T): Promise<T> {
  if (isDemoMode) return local();
  try {
    return await remote();
  } catch (error) {
    if (error instanceof AppError && (error.type === "VALIDATION_ERROR" || error.type === "NOT_FOUND")) {
      throw error;
    }
    if (shouldUseLocalPersistence()) return local();
    throw error;
  }
}

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field !== undefined && fields[String(field)] === undefined) fields[String(field)] = issue.message;
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function sanitizeSettings(raw: Partial<FollowUpSettings> | null | undefined): FollowUpSettings {
  const parsed = followUpSettingsSchema.safeParse({ ...DEFAULT_FOLLOWUP_SETTINGS, ...(raw ?? {}) });
  return parsed.success ? (parsed.data as FollowUpSettings) : { ...DEFAULT_FOLLOWUP_SETTINGS };
}

export async function getFollowUpSettings(userId: string): Promise<FollowUpSettings> {
  return withLocalFallback(
    async () => sanitizeSettings(await apiRequest<FollowUpSettings>("/followups/settings", userId)),
    () => sanitizeSettings(readJson<Partial<FollowUpSettings> | null>(settingsKey(userId), null)),
  );
}

export async function saveFollowUpSettings(
  userId: string,
  settings: FollowUpSettings,
): Promise<FollowUpSettings> {
  const parsed = followUpSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid follow-up settings", fieldErrors(parsed.error.errors));
  }
  const data = parsed.data as FollowUpSettings;
  const saved = await withLocalFallback(
    async () =>
      sanitizeSettings(
        await apiRequest<FollowUpSettings>("/followups/settings", userId, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      ),
    () => {
      writeJson(settingsKey(userId), data);
      return data;
    },
  );
  emitChanged();
  return saved;
}

// ---------------------------------------------------------------------------
// Follow-up log (what you actually sent)
// ---------------------------------------------------------------------------

export async function getFollowUpLogs(userId: string, applicationId?: string): Promise<FollowUpLog[]> {
  const logs = await withLocalFallback(
    async () => {
      const qs = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : "";
      const remote = await apiRequest<FollowUpLog[]>(`/followups/logs${qs}`, userId);
      if (!Array.isArray(remote)) throw new AppError("SERVER_ERROR", "The server returned an invalid follow-up log.");
      return remote;
    },
    () => {
      const all = readJson<FollowUpLog[]>(logsKey(userId), []);
      return applicationId ? all.filter((l) => l.applicationId === applicationId) : all;
    },
  );
  return [...logs].sort((a, b) => toEpochMs(b.createdAt) - toEpochMs(a.createdAt));
}

export async function createFollowUpLog(
  userId: string,
  input: CreateFollowUpLogInput,
): Promise<FollowUpLog> {
  const parsed = createFollowUpLogSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid follow-up data", fieldErrors(parsed.error.errors));
  }
  const data = parsed.data as CreateFollowUpLogInput;
  return withLocalFallback(
    async () =>
      apiRequest<FollowUpLog>("/followups/logs", userId, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    () => {
      const log: FollowUpLog = {
        ...data,
        id: `fu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId,
        createdAt: new Date().toISOString(),
      };
      writeJson(logsKey(userId), [log, ...readJson<FollowUpLog[]>(logsKey(userId), [])]);
      return log;
    },
  );
}

export async function deleteFollowUpLog(userId: string, logId: string): Promise<void> {
  await withLocalFallback(
    async () => {
      await apiRequest(`/followups/logs/${logId}`, userId, { method: "DELETE" });
    },
    () => {
      const all = readJson<FollowUpLog[]>(logsKey(userId), []);
      if (!all.some((l) => l.id === logId)) throw new AppError("NOT_FOUND", "Follow-up log not found");
      writeJson(logsKey(userId), all.filter((l) => l.id !== logId));
    },
  );
  emitChanged();
}

// ---------------------------------------------------------------------------
// Evaluation (which applications need a nudge?)
// ---------------------------------------------------------------------------

export interface FollowUpSnapshot {
  settings: FollowUpSettings;
  applications: Awaited<ReturnType<typeof getApplications>>;
  logs: FollowUpLog[];
  reminders: ReminderDocument[];
  evaluation: FollowUpEvaluation;
}

export async function getFollowUpSnapshot(userId: string, now: number = Date.now()): Promise<FollowUpSnapshot> {
  const [settings, applications, reminders, logs] = await Promise.all([
    getFollowUpSettings(userId),
    getApplications(userId),
    getReminders(userId),
    getFollowUpLogs(userId),
  ]);
  return {
    settings,
    applications,
    logs,
    reminders,
    evaluation: evaluateFollowUps({ applications, reminders, logs, settings, now }),
  };
}

export async function getDueFollowUpCount(userId: string): Promise<number> {
  try {
    const { evaluation } = await getFollowUpSnapshot(userId);
    return evaluation.due.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Auto-create reminders
// ---------------------------------------------------------------------------

export interface ScanResult {
  created: ReminderDocument[];
  skipped: "disabled" | "auto-off" | null;
  evaluation: FollowUpEvaluation;
}

const inFlightScans = new Map<string, Promise<ScanResult>>();
const lastAutoScanAt = new Map<string, number>();
const AUTO_SCAN_MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Create a follow-up reminder (due now) for every quiet application that doesn't already have an
 * open follow-up reminder. Safe to call repeatedly: it is idempotent and concurrent calls share
 * one in-flight scan, so double-mounts never create duplicates.
 *
 * `force` ignores the "auto-create reminders" setting (used by the manual "Scan now" button).
 */
export function scanAndCreateReminders(
  userId: string,
  options: { force?: boolean; now?: number; snapshot?: FollowUpSnapshot } = {},
): Promise<ScanResult> {
  const existing = inFlightScans.get(userId);
  if (existing) return existing;

  const run = (async (): Promise<ScanResult> => {
    const scanTime = options.now ?? Date.now();
    const snapshot = options.snapshot ?? (await getFollowUpSnapshot(userId, scanTime));
    const { settings, reminders, evaluation } = snapshot;
    if (!settings.enabled) return { created: [], skipped: "disabled", evaluation };
    if (!settings.autoCreateReminders && !options.force) return { created: [], skipped: "auto-off", evaluation };

    const targets = itemsNeedingReminder(evaluation, reminders);
    const reminderDate = toLocalReminderString(new Date(scanTime));
    const created: ReminderDocument[] = [];
    for (const item of targets) {
      try {
        created.push(
          await createReminder(userId, {
            applicationId: item.application.id,
            reminderDate,
            type: "follow-up",
            message: buildReminderMessage(item),
          }),
        );
      } catch {
        // One failing reminder must not stop the others.
      }
    }
    if (created.length > 0) emitChanged();
    return { created, skipped: null, evaluation };
  })().finally(() => {
    inFlightScans.delete(userId);
  });

  inFlightScans.set(userId, run);
  return run;
}

/** Throttled scan used from the app shell so navigation doesn't trigger a scan every time. */
export async function maybeAutoScan(userId: string, now: number = Date.now()): Promise<ScanResult | null> {
  const last = lastAutoScanAt.get(userId) ?? 0;
  if (now - last < AUTO_SCAN_MIN_INTERVAL_MS) return null;
  lastAutoScanAt.set(userId, now);
  try {
    return await scanAndCreateReminders(userId);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function openFollowUpReminders(userId: string, applicationId: string): Promise<ReminderDocument[]> {
  const reminders = await getReminders(userId, applicationId);
  return reminders.filter((r) => r.type === "follow-up" && !r.isCompleted);
}

/**
 * Record that a follow-up was sent: writes a log entry (which restarts the application's quiet
 * clock) and completes any open follow-up reminders for it.
 */
export async function markFollowUpSent(
  userId: string,
  item: Pick<FollowUpItem, "application">,
  details: { channel: FollowUpChannel; tone?: string | undefined; subject?: string | undefined; body?: string | undefined; note?: string | undefined },
): Promise<FollowUpLog> {
  const log = await createFollowUpLog(userId, {
    applicationId: item.application.id,
    channel: details.channel,
    tone: details.tone,
    subject: details.subject,
    body: details.body,
    note: details.note,
  });
  try {
    for (const reminder of await openFollowUpReminders(userId, item.application.id)) {
      await markReminderComplete(userId, reminder.id);
    }
  } catch {
    // Completing reminders is best-effort; the log already restarted the clock.
  }
  emitChanged();
  return log;
}

/** Push the nudge out by `days`: reschedule the open reminder, or create one if none exists. */
export async function snoozeFollowUp(
  userId: string,
  item: Pick<FollowUpItem, "application" | "daysQuiet">,
  days: number,
  now: number = Date.now(),
): Promise<ReminderDocument> {
  const when = snoozeDate(now, Math.max(1, Math.round(days)));
  const open = await openFollowUpReminders(userId, item.application.id);
  const first = open[0];
  let reminder: ReminderDocument;
  if (first) {
    reminder = await updateReminder(userId, first.id, { reminderDate: when });
  } else {
    reminder = await createReminder(userId, {
      applicationId: item.application.id,
      reminderDate: when,
      type: "follow-up",
      message: `Follow up with ${item.application.company} (${item.application.jobTitle}) — snoozed`.slice(0, 500),
    });
  }
  emitChanged();
  return reminder;
}

// ---------------------------------------------------------------------------
// AI-drafted follow-up email
// ---------------------------------------------------------------------------

export interface FollowUpDraft {
  subject: string;
  body: string;
  source: "ai" | "template";
}

export interface DraftOptions {
  tone: FollowUpTone;
  channel?: "email" | "linkedin";
  applicantName?: string | undefined;
  recruiterName?: string | undefined;
}

export async function generateFollowUpEmail(
  item: Pick<FollowUpItem, "application" | "daysQuiet" | "followUpNumber">,
  options: DraftOptions,
): Promise<FollowUpDraft> {
  const { application } = item;
  try {
    const data = await aiRequest<{ subject?: string; body?: string }>(
      "/ai/followup-email",
      {
        applicantName: options.applicantName?.trim() ?? "",
        recruiterName: options.recruiterName?.trim() || undefined,
        company: application.company,
        jobTitle: application.jobTitle,
        status: application.status,
        daysQuiet: item.daysQuiet,
        followUpNumber: item.followUpNumber,
        tone: options.tone,
        channel: options.channel ?? "email",
        notes: application.notes?.slice(0, 1500) || undefined,
        jobDescription: application.jobDescription?.slice(0, 1500) || undefined,
      },
      30000,
    );
    if (data?.body && data.body.trim().length > 20) {
      return {
        subject: (data.subject ?? "").trim() || `Following up on my ${application.jobTitle} application`,
        body: data.body.trim(),
        source: "ai",
      };
    }
  } catch {
    // Offline template below.
  }
  const local = buildLocalFollowUpEmail({
    company: application.company,
    jobTitle: application.jobTitle,
    status: application.status as ApplicationStatus,
    followUpNumber: item.followUpNumber,
    tone: options.tone,
    applicantName: options.applicantName,
    recruiterName: options.recruiterName,
  });
  return { ...local, source: "template" };
}
