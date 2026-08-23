/**
 * dashboard-service.ts — Dashboard Data Aggregation
 *
 * For viva:
 * The dashboard page currently displays fake hardcoded numbers:
 *   - "Total Applications: applications.length + 19" (fake offset)
 *   - "Interviews: count + 2"                        (fake offset)
 *   - "ATS Match Rate: 94.2%"                        (hardcoded)
 *
 * This service replaces the real numbers (total, byStatus counts, recents,
 * upcoming follow-ups) with actual data from Firestore.
 *
 * The AI-owned metrics (match rate, crawled ATS boards) remain hardcoded —
 * they are out of scope for this backend assignment.
 *
 * Aggregation strategy:
 * Firestore supports server-side COUNT aggregation, but for simplicity and
 * college-scale data (users typically have < 200 applications), we fetch all
 * applications once and aggregate in memory. This is efficient and keeps the
 * code simple.
 *
 * For a production system with thousands of applications, we would use
 * Firestore's count() aggregation query or a Cloud Function to maintain
 * pre-computed counters.
 */
import type { DashboardStats } from "./types";
import { fetchDashboardStatsApi } from "./api-client";

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  return await fetchDashboardStatsApi(userId);
}

