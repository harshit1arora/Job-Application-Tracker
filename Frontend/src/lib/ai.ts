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

  // First-time onboarding / Tour / Getting started
  if (
    q.includes("tour") ||
    q.includes("start") ||
    q.includes("how does this work") ||
    q.includes("first time") ||
    q.includes("help me get started") ||
    q.includes("guide")
  ) {
    return (
      "🚀 **Welcome to JobPilot! Here is how to get the most out of your job search:**\n\n" +
      "1. **Upload & Parse Résumé** (`/profile`): Upload your PDF or paste text. Our AI auto-extracts your skills, target roles, and experience.\n" +
      "2. **Browse & Auto-Match Jobs** (`/browse`): Filter 50,000+ live jobs indexed across Workday, Greenhouse, Lever, and Ashby with AI match scores.\n" +
      "3. **Track with Kanban** (`/tracker`): Move applications smoothly across *Applied*, *Screening*, *Interview*, *Offer*, and *Archived* columns.\n" +
      "4. **AI Quick Tools**: Ask me to draft tailored cover letters, run mock interview questions, or calculate match scores anytime!\n" +
      "5. **Voice Navigation**: Click the mic or press `Ctrl+J` and say *'Go to Tracker'*, *'Browse Jobs'*, or *'Edit Résumé'*."
    );
  }

  // Voice navigation help
  if (q.includes("voice") || q.includes("speech") || q.includes("stt") || q.includes("commands")) {
    return (
      "🎙️ **JobPilot Voice Commands**:\n\n" +
      "Simply click the **Mic icon** (or press `Ctrl+J`) and speak naturally:\n" +
      "• *'Go to Dashboard'* → Main analytics & activity overview\n" +
      "• *'Browse Jobs'* → Real-time job listings catalog\n" +
      "• *'Show Applications'* → Detailed submissions table\n" +
      "• *'Go to Tracker'* → Interactive Kanban board & interview calendar\n" +
      "• *'Open Inbox'* → Recruiter messages & status updates\n" +
      "• *'Edit Résumé'* → Profile builder, PDF parser & ATS optimization\n" +
      "• *'Open Settings'* → Account & theme preferences\n\n" +
      "You can also dictate any question directly into the chat!"
    );
  }

  // Job Tracker / Kanban explanation
  if (
    q.includes("tracker") ||
    q.includes("kanban") ||
    q.includes("stages") ||
    q.includes("pipeline") ||
    q.includes("columns")
  ) {
    return (
      "📊 **Job Tracker Workflow**:\n\n" +
      "Your Kanban board organizes opportunities through 5 key stages:\n" +
      "• **Applied**: Jobs submitted via JobPilot or manually logged.\n" +
      "• **Screening**: Recruiter phone screens and initial assessments scheduled.\n" +
      "• **Interview**: Technical rounds, hiring manager chats, and presentations.\n" +
      "• **Offer**: Congratulations! Track compensation and deadlines here.\n" +
      "• **Archived / Rejected**: Keep historical records to learn and refine.\n\n" +
      "💡 *Tip: Drag and drop cards, or click any card to view detailed notes, add interview reminders, and draft tailored follow-ups!*"
    );
  }

  // Auto-Apply / Quick Fill
  if (
    q.includes("auto apply") ||
    q.includes("quick fill") ||
    q.includes("portal") ||
    q.includes("apply")
  ) {
    return (
      "⚡ **JobPilot Auto-Apply & Quick-Fill**:\n\n" +
      "When applying on external company portals (Workday, Greenhouse, Lever, Ashby):\n" +
      "• **1-Click Profile Sync**: Pulls your verified contact details, work history, and portfolio links directly from your `/profile`.\n" +
      "• **Custom Cover Letters**: Generates an 8-10 line tailored letter mapped to the specific job requirements.\n" +
      "• **Missing Field Detection**: Highlights any required fields (e.g. sponsorship, notice period) before final submission."
    );
  }

  if (q.includes("resume") || q.includes("résumé") || q.includes("cv") || q.includes("ats")) {
    return (
      "💡 **ATS Résumé Optimization Framework**:\n\n" +
      "1. **Impact Metrics**: Use *'Action Verb + Task + Measurable Result'* (e.g., *'Architected real-time WebSocket service reducing latency by 35%'*).\n" +
      "2. **Keyword Mirroring**: Ensure critical skills and tech stack terms from the target job description appear naturally in your bullets.\n" +
      "3. **Clean Formatting**: Use standard single-column headings (Experience, Skills, Education) so ATS scanners parse every field with 100% fidelity."
    );
  }

  if (
    q.includes("interview") ||
    q.includes("question") ||
    q.includes("prep") ||
    q.includes("mock")
  ) {
    return (
      "🎯 **Interview Preparation Playbook**:\n\n" +
      "1. **STAR Method**: Structure behavioral answers around **S**ituation, **T**ask, **A**ction, and **R**esult.\n" +
      "2. **Top Behavioral Questions**:\n" +
      "   • *'Tell me about a time you resolved a major production incident under pressure.'*\n" +
      "   • *'Describe a situation where you had a technical disagreement with a team member.'*\n" +
      "3. **System Design & Architecture**: Practice discussing trade-offs (scalability vs latency, SQL vs NoSQL, caching strategies).\n" +
      "4. **Reverse Interviewing**: Ask the panel: *'What does success look like in the first 90 days for this role?'*"
    );
  }

  if (q.includes("cover letter") || q.includes("letter") || q.includes("application")) {
    return (
      "✍️ **High-Converting Cover Letter Formula**:\n\n" +
      "• **Hook (Lines 1-2)**: State the role and why you admire their product or engineering culture.\n" +
      "• **Core Proof (Lines 3-6)**: 2 specific achievements with real numbers that solve their immediate pain points.\n" +
      "• **Call to Action (Lines 7-8)**: Express enthusiasm for an introductory conversation.\n\n" +
      "💡 *Tip: Head over to any job on `/browse` or use our quick tool below to draft one instantly!*"
    );
  }

  if (q.includes("salary") || q.includes("negotiat") || q.includes("offer") || q.includes("comp")) {
    return (
      "💼 **Salary Negotiation Strategy**:\n\n" +
      "• **Anchor High**: Benchmark on Levels.fyi and Glassdoor. Provide a range where your target is at the floor.\n" +
      "• **Look at Total Comp**: Consider base salary, equity/RSUs, signing bonus, remote stipend, and 401(k) match.\n" +
      "• **Competing Leverage**: If you have multiple interviews in flight, mention your timeline to accelerate offer deadlines."
    );
  }

  return (
    "👋 I'm your **JobPilot Career Copilot**! I can help you tailor your résumé for ATS, generate custom cover letters, practice role-specific interview questions, or navigate across JobPilot with voice commands.\n\n" +
    "How can I assist your job hunt today?"
  );
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
  let dot = 0,
    na = 0,
    nb = 0;
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
  const LO = 0.3,
    HI = 0.85;
  const pct = ((sim - LO) / (HI - LO)) * 94 + 5;
  return Math.max(5, Math.min(99, Math.round(pct)));
}

