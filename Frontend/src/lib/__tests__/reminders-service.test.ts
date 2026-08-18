/**
 * reminders-service.test.ts
 *
 * Tests for the reminders service.
 *
 * Tests:
 * - Validation (missing fields, invalid type)
 * - Cross-ownership check (applicationId must belong to userId)
 * - Ownership enforcement on mark-complete and update
 * - getReminders ownership (only user's own reminders returned)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firestore
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "mock-collection"),
  doc: vi.fn(() => "mock-doc-ref"),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(() => "mock-query"),
  where: vi.fn(() => "mock-where"),
  orderBy: vi.fn(() => "mock-order"),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
}));

vi.mock("../firestore", () => ({ db: "mock-db" }));

// Mock the getApplication dependency
vi.mock("../applications-service", () => ({
  getApplication: vi.fn(),
}));

import { createReminder, getReminders, markReminderComplete, updateReminder } from "../reminders-service";
import { getDoc, addDoc, getDocs } from "firebase/firestore";
import { getApplication } from "../applications-service";
import type { ApplicationDocument } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_INPUT = {
  applicationId: "app-123",
  reminderDate: "2026-09-15T09:00",
  type: "follow-up" as const,
  message: "Check in with recruiter",
};

const MOCK_APP: ApplicationDocument = {
  id: "app-123",
  userId: "user-1",
  company: "Stripe",
  jobTitle: "Engineer",
  applicationSource: "Greenhouse",
  status: "Applied",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_REMINDER_DATA = {
  userId: "user-1",
  applicationId: "app-123",
  reminderDate: "2026-09-15T09:00",
  type: "follow-up",
  isCompleted: false,
  createdAt: { toDate: () => new Date(), _type: "timestamp" },
};

// ---------------------------------------------------------------------------
// createReminder — Validation
// ---------------------------------------------------------------------------
describe("createReminder — validation", () => {
  it("throws VALIDATION_ERROR when applicationId is empty", async () => {
    await expect(
      createReminder("user-1", { ...VALID_INPUT, applicationId: "" })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when reminderDate is empty", async () => {
    await expect(
      createReminder("user-1", { ...VALID_INPUT, reminderDate: "" })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when type is invalid", async () => {
    await expect(
      createReminder("user-1", { ...VALID_INPUT, type: "ping" as any })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });
});

// ---------------------------------------------------------------------------
// createReminder — Cross-ownership check
// ---------------------------------------------------------------------------
describe("createReminder — cross-ownership enforcement", () => {
  it("throws NOT_FOUND when applicationId does not belong to userId", async () => {
    vi.mocked(getApplication).mockResolvedValue(null); // app not owned by this user

    await expect(createReminder("user-1", VALID_INPUT)).rejects.toMatchObject({
      type: "NOT_FOUND",
    });
  });

  it("creates reminder when applicationId belongs to userId", async () => {
    vi.mocked(getApplication).mockResolvedValue(MOCK_APP);
    vi.mocked(addDoc).mockResolvedValue({ id: "reminder-123" } as any);

    const result = await createReminder("user-1", VALID_INPUT);
    expect(result.id).toBe("reminder-123");
    expect(result.userId).toBe("user-1");
    expect(result.applicationId).toBe("app-123");
    expect(result.isCompleted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markReminderComplete — Ownership
// ---------------------------------------------------------------------------
describe("markReminderComplete — ownership enforcement", () => {
  it("throws NOT_FOUND when reminder belongs to a different user", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ ...MOCK_REMINDER_DATA, userId: "other-user" }),
    } as any);

    await expect(
      markReminderComplete("user-1", "reminder-123")
    ).rejects.toMatchObject({ type: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when reminder does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);

    await expect(
      markReminderComplete("user-1", "nonexistent")
    ).rejects.toMatchObject({ type: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// getReminders — Returns correct data
// ---------------------------------------------------------------------------
describe("getReminders", () => {
  it("returns only the user's reminders", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: "r-1", data: () => MOCK_REMINDER_DATA },
        { id: "r-2", data: () => MOCK_REMINDER_DATA },
      ],
    } as any);

    const result = await getReminders("user-1");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.userId === "user-1")).toBe(true);
  });

  it("filters by applicationId in memory when provided", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        { id: "r-1", data: () => ({ ...MOCK_REMINDER_DATA, applicationId: "app-123" }) },
        { id: "r-2", data: () => ({ ...MOCK_REMINDER_DATA, applicationId: "app-456" }) },
      ],
    } as any);

    const result = await getReminders("user-1", "app-123");
    expect(result).toHaveLength(1);
    expect(result[0]?.applicationId).toBe("app-123");
  });
});

// ---------------------------------------------------------------------------
// updateReminder — Ownership
// ---------------------------------------------------------------------------
describe("updateReminder — ownership enforcement", () => {
  it("throws NOT_FOUND when reminder belongs to a different user", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ ...MOCK_REMINDER_DATA, userId: "other-user" }),
    } as any);

    await expect(
      updateReminder("user-1", "reminder-123", { type: "interview" })
    ).rejects.toMatchObject({ type: "NOT_FOUND" });
  });
});
