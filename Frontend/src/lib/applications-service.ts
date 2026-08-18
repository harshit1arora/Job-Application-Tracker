/**
 * applications-service.ts — Job Application CRUD
 *
 * For viva:
 * This service is the heart of the backend. It handles all Create, Read,
 * and Update operations for job applications stored in Firestore.
 *
 * Key design decisions:
 *
 * 1. OWNERSHIP ENFORCEMENT
 *    Every function receives `userId` from the authenticated Firebase session
 *    (via useAuth().user.id in the component). This userId is NEVER taken
 *    from the client request body — it is always from the trusted Auth state.
 *    All Firestore queries include WHERE userId == userId.
 *    Reads additionally verify the returned document's userId field matches.
 *
 * 2. VALIDATION BEFORE WRITE
 *    All input goes through Zod (validation.ts) before touching Firestore.
 *    Invalid data throws an AppError("VALIDATION_ERROR") with field-level errors.
 *
 * 3. NOT_FOUND instead of UNAUTHORIZED on ownership failures
 *    When a document exists but belongs to another user, we return NOT_FOUND
 *    rather than UNAUTHORIZED. This prevents an attacker from discovering
 *    whether a specific applicationId exists (information leakage).
 *
 * 4. SERVER TIMESTAMPS
 *    createdAt and updatedAt use Firestore's serverTimestamp() sentinel value.
 *    This means Firestore's server clock is used — not the client clock.
 *    Return values use Date.now() as an optimistic approximation.
 *
 * 5. FILTERING STRATEGY
 *    Status filter → Firestore WHERE clause (uses a composite index)
 *    ApplicationSource + text search → in-memory after fetch
 *    Rationale: Firestore doesn't support OR queries or full-text search natively.
 *    For college-scale data (< 200 applications per user), in-memory is fine.
 */
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./firestore";
import { createApplicationSchema, updateApplicationSchema } from "./validation";
import type {
  ApplicationDocument,
  ApplicationFilters,
  CreateApplicationInput,
  UpdateApplicationInput,
} from "./types";
import { AppError } from "./types";

const COLLECTION = "applications";

// ---------------------------------------------------------------------------
// Internal Firestore data shape
// ---------------------------------------------------------------------------

/**
 * How a document is stored in Firestore.
 * We cast raw Firestore data to this interface (trusted cast — data comes from
 * our own writes which are validated through the Zod schemas above).
 */
interface StoredApplication {
  userId: string;
  company: string;
  jobTitle: string;
  applicationSource: string;
  status: string;
  jobDescription?: string;
  salaryRange?: string;
  location?: string;
  notes?: string;
  followUpDate?: string;
  matchScore?: number;
  createdAt: Timestamp | { toDate(): Date };
  updatedAt: Timestamp | { toDate(): Date };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts raw Firestore document data to a typed ApplicationDocument.
 *
 * Uses conditional spreads for optional fields to satisfy TypeScript's
 * `exactOptionalPropertyTypes` compiler flag: instead of setting a property
 * to `undefined`, we conditionally include the key only when the value exists.
 */
function toApplicationDocument(id: string, data: StoredApplication): ApplicationDocument {
  const createdAt =
    typeof data.createdAt?.toDate === 'function'
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString();

  const updatedAt =
    typeof data.updatedAt?.toDate === 'function'
      ? data.updatedAt.toDate().toISOString()
      : new Date().toISOString();

  return {
    id,
    userId: data.userId,
    company: data.company,
    jobTitle: data.jobTitle,
    applicationSource: data.applicationSource as ApplicationDocument["applicationSource"],
    status: data.status as ApplicationDocument["status"],
    createdAt,
    updatedAt,
    // Optional fields: included only when present in the stored document
    ...(data.jobDescription !== undefined ? { jobDescription: data.jobDescription } : {}),
    ...(data.salaryRange !== undefined ? { salaryRange: data.salaryRange } : {}),
    ...(data.location !== undefined ? { location: data.location } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.followUpDate !== undefined ? { followUpDate: data.followUpDate } : {}),
    ...(data.matchScore !== undefined ? { matchScore: data.matchScore } : {}),
  };
}

/**
 * Extracts per-field validation errors from a Zod error object.
 * Returns a map of { fieldName → errorMessage } for UI display.
 */
function extractFieldErrors(
  zodErrors: { path: (string | number)[]; message: string }[]
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of zodErrors) {
    const field = issue.path[0];
    if (field !== undefined) {
      fields[String(field)] = issue.message;
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// createApplication
// ---------------------------------------------------------------------------

/**
 * Creates and persists a new job application owned by `userId`.
 *
 * Security: userId comes from Firebase Auth — NEVER from the client body.
 * Validation: Full Zod schema check before any Firestore write.
 *
 * @returns The created ApplicationDocument with optimistic timestamps.
 */
export async function createApplication(
  userId: string,
  input: CreateApplicationInput
): Promise<ApplicationDocument> {
  if (!db) {
    throw new AppError("SERVER_ERROR", "Firestore is not configured. Please set up your .env file.");
  }

  const result = createApplicationSchema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid application data",
      extractFieldErrors(result.error.errors)
    );
  }

  const now = new Date().toISOString();
  const firestoreData = {
    userId, // Set from Auth — never from client body
    ...result.data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTION), firestoreData);

