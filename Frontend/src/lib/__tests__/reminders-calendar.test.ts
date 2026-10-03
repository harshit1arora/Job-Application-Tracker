import { describe, it, expect } from "vitest";
import { fetchReminders, createReminderApi, createApplicationApi } from "../api-client";
import { format } from "date-fns";

describe("Interview & Process Calendar Data Layer", () => {
  it("fetches seeded color-coded calendar reminders for candidate", async () => {
    const app = await createApplicationApi("demo-user", { company: "Company", jobTitle: "Job", applicationSource: "LinkedIn", status: "Applied" });
    await createReminderApi("demo-user", { applicationId: app.id, type: "interview", reminderDate: "2024-01-01" });
    await createReminderApi("demo-user", { applicationId: app.id, type: "follow-up", reminderDate: "2024-01-02" });
    await createReminderApi("demo-user", { applicationId: app.id, type: "deadline", reminderDate: "2024-01-03" });
    await createReminderApi("demo-user", { applicationId: app.id, type: "interview", reminderDate: "2024-01-04" });

    const rems = await fetchReminders("demo-user", app.id);
    expect(rems.length).toBeGreaterThanOrEqual(4);

    const interviewRems = rems.filter((r) => r.type === "interview");
    const followUpRems = rems.filter((r) => r.type === "follow-up");
    const deadlineRems = rems.filter((r) => r.type === "deadline");

    expect(interviewRems.length).toBeGreaterThan(0);
    expect(followUpRems.length).toBeGreaterThan(0);
    expect(deadlineRems.length).toBeGreaterThan(0);
  });

  it("allows candidate to schedule a new interview round on calendar", async () => {
    const app = await createApplicationApi("demo-user", { company: "Company", jobTitle: "Job", applicationSource: "LinkedIn", status: "Applied" });
    const targetDate = format(new Date(Date.now() + 8 * 86400000), "yyyy-MM-dd");
    const newInterview = await createReminderApi("demo-user", {
      applicationId: app.id,
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
