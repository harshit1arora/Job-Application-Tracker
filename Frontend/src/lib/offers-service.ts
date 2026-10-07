/**
 * offers-service.ts — Offer CRUD (API first, localStorage in demo/offline mode)
 *
 * Mirrors the pattern used by applications-service / api-client:
 *  - validate with Zod before anything is written
 *  - demo mode (or an unreachable API in production) persists to localStorage
 *  - every query is scoped to the signed-in user
 *
 * Side effect: when an offer is linked to a tracked application and has a decision deadline, a
 * "deadline" reminder is created so it shows up in the Tracker calendar. Reminder failures never
 * block saving the offer.
 */
import { apiRequest, isDemoMode, shouldUseLocalPersistence } from "./api-client";
import { getSafeStorage } from "./storage";
import { createReminder, getReminders } from "./reminders-service";
import { createOfferSchema, updateOfferSchema } from "./validation";
import { AppError } from "./types";
import type {
  CreateOfferInput,
  NegotiationPlan,
  OfferDocument,
  UpdateOfferInput,
} from "./types";

/** Update payload where optional columns may be `null` to clear them. */
export type OfferPatch = Omit<UpdateOfferInput, "location" | "ptoDays" | "deadline" | "notes"> & {
  location?: string | null | undefined;
  ptoDays?: number | null | undefined;
  deadline?: string | null | undefined;
  notes?: string | null | undefined;
};

const OFFER_DEADLINE_MESSAGE = "Offer decision deadline";

function localKey(userId: string) {
  return `jobpilot_offers_${userId}`;
}

function readLocal(userId: string): OfferDocument[] {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(localKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OfferDocument[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(userId: string, offers: OfferDocument[]) {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(localKey(userId), JSON.stringify(offers));
  } catch {
    throw new AppError("SERVER_ERROR", "Could not save offers in this browser.");
  }
}

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (field !== undefined && fields[String(field)] === undefined) fields[String(field)] = issue.message;
  }
  return fields;
}

/** The API serialises missing optionals as null; the UI types use undefined. */
export function normalizeOffer(raw: OfferDocument): OfferDocument {
  const offer = { ...raw } as Record<string, unknown>;
  for (const key of ["applicationId", "location", "ptoDays", "deadline", "notes", "negotiationPlan"]) {
    if (offer[key] === null) delete offer[key];
  }
  return offer as unknown as OfferDocument;
}

function applyPatch(existing: OfferDocument, patch: OfferPatch): OfferDocument {
  const merged = { ...existing, ...patch, updatedAt: new Date().toISOString() } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete merged[key];
  }
  return merged as unknown as OfferDocument;
}

async function withLocalFallback<T>(remote: () => Promise<T>, local: () => T): Promise<T> {
  if (isDemoMode) return local();
  try {
    return await remote();
  } catch (error) {
    // Keep real validation / not-found answers from the API; only fall back when it is unreachable.
    if (error instanceof AppError && (error.type === "VALIDATION_ERROR" || error.type === "NOT_FOUND")) {
      throw error;
    }
    if (shouldUseLocalPersistence()) return local();
    throw error;
  }
}

