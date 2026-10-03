import { describe, it, expect } from "vitest";
import { AppError } from "../types";
import {
  createApplication,
  getApplications,
  getApplication,
  updateApplication,
  deleteApplication,
} from "../applications-service";

const VALID_INPUT = {
  company: "Stripe",
  jobTitle: "Senior Engineer",
  applicationSource: "Greenhouse" as const,
  status: "Applied" as const,
};

describe("createApplication — validation", () => {
  it("throws VALIDATION_ERROR when company is empty", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, company: "" }),
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when jobTitle is empty", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, jobTitle: "" }),
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when applicationSource is invalid", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, applicationSource: "FakeBoard" as any }),
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when status is invalid", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, status: "Ghosted" as any }),
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR with field details when company exceeds 100 chars", async () => {
    const longName = "A".repeat(101);
    try {
      await createApplication("user-1", { ...VALID_INPUT, company: longName });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).type).toBe("VALIDATION_ERROR");
      expect((err as AppError).fields).toBeDefined();
    }
  });
});

describe("applications-service — CRUD workflow", () => {
  it("creates, fetches, updates, and deletes an application", async () => {
    const created = await createApplication("test-user-flow", VALID_INPUT);
    expect(created.id).toBeDefined();
    expect(created.company).toBe("Stripe");

    const fetched = await getApplication("test-user-flow", created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.jobTitle).toBe("Senior Engineer");

    const list = await getApplications("test-user-flow", { search: "Stripe" });
    expect(list.some((a) => a.id === created.id)).toBe(true);

    const updated = await updateApplication("test-user-flow", created.id, {
      status: "Offer",
    });
    expect(updated.status).toBe("Offer");

    await deleteApplication("test-user-flow", created.id);
    const afterDelete = await getApplication("test-user-flow", created.id);
    expect(afterDelete).toBeNull();
  });
});

describe("applications-service — URL Scheme Security (P1-C)", () => {
  it("accepts valid https application URLs", async () => {
    const app = await createApplication("test-user-url-1", {
      ...VALID_INPUT,
      applicationUrl: "https://jobs.lever.co/stripe/123",
    });
    expect(app.applicationUrl).toBe("https://jobs.lever.co/stripe/123");
  });

  it("accepts valid http application URLs", async () => {
    const app = await createApplication("test-user-url-2", {
      ...VALID_INPUT,
      applicationUrl: "http://careers.example.com/job/456",
    });
    expect(app.applicationUrl).toBe("http://careers.example.com/job/456");
  });

  it("accepts empty string application URL", async () => {
    const app = await createApplication("test-user-url-3", {
      ...VALID_INPUT,
      applicationUrl: "",
    });
    expect(app.applicationUrl ?? undefined).toBeUndefined();
  });

  it("rejects dangerous javascript: scheme", async () => {
    await expect(
      createApplication("test-user-url-sec", {
        ...VALID_INPUT,
        applicationUrl: "javascript:alert(document.cookie)",
      }),
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("rejects dangerous data: scheme", async () => {
    await expect(
      createApplication("test-user-url-sec", {
        ...VALID_INPUT,
        applicationUrl: "data:text/html,<script>alert(1)</script>",
      }),
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("rejects dangerous vbscript: scheme", async () => {
    await expect(
      createApplication("test-user-url-sec", {
        ...VALID_INPUT,
        applicationUrl: "vbscript:msgbox(1)",
      }),
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });
});

describe("applications-service — Demo Data Isolation & Cross-User Security (P0-B)", () => {
  it("demo-user sees seed applications", async () => {
    // Seed some data first since we removed localstorage seeding
    await createApplication("demo-user", { ...VALID_INPUT, company: "DemoCorp" });
    const apps = await getApplications("demo-user");
    expect(apps.length).toBeGreaterThanOrEqual(1);
    expect(apps.every((a) => a.userId === "demo-user")).toBe(true);
  });

  it("real-user-A does NOT see demo applications", async () => {
    const apps = await getApplications("real-user-A");
    expect(apps.some((a) => a.userId === "demo-user")).toBe(false);
  });

  it("real-user-B does NOT see user-A applications", async () => {
    // User A creates an application
    const appA = await createApplication("real-user-A", {
      company: "Company Alpha",
      jobTitle: "Alpha Engineer",
      applicationSource: "LinkedIn",
      status: "Applied",
    });

    // User B checks their applications
    const appsB = await getApplications("real-user-B");
    expect(appsB.some((a) => a.id === appA.id)).toBe(false);
    expect(appsB.some((a) => a.company === "Company Alpha")).toBe(false);

    // User B cannot fetch User A's application by ID
    const directFetchByB = await getApplication("real-user-B", appA.id);
    expect(directFetchByB).toBeNull();

    // User B cannot update User A's application
    await expect(
      updateApplication("real-user-B", appA.id, { status: "Interview" }),
    ).rejects.toMatchObject({ type: "NOT_FOUND" });

    // Clean up
    await deleteApplication("real-user-A", appA.id);
  });
});
