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

import type { ParsedResumeProfile } from "./types";

export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  city?: string | undefined;
  ageOrExperience?: string | undefined; // e.g. "25 yrs / 3+ YOE"
  targetRole?: string | undefined;
  skills?: string[] | undefined;
  education?: string | undefined;
  linkedin: string;
  portfolio: string;
  resumeText: string;
  summary?: string | undefined;
}

export const EMPTY_PROFILE: UserProfile = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  city: "",
  ageOrExperience: "",
  targetRole: "",
  skills: [],
  education: "",
  linkedin: "",
  portfolio: "",
  resumeText: "",
  summary: "",
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

/** Merges AI-parsed resume data into profile */
export function mergeParsedResumeIntoProfile(current: UserProfile, parsed: ParsedResumeProfile): UserProfile {
  return {
    ...current,
    fullName: parsed.fullName || current.fullName,
    email: parsed.email || current.email,
    phone: parsed.phone || current.phone,
    location: parsed.city || current.location,
    city: parsed.city || current.city || current.location,
    ageOrExperience: parsed.ageOrExperience || current.ageOrExperience,
    targetRole: parsed.targetRole || current.targetRole,
    skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : (current.skills || []),
    education: parsed.education || current.education,
    linkedin: parsed.linkedin || current.linkedin,
    portfolio: parsed.portfolio || current.portfolio,
    resumeText: parsed.rawResumeText || current.resumeText,
    summary: parsed.summary || current.summary,
  };
}

/** Detects empty or incomplete critical fields for job applications */
export function getMissingProfileFields(p: Partial<UserProfile>): string[] {
  const missing: string[] = [];
  if (!p.fullName?.trim()) missing.push("Full Name");
  if (!p.email?.trim()) missing.push("Email Address");
  if (!p.phone?.trim()) missing.push("Phone Number");
  if (!p.location?.trim() && !p.city?.trim()) missing.push("City / Location");
  if (!p.ageOrExperience?.trim()) missing.push("Experience / Age");
  if (!p.targetRole?.trim()) missing.push("Target Role");
  if (!p.skills || p.skills.length === 0) missing.push("Key Skills");
  return missing;
}

/** Generates clean master text for 1-click clipboard autofill */
export function autofillText(p: UserProfile): string {
  return [
    p.fullName && `Full Name: ${p.fullName}`,
    p.email && `Email: ${p.email}`,
    p.phone && `Phone: ${p.phone}`,
    (p.city || p.location) && `City/Location: ${p.city || p.location}`,
    p.ageOrExperience && `Experience/Age: ${p.ageOrExperience}`,
    p.targetRole && `Target Role: ${p.targetRole}`,
    p.skills && p.skills.length > 0 && `Key Skills: ${p.skills.join(", ")}`,
    p.education && `Education: ${p.education}`,
    p.linkedin && `LinkedIn: ${p.linkedin}`,
    p.portfolio && `Portfolio: ${p.portfolio}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Formatted dictionary of fields for individual 1-click copy helpers */
export function getAutofillFieldMap(p: UserProfile): Record<string, string> {
  return {
    "Full Name": p.fullName || "",
    "First Name": p.fullName ? p.fullName.split(" ")[0] || "" : "",
    "Last Name": p.fullName ? p.fullName.split(" ").slice(1).join(" ") || "" : "",
    "Email": p.email || "",
    "Phone": p.phone || "",
    "City / Location": p.city || p.location || "",
    "Experience / Age": p.ageOrExperience || "",
    "Target Role": p.targetRole || "",
    "Key Skills": (p.skills || []).join(", "),
    "Education": p.education || "",
    "LinkedIn URL": p.linkedin || "",
    "Portfolio / GitHub": p.portfolio || "",
  };
}
