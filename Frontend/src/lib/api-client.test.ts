import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAuthFailure } from "./api-client";

describe("handleAuthFailure", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const createStorage = () => {
    const store = new Map<string, string>();

    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };
  };

  beforeEach(() => {
    const session = createStorage();
    const local = createStorage();
    const assign = vi.fn();

    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("window", {
      location: {
        pathname: "/dashboard",
        assign,
      },
      sessionStorage: session,
      localStorage: local,
    });
  });

  it("redirects unauthenticated users to login", () => {
    (window as any).localStorage.setItem("jobpilot_local_user", "stale-user");

    handleAuthFailure();

    expect((window as any).location.assign).toHaveBeenCalledTimes(1);
    expect((window as any).location.assign).toHaveBeenCalledWith("/login");
    expect((window as any).localStorage.getItem("jobpilot_local_user")).toBeNull();
  });

  it("keeps an authenticated Firebase session when the backend rejects its token", () => {
    (window as any).localStorage.setItem("jobpilot_local_user", "saved-user");

    handleAuthFailure(true);

    expect((window as any).location.assign).not.toHaveBeenCalled();
    expect((window as any).localStorage.getItem("jobpilot_local_user")).toBe("saved-user");
  });

  it("does not redirect when the user is already on the auth pages", () => {
    (window as any).location.pathname = "/login";

    handleAuthFailure();

    expect((window as any).location.assign).not.toHaveBeenCalled();
  });
});
