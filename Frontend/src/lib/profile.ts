/**
 * profile.ts — the user's résumé + contact details.
 *
 * Stored in localStorage, keyed per Firebase UID. This avoids adding a new
 * Firestore collection + security rules for what is, for now, single-device
 * demo data. Used by two features:
 *   - dashboard match scoring (résumé text ↔ job description)
 *   - autofill (copy contact details into a career-portal form)
 *
 * ponytail: localStorage means the résumé does not sync across devices.
 * Move to a Firestore `profiles/{uid}` doc when cross-device sync matters.
 */

export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
  resumeText: string;
}

export const EMPTY_PROFILE: UserProfile = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  portfolio: "",
  resumeText: "",
};

const storageKey = (uid: string) => `jobpilot:profile:${uid}`;

export function getProfile(uid: string): UserProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE; // SSR guard
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Partial<UserProfile>) };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function saveProfile(uid: string, profile: UserProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(uid), JSON.stringify(profile));
}

/** Plain-text block for pasting into a job application form (autofill MVP). */
export function autofillText(p: UserProfile): string {
  return [
    p.fullName && `Name: ${p.fullName}`,
    p.email && `Email: ${p.email}`,
    p.phone && `Phone: ${p.phone}`,
    p.location && `Location: ${p.location}`,
    p.linkedin && `LinkedIn: ${p.linkedin}`,
    p.portfolio && `Portfolio: ${p.portfolio}`,
  ]
    .filter(Boolean)
    .join("\n");
}
