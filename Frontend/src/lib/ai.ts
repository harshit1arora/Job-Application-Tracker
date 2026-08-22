/**
 * ai.ts — OpenRouter client for JobPilot's AI features.
 *
 * Two capabilities:
 *  - chat()       → free chat model, powers the chatbot widget
 *  - matchScore() → embedding model, résumé ↔ job similarity as a %
 *
 * SECURITY (viva/demo note):
 * The API key ships in the browser bundle via VITE_OPENROUTER_API_KEY.
 * That is acceptable for a demo but exposes the key to every visitor.
 * ponytail: client-side key, move to a Cloud Function proxy before real users.
 */

const BASE = "https://openrouter.ai/api/v1";
const KEY = import.meta.env["VITE_OPENROUTER_API_KEY"] as string | undefined;

// Verified working on the free tier (2026-08). Listed in fallback order —
// free models get rate-limited upstream (429), so we retry the next one.
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

async function orFetch(path: string, body: unknown): Promise<any> {
  if (!KEY) {
    throw new Error("AI is not configured. Add VITE_OPENROUTER_API_KEY to your .env file.");
  }
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `OpenRouter request failed (${res.status})`);
  }
  return data;
}

/**
 * Sends a chat conversation and returns the assistant's reply text.
 * Tries each free model in turn so a single rate-limited provider doesn't
 * break the chatbot.
 */
export async function chat(messages: ChatMessage[]): Promise<string> {
  let lastErr: unknown;
  for (const model of CHAT_MODELS) {
    try {
      const data = await orFetch("/chat/completions", { model, messages, max_tokens: 700 });
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content as string;
    } catch (err) {
      lastErr = err; // try the next model
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All chat models are unavailable right now.");
}

/** Embeds one or more texts into vectors using the embedding model. */
export async function embed(texts: string[]): Promise<number[][]> {
  const data = await orFetch("/embeddings", { model: EMBED_MODEL, input: texts });
  return (data.data as { embedding: number[] }[]).map((d) => d.embedding);
}

// --- Pure helpers (unit-tested in ai.test.ts) ------------------------------

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
 * ponytail: heuristic calibration knob — cosine for related English text
 * clusters roughly in [0.3, 0.85]; this stretches that band across the scale.
 * Tune LO/HI if scores feel too generous or too harsh for your embedding model.
 */
export function scoreFromSimilarity(sim: number): number {
  const LO = 0.3, HI = 0.85;
  const pct = ((sim - LO) / (HI - LO)) * 94 + 5;
  return Math.max(5, Math.min(99, Math.round(pct)));
}

/**
 * Returns a 5–99 match score for a résumé against a job's text.
 * Embeds both with the embedding model and compares them.
 */
export async function matchScore(resume: string, jobText: string): Promise<number> {
  const [rv, jv] = await embed([resume, jobText]);
  return scoreFromSimilarity(cosineSim(rv!, jv!));
}
