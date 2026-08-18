/**
 * dashboard-service.test.ts
 *
 * Tests for the getDashboardStats aggregation function.
 *
 * Strategy:
 * - Mock getApplications (the underlying data fetcher) to return controlled data
 * - Verify that getDashboardStats correctly aggregates the mock data
 * - No Firestore connection needed
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApplicationDocument } from "../types";

// Mock the applications service (getDashboardStats depends on it)
vi.mock("../applications-service", () => ({
  getApplications: vi.fn(),
}));

import { getDashboardStats } from "../dashboard-service";
import { getApplications } from "../applications-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeApp(overrides: Partial<ApplicationDocument> = {}): ApplicationDocument {
  return {
    id: `app-${Math.random()}`,
    userId: "user-1",
    company: "TestCo",
    jobTitle: "Engineer",
    applicationSource: "Greenhouse",
    status: "Applied",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("getDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns totalApplications equal to the number of applications", async () => {
    const apps = [makeApp(), makeApp(), makeApp()];
    vi.mocked(getApplications).mockResolvedValue(apps);

    const stats = await getDashboardStats("user-1");
    expect(stats.totalApplications).toBe(3);
  });

  it("counts applications correctly by status", async () => {
    const apps = [
      makeApp({ status: "Applied" }),
      makeApp({ status: "Applied" }),
      makeApp({ status: "Interview" }),
      makeApp({ status: "Offer" }),
      makeApp({ status: "Rejected" }),
      makeApp({ status: "Saved" }),
      makeApp({ status: "Under Review" }),
    ];
    vi.mocked(getApplications).mockResolvedValue(apps);

    const stats = await getDashboardStats("user-1");
    expect(stats.byStatus.applied).toBe(2);
    expect(stats.byStatus.interview).toBe(1);
    expect(stats.byStatus.offer).toBe(1);
    expect(stats.byStatus.rejected).toBe(1);
    expect(stats.byStatus.saved).toBe(1);
    expect(stats.byStatus.underReview).toBe(1);
  });

  it("returns zero counts when no applications exist", async () => {
    vi.mocked(getApplications).mockResolvedValue([]);

    const stats = await getDashboardStats("user-1");
    expect(stats.totalApplications).toBe(0);
    expect(stats.byStatus.applied).toBe(0);
    expect(stats.byStatus.interview).toBe(0);
  });

  it("recentApplications contains at most 5 items", async () => {
    const apps = Array.from({ length: 10 }, (_, i) => makeApp({ id: `app-${i}` }));
    vi.mocked(getApplications).mockResolvedValue(apps);

    const stats = await getDashboardStats("user-1");
    expect(stats.recentApplications.length).toBeLessThanOrEqual(5);
  });

  it("recentApplications is the first 5 from the sorted list", async () => {
    const apps = Array.from({ length: 7 }, (_, i) => makeApp({ id: `app-${i}`, company: `Co${i}` }));
    vi.mocked(getApplications).mockResolvedValue(apps);

    const stats = await getDashboardStats("user-1");
    // First 5 from the ordered list
    expect(stats.recentApplications.map((a) => a.id)).toEqual(
      apps.slice(0, 5).map((a) => a.id)
    );
  });

  it("upcomingFollowUps only includes applications with followUpDate >= today", async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const apps = [
      makeApp({ followUpDate: tomorrow.toISOString().slice(0, 10) }), // upcoming
      makeApp({ followUpDate: yesterday.toISOString().slice(0, 10) }), // past
      makeApp(), // no followUpDate
    ];
    vi.mocked(getApplications).mockResolvedValue(apps);

    const stats = await getDashboardStats("user-1");
    // Only the upcoming one should appear
    expect(stats.upcomingFollowUps.length).toBe(1);
    expect(stats.upcomingFollowUps[0]?.followUpDate).toBe(tomorrow.toISOString().slice(0, 10));
  });

  it("upcomingFollowUps are sorted soonest first", async () => {
    const apps = [
      makeApp({ followUpDate: "2026-12-31" }),
      makeApp({ followUpDate: "2026-09-01" }),
      makeApp({ followUpDate: "2026-10-15" }),
    ];
    vi.mocked(getApplications).mockResolvedValue(apps);

    const stats = await getDashboardStats("user-1");
    const dates = stats.upcomingFollowUps.map((a) => a.followUpDate);
    expect(dates).toEqual([...dates].sort());
  });
});
