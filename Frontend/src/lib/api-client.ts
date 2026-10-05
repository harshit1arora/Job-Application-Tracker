/**
 * api-client.ts — Unified REST Adapter with Demo-Mode Resilience & Request Timeouts
 *
 * Connects the Frontend to the FastAPI backend with:
 * 1. AbortSignal timeout (prevents hung promises / infinite spinner)
 * 2. DEMO_MODE local persistence in localStorage (when VITE_DEMO_MODE=true or offline)
 * 3. Graceful degradation: never leaves the caller hanging indefinitely.
 */

import type {
  ApplicationDocument,
  ApplicationFilters,
  CreateApplicationInput,
  UpdateApplicationInput,
  DocumentMetadata,
  ReminderDocument,
  CreateReminderInput,
  DashboardStats,
} from "./types";
import { AppError } from "./types";

import { auth } from "./firebase";
import { getSafeStorage } from "./storage";

const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
const envApiUrl = import.meta.env?.VITE_API_URL as string | undefined;

const isTestEnvironment =
  typeof process !== "undefined" &&
  (process.env?.VITEST === "true" || process.env?.NODE_ENV === "test");

const isDemoModeFlag = import.meta.env?.VITE_DEMO_MODE === "true";
export const isDemoMode = isDemoModeFlag || isTestEnvironment;

const PRODUCTION_API_BASE = "https://job-tracker-api-fo65.onrender.com/api";
const defaultApiBase = isBrowser
  ? import.meta.env.PROD
    ? PRODUCTION_API_BASE
    : "/api"
  : "http://localhost:5117/api";
const configuredApiBase = envApiUrl?.trim();
const API_BASE = (() => {
  if (!configuredApiBase) return defaultApiBase;
  if (import.meta.env.PROD && configuredApiBase.startsWith("/")) return PRODUCTION_API_BASE;
  const base = configuredApiBase.replace(/\/+$/, "");
  return base.endsWith("/api/api") ? base.slice(0, -4) : base;
})();

const REQUEST_TIMEOUT_MS = 30000;

export function handleAuthFailure(hasAuthenticatedFirebaseUser = Boolean(auth?.currentUser)) {
  if (
    typeof window === "undefined" ||
    hasAuthenticatedFirebaseUser ||
    window.location.pathname === "/login" ||
    window.location.pathname === "/signup"
  ) {
    return;
  }

  try {
    localStorage.removeItem("jobpilot_local_user");
    localStorage.removeItem("jobpilot_target_role");
  } catch {
    // ignore storage errors in private browsing or locked-down environments
  }

  window.location.assign("/login");
}