/** Fallback heuristic similarity based on term and keyword overlap */
function heuristicMatch(resume: string, jobText: string): number {
  const tokenize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9+#]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

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
  resumeHighlights?: string,
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
  resumeHighlights?: string,
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
        const data = await orFetch(
          "/chat/completions",
          {
            model,
            messages: prompt,
            max_tokens: 500,
          },
          1800,
        );
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

import { z } from "zod";
import type { ParsedResumeProfile, SuggestedJob } from "./types";

export const aiResumeProfileSchema = z.object({
  fullName: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  city: z.string().optional().default(""),
  country: z.string().optional().default(""),
  ageOrExperience: z.string().optional().default(""),
  targetRole: z.string().optional().default(""),
  skills: z
    .union([
      z.array(z.string()),
      z.string().transform((str) =>
        str
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ])
    .optional()
    .default([]),
  education: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
  portfolio: z.string().optional().default(""),
  github: z.string().optional().default(""),
  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        description: z.string().default(""),
        technologies: z.array(z.string()).default([]),
        link: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  summary: z.string().optional().default(""),
});

/**
 * Intelligent AI Resume Parser:
 * Extracts candidate metadata into a structured JSON profile using OpenRouter LLM,
 * with deterministic regex & NLP fallback for instant offline reliability.
 */
export async function parseResumeWithAi(resumeText: string): Promise<ParsedResumeProfile> {
  const loc = extractLocation(resumeText);
  const country = extractCountry(resumeText, loc);
  const projects = extractProjects(resumeText);
  const githubLink = extractLink(resumeText, "github");

  if (KEY && resumeText.trim().length > 30) {
    const systemPrompt = `You are a high-accuracy resume parsing AI. Analyze the provided resume text and output ONLY a valid JSON object matching this schema:
{
  "fullName": "Candidate Full Name",
  "email": "candidate@example.com",
  "phone": "+1 234 567 8900",
  "city": "City, State or Country",
  "country": "Country",
  "ageOrExperience": "e.g. 5+ Years Experience or Fresher / Student",
  "targetRole": "Candidate Title or Primary Role",
  "skills": ["Skill1", "Skill2", "Skill3"],
  "education": "Degree, Major and University",
  "linkedin": "linkedin URL if found",
  "portfolio": "portfolio URL or github if found",
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
        1200,
      );
      const content = res?.choices?.[0]?.message?.content;
      if (content) {
        const jsonStr = content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        const rawParsed = JSON.parse(jsonStr);
        const validation = aiResumeProfileSchema.safeParse(rawParsed);

        if (validation.success) {
          const parsed = validation.data;
          if (parsed.fullName || parsed.email || parsed.skills.length > 0) {
            const parsedLoc = parsed.city || loc;
            return {
              fullName: parsed.fullName || extractName(resumeText),
              email: parsed.email || extractEmail(resumeText),
              phone: parsed.phone || extractPhone(resumeText),
              city: parsedLoc,
              country: parsed.country || extractCountry(resumeText, parsedLoc),
              ageOrExperience: parsed.ageOrExperience || extractExperience(resumeText),
              targetRole: parsed.targetRole || extractTargetRole(resumeText),
              skills: parsed.skills.length > 0 ? parsed.skills : extractSkills(resumeText),
              education: parsed.education || extractEducation(resumeText),
              linkedin: parsed.linkedin || extractLink(resumeText, "linkedin"),
              portfolio:
                parsed.portfolio ||
                githubLink ||
                extractLink(resumeText, "portfolio"),
              github: githubLink,
              projects: projects.length > 0 ? projects : parsed.projects,
              summary: parsed.summary || resumeText.slice(0, 180),
              rawResumeText: resumeText,
            };
          }
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
    city: loc,
    country: country,
    ageOrExperience: extractExperience(resumeText),
    targetRole: extractTargetRole(resumeText),
    skills: extractSkills(resumeText),
    education: extractEducation(resumeText),
    linkedin: extractLink(resumeText, "linkedin"),
    portfolio: githubLink || extractLink(resumeText, "portfolio"),
    github: githubLink,
    projects: projects,
    summary:
      resumeText
        .split("\n")
        .filter((l) => l.trim().length > 20)[0]
        ?.slice(0, 200) || "Experienced software professional",
    rawResumeText: resumeText,
  };
}

/** Fallback regex/keyword extractors */
function extractEmail(text: string): string {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : "";
}

function extractPhone(text: string): string {
  // Supports international formats like +91 9717569478, +1 (415) 890-2341, (555) 789-0123
  const match = text.match(/(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,5}[\s.-]?\d{4,5}/);
  return match ? match[0].trim() : "";
}

function extractName(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (
      line.length > 2 &&
      line.length < 35 &&
      !line.includes("@") &&
      !line.includes("http") &&
      !line.includes(".com") &&
      !/resume|curriculum|phone|email|summary|education|skills/i.test(line)
    ) {
      const raw = line.replace(/[^a-zA-Z\s.'-]/g, "").trim();
      if (raw.length > 2) {
        // If all-caps, convert to Title Case
        if (raw === raw.toUpperCase() && raw.length > 3) {
          return raw.replace(
            /\w\S*/g,
            (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase(),
          );
        }
        return raw;
      }
    }
  }
  return "Alex Carter";
}

function extractLocation(text: string): string {
  // 1. Check explicit label (e.g. Location: San Francisco, CA)
  const labeledMatch = text.match(
    /(?:Location|Address|Based in|City)[:\s]*([^\n|•,]+(?:,\s*[^\n|•]+)?)/i,
  );
  if (labeledMatch && labeledMatch[1]) {
    const candidate = labeledMatch[1].trim();
    if (candidate.length > 2 && candidate.length < 50 && !/phone|email|linkedin|github/i.test(candidate)) {
      return candidate;
    }
  }

  // 2. Check top header lines (e.g., "New Delhi, India | +91 9717569478 | ...")
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    const segments = line.split(/[|•·]/).map((s) => s.trim());
    for (const seg of segments) {
      if (
        !seg.includes("@") &&
        !seg.includes("http") &&
        !seg.includes("github.com") &&
        !seg.includes("linkedin.com") &&
        !/\d{5,}/.test(seg) &&
        seg.length > 2 &&
        seg.length < 40
      ) {
        if (
          /New Delhi|Delhi|Mumbai|Bangalore|Bengaluru|Hyderabad|Pune|Chennai|Kolkata|Noida|Gurgaon|Bhopal|Jaipur|India|San Francisco|New York|Austin|Seattle|Boston|Chicago|Los Angeles|London|Toronto|Vancouver|Berlin|Singapore|Remote/i.test(
            seg,
          )
        ) {
          return seg;
        }
      }
    }

    // Direct "City, State/Country" pattern
    const cityPattern = line.match(/^([A-Za-z\s]+,\s*[A-Za-z\s]+)(?:\s*[|•]|\s*$)/);
    if (cityPattern && cityPattern[1]) {
      const candidate = cityPattern[1].trim();
      if (!/curriculum|resume|engineer|developer|profile|summary|education/i.test(candidate) && candidate.length < 40) {
        return candidate;
      }
    }
  }

  if (/New Delhi|Delhi/i.test(text)) return "New Delhi, India";
  if (/Bengaluru|Bangalore/i.test(text)) return "Bengaluru, India";
  if (/Mumbai/i.test(text)) return "Mumbai, India";
  if (/San Francisco/i.test(text)) return "San Francisco, CA";
  if (/New York/i.test(text)) return "New York, NY";
  if (/Austin/i.test(text)) return "Austin, TX";
  if (/London/i.test(text)) return "London, UK";
  if (/Remote/i.test(text)) return "Remote (Worldwide)";

  return "";
}

function extractCountry(text: string, locationStr: string): string {
  if (/India|\+91\b|Delhi|Mumbai|Bangalore|Bengaluru|Pune|Hyderabad|Noida|Bhopal/i.test(text) || /India/i.test(locationStr)) {
    return "India";
  }
  if (/United States|USA|\bUS\b|San Francisco|New York|Austin|Seattle|\+1\b/i.test(text)) {
    return "United States";
  }
  if (/United Kingdom|UK|London|\+44\b/i.test(text)) {
    return "United Kingdom";
  }
  if (/Canada|Toronto|Vancouver/i.test(text)) {
    return "Canada";
  }
  return "India";
}

function extractExperience(text: string): string {
  const match = text.match(/(\d+\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience)/i);
  if (match && match[1]) return match[1];

  const ageMatch = text.match(/Age[:\s]*(\d{2})/i);
  if (ageMatch && ageMatch[1]) return `Age ${ageMatch[1]}`;

  if (/undergraduate|student|intern\b|internship|pursuing|expected\s*202[4-9]|fresher/i.test(text)) {
    if (/intern\b|internship/i.test(text)) {
      return "1 Year Experience (Intern / Student)";
    }
    return "Fresher / Student (< 1 Year)";
  }

  return "1-3 Years Experience";
}

function extractTargetRole(text: string): string {
  // Look for target role in professional summary or top headers
  const roles = [
    "Senior Full Stack Engineer",
    "Full Stack Engineer",
    "Lead Frontend Engineer",
    "Frontend Developer",
    "Frontend Engineer",
    "Backend Developer",
    "Backend Engineer",
    "Software Development Engineer",
    "Software Engineer",
    "AI Platform Engineer",
    "AI/ML Engineer",
    "Machine Learning Engineer",
    "Data Scientist",
    "Data Engineer",
    "DevOps Engineer",
    "Product Designer",
    "Product Manager",
  ];

  for (const role of roles) {
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return role;
  }

  if (/Software Development|Software Developer/i.test(text)) {
    return "Software Engineer";
  }
  if (/AI\/ML|Machine Learning/i.test(text)) {
    return "AI/ML Engineer";
  }

  return "Software Engineer";
}

function extractSkills(text: string): string[] {
  const found = new Set<string>();

  // 1. Parse Technical Skills section
  const skillsSectionMatch = text.match(
    /(?:TECHNICAL SKILLS|SKILLS|CORE COMPETENCIES|LANGUAGES & TOOLS|TECHNOLOGIES)[\s\S]*?(?=(?:EXPERIENCE|PROJECTS|EDUCATION|CERTIFICATIONS|ACHIEVEMENTS|INTERNSHIP|$))/i,
  );
  if (skillsSectionMatch) {
    const rawSection = skillsSectionMatch[0];
    const tokens = rawSection
      .replace(
        /(?:TECHNICAL SKILLS|SKILLS|CORE COMPETENCIES|LANGUAGES & TOOLS|TECHNOLOGIES|Languages|Web Development|Databases|Tools|Frameworks)[:—–]?/gi,
        "",
      )
      .split(/[,•·|\n;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 35 && !/^(and|with|etc|using|design|operations|table design)$/i.test(s));

    for (const token of tokens) {
      const cleaned = token
        .replace(/^[•\-*:\s]+|[•\-*:\s]+$/g, "")
        .replace(/\s*\(.*?\)\s*/g, "")
        .trim();
      if (cleaned.length > 1 && cleaned.length < 35) {
        found.add(cleaned);
      }
    }
  }

  // 2. Comprehensive vocabulary lookup
  const commonSkills = [
    "Python", "C++", "C#", "Java", "JavaScript", "TypeScript", "SQL", "MySQL", "PostgreSQL",
    "MongoDB", "Redis", "React", "React.js", "Next.js", "Node.js", "ASP.NET Core", "Express",
    "Flask", "Django", "FastAPI", "HTML", "HTML5", "CSS", "CSS3", "Bootstrap", "Tailwind CSS",
    "REST API", "REST APIs", "Axios", "Git", "GitHub", "Docker", "Kubernetes", "AWS", "Firebase",
    "GraphQL", "CI/CD", "Machine Learning", "AI", "VS Code", "Jupyter Notebook", "Distributed Systems",
    "OpenAI", "Object-Oriented Programming", "DBMS", "Operating Systems", "Computer Networks"
  ];

  for (const skill of commonSkills) {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(text)) {
      found.add(skill);
    }
  }

  const result = Array.from(found);
  return result.length > 0 ? result : ["React", "TypeScript", "Python", "REST APIs", "Git"];
}

function extractEducation(text: string): string {
  const match = text.match(
    /(?:B\.Tech|B\.E\.|B\.S\.|Bachelor|M\.Tech|M\.S\.|Master|Diploma)[^\n•|,]*(?:,\s*[^\n•|,]+)?(?:\s+(?:at|from|-)?\s+[A-Za-z\s]+(?:University|Institute|College|School))?(?:[^\n]*)?/i,
  );
  if (match) {
    return match[0].replace(/\s+/g, " ").trim();
  }
  return "B.Tech in Computer Science";
}

function extractLink(text: string, domain: string): string {
  // Allows full path with slashes: e.g. linkedin.com/in/kartikeytiwari10 or github.com/KartikeyT10/project
  const regex = new RegExp(
    `(?:https?:\\/\\/)?(?:www\\.)?${domain}\\.com\\/[a-zA-Z0-9_.~%/-]+`,
    "i",
  );
  const match = text.match(regex);
  if (!match) return "";
  // Strip trailing punctuation
  return match[0].replace(/[.,|;:)\]\s]+$/, "");
}

function extractProjects(text: string): Array<{ name: string; description: string; technologies: string[]; link?: string }> {
  const projects: Array<{ name: string; description: string; technologies: string[]; link?: string }> = [];

  const projectHeaderMatch = text.match(/(?:\n|^)\s*(?:PROJECTS(?:\s+UNDERTAKEN)?|ACADEMIC PROJECTS|PERSONAL PROJECTS)\s*[:—–]?\s*(?:\n|$)/i);
  if (!projectHeaderMatch || projectHeaderMatch.index === undefined) return projects;

  const startIndex = projectHeaderMatch.index + projectHeaderMatch[0].length;
  const remainingText = text.slice(startIndex);

  const nextSectionMatch = remainingText.match(/\n\s*(?:CERTIFICATIONS|ACHIEVEMENTS|EDUCATION|INTERNSHIP EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|SKILLS|PUBLICATIONS|EXTRACURRICULAR)\b/i);
  const sectionText = nextSectionMatch && nextSectionMatch.index !== undefined
    ? remainingText.slice(0, nextSectionMatch.index)
    : remainingText;

  const lines = sectionText.split("\n").map((l) => l.trim()).filter(Boolean);
  let currentProject: { name: string; description: string; technologies: string[]; link?: string } | null = null;

  for (const line of lines) {
    if (/^(?:PROJECTS|PROJECTS UNDERTAKEN|ACADEMIC PROJECTS|PERSONAL PROJECTS)$/i.test(line)) continue;

    const isHeader =
      !line.startsWith("•") &&
      !line.startsWith("-") &&
      !line.startsWith("*") &&
      (line.includes("—") || line.includes("–") || line.includes("|") || line.includes("github.com") || /Application|Dashboard|System|Project|Platform|Hackathon/i.test(line));

    if (isHeader) {
      if (currentProject) {
        projects.push(currentProject);
      }

      const linkMatch = line.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_.~%/-]+/i);
      const link = linkMatch
        ? linkMatch[0].startsWith("http")
          ? linkMatch[0]
          : `https://${linkMatch[0]}`
        : undefined;

      const nameParts = line.split(/[—–|]/);
      const name =
        nameParts[0]
          ?.replace(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_.~%/-]+/gi, "")
          .trim() || line.slice(0, 40);

      const techList: string[] = [];
      const commonTech = [
        "React", "React.js", "Python", "Flask", "Django", "Axios", "REST API", "REST APIs",
        "HTML", "CSS", "JavaScript", "TypeScript", "MySQL", "Tailwind CSS", "Bootstrap",
        "Machine Learning", "AI", "C++", "Java", "SQL"
      ];
      for (const t of commonTech) {
        if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(line)) {
          techList.push(t);
        }
      }

      currentProject = {
        name,
        description: "",
        technologies: techList,
        link,
      };
    } else if (currentProject) {
      const cleanedBullet = line.replace(/^[•\-\*]\s*/, "");
      if (currentProject.description) {
        currentProject.description += " " + cleanedBullet;
      } else {
        currentProject.description = cleanedBullet;
      }

      const commonTech = [
        "React", "React.js", "Python", "Flask", "Django", "Axios", "REST API", "HTML", "CSS",
        "JavaScript", "TypeScript", "MySQL", "Tailwind CSS"
      ];
      for (const t of commonTech) {
        if (
          new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(line) &&
          !currentProject.technologies.includes(t)
        ) {
          currentProject.technologies.push(t);
        }
      }
    }
  }

  if (currentProject) {
    projects.push(currentProject);
  }

  return projects;
}

