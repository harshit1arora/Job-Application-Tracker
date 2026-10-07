/**
 * keep-alive.ts — Vercel Serverless Function / Cron
 *
 * Pings the Render backend /health endpoint to prevent the free-tier service
 * from going to sleep.
 *
 * Scheduled via vercel.json crons to run every 10 minutes.
 * Can also be triggered manually via GET /api/keep-alive
 */

const BACKEND_URL = "https://job-tracker-api-fo65.onrender.com/api/health";
const TIMEOUT_MS = 20_000;

export default async function handler(
  req: { method?: string },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
  },
) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const upstream = await fetch(BACKEND_URL, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": "JobPilot-KeepAlive/1.0" },
    });
    clearTimeout(id);
    const elapsed = Date.now() - started;
    res.status(200).json({
      ok: upstream.ok,
      status: upstream.status,
      elapsed_ms: elapsed,
      backend: BACKEND_URL,
      pinged_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const elapsed = Date.now() - started;
    const message = err instanceof Error ? err.message : "unknown error";
    res.status(200).json({
      ok: false,
      error: message,
      elapsed_ms: elapsed,
      backend: BACKEND_URL,
      pinged_at: new Date().toISOString(),
    });
  }
}
