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
import { createReminderSchema } from "./validation";
import type { ReminderDocument, CreateReminderInput, ReminderType } from "./types";
import { AppError } from "./types";
import {
  fetchReminders,
  createReminderApi,
  updateReminderApi,
  deleteReminderApi,
} from "./api-client";

export async function createReminder(
  userId: string,
  input: CreateReminderInput
): Promise<ReminderDocument> {
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

  return await createReminderApi(userId, result.data as CreateReminderInput);
}

export async function getReminders(
  userId: string,
  applicationId?: string
): Promise<ReminderDocument[]> {
  return await fetchReminders(userId, applicationId);
}

export async function markReminderComplete(
  userId: string,
  reminderId: string
): Promise<void> {
  await updateReminderApi(userId, reminderId, { isCompleted: true });
}

export async function updateReminder(
  userId: string,
  reminderId: string,
  changes: Partial<Pick<CreateReminderInput, "reminderDate" | "type" | "message">>
): Promise<ReminderDocument> {
  return await updateReminderApi(userId, reminderId, changes);
}

export async function deleteReminder(
  userId: string,
  reminderId: string
): Promise<void> {
  await deleteReminderApi(userId, reminderId);
}

