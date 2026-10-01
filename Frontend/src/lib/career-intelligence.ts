/**
 * career-intelligence.ts
 *
 * Core engine for JobPilot's 4 Connected AI Features:
 * 1. AI Application Success Predictor (Deterministic Readiness Engine)
 * 2. Skill Proof Score (Evidence-Based Skill Analysis & Verification)
 * 3. Career Twin Lite (Candidate State + Role Fit + Interview Simulation)
 * 4. AI Next-Best-Action Career Coach (Prioritized Micro-Tasks & Impact Recalculation)
 *
 * Pipeline Flow:
 * Job + Candidate -> Resume Match -> Application Success Predictor -> Skill Proof Score -> Career Twin Lite -> Next-Best-Action Coach -> Action -> Recalculate
 */

import type { ApplicationDocument, ApplicationStatus, SuggestedJob } from "./types";
import { type UserProfile, type CandidateProject, saveProfile } from "./profile";
import { chat, type ChatMessage } from "./ai";

// ---------------------------------------------------------------------------
// 1. DATA CONTRACTS & INTERFACES
// ---------------------------------------------------------------------------

export type ReadinessCategory =
  | "Strong Readiness"     // 80–100
  | "Moderate Readiness"   // 60–79
  | "Needs Improvement"    // 40–59
  | "Low Current Readiness"; // 0–39

export interface SuccessScoreBreakdown {
  resumeMatch: number;        // Weight: 35% (0–100)
  requiredSkills: number;     // Weight: 20% (0–100)
  projectRelevance: number;   // Weight: 15% (0–100)
  experienceRelevance: number;// Weight: 10% (0–100)
  seniorityFit: number;       // Weight: 10% (0–100)
  profileCompleteness: number;// Weight: 10% (0–100)
}

export interface ApplicationSuccessResult {
  score: number; // 0–100 integer
  category: ReadinessCategory;
  breakdown: SuccessScoreBreakdown;
  positiveSignals: string[];
  areasReducingReadiness: string[];
  hasSufficientData: boolean;
  missingDataReasons: string[];
  historicalContext?: string | undefined;
}

export type SkillVerificationStatus = "unverified" | "passed" | "failed";

export interface SkillProof {
  skill: string;
  score: number; // 0–100 integer
  claimed: boolean;
  supported: boolean;
  verified: boolean;
  evidence: {
    resumeMention: boolean;
    resumeCount: number;
    projectCount: number;
    matchedProjects: string[];
    hasRepoOrLink: boolean;
    improvementCount?: number | undefined;
    verificationStatus: SkillVerificationStatus;
    verificationScore?: number | undefined;
    notes: string[];
  };
}

export interface SkillVerificationChallenge {
  skill: string;
  scenario: string;
  question: string;
  expectedConcepts: string[];
}

export interface SkillVerificationEvaluation {
  skill: string;
  score: number; // 0–100
  passed: boolean;
  feedback: string;
  positivePoints: string[];
  improvementPoints: string[];
}

export interface InterviewQuestionItem {
  id: string;
  question: string;
  context: string;
  targetSkillOrTopic: string;
}

export interface InterviewEvaluationResult {
  score: number; // 0–100
  feedback: string;
  strengths: string[];
  improvements: string[];
  suggestedFollowUp?: string | undefined;
}

export interface SkillImprovementRecord {
  skill: string;
  taskTitle: string;
  note?: string | undefined;
  completedAt: string;
}

export interface InterviewPerformanceRecord {
  jobId: string;
  score: number;
  completedAt: string;
  evaluatedTopics: string[];
  strengths: string[];
  improvements: string[];
}

export interface CareerTwinLiteState {
  candidateId: string;
  skills: SkillProof[];
  projects: CandidateProject[];
  experienceYears: number;
  strengths: string[];
  weaknesses: string[];
  roleFitScore: number;
  likelyInterviewAreas: string[];
  interviewNotes?: string[] | undefined;
  interviewPerformance?: InterviewPerformanceRecord | undefined;
  lastUpdated: string;
}

export type ActionType =
  | "IMPROVE_SKILL"
  | "VERIFY_SKILL"
  | "ADD_PROJECT"
  | "UPDATE_RESUME"
  | "COMPLETE_PROFILE"
  | "PREPARE_INTERVIEW"
  | "PRACTICE_INTERVIEW"
  | "APPLY_NOW"
  | "FOLLOW_UP"
  | "NO_ACTION_REQUIRED";

export interface NextBestAction {
  id: string;
  jobId: string;
  applicationId?: string | undefined;
  actionType: ActionType;
  title: string;
  reason: string;
  suggestedTask: string;
  targetSkill?: string | undefined;
  effortMinutes: number;
  estimatedImpact?: number | undefined; // e.g. +7 readiness points
  completed: boolean;
  createdAt: string;
}

export interface ActionCompletionResult {
  actionId: string;
  actionType: ActionType;
  success: boolean;
  message: string;
  updatedProfile?: UserProfile | undefined;
}

export interface IntelligenceJobInput {
  id: string;
  role: string;
  company: string;
  description?: string | undefined;
  requiredSkills: string[];
  experienceLevel?: string | undefined;
  matchScore?: number | undefined;
}

export interface UnifiedCareerIntelligence {
  jobId: string;
  jobTitle: string;
  company: string;
  resumeMatch: number;
  applicationSuccess: ApplicationSuccessResult;
  skillProofs: SkillProof[];
  careerTwin: CareerTwinLiteState;
  nextBestAction: NextBestAction;
}

export interface DashboardCareerIntelligenceSummary<TJob extends IntelligenceJobInput = IntelligenceJobInput> {
  avgReadiness: number;
  topOpportunity: { job: TJob; success: ApplicationSuccessResult } | null;
  needsAttention: { job: TJob; success: ApplicationSuccessResult } | null;
  weakestSkill: SkillProof | null;
  nextAction: NextBestAction | null;
  hasSufficientData: boolean;
}

// ---------------------------------------------------------------------------
// 2. HELPER UTILITIES: NORMALIZATION, PARSING & SAFE EXTRACTION
// ---------------------------------------------------------------------------

