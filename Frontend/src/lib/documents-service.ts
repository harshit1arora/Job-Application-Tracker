/**
 * documents-service.ts — Resume & Document Management
 */
import type { DocumentMetadata } from "./types";
import { AppError } from "./types";
import {
  apiRequest,
  apiDownloadRequest,
  deleteDocumentApi,
  shouldUseLocalPersistence,
} from "./api-client";
import { getSafeStorage } from "./storage";

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
  displayName?: string,
): Promise<DocumentMetadata> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError("VALIDATION_ERROR", "File size must be under 5 MB.");
  }

  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Only PDF and Word documents (.doc, .docx) are supported.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  if (applicationId) formData.append("applicationId", applicationId);
  if (displayName) formData.append("displayName", displayName);

  try {
    return await apiRequest<DocumentMetadata>("/documents/upload", userId, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    if (!shouldUseLocalPersistence()) throw error;
    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const doc: DocumentMetadata = {
      id,
      userId,
      applicationId: applicationId ?? null,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storageRef: `local://${id}`,
      displayName: displayName ?? file.name,
      createdAt: new Date().toISOString(),
    };

    const storage = getSafeStorage();
    if (storage) {
      const existing = JSON.parse(storage.getItem(`jobpilot_documents_${userId}`) || "[]");
      storage.setItem(`jobpilot_documents_${userId}`, JSON.stringify([doc, ...existing]));
    }
    return doc;
  }
}

export async function getDocuments(
  userId: string,
  applicationId?: string,
): Promise<DocumentMetadata[]> {
  const qs = applicationId ? `?applicationId=${applicationId}` : "";

  try {
    return await apiRequest<DocumentMetadata[]>(`/documents${qs}`, userId);
  } catch (error) {
    if (!shouldUseLocalPersistence()) throw error;
    const storage = getSafeStorage();
    const raw = storage ? storage.getItem(`jobpilot_documents_${userId}`) || "[]" : "[]";
    const docs = JSON.parse(raw) as DocumentMetadata[];
    return applicationId ? docs.filter((doc) => doc.applicationId === applicationId) : docs;
  }
}

export async function getDocumentDownloadUrl(userId: string, documentId: string): Promise<string> {
  const blob = await apiDownloadRequest(`/documents/${documentId}/download`, userId);
  return window.URL.createObjectURL(blob);
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  try {
    await deleteDocumentApi(userId, documentId);
  } catch (error) {
    if (!shouldUseLocalPersistence()) throw error;
    const storage = getSafeStorage();
    if (!storage) return;
    const raw = storage.getItem(`jobpilot_documents_${userId}`) || "[]";
    const docs = JSON.parse(raw) as DocumentMetadata[];
    storage.setItem(
      `jobpilot_documents_${userId}`,
      JSON.stringify(docs.filter((doc) => doc.id !== documentId)),
    );
  }
}
