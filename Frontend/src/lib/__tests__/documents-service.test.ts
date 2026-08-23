import { describe, it, expect } from "vitest";
import { AppError } from "../types";
import { uploadDocument, getDocuments, deleteDocument } from "../documents-service";

function makeFile(name = "resume.pdf", type = "application/pdf", size = 1024): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

describe("documents-service", () => {
  it("throws VALIDATION_ERROR when file exceeds 5MB", async () => {
    const hugeFile = makeFile("huge.pdf", "application/pdf", 6 * 1024 * 1024);
    await expect(uploadDocument("user-1", hugeFile)).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
    });
  });

  it("throws VALIDATION_ERROR when file type is disallowed", async () => {
    const exeFile = makeFile("malicious.exe", "application/x-msdownload", 1024);
    await expect(uploadDocument("user-1", exeFile)).rejects.toMatchObject({
      type: "VALIDATION_ERROR",
    });
  });

  it("uploads valid PDF metadata and fetches documents list", async () => {
    const validFile = makeFile("resume.pdf", "application/pdf", 2048);
    const doc = await uploadDocument("test-user-docs", validFile, "app-123", "My Resume");

    expect(doc.id).toBeDefined();
    expect(doc.fileName).toBe("resume.pdf");
    expect(doc.displayName).toBe("My Resume");

    const list = await getDocuments("test-user-docs", "app-123");
    expect(list.some((d) => d.id === doc.id)).toBe(true);

    await deleteDocument("test-user-docs", doc.id);
    const afterDelete = await getDocuments("test-user-docs", "app-123");
    expect(afterDelete.some((d) => d.id === doc.id)).toBe(false);
  });
});