export function normalizeSkill(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s.trim().toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

/**
 * Deterministically calculates a candidate-to-job match score when job.matchScore is missing.
 * Prevents artificial default score inflation (e.g. 75, 82) for weak or empty candidates.
 * Returns 0 if insufficient candidate data exists, or a bounded 0-100 calculated score.
 */
export function calculateDeterministicMatchScore(
  profile: UserProfile,
  job: { description?: string | undefined; requiredSkills?: string[] | undefined; role?: string | undefined }
): number {
  const resumeText = (profile.resumeText || "").trim();
  const candidateSkills = (profile.skills || []).map((s) => s.trim().toLowerCase()).filter(Boolean);

  // If candidate has neither resume text nor skills, match score is 0
  if (!resumeText && candidateSkills.length === 0) {
    return 0;
  }

  const jobText = `${job.role || ""} ${job.description || ""} ${(job.requiredSkills || []).join(" ")}`.toLowerCase();
  const tokenize = (str: string) =>
    str.replace(/[^a-z0-9+#]/g, " ").split(/\s+/).filter((w) => w.length > 2);

  const rWords = new Set(tokenize(resumeText));
  candidateSkills.forEach((s) => tokenize(s).forEach((w) => rWords.add(w)));

  const jWords = tokenize(jobText);
  if (jWords.length === 0) {
    // Job has no requirements or description; return conservative baseline if candidate has content
    return rWords.size > 0 ? 40 : 0;
  }

  let matches = 0;
  for (const word of jWords) {
    if (rWords.has(word)) matches++;
  }

  // Also verify required skills overlap specifically
  const required = job.requiredSkills || [];
  let reqMatches = 0;
  if (required.length > 0) {
    for (const req of required) {
      const normReq = normalizeSkill(req);
      const hasSkill = candidateSkills.some((s) => normalizeSkill(s) === normReq);
      const inResume = normReq.length > 0 && resumeText.toLowerCase().includes(req.toLowerCase());
      if (hasSkill || inResume) {
        reqMatches++;
      }
    }
  }

  const textRatio = matches / Math.max(1, jWords.length);
  const skillRatio = required.length > 0 ? reqMatches / required.length : textRatio;

  // Weighted combination: 60% skills overlap, 40% general text overlap
  const calculated = Math.round(skillRatio * 60 + textRatio * 40 * 1.5);
  return Math.min(98, Math.max(0, calculated));
}

/** Safely parse years of experience without fabricating data for empty inputs */
export function parseYearsOfExperience(text?: string): number {
  if (!text || !text.trim()) return 0;
  const lower = text.toLowerCase();
  if (
    lower.includes("new grad") ||
    lower.includes("student") ||
    lower.includes("entry") ||
    lower.includes("intern") ||
    lower.includes("0 year") ||
    lower.includes("0 yr")
  ) {
    return 0;
  }
  const match = text.match(/(\d+)(?:\+)?\s*(?:years?|yrs?|yoe)/i);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    return isNaN(parsed) ? 0 : Math.min(40, Math.max(0, parsed));
  }
  const digitMatch = text.match(/\b(\d+)\b/);
  if (digitMatch && digitMatch[1]) {
    const num = parseInt(digitMatch[1], 10);
    if (!isNaN(num) && num <= 40) return Math.max(0, num);
  }
  return 0;
}

export function parseJobSeniorityRequired(jobTitle: string, jobDesc?: string): number {
  const combined = `${jobTitle || ""} ${jobDesc || ""}`.toLowerCase();
  if (
    combined.includes("lead") ||
    combined.includes("principal") ||
    combined.includes("staff") ||
    combined.includes("architect")
  ) {
    return 6;
  }
  if (
    combined.includes("senior") ||
    combined.includes("sr.") ||
    combined.includes("sr ")
  ) {
    return 4;
  }
  if (
    combined.includes("mid") ||
    combined.includes("ii") ||
    combined.includes("level 2")
  ) {
    return 2;
  }
  if (
    combined.includes("junior") ||
    combined.includes("jr") ||
    combined.includes("entry") ||
    combined.includes("associate") ||
    combined.includes("intern")
  ) {
    return 0;
  }
  return 2;
}

/** Safe JSON object extractor for AI responses */
export function safeExtractJsonObject<T>(raw: string): T | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }
    const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonSubstring);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return null;
  } catch {
    return null;
  }
}

/** Safe JSON array extractor for AI responses */
export function safeExtractJsonArray<T>(raw: string): T[] | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
      return null;
    }
    const jsonSubstring = cleaned.substring(firstBracket, lastBracket + 1);
    const parsed = JSON.parse(jsonSubstring);
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. FEATURE 1: AI APPLICATION SUCCESS PREDICTOR (Deterministic)
// ---------------------------------------------------------------------------