export async function getOffers(userId: string): Promise<OfferDocument[]> {
  return withLocalFallback(
    async () => {
      const remote = await apiRequest<OfferDocument[]>("/offers", userId);
      if (!Array.isArray(remote)) throw new AppError("SERVER_ERROR", "The server returned an invalid offer list.");
      return remote.map(normalizeOffer);
    },
    () => [...readLocal(userId)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
  );
}

export async function getOffer(userId: string, offerId: string): Promise<OfferDocument | null> {
  try {
    return await withLocalFallback(
      async () => normalizeOffer(await apiRequest<OfferDocument>(`/offers/${offerId}`, userId)),
      () => readLocal(userId).find((o) => o.id === offerId) ?? null,
    );
  } catch (error) {
    if (error instanceof AppError && error.type === "NOT_FOUND") return null;
    throw error;
  }
}

export async function createOffer(userId: string, input: CreateOfferInput): Promise<OfferDocument> {
  const parsed = createOfferSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid offer data", fieldErrors(parsed.error.errors));
  }
  const data = parsed.data as CreateOfferInput;

  const created = await withLocalFallback(
    async () => {
      const offer = await apiRequest<OfferDocument>("/offers", userId, {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!offer || typeof offer.id !== "string") {
        throw new AppError("SERVER_ERROR", "The server returned an invalid offer record.");
      }
      return normalizeOffer(offer);
    },
    () => {
      const now = new Date().toISOString();
      const offer: OfferDocument = {
        ...data,
        id: `offer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        createdAt: now,
        updatedAt: now,
      };
      writeLocal(userId, [offer, ...readLocal(userId)]);
      return offer;
    },
  );

  await syncDeadlineReminder(userId, created);
  return created;
}

export async function updateOffer(
  userId: string,
  offerId: string,
  changes: OfferPatch,
): Promise<OfferDocument> {
  const parsed = updateOfferSchema.safeParse(changes);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid offer data", fieldErrors(parsed.error.errors));
  }
  const patch = parsed.data as OfferPatch;

  const updated = await withLocalFallback(
    async () =>
      normalizeOffer(
        await apiRequest<OfferDocument>(`/offers/${offerId}`, userId, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      ),
    () => {
      const all = readLocal(userId);
      const existing = all.find((o) => o.id === offerId);
      if (!existing) throw new AppError("NOT_FOUND", "Offer not found");
      const next = applyPatch(existing, patch);
      writeLocal(userId, all.map((o) => (o.id === offerId ? next : o)));
      return next;
    },
  );

  if ("deadline" in patch) await syncDeadlineReminder(userId, updated);
  return updated;
}

export async function deleteOffer(userId: string, offerId: string): Promise<void> {
  await withLocalFallback(
    async () => {
      await apiRequest(`/offers/${offerId}`, userId, { method: "DELETE" });
    },
    () => {
      const all = readLocal(userId);
      if (!all.some((o) => o.id === offerId)) throw new AppError("NOT_FOUND", "Offer not found");
      writeLocal(userId, all.filter((o) => o.id !== offerId));
    },
  );
}

// ---------------------------------------------------------------------------
// Saved negotiation plan
// ---------------------------------------------------------------------------

export async function saveNegotiationPlan(
  userId: string,
  offerId: string,
  plan: NegotiationPlan,
): Promise<OfferDocument> {
  return updateOffer(userId, offerId, { negotiationPlan: JSON.stringify(plan) });
}

/** Safely read the saved plan back out of an offer (null if absent or malformed). */
export function parseSavedPlan(offer: Pick<OfferDocument, "negotiationPlan">): NegotiationPlan | null {
  if (!offer.negotiationPlan) return null;
  try {
    const plan = JSON.parse(offer.negotiationPlan) as Partial<NegotiationPlan>;
    if (
      plan &&
      typeof plan.strategy === "string" &&
      plan.counter &&
      typeof plan.counter.target === "number" &&
      plan.email &&
      typeof plan.email.body === "string" &&
      Array.isArray(plan.talkingPoints) &&
      Array.isArray(plan.pushbackResponses) &&
      Array.isArray(plan.risks)
    ) {
      return plan as NegotiationPlan;
    }
  } catch {
    // fall through
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deadline reminder (shows up on the Tracker calendar)
// ---------------------------------------------------------------------------

async function syncDeadlineReminder(userId: string, offer: OfferDocument): Promise<void> {
  if (!offer.applicationId || !offer.deadline) return;
  if (offer.status === "Accepted" || offer.status === "Declined") return;
  try {
    const reminderDate = `${offer.deadline}T09:00`;
    const existing = await getReminders(userId, offer.applicationId);
    const alreadyScheduled = existing.some(
      (r) =>
        r.type === "deadline" &&
        !r.isCompleted &&
        r.reminderDate === reminderDate &&
        (r.message ?? "").startsWith(OFFER_DEADLINE_MESSAGE),
    );
    if (alreadyScheduled) return;
    await createReminder(userId, {
      applicationId: offer.applicationId,
      reminderDate,
      type: "deadline",
      message: `${OFFER_DEADLINE_MESSAGE} — ${offer.company} (${offer.jobTitle})`.slice(0, 500),
    });
  } catch {
    // The reminder is a convenience; never fail the offer save because of it.
  }
}