function shouldUseLocalFallback(): boolean {
  if (isDemoMode) return true;
  if (isTestEnvironment) return true;
  if (isBrowser && typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

export function shouldUseLocalPersistence(): boolean {
  return shouldUseLocalFallback();
}

function applyLocalFallback<T>(fallback: () => T, userId: string, label: string): T | undefined {
  if (!shouldUseLocalFallback()) return undefined;
  try {
    return fallback();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[api-client] ${label} fallback failed for user ${userId}:`, error);
    }
    return undefined;
  }
}

// --- LocalStorage Demo Persistence Keys ---
function getLocalAppsKey(userId: string) {
  return `jobpilot_applications_${userId}`;
}
function getLocalRemindersKey(userId: string) {
  return `jobpilot_reminders_${userId}`;
}

function getStoredApps(userId: string): ApplicationDocument[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(getLocalAppsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredApps(userId: string, apps: ApplicationDocument[]) {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(getLocalAppsKey(userId), JSON.stringify(apps));
  } catch (error) {
    if (import.meta.env.DEV) console.error("[api-client] Could not persist applications locally:", error);
    throw new AppError("SERVER_ERROR", "Could not save applications in this browser.");
  }
}

function getStoredReminders(userId: string): ReminderDocument[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(getLocalRemindersKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredReminders(userId: string, reminders: ReminderDocument[]) {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(getLocalRemindersKey(userId), JSON.stringify(reminders));
  } catch {
    // ignore
  }
}

function getLocalDocsKey(userId: string) {
  return `jobpilot_documents_${userId}`;
}

function getStoredDocuments(userId: string): DocumentMetadata[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(getLocalDocsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredDocuments(userId: string, docs: DocumentMetadata[]) {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(getLocalDocsKey(userId), JSON.stringify(docs));
  } catch {
    // ignore
  }
}

// --- Real HTTP Request Helper with Timeout ---
async function apiRequest<T>(
  path: string,
  userId: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (init.signal?.aborted) abortFromCaller();

  let timeoutId: ReturnType<typeof setTimeout>;
  const request = (async (): Promise<T> => {
    const headers: Record<string, string> = { "X-User-Id": userId };

    if (auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken(false);
        headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        if (import.meta.env.DEV) console.warn("[api-client] Failed to get Firebase token:", error);
      }
    }

    if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
    const mergedHeaders = { ...headers, ...((init.headers as Record<string, string>) || {}) };
    const requestInit = {
      ...init,
      headers: mergedHeaders,
      signal: controller.signal,
    };
    let res = await fetch(`${API_BASE}${path}`, requestInit);

    if (res.status === 401 && auth?.currentUser) {
      try {
        const refreshedToken = await auth.currentUser.getIdToken(true);
        mergedHeaders.Authorization = `Bearer ${refreshedToken}`;
        res = await fetch(`${API_BASE}${path}`, requestInit);
      } catch (error) {
        if (import.meta.env.DEV) console.warn("[api-client] Failed to refresh Firebase token:", error);
      }
    }

    if (!res.ok) {
      let errorMessage = `Request failed with status ${res.status}`;
      try {
        const errData = await res.json();
        errorMessage = errData.detail || errData.message || errorMessage;
      } catch {
        // Keep the status-based message when the server response is not JSON.
      }

      if (res.status === 401) {
        handleAuthFailure();
        throw new AppError("AUTH_ERROR", errorMessage);
      }
      if (res.status === 403) throw new AppError("AUTH_ERROR", errorMessage);
      if (res.status === 400 || res.status === 422)
        throw new AppError("VALIDATION_ERROR", errorMessage);
      if (res.status === 404) throw new AppError("NOT_FOUND", errorMessage);
      throw new AppError("SERVER_ERROR", errorMessage);
    }

    if (res.status === 204) return undefined as T;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new AppError(
        "SERVER_ERROR",
        "The API returned a non-JSON response. Check the production API URL and Vercel rewrites.",
      );
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new AppError("SERVER_ERROR", "The server returned an invalid response.");
    }
  })();

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new AppError("SERVER_ERROR", `Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, timeout]);
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AppError("SERVER_ERROR", "The network request was cancelled.");
    }
    if (import.meta.env.DEV) console.error("[api-client] Request failed:", err);
    throw new AppError("SERVER_ERROR", "Network request failed.");
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function apiDownloadRequest(
  path: string,
  userId: string,
  init: RequestInit = {},
): Promise<Blob> {
  const headers: Record<string, string> = {
    "X-User-Id": userId,
  };

  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken(false);
      headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      console.warn("Failed to get Firebase token");
    }
  }

  const mergedHeaders = { ...headers, ...((init.headers as Record<string, string>) || {}) };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: mergedHeaders,
    });

    if (!res.ok) {
      throw new AppError("SERVER_ERROR", `Failed to download file: ${res.statusText}`);
    }

    return await res.blob();
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError("SERVER_ERROR", err.message || "Download failed");
  }
}

// ===========================================================================
// Applications API (with Demo Fallback & Local Storage Sync)
// ===========================================================================