export function calculateApplicationSuccessScore(
  profile: UserProfile,
  job: IntelligenceJobInput,
  applicationsHistory: ApplicationDocument[] = []
): ApplicationSuccessResult {
  const missingDataReasons: string[] = [];

  const hasResume = Boolean(profile.resumeText && profile.resumeText.trim().length > 30);
  const candidateSkills = (profile.skills || []).map((s) => s.trim()).filter(Boolean);
  const hasSkills = candidateSkills.length > 0;
  const candidateProjects = profile.projects || [];

  if (!hasResume) {
    missingDataReasons.push("Résumé text is missing — add your résumé to calculate application readiness.");
  }
  if (!hasSkills) {
    missingDataReasons.push("Profile skills are missing — add your key skills in your Profile.");
  }

  // If candidate has neither resume nor skills, we cannot compute a meaningful score
  if (!hasResume && !hasSkills) {
    return {
      score: 0,
      category: "Low Current Readiness",
      breakdown: {
        resumeMatch: 0,
        requiredSkills: 0,
        projectRelevance: 0,
        experienceRelevance: 0,
        seniorityFit: 0,
        profileCompleteness: 0,
      },
      positiveSignals: [],
      areasReducingReadiness: [
        "Not enough candidate information to calculate a meaningful analysis.",
        "Add your résumé to calculate application readiness.",
      ],
      hasSufficientData: false,
      missingDataReasons,
    };
  }

  // 1. Resume Match Factor (0–100)
  const rawMatch =
    typeof job.matchScore === "number" && !isNaN(job.matchScore)
      ? job.matchScore
      : calculateDeterministicMatchScore(profile, job);
  const resumeMatchFactor = Math.min(100, Math.max(0, rawMatch));

  // 2. Required Skills Factor (0–100)
  const normCandidateSkills = new Set(candidateSkills.map(normalizeSkill));
  const fullResumeNorm = (profile.resumeText || "").toLowerCase();
  
  let matchedSkillsCount = 0;
  const missingSkillsList: string[] = [];
  const strongMatchedSkills: string[] = [];

  const required = job.requiredSkills && job.requiredSkills.length > 0
    ? job.requiredSkills
    : ["Software Engineering", "Problem Solving", "System Architecture"];

  for (const skill of required) {
    const norm = normalizeSkill(skill);
    const inSkillsList = normCandidateSkills.has(norm);
    const inResume = Boolean(norm && fullResumeNorm.includes(skill.toLowerCase()));

    if (inSkillsList || inResume) {
      matchedSkillsCount++;
      strongMatchedSkills.push(skill);
    } else {
      missingSkillsList.push(skill);
    }
  }

  const requiredSkillsFactor = Math.min(
    100,
    Math.max(0, Math.round((matchedSkillsCount / Math.max(1, required.length)) * 100))
  );

  // 3. Project Relevance Factor (0–100)
  let projectRelevanceFactor = 25; // baseline unproven practical evidence if no projects logged
  const projectTechHits = new Set<string>();

  if (candidateProjects.length > 0) {
    let relevantProjectCount = 0;
    for (const proj of candidateProjects) {
      const projText = `${proj.name || ""} ${proj.description || ""} ${(proj.technologies || []).join(" ")}`.toLowerCase();
      let hasHit = false;
      for (const skill of required) {
        if (projText.includes(skill.toLowerCase())) {
          projectTechHits.add(skill);
          hasHit = true;
        }
      }
      if (hasHit) relevantProjectCount++;
    }

    if (relevantProjectCount >= 2) {
      projectRelevanceFactor = 90;
    } else if (relevantProjectCount === 1) {
      projectRelevanceFactor = 75;
    } else {
      projectRelevanceFactor = 50; // Candidate has projects, but outside this role's stack
    }
  } else {
    // No projects documented: check if resume mentions applied stack
    let resumeTechHits = 0;
    for (const skill of required) {
      if (fullResumeNorm.includes(skill.toLowerCase())) {
        resumeTechHits++;
      }
    }
    projectRelevanceFactor = Math.min(45, Math.max(20, 20 + resumeTechHits * 5));
  }
  projectRelevanceFactor = Math.min(100, Math.max(0, projectRelevanceFactor));

  // 4. Experience Relevance Factor (0–100)
  const candidateYears = parseYearsOfExperience(profile.yearsOfExperience || profile.ageOrExperience);
  let expFactor = 45;
  if (candidateYears >= 5) expFactor = 92;
  else if (candidateYears >= 3) expFactor = 82;
  else if (candidateYears >= 1) expFactor = 70;
  else if (candidateYears > 0) expFactor = 55;
  else expFactor = 40; // 0 YOE or new grad
  expFactor = Math.min(100, Math.max(0, expFactor));

  // 5. Seniority Fit Factor (0–100)
  const reqSeniority = parseJobSeniorityRequired(job.role, job.description);
  let seniorityFitFactor = 80;
  const diff = candidateYears - reqSeniority;
  if (diff >= 0 && diff <= 3) {
    seniorityFitFactor = 95; // Optimal fit
  } else if (diff > 3) {
    seniorityFitFactor = 88; // Highly experienced
  } else if (diff === -1) {
    seniorityFitFactor = 75; // Slight reach
  } else if (diff <= -2) {
    seniorityFitFactor = 50; // Substantial seniority gap
  }
  seniorityFitFactor = Math.min(100, Math.max(0, seniorityFitFactor));

  // 6. Profile / Resume Completeness Factor (0–100)
  let completeness = 20;
  if (profile.fullName && profile.fullName.trim().length > 0) completeness += 15;
  if (profile.email && profile.phone) completeness += 15;
  if (profile.location || profile.city) completeness += 10;
  if (profile.targetRole && profile.targetRole.trim().length > 0) completeness += 15;
  if (candidateSkills.length >= 4) completeness += 15;
  if (hasResume) completeness += 10;
  completeness = Math.min(100, Math.max(0, completeness));

  // Deterministic Weighted Sum
  // Resume Match — 35%, Required Skills — 20%, Project Relevance — 15%, Experience — 10%, Seniority — 10%, Completeness — 10%
  const rawScore =
    resumeMatchFactor * 0.35 +
    requiredSkillsFactor * 0.20 +
    projectRelevanceFactor * 0.15 +
    expFactor * 0.10 +
    seniorityFitFactor * 0.10 +
    completeness * 0.10;

  // Historical application outcome calibration (only if >= 5 past applications)
  let historicalDelta = 0;
  let historicalContext: string | undefined = undefined;
  if (applicationsHistory.length >= 5) {
    const interviewOffers = applicationsHistory.filter(
      (a) => a.status === "Interview" || a.status === "Offer"
    ).length;
    const rate = interviewOffers / applicationsHistory.length;
    if (rate >= 0.4) {
      historicalDelta = 3;
      historicalContext = `Positive past pipeline conversion (${interviewOffers}/${applicationsHistory.length} advanced to Interview/Offer)`;
    } else if (rate <= 0.1 && applicationsHistory.length >= 8) {
      historicalDelta = -2;
      historicalContext = "Past conversion history indicates higher competition for similar positions";
    }
  }

  // Clamped strictly between 0 and 100
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore + historicalDelta)));

  // Category mapping
  let category: ReadinessCategory = "Moderate Readiness";
  if (finalScore >= 80) category = "Strong Readiness";
  else if (finalScore >= 60) category = "Moderate Readiness";
  else if (finalScore >= 40) category = "Needs Improvement";
  else category = "Low Current Readiness";

  // Signals
  const positiveSignals: string[] = [];
  const areasReducingReadiness: string[] = [];

  if (strongMatchedSkills.length > 0) {
    positiveSignals.push(`Strong alignment in ${strongMatchedSkills.slice(0, 3).join(", ")}`);
  }
  if (resumeMatchFactor >= 80) {
    positiveSignals.push(`High resume-to-job similarity (${resumeMatchFactor}%)`);
  }
  if (candidateProjects.length >= 2 || projectTechHits.size >= 2) {
    positiveSignals.push(`${candidateProjects.length || 2} relevant projects demonstrate required stack`);
  }
  if (seniorityFitFactor >= 85) {
    positiveSignals.push(`Candidate experience level (${candidateYears}+ YOE) fits ${job.role}`);
  }

  if (missingSkillsList.length > 0) {
    areasReducingReadiness.push(`Missing or weakly evidenced required skills: ${missingSkillsList.slice(0, 3).join(", ")}`);
  }
  if (candidateProjects.length === 0) {
    areasReducingReadiness.push("No candidate projects documented to prove applied technical competence");
  }
  if (seniorityFitFactor < 75) {
    areasReducingReadiness.push(`Job seniority typically expects ${reqSeniority}+ YOE; profile currently demonstrates ${candidateYears} YOE`);
  }
  if (completeness < 80) {
    areasReducingReadiness.push("Profile information has missing sections (target role, portfolio, or details)");
  }

  return {
    score: finalScore,
    category,
    breakdown: {
      resumeMatch: Math.min(100, Math.max(0, Math.round(resumeMatchFactor))),
      requiredSkills: Math.min(100, Math.max(0, Math.round(requiredSkillsFactor))),
      projectRelevance: Math.min(100, Math.max(0, Math.round(projectRelevanceFactor))),
      experienceRelevance: Math.min(100, Math.max(0, Math.round(expFactor))),
      seniorityFit: Math.min(100, Math.max(0, Math.round(seniorityFitFactor))),
      profileCompleteness: Math.min(100, Math.max(0, Math.round(completeness))),
    },
    positiveSignals: positiveSignals.length > 0 ? positiveSignals : ["Basic qualification criteria met"],
    areasReducingReadiness: areasReducingReadiness.length > 0 ? areasReducingReadiness : ["Continue reinforcing practical project proof"],
    hasSufficientData: true,
    missingDataReasons: [],
    historicalContext,
  };
}

// ---------------------------------------------------------------------------
// 4. FEATURE 2: SKILL PROOF SCORE (Evidence-Based Skill Analysis & Storage)
// ---------------------------------------------------------------------------

export const VERIFIED_SKILLS_STORAGE_KEY = (uid: string) => `jobpilot:verified_skills:${uid}`;
export const SKILL_IMPROVEMENTS_STORAGE_KEY = (uid: string) => `jobpilot:skill_improvements:${uid}`;
export const INTERVIEW_PERFORMANCE_STORAGE_KEY = (uid: string) => `jobpilot:interview_performance:${uid}`;
export const COMPLETED_ACTIONS_STORAGE_KEY = (uid: string) => `jobpilot:completed_actions:${uid}`;

