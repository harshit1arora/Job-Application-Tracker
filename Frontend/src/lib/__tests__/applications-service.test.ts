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
      createApplication("user-1", { ...VALID_INPUT, company: "" })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when jobTitle is empty", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, jobTitle: "" })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when applicationSource is invalid", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, applicationSource: "FakeBoard" as any })
    ).rejects.toMatchObject({ type: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when status is invalid", async () => {
    await expect(
      createApplication("user-1", { ...VALID_INPUT, status: "Ghosted" as any })
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
