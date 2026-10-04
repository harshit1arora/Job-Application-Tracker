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

const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
const envApiUrl = import.meta.env?.VITE_API_URL as string | undefined;
export const isDemoMode = import.meta.env?.VITE_DEMO_MODE === "true";

const API_BASE = isBrowser
  ? (envApiUrl || "/api")
  : (envApiUrl && !envApiUrl.startsWith("/") ? envApiUrl : "http://localhost:5117/api");

const REQUEST_TIMEOUT_MS = 6000;

// --- LocalStorage Demo Persistence Keys ---
function getLocalAppsKey(userId: string) {
  return `jobpilot_applications_${userId}`;
}
function getLocalRemindersKey(userId: string) {
  return `jobpilot_reminders_${userId}`;
}

function getStoredApps(userId: string): ApplicationDocument[] {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem(getLocalAppsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredApps(userId: string, apps: ApplicationDocument[]) {
  if (!isBrowser) return;
  try {
    localStorage.setItem(getLocalAppsKey(userId), JSON.stringify(apps));
  } catch {
    // quota exceeded or private mode
  }
}

function getStoredReminders(userId: string): ReminderDocument[] {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem(getLocalRemindersKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredReminders(userId: string, reminders: ReminderDocument[]) {
  if (!isBrowser) return;
  try {
    localStorage.setItem(getLocalRemindersKey(userId), JSON.stringify(reminders));
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
  const headers: Record<string, string> = {
    "X-User-Id": userId,
  };

  // Try to attach Firebase ID Token for production authentication
  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken(false);
      headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn("[api-client] Failed to get Firebase token:", e);
      }
    }
  }

  // Only set Content-Type to JSON if it's not a FormData payload
  if (!(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const mergedHeaders = { ...headers, ...((init.headers as Record<string, string>) || {}) };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  // Link existing signal if provided
  if (init.signal) {
    init.signal.addEventListener("abort", () => controller.abort(init.signal?.reason));
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: mergedHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 204) {
      return undefined as any;
    }

    if (!res.ok) {
      let errorMessage = `Request failed with status ${res.status}`;
      try {
        const errData = await res.json();
        errorMessage = errData.detail || errData.message || errorMessage;
      } catch {
        const textData = await res.text();
        if (textData) errorMessage = textData;
      }

      if (res.status === 400 || res.status === 422)
        throw new AppError("VALIDATION_ERROR", errorMessage);
      if (res.status === 401 || res.status === 403) throw new AppError("AUTH_ERROR", errorMessage);
      if (res.status === 404) {
        throw new AppError("NOT_FOUND", errorMessage);
      }
      throw new AppError("SERVER_ERROR", errorMessage);
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError" || err?.message?.includes("timed out")) {
      throw new AppError("SERVER_ERROR", `Network request timed out (${timeoutMs}ms)`);
    }
    if (err instanceof AppError) throw err;
    throw new AppError("SERVER_ERROR", err.message || "Network request failed");
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

  // If in demo mode, prioritize or fallback immediately
  if (isDemoMode) {
    const local = getStoredApps(userId);
    if (local.length > 0) return local;
  }

  try {
    const remote = await apiRequest<ApplicationDocument[]>(`/applications${qs}`, userId);
    if (remote && Array.isArray(remote)) {
      if (isDemoMode) {
        setStoredApps(userId, remote);
      }
      return remote;
    }
    return getStoredApps(userId);
  } catch (err) {
    if (isDemoMode || isBrowser) {
      const local = getStoredApps(userId);
      if (local.length > 0) return local;
    }
    throw err;
  }
}

export async function fetchApplication(
  userId: string,
  applicationId: string,
): Promise<ApplicationDocument | null> {
  if (isDemoMode) {
    const local = getStoredApps(userId).find((a) => a.id === applicationId);
    if (local) return local;
  }

  try {
    return await apiRequest<ApplicationDocument>(`/applications/${applicationId}`, userId);
  } catch (err: any) {
    if (err instanceof AppError && err.type === "NOT_FOUND") return null;
    const local = getStoredApps(userId).find((a) => a.id === applicationId);
    if (local) return local;
    throw err;
  }
}

export async function createApplicationApi(
  userId: string,
  input: CreateApplicationInput,
): Promise<ApplicationDocument> {
  if (input.applicationUrl === "") delete input.applicationUrl;

  // Optimistic / Demo object
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
    resumeDocumentId: input.resumeDocumentId,
    createdAt: now,
    updatedAt: now,
  };

  if (isDemoMode) {
    const current = getStoredApps(userId);
    const updated = [demoApp, ...current.filter((a) => a.company !== input.company || a.jobTitle !== input.jobTitle)];
    setStoredApps(userId, updated);

    // Also attempt fire-and-forget sync to backend without blocking
    apiRequest<ApplicationDocument>("/applications", userId, {
      method: "POST",
      body: JSON.stringify(input),
    }).catch(() => {
      // Backend may be offline in pure demo mode; ignore
    });

    return demoApp;
  }

  try {
    const created = await apiRequest<ApplicationDocument>("/applications", userId, {
      method: "POST",
      body: JSON.stringify(input),
    });
    // Sync local store
    const current = getStoredApps(userId);
    setStoredApps(userId, [created, ...current.filter((a) => a.id !== created.id)]);
    return created;
  } catch (err) {
    // If backend is down or timed out, save locally in browser so the user is never stuck
    if (isBrowser) {
      const current = getStoredApps(userId);
      const updated = [demoApp, ...current.filter((a) => a.company !== input.company || a.jobTitle !== input.jobTitle)];
      setStoredApps(userId, updated);
      return demoApp;
    }
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
    const current = getStoredApps(userId);
    setStoredApps(
      userId,
      current.map((a) => (a.id === applicationId ? result : a)),
    );
    return result;
  } catch (err) {
    const current = getStoredApps(userId);
    const existing = current.find((a) => a.id === applicationId);
    if (existing) {
      const updated: ApplicationDocument = {
        ...existing,
        ...changes,
        updatedAt: Date.now(),
      };
      setStoredApps(
        userId,
        current.map((a) => (a.id === applicationId ? updated : a)),
      );
      return updated;
    }
    throw err;
  }
}

export async function deleteApplicationApi(userId: string, applicationId: string): Promise<void> {
  const current = getStoredApps(userId);
  setStoredApps(
    userId,
    current.filter((a) => a.id !== applicationId),
  );

  if (!isDemoMode) {
    try {
      await apiRequest(`/applications/${applicationId}`, userId, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
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
  return await apiRequest<DocumentMetadata[]>(`/documents${qs}`, userId);
}

export async function createDocumentApi(userId: string, input: any): Promise<DocumentMetadata> {
  throw new Error("Use documents-service.ts uploadDocument directly to upload files.");
}

export async function deleteDocumentApi(userId: string, documentId: string): Promise<void> {
  await apiRequest(`/documents/${documentId}`, userId, {
    method: "DELETE",
  });
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
    if (isBrowser) {
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
    if (isBrowser) {
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
    if (isBrowser) {
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