export async function fetchApplications(
  userId: string,
  filters?: ApplicationFilters,
): Promise<ApplicationDocument[]> {
  const queryParams = new URLSearchParams();
  if (filters?.status && (filters.status as string) !== "All")
    queryParams.set("status", filters.status);
  if (filters?.applicationSource && (filters.applicationSource as string) !== "All") {
    queryParams.set("applicationSource", filters.applicationSource);
  }
  if (filters?.search) queryParams.set("search", filters.search);

  const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";

  if (isDemoMode) {
    return getStoredApps(userId);
  }

  try {
    const remote = await apiRequest<ApplicationDocument[]>(`/applications${qs}`, userId);
    if (Array.isArray(remote)) return remote;
    throw new AppError("SERVER_ERROR", "The server returned an invalid application list.");
  } catch (err) {
    const localFallback = applyLocalFallback(() => getStoredApps(userId), userId, "fetchApplications");
    if (localFallback !== undefined) return localFallback;
    throw err;
  }
}

export async function fetchApplication(
  userId: string,
  applicationId: string,
): Promise<ApplicationDocument | null> {
  if (isDemoMode) {
    return getStoredApps(userId).find((a) => a.id === applicationId) ?? null;
  }

  try {
    return await apiRequest<ApplicationDocument>(`/applications/${applicationId}`, userId);
  } catch (err: any) {
    if (err instanceof AppError && err.type === "NOT_FOUND") return null;
    const localFallback = applyLocalFallback(
      () => getStoredApps(userId).find((a) => a.id === applicationId) ?? null,
      userId,
      "fetchApplication",
    );
    if (localFallback !== undefined) return localFallback;
    throw err;
  }
}

