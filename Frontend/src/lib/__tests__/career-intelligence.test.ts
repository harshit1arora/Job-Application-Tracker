import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateApplicationSuccessScore,
  calculateSkillProofScores,
  determineNextBestAction,
  buildCareerTwinLite,
  computeUnifiedCareerIntelligence,
  computeDashboardCareerIntelligence,
  executeActionCompletion,
  saveStoredSkillVerification,
  getStoredSkillVerifications,
  saveStoredSkillImprovement,
  getStoredSkillImprovements,
  saveStoredInterviewPerformance,
  getStoredInterviewPerformance,
  markActionCompletedInStorage,
  getCompletedActionIds,
  normalizeSkill,
  parseYearsOfExperience,
  parseJobSeniorityRequired,
  safeExtractJsonObject,
  safeExtractJsonArray,
  calculateDeterministicMatchScore,
  type SkillProof,
} from "../career-intelligence";
import { type UserProfile, EMPTY_PROFILE, saveProfile, getProfile } from "../profile";
import type { ApplicationDocument } from "../types";

// Setup localStorage mock
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

describe("AI Career Intelligence Engine — Production Hardening & Integration Tests", () => {
  const testUid = "test_user_ai_001";

  const sampleProfile: UserProfile = {
    ...EMPTY_PROFILE,
    fullName: "Alex Carter",
    email: "alex.carter@example.com",
    phone: "(415) 890-2341",
    targetRole: "Full Stack Engineer",
    yearsOfExperience: "5 years",
    skills: ["React", "TypeScript", "Node.js", "SQL", "REST APIs"],
    resumeText: `
      Alex Carter - Full Stack Engineer with 5 years experience.
      Skilled in React, TypeScript, Node.js, and SQL. Built high-scale REST APIs and PostgreSQL schemas.
    `,
    projects: [
      {
        name: "E-Commerce Microservices",
        description: "Built scalable payment APIs and React client dashboard",
        technologies: ["React", "TypeScript", "Node.js", "SQL", "REST APIs"],
        link: "https://github.com/alexcarter/ecommerce",
      },
    ],
  };

  const sampleJob = {
    id: "job-stripe-01",
    company: "Stripe",
    role: "Senior Full Stack Engineer",
    description: "Build developer platform using React, TypeScript, Node.js, REST APIs, and Docker.",
    requiredSkills: ["React", "TypeScript", "Node.js", "Docker", "REST APIs"],
    matchScore: 88,
  };

  beforeEach(() => {
    localStorageMock.clear();
  });

  // -------------------------------------------------------------------------
  // 1. Application Success Predictor Tests & Edge Cases
  // -------------------------------------------------------------------------
  describe("1. Application Success Predictor", () => {
    it("returns high score for strong match and good project evidence", () => {
      const result = calculateApplicationSuccessScore(sampleProfile, sampleJob);
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(["Moderate Readiness", "Strong Readiness"]).toContain(result.category);
      expect(result.breakdown.resumeMatch).toBe(88);
      expect(result.hasSufficientData).toBe(true);
      expect(result.positiveSignals.length).toBeGreaterThan(0);
    });

    it("penalizes score when critical required skills are missing", () => {
      const jobWithNicheSkills = {
        ...sampleJob,
        requiredSkills: ["Solidity", "Rust", "Web3.js", "Smart Contracts", "Docker"],
      };
      const result = calculateApplicationSuccessScore(sampleProfile, jobWithNicheSkills);
      expect(result.breakdown.requiredSkills).toBeLessThan(40);
      expect(result.areasReducingReadiness.some((r) => r.includes("Missing"))).toBe(true);
    });

    it("handles seniority mismatch gracefully", () => {
      const juniorProfile: UserProfile = {
        ...sampleProfile,
        yearsOfExperience: "0 years / New Grad",
      };
      const seniorJob = {
        ...sampleJob,
        role: "Principal Architect",
      };
      const result = calculateApplicationSuccessScore(juniorProfile, seniorJob);
      expect(result.breakdown.seniorityFit).toBeLessThanOrEqual(60);
    });

    it("returns meaningful incomplete error when profile has no resume or skills", () => {
      const emptyProfile: UserProfile = {
        ...EMPTY_PROFILE,
        resumeText: "",
        skills: [],
      };
      const result = calculateApplicationSuccessScore(emptyProfile, sampleJob);
      expect(result.hasSufficientData).toBe(false);
      expect(result.score).toBe(0);
      expect(result.missingDataReasons.length).toBeGreaterThan(0);
      expect(result.areasReducingReadiness.some((r) => r.includes("Add your résumé"))).toBe(true);
    });

    it("does not fabricate years of experience for missing or empty text", () => {
      expect(parseYearsOfExperience("")).toBe(0);
      expect(parseYearsOfExperience(undefined)).toBe(0);
      expect(parseYearsOfExperience("New Grad / Intern")).toBe(0);
      expect(parseYearsOfExperience("5 years")).toBe(5);
    });

    it("strictly clamps scores between 0 and 100 under out-of-bound inputs", () => {
      const extremeJobHigh = {
        ...sampleJob,
        matchScore: 999,
      };
      const resultHigh = calculateApplicationSuccessScore(sampleProfile, extremeJobHigh);
      expect(resultHigh.score).toBeLessThanOrEqual(100);
      expect(resultHigh.breakdown.resumeMatch).toBeLessThanOrEqual(100);

      const extremeJobLow = {
        ...sampleJob,
        matchScore: -50,
      };
      const resultLow = calculateApplicationSuccessScore(sampleProfile, extremeJobLow);
      expect(resultLow.score).toBeGreaterThanOrEqual(0);
      expect(resultLow.breakdown.resumeMatch).toBeGreaterThanOrEqual(0);
    });

    it("incorporates historical application outcomes when sufficient records exist", () => {
      const history: ApplicationDocument[] = [
        { id: "1", userId: testUid, company: "A", jobTitle: "Eng", applicationSource: "LinkedIn", status: "Interview", createdAt: "", updatedAt: "" },
        { id: "2", userId: testUid, company: "B", jobTitle: "Eng", applicationSource: "LinkedIn", status: "Offer", createdAt: "", updatedAt: "" },
        { id: "3", userId: testUid, company: "C", jobTitle: "Eng", applicationSource: "LinkedIn", status: "Interview", createdAt: "", updatedAt: "" },
        { id: "4", userId: testUid, company: "D", jobTitle: "Eng", applicationSource: "LinkedIn", status: "Applied", createdAt: "", updatedAt: "" },
        { id: "5", userId: testUid, company: "E", jobTitle: "Eng", applicationSource: "LinkedIn", status: "Saved", createdAt: "", updatedAt: "" },
      ];
      const result = calculateApplicationSuccessScore(sampleProfile, sampleJob, history);
      expect(result.historicalContext).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Skill Proof Score & Evidence Hierarchy Tests
  // -------------------------------------------------------------------------
  describe("2. Skill Proof Score & Evidence Ladder", () => {
    it("returns zero score for completely unevidenced skills", () => {
      const proofs = calculateSkillProofScores(sampleProfile, ["NonExistentSkillXYZ"], testUid);
      const proof = proofs.find((p) => p.skill === "NonExistentSkillXYZ");
      expect(proof).toBeDefined();
      expect(proof!.score).toBe(0);
      expect(proof!.claimed).toBe(false);
      expect(proof!.supported).toBe(false);
      expect(proof!.verified).toBe(false);
    });

    it("scores claimed-only skills moderately (~25) without marking them supported", () => {
      const profileWithClaim: UserProfile = {
        ...sampleProfile,
        skills: ["Kubernetes"], // claimed in list, but NOT in resume, NOT in projects
        resumeText: "Java and Spring developer",
        projects: [],
      };
      const proofs = calculateSkillProofScores(profileWithClaim, ["Kubernetes"], testUid);
      const k8sProof = proofs.find((p) => p.skill === "Kubernetes");
      expect(k8sProof).toBeDefined();
      expect(k8sProof!.score).toBe(25);
      expect(k8sProof!.claimed).toBe(true);
      expect(k8sProof!.supported).toBe(false);
    });

    it("assigns higher proof score when skill appears in resume AND project", () => {
      const proofs = calculateSkillProofScores(sampleProfile, sampleJob.requiredSkills, testUid);
      const reactProof = proofs.find((p) => p.skill.toLowerCase() === "react");
      const dockerProof = proofs.find((p) => p.skill.toLowerCase() === "docker");

      expect(reactProof).toBeDefined();
      expect(dockerProof).toBeDefined();
      expect(reactProof!.score).toBeGreaterThan(dockerProof!.score);
      expect(reactProof!.supported).toBe(true);
      expect(reactProof!.evidence.projectCount).toBeGreaterThan(0);
      expect(dockerProof!.evidence.projectCount).toBe(0);
    });

    it("increases proof score and marks supported when improvement task is recorded", () => {
      saveStoredSkillImprovement(testUid, {
        skill: "Docker",
        taskTitle: "Containerize payments service",
        note: "Built multi-stage Dockerfile",
        completedAt: new Date().toISOString(),
      });
      const improvements = getStoredSkillImprovements(testUid);
      expect(improvements.length).toBe(1);

      const proofs = calculateSkillProofScores(sampleProfile, ["Docker"], testUid);
      const dockerProof = proofs.find((p) => p.skill.toLowerCase() === "docker");
      expect(dockerProof).toBeDefined();
      expect(dockerProof!.supported).toBe(true);
      expect(dockerProof!.evidence.improvementCount).toBe(1);
      expect(dockerProof!.score).toBeGreaterThanOrEqual(20);
    });

    it("persists and reflects completed technical verification", () => {
      saveStoredSkillVerification(testUid, "docker", 88, "passed");
      const stored = getStoredSkillVerifications(testUid);
      expect(stored["docker"]?.status).toBe("passed");

      const proofs = calculateSkillProofScores(sampleProfile, ["Docker"], testUid);
      const dockerProof = proofs.find((p) => p.skill.toLowerCase() === "docker");
      expect(dockerProof?.verified).toBe(true);
      expect(dockerProof?.score).toBeGreaterThanOrEqual(45);
    });

    it("applies penalty when verification status is failed", () => {
      saveStoredSkillVerification(testUid, "react", 40, "failed");
      const proofs = calculateSkillProofScores(sampleProfile, ["React"], testUid);
      const reactProof = proofs.find((p) => p.skill.toLowerCase() === "react");
      expect(reactProof?.evidence.verificationStatus).toBe("failed");
      expect(reactProof?.verified).toBe(false);
    });

    it("strictly clamps proof scores between 0 and 100", () => {
      const proofs = calculateSkillProofScores(sampleProfile, sampleJob.requiredSkills, testUid);
      for (const p of proofs) {
        expect(p.score).toBeGreaterThanOrEqual(0);
        expect(p.score).toBeLessThanOrEqual(100);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 3. Career Twin Lite Tests
  // -------------------------------------------------------------------------
  describe("3. Career Twin Lite", () => {
    it("transforms profile and job requirements into structured Career Twin state", () => {
      const proofs = calculateSkillProofScores(sampleProfile, sampleJob.requiredSkills, testUid);
      const twin = buildCareerTwinLite(sampleProfile, sampleJob, proofs, [], testUid);

      expect(twin.candidateId).toBe("Alex Carter");
      expect(twin.experienceYears).toBe(5);
      expect(twin.roleFitScore).toBeGreaterThan(50);
      expect(twin.likelyInterviewAreas).toContain("React");
      expect(twin.strengths.length).toBeGreaterThan(0);
    });

    it("incorporates stored interview simulation performance into twin state", () => {
      saveStoredInterviewPerformance(testUid, {
        jobId: sampleJob.id,
        score: 86,
        completedAt: new Date().toISOString(),
        evaluatedTopics: ["React", "System Design"],
        strengths: ["Clean state management"],
        improvements: ["Quantify latency metrics"],
      });

      const proofs = calculateSkillProofScores(sampleProfile, sampleJob.requiredSkills, testUid);
      const twin = buildCareerTwinLite(sampleProfile, sampleJob, proofs, [], testUid);

      expect(twin.interviewPerformance).toBeDefined();
      expect(twin.interviewPerformance?.score).toBe(86);
      expect(twin.interviewNotes?.some((n) => n.includes("86/100"))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Next-Best-Action Coach & Completion Loop Tests
  // -------------------------------------------------------------------------
  describe("4. Next-Best-Action Coach & Completion Loop", () => {
    it("recommends IMPROVE_SKILL when a critical job skill is weak/missing", () => {
      const proofs: SkillProof[] = [
        {
          skill: "Docker",
          score: 30,
          claimed: false,
          supported: false,
          verified: false,
          evidence: { resumeMention: false, resumeCount: 0, projectCount: 0, matchedProjects: [], hasRepoOrLink: false, verificationStatus: "unverified", notes: [] },
        },
      ];
      const successResult = calculateApplicationSuccessScore(sampleProfile, sampleJob);
      const action = determineNextBestAction(
        sampleProfile,
        sampleJob,
        "Saved",
        successResult,
        proofs,
        testUid
      );

      expect(action.actionType).toBe("IMPROVE_SKILL");
      expect(action.targetSkill).toBe("Docker");
      expect(action.effortMinutes).toBeGreaterThan(0);
    });

    it("recommends PREPARE_INTERVIEW when application is in Interview stage", () => {
      const proofs = calculateSkillProofScores(sampleProfile, sampleJob.requiredSkills, testUid);
      const boostedProofs = proofs.map((p) => ({ ...p, score: 85 }));
      const successResult = calculateApplicationSuccessScore(sampleProfile, sampleJob);

      const action = determineNextBestAction(
        sampleProfile,
        sampleJob,
        "Interview",
        successResult,
        boostedProofs,
        testUid
      );

      expect(action.actionType).toBe("PREPARE_INTERVIEW");
      expect(action.title).toContain("Interview Simulation");
    });

    it("executes action completion, persists state, and recalculates Next-Best-Action", () => {
      saveProfile(testUid, sampleProfile);
      const initialProofs = calculateSkillProofScores(sampleProfile, sampleJob.requiredSkills, testUid);
      const initialSuccess = calculateApplicationSuccessScore(sampleProfile, sampleJob);

      const firstAction = determineNextBestAction(
        sampleProfile,
        sampleJob,
        "Saved",
        initialSuccess,
        initialProofs,
        testUid
      );

      expect(firstAction.actionType).toBe("IMPROVE_SKILL");
      expect(firstAction.targetSkill).toBe("Docker");

      // Execute action completion
      const completionResult = executeActionCompletion(testUid, firstAction, sampleProfile, {
        skillNote: "Created multi-stage Dockerfile and deployed container",
      });

      expect(completionResult.success).toBe(true);
      expect(completionResult.updatedProfile?.skills).toContain("Docker");

      // Verify persistence
      const completedActions = getCompletedActionIds(testUid);
      expect(completedActions).toContain(firstAction.id);
      const storedImprovements = getStoredSkillImprovements(testUid);
      expect(storedImprovements.some((i) => i.skill === "Docker")).toBe(true);

      // Re-run pipeline with persisted state
      const reloadedProfile = getProfile(testUid);
      const recalculatedProofs = calculateSkillProofScores(reloadedProfile, sampleJob.requiredSkills, testUid);
      const recalculatedSuccess = calculateApplicationSuccessScore(reloadedProfile, sampleJob);

      const secondAction = determineNextBestAction(
        reloadedProfile,
        sampleJob,
        "Saved",
        recalculatedSuccess,
        recalculatedProofs,
        testUid
      );

      // Next best action must advance to the next priority!
      expect(secondAction.id).not.toBe(firstAction.id);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Dashboard Aggregator & Unified Pipeline Tests
  // -------------------------------------------------------------------------
  describe("5. Dashboard Aggregator & Unified Pipeline", () => {
    it("computes dashboard intelligence and handles empty resume state", () => {
      const summary = computeDashboardCareerIntelligence(sampleProfile, [sampleJob], [], testUid);
      expect(summary).not.toBeNull();
      expect(summary!.avgReadiness).toBeGreaterThan(60);
      expect(summary!.topOpportunity).toBeDefined();
      expect(summary!.hasSufficientData).toBe(true);

      const emptyProfileSummary = computeDashboardCareerIntelligence(
        { ...EMPTY_PROFILE, resumeText: "", skills: [] },
        [sampleJob],
        [],
        testUid
      );
      expect(emptyProfileSummary?.hasSufficientData).toBe(false);
    });

    it("safely extracts JSON objects and arrays from diverse LLM outputs", () => {
      const rawWithFences = "```json\n{\"score\": 85, \"passed\": true}\n```";
      const obj = safeExtractJsonObject<{ score: number }>(rawWithFences);
      expect(obj?.score).toBe(85);

      const rawWithPreamble = "Here is the result: [{\"id\": \"q-1\", \"question\": \"Test?\"}] hope it helps!";
      const arr = safeExtractJsonArray<{ id: string }>(rawWithPreamble);
      expect(arr?.length).toBe(1);
      expect(arr?.[0]?.id).toBe("q-1");

      const malformed = "Invalid text that has no JSON at all";
      expect(safeExtractJsonObject(malformed)).toBeNull();
      expect(safeExtractJsonArray(malformed)).toBeNull();
    });
  });
});
