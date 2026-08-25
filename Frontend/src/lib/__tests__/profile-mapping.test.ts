import { describe, it, expect } from "vitest";
import { type UserProfile, EMPTY_PROFILE, generateBrowserAutofillScript, getAutofillFieldMap } from "../profile";

describe("Profile Mapping & Autofill Payload", () => {
  it("formats profile payload correctly for autofill field mapping", () => {
    const profile: UserProfile = {
      ...EMPTY_PROFILE,
      fullName: "Alex Carter",
      firstName: "Alex",
      lastName: "Carter",
      email: "alex.carter@example.com",
      phone: "(201) 555-0123",
      country: "United States",
      hybridScheduleOk: "Yes",
      sponsorshipRequired: "No",
      yearsOfExperience: "4+ years",
      currentCompany: "Vercel Partner Co",
      skills: ["React", "TypeScript", "Next.js"],
      linkedin: "https://linkedin.com/in/alexcarter",
      portfolio: "https://github.com/alexcarter",
    };

    const map = getAutofillFieldMap(profile);
    expect(map["First Name"]).toBe("Alex");
    expect(map["Last Name"]).toBe("Carter");
    expect(map["Email"]).toBe("alex.carter@example.com");
    expect(map["Phone"]).toBe("(201) 555-0123");
    expect(map["Country"]).toBe("United States");
    expect(map["Hybrid Availability"]).toBe("Yes");
    expect(map["Visa Sponsorship"]).toBe("No");
  });

  it("produces a valid autofill script payload with query selectors for standard career portals", () => {
    const profile: UserProfile = {
      ...EMPTY_PROFILE,
      fullName: "Tammy Triangle",
      firstName: "Tammy",
      lastName: "Triangle",
      email: "tammytriangle@email.com",
      phone: "(201) 555-0123",
      country: "United States",
      hybridScheduleOk: "Yes",
      sponsorshipRequired: "No",
    };

    const script = generateBrowserAutofillScript(profile);
    expect(script).toContain("Tammy");
    expect(script).toContain("Triangle");
    expect(script).toContain("tammytriangle@email.com");
    expect(script).toContain("United States");
    expect(script).toContain("given-name");
    expect(script).toContain("family-name");
    expect(script).toContain("dispatchEvent");
  });
});