export async function createApplicationApi(
  userId: string,
  input: CreateApplicationInput,
): Promise<ApplicationDocument> {
  if (input.applicationUrl === "") delete input.applicationUrl;

  const now = Date.now();
  const demoApp: ApplicationDocument = {
    id: `app_${now}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    company: input.company,
    jobTitle: input.jobTitle,
    applicationSource: input.applicationSource,
    status: input.status,
    applicationUrl: input.applicationUrl,
    appliedDate: input.appliedDate || new Date().toISOString(),
    location: input.location,
    salaryRange: input.salaryRange,
    jobDescription: input.jobDescription,
    notes: input.notes,
    matchScore: input.matchScore,
    resumeDocumentId: input.resumeDocumentId,
    createdAt: now,
    updatedAt: now,
  };

  if (isDemoMode) {
    const current = getStoredApps(userId);
    const duplicate = current.find(
      (app) =>
        app.company.trim().toLowerCase() === input.company.trim().toLowerCase() &&
        app.jobTitle.trim().toLowerCase() === input.jobTitle.trim().toLowerCase(),
    );
    if (duplicate) {
      if (duplicate.status === "Saved" && input.status === "Applied") {
        const promoted = { ...duplicate, status: "Applied" as const, updatedAt: now };
        setStoredApps(
          userId,
          current.map((application) => (application.id === duplicate.id ? promoted : application)),
        );
        return promoted;
      }
      return duplicate;
    }
    const updated = [demoApp, ...current];
    setStoredApps(userId, updated);
    return demoApp;
  }

  try {
    const created = await apiRequest<ApplicationDocument>("/applications", userId, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!created || typeof created.id !== "string") {
      throw new AppError("SERVER_ERROR", "The server returned an invalid application record.");
    }
    return created;
  } catch (err) {
    const localFallback = applyLocalFallback(() => {
      const current = getStoredApps(userId);
      const duplicate = current.find(
        (app) =>
          app.company.trim().toLowerCase() === input.company.trim().toLowerCase() &&
          app.jobTitle.trim().toLowerCase() === input.jobTitle.trim().toLowerCase(),
      );
      if (duplicate) return duplicate;
      const updated = [demoApp, ...current];
      setStoredApps(userId, updated);
      return demoApp;
    }, userId, "createApplicationApi");

    if (localFallback !== undefined) return localFallback;
    if (import.meta.env.DEV) console.error("[api-client] Production application save failed:", err);
    throw err;
  }
}

export async function updateApplicationApi(
  userId: string,
  applicationId: string,
  changes: UpdateApplicationInput,
): Promise<ApplicationDocument> {
  if (changes.applicationUrl === "") delete changes.applicationUrl;

  if (isDemoMode) {
    const current = getStoredApps(userId);
    const existing = current.find((a) => a.id === applicationId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Application not found");
    }
    const updated: ApplicationDocument = {
      ...(existing || ({} as any)),
      ...changes,
      id: applicationId,
      userId,
      updatedAt: Date.now(),
    };
    setStoredApps(
      userId,
      current.map((a) => (a.id === applicationId ? updated : a)),
    );
    return updated;
  }

  try {
    const result = await apiRequest<ApplicationDocument>(`/applications/${applicationId}`, userId, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    return result;
  } catch (err) {
    const localFallback = applyLocalFallback(() => {
      const current = getStoredApps(userId);
      const existing = current.find((a) => a.id === applicationId);
      if (!existing) {
        throw new AppError("NOT_FOUND", "Application not found");
      }
      const updated: ApplicationDocument = {
        ...(existing || ({} as any)),
        ...changes,
        id: applicationId,
        userId,
        updatedAt: Date.now(),
      };
      setStoredApps(
        userId,
        current.map((a) => (a.id === applicationId ? updated : a)),
      );
      return updated;
    }, userId, "updateApplicationApi");

    if (localFallback !== undefined) return localFallback;
    throw err;
  }
}

export async function deleteApplicationApi(userId: string, applicationId: string): Promise<void> {
  if (isDemoMode) {
    const current = getStoredApps(userId);
    const exists = current.some((application) => application.id === applicationId);
    if (!exists) {
      throw new AppError("NOT_FOUND", "Application not found");
    }
    setStoredApps(userId, current.filter((application) => application.id !== applicationId));
    return;
  }

  try {
    await apiRequest(`/applications/${applicationId}`, userId, { method: "DELETE" });
  } catch (err) {
    const localFallback = applyLocalFallback(() => {
      const current = getStoredApps(userId);
      const exists = current.some((application) => application.id === applicationId);
      if (!exists) {
        throw new AppError("NOT_FOUND", "Application not found");
      }
      setStoredApps(userId, current.filter((application) => application.id !== applicationId));
      return undefined;
    }, userId, "deleteApplicationApi");

    if (localFallback !== undefined) return;
    throw err;
  }
}

// ===========================================================================
// Documents API
// ===========================================================================

export async function fetchDocuments(
  userId: string,
  applicationId?: string,
): Promise<DocumentMetadata[]> {
  const qs = applicationId ? `?applicationId=${applicationId}` : "";

  if (isDemoMode) {
    const local = getStoredDocuments(userId);
    return applicationId ? local.filter((doc) => doc.applicationId === applicationId) : local;
  }

  try {
    return await apiRequest<DocumentMetadata[]>(`/documents${qs}`, userId);
  } catch (err) {
    const local = getStoredDocuments(userId);
    if (applicationId) return local.filter((doc) => doc.applicationId === applicationId);
    return local;
  }
}

export async function createDocumentApi(userId: string, input: any): Promise<DocumentMetadata> {
  throw new Error("Use documents-service.ts uploadDocument directly to upload files.");
}

export async function deleteDocumentApi(userId: string, documentId: string): Promise<void> {
  try {
    await apiRequest(`/documents/${documentId}`, userId, {
      method: "DELETE",
    });
  } catch (err) {
    if (!shouldUseLocalFallback()) throw err;
    const local = getStoredDocuments(userId).filter((doc) => doc.id !== documentId);
    setStoredDocuments(userId, local);
    return;
  }
}

export { apiRequest };

// ===========================================================================
// Reminders API
// ===========================================================================

export async function fetchReminders(
  userId: string,
  applicationId?: string,
  isCompleted?: boolean,
): Promise<ReminderDocument[]> {
  const q = new URLSearchParams();
  if (applicationId) q.set("applicationId", applicationId);
  if (isCompleted !== undefined) q.set("isCompleted", String(isCompleted));
  const qs = q.toString() ? `?${q.toString()}` : "";

  if (isDemoMode) {
    let list = getStoredReminders(userId);
    if (applicationId) list = list.filter((r) => r.applicationId === applicationId);
    if (isCompleted !== undefined) list = list.filter((r) => r.isCompleted === isCompleted);
    return list;
  }

  try {
    return await apiRequest<ReminderDocument[]>(`/reminders${qs}`, userId);
  } catch (err) {
    const storage = getSafeStorage();
    if (storage) {
      let list = getStoredReminders(userId);
      if (applicationId) list = list.filter((r) => r.applicationId === applicationId);
      if (isCompleted !== undefined) list = list.filter((r) => r.isCompleted === isCompleted);
      return list;
    }
    throw err;
  }
}

export async function createReminderApi(
  userId: string,
  input: CreateReminderInput,
): Promise<ReminderDocument> {
  const now = Date.now();
  const demoReminder: ReminderDocument = {
    id: `rem_${now}_${Math.random().toString(36).substring(2, 6)}`,
    userId,
    applicationId: input.applicationId,
    type: input.type,
    message: input.message,
    reminderDate: input.reminderDate,
    isCompleted: false,
    createdAt: now,
  };

  if (isDemoMode) {
    const list = getStoredReminders(userId);
    setStoredReminders(userId, [demoReminder, ...list]);
    return demoReminder;
  }

  try {
    return await apiRequest<ReminderDocument>("/reminders", userId, {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (err) {
    const storage = getSafeStorage();
    if (storage) {
      const list = getStoredReminders(userId);
      setStoredReminders(userId, [demoReminder, ...list]);
      return demoReminder;
    }
    throw err;
  }
}

export async function updateReminderApi(
  userId: string,
  reminderId: string,
  changes: Partial<Pick<CreateReminderInput, "reminderDate" | "type" | "message">> & {
    isCompleted?: boolean;
  },
): Promise<ReminderDocument> {
  if (isDemoMode) {
    const list = getStoredReminders(userId);
    const existing = list.find((r) => r.id === reminderId);
    if (!existing) {
      throw new AppError("NOT_FOUND", "Reminder not found");
    }
    const updated = { ...(existing || ({} as any)), ...changes, id: reminderId };
    setStoredReminders(
      userId,
      list.map((r) => (r.id === reminderId ? updated : r)),
    );
    return updated;
  }

  return await apiRequest<ReminderDocument>(`/reminders/${reminderId}`, userId, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export async function deleteReminderApi(userId: string, reminderId: string): Promise<void> {
  const list = getStoredReminders(userId);
  if (!list.some((r) => r.id === reminderId)) {
    throw new AppError("NOT_FOUND", "Reminder not found");
  }
  setStoredReminders(
    userId,
    list.filter((r) => r.id !== reminderId),
  );

  if (!isDemoMode) {
    try {
      await apiRequest(`/reminders/${reminderId}`, userId, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
  }
}

// ===========================================================================
// Dashboard Stats API
// ===========================================================================

export async function fetchDashboardStatsApi(userId: string): Promise<DashboardStats> {
  if (isDemoMode) {
    const apps = getStoredApps(userId);
    const byStatus = { applied: 0, screening: 0, interviewing: 0, offered: 0, rejected: 0 };
    apps.forEach((a) => {
      const key = a.status.toLowerCase() as keyof typeof byStatus;
      if (byStatus[key] !== undefined) byStatus[key]++;
    });
    return {
      totalApplications: apps.length,
      byStatus,
      recentApplications: apps.slice(0, 5),
    };
  }

  try {
    return await apiRequest<DashboardStats>("/dashboard/stats", userId);
  } catch (err) {
    if (typeof localStorage !== "undefined") {
      const apps = getStoredApps(userId);
      const byStatus = { applied: 0, screening: 0, interviewing: 0, offered: 0, rejected: 0 };
      apps.forEach((a) => {
        const key = a.status.toLowerCase() as keyof typeof byStatus;
        if (byStatus[key] !== undefined) byStatus[key]++;
      });
      return {
        totalApplications: apps.length,
        byStatus,
        recentApplications: apps.slice(0, 5),
      };
    }
    throw err;
  }
}
