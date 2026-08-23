import { describe, it, expect } from "vitest";
import { parseResumeWithAi, suggestJobsForResume } from "../ai";
import { SAMPLE_RESUME_PRESET, cleanExtractedText } from "../resume-parser";
import { getMissingProfileFields, mergeParsedResumeIntoProfile, EMPTY_PROFILE, getAutofillFieldMap } from "../profile";
import { CURATED_JOBS_CATALOG } from "../jobs-catalog";

describe("Resume AI Pipeline & Missing Field Detector", () => {
  it("parses candidate resume text into structured fields", async () => {
    const parsed = await parseResumeWithAi(SAMPLE_RESUME_PRESET);

    expect(parsed.fullName).toContain("Alex Carter");
    expect(parsed.email).toBe("alex.carter@example.com");
    expect(parsed.phone).toContain("890-2341");
    expect(parsed.city).toContain("San Francisco");
    expect(parsed.skills.length).toBeGreaterThanOrEqual(4);
    expect(parsed.skills).toContain("React");
    expect(parsed.skills).toContain("TypeScript");
  });

  it("identifies missing critical fields in incomplete profiles", () => {
    const incomplete = {
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "",
      location: "",
      targetRole: "",
      skills: [],
    };

    const missing = getMissingProfileFields(incomplete);
    expect(missing).toContain("Phone Number");
    expect(missing).toContain("City / Location");
    expect(missing).toContain("Experience / Age");
    expect(missing).toContain("Target Role");
    expect(missing).toContain("Key Skills");
  });

  it("merges parsed resume into user profile accurately", async () => {
    const parsed = await parseResumeWithAi(SAMPLE_RESUME_PRESET);
    const merged = mergeParsedResumeIntoProfile(EMPTY_PROFILE, parsed);

    expect(merged.fullName).toBe("Alex Carter");
    expect(merged.email).toBe("alex.carter@example.com");
    expect(merged.phone).toContain("890-2341");
    expect(merged.skills).toContain("React");

    const fieldMap = getAutofillFieldMap(merged);
    expect(fieldMap["Full Name"]).toBe("Alex Carter");
    expect(fieldMap["First Name"]).toBe("Alex");
    expect(fieldMap["Last Name"]).toBe("Carter");
    expect(fieldMap["Email"]).toBe("alex.carter@example.com");
  });

  it("matches and ranks suggested jobs based on candidate skills and role", async () => {
    const parsed = await parseResumeWithAi(SAMPLE_RESUME_PRESET);
    const rankedJobs = await suggestJobsForResume(parsed, CURATED_JOBS_CATALOG);

    expect(rankedJobs.length).toBeGreaterThan(0);
    expect(rankedJobs[0]!.matchScore).toBeGreaterThanOrEqual(75);
  });

  it("sanitizes garbled binary stream text into clean strings", () => {
    const garbled = "t äÇÀ¨`g@%âSÉFÝØX0&Y IÜñ`¤¾IòºÒ_ÿHµUAÿrÕÌØþÅ¨uÆÜñc×ó3ûò¥ú:åbö·½CïÕaÊµýÔ\nAlex Carter\nSenior Software Engineer\nEmail: alex@example.com";
    const cleaned = cleanExtractedText(garbled);
    expect(cleaned).toContain("Alex Carter");
    expect(cleaned).toContain("Senior Software Engineer");
  });
});
