import { describe, it, expect } from "vitest";
import { parseResumeWithAi, suggestJobsForResume } from "../ai";
import { SAMPLE_RESUME_PRESET, cleanExtractedText } from "../resume-parser";
import {
  getMissingProfileFields,
  mergeParsedResumeIntoProfile,
  EMPTY_PROFILE,
  getAutofillFieldMap,
} from "../profile";
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
    const garbled =
      "t äÇÀ¨`g@%âSÉFÝØX0&Y IÜñ`¤¾IòºÒ_ÿHµUAÿrÕÌØþÅ¨uÆÜñc×ó3ûò¥ú:åbö·½CïÕaÊµýÔ\nAlex Carter\nSenior Software Engineer\nEmail: alex@example.com";
    const cleaned = cleanExtractedText(garbled);
    expect(cleaned).toContain("Alex Carter");
    expect(cleaned).toContain("Senior Software Engineer");
  });
});

describe("AI Resume Schema Validation & Fallback Robustness (P1-D)", () => {
  it("validates a completely valid AI resume response", async () => {
    const { aiResumeProfileSchema } = await import("../ai");
    const validAiOutput = {
      fullName: "Sarah Connor",
      email: "sarah@skynet-defense.com",
      phone: "+1 555 123 4567",
      city: "Los Angeles, CA",
      ageOrExperience: "8+ Years Experience",
      targetRole: "Security Operations Engineer",
      skills: ["Cybersecurity", "Network Architecture", "Python"],
      education: "BS Computer Science, UCLA",
      linkedin: "https://linkedin.com/in/sarahconnor",
      portfolio: "https://github.com/sarahconnor",
      summary: "Experienced security operations leader.",
    };

    const result = aiResumeProfileSchema.safeParse(validAiOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Sarah Connor");
      expect(result.data.skills).toEqual(["Cybersecurity", "Network Architecture", "Python"]);
    }
  });

  it("coerces comma-separated skills string into a typed string array", async () => {
    const { aiResumeProfileSchema } = await import("../ai");
    const aiOutputWithSkillsString = {
      fullName: "John Doe",
      email: "john@example.com",
      skills: "Python, JavaScript, Docker, Kubernetes",
    };

    const result = aiResumeProfileSchema.safeParse(aiOutputWithSkillsString);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.skills)).toBe(true);
      expect(result.data.skills).toEqual(["Python", "JavaScript", "Docker", "Kubernetes"]);
    }
  });

  it("safely handles missing optional fields with defaults", async () => {
    const { aiResumeProfileSchema } = await import("../ai");
    const minimalOutput = {
      fullName: "Minimal Dev",
    };

    const result = aiResumeProfileSchema.safeParse(minimalOutput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Minimal Dev");
      expect(result.data.email).toBe("");
      expect(result.data.skills).toEqual([]);
      expect(result.data.linkedin).toBe("");
    }
  });

  it("activates deterministic parser when AI returns malformed JSON or is unavailable", async () => {
    const rawText =
      "Taylor Smith\nSoftware Developer\nEmail: taylor.smith@devmail.com\nPhone: (555) 789-0123\nSkills: Go, Kubernetes, Terraform\nSan Francisco, CA";
    const parsed = await parseResumeWithAi(rawText);

    expect(parsed).toBeDefined();
    expect(parsed.email).toBe("taylor.smith@devmail.com");
    expect(parsed.phone).toBe("(555) 789-0123");
    expect(parsed.fullName).toContain("Taylor");
  });

  it("accurately parses complete candidate resume with location, full LinkedIn, projects, and skills", async () => {
    const resume = `
KARTIKEY TIWARI
New Delhi, India | +91 9717569478 | tiwarikartikey03@gmail.com
linkedin.com/in/kartikeytiwari10 | github.com/KartikeyT10

PROFESSIONAL SUMMARY
Computer Science undergraduate at VIT Bhopal with hands-on experience across frontend development and applied machine learning. Shipped React.js/Python projects and placed in national-level hackathons.

EDUCATION
B.Tech, Computer Science - VIT Bhopal University 2027 (expected)

TECHNICAL SKILLS
Languages: Python, C++, JavaScript (ES6), SQL
Web Development: React.js, HTML5, CSS3, Bootstrap, Tailwind CSS, REST API integration, Axios
Databases: MySQL, SQL
Tools: Git, GitHub, VS Code, Jupyter Notebook

PROJECTS UNDERTAKEN
Smart Parking Management Application — Frontend (UI) | HTML · CSS · JavaScript · REST API Integration | github.com/KartikeyT10/Java-Smart-Parking-Management-Application
• Owned the complete user interface: designed and built the login/signup flow, dashboard.

AgriSmartSuite — Smart Agriculture Dashboard | React.js · Axios · REST API · CSS3 | github.com/KartikeyT10/AgricultureSmartSuite
• Built the React.js frontend for an AI-powered agriculture dashboard.
`;

    const parsed = await parseResumeWithAi(resume);

    expect(parsed.fullName).toBe("Kartikey Tiwari");
    expect(parsed.email).toBe("tiwarikartikey03@gmail.com");
    expect(parsed.phone).toContain("9717569478");
    expect(parsed.city).toBe("New Delhi, India");
    expect(parsed.country).toBe("India");
    expect(parsed.linkedin).toBe("linkedin.com/in/kartikeytiwari10");
    expect(parsed.portfolio).toContain("github.com/KartikeyT10");
    expect(parsed.skills).toContain("Python");
    expect(parsed.skills).toContain("React.js");
    expect(parsed.skills).toContain("MySQL");
    expect(parsed.skills).toContain("Tailwind CSS");
    expect(parsed.projects && parsed.projects.length).toBeGreaterThanOrEqual(2);
    expect(parsed.projects?.[0]?.name).toContain("Smart Parking Management Application");

    const merged = mergeParsedResumeIntoProfile(EMPTY_PROFILE, parsed);
    expect(merged.country).toBe("India");
    expect(merged.city).toBe("New Delhi, India");
    expect(merged.location).toBe("New Delhi, India");
    expect(merged.linkedin).toBe("linkedin.com/in/kartikeytiwari10");
    expect(merged.projects?.length).toBeGreaterThanOrEqual(2);

    const missing = getMissingProfileFields(merged);
    expect(missing).not.toContain("City / Location");
    expect(missing).not.toContain("Full Name");
    expect(missing).not.toContain("Email Address");
  });
});
