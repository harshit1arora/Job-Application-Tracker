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
import { createApplicationSchema, updateApplicationSchema } from "./validation";
import type {
  ApplicationDocument,
  ApplicationFilters,
  CreateApplicationInput,
  UpdateApplicationInput,
} from "./types";
import { AppError } from "./types";
import {
  fetchApplications,
  fetchApplication,
  createApplicationApi,
  updateApplicationApi,
  deleteApplicationApi,
} from "./api-client";

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

export async function createApplication(
  userId: string,
  input: CreateApplicationInput
): Promise<ApplicationDocument> {
  const result = createApplicationSchema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid application data",
      extractFieldErrors(result.error.errors)
    );
  }

  return await createApplicationApi(userId, result.data as CreateApplicationInput);
}

export async function getApplications(
  userId: string,
  filters?: ApplicationFilters
): Promise<ApplicationDocument[]> {
  return await fetchApplications(userId, filters);
}

export async function getApplication(
  userId: string,
  applicationId: string
): Promise<ApplicationDocument | null> {
  return await fetchApplication(userId, applicationId);
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  changes: UpdateApplicationInput
): Promise<ApplicationDocument> {
  const result = updateApplicationSchema.safeParse(changes);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid update data",
      extractFieldErrors(result.error.errors)
    );
  }

  return await updateApplicationApi(userId, applicationId, result.data as UpdateApplicationInput);
}

export async function deleteApplication(
  userId: string,
  applicationId: string
): Promise<void> {
  await deleteApplicationApi(userId, applicationId);
}

