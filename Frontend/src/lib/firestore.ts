/**
 * firestore.ts — Firestore Database Instance
 *
 * Exports a single `db` reference for all Firestore read/write operations.
 *
 * For viva:
 * Firestore is Firebase's NoSQL cloud database. Unlike a SQL database it
 * stores data as "documents" inside "collections". Each document is a JSON-like
 * object. We use a single top-level collection per entity type (applications,
 * documents, reminders) and enforce ownership with a `userId` field + Firestore
 * Security Rules.
 *
 * Why a separate file:
 * firebase.ts handles Auth and SDK initialization.
 * This file handles the Firestore database instance.
 * Service files import only what they need — clean separation of concerns.
 *
 * Pattern:
 * `db` mirrors the `auth` export in firebase.ts. If Firebase is not configured
 * (no .env file), `db` is null and service functions throw a SERVER_ERROR with
 * a clear message rather than crashing silently.
 */
import { getFirestore } from "firebase/firestore";
import { app } from "./firebase";

// getFirestore(app) returns the Firestore instance for our Firebase project.
// If app is null (Firebase not configured), db is null — service functions
// check for this with: if (!db) throw new AppError("SERVER_ERROR", "...")
export const db = app ? getFirestore(app) : (null as any);
