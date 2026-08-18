/**
 * types.ts — Core data contracts for the AI Job Application Tracker backend.
 *
 * For viva:
 * These TypeScript interfaces define the shape of every piece of data that moves
 * between the frontend UI, Firestore service functions, and future integrations
 * (.NET API, AI module). TypeScript types are compile-time only — they are erased
 * at runtime. Zod schemas in validation.ts enforce the same rules at runtime.
 *
 * Ownership model:
 * Every entity has a `userId` field that contains the Firebase UID of the owner.
 * Service functions always query with WHERE userId == authenticatedUserId.
 */

// ---------------------------------------------------------------------------
// Status & Source Value Sets
// ---------------------------------------------------------------------------

/**
 * "as const" turns the array into a readonly tuple.
 * This lets us use the values both as:
 * - A TypeScript union type (APPLICATION_STATUSES[number])
 * - A runtime value list passed to Zod's z.enum() for validation
 */
export const APPLICATION_STATUSES = [
  "Saved",        // Bookmarked job — not yet applied (requirement-specified initial choice)
  "Applied",      // Application submitted
  "Under Review", // Employer is reviewing the application
  "Interview",    // Interview scheduled or in progress
  "Offer",        // Offer received
  "Rejected",     // Application rejected
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_SOURCES = [
  "Greenhouse",
  "Lever",
  "Ashby",
  "Workday",
  "LinkedIn",
  "Other",
] as const;

export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const REMINDER_TYPES = [
  "follow-up",
  "interview",
  "deadline",
  "application-update",
] as const;

export type ReminderType = (typeof REMINDER_TYPES)[number];

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/**
 * A job application as returned by the service layer.
 *
 * Important fields:
 * - id: Firestore auto-generated document ID
 * - userId: Firebase UID of the owner — set by the service, never by the client
 * - matchScore: Reserved for the AI teammate — undefined until AI assigns it
 * - createdAt / updatedAt: ISO 8601 strings (easier for JSON serialization than Timestamps)
 */
export interface ApplicationDocument {
  id: string;
  userId: string;
  company: string;
  jobTitle: string;
  applicationSource: ApplicationSource;
  status: ApplicationStatus;
  jobDescription?: string;
  salaryRange?: string;
  location?: string;
  notes?: string;
  followUpDate?: string; // YYYY-MM-DD format
  matchScore?: number;   // AI-assigned — not written by our services
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

/**
 * Input required to create a new application.
 * Notice: userId is NOT here — the service derives it from the authenticated session.
 */
export interface CreateApplicationInput {
  company: string;
  jobTitle: string;
  applicationSource: ApplicationSource;
  status: ApplicationStatus;
  jobDescription?: string;
  salaryRange?: string;
  location?: string;
  notes?: string;
  followUpDate?: string;
}

/** Partial update — only the provided fields are changed in Firestore. */
export type UpdateApplicationInput = Partial<CreateApplicationInput>;

/**
 * Filters for querying applications.
 * status → applied in Firestore query (uses composite index)
 * applicationSource + search → applied in memory after fetch
 */
export interface ApplicationFilters {
  status?: ApplicationStatus;
  applicationSource?: ApplicationSource;
  search?: string;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Aggregated statistics for the dashboard page.
 * Replaces the hardcoded fake numbers currently in dashboard.tsx.
 */
export interface DashboardStats {
  totalApplications: number;
  byStatus: {
    saved: number;
    applied: number;
    underReview: number;
    interview: number;
    offer: number;
    rejected: number;
  };
  recentApplications: ApplicationDocument[]; // Up to 5, most recent first
  upcomingFollowUps: ApplicationDocument[];  // followUpDate >= today, soonest first
}

// ---------------------------------------------------------------------------
// Document / Resume
// ---------------------------------------------------------------------------

/**
 * Metadata for a user-uploaded document (resume, cover letter, etc.).
 *
 * The actual binary file lives in Firebase Storage.
 * This Firestore record holds the metadata only.
 * storageRef is the Firebase Storage path — it is never returned directly
 * to the UI; instead, we generate a signed URL via getDocumentDownloadUrl().
 */
export interface DocumentMetadata {
  id: string;
  userId: string;
  applicationId?: string;  // Optional link to a specific application
  fileName: string;
  fileType: string;         // MIME type, e.g. "application/pdf"
  fileSize: number;         // bytes
  storageRef: string;       // Firebase Storage path (internal — not exposed to UI)
  displayName?: string;     // Optional friendly label, e.g. "Resume v2"
  createdAt: string;        // ISO 8601
}

/** Input when registering document metadata after a successful Storage upload. */
export interface CreateDocumentInput {
  applicationId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageRef: string;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Reminder
// ---------------------------------------------------------------------------

export interface ReminderDocument {
  id: string;
  userId: string;
  applicationId: string;   // Required — every reminder belongs to an application
  reminderDate: string;    // ISO 8601 datetime string
  type: ReminderType;
  message?: string;
  isCompleted: boolean;
  createdAt: string;       // ISO 8601
}

export interface CreateReminderInput {
  applicationId: string;
  reminderDate: string;    // ISO 8601 — e.g. "2026-09-01T09:00"
  type: ReminderType;
  message?: string;
}

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

/**
 * Typed error class for all backend service errors.
 *
 * For viva:
 * Instead of throwing plain JavaScript Errors, we use this typed class so
 * the frontend can react differently to each situation — analogous to HTTP
 * status codes but used within our service layer:
 *
 * VALIDATION_ERROR → 400 Bad Request  (invalid input data)
 * NOT_FOUND        → 404 Not Found    (also used for auth failures to prevent
 *                                      leaking whether a resource exists)
 * AUTH_ERROR       → 401 Unauthorized (not authenticated at all)
 * SERVER_ERROR     → 500 Internal     (unexpected Firestore/Firebase failure)
 */
export class AppError extends Error {
  constructor(
    public readonly type: "VALIDATION_ERROR" | "NOT_FOUND" | "AUTH_ERROR" | "SERVER_ERROR",
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = "AppError";
  }
}
