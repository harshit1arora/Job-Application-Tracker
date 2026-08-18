/**
 * documents-service.test.ts
 *
 * Tests for the documents service.
 *
 * Strategy:
 * - Mock firebase/firestore and firebase/storage
 * - Test validation (file type, file size)
 * - Test ownership enforcement (wrong userId returns NOT_FOUND)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "../types";

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
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: "serverTimestamp" })),
  Timestamp: { now: vi.fn(() => ({ toDate: () => new Date() })) },
}));

// Mock Firebase Storage
vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => "mock-storage"),
  ref: vi.fn(() => "mock-storage-ref"),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

// Mock app and db
vi.mock("../firestore", () => ({ db: "mock-db" }));
vi.mock("../firebase", () => ({ app: "mock-app" }));

// Mock getApplication dependency
vi.mock("../applications-service", () => ({
  getApplication: vi.fn(),
}));

import { uploadDocument, getDocumentDownloadUrl, deleteDocument } from "../documents-service";
import { getDoc, addDoc } from "firebase/firestore";
import { uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getApplication } from "../applications-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFile(type = "application/pdf", size = 1024): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], "resume.pdf", { type });
}

const MOCK_DOC_DATA = {
  userId: "user-1",
  fileName: "resume.pdf",
  fileType: "application/pdf",
  fileSize: 1024,
  storageRef: "documents/user-1/123_resume.pdf",
  createdAt: { toDate: () => new Date(), _type: "timestamp" },
};

// ---------------------------------------------------------------------------
// uploadDocument — Validation
// ---------------------------------------------------------------------------
describe("uploadDocument — validation", () => {
  it("throws VALIDATION_ERROR for unsupported file type", async () => {
    const badFile = makeFile("image/png");
    await expect(uploadDocument("user-1", badFile)).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
    });
  });

  it("throws VALIDATION_ERROR when file exceeds 5 MB", async () => {
    const bigFile = makeFile("application/pdf", 6 * 1024 * 1024);
    await expect(uploadDocument("user-1", bigFile)).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
    });
  });

  it("throws NOT_FOUND when applicationId doesn't belong to userId", async () => {
    vi.mocked(getApplication).mockResolvedValue(null); // application not found for this user
    const validFile = makeFile("application/pdf");
    await expect(
      uploadDocument("user-1", validFile, "other-users-app-id")
    ).rejects.toMatchObject({ type: "NOT_FOUND" });
  });
});

// ---------------------------------------------------------------------------
// uploadDocument — Success
// ---------------------------------------------------------------------------
describe("uploadDocument — success", () => {
  beforeEach(() => {
    vi.mocked(uploadBytes).mockResolvedValue({} as any);
    vi.mocked(addDoc).mockResolvedValue({ id: "doc-123" } as any);
  });

  it("returns DocumentMetadata with the correct userId", async () => {
    const file = makeFile("application/pdf");
    const result = await uploadDocument("user-1", file);
    expect(result.userId).toBe("user-1");
  });

  it("returns DocumentMetadata with the original file name", async () => {
    const file = makeFile("application/pdf");
    const result = await uploadDocument("user-1", file);
    expect(result.fileName).toBe("resume.pdf");
  });

  it("accepts a Word document (.docx)", async () => {
    const file = makeFile(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const result = await uploadDocument("user-1", file);
    expect(result.fileType).toContain("wordprocessingml");
  });
});

// ---------------------------------------------------------------------------
// getDocumentDownloadUrl — Ownership
// ---------------------------------------------------------------------------
describe("getDocumentDownloadUrl — ownership enforcement", () => {
  it("throws NOT_FOUND when document belongs to a different user", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ ...MOCK_DOC_DATA, userId: "other-user" }),
    } as any);

    await expect(
      getDocumentDownloadUrl("user-1", "doc-123")
    ).rejects.toMatchObject({ type: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when document does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);

    await expect(
      getDocumentDownloadUrl("user-1", "nonexistent")
    ).rejects.toMatchObject({ type: "NOT_FOUND" });
  });

  it("returns a download URL when user owns the document", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => MOCK_DOC_DATA,
    } as any);
    vi.mocked(getDownloadURL).mockResolvedValue("https://storage.googleapis.com/...");

    const url = await getDocumentDownloadUrl("user-1", "doc-123");
    expect(url).toContain("https://");
  });
});

// ---------------------------------------------------------------------------
// deleteDocument — Ownership
// ---------------------------------------------------------------------------
describe("deleteDocument — ownership enforcement", () => {
  it("throws NOT_FOUND when document belongs to a different user", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ ...MOCK_DOC_DATA, userId: "other-user" }),
    } as any);

    await expect(deleteDocument("user-1", "doc-123")).rejects.toMatchObject({
      type: "NOT_FOUND",
    });
  });
});