  // Return the document immediately with optimistic timestamps.
  // serverTimestamp() is a sentinel resolved by Firestore server-side;
  // we use Date.now() as a close approximation for the immediate return value.
  return {
    id: docRef.id,
    userId,
    company: result.data.company,
    jobTitle: result.data.jobTitle,
    applicationSource: result.data.applicationSource,
    status: result.data.status,
    createdAt: now,
    updatedAt: now,
    ...(result.data.jobDescription !== undefined ? { jobDescription: result.data.jobDescription } : {}),
    ...(result.data.salaryRange !== undefined ? { salaryRange: result.data.salaryRange } : {}),
    ...(result.data.location !== undefined ? { location: result.data.location } : {}),
    ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
    ...(result.data.followUpDate !== undefined ? { followUpDate: result.data.followUpDate } : {}),
  };
}

// ---------------------------------------------------------------------------
// getApplications
// ---------------------------------------------------------------------------

/**
 * Returns all applications belonging to `userId`, with optional filters.
 *
 * Filtering strategy:
 * - status → Firestore WHERE clause (requires composite index: userId+status+createdAt)
 * - applicationSource → in-memory filter after fetch
 * - search → in-memory substring match on company + jobTitle
 *
 * For viva: Firestore doesn't support full-text search. In production you'd use
 * Algolia or Elastic. For college-scale data, in-memory search is fast enough.
 */
