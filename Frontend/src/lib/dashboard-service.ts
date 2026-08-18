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
import { getApplications } from "./applications-service";

/**
 * Returns aggregated statistics for the dashboard page.
 *
 * Security: Delegates to getApplications() which always filters by userId.
 *           No data from other users can appear in the result.
 *
 * @param userId Firebase UID of the authenticated user
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  // Single Firestore read — fetch all applications for this user
  const allApplications = await getApplications(userId);

  // Today's date as a YYYY-MM-DD string for follow-up date comparison
  const today = new Date().toISOString().slice(0, 10);

  // Count applications by status
  const byStatus = {
    saved: 0,
    applied: 0,
    underReview: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
  };

  for (const app of allApplications) {
    switch (app.status) {
      case "Saved":
        byStatus.saved++;
        break;
      case "Applied":
        byStatus.applied++;
        break;
      case "Under Review":
        byStatus.underReview++;
        break;
      case "Interview":
        byStatus.interview++;
        break;
      case "Offer":
        byStatus.offer++;
        break;
      case "Rejected":
        byStatus.rejected++;
        break;
    }
  }

  // Most recent 5 applications — already sorted by createdAt DESC from getApplications()
  const recentApplications = allApplications.slice(0, 5);

  // Upcoming follow-ups: applications with a followUpDate >= today, sorted soonest first
  const upcomingFollowUps = allApplications
    .filter((app) => app.followUpDate !== undefined && app.followUpDate >= today)
    .sort((a, b) => {
      const dateA = a.followUpDate ?? "";
      const dateB = b.followUpDate ?? "";
      return dateA.localeCompare(dateB);
    })
    .slice(0, 5);

  return {
    totalApplications: allApplications.length,
    byStatus,
    recentApplications,
    upcomingFollowUps,
  };
}
