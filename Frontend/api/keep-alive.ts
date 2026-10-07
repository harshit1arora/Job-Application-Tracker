/**
 * keep-alive.ts — Vercel Serverless Function / Cron
 *
 * Pings the Render backend /health endpoint to prevent the free-tier service
 * from going to sleep.
 *
 * Deploy: Add to vercel.json crons to run every 10 minutes:
 *   { "path": "/api/keep-alive", "schedule": "*/10 * * * *" }
 *
 * This function is safe to call via a GET request at any time.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const BACKEND_URL = "https://job-tracker-api-fo65.onrender.com/api/health";
const TIMEOUT_MS = 20_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  } catch (err: any) {
    const elapsed = Date.now() - started;
    res.status(200).json({
      ok: false,
      error: err?.message ?? "unknown",
      elapsed_ms: elapsed,
      backend: BACKEND_URL,
      pinged_at: new Date().toISOString(),
    });
  }
}
