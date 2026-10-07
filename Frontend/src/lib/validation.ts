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
import {
  APPLICATION_STATUSES,
  APPLICATION_SOURCES,
  REMINDER_TYPES,
  OFFER_STATUSES,
  WORK_MODES,
  FOLLOWUP_TONES,
  FOLLOWUP_CHANNELS,
} from "./types";

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

  applicationUrl: z
    .string()
    .url("Please enter a valid URL")
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Application URL must use http:// or https://",
    )
    .or(z.literal(""))
    .optional(),

  // Optional fields: if present, must pass the max-length check
  jobDescription: z
    .string()
    .max(5000, "Job description must be 5000 characters or fewer")
    .optional(),

  salaryRange: z.string().max(50, "Salary range must be 50 characters or fewer").optional(),

  location: z.string().max(100, "Location must be 100 characters or fewer").optional(),

  notes: z.string().max(2000, "Notes must be 2000 characters or fewer").optional(),

  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),

  matchScore: z.number().min(0).max(100).optional(),
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

  fileSize: z.number().max(MAX_FILE_SIZE_BYTES, "File size must be 5 MB or smaller"),

  storageRef: z.string().min(1, "Storage reference is required"),

  applicationId: z.string().optional(),
  displayName: z.string().max(100, "Display name must be 100 characters or fewer").optional(),
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

  message: z.string().max(500, "Message must be 500 characters or fewer").optional(),
});

export type CreateReminderData = z.infer<typeof createReminderSchema>;

// ---------------------------------------------------------------------------
// Offer Schemas
// ---------------------------------------------------------------------------

const MONEY_MAX = 1_000_000_000;

const moneyField = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(MONEY_MAX, `${label} is too large`);

const ratingField = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(1, `${label} must be between 1 and 5`)
    .max(5, `${label} must be between 1 and 5`);

export const createOfferSchema = z.object({
  applicationId: z.string().max(100).optional(),
  company: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(100, "Company name must be 100 characters or fewer"),
  jobTitle: z
    .string()
    .trim()
    .min(1, "Job title is required")
    .max(150, "Job title must be 150 characters or fewer"),
  location: z.string().max(100, "Location must be 100 characters or fewer").optional(),
  workMode: z.enum(WORK_MODES, { errorMap: () => ({ message: "Select Remote, Hybrid or On-site" }) }),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code such as USD"),
  baseSalary: moneyField("Base salary").gt(0, "Base salary is required"),
  annualBonus: moneyField("Bonus"),
  signingBonus: moneyField("Signing bonus"),
  equityValue: moneyField("Equity value"),
  equityVestYears: z
    .number({ invalid_type_error: "Vesting period must be a number" })
    .gt(0, "Vesting period must be greater than 0")
    .max(10, "Vesting period must be 10 years or fewer"),
  retirementMatchPct: z
    .number({ invalid_type_error: "Retirement match must be a number" })
    .min(0, "Retirement match cannot be negative")
    .max(100, "Retirement match cannot exceed 100%"),
  otherBenefitsValue: moneyField("Other benefits"),
  ptoDays: z
    .number({ invalid_type_error: "PTO days must be a number" })
    .int("PTO days must be a whole number")
    .min(0, "PTO days cannot be negative")
    .max(366, "PTO days cannot exceed 366")
    .optional(),
  growthRating: ratingField("Growth rating"),
  workLifeRating: ratingField("Work-life rating"),
  cultureRating: ratingField("Culture rating"),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be in YYYY-MM-DD format")
    .optional(),
  status: z.enum(OFFER_STATUSES, { errorMap: () => ({ message: "Select a valid offer status" }) }),
  notes: z.string().max(2000, "Notes must be 2000 characters or fewer").optional(),
});

/**
 * Partial update. The four optional columns accept `null` so a form can clear them
 * (JSON drops `undefined`, so `null` is the only way to tell the API "remove this value").
 */
export const updateOfferSchema = createOfferSchema.partial().extend({
  location: z.string().max(100).nullable().optional(),
  ptoDays: z.number().int().min(0).max(366).nullable().optional(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be in YYYY-MM-DD format")
    .nullable()
    .optional(),
  notes: z.string().max(2000, "Notes must be 2000 characters or fewer").nullable().optional(),
  negotiationPlan: z.string().max(30000).optional(),
});

export type CreateOfferData = z.infer<typeof createOfferSchema>;

// ---------------------------------------------------------------------------
// Follow-up Schemas
// ---------------------------------------------------------------------------

const dayField = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(1, `${label} must be at least 1 day`)
    .max(90, `${label} must be 90 days or fewer`);

export const followUpSettingsSchema = z.object({
  enabled: z.boolean(),
  appliedDays: dayField("Applied threshold"),
  underReviewDays: dayField("Under-review threshold"),
  interviewDays: dayField("Interview threshold"),
  maxFollowUps: z
    .number({ invalid_type_error: "Max follow-ups must be a number" })
    .int("Max follow-ups must be a whole number")
    .min(1, "Max follow-ups must be at least 1")
    .max(10, "Max follow-ups must be 10 or fewer"),
  autoCreateReminders: z.boolean(),
  defaultTone: z.enum(FOLLOWUP_TONES, { errorMap: () => ({ message: "Select a valid tone" }) }),
});

export const createFollowUpLogSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required").max(100),
  channel: z.enum(FOLLOWUP_CHANNELS, { errorMap: () => ({ message: "Select a valid channel" }) }),
  tone: z.string().max(20).optional(),
  subject: z.string().max(200, "Subject must be 200 characters or fewer").optional(),
  body: z.string().max(5000, "Message must be 5000 characters or fewer").optional(),
  note: z.string().max(1000, "Note must be 1000 characters or fewer").optional(),
});
