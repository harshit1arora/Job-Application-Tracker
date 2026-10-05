import { describe, it, expect } from "vitest";
import { cosineSim, scoreFromSimilarity } from "./ai";
import { validateDemoJob, VALIDATED_DEMO_JOBS } from "./jobs-catalog";

describe("cosineSim", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });
  it("is 0 for orthogonal vectors", () => {
    expect(cosineSim([1, 0], [0, 1])).toBe(0);
  });
  it("is 0 for a zero vector (no divide-by-zero)", () => {
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
  });
});

describe("scoreFromSimilarity", () => {
  it("clamps into the 5–99 range", () => {
    expect(scoreFromSimilarity(-1)).toBe(5);
    expect(scoreFromSimilarity(2)).toBe(99);
  });
  it("is monotonic — more similar means a higher score", () => {
    expect(scoreFromSimilarity(0.8)).toBeGreaterThan(scoreFromSimilarity(0.4));
  });
});

describe("Tailored Cover Letter Generator", () => {
  it("builds an authentic 8-10 line first-person cover letter for specific job and company", async () => {
    const { generateCoverLetter, buildTailoredCoverLetter } = await import("./ai");
    const letter = await generateCoverLetter(
      "Alex Carter",
      "Stripe",
      "Senior Full Stack Engineer",
      "Building global payments infrastructure and high-throughput APIs",
      "TypeScript, React, Node.js, C#",
    );

    expect(letter).toContain(
      "Hi, I'm Alex Carter applying for the Senior Full Stack Engineer position at Stripe.",
    );
    expect(letter).toContain("interested in joining Stripe");
    expect(letter).toContain("Sincerely,\nAlex Carter");
    expect(letter).not.toContain("Resume Optimization Tip");
    expect(letter).not.toContain("Action Verb + Context");
  });
});

describe("demo job catalog", () => {
  it("includes multiple official jobs beyond Airbnb and keeps them valid", () => {
    expect(VALIDATED_DEMO_JOBS.length).toBeGreaterThan(1);
    expect(VALIDATED_DEMO_JOBS.some((job) => job.company === "Airbnb")).toBe(true);
    expect(VALIDATED_DEMO_JOBS.some((job) => job.company === "Stripe")).toBe(true);
    const sources = new Set(VALIDATED_DEMO_JOBS.map((job) => job.source));
    for (const source of ["Greenhouse", "Lever", "Ashby", "Workday", "LinkedIn"]) {
      expect(sources.has(source as (typeof VALIDATED_DEMO_JOBS)[number]["source"])).toBe(true);
    }

    const result = validateDemoJob({
      id: "google-swe",
      company: "Google",
      role: "Software Engineer",
      source: "Workday",
      sourceType: "official",
      isActive: true,
      jobUrl: "https://careers.google.com/jobs/results/12345/",
      externalApplyUrl: "https://careers.google.com/jobs/results/12345/",
    });

    expect(result).toBe(true);
  });
});
