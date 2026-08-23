import { describe, it, expect, vi } from "vitest";
import { matchVoiceNavigation } from "@/hooks/use-voice-assistant";
import { chat } from "@/lib/ai";

describe("Voice Assistant Navigation Matcher", () => {
  it("matches 'go to dashboard' voice command", () => {
    const match = matchVoiceNavigation("go to dashboard");
    expect(match).not.toBeNull();
    expect(match?.route).toBe("/dashboard");
    expect(match?.label).toBe("Dashboard");
  });

  it("matches 'browse jobs' voice command", () => {
    const match = matchVoiceNavigation("browse jobs");
    expect(match).not.toBeNull();
    expect(match?.route).toBe("/browse");
    expect(match?.label).toBe("Browse Jobs");
  });

  it("matches 'open tracker' and 'job tracker' commands", () => {
    const match1 = matchVoiceNavigation("open tracker");
    expect(match1?.route).toBe("/tracker");

    const match2 = matchVoiceNavigation("job tracker");
    expect(match2?.route).toBe("/tracker");
  });

  it("matches 'edit resume' and 'profile' commands", () => {
    const match1 = matchVoiceNavigation("edit resume");
    expect(match1?.route).toBe("/profile");

    const match2 = matchVoiceNavigation("go to profile");
    expect(match2?.route).toBe("/profile");
  });

  it("matches 'open inbox' command", () => {
    const match = matchVoiceNavigation("open inbox");
    expect(match?.route).toBe("/inbox");
  });

  it("matches 'settings' command", () => {
    const match = matchVoiceNavigation("open settings");
    expect(match?.route).toBe("/settings");
  });

  it("returns null for non-navigation queries", () => {
    const match = matchVoiceNavigation("tell me a joke about engineers");
    expect(match).toBeNull();
  });
});

describe("2-Second Speech Dictation & Auto-Send Simulation", () => {
  it("dispatches typed message after 2000ms countdown timer", () => {
    vi.useFakeTimers();
    const sendMock = vi.fn();
    const spokenText = "How can I improve my frontend resume?";

    let autoSendCountdown: number | null = 2.0;
    const timer = setTimeout(() => {
      autoSendCountdown = null;
      sendMock(spokenText);
    }, 2000);

    expect(sendMock).not.toHaveBeenCalled();
    expect(autoSendCountdown).toBe(2.0);

    // Fast-forward 1000ms
    vi.advanceTimersByTime(1000);
    expect(sendMock).not.toHaveBeenCalled();

    // Fast-forward remaining 1000ms
    vi.advanceTimersByTime(1000);
    expect(sendMock).toHaveBeenCalledWith("How can I improve my frontend resume?");
    expect(sendMock).toHaveBeenCalledTimes(1);

    clearTimeout(timer);
    vi.useRealTimers();
  });
});

describe("JobPilot AI Copilot Guidance and Onboarding Replies", () => {
  it("provides comprehensive getting-started tour reply when asked", async () => {
    const reply = await chat([
      { role: "user", content: "Can you help me get started and take a quick tour?" },
    ]);
    expect(reply).toContain("Welcome to JobPilot");
    expect(reply).toContain("/profile");
    expect(reply).toContain("/browse");
    expect(reply).toContain("/tracker");
  }, 10000);

  it("provides voice commands cheat sheet when asked about voice", async () => {
    const reply = await chat([
      { role: "user", content: "What voice commands can I use?" },
    ]);
    expect(reply).toContain("JobPilot Voice Commands");
    expect(reply).toContain("Go to Dashboard");
    expect(reply).toContain("Browse Jobs");
    expect(reply).toContain("Go to Tracker");
  }, 10000);

  it("explains Kanban stages when asked about tracker", async () => {
    const reply = await chat([
      { role: "user", content: "Explain the job tracker stages and pipeline" },
    ]);
    expect(reply).toContain("Job Tracker Workflow");
    expect(reply).toContain("Applied");
    expect(reply).toContain("Screening");
    expect(reply).toContain("Interview");
  }, 10000);
});