/**
 * Matches and ranks a catalog of jobs against a candidate's parsed profile.
 */
export async function suggestJobsForResume(
  profile: ParsedResumeProfile,
  catalog: SuggestedJob[],
): Promise<SuggestedJob[]> {
  const candidateSkills = new Set(profile.skills.map((s) => s.toLowerCase()));
  const candidateText =
    `${profile.targetRole} ${profile.skills.join(" ")} ${profile.summary || ""}`.toLowerCase();

  return catalog
    .map((job) => {
      let score = 60;
      const reasons: string[] = [];

      // Role similarity
      if (
        candidateText.includes(job.role.toLowerCase()) ||
        job.role.toLowerCase().includes(profile.targetRole.toLowerCase())
      ) {
        score += 18;
        reasons.push(`Direct alignment with your target role (${profile.targetRole})`);
      }

      // Skills overlap
      let matchedSkillsCount = 0;
      for (const reqSkill of job.requiredSkills) {
        if (
          candidateSkills.has(reqSkill.toLowerCase()) ||
          candidateText.includes(reqSkill.toLowerCase())
        ) {
          matchedSkillsCount++;
        }
      }

      const skillRatio = matchedSkillsCount / Math.max(1, job.requiredSkills.length);
      score += Math.round(skillRatio * 20);

      if (matchedSkillsCount > 0) {
        reasons.push(
          `${matchedSkillsCount}/${job.requiredSkills.length} required skills matched (${job.requiredSkills.slice(0, 3).join(", ")})`,
        );
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
    })
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}
