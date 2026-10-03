/**
 * documents-service.ts — Resume & Document Management
 */
import type { DocumentMetadata } from "./types";
import { AppError } from "./types";
import { apiRequest, deleteDocumentApi } from "./api-client";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const API_BASE = (import.meta.env["VITE_API_URL"] as string | undefined) || "/api";

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

  const formData = new FormData();
  formData.append("file", file);
  if (applicationId) formData.append("applicationId", applicationId);
  if (displayName) formData.append("displayName", displayName);

  return await apiRequest<DocumentMetadata>("/documents/upload", userId, {
    method: "POST",
    body: formData,
  });
}

export async function getDocuments(
  userId: string,
  applicationId?: string
): Promise<DocumentMetadata[]> {
  const qs = applicationId ? `?applicationId=${applicationId}` : "";
  return await apiRequest<DocumentMetadata[]>(`/documents${qs}`, userId);
}

export async function getDocumentDownloadUrl(
  userId: string,
  documentId: string
): Promise<string> {
  // Returns a URL that the browser can visit or fetch to get the actual file content.
  // Because the endpoint requires authentication, we could pass a short-lived token in URL, 
  // but for simplicity, we return the endpoint path. The UI might need to fetch this using 
  // apiRequest and create an object URL. Let's just return the URL, and the UI can handle it.
  // If the UI uses an anchor tag <a href>, we'll need a mechanism for it. Let's assume the UI
  // uses the fetch approach, or we append userId in query params (not ideal but works for this scope).
  return `${API_BASE}/documents/${documentId}/download?userId=${userId}`;
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  await deleteDocumentApi(userId, documentId);
}
