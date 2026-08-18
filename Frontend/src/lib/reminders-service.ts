/**
 * reminders-service.ts — Application Reminder Management
 *
 * For viva:
 * Manages follow-up reminders linked to job applications.
 * Each reminder belongs to a user AND to a specific application.
 *
 * Two levels of ownership enforcement:
 * 1. The reminder itself: userId field matches the authenticated user
 * 2. The linked application: we verify the applicationId belongs to the same user
 *    before creating a reminder — preventing a user from creating reminders that
 *    reference another user's applications.
 *
 * Reminder types:
 * - "follow-up"          → Check in with recruiter
 * - "interview"          → Interview scheduled
 * - "deadline"           → Application deadline
 * - "application-update" → Expected update from employer
 *
 * Note on notification delivery:
 * This service stores reminder data in Firestore. It does NOT send emails
 * or push notifications — that would be a separate Cloud Function or cron job,
 * outside the scope of this backend assignment.
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
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firestore";
import { createReminderSchema } from "./validation";
import type { ReminderDocument, CreateReminderInput, ReminderType } from "./types";
import { AppError } from "./types";
import { getApplication } from "./applications-service";

const COLLECTION = "reminders";

interface StoredReminder {
  userId: string;
  applicationId: string;
  reminderDate: string;
  type: string;
  message?: string;
  isCompleted: boolean;
  createdAt: Timestamp | { toDate(): Date };
}

function toReminderDocument(id: string, data: StoredReminder): ReminderDocument {
  return {
    id,
    userId: data.userId,
    applicationId: data.applicationId,
    reminderDate: data.reminderDate,
    type: data.type as ReminderType,
    isCompleted: data.isCompleted,
    createdAt:
      typeof data.createdAt?.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString(),
    ...(data.message !== undefined ? { message: data.message } : {}),
  };
}

// ---------------------------------------------------------------------------
// createReminder
// ---------------------------------------------------------------------------

/**
 * Creates a reminder linked to an application owned by `userId`.
 *
 * Security:
 * - userId comes from Firebase Auth — NEVER from the client body.
 * - We verify that applicationId belongs to userId (cross-ownership check).
 *   This prevents creating a reminder that references another user's application.
 *
 * @throws AppError VALIDATION_ERROR if input is invalid
 * @throws AppError NOT_FOUND if applicationId doesn't exist or doesn't belong to userId
 */
export async function createReminder(
  userId: string,
  input: CreateReminderInput
): Promise<ReminderDocument> {
  if (!db) throw new AppError("SERVER_ERROR", "Firestore is not configured.");

  const result = createReminderSchema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.errors) {
      const field = issue.path[0];
      if (field !== undefined) {
        fields[String(field)] = issue.message;
      }
    }
    throw new AppError("VALIDATION_ERROR", "Invalid reminder data", fields);
  }

  // Cross-ownership check: verify the linked application belongs to this user
  const linkedApp = await getApplication(userId, result.data.applicationId);
  if (!linkedApp) {
    throw new AppError("NOT_FOUND", "Application not found");
  }

  const now = new Date().toISOString();
  const firestoreData: Record<string, unknown> = {
    userId,
    applicationId: result.data.applicationId,
    reminderDate: result.data.reminderDate,
    type: result.data.type,
    isCompleted: false,
    createdAt: serverTimestamp(),
  };

  if (result.data.message !== undefined) {
    firestoreData["message"] = result.data.message;
  }

  const docRef = await addDoc(collection(db, COLLECTION), firestoreData);

  return {
    id: docRef.id,
    userId,
    applicationId: result.data.applicationId,
    reminderDate: result.data.reminderDate,
    type: result.data.type,
    isCompleted: false,
    createdAt: now,
    ...(result.data.message !== undefined ? { message: result.data.message } : {}),
  };
}

// ---------------------------------------------------------------------------
// getReminders
// ---------------------------------------------------------------------------

/**
 * Returns all reminders for a user, sorted by reminderDate ascending (soonest first).
 * Optionally filtered by a specific applicationId (in memory after fetch).
 *
 * Security: Firestore query always includes WHERE userId == userId.
 */
export async function getReminders(
  userId: string,
  applicationId?: string
): Promise<ReminderDocument[]> {
  if (!db) throw new AppError("SERVER_ERROR", "Firestore is not configured.");

  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    orderBy("reminderDate", "asc")
  );

  const snapshot = await getDocs(q);
  let reminders = snapshot.docs.map((d) =>
    toReminderDocument(d.id, d.data() as StoredReminder)
  );

  // In-memory filter for applicationId — avoids a triple composite index
  if (applicationId) {
    reminders = reminders.filter((r) => r.applicationId === applicationId);
  }

  return reminders;
}

// ---------------------------------------------------------------------------
// markReminderComplete
// ---------------------------------------------------------------------------

/**
 * Marks a reminder as completed.
 *
 * Security: Fetches the reminder and verifies userId ownership before updating.
 */
export async function markReminderComplete(
  userId: string,
  reminderId: string
): Promise<void> {
  if (!db) throw new AppError("SERVER_ERROR", "Firestore is not configured.");

  const docRef = doc(db, COLLECTION, reminderId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new AppError("NOT_FOUND", "Reminder not found");
  }

  const data = docSnap.data() as StoredReminder;
  if (data.userId !== userId) {
    throw new AppError("NOT_FOUND", "Reminder not found"); // NOT_FOUND to prevent leakage
  }

  await updateDoc(docRef, {
    isCompleted: true,
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// updateReminder
// ---------------------------------------------------------------------------

/**
 * Updates a reminder's mutable fields: reminderDate, type, message.
 *
 * Security: Verifies userId ownership before writing.
 * Note: applicationId and userId are immutable — they cannot be changed after creation.
 *
 * @returns The updated ReminderDocument with merged fields.
 */
export async function updateReminder(
  userId: string,
  reminderId: string,
  changes: Partial<Pick<CreateReminderInput, "reminderDate" | "type" | "message">>
): Promise<ReminderDocument> {
  if (!db) throw new AppError("SERVER_ERROR", "Firestore is not configured.");

  const docRef = doc(db, COLLECTION, reminderId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new AppError("NOT_FOUND", "Reminder not found");
  }

  const existing = docSnap.data() as StoredReminder;
  if (existing.userId !== userId) {
    throw new AppError("NOT_FOUND", "Reminder not found");
  }

  const updatePayload: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (changes.reminderDate !== undefined) updatePayload["reminderDate"] = changes.reminderDate;
  if (changes.type !== undefined) updatePayload["type"] = changes.type;
  if (changes.message !== undefined) updatePayload["message"] = changes.message;

  await updateDoc(docRef, updatePayload);

  const merged: StoredReminder = {
    ...existing,
    ...(changes.reminderDate !== undefined ? { reminderDate: changes.reminderDate } : {}),
    ...(changes.type !== undefined ? { type: changes.type } : {}),
    ...(changes.message !== undefined ? { message: changes.message } : {}),
  };

  return toReminderDocument(reminderId, merged);
}
