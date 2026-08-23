import { describe, it, expect } from "vitest";
import { AppError } from "../types";
import {
  createReminder,
  getReminders,
  markReminderComplete,
  updateReminder,
  deleteReminder,
} from "../reminders-service";

const VALID_INPUT = {
  applicationId: "app-123",
  reminderDate: "2026-09-15T09:00",
  type: "follow-up" as const,
  message: "Check in with recruiter",
};

describe("createReminder — validation", () => {
  it("throws VALIDATION_ERROR when reminderDate is empty", async () => {
    await expect(
      createReminder("user-1", { ...VALID_INPUT, reminderDate: "" })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when type is invalid", async () => {
    await expect(
      createReminder("user-1", { ...VALID_INPUT, type: "party" as any })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });
});

describe("reminders-service — CRUD workflow", () => {
  it("creates, marks complete, updates and deletes a reminder", async () => {
    const reminder = await createReminder("test-user-rems", VALID_INPUT);
    expect(reminder.id).toBeDefined();
    expect(reminder.isCompleted).toBe(false);

    const list = await getReminders("test-user-rems", "app-123");
    expect(list.some((r) => r.id === reminder.id)).toBe(true);

    await markReminderComplete("test-user-rems", reminder.id);
    const updated = await updateReminder("test-user-rems", reminder.id, {
      message: "Updated recruiter message",
    });
    expect(updated.message).toBe("Updated recruiter message");

    await deleteReminder("test-user-rems", reminder.id);
    const afterDelete = await getReminders("test-user-rems", "app-123");
    expect(afterDelete.some((r) => r.id === reminder.id)).toBe(false);
  });
});
