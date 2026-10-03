/**
 * api-client.ts — Unified REST Adapter
 *
 * Connects the Frontend to the FastAPI backend.
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

const isServer = typeof window === "undefined";
const API_BASE = (import.meta.env?.VITE_API_URL as string | undefined) || (isServer ? "http://localhost:5117/api" : "/api");

// --- Real HTTP Request Helper ---
async function apiRequest<T>(
  path: string,
  userId: string,
  init: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "X-User-Id": userId,
  };
  
  // Only set Content-Type to JSON if it's not a FormData payload
  if (!(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const mergedHeaders = { ...headers, ...((init.headers as Record<string, string>) || {}) };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: mergedHeaders,
    });

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

      if (res.status === 400 || res.status === 422) throw new AppError("VALIDATION_ERROR", errorMessage);
      if (res.status === 401 || res.status === 403) throw new AppError("AUTH_ERROR", errorMessage);
      if (res.status === 404) {
        // Special case: Some endpoints expect null on 404 (handled by caller)
        throw new AppError("NOT_FOUND", errorMessage);
      }
      throw new AppError("SERVER_ERROR", errorMessage);
    }

    return await res.json();
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError("SERVER_ERROR", err.message || "Network request failed");
  }
}

// ===========================================================================
// Applications API
// ===========================================================================

export async function fetchApplications(
  userId: string,
  filters?: ApplicationFilters
): Promise<ApplicationDocument[]> {
  const queryParams = new URLSearchParams();
  if (filters?.status && (filters.status as string) !== "All") queryParams.set("status", filters.status);
  if (filters?.applicationSource && (filters.applicationSource as string) !== "All") {
    queryParams.set("applicationSource", filters.applicationSource);
  }
  if (filters?.search) queryParams.set("search", filters.search);

  const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return await apiRequest<ApplicationDocument[]>(`/applications${qs}`, userId);
}

export async function fetchApplication(
  userId: string,
  applicationId: string
): Promise<ApplicationDocument | null> {
  try {
    return await apiRequest<ApplicationDocument>(`/applications/${applicationId}`, userId);
  } catch (err: any) {
    if (err instanceof AppError && err.type === "NOT_FOUND") return null;
    throw err;
  }
}

export async function createApplicationApi(
  userId: string,
  input: CreateApplicationInput
): Promise<ApplicationDocument> {
  if (input.applicationUrl === "") delete input.applicationUrl;
  return await apiRequest<ApplicationDocument>("/applications", userId, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateApplicationApi(
  userId: string,
  applicationId: string,
  changes: UpdateApplicationInput
): Promise<ApplicationDocument> {
  if (changes.applicationUrl === "") delete changes.applicationUrl;
  return await apiRequest<ApplicationDocument>(`/applications/${applicationId}`, userId, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export async function deleteApplicationApi(
  userId: string,
  applicationId: string
): Promise<void> {
  await apiRequest(`/applications/${applicationId}`, userId, {
    method: "DELETE",
  });
}

// ===========================================================================
// Documents API
// ===========================================================================

export async function fetchDocuments(
  userId: string,
  applicationId?: string
): Promise<DocumentMetadata[]> {
  const qs = applicationId ? `?applicationId=${applicationId}` : "";
  return await apiRequest<DocumentMetadata[]>(`/documents${qs}`, userId);
}

// The UI uploads files using documents-service.ts which normally called this. 
// We will update documents-service.ts to call apiRequest directly with FormData to support actual uploads.
// But we still leave this for backward compatibility if it's used elsewhere, though it's deprecated.
export async function createDocumentApi(
  userId: string,
  input: any
): Promise<DocumentMetadata> {
  throw new Error("Use documents-service.ts uploadDocument directly to upload files.");
}

export async function deleteDocumentApi(userId: string, documentId: string): Promise<void> {
  await apiRequest(`/documents/${documentId}`, userId, {
    method: "DELETE",
  });
}

// Added this to export the raw request method to documents-service for file uploads
export { apiRequest };

// ===========================================================================
// Reminders API
// ===========================================================================

export async function fetchReminders(
  userId: string,
  applicationId?: string,
  isCompleted?: boolean
): Promise<ReminderDocument[]> {
  const q = new URLSearchParams();
  if (applicationId) q.set("applicationId", applicationId);
  if (isCompleted !== undefined) q.set("isCompleted", String(isCompleted));
  const qs = q.toString() ? `?${q.toString()}` : "";

  return await apiRequest<ReminderDocument[]>(`/reminders${qs}`, userId);
}

export async function createReminderApi(
  userId: string,
  input: CreateReminderInput
): Promise<ReminderDocument> {
  return await apiRequest<ReminderDocument>("/reminders", userId, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateReminderApi(
  userId: string,
  reminderId: string,
  changes: Partial<Pick<CreateReminderInput, "reminderDate" | "type" | "message">> & { isCompleted?: boolean }
): Promise<ReminderDocument> {
  return await apiRequest<ReminderDocument>(`/reminders/${reminderId}`, userId, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export async function deleteReminderApi(userId: string, reminderId: string): Promise<void> {
  await apiRequest(`/reminders/${reminderId}`, userId, {
    method: "DELETE",
  });
}

// ===========================================================================
// Dashboard Stats API
// ===========================================================================

export async function fetchDashboardStatsApi(userId: string): Promise<DashboardStats> {
  return await apiRequest<DashboardStats>("/dashboard/stats", userId);
}
