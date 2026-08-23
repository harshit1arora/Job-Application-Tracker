import { describe, it, expect } from "vitest";
import { fetchReminders, createReminderApi } from "../api-client";
import { format } from "date-fns";

describe("Interview & Process Calendar Data Layer", () => {
  it("fetches seeded color-coded calendar reminders for candidate", async () => {
    const rems = await fetchReminders("demo-user");
    expect(rems.length).toBeGreaterThanOrEqual(4);

    const interviewRems = rems.filter((r) => r.type === "interview");
    const followUpRems = rems.filter((r) => r.type === "follow-up");
    const deadlineRems = rems.filter((r) => r.type === "deadline");

    expect(interviewRems.length).toBeGreaterThan(0);
    expect(followUpRems.length).toBeGreaterThan(0);
    expect(deadlineRems.length).toBeGreaterThan(0);
  });

  it("allows candidate to schedule a new interview round on calendar", async () => {
    const targetDate = format(new Date(Date.now() + 8 * 86400000), "yyyy-MM-dd");
    const newInterview = await createReminderApi("demo-user", {
      applicationId: "app-seed-01",
      type: "interview",
      reminderDate: targetDate,
      message: "Stripe — Final Executive Partner Interview Round",
    });

    expect(newInterview.id).toBeDefined();
    expect(newInterview.type).toBe("interview");
    expect(newInterview.reminderDate).toBe(targetDate);
    expect(newInterview.message).toContain("Final Executive Partner");

    const all = await fetchReminders("demo-user");
    const found = all.find((r) => r.id === newInterview.id);
    expect(found).toBeDefined();
  });
});
