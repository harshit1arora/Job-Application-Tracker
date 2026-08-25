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
  firstName?: string | undefined;
  lastName?: string | undefined;
  email: string;
  phone: string;
  countryCode?: string | undefined;
  country?: string | undefined;
  location: string;
  city?: string | undefined;
  address?: string | undefined;
  ageOrExperience?: string | undefined; // e.g. "25 yrs / 3+ YOE"
  yearsOfExperience?: string | undefined;
  targetRole?: string | undefined;
  currentCompany?: string | undefined;
  currentTitle?: string | undefined;
  noticePeriod?: string | undefined;
  workAuthorization?: string | undefined; // e.g. "Authorized to work in US/UK/India"
  sponsorshipRequired?: string | undefined; // "Yes" | "No"
  hybridScheduleOk?: string | undefined; // "Yes" | "No"
  relocationOk?: string | undefined; // "Yes" | "No"
  skills?: string[] | undefined;
  education?: string | undefined;
  linkedin: string;
  portfolio: string;
  github?: string | undefined;
  twitter?: string | undefined;
  resumeText: string;
  resumeFileName?: string | undefined;
  summary?: string | undefined;
  customAnswers?: Record<string, string> | undefined;
}

export const EMPTY_PROFILE: UserProfile = {
  fullName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  countryCode: "+1",
  country: "United States",
  location: "",
  city: "",
  address: "",
  ageOrExperience: "",
  yearsOfExperience: "3+ years",
  targetRole: "",
  currentCompany: "",
  currentTitle: "",
  noticePeriod: "Immediate / 2 weeks",
  workAuthorization: "Authorized to work in country",
  sponsorshipRequired: "No",
  hybridScheduleOk: "Yes",
  relocationOk: "Yes",
  skills: [],
  education: "",
  linkedin: "",
  portfolio: "",
  github: "",
  twitter: "",
  resumeText: "",
  resumeFileName: "Alex_Carter_Resume.pdf",
  summary: "",
  customAnswers: {},
};

const storageKey = (uid: string) => `jobpilot:profile:${uid}`;

export function extractFirstAndLastName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName || !fullName.trim()) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] || "", lastName: "" };
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

