import { describe, it, expect, beforeEach } from "vitest";
import {
  type UserProfile,
  EMPTY_PROFILE,
  extractFirstAndLastName,
  getProfile,
  saveProfile,
  mergeParsedResumeIntoProfile,
  getMissingProfileFields,
  autofillText,
  getAutofillFieldMap,
  generateBrowserAutofillScript,
} from "../profile";
import type { ParsedResumeProfile } from "../types";

// Mock localStorage for Node environment in Vitest
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: localStorageMock,
  },
  writable: true,
});

describe("Job Application Autofill & Profile Memory Pipeline", () => {
  const testUserId = "user_test_123";

  beforeEach(() => {
    localStorageMock.clear();
  });

  it("extracts first name and last name accurately from full name", () => {
    expect(extractFirstAndLastName("Alex Carter")).toEqual({
      firstName: "Alex",
      lastName: "Carter",
    });
    expect(extractFirstAndLastName("Tammy Triangle")).toEqual({
      firstName: "Tammy",
      lastName: "Triangle",
    });
    expect(extractFirstAndLastName("Cher")).toEqual({
      firstName: "Cher",
      lastName: "",
    });
    expect(extractFirstAndLastName("")).toEqual({
      firstName: "",
      lastName: "",
    });
  });

  it("merges AI-parsed resume data into profile and retains defaults", () => {
    const parsedResume: ParsedResumeProfile = {
      fullName: "Tammy Triangle",
      email: "tammytriangle@email.com",
      phone: "(201) 555-0123",
      city: "San Francisco, CA",
      ageOrExperience: "4+ years",
      targetRole: "Software Engineer, Core DX",
      skills: ["React", "TypeScript", "Next.js", "Node.js"],
      education: "B.S. Computer Science",
      linkedin: "https://linkedin.com/in/tammytriangle",
      portfolio: "https://github.com/tammytriangle",
      summary: "Full stack engineer specializing in developer experience.",
      rawResumeText: "Tammy Triangle. Senior Software Engineer...",
    };

    const initialProfile = getProfile(testUserId);
    const merged = mergeParsedResumeIntoProfile(initialProfile, parsedResume);

    expect(merged.fullName).toBe("Tammy Triangle");
    expect(merged.firstName).toBe("Tammy");
    expect(merged.lastName).toBe("Triangle");
    expect(merged.email).toBe("tammytriangle@email.com");
    expect(merged.phone).toBe("(201) 555-0123");
    expect(merged.skills).toContain("TypeScript");
    expect(merged.skills).toContain("Next.js");
  });

  it("persists empty blanks filled in Application A so Application B automatically reuses them", () => {
    // 1. Initial parsed profile has basic details but empty country / hybrid schedule
    const initial: UserProfile = {
      ...EMPTY_PROFILE,
      fullName: "Alex Carter",
      firstName: "Alex",
      lastName: "Carter",
      email: "alex.carter@example.com",
      phone: "(415) 890-2341",
      country: "", // Empty blank
      hybridScheduleOk: "", // Empty blank
      sponsorshipRequired: "", // Empty blank
    };
    saveProfile(testUserId, initial);

    // Verify initial profile has empty fields
    const loaded1 = getProfile(testUserId);
    expect(loaded1.country).toBe("");

    // 2. User applies to Vercel and fills in the blanks
    const filledInVercelApplication: UserProfile = {
      ...loaded1,
      country: "United States",
      hybridScheduleOk: "Yes",
      sponsorshipRequired: "No",
      yearsOfExperience: "5 years",
      customAnswers: {
        vercel_country: "United States",
        vercel_hybrid_ok: "Yes",
      },
    };
    saveProfile(testUserId, filledInVercelApplication);

    // 3. User now applies to another role (e.g. Stripe / OpenAI).
    // The profile loaded must have ALL previously filled values automatically!
    const loadedForNextJob = getProfile(testUserId);
    expect(loadedForNextJob.firstName).toBe("Alex");
    expect(loadedForNextJob.lastName).toBe("Carter");
    expect(loadedForNextJob.email).toBe("alex.carter@example.com");
    expect(loadedForNextJob.phone).toBe("(415) 890-2341");
    expect(loadedForNextJob.country).toBe("United States");
    expect(loadedForNextJob.hybridScheduleOk).toBe("Yes");
    expect(loadedForNextJob.sponsorshipRequired).toBe("No");
    expect(loadedForNextJob.yearsOfExperience).toBe("5 years");
  });

  it("generates a formatted master autofill bundle and field map", () => {
    const profile: UserProfile = {
      ...EMPTY_PROFILE,
      fullName: "Tammy Triangle",
      firstName: "Tammy",
      lastName: "Triangle",
      email: "tammytriangle@email.com",
      phone: "(201) 555-0123",
      country: "United States",
      location: "San Francisco, CA",
      yearsOfExperience: "4 years",
      targetRole: "Software Engineer",
      skills: ["React", "TypeScript"],
      linkedin: "https://linkedin.com/in/tammytriangle",
      portfolio: "https://github.com/tammytriangle",
    };

    const textBundle = autofillText(profile);
    expect(textBundle).toContain("First Name: Tammy");
    expect(textBundle).toContain("Last Name: Triangle");
    expect(textBundle).toContain("Email: tammytriangle@email.com");
    expect(textBundle).toContain("Phone: (201) 555-0123");
    expect(textBundle).toContain("Country: United States");

    const fieldMap = getAutofillFieldMap(profile);
    expect(fieldMap["First Name"]).toBe("Tammy");
    expect(fieldMap["Last Name"]).toBe("Triangle");
    expect(fieldMap["Email"]).toBe("tammytriangle@email.com");
    expect(fieldMap["Phone"]).toBe("(201) 555-0123");
    expect(fieldMap["Country"]).toBe("United States");
  });

  it("generates a browser autofill script for external career portals", () => {
    const profile: UserProfile = {
      ...EMPTY_PROFILE,
      fullName: "Tammy Triangle",
      firstName: "Tammy",
      lastName: "Triangle",
      email: "tammytriangle@email.com",
      phone: "(201) 555-0123",
      country: "United States",
      hybridScheduleOk: "Yes",
    };

    const script = generateBrowserAutofillScript(profile);
    expect(script).toContain("Tammy");
    expect(script).toContain("tammytriangle@email.com");
    expect(script).toContain("United States");
    expect(script).toContain("JobPilot Autofill");
    expect(script.startsWith("(() => {")).toBe(true);
    expect(script.endsWith("})();")).toBe(true);
  });
});
