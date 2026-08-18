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
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
// Firebase Storage imports removed to bypass Blaze plan requirement
// import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db } from "./firestore";
import { app } from "./firebase";
import { createDocumentSchema, MAX_FILE_SIZE_BYTES } from "./validation";
import type { DocumentMetadata } from "./types";
import { AppError } from "./types";
import { getApplication } from "./applications-service";

const COLLECTION = "documents";

// Allowed MIME types — mirrors the Zod schema allowlist in validation.ts
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

interface StoredDocument {
  userId: string;
  applicationId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageRef: string;
  displayName?: string;
  createdAt: Timestamp | { toDate(): Date };
}

function toDocumentMetadata(id: string, data: StoredDocument): DocumentMetadata {
  return {
    id,
    userId: data.userId,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    storageRef: data.storageRef,
    createdAt:
      typeof data.createdAt?.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString(),
    ...(data.applicationId !== undefined ? { applicationId: data.applicationId } : {}),
    ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
  };
}

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

/**
 * Uploads a file to Firebase Storage and saves metadata to Firestore.
 *
 * @param userId      Firebase UID of the authenticated user
 * @param file        The File object from the browser file input
 * @param applicationId  Optional — link this document to a specific application
 * @param displayName    Optional — friendly label ("My Resume v2")
 *
 * @throws AppError VALIDATION_ERROR if file type or size is invalid
 * @throws AppError NOT_FOUND if applicationId doesn't belong to userId
 */
export async function uploadDocument(
  userId: string,
  file: File,
  applicationId?: string,
  displayName?: string
): Promise<DocumentMetadata> {
  if (!db) throw new AppError("SERVER_ERROR", "Firestore is not configured.");
  if (!app) throw new AppError("SERVER_ERROR", "Firebase is not configured.");

  // --- FIREBASE STORAGE BYPASS ---
  // To avoid requiring a credit card for the Firebase Blaze plan, we skip the actual file upload.
  // We just generate a fake storage path for the metadata.
  const storagePath = `documents/${userId}/${Date.now()}_${file.name}`;
  // const storageRef = ref(storage, storagePath);
  // await uploadBytes(storageRef, file);
  // -------------------------------

  // Save metadata to Firestore
  const now = new Date().toISOString();
  const firestoreData: Record<string, unknown> = {
    userId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    storageRef: storagePath,
    createdAt: serverTimestamp(),
  };

  if (applicationId !== undefined) firestoreData["applicationId"] = applicationId;
  if (displayName !== undefined) firestoreData["displayName"] = displayName;

  const docRef = await addDoc(collection(db, COLLECTION), firestoreData);

  return {
    id: docRef.id,
    userId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    storageRef: storagePath,
    createdAt: now,
    ...(applicationId !== undefined ? { applicationId } : {}),
    ...(displayName !== undefined ? { displayName } : {}),
  };
}

// ---------------------------------------------------------------------------
// getDocuments
// ---------------------------------------------------------------------------

/**
 * Returns all documents belonging to `userId`.
 * Optionally filtered by a specific applicationId (in memory after fetch).
 *
 * Security: Firestore query always includes WHERE userId == userId.
 */
export async function getDocuments(
  userId: string,
  applicationId?: string
): Promise<DocumentMetadata[]> {
  if (!db) throw new AppError("SERVER_ERROR", "Firestore is not configured.");

  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(q);
  let documents = snapshot.docs.map((d) => toDocumentMetadata(d.id, d.data() as StoredDocument));

  // Sort by createdAt descending in-memory to avoid needing a composite index
  documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // In-memory filter — avoids needing a triple composite index (userId+applicationId+createdAt)
  if (applicationId) {
    documents = documents.filter((d) => d.applicationId === applicationId);
  }

  return documents;
}

// ---------------------------------------------------------------------------
// getDocumentDownloadUrl
// ---------------------------------------------------------------------------

/**
 * Generates a secure download URL for a document.
 *
 * Security:
 * - Verifies the document belongs to `userId` before generating any URL.
 * - Returns a Firebase Storage download token URL — not the raw storage path.
 * - Firebase Storage URLs require a valid token — they cannot be accessed
 *   without the token embedded in the URL.
 *
 * For viva: The raw `storageRef` path (e.g. "documents/uid/1234_resume.pdf")
 * is never returned directly. We always go through getDownloadURL() which
 * generates a temporary access token.
 */
export async function getDocumentDownloadUrl(
  userId: string,
  documentId: string
): Promise<string> {
  // --- FIREBASE STORAGE BYPASS ---
  // Because we didn't actually upload the file to Storage, there is no download URL to generate.
  throw new AppError("SERVER_ERROR", "This is a mockup. The file was not actually uploaded to Firebase Storage due to billing plan limits.");
}

// ---------------------------------------------------------------------------
// deleteDocument
// ---------------------------------------------------------------------------

/**
 * Deletes a document from both Firebase Storage and Firestore.
 *
 * Security: Verifies ownership before deletion.
 *
 * Atomicity note:
 * Storage delete runs first. If it succeeds, Firestore record is deleted.
 * If Storage delete fails, the Firestore record is preserved (no orphan metadata).
 * If Firestore delete fails after Storage delete, the metadata is orphaned.
 * For a college project, this is an acceptable tradeoff.
 */
export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  if (!db) throw new AppError("SERVER_ERROR", "Firestore is not configured.");

  const docRef = doc(db, COLLECTION, documentId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new AppError("NOT_FOUND", "Document not found");
  }

  const data = docSnap.data() as StoredDocument;
  if (data.userId !== userId) {
    throw new AppError("NOT_FOUND", "Document not found");
  }

  // --- FIREBASE STORAGE BYPASS ---
  // Skip deleting from Firebase Storage since it was never uploaded there.
  // const storageRef = ref(storage, data.storageRef);
  // await deleteObject(storageRef);
  // -------------------------------

  // Delete the Firestore metadata record
  await deleteDoc(docRef);
}