export function getProfile(uid: string): UserProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE; // SSR guard
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return EMPTY_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const names = extractFirstAndLastName(parsed.fullName || "");
    return {
      ...EMPTY_PROFILE,
      ...parsed,
      firstName: parsed.firstName || names.firstName,
      lastName: parsed.lastName || names.lastName,
      customAnswers: parsed.customAnswers || {},
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function saveProfile(uid: string, profile: UserProfile): void {
  if (typeof window === "undefined") return;
  const names = extractFirstAndLastName(profile.fullName || `${profile.firstName || ""} ${profile.lastName || ""}`.trim());
  const updated: UserProfile = {
    ...profile,
    firstName: profile.firstName || names.firstName,
    lastName: profile.lastName || names.lastName,
    fullName: profile.fullName || `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
  };
  window.localStorage.setItem(storageKey(uid), JSON.stringify(updated));
}

/** Merges AI-parsed resume data into profile */
export function mergeParsedResumeIntoProfile(current: UserProfile, parsed: ParsedResumeProfile): UserProfile {
  const fullName = parsed.fullName || current.fullName;
  const names = extractFirstAndLastName(fullName);
  return {
    ...current,
    fullName,
    firstName: names.firstName || current.firstName,
    lastName: names.lastName || current.lastName,
    email: parsed.email || current.email,
    phone: parsed.phone || current.phone,
    location: parsed.city || current.location,
    city: parsed.city || current.city || current.location,
    ageOrExperience: parsed.ageOrExperience || current.ageOrExperience,
    yearsOfExperience: parsed.ageOrExperience || current.yearsOfExperience || "3+ years",
    targetRole: parsed.targetRole || current.targetRole,
    skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : (current.skills || []),
    education: parsed.education || current.education,
    linkedin: parsed.linkedin || current.linkedin,
    portfolio: parsed.portfolio || current.portfolio,
    github: current.github || (parsed.portfolio?.includes("github.com") ? parsed.portfolio : ""),
    resumeText: parsed.rawResumeText || current.resumeText,
    summary: parsed.summary || current.summary,
    customAnswers: current.customAnswers || {},
  };
}

/** Detects empty or incomplete critical fields for job applications */
export function getMissingProfileFields(p: Partial<UserProfile>): string[] {
  const missing: string[] = [];
  if (!p.fullName?.trim() && (!p.firstName?.trim() || !p.lastName?.trim())) missing.push("Full Name");
  if (!p.email?.trim()) missing.push("Email Address");
  if (!p.phone?.trim()) missing.push("Phone Number");
  if (!p.country?.trim()) missing.push("Country");
  if (!p.location?.trim() && !p.city?.trim()) missing.push("City / Location");
  if (!p.ageOrExperience?.trim() && !p.yearsOfExperience?.trim()) missing.push("Experience / Age");
  if (!p.targetRole?.trim()) missing.push("Target Role");
  if (!p.skills || p.skills.length === 0) missing.push("Key Skills");
  return missing;
}

/** Generates clean master text for 1-click clipboard autofill */
export function autofillText(p: UserProfile): string {
  const names = extractFirstAndLastName(p.fullName);
  const firstName = p.firstName || names.firstName;
  const lastName = p.lastName || names.lastName;

  return [
    `Full Name: ${p.fullName || `${firstName} ${lastName}`.trim()}`,
    firstName && `First Name: ${firstName}`,
    lastName && `Last Name: ${lastName}`,
    p.email && `Email: ${p.email}`,
    p.phone && `Phone: ${p.phone}`,
    p.country && `Country: ${p.country}`,
    (p.city || p.location) && `City/Location: ${p.city || p.location}`,
    (p.yearsOfExperience || p.ageOrExperience) && `Experience: ${p.yearsOfExperience || p.ageOrExperience}`,
    p.targetRole && `Target Role: ${p.targetRole}`,
    p.currentCompany && `Current Company: ${p.currentCompany}`,
    p.noticePeriod && `Notice Period: ${p.noticePeriod}`,
    p.sponsorshipRequired && `Requires Sponsorship: ${p.sponsorshipRequired}`,
    p.hybridScheduleOk && `Hybrid Schedule OK: ${p.hybridScheduleOk}`,
    p.skills && p.skills.length > 0 && `Key Skills: ${p.skills.join(", ")}`,
    p.education && `Education: ${p.education}`,
    p.linkedin && `LinkedIn: ${p.linkedin}`,
    p.portfolio && `Portfolio: ${p.portfolio}`,
    p.github && `GitHub: ${p.github}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Formatted dictionary of fields for individual 1-click copy helpers */
export function getAutofillFieldMap(p: UserProfile): Record<string, string> {
  const names = extractFirstAndLastName(p.fullName);
  return {
    "Full Name": p.fullName || "",
    "First Name": p.firstName || names.firstName || "",
    "Last Name": p.lastName || names.lastName || "",
    "Email": p.email || "",
    "Phone": p.phone || "",
    "Country": p.country || "United States",
    "City / Location": p.city || p.location || "",
    "Experience": p.yearsOfExperience || p.ageOrExperience || "",
    "Target Role": p.targetRole || "",
    "Current Company": p.currentCompany || "",
    "Notice Period": p.noticePeriod || "",
    "Visa Sponsorship": p.sponsorshipRequired || "No",
    "Hybrid Availability": p.hybridScheduleOk || "Yes",
    "Key Skills": (p.skills || []).join(", "),
    "Education": p.education || "",
    "LinkedIn URL": p.linkedin || "",
    "Portfolio URL": p.portfolio || "",
    "GitHub URL": p.github || "",
  };
}

/**
 * Generates an executable JavaScript snippet / bookmarklet that can be run
 * on external career portals (Vercel, Greenhouse, Ashby, Lever, Workday)
 * to automatically detect and fill all input fields with the user's profile details.
 */
export function generateBrowserAutofillScript(p: UserProfile): string {
  const names = extractFirstAndLastName(p.fullName);
  const data = {
    firstName: p.firstName || names.firstName || "",
    lastName: p.lastName || names.lastName || "",
    fullName: p.fullName || `${names.firstName} ${names.lastName}`.trim(),
    email: p.email || "",
    phone: p.phone || "",
    country: p.country || "United States",
    city: p.city || p.location || "",
    linkedin: p.linkedin || "",
    portfolio: p.portfolio || "",
    github: p.github || "",
    experience: p.yearsOfExperience || p.ageOrExperience || "",
    currentCompany: p.currentCompany || "",
    sponsorship: p.sponsorshipRequired || "No",
    hybrid: p.hybridScheduleOk || "Yes",
  };

  return `(() => {
  const data = ${JSON.stringify(data)};
  let count = 0;

  const setVal = (el, val) => {
    if (!el || !val) return;
    el.focus();
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    count++;
  };

  const selectors = {
    firstName: ['input[name*="first" i]', 'input[id*="first" i]', 'input[autocomplete="given-name"]', 'input[placeholder*="First Name" i]'],
    lastName: ['input[name*="last" i]', 'input[id*="last" i]', 'input[autocomplete="family-name"]', 'input[placeholder*="Last Name" i]'],
    fullName: ['input[name*="name" i]:not([name*="first" i]):not([name*="last" i])', 'input[id*="name" i]:not([id*="first" i]):not([id*="last" i])', 'input[autocomplete="name"]'],
    email: ['input[type="email"]', 'input[name*="email" i]', 'input[id*="email" i]', 'input[placeholder*="email" i]'],
    phone: ['input[type="tel"]', 'input[name*="phone" i]', 'input[id*="phone" i]', 'input[placeholder*="phone" i]'],
    city: ['input[name*="city" i]', 'input[name*="location" i]', 'input[id*="location" i]'],
    linkedin: ['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[placeholder*="linkedin" i]'],
    portfolio: ['input[name*="portfolio" i]', 'input[name*="website" i]', 'input[name*="url" i]'],
    github: ['input[name*="github" i]', 'input[id*="github" i]'],
  };

  for (const [key, patterns] of Object.entries(selectors)) {
    const val = data[key];
    if (!val) continue;
    for (const pat of patterns) {
      const el = document.querySelector(pat);
      if (el && !el.value) {
        setVal(el, val);
        break;
      }
    }
  }

  // Radio button / country / hybrid selectors
  document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
    const label = input.closest('label')?.textContent || input.parentElement?.textContent || '';
    if (data.country && label.toLowerCase().includes(data.country.toLowerCase())) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      count++;
    }
    if (data.hybrid === 'Yes' && (label.toLowerCase().includes('yes') && (label.toLowerCase().includes('hybrid') || label.toLowerCase().includes('london')))) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      count++;
    }
  });

  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;background:#10b981;color:#fff;padding:12px 20px;border-radius:12px;font-family:sans-serif;font-weight:bold;box-shadow:0 10px 25px rgba(0,0,0,0.3);';
  toast.textContent = '✨ JobPilot Autofill: ' + count + ' fields filled!';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
})();`;
}

