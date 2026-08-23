/**
 * api-client.ts — Unified REST & Data Adapter
 *
 * Connects the Frontend to:
 * 1. ASP.NET Core REST API (http://localhost:5117/api or Vite proxy /api)
 * 2. Automatic Local Storage / Demo fallback (zero config required)
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

const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) || "/api";
const LOCAL_APPS_KEY = "jobpilot_local_applications";
const LOCAL_DOCS_KEY = "jobpilot_local_documents";
const LOCAL_REMS_KEY = "jobpilot_local_reminders";

// Initial seed data for out-of-the-box experience
const INITIAL_SEED_APPLICATIONS: ApplicationDocument[] = [
  {
    id: "app-seed-01",
    userId: "demo-user",
    company: "Stripe",
    jobTitle: "Senior Full Stack Engineer",
    applicationSource: "LinkedIn",
    status: "Interview",
    applicationUrl: "https://stripe.com/jobs/search",
    jobDescription: "Design and build high-throughput payment infrastructure and developer APIs using React, TypeScript, C#, and distributed systems.",
    salaryRange: "$175,000 - $210,000",
    location: "San Francisco, CA (Hybrid)",
    notes: "Technical screening scheduled for next Tuesday. Review distributed systems & API idempotency.",
    followUpDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    matchScore: 94,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "app-seed-02",
    userId: "demo-user",
    company: "OpenAI",
    jobTitle: "Frontend Platform Engineer",
    applicationSource: "Other",
    status: "Under Review",
    applicationUrl: "https://openai.com/careers/search",
    jobDescription: "Create next-generation intuitive interfaces for foundation model evaluation, canvas interactions, and developer playgrounds.",
    salaryRange: "$190,000 - $240,000",
    location: "San Francisco, CA",
    notes: "Referred by campus alumni. Applied with custom AI project portfolio.",
    followUpDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    matchScore: 91,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "app-seed-03",
    userId: "demo-user",
    company: "Vercel",
    jobTitle: "Software Engineer, Core DX",
    applicationSource: "Other",
    status: "Applied",
    applicationUrl: "https://vercel.com/careers",
    jobDescription: "Work on next-generation web bundling, edge runtime rendering, and developer experience for millions of frontend developers.",
    salaryRange: "$160,000 - $195,000",
    location: "Remote (US/Global)",
    notes: "Submitted tailored résumé highlighting performance optimization and compiler toolchains.",
    followUpDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    matchScore: 88,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "app-seed-04",
    userId: "demo-user",
    company: "Datadog",
    jobTitle: "Backend Systems Engineer",
    applicationSource: "LinkedIn",
    status: "Saved",
    applicationUrl: "https://www.datadoghq.com/careers/detail/?gh_jid=6452109",
    jobDescription: "Build scalable real-time telemetry processing pipelines handling petabytes of metrics per second.",
    salaryRange: "$165,000 - $200,000",
    location: "New York, NY (Hybrid)",
    notes: "Tailor résumé to emphasize observability and high-concurrency architectures.",
    followUpDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    matchScore: 82,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

// In-memory persistent cache for both Node.js and Browser runtimes
const memoryCache = new Map<string, any[]>();

// --- Local Fallback Helpers ---
function getLocalStore<T>(key: string, defaultVal: T[]): T[] {
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T[];
  }
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T[];
        memoryCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {
    // fallback to defaultVal
  }
  const copy = JSON.parse(JSON.stringify(defaultVal)) as T[];
  memoryCache.set(key, copy);
  return copy;
}

function setLocalStore<T>(key: string, data: T[]): void {
  memoryCache.set(key, data);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

// --- Fetch with Dynamic Context ---
async function apiRequest<T>(
  path: string,
  userId: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; data?: T; status: number; error?: string }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...((init.headers as Record<string, string>) || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
      return {
        ok: false,
        status: res.status,
        error: data?.message || `Request failed with status ${res.status}`,
      };
    }

    const data = await res.json();
    return { ok: true, data, status: res.status };
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message || "Network request failed" };
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
  const res = await apiRequest<ApplicationDocument[]>(`/applications${qs}`, userId);

  if (res.ok && Array.isArray(res.data)) {
    return res.data;
  }

  // Local fallback
  let apps = getLocalStore<ApplicationDocument>(LOCAL_APPS_KEY, INITIAL_SEED_APPLICATIONS);
  apps = apps.filter((a) => a.userId === userId || a.userId === "demo-user");

  if (filters?.status && (filters.status as string) !== "All") {
    apps = apps.filter((a) => a.status === filters.status);
  }
  if (filters?.applicationSource && (filters.applicationSource as string) !== "All") {
    apps = apps.filter((a) => a.applicationSource === filters.applicationSource);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    apps = apps.filter(
      (a) => a.company.toLowerCase().includes(q) || a.jobTitle.toLowerCase().includes(q)
    );
  }

  return apps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchApplication(
  userId: string,
  applicationId: string
): Promise<ApplicationDocument | null> {
  const res = await apiRequest<ApplicationDocument>(`/applications/${applicationId}`, userId);
  if (res.ok && res.data) {
    return res.data;
  }

  // Local fallback
  const apps = getLocalStore<ApplicationDocument>(LOCAL_APPS_KEY, INITIAL_SEED_APPLICATIONS);
  const found = apps.find((a) => a.id === applicationId);
  return found || null;
}

export async function createApplicationApi(
  userId: string,
  input: CreateApplicationInput
): Promise<ApplicationDocument> {
  const res = await apiRequest<ApplicationDocument>("/applications", userId, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (res.ok && res.data) {
    return res.data;
  }

  // Local fallback
  const now = new Date().toISOString();
  const newApp: ApplicationDocument = {
    id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId,
    company: input.company,
    jobTitle: input.jobTitle,
    applicationSource: input.applicationSource,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    ...(input.applicationUrl ? { applicationUrl: input.applicationUrl } : {}),
    ...(input.jobDescription ? { jobDescription: input.jobDescription } : {}),
    ...(input.salaryRange ? { salaryRange: input.salaryRange } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.followUpDate ? { followUpDate: input.followUpDate } : {}),
  };

  const apps = getLocalStore<ApplicationDocument>(LOCAL_APPS_KEY, INITIAL_SEED_APPLICATIONS);
  apps.unshift(newApp);
  setLocalStore(LOCAL_APPS_KEY, apps);

  return newApp;
}

export async function updateApplicationApi(
  userId: string,
  applicationId: string,
  changes: UpdateApplicationInput
): Promise<ApplicationDocument> {
  const res = await apiRequest<ApplicationDocument>(`/applications/${applicationId}`, userId, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

  if (res.ok && res.data) {
    return res.data;
  }

  // Local fallback
  const apps = getLocalStore<ApplicationDocument>(LOCAL_APPS_KEY, INITIAL_SEED_APPLICATIONS);
  const idx = apps.findIndex((a) => a.id === applicationId);
  if (idx === -1) {
    throw new AppError("NOT_FOUND", "Application not found");
  }

  const existing = apps[idx]!;
  const updated: ApplicationDocument = {
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  apps[idx] = updated;
  setLocalStore(LOCAL_APPS_KEY, apps);
  return updated;
}

export async function deleteApplicationApi(
  userId: string,
  applicationId: string
): Promise<void> {
  const res = await apiRequest(`/applications/${applicationId}`, userId, {
    method: "DELETE",
  });

  if (res.ok) return;

  // Local fallback
  const apps = getLocalStore<ApplicationDocument>(LOCAL_APPS_KEY, INITIAL_SEED_APPLICATIONS);
  const filtered = apps.filter((a) => a.id !== applicationId);
  setLocalStore(LOCAL_APPS_KEY, filtered);
}

// ===========================================================================
// Documents API
// ===========================================================================

export async function fetchDocuments(
  userId: string,
  applicationId?: string
): Promise<DocumentMetadata[]> {
  const qs = applicationId ? `?applicationId=${applicationId}` : "";
  const res = await apiRequest<DocumentMetadata[]>(`/documents${qs}`, userId);

  if (res.ok && Array.isArray(res.data)) {
    return res.data;
  }

  // Local fallback
  let docs = getLocalStore<DocumentMetadata>(LOCAL_DOCS_KEY, []);
  docs = docs.filter((d) => d.userId === userId || d.userId === "demo-user");
  if (applicationId) {
    docs = docs.filter((d) => d.applicationId === applicationId);
  }
  return docs;
}

export async function createDocumentApi(
  userId: string,
  input: {
    fileName: string;
    fileType: string;
    fileSize: number;
    applicationId?: string;
    displayName?: string;
  }
): Promise<DocumentMetadata> {
  const res = await apiRequest<DocumentMetadata>("/documents", userId, {
    method: "POST",
    body: JSON.stringify({
      ...input,
      storageRef: `documents/${userId}/${Date.now()}_${input.fileName}`,
    }),
  });

  if (res.ok && res.data) {
    return res.data;
  }

  // Local fallback
  const newDoc: DocumentMetadata = {
    id: `doc-${Date.now()}`,
    userId,
    fileName: input.fileName,
    fileType: input.fileType,
    fileSize: input.fileSize,
    storageRef: `documents/${userId}/${Date.now()}_${input.fileName}`,
    createdAt: new Date().toISOString(),
    ...(input.applicationId ? { applicationId: input.applicationId } : {}),
    ...(input.displayName ? { displayName: input.displayName } : {}),
  };

  const docs = getLocalStore<DocumentMetadata>(LOCAL_DOCS_KEY, []);
  docs.unshift(newDoc);
  setLocalStore(LOCAL_DOCS_KEY, docs);
  return newDoc;
}

export async function deleteDocumentApi(userId: string, documentId: string): Promise<void> {
  const res = await apiRequest(`/documents/${documentId}`, userId, {
    method: "DELETE",
  });

  if (res.ok) return;

  // Local fallback
  const docs = getLocalStore<DocumentMetadata>(LOCAL_DOCS_KEY, []);
  const filtered = docs.filter((d) => d.id !== documentId);
  setLocalStore(LOCAL_DOCS_KEY, filtered);
}

// ===========================================================================
// Reminders API
// ===========================================================================

const INITIAL_SEED_REMINDERS: ReminderDocument[] = [
  {
    id: "rem-seed-01",
    userId: "demo-user",
    applicationId: "app-seed-01",
    reminderDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    type: "interview",
    message: "Stripe — Technical System Design Screening with Staff Engineer (Zoom link confirmed)",
    isCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "rem-seed-02",
    userId: "demo-user",
    applicationId: "app-seed-02",
    reminderDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
    type: "interview",
    message: "OpenAI — Frontend Architecture & Canvas Interaction Deep Dive",
    isCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "rem-seed-03",
    userId: "demo-user",
    applicationId: "app-seed-03",
    reminderDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    type: "follow-up",
    message: "Vercel — Recruiter check-in on Edge DX application status",
    isCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "rem-seed-04",
    userId: "demo-user",
    applicationId: "app-seed-04",
    reminderDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    type: "deadline",
    message: "Datadog — Complete telemetry distributed tracing coding assessment",
    isCompleted: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "rem-seed-05",
    userId: "demo-user",
    applicationId: "app-seed-01",
    reminderDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    type: "application-update",
    message: "Stripe — Final onsite debrief and decision update expected",
    isCompleted: false,
    createdAt: new Date().toISOString(),
  },
];

export async function fetchReminders(
  userId: string,
  applicationId?: string,
  isCompleted?: boolean
): Promise<ReminderDocument[]> {
  const q = new URLSearchParams();
  if (applicationId) q.set("applicationId", applicationId);
  if (isCompleted !== undefined) q.set("isCompleted", String(isCompleted));
  const qs = q.toString() ? `?${q.toString()}` : "";

  const res = await apiRequest<ReminderDocument[]>(`/reminders${qs}`, userId);
  if (res.ok && Array.isArray(res.data)) {
    return res.data;
  }

  // Local fallback
  let rems = getLocalStore<ReminderDocument>(LOCAL_REMS_KEY, INITIAL_SEED_REMINDERS);
  rems = rems.filter((r) => r.userId === userId || r.userId === "demo-user");
  if (applicationId) rems = rems.filter((r) => r.applicationId === applicationId);
  if (isCompleted !== undefined) rems = rems.filter((r) => r.isCompleted === isCompleted);

  return rems.sort((a, b) => a.reminderDate.localeCompare(b.reminderDate));
}

export async function createReminderApi(
  userId: string,
  input: CreateReminderInput
): Promise<ReminderDocument> {
  const res = await apiRequest<ReminderDocument>("/reminders", userId, {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (res.ok && res.data) {
    return res.data;
  }

  // Local fallback
  const newRem: ReminderDocument = {
    id: `rem-${Date.now()}`,
    userId,
    applicationId: input.applicationId,
    reminderDate: input.reminderDate,
    type: input.type,
    isCompleted: false,
    createdAt: new Date().toISOString(),
    ...(input.message ? { message: input.message } : {}),
  };

  const rems = getLocalStore<ReminderDocument>(LOCAL_REMS_KEY, INITIAL_SEED_REMINDERS);
  rems.unshift(newRem);
  setLocalStore(LOCAL_REMS_KEY, rems);
  return newRem;
}

export async function updateReminderApi(
  userId: string,
  reminderId: string,
  changes: Partial<Pick<CreateReminderInput, "reminderDate" | "type" | "message">> & { isCompleted?: boolean }
): Promise<ReminderDocument> {
  const res = await apiRequest<ReminderDocument>(`/reminders/${reminderId}`, userId, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

  if (res.ok && res.data) {
    return res.data;
  }

  // Local fallback
  const rems = getLocalStore<ReminderDocument>(LOCAL_REMS_KEY, []);
  const idx = rems.findIndex((r) => r.id === reminderId);
  if (idx === -1) {
    throw new AppError("NOT_FOUND", "Reminder not found");
  }

  const existing = rems[idx]!;
  const updated: ReminderDocument = {
    ...existing,
    ...changes,
  };

  rems[idx] = updated;
  setLocalStore(LOCAL_REMS_KEY, rems);
  return updated;
}

export async function deleteReminderApi(userId: string, reminderId: string): Promise<void> {
  const res = await apiRequest(`/reminders/${reminderId}`, userId, {
    method: "DELETE",
  });

  if (res.ok) return;

  const rems = getLocalStore<ReminderDocument>(LOCAL_REMS_KEY, []);
  const filtered = rems.filter((r) => r.id !== reminderId);
  setLocalStore(LOCAL_REMS_KEY, filtered);
}

// ===========================================================================
// Dashboard Stats API
// ===========================================================================

export async function fetchDashboardStatsApi(userId: string): Promise<DashboardStats> {
  const res = await apiRequest<DashboardStats>("/dashboard/stats", userId);
  if (res.ok && res.data) {
    return res.data;
  }

  // Calculate stats from applications list
  const apps = await fetchApplications(userId);
  const today = new Date().toISOString().slice(0, 10);

  const byStatus = {
    saved: apps.filter((a) => a.status === "Saved").length,
    applied: apps.filter((a) => a.status === "Applied").length,
    underReview: apps.filter((a) => a.status === "Under Review").length,
    interview: apps.filter((a) => a.status === "Interview").length,
    offer: apps.filter((a) => a.status === "Offer").length,
    rejected: apps.filter((a) => a.status === "Rejected").length,
  };

  const recentApplications = apps.slice(0, 5);
  const upcomingFollowUps = apps
    .filter((a) => a.followUpDate !== undefined && a.followUpDate >= today)
    .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""))
    .slice(0, 5);

  return {
    totalApplications: apps.length,
    byStatus,
    recentApplications,
    upcomingFollowUps,
  };
}