export function getStoredSkillVerifications(
  uid: string
): Record<string, { score: number; status: SkillVerificationStatus; date: string }> {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;
    if (!storage || !uid) return {};
    const raw = storage.getItem(VERIFIED_SKILLS_STORAGE_KEY(uid));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStoredSkillVerification(
  uid: string,
  skill: string,
  score: number,
  status: SkillVerificationStatus
): void {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;
    if (!storage || !uid || !skill) return;
    const current = getStoredSkillVerifications(uid);
    current[skill.toLowerCase()] = {
      score: Math.min(100, Math.max(0, Math.round(score))),
      status,
      date: new Date().toISOString(),
    };
    storage.setItem(VERIFIED_SKILLS_STORAGE_KEY(uid), JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function getStoredSkillImprovements(uid: string): SkillImprovementRecord[] {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;
    if (!storage || !uid) return [];
    const raw = storage.getItem(SKILL_IMPROVEMENTS_STORAGE_KEY(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredSkillImprovement(
  uid: string,
  improvement: SkillImprovementRecord
): void {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;
    if (!storage || !uid || !improvement.skill) return;
    const current = getStoredSkillImprovements(uid);
    current.push(improvement);
    storage.setItem(SKILL_IMPROVEMENTS_STORAGE_KEY(uid), JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function getStoredInterviewPerformance(
  uid: string,
  jobId?: string
): InterviewPerformanceRecord[] {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;
    if (!storage || !uid) return [];
    const raw = storage.getItem(INTERVIEW_PERFORMANCE_STORAGE_KEY(uid));
    const list: InterviewPerformanceRecord[] = raw ? JSON.parse(raw) : [];
    if (jobId) {
      return list.filter((item) => item.jobId === jobId);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveStoredInterviewPerformance(
  uid: string,
  record: InterviewPerformanceRecord
): void {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;
    if (!storage || !uid) return;
    const current = getStoredInterviewPerformance(uid);
    current.unshift(record);
    storage.setItem(INTERVIEW_PERFORMANCE_STORAGE_KEY(uid), JSON.stringify(current.slice(0, 20)));
  } catch {
    // ignore
  }
}

export function getCompletedActionIds(uid: string): string[] {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;
    if (!storage || !uid) return [];
    const raw = storage.getItem(COMPLETED_ACTIONS_STORAGE_KEY(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markActionCompletedInStorage(uid: string, actionId: string): void {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : (globalThis as any).localStorage;
    if (!storage || !uid || !actionId) return;
    const list = getCompletedActionIds(uid);
    if (!list.includes(actionId)) {
      list.push(actionId);
      storage.setItem(COMPLETED_ACTIONS_STORAGE_KEY(uid), JSON.stringify(list));
    }
  } catch {
    // ignore
  }
}

/**
 * Calculates Skill Proof Score across evidence hierarchy:
 * Claimed -> Resume Evidence -> Practical Demonstration (Projects/Tasks) -> Verification
 * Strictly clamped: 0 <= score <= 100
 */
export function calculateSkillProofScores(
  profile: UserProfile,
  targetSkills?: string[],
  uid?: string
): SkillProof[] {
  const resumeText = (profile.resumeText || "").toLowerCase();
  const projects = profile.projects || [];
  const storedVerifications = uid ? getStoredSkillVerifications(uid) : {};
  const storedImprovements = uid ? getStoredSkillImprovements(uid) : [];

  // Aggregate unique skills to evaluate
  const allSkills = new Set<string>();
  (profile.skills || []).forEach((s) => s && allSkills.add(s.trim()));
  (targetSkills || []).forEach((s) => s && allSkills.add(s.trim()));
  if (allSkills.size === 0) {
    ["TypeScript", "React", "Node.js", "Docker", "REST APIs"].forEach((s) => allSkills.add(s));
  }

  const results: SkillProof[] = [];

  for (const rawSkill of allSkills) {
    if (!rawSkill) continue;
    const skillLower = rawSkill.toLowerCase();
    const regex = new RegExp(`\\b${rawSkill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");

    // 1. Resume Evidence
    const resumeMatches = resumeText.match(regex);
    const resumeMentionCount = resumeMatches ? resumeMatches.length : 0;
    const hasResumeEvidence = resumeMentionCount > 0;

    // 2. Project Evidence
    const matchedProjects: string[] = [];
    let hasRepoOrLink = false;
    for (const p of projects) {
      const pText = `${p.name || ""} ${p.description || ""} ${(p.technologies || []).join(" ")}`.toLowerCase();
      if (pText.includes(skillLower)) {
        matchedProjects.push(p.name);
        if (p.link || profile.github) {
          hasRepoOrLink = true;
        }
      }
    }
    const hasProjectEvidence = matchedProjects.length > 0;

    // 3. Completed Improvement Micro-Task Evidence
    const improvementsForSkill = storedImprovements.filter(
      (imp) => imp.skill.toLowerCase() === skillLower
    );
    const improvementCount = improvementsForSkill.length;
    const hasImprovementEvidence = improvementCount > 0;

    // 4. Verification Evidence
    const verification = storedVerifications[skillLower];
    const verificationStatus: SkillVerificationStatus = verification ? verification.status : "unverified";
    const verificationScore = verification ? verification.score : undefined;
    const isVerified = verificationStatus === "passed";

    // 5. Evidence Hierarchy Scoring (0–100)
    const claimed = (profile.skills || []).some((s) => s.toLowerCase() === skillLower);

    let score = 0;

    // Layer 1: Claimed (Self-reported)
    if (claimed) {
      score += 25;
    }

    // Layer 2: Resume Evidence (Documented in formal work history)
    if (hasResumeEvidence) {
      score += Math.min(25, 18 + Math.min(7, (resumeMentionCount - 1) * 2));
    }

    // Layer 3: Practical Demonstration (Applied projects or completed micro-tasks)
    if (hasProjectEvidence) {
      score += Math.min(30, 22 + Math.min(8, (matchedProjects.length - 1) * 4));
      if (hasRepoOrLink) score += 5;
    } else if (hasImprovementEvidence) {
      score += Math.min(25, 20 + Math.min(5, (improvementCount - 1) * 3));
    }

    // Layer 4: Technical Verification (Objective practical challenge)
    if (isVerified) {
      score += 25;
      // If the candidate had zero prior claims or projects, award evaluated baseline
      if (!claimed && !hasResumeEvidence && !hasProjectEvidence && !hasImprovementEvidence) {
        score += 25;
      }
    } else if (verificationStatus === "failed") {
      score -= 20;
    }

    // Strict explicit clamping: 0 <= score <= 100
    const finalScore = Math.min(100, Math.max(0, Math.round(score)));
    const supported = hasResumeEvidence || hasProjectEvidence || hasImprovementEvidence || isVerified;

    const notes: string[] = [];
    if (hasResumeEvidence) notes.push(`Mentioned in résumé (${resumeMentionCount}x)`);
    if (hasProjectEvidence) notes.push(`Demonstrated in project: ${matchedProjects.join(", ")}`);
    if (hasImprovementEvidence) notes.push(`Completed ${improvementCount} practical improvement task(s)`);
    if (!hasProjectEvidence && !hasImprovementEvidence) notes.push("No project currently showcases this technology");
    if (isVerified) notes.push(`AI technical challenge passed (${verificationScore ?? 85}/100)`);
    else if (verificationStatus === "failed") notes.push("Verification challenge needs retake");

    results.push({
      skill: rawSkill,
      score: finalScore,
      claimed,
      supported,
      verified: isVerified,
      evidence: {
        resumeMention: hasResumeEvidence,
        resumeCount: resumeMentionCount,
        projectCount: matchedProjects.length,
        matchedProjects,
        hasRepoOrLink,
        improvementCount,
        verificationStatus,
        verificationScore,
        notes,
      },
    });
  }

  // Sort descending by score
  return results.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// 5. SIMPLE VERIFICATION CHALLENGES (Deterministic fallback + AI generation)
// ---------------------------------------------------------------------------

const LOCAL_VERIFICATION_CHALLENGES: Record<string, SkillVerificationChallenge> = {
  react: {
    skill: "React",
    scenario: "A React component is re-rendering unexpectedly whenever an unrelated parent state updates.",
    question: "What architectural causes lead to this unnecessary rendering, and how would you investigate and fix it using standard React APIs?",
    expectedConcepts: ["useMemo", "useCallback", "React.memo", "dependency array", "React DevTools Profiler"],
  },
  typescript: {
    skill: "TypeScript",
    scenario: "You are designing a generic API client where response models depend dynamically on endpoint parameters.",
    question: "How do you construct Discriminated Unions or Generic constraints so the compiler prevents invalid property access at compile time?",
    expectedConcepts: ["discriminated union", "generics", "type narrowing", "keyof", "typeof"],
  },
  docker: {
    skill: "Docker",
    scenario: "A production container image size has ballooned to 1.8GB and deployment times have slowed down significantly.",
    question: "What containerization techniques and Dockerfile patterns would you apply to optimize caching and shrink image footprint?",
    expectedConcepts: ["multi-stage builds", ".dockerignore", "alpine", "layer caching", "single responsibility"],
  },
  sql: {
    skill: "SQL",
    scenario: "A high-frequency endpoint querying customer orders slows down from 20ms to 4.2 seconds under peak load.",
    question: "How would you diagnose the query bottleneck using EXPLAIN, and what indexing or query refactoring strategies would you implement?",
    expectedConcepts: ["EXPLAIN ANALYZE", "B-tree index", "composite index", "table scan", "avoid SELECT *"],
  },
  python: {
    skill: "Python",
    scenario: "A backend service needs to process concurrent external API webhooks without blocking the main event loop.",
    question: "How would you handle high-throughput I/O bound tasks using Python's modern concurrency primitives?",
    expectedConcepts: ["asyncio", "aiohttp", "coroutine", "thread pool executor", "event loop"],
  },
};

export async function generateSkillChallenge(skill: string): Promise<SkillVerificationChallenge> {
  const norm = normalizeSkill(skill);
  if (LOCAL_VERIFICATION_CHALLENGES[norm]) {
    return LOCAL_VERIFICATION_CHALLENGES[norm]!;
  }

  const systemPrompt = `You are a principal engineer conducting a 1-question practical verification for the skill "${skill}".
CRITICAL GROUNDING RULES:
- Create a realistic technical diagnostic scenario specifically for "${skill}".
- Do not mention or assume candidate-specific companies or tools outside the standard "${skill}" ecosystem.
- Output a valid JSON object matching:
{
  "skill": "${skill}",
  "scenario": "A concise real-world technical scenario (2 sentences)",
  "question": "A focused technical question asking how to diagnose and resolve it (1-2 sentences)",
  "expectedConcepts": ["concept1", "concept2", "concept3"]
}
JSON only.`;

  try {
    const res = await chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate verification question for ${skill}` },
    ]);
    const parsed = safeExtractJsonObject<SkillVerificationChallenge>(res);
    if (parsed && parsed.question && parsed.scenario) {
      return {
        skill,
        scenario: parsed.scenario,
        question: parsed.question,
        expectedConcepts: parsed.expectedConcepts || [skill, "Best practices", "Architecture"],
      };
    }
  } catch {
    // fallback
  }

  return {
    skill,
    scenario: `A mission-critical system leveraging ${skill} is exhibiting performance bottlenecks and maintainability challenges.`,
    question: `How would you approach architecting, optimizing, and ensuring test coverage for ${skill} in a scalable production setup?`,
    expectedConcepts: [skill, "Testing", "Optimization", "Architecture"],
  };
}

export async function evaluateSkillVerificationAnswer(
  skill: string,
  challenge: SkillVerificationChallenge,
  candidateAnswer: string
): Promise<SkillVerificationEvaluation> {
  const ans = (candidateAnswer || "").trim().toLowerCase();

  // Local deterministic keyword check
  let matchedConcepts = 0;
  const positivePoints: string[] = [];
  const improvementPoints: string[] = [];

  for (const concept of challenge.expectedConcepts) {
    if (ans.includes(concept.toLowerCase())) {
      matchedConcepts++;
      positivePoints.push(`Correctly referenced ${concept}`);
    } else {
      improvementPoints.push(`Consider mentioning ${concept} to demonstrate deeper architectural depth`);
    }
  }

  const lengthBonus = Math.min(20, Math.floor(ans.length / 30));
  const conceptScore = Math.round((matchedConcepts / Math.max(1, challenge.expectedConcepts.length)) * 70);
  const localScore = Math.min(95, Math.max(25, 20 + conceptScore + lengthBonus));
  const localPassed = localScore >= 65;

  // Enhance via AI if configured
  try {
    const prompt: ChatMessage[] = [
      {
        role: "system",
        content: `You are an expert technical evaluator. Evaluate the candidate's answer for the skill "${skill}".
CRITICAL GROUNDING RULES:
- Evaluate ONLY based on the candidate's actual answer text.
- Do not assume prior knowledge not stated in the response.
Scenario: ${challenge.scenario}
Question: ${challenge.question}
Expected concepts: ${challenge.expectedConcepts.join(", ")}

Output JSON only:
{
  "score": number between 30 and 98,
  "passed": boolean,
  "feedback": "2 sentence summary",
  "positivePoints": ["point1", "point2"],
  "improvementPoints": ["point1"]
}`,
      },
      { role: "user", content: `Candidate answer: ${candidateAnswer}` },
    ];

    const reply = await chat(prompt);
    const parsed = safeExtractJsonObject<SkillVerificationEvaluation>(reply);
    if (parsed && typeof parsed.score === "number" && Array.isArray(parsed.positivePoints)) {
      return {
        skill,
        score: Math.min(100, Math.max(0, Math.round(parsed.score))),
        passed: parsed.passed ?? parsed.score >= 65,
        feedback: parsed.feedback || "Answer demonstrates technical proficiency with minor gaps.",
        positivePoints: parsed.positivePoints,
        improvementPoints: parsed.improvementPoints || [],
      };
    }
  } catch {
    // fallback to local evaluation
  }

  return {
    skill,
    score: localScore,
    passed: localPassed,
    feedback: localPassed
      ? `Demonstrated clear practical command of ${skill} fundamentals and solution structure.`
      : `Answer provides partial context for ${skill} but lacked specific architectural patterns.`,
    positivePoints: positivePoints.length > 0 ? positivePoints : [`Identified core technical approach for ${skill}`],
    improvementPoints: improvementPoints.length > 0 ? improvementPoints : ["Provide more concrete code or metric examples"],
  };
}

// ---------------------------------------------------------------------------
// 6. FEATURE 3: CAREER TWIN LITE
// ---------------------------------------------------------------------------

export function buildCareerTwinLite(
  profile: UserProfile,
  job: IntelligenceJobInput,
  skillProofs: SkillProof[],
  interviewNotes: string[] = [],
  uid?: string
): CareerTwinLiteState {
  const candidateYears = parseYearsOfExperience(profile.yearsOfExperience || profile.ageOrExperience);
  const projects = profile.projects || [];

  // Determine strengths & weaknesses based on actual proof scores & job requirements
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const proof of skillProofs) {
    if (proof.score >= 70) {
      strengths.push(`${proof.skill} (${proof.score}/100 proof)`);
    } else if (proof.score < 50) {
      weaknesses.push(`${proof.skill} (${proof.score}/100 evidence)`);
    }
  }

  // Derive Likely Interview Areas
  const likelyInterviewAreas: string[] = [];
  for (const reqSkill of job.requiredSkills.slice(0, 4)) {
    likelyInterviewAreas.push(reqSkill);
  }
  if (!likelyInterviewAreas.includes("System Architecture")) {
    likelyInterviewAreas.push("System Architecture & Trade-offs");
  }
  if (projects.length > 0) {
    likelyInterviewAreas.push(`Deep Dive: ${projects[0]?.name || "Featured Project"} Architecture`);
  }

  // Retrieve stored interview results if available
  const recentInterviews = uid ? getStoredInterviewPerformance(uid, job.id) : [];
  const latestInterview = recentInterviews[0];

  const notesList = [...interviewNotes];
  if (latestInterview) {
    notesList.push(`Recent Mock Interview: ${latestInterview.score}/100 on ${new Date(latestInterview.completedAt).toLocaleDateString()}`);
    if (latestInterview.strengths.length > 0) {
      notesList.push(`Interview Strength: ${latestInterview.strengths[0]}`);
    }
  }

  // Role fit calculation based on actual requirements vs proof
  const relevantProofs = skillProofs.filter((p) =>
    job.requiredSkills.some((r) => r.toLowerCase() === p.skill.toLowerCase())
  );
  const avgProof = relevantProofs.length > 0
    ? Math.round(relevantProofs.reduce((acc, p) => acc + p.score, 0) / relevantProofs.length)
    : 65;

  const matchScoreValue =
    typeof job.matchScore === "number" && !isNaN(job.matchScore)
      ? job.matchScore
      : calculateDeterministicMatchScore(profile, job);
  let roleFitScore = Math.min(100, Math.max(0, Math.round(avgProof * 0.7 + matchScoreValue * 0.3)));
  if (latestInterview && latestInterview.score >= 80) {
    roleFitScore = Math.min(100, roleFitScore + 3);
  }

  return {
    candidateId: profile.fullName || "alex-carter",
    skills: skillProofs,
    projects,
    experienceYears: candidateYears,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    roleFitScore,
    likelyInterviewAreas: likelyInterviewAreas.slice(0, 5),
    interviewNotes: notesList,
    interviewPerformance: latestInterview,
    lastUpdated: new Date().toISOString(),
  };
}

export async function generateCandidateSpecificInterviewSimulation(
  profile: UserProfile,
  job: { role: string; company: string; description?: string | undefined; requiredSkills: string[]; experienceLevel?: string | undefined },
  twin: CareerTwinLiteState
): Promise<InterviewQuestionItem[]> {
  const featuredProj = twin.projects[0];
  const weakest = twin.weaknesses[0]?.split(" ")[0] || "Architecture";
  const primarySkill = job.requiredSkills[0] || "Core Stack";

  const fallbackQuestions: InterviewQuestionItem[] = [
    {
      id: "q-1",
      question: featuredProj
        ? `You highlighted building "${featuredProj.name}". What architectural decisions did you make to handle state and backend communication, and what would you re-architect today?`
        : `Can you walk through the most challenging software system you've shipped and the primary trade-offs involved?`,
      context: `Targeted at your demonstrated project background and technical ownership.`,
      targetSkillOrTopic: featuredProj ? featuredProj.name : "Project Architecture",
    },
    {
      id: "q-2",
      question: `In the context of ${job.role} at ${job.company}, how do you ensure high reliability and fast response times using ${primarySkill}?`,
      context: `Assesses alignment with ${job.company}'s core job requirements.`,
      targetSkillOrTopic: primarySkill,
    },
    {
      id: "q-3",
      question: `Your evidence profile shows potential room for depth in ${weakest}. How would you design or troubleshoot a system depending heavily on ${weakest}?`,
      context: `Targeted at identified gap area (${weakest}) to test proactive learning and fundamentals.`,
      targetSkillOrTopic: weakest,
    },
  ];

  try {
    const projectSummary = twin.projects.length > 0
      ? twin.projects.map((p) => `${p.name} (${p.description})`).join("; ")
      : "No candidate projects recorded.";

    const prompt: ChatMessage[] = [
      {
        role: "system",
        content: `You are a Lead Staff Engineer interviewing a candidate for ${job.role} at ${job.company}.
Generate 3 highly personalized, deep technical interview questions.
CRITICAL GROUNDING RULES:
- ONLY reference candidate projects and experiences that are explicitly provided below.
- NEVER invent, assume, or fabricate any projects, companies, certifications, or technologies not present in the candidate profile.
- If no projects are recorded, ask general conceptual and system design questions about the job's required skills (${job.requiredSkills.join(", ")}).
- Focus each question on concrete technical depth and trade-offs.

Candidate projects: ${projectSummary}
Strong areas: ${twin.strengths.join(", ") || "General engineering"}
Weak areas: ${twin.weaknesses.join(", ") || "None flagged"}

Output JSON array only:
[
  {
    "id": "q-1",
    "question": "Deep specific question referencing candidate's project or skill",
    "context": "Why this question is asked for this candidate",
    "targetSkillOrTopic": "Topic Name"
  }
]`,
      },
      { role: "user", content: `Generate 3 candidate-specific interview simulation questions.` },
    ];

    const reply = await chat(prompt);
    const parsed = safeExtractJsonArray<InterviewQuestionItem>(reply);
    if (Array.isArray(parsed) && parsed.length >= 2) {
      return parsed.slice(0, 3);
    }
  } catch {
    // fallback
  }

  return fallbackQuestions;
}

export async function evaluateInterviewSimulationAnswer(
  question: InterviewQuestionItem,
  answer: string
): Promise<InterviewEvaluationResult> {
  const ans = (answer || "").trim();

  // Local fallback evaluation
  const wordCount = ans.split(/\s+/).filter(Boolean).length;
  let score = 65;
  if (wordCount > 60) score += 15;
  if (wordCount > 120) score += 10;
  if (ans.toLowerCase().includes("because") || ans.toLowerCase().includes("trade-off") || ans.toLowerCase().includes("latency")) {
    score += 5;
  }
  score = Math.min(96, Math.max(40, score));

  try {
    const prompt: ChatMessage[] = [
      {
        role: "system",
        content: `You are an interview coach evaluating a candidate's answer.
CRITICAL GROUNDING RULES:
- Evaluate ONLY based on the candidate's actual answer text.
- Do not assume prior knowledge not stated in the response.
Question: "${question.question}"
Topic: "${question.targetSkillOrTopic}"

Output JSON only:
{
  "score": number between 40 and 98,
  "feedback": "2 sentence coaching summary",
  "strengths": ["point1", "point2"],
  "improvements": ["point1"],
  "suggestedFollowUp": "Optional follow-up question to probe deeper"
}`,
      },
      { role: "user", content: `Candidate answer:\n${ans}` },
    ];

    const reply = await chat(prompt);
    const parsed = safeExtractJsonObject<InterviewEvaluationResult>(reply);
    if (parsed && typeof parsed.score === "number" && Array.isArray(parsed.strengths)) {
      return {
        score: Math.min(100, Math.max(0, Math.round(parsed.score))),
        feedback: parsed.feedback || "Answer demonstrates technical proficiency.",
        strengths: parsed.strengths,
        improvements: parsed.improvements || [],
        suggestedFollowUp: parsed.suggestedFollowUp,
      };
    }
  } catch {
    // fallback
  }

  return {
    score,
    feedback: score >= 75
      ? "Strong articulation of practical decisions and technical rationale."
      : "Adequate response, but would benefit from mentioning measurable metrics and architectural trade-offs.",
    strengths: ["Addressed the core inquiry directly", "Clear communication style"],
    improvements: ["Incorporate the STAR framework (Situation, Task, Action, Result)", "Quantify operational impact with metrics"],
    suggestedFollowUp: `How would your solution behave under 10x traffic spikes?`,
  };
}

// ---------------------------------------------------------------------------
// 7. FEATURE 4: AI NEXT-BEST-ACTION CAREER COACH & EXECUTION ENGINE
// ---------------------------------------------------------------------------

export function determineNextBestAction(
  profile: UserProfile,
  job: IntelligenceJobInput,
  applicationStatus: ApplicationStatus = "Saved",
  successResult: ApplicationSuccessResult,
  skillProofs: SkillProof[],
  uid?: string
): NextBestAction {
  const completedIds = uid ? new Set(getCompletedActionIds(uid)) : new Set<string>();
  const isDone = (id: string) => completedIds.has(id);

  // 1. Critical Missing Required Skill Check (< 55)
  const weakOrMissingSkills = skillProofs.filter(
    (p) =>
      job.requiredSkills.some((r) => r.toLowerCase() === p.skill.toLowerCase()) &&
      p.score < 55
  );

  for (const target of weakOrMissingSkills) {
    const actionId = `act-skill-${job.id}-${normalizeSkill(target.skill)}`;
    if (!isDone(actionId)) {
      return {
        id: actionId,
        jobId: job.id,
        actionType: "IMPROVE_SKILL",
        title: `Strengthen ${target.skill} Evidence`,
        reason: `${target.skill} is a required skill for ${job.role} at ${job.company}, but your profile has limited supporting project proof (${target.score}/100 evidence).`,
        suggestedTask: `Complete a 30-minute mini-project or containerize a service demonstrating practical ${target.skill} usage.`,
        targetSkill: target.skill,
        effortMinutes: 35,
        estimatedImpact: 7, // +7 readiness points
        completed: false,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // 2. Application at Interview Stage
  if (applicationStatus === "Interview") {
    const primarySkill = job.requiredSkills[0] || "System Design";
    const actionId = `act-interview-${job.id}`;
    if (!isDone(actionId)) {
      return {
        id: actionId,
        jobId: job.id,
        actionType: "PREPARE_INTERVIEW",
        title: `Practice ${primarySkill} Interview Simulation`,
        reason: `Your application is in the Interview stage. Practicing role-specific questions for ${job.company} significantly improves technical fluency.`,
        suggestedTask: `Complete the 3-question personalized interview simulation in Career Twin.`,
        targetSkill: primarySkill,
        effortMinutes: 15,
        estimatedImpact: 8,
        completed: false,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // 3. Incomplete Profile (No Projects)
  const hasFewProjects = (profile.projects || []).length === 0;
  if (hasFewProjects) {
    const actionId = `act-project-${job.id}`;
    if (!isDone(actionId)) {
      return {
        id: actionId,
        jobId: job.id,
        actionType: "ADD_PROJECT",
        title: "Add a Relevant Candidate Project",
        reason: "Recruiters evaluate applied project evidence more heavily than listed skills. Your profile currently has no documented projects.",
        suggestedTask: `Add a project demonstrating ${job.requiredSkills.slice(0, 2).join(" and ")} to your candidate profile.`,
        targetSkill: job.requiredSkills[0],
        effortMinutes: 15,
        estimatedImpact: 10,
        completed: false,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // 4. Unverified Claimed Skills
  const unverifiedClaimed = skillProofs.find((p) => p.claimed && !p.verified && p.score < 70);
  if (unverifiedClaimed) {
    const actionId = `act-verify-${normalizeSkill(unverifiedClaimed.skill)}`;
    if (!isDone(actionId)) {
      return {
        id: actionId,
        jobId: job.id,
        actionType: "VERIFY_SKILL",
        title: `Verify ${unverifiedClaimed.skill} Fundamentals`,
        reason: `You claim ${unverifiedClaimed.skill}, but third-party proof is missing. A quick verification challenge confirms your competency.`,
        suggestedTask: `Complete the 1-question verification challenge for ${unverifiedClaimed.skill}.`,
        targetSkill: unverifiedClaimed.skill,
        effortMinutes: 5,
        estimatedImpact: 5,
        completed: false,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // 5. High Readiness Candidate -> Apply Now or Follow Up
  if (successResult.score >= 80) {
    if (applicationStatus === "Saved") {
      const actionId = `act-apply-${job.id}`;
      return {
        id: actionId,
        jobId: job.id,
        actionType: "APPLY_NOW",
        title: "Apply Now — High Readiness Confirmed",
        reason: `Your profile satisfies most core requirements (${successResult.score}/100 readiness). No major gaps block this application.`,
        suggestedTask: `Launch the career portal and submit your application with the 1-click tailored cover letter.`,
        effortMinutes: 10,
        estimatedImpact: 0,
        completed: isDone(actionId),
        createdAt: new Date().toISOString(),
      };
    }
    if (applicationStatus === "Applied" || applicationStatus === "Under Review") {
      const actionId = `act-followup-${job.id}`;
      return {
        id: actionId,
        jobId: job.id,
        actionType: "FOLLOW_UP",
        title: "Send a Warm Follow-up to Recruiter",
        reason: "Your application is under review and exhibits strong qualification alignment. A polite follow-up signals strong interest.",
        suggestedTask: `Draft an introductory check-in on LinkedIn with the engineering hiring manager or recruiter.`,
        effortMinutes: 10,
        estimatedImpact: 4,
        completed: isDone(actionId),
        createdAt: new Date().toISOString(),
      };
    }
  }

  // 6. Otherwise: Highest-Impact Identified Weakness
  const topWeakness = successResult.areasReducingReadiness[0] || "Reinforce project descriptions";
  const defaultActionId = `act-general-${job.id}`;
  return {
    id: defaultActionId,
    jobId: job.id,
    actionType: "UPDATE_RESUME",
    title: "Optimize Résumé Bullets for Target Role",
    reason: topWeakness,
    suggestedTask: `Highlight measurable performance improvements and specific frameworks in your experience bullets.`,
    effortMinutes: 20,
    estimatedImpact: 6,
    completed: isDone(defaultActionId),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Executes state transitions and updates persistent evidence when an action is completed.
 * This guarantees that clicking "Mark Completed" modifies real underlying candidate state.
 */
export function executeActionCompletion(
  uid: string,
  action: NextBestAction,
  profile: UserProfile,
  extraData?: {
    skillNote?: string | undefined;
    project?: CandidateProject | undefined;
    resumeText?: string | undefined;
    interviewScore?: number | undefined;
  }
): ActionCompletionResult {
  if (!uid) {
    return {
      actionId: action.id,
      actionType: action.actionType,
      success: false,
      message: "User authentication ID required to persist action.",
    };
  }

  // Mark action ID in persistent storage
  markActionCompletedInStorage(uid, action.id);

  let updatedProfile: UserProfile = { ...profile };
  let customMessage = `Action completed: ${action.title}`;

  switch (action.actionType) {
    case "IMPROVE_SKILL": {
      if (action.targetSkill) {
        saveStoredSkillImprovement(uid, {
          skill: action.targetSkill,
          taskTitle: action.title,
          note: extraData?.skillNote || action.suggestedTask,
          completedAt: new Date().toISOString(),
        });

        // Ensure skill is registered in profile skills
        const currentSkills = updatedProfile.skills || [];
        const norm = normalizeSkill(action.targetSkill);
        if (!currentSkills.some((s) => normalizeSkill(s) === norm)) {
          updatedProfile = {
            ...updatedProfile,
            skills: [...currentSkills, action.targetSkill],
          };
          saveProfile(uid, updatedProfile);
        }
        customMessage = `Practical evidence for ${action.targetSkill} recorded and profile updated. Application readiness recalculated!`;
      }
      break;
    }

    case "VERIFY_SKILL": {
      if (action.targetSkill) {
        const stored = getStoredSkillVerifications(uid);
        if (!stored[action.targetSkill.toLowerCase()]) {
          saveStoredSkillVerification(uid, action.targetSkill, 85, "passed");
        }
        customMessage = `Technical verification for ${action.targetSkill} recorded. Skill proof recalculated!`;
      }
      break;
    }

    case "ADD_PROJECT": {
      if (extraData?.project) {
        const projects = [...(updatedProfile.projects || []), extraData.project];
        updatedProfile = { ...updatedProfile, projects };
        saveProfile(uid, updatedProfile);
        customMessage = `Project "${extraData.project.name}" added to profile! Project relevance updated.`;
      } else if ((updatedProfile.projects || []).length === 0) {
        return {
          actionId: action.id,
          actionType: action.actionType,
          success: false,
          message: "Please add a project to your profile to substantiate your practical experience.",
        };
      } else {
        customMessage = "Candidate project proof confirmed. Application readiness recalculated!";
      }
      break;
    }

    case "UPDATE_RESUME": {
      if (extraData?.resumeText) {
        updatedProfile = { ...updatedProfile, resumeText: extraData.resumeText };
        saveProfile(uid, updatedProfile);
        customMessage = "Résumé text updated and parsed. Match score recalculated!";
      } else {
        customMessage = "Résumé optimization logged. Application analysis refreshed.";
      }
      break;
    }

    case "PREPARE_INTERVIEW":
    case "PRACTICE_INTERVIEW": {
      customMessage = "Interview preparation completed! Career Twin readiness updated.";
      break;
    }

    case "APPLY_NOW": {
      customMessage = "Application submission step initiated. Best of luck!";
      break;
    }

    case "FOLLOW_UP": {
      customMessage = "Recruiter follow-up check-in logged in your tracker.";
      break;
    }

    default: {
      customMessage = `Action completed: ${action.title}`;
    }
  }

  return {
    actionId: action.id,
    actionType: action.actionType,
    success: true,
    message: customMessage,
    updatedProfile,
  };
}

// ---------------------------------------------------------------------------
// 8. UNIFIED INTELLIGENCE PIPELINE ORCHESTRATOR & DASHBOARD AGGREGATOR
// ---------------------------------------------------------------------------

export function computeUnifiedCareerIntelligence(
  profile: UserProfile,
  job: IntelligenceJobInput,
  application?: ApplicationDocument | null,
  applicationsHistory: ApplicationDocument[] = [],
  uid?: string
): UnifiedCareerIntelligence {
  // Step 1: Resume Match
  const rawMatch =
    typeof job.matchScore === "number" && !isNaN(job.matchScore)
      ? job.matchScore
      : calculateDeterministicMatchScore(profile, job);
  const resumeMatch = Math.min(100, Math.max(0, rawMatch));

  // Step 2: Application Success Predictor
  const applicationSuccess = calculateApplicationSuccessScore(
    profile,
    job,
    applicationsHistory
  );

  // Step 3: Skill Proof Scores
  const skillProofs = calculateSkillProofScores(profile, job.requiredSkills, uid);

  // Step 4: Career Twin Lite
  const careerTwin = buildCareerTwinLite(
    profile,
    job,
    skillProofs,
    application?.notes ? [application.notes] : [],
    uid
  );

  // Step 5: Next-Best-Action Coach
  const status: ApplicationStatus = application?.status || "Saved";
  const nextBestAction = determineNextBestAction(
    profile,
    job,
    status,
    applicationSuccess,
    skillProofs,
    uid
  );

  return {
    jobId: job.id,
    jobTitle: job.role,
    company: job.company,
    resumeMatch,
    applicationSuccess,
    skillProofs,
    careerTwin,
    nextBestAction,
  };
}

/**
 * Single source of truth for Dashboard Application Intelligence aggregation.
 * Eliminates duplicated scoring code between routes and services.
 */
export function computeDashboardCareerIntelligence<TJob extends IntelligenceJobInput = IntelligenceJobInput>(
  profile: UserProfile | null,
  jobs: TJob[],
  applications: ApplicationDocument[] = [],
  uid?: string
): DashboardCareerIntelligenceSummary<TJob> | null {
  if (!profile) return null;

  const hasResume = Boolean(profile.resumeText && profile.resumeText.trim().length > 30);
  const candidateSkills = (profile.skills || []).map((s) => s.trim()).filter(Boolean);
  const hasSufficientData = hasResume || candidateSkills.length > 0;

  if (!jobs || jobs.length === 0) return null;

  const evaluatedJobs = jobs.slice(0, 8);
  const results = evaluatedJobs.map((job) => ({
    job,
    success: calculateApplicationSuccessScore(profile, job, applications),
  }));

  const avgReadiness = Math.round(
    results.reduce((acc, r) => acc + r.success.score, 0) / Math.max(1, results.length)
  );

  const sortedByReadiness = [...results].sort((a, b) => b.success.score - a.success.score);
  const topOpportunity = sortedByReadiness[0] || null;
  const needsAttention = sortedByReadiness[sortedByReadiness.length - 1] || null;

  const allSkills = candidateSkills.length > 0 ? candidateSkills : ["TypeScript", "React", "Node.js", "Docker"];
  const proofs = calculateSkillProofScores(profile, allSkills, uid);
  const weakestSkill = proofs.length > 0 ? proofs[proofs.length - 1]! : null;

  const nextAction = topOpportunity
    ? determineNextBestAction(
        profile,
        topOpportunity.job,
        "Saved",
        topOpportunity.success,
        proofs,
        uid
      )
    : null;

  return {
    avgReadiness: Math.min(100, Math.max(0, avgReadiness)),
    topOpportunity,
    needsAttention,
    weakestSkill,
    nextAction,
    hasSufficientData,
  };
}
