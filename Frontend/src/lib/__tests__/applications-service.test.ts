/**
 * applications-service.test.ts
 *
 * Tests for the applications service.
 *
 * Testing strategy:
 * - Validation tests: no Firestore mock needed (Zod runs before any Firestore call)
 * - CRUD + ownership tests: mock firebase/firestore to control what the DB returns
 *
 * For viva:
 * vi.mock() replaces module imports with mock implementations.
 * This lets us test the service logic without a real Firebase connection.
 * The mocks simulate Firestore responses (success, not found, wrong owner).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../types";

// ---------------------------------------------------------------------------
// Mock firebase/firestore BEFORE importing the service
// (Vitest hoists vi.mock() calls to the top of the file)
// ---------------------------------------------------------------------------
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "mock-collection-ref"),
  doc: vi.fn(() => "mock-doc-ref"),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(() => "mock-query"),
  where: vi.fn(() => "mock-where-constraint"),
  orderBy: vi.fn(() => "mock-order-constraint"),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date(), _type: "timestamp" })),
  },
}));

// Mock db instance
vi.mock("../firestore", () => ({ db: "mock-db" }));

// Now import the service (gets the mocked modules)
import { createApplication, getApplications, getApplication, updateApplication } from "../applications-service";
import { getDoc, addDoc, getDocs } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_INPUT = {
  company: "Stripe",
  jobTitle: "Senior Engineer",
  applicationSource: "Greenhouse" as const,
  status: "Applied" as const,
};

const MOCK_FIRESTORE_DOC = {
  userId: "user-1",
  company: "Stripe",
  jobTitle: "Senior Engineer",
  applicationSource: "Greenhouse",
  status: "Applied",
  createdAt: { toDate: () => new Date("2026-01-01"), _type: "timestamp" },
  updatedAt: { toDate: () => new Date("2026-01-01"), _type: "timestamp" },
};

// ---------------------------------------------------------------------------
// createApplication — Validation
// ---------------------------------------------------------------------------
describe("createApplication — validation", () => {
  it("throws VALIDATION_ERROR when company is empty", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, company: "" })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when jobTitle is empty", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, jobTitle: "" })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when applicationSource is invalid", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, applicationSource: "FakeBoard" as any })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when status is invalid", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, status: "Ghosted" as any })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR with field details when company exceeds 100 chars", async () => {
    const longName = "A".repeat(101);
    try {
      await createApplication("user-1", { ...VALID_INPUT, company: longName });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).type).toBe("VALIDATION_ERROR");
      expect((err as AppError).fields).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// createApplication — Success
// ---------------------------------------------------------------------------
describe("createApplication — success", () => {
  beforeEach(() => {
    vi.mocked(addDoc).mockResolvedValue({ id: "new-app-id" } as any);
  });

  it("returns an ApplicationDocument with the correct userId", async () => {
    const result = await createApplication("user-1", VALID_INPUT);
    expect(result.userId).toBe("user-1");
  });

  it("returns an ApplicationDocument with the correct company", async () => {
    const result = await createApplication("user-1", VALID_INPUT);
    expect(result.company).toBe("Stripe");
  });

  it("returns an ApplicationDocument with the correct Firestore id", async () => {
    const result = await createApplication("user-1", VALID_INPUT);
    expect(result.id).toBe("new-app-id");
  });

  it("returns an ApplicationDocument with createdAt as an ISO string", async () => {
    const result = await createApplication("user-1", VALID_INPUT);
    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("accepts optional fields (notes, followUpDate)", async () => {
    const result = await createApplication("user-1", {
      ...VALID_INPUT,
      notes: "Referral from Jane",
      followUpDate: "2026-09-01",
    });
    expect(result.notes).toBe("Referral from Jane");
    expect(result.followUpDate).toBe("2026-09-01");
  });
});

// ---------------------------------------------------------------------------
// getApplication — Ownership
// ---------------------------------------------------------------------------
describe("getApplication — ownership enforcement", () => {
  it("returns null when document belongs to a different user", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: "app-123",
      data: () => ({ ...MOCK_FIRESTORE_DOC, userId: "other-user" }),
    } as any);

    const result = await getApplication("user-1", "app-123");
    expect(result).toBeNull();
  });

  it("returns null when document does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    const result = await getApplication("user-1", "nonexistent");
    expect(result).toBeNull();
  });

  it("returns the document when userId matches", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: "app-123",
      data: () => MOCK_FIRESTORE_DOC,
    } as any);

    const result = await getApplication("user-1", "app-123");
    expect(result).not.toBeNull();
    expect(result?.company).toBe("Stripe");
    expect(result?.id).toBe("app-123");
  });
});

// ---------------------------------------------------------------------------
// getApplications — Filtering
// ---------------------------------------------------------------------------
describe("getApplications — in-memory filtering", () => {
  const mockApps = [
    { ...MOCK_FIRESTORE_DOC, company: "Stripe", jobTitle: "Backend Engineer", applicationSource: "Greenhouse", status: "Applied" },
    { ...MOCK_FIRESTORE_DOC, company: "Notion", jobTitle: "Frontend Engineer", applicationSource: "Lever", status: "Interview" },
    { ...MOCK_FIRESTORE_DOC, company: "Linear", jobTitle: "Full Stack Engineer", applicationSource: "Ashby", status: "Applied" },
  ];

  beforeEach(() => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockApps.map((d, i) => ({ id: `app-${i}`, data: () => d })),
    } as any);
  });

  it("returns all applications when no filters are set", async () => {
    const result = await getApplications("user-1");
    expect(result).toHaveLength(3);
  });

  it("filters by applicationSource in memory", async () => {
    const result = await getApplications("user-1", { applicationSource: "Lever" });
    expect(result).toHaveLength(1);
    expect(result[0]?.company).toBe("Notion");
  });

  it("filters by search term (company name, case-insensitive)", async () => {
    const result = await getApplications("user-1", { search: "stripe" });
    expect(result).toHaveLength(1);
    expect(result[0]?.company).toBe("Stripe");
  });

  it("filters by search term (job title)", async () => {
    const result = await getApplications("user-1", { search: "frontend" });
    expect(result).toHaveLength(1);
    expect(result[0]?.company).toBe("Notion");
  });

  it("returns empty array when search has no matches", async () => {
    const result = await getApplications("user-1", { search: "Airbnb" });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// updateApplication — Ownership
// ---------------------------------------------------------------------------
describe("updateApplication — ownership enforcement", () => {
  it("throws NOT_FOUND when document belongs to a different user", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: "app-123",
      data: () => ({ ...MOCK_FIRESTORE_DOC, userId: "other-user" }),
    } as any);

    await expect(
      updateApplication("user-1", "app-123", { status: "Interview" })
    ).rejects.toMatchObject({ type: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when document does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);

    await expect(
      updateApplication("user-1", "nonexistent", { status: "Interview" })
    ).rejects.toMatchObject({ type: "NOT_FOUND" });
  });

  it("throws VALIDATION_ERROR for invalid status on update", async () => {
    await expect(
      updateApplication("user-1", "app-123", { status: "Ghosted" as any })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });
});
