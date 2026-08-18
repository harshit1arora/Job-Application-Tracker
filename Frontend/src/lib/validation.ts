/**
 * validation.ts — Runtime Validation Schemas
 *
 * For viva:
 * TypeScript types are compile-time only — they disappear when the code runs
 * in the browser. Zod schemas validate data at RUNTIME, ensuring no invalid
 * data reaches Firestore even if the frontend sends malformed requests.
 *
 * Zod is already installed: "zod": "^3.24.2" in package.json.
 *
 * Pattern:
 *   const result = schema.safeParse(input);
 *   if (!result.success) { throw validation error }
 *   // result.data is now safe to write to Firestore
 *
 * Why we also get TypeScript types from Zod:
 *   z.infer<typeof schema> extracts the TypeScript type from the schema
 *   so we don't have to define the same shape twice.
 */
import { z } from "zod";
import { APPLICATION_STATUSES, APPLICATION_SOURCES, REMINDER_TYPES } from "./types";

// ---------------------------------------------------------------------------
// Application Schemas
// ---------------------------------------------------------------------------

export const createApplicationSchema = z.object({
  company: z
    .string()
    .min(1, "Company name is required")
    .max(100, "Company name must be 100 characters or fewer"),

  jobTitle: z
    .string()
    .min(1, "Job title is required")
    .max(150, "Job title must be 150 characters or fewer"),

  applicationSource: z.enum(APPLICATION_SOURCES, {
    errorMap: () => ({ message: "Please select a valid application source" }),
  }),

  status: z.enum(APPLICATION_STATUSES, {
    errorMap: () => ({ message: "Please select a valid application status" }),
  }),

  // Optional fields: if present, must pass the max-length check
  jobDescription: z
    .string()
    .max(5000, "Job description must be 5000 characters or fewer")
    .optional(),

  salaryRange: z
    .string()
    .max(50, "Salary range must be 50 characters or fewer")
    .optional(),

  location: z
    .string()
    .max(100, "Location must be 100 characters or fewer")
    .optional(),

  notes: z
    .string()
    .max(2000, "Notes must be 2000 characters or fewer")
    .optional(),

  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
});

// Partial schema for updates — every field becomes optional.
// Only the fields present in the update payload are written to Firestore.
export const updateApplicationSchema = createApplicationSchema.partial();

// Inferred TypeScript types (used internally in service functions)
export type CreateApplicationData = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationData = z.infer<typeof updateApplicationSchema>;

// ---------------------------------------------------------------------------
// Document Schema
// ---------------------------------------------------------------------------

/** Allowed MIME types for document uploads. */
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** Maximum allowed file size: 5 MB */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const createDocumentSchema = z.object({
  fileName: z.string().min(1, "File name is required").max(255),

  fileType: z.enum(ALLOWED_FILE_TYPES, {
    errorMap: () => ({
      message: "Only PDF and Word documents (.doc, .docx) are supported",
    }),
  }),

  fileSize: z
    .number()
    .max(MAX_FILE_SIZE_BYTES, "File size must be 5 MB or smaller"),

  storageRef: z.string().min(1, "Storage reference is required"),

  applicationId: z.string().optional(),
  displayName: z
    .string()
    .max(100, "Display name must be 100 characters or fewer")
    .optional(),
});

export type CreateDocumentData = z.infer<typeof createDocumentSchema>;

// ---------------------------------------------------------------------------
// Reminder Schema
// ---------------------------------------------------------------------------

export const createReminderSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),

  reminderDate: z.string().min(1, "Reminder date is required"),

  type: z.enum(REMINDER_TYPES, {
    errorMap: () => ({ message: "Please select a valid reminder type" }),
  }),

  message: z
    .string()
    .max(500, "Message must be 500 characters or fewer")
    .optional(),
});

export type CreateReminderData = z.infer<typeof createReminderSchema>;
