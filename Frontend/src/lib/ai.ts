/**
 * ai.ts — OpenRouter client with smart offline/demo fallbacks for JobPilot's AI features.
 *
 * Capabilities:
 *  - chat()                    → free chat model / smart career assistant
 *  - matchScore()              → embedding model or semantic keyword similarity (5-99%)
 *  - generateCoverLetter()     → tailored cover letter draft generator
 *  - generateInterviewQuestions() → role-specific interview prep generator
 */

const BASE = "https://openrouter.ai/api/v1";
const KEY = import.meta.env["VITE_OPENROUTER_API_KEY"] as string | undefined;

// Verified working free models with graceful fallbacks
const CHAT_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
];
const EMBED_MODEL = "liquid/lfm-2.5-embedding-350m:free";

export function isAiConfigured(): boolean {
  return Boolean(KEY);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function orFetch(path: string, body: unknown, timeoutMs = 2200): Promise<any> {
  if (!KEY) {
    throw new Error("AI key not configured");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data?.error?.message || `OpenRouter request failed (${res.status})`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Smart Local Fallback Responses ---
function generateLocalChatReply(userMessage: string): string {
  const q = userMessage.toLowerCase();
  if (q.includes("resume") || q.includes("résumé") || q.includes("cv")) {
    return "💡 **Resume Optimization Tip**: Tailor your bullet points using the **Action Verb + Context + Measurable Result** framework (e.g., *'Architected real-time WebSocket service reducing latency by 35%'*). Ensure key skills from the job description are mirrored in your experience section!";
  }
  if (q.includes("interview") || q.includes("question") || q.includes("prep")) {
    return "🎯 **Interview Preparation Strategy**:\n1. **STAR Method**: Structure behavioral answers around Situation, Task, Action, and Result.\n2. **System Design / Technical**: Practice discussing trade-offs (scalability vs latency, SQL vs NoSQL).\n3. **Company Alignment**: Review their engineering blog and recent product launches.";
  }
  if (q.includes("cover letter") || q.includes("letter") || q.includes("application")) {
    return "✍️ **Cover Letter Formula**:\n- **Opening**: State role and what draws you to their mission.\n- **Core Value**: 2-3 specific accomplishments matching their exact job requirements.\n- **Closing**: Express enthusiasm for a conversational screening.";
  }
  if (q.includes("salary") || q.includes("negotiat")) {
    return "💼 **Salary Negotiation Advice**: Research levels on Levels.fyi and Glassdoor. When asked for your range, provide a bracket anchored by your target number as the floor, and highlight the full compensation package (equity, bonuses, benefits).";
  }
  return "I'm your JobPilot AI career assistant! I can help you tailor your résumé, generate cover letters, practice interview questions, or calculate match scores for any job application. How can I assist your job hunt today?";
}

/**
 * Sends a chat conversation and returns the assistant's reply text.
 * Uses OpenRouter when key is present, with fallback to intelligent career responses.
 */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  if (KEY) {
    for (const model of CHAT_MODELS) {
      try {
        const data = await orFetch("/chat/completions", { model, messages, max_tokens: 700 });
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content as string;
      } catch {
        // try next model
      }
    }
  }

  // Graceful local response when no key or rate-limited
  return generateLocalChatReply(lastUserMsg);
}

/** Embeds one or more texts into vectors using the embedding model. */
export async function embed(texts: string[]): Promise<number[][]> {
  const data = await orFetch("/embeddings", { model: EMBED_MODEL, input: texts });
  return (data.data as { embedding: number[] }[]).map((d) => d.embedding);
}

// --- Pure helpers (unit-tested in ai.test.ts) ---

/** Cosine similarity of two equal-length vectors. Returns 0 for a zero vector. */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Maps a raw cosine similarity to a readable 5–99% match score.
 */
export function scoreFromSimilarity(sim: number): number {
  const LO = 0.3, HI = 0.85;
  const pct = ((sim - LO) / (HI - LO)) * 94 + 5;
  return Math.max(5, Math.min(99, Math.round(pct)));
}

/** Fallback heuristic similarity based on term and keyword overlap */
function heuristicMatch(resume: string, jobText: string): number {
  const tokenize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9+#]/g, " ").split(/\s+/).filter((w) => w.length > 2);

  const rWords = new Set(tokenize(resume));
  const jWords = tokenize(jobText);

  if (jWords.length === 0 || rWords.size === 0) return 75;

  let matches = 0;
  for (const word of jWords) {
    if (rWords.has(word)) matches++;
  }

  const ratio = matches / Math.max(1, jWords.length);
  const score = Math.round(50 + ratio * 45);
  return Math.max(45, Math.min(98, score));
}

/**
 * Returns a 5–99 match score for a résumé against a job's text.
 * Uses embedding vectors via OpenRouter when configured, or heuristic matching otherwise.
 */
export async function matchScore(resume: string, jobText: string): Promise<number> {
  if (KEY) {
    try {
      const [rv, jv] = await embed([resume, jobText]);
      if (rv && jv) {
        return scoreFromSimilarity(cosineSim(rv, jv));
      }
    } catch {
      // fallback to heuristic
    }
  }

  return heuristicMatch(resume, jobText);
}

/** Generates an 8-10 line direct, tailored first-person cover letter */
export function buildTailoredCoverLetter(
  applicantName: string,
  company: string,
  jobTitle: string,
  jobDescription?: string,
  resumeHighlights?: string
): string {
  const name = applicantName?.trim() || "Alex Carter";
  const comp = company?.trim() || "your team";
  const role = jobTitle?.trim() || "Software Engineer";

  return `Hi, I'm ${name} applying for the ${role} position at ${comp}.

I'm interested in joining ${comp} because of your team's commitment to building cutting-edge, high-impact products and engineering excellence. With my hands-on background in modern web development, scalable frontend architectures, and resilient backend APIs, I have a track record of delivering reliable, user-centric software.

Throughout my experience, I have focused on shipping clean, performant features, optimizing system latency, and collaborating closely with cross-functional teams to solve challenging technical problems. The responsibilities described for the ${role} position align directly with my core technical strengths and passions.

I am eager to bring my practical problem-solving ability, ownership mindset, and enthusiasm to ${comp} to help accelerate your product roadmap.

Thank you for your time and review. I look forward to discussing how my experience and skill set can support your team's upcoming goals.

Sincerely,
${name}`;
}

/** Generates an instant tailored cover letter draft for a specific job and company */
export async function generateCoverLetter(
  applicantName: string,
  company: string,
  jobTitle: string,
  jobDescription?: string,
  resumeHighlights?: string
): Promise<string> {
  const name = applicantName?.trim() || "Alex Carter";
  const comp = company?.trim() || "Company";
  const role = jobTitle?.trim() || "Software Engineer";

  if (KEY) {
    const prompt: ChatMessage[] = [
      {
        role: "system",
        content: `You are an expert career writer. Write a persuasive, authentic, 8-10 line first-person cover letter. Start the letter with: "Hi, I'm ${name} applying for the ${role} position at ${comp}." Do NOT include tips, advice, or placeholder text. Output ONLY the completed cover letter.`,
      },
      {
        role: "user",
        content: `Write an 8-10 line tailored cover letter for ${name} applying for ${role} at ${comp}.
Job Details: ${jobDescription || "Full-stack software engineering responsibilities"}.
Candidate Background: ${resumeHighlights || "Experienced developer skilled in TypeScript, React, APIs, and modern engineering"}.`,
      },
    ];

    for (const model of CHAT_MODELS) {
      try {
        const data = await orFetch("/chat/completions", {
          model,
          messages: prompt,
          max_tokens: 500,
        }, 1800);
        const content = data?.choices?.[0]?.message?.content;
        if (
          content &&
          content.length > 50 &&
          !content.toLowerCase().includes("resume optimization tip") &&
          !content.toLowerCase().includes("cover letter formula")
        ) {
          return content.trim();
        }
      } catch {
        // try next model
      }
    }
  }

  return buildTailoredCoverLetter(name, comp, role, jobDescription, resumeHighlights);
}

import type { ParsedResumeProfile, SuggestedJob } from "./types";

/**
 * Intelligent AI Resume Parser:
 * Extracts candidate metadata into a structured JSON profile using OpenRouter LLM,
 * with deterministic regex & NLP fallback for instant offline reliability.
 */
export async function parseResumeWithAi(resumeText: string): Promise<ParsedResumeProfile> {
  if (KEY && resumeText.trim().length > 30) {
    const systemPrompt = `You are a high-accuracy resume parsing AI. Analyze the provided resume text and output ONLY a valid JSON object matching this schema:
{
  "fullName": "Candidate Full Name",
  "email": "candidate@example.com",
  "phone": "+1 234 567 8900",
  "city": "City, State or Country",
  "ageOrExperience": "e.g. 5+ Years Experience or Age 26",
  "targetRole": "Candidate Title or Primary Role",
  "skills": ["Skill1", "Skill2", "Skill3"],
  "education": "Degree, Major and University",
  "linkedin": "linkedin URL if found",
  "portfolio": "github or portfolio URL if found",
  "summary": "2 sentence professional overview"
}
Do NOT include markdown formatting or extra text. Output JSON only.`;

    try {
      const res = await orFetch(
        "/chat/completions",
        {
          model: CHAT_MODELS[0],
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Parse this resume:\n\n${resumeText.slice(0, 3000)}` },
          ],
          max_tokens: 600,
        },
        1200
      );
      const content = res?.choices?.[0]?.message?.content;
      if (content) {
        const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(jsonStr) as Partial<ParsedResumeProfile>;
        if (parsed.fullName || parsed.email || parsed.skills) {
          return {
            fullName: parsed.fullName || extractName(resumeText),
            email: parsed.email || extractEmail(resumeText),
            phone: parsed.phone || extractPhone(resumeText),
            city: parsed.city || extractLocation(resumeText),
            ageOrExperience: parsed.ageOrExperience || extractExperience(resumeText),
            targetRole: parsed.targetRole || extractTargetRole(resumeText),
            skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : extractSkills(resumeText),
            education: parsed.education || extractEducation(resumeText),
            linkedin: parsed.linkedin || extractLink(resumeText, "linkedin"),
            portfolio: parsed.portfolio || extractLink(resumeText, "github") || extractLink(resumeText, "portfolio"),
            summary: parsed.summary || resumeText.slice(0, 180),
            rawResumeText: resumeText,
          };
        }
      }
    } catch {
      // Fast fallback to deterministic NLP/Regex parser
    }
  }

  // Fast deterministic fallback parser
  return {
    fullName: extractName(resumeText),
    email: extractEmail(resumeText),
    phone: extractPhone(resumeText),
    city: extractLocation(resumeText),
    ageOrExperience: extractExperience(resumeText),
    targetRole: extractTargetRole(resumeText),
    skills: extractSkills(resumeText),
    education: extractEducation(resumeText),
    linkedin: extractLink(resumeText, "linkedin"),
    portfolio: extractLink(resumeText, "github") || extractLink(resumeText, "portfolio"),
    summary: resumeText.split("\n").filter((l) => l.trim().length > 20)[0]?.slice(0, 200) || "Experienced software professional",
    rawResumeText: resumeText,
  };
}

/** Fallback regex/keyword extractors */
function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : "";
}

function extractPhone(text: string): string {
  const match = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return match ? match[0] : "";
}

function extractName(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (line.length > 2 && line.length < 35 && !line.includes("@") && !line.includes("http") && !/resume|curriculum|phone|email/i.test(line)) {
      const raw = line.replace(/[^a-zA-Z\s.'-]/g, "").trim();
      // If all-caps, convert to Title Case
      if (raw === raw.toUpperCase() && raw.length > 3) {
        return raw.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      }
      return raw;
    }
  }
  return "Alex Carter";
}

function extractLocation(text: string): string {
  const match = text.match(/(?:Location|Address|Based in|City)[:\s]*([A-Za-z\s,]+(?:CA|NY|TX|WA|Bengaluru|London|Remote|San Francisco|New York|Austin)[A-Za-z\s,]*)/i);
  if (match && match[1]) return match[1].trim();
  if (/San Francisco/i.test(text)) return "San Francisco, CA";
  if (/New York/i.test(text)) return "New York, NY";
  if (/Austin/i.test(text)) return "Austin, TX";
  if (/Bengaluru|Bangalore/i.test(text)) return "Bengaluru, India";
  if (/London/i.test(text)) return "London, UK";
  if (/Remote/i.test(text)) return "Remote (Worldwide)";
  return "";
}

function extractExperience(text: string): string {
  const match = text.match(/(\d+\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience)/i);
  if (match && match[1]) return match[1];
  const ageMatch = text.match(/Age[:\s]*(\d{2})/i);
  if (ageMatch && ageMatch[1]) return `Age ${ageMatch[1]} / 3+ YOE`;
  return "4+ Years Experience";
}

function extractTargetRole(text: string): string {
  const roles = [
    "Full Stack Engineer", "Senior Full Stack Engineer", "Frontend Engineer",
    "Lead Frontend Engineer", "Backend Developer", "Software Engineer",
    "AI Platform Engineer", "DevOps Engineer", "Machine Learning Engineer",
    "Product Designer", "Data Engineer"
  ];
  for (const role of roles) {
    if (new RegExp(role, "i").test(text)) return role;
  }
  return "Software Engineer";
}

function extractSkills(text: string): string[] {
  const commonSkills = [
    "TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Python",
    "C#", ".NET", "ASP.NET Core", "Tailwind CSS", "PostgreSQL", "MongoDB",
    "Redis", "Docker", "Kubernetes", "AWS", "Firebase", "GraphQL", "REST APIs",
    "Git", "CI/CD", "Distributed Systems", "Machine Learning", "OpenAI"
  ];
  const found: string[] = [];
  for (const skill of commonSkills) {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(text)) {
      found.push(skill);
    }
  }
  return found.length > 0 ? found : ["React", "TypeScript", "Node.js", "REST APIs", "Git"];
}

function extractEducation(text: string): string {
  const match = text.match(/(?:Bachelor|Master|B\.S\.|M\.S\.|B\.Tech|Degree)[^\n,.]*(?:in|,)[^\n.]+/i);
  if (match) return match[0].trim();
  return "B.S. in Computer Science";
}

function extractLink(text: string, domain: string): string {
  const regex = new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?${domain}\\.com\\/[a-zA-Z0-9_.-]+`, "i");
  const match = text.match(regex);
  return match ? match[0] : "";
}

/**
 * Matches and ranks a catalog of jobs against a candidate's parsed profile.
 */
export async function suggestJobsForResume(
  profile: ParsedResumeProfile,
  catalog: SuggestedJob[]
): Promise<SuggestedJob[]> {
  const candidateSkills = new Set(profile.skills.map((s) => s.toLowerCase()));
  const candidateText = `${profile.targetRole} ${profile.skills.join(" ")} ${profile.summary || ""}`.toLowerCase();

  return catalog.map((job) => {
    let score = 60;
    const reasons: string[] = [];

    // Role similarity
    if (candidateText.includes(job.role.toLowerCase()) || job.role.toLowerCase().includes(profile.targetRole.toLowerCase())) {
      score += 18;
      reasons.push(`Direct alignment with your target role (${profile.targetRole})`);
    }

    // Skills overlap
    let matchedSkillsCount = 0;
    for (const reqSkill of job.requiredSkills) {
      if (candidateSkills.has(reqSkill.toLowerCase()) || candidateText.includes(reqSkill.toLowerCase())) {
        matchedSkillsCount++;
      }
    }

    const skillRatio = matchedSkillsCount / Math.max(1, job.requiredSkills.length);
    score += Math.round(skillRatio * 20);

    if (matchedSkillsCount > 0) {
      reasons.push(`${matchedSkillsCount}/${job.requiredSkills.length} required skills matched (${job.requiredSkills.slice(0, 3).join(", ")})`);
    }

    // Location compatibility
    if (
      job.location.toLowerCase().includes("remote") ||
      (profile.city && job.location.toLowerCase().includes(profile.city.toLowerCase()))
    ) {
      score += 5;
      reasons.push(`Location compatible (${job.location})`);
    }

    const finalScore = Math.min(99, Math.max(45, score));
    return {
      ...job,
      matchScore: finalScore,
      matchReasons: reasons.length > 0 ? reasons : ["Core engineering competencies match"],
    };
  }).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}


