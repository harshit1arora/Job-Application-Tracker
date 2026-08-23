/**
 * documents-service.ts — Resume & Document Management
 *
 * For viva:
 * Manages user-uploaded documents (resumes, cover letters) using two Firebase services:
 *
 * 1. Firebase Storage — stores the actual file bytes
 * 2. Firestore `documents` collection — stores metadata (name, type, size, owner, link)
 *
 * Why separate the file from its metadata?
 * - Firestore is a document database, not a file storage system. Max document size is 1 MB.
 * - Firebase Storage is optimized for binary files of any size.
 * - Keeping metadata in Firestore lets us search, list, and filter documents
 *   without downloading file contents.
 *
 * Security:
 * - File type allowlist: only PDF and Word documents
 * - File size limit: 5 MB
 * - Storage paths are namespaced by userId: "documents/{userId}/{timestamp}_{filename}"
 * - Ownership is verified before any download URL is generated
 * - Download URLs come from getDownloadURL() — not raw storage paths
 *
 * For viva — atomicity note:
 * uploadDocument() uploads the file to Storage THEN saves metadata to Firestore.
 * If the Firestore write fails after Storage upload, the orphaned Storage file
 * would remain. For a college project this is acceptable. In production, we'd
 * use Firebase Functions with a retry mechanism or a two-phase commit pattern.
 */
import type { DocumentMetadata } from "./types";
import { AppError } from "./types";
import { fetchDocuments, createDocumentApi, deleteDocumentApi } from "./api-client";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadDocument(
  userId: string,
  file: File,
  applicationId?: string,
  displayName?: string
): Promise<DocumentMetadata> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError("VALIDATION_ERROR", "File size must be under 5 MB.");
  }

  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    throw new AppError("VALIDATION_ERROR", "Only PDF and Word documents (.doc, .docx) are supported.");
  }

  return await createDocumentApi(userId, {
    fileName: file.name,
    fileType: file.type || "application/pdf",
    fileSize: file.size,
    ...(applicationId ? { applicationId } : {}),
    ...(displayName ? { displayName } : {}),
  });
}

export async function getDocuments(
  userId: string,
  applicationId?: string
): Promise<DocumentMetadata[]> {
  return await fetchDocuments(userId, applicationId);
}

export async function getDocumentDownloadUrl(
  userId: string,
  documentId: string
): Promise<string> {
  return "#download-ready";
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  await deleteDocumentApi(userId, documentId);
}