export async function getApplications(
  userId: string,
  filters?: ApplicationFilters
): Promise<ApplicationDocument[]> {
  if (!db) {
    throw new AppError("SERVER_ERROR", "Firestore is not configured.");
  }

  // Build the Firestore query constraints
  const constraints: QueryConstraint[] = [
    where("userId", "==", userId),
  ];

  // Status filter goes to Firestore level to reduce data transferred
  if (filters?.status) {
    constraints.push(where("status", "==", filters.status));
  }

  const q = query(collection(db, COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  let applications = snapshot.docs.map((d) =>
    toApplicationDocument(d.id, d.data() as StoredApplication)
  );

  // Sort by createdAt descending in-memory to avoid needing a Firestore composite index
  applications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // In-memory filters for fields not included in the Firestore query
  if (filters?.applicationSource) {
    applications = applications.filter(
      (a) => a.applicationSource === filters.applicationSource
    );
  }

  if (filters?.search) {
    const term = filters.search.toLowerCase();
    applications = applications.filter(
      (a) =>
        a.company.toLowerCase().includes(term) ||
        a.jobTitle.toLowerCase().includes(term)
    );
  }

  return applications;
}

// ---------------------------------------------------------------------------
// getApplication
// ---------------------------------------------------------------------------

/**
 * Returns a single application if it belongs to `userId`.
 *
 * Returns null for both "document doesn't exist" and "belongs to another user"
 * to avoid leaking information about other users' document IDs.
 */
export async function getApplication(
  userId: string,
  applicationId: string
): Promise<ApplicationDocument | null> {
  if (!db) {
    throw new AppError("SERVER_ERROR", "Firestore is not configured.");
  }

  const docRef = doc(db, COLLECTION, applicationId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data() as StoredApplication;

  // Ownership check — return null instead of unauthorized to avoid leaking existence
  if (data.userId !== userId) return null;

  return toApplicationDocument(docSnap.id, data);
}

// ---------------------------------------------------------------------------
// updateApplication
// ---------------------------------------------------------------------------

/**
 * Updates specified fields of an application after verifying ownership.
 *
 * Security:
 * - Fetches the document first and verifies userId === authenticated user.
 * - Throws NOT_FOUND (not UNAUTHORIZED) if the document belongs to someone else.
 *
 * Validation: Partial Zod schema — only the provided fields are validated.
 *
 * @returns The updated ApplicationDocument with merged fields.
 */
export async function updateApplication(
  userId: string,
  applicationId: string,
  changes: UpdateApplicationInput
): Promise<ApplicationDocument> {
  if (!db) {
    throw new AppError("SERVER_ERROR", "Firestore is not configured.");
  }

  const result = updateApplicationSchema.safeParse(changes);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid update data",
      extractFieldErrors(result.error.errors)
    );
  }

  // Fetch and verify ownership before writing
  const docRef = doc(db, COLLECTION, applicationId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new AppError("NOT_FOUND", "Application not found");
  }

  const existing = docSnap.data() as StoredApplication;
  if (existing.userId !== userId) {
    // NOT_FOUND instead of UNAUTHORIZED — prevents leaking document existence
    throw new AppError("NOT_FOUND", "Application not found");
  }

  // Build the Firestore update payload — only include provided fields
  const updatePayload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  const d = result.data;

  if (d.company !== undefined) updatePayload["company"] = d.company;
  if (d.jobTitle !== undefined) updatePayload["jobTitle"] = d.jobTitle;
  if (d.applicationSource !== undefined) updatePayload["applicationSource"] = d.applicationSource;
  if (d.status !== undefined) updatePayload["status"] = d.status;
  if (d.jobDescription !== undefined) updatePayload["jobDescription"] = d.jobDescription;
  if (d.salaryRange !== undefined) updatePayload["salaryRange"] = d.salaryRange;
  if (d.location !== undefined) updatePayload["location"] = d.location;
  if (d.notes !== undefined) updatePayload["notes"] = d.notes;
  if (d.followUpDate !== undefined) updatePayload["followUpDate"] = d.followUpDate;

  await updateDoc(docRef, updatePayload);

  // Build the merged result document for the return value
  const merged: StoredApplication = {
    ...existing,
    ...(d.company !== undefined ? { company: d.company } : {}),
    ...(d.jobTitle !== undefined ? { jobTitle: d.jobTitle } : {}),
    ...(d.applicationSource !== undefined ? { applicationSource: d.applicationSource } : {}),
    ...(d.status !== undefined ? { status: d.status } : {}),
    ...(d.jobDescription !== undefined ? { jobDescription: d.jobDescription } : {}),
    ...(d.salaryRange !== undefined ? { salaryRange: d.salaryRange } : {}),
    ...(d.location !== undefined ? { location: d.location } : {}),
    ...(d.notes !== undefined ? { notes: d.notes } : {}),
    ...(d.followUpDate !== undefined ? { followUpDate: d.followUpDate } : {}),
    updatedAt: Timestamp.now(),
  };

  return toApplicationDocument(applicationId, merged);
}

// ---------------------------------------------------------------------------
// deleteApplication
// ---------------------------------------------------------------------------

/**
 * Deletes an application after verifying ownership.
 *
 * Security:
 * - Fetches the document first and verifies userId === authenticated user.
 * - Throws NOT_FOUND if the document belongs to someone else.
 */
export async function deleteApplication(
  userId: string,
  applicationId: string
): Promise<void> {
  if (!db) {
    throw new AppError("SERVER_ERROR", "Firestore is not configured.");
  }

  // Fetch and verify ownership before deleting
  const docRef = doc(db, COLLECTION, applicationId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new AppError("NOT_FOUND", "Application not found");
  }

  const existing = docSnap.data() as StoredApplication;
  if (existing.userId !== userId) {
    // NOT_FOUND instead of UNAUTHORIZED — prevents leaking document existence
    throw new AppError("NOT_FOUND", "Application not found");
  }

  await deleteDoc(docRef);
}
