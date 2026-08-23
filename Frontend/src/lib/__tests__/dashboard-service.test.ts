import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DashboardStats } from "../types";

vi.mock("../api-client", () => ({
  fetchDashboardStatsApi: vi.fn(),
}));

import { getDashboardStats } from "../dashboard-service";
import { fetchDashboardStatsApi } from "../api-client";

describe("getDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dashboard statistics aggregated for user", async () => {
    const mockStats: DashboardStats = {
      totalApplications: 5,
      byStatus: {
        saved: 1,
        applied: 2,
        underReview: 1,
        interview: 1,
        offer: 0,
        rejected: 0,
      },
      recentApplications: [],
      upcomingFollowUps: [],
    };

    vi.mocked(fetchDashboardStatsApi).mockResolvedValue(mockStats);

    const stats = await getDashboardStats("user-1");
    expect(stats.totalApplications).toBe(5);
    expect(stats.byStatus.applied).toBe(2);
    expect(stats.byStatus.interview).toBe(1);
  });
});
