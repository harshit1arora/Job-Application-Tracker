/**
 * chat-widget.tsx — High-Performance, Beautifully Formatted AI Career Copilot & Voice Assistant.
 *
 * Features:
 * - Ultra-clean, modern glassmorphic header, non-wrapping tab navigation, and typography.
 * - Rich structured message cards (custom bullet badges, clickable command pills, numbered steps).
 * - Real Web Speech STT (Speech-to-Text) with 2-second auto-send countdown progress.
 * - Natural Text-to-Speech (TTS) readout with live waveform animation and header toggle.
 * - Route-aware context badges with ATS partner icons (Workday, Greenhouse, Lever, Ashby, LinkedIn).
 * - 1-Click AI Quick Tools (Cover Letter Generator, Mock STAR Interview simulator).
 * - Guided Onboarding Tour & Global Keyboard Shortcut (Ctrl+J / Cmd+J).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { chat, isAiConfigured, generateCoverLetter, type ChatMessage } from "@/lib/ai";
import { useAuth } from "@/lib/auth-context";
import { getProfile } from "@/lib/profile";
import { JobPilotLogo, PlatformLogo } from "./assistant-logo";
import { useVoiceAssistant, type NavigationMatch } from "@/hooks/use-voice-assistant";
import {
  Mic,
  MicOff,
  Send,
  X,
  Loader2,
  Sparkles,
  Maximize2,
  Minimize2,
  Trash2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Compass,
  FileText,
  Briefcase,
  Play,
  Square,
  ArrowRight,
  Bot,
  ExternalLink,
  ChevronRight,
  Route as RouteIcon,
} from "lucide-react";

type AssistantTab = "chat" | "voice" | "tools" | "tour";

interface MessageItem extends ChatMessage {
  id: string;
  timestamp: string;
  isVoiceNav?: boolean;
  navDestination?: string;
}

const SYSTEM_PROMPT: ChatMessage = {
  role: "system",
  content:
    "You are JobPilot Copilot, an expert career strategist, interview coach, and navigational assistant inside the JobPilot platform. " +
    "JobPilot has 7 main sections: " +
    "1. /dashboard (Analytics, match stats, recent activity) " +
    "2. /browse (50,000+ live jobs from Workday, Greenhouse, Lever, Ashby) " +
    "3. /applications (Submission tracking and detailed logs) " +
    "4. /tracker (Kanban board with Applied, Screening, Interview, Offer stages) " +
    "5. /inbox (Recruiter messages & correspondence) " +
    "6. /profile (AI PDF résumé parser, skills manager, ATS optimization) " +
    "7. /settings (Preferences and theme options). " +
    "Provide clear, structured, and encouraging advice with practical steps. Use formatting like bullet points and bold tags.",
};

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: "Upload & Parse Résumé",
    route: "/profile",
    desc: "AI extracts your skills, work history, and target roles in seconds to match jobs automatically.",
    badge: "Profile",
  },
  {
    step: 2,
    title: "Browse & Match 50k+ Jobs",
    route: "/browse",
    desc: "Discover real-time openings aggregated across Workday, Greenhouse, Lever, and Ashby with AI match scores.",
    badge: "Browse",
  },
  {
    step: 3,
    title: "Manage Pipeline on Kanban",
    route: "/tracker",
    desc: "Track opportunities through Applied, Screening, Technical Interview, and Offer stages with reminders.",
    badge: "Tracker",
  },
  {
    step: 4,
    title: "Hands-Free Voice Navigation",
    route: "/dashboard",
    desc: "Speak naturally: click the Mic or press Ctrl+J and say 'Go to Tracker' or 'Browse Jobs' to switch pages instantly.",
    badge: "Voice AI",
  },
];

/**
 * Rich Formatted Message Renderer
 * Formats bullets with custom pills, numbered steps, bold headings, and inline tags.
 */
function FormattedMessageContent({
  content,
  onCommandClick,
}: {
  content: string;
  onCommandClick?: ((cmd: string) => void) | undefined;
}) {
  const paragraphs = content.split("\n\n").filter(Boolean);

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-foreground">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split("\n").filter(Boolean);

        // Check if paragraph is a bullet list
        const isBulletList = lines.every((l) => /^[•\-*]/.test(l.trim()));
        if (isBulletList) {
          return (
            <div key={pIdx} className="space-y-1.5 pl-1 my-1.5">
              {lines.map((line, lIdx) => {
                const cleanLine = line.replace(/^[•\-*]\s*/, "");
                return (
                  <div key={lIdx} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <div className="flex-1">
                      <InlineTextFormatter text={cleanLine} onCommandClick={onCommandClick} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }

        // Check if paragraph is a numbered list
        const isNumberedList = lines.every((l) => /^\d+\./.test(l.trim()));
        if (isNumberedList) {
          return (
            <div key={pIdx} className="space-y-2 pl-1 my-1.5">
              {lines.map((line, lIdx) => {
                const match = line.match(/^(\d+)\.\s*(.*)/);
                const num = match && match[1] ? match[1] : `${lIdx + 1}`;
                const text = (match && match[2]) ? match[2] : line;
                return (
                  <div key={lIdx} className="flex items-start gap-2.5">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {num}
                    </span>
                    <div className="flex-1">
                      <InlineTextFormatter text={text} onCommandClick={onCommandClick} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }

        // Regular paragraph with potential single lines
        return (
          <div key={pIdx} className="space-y-1">
            {lines.map((line, lIdx) => {
              if (/^[•\-*]/.test(line.trim())) {
                const cleanLine = line.replace(/^[•\-*]\s*/, "");
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1 my-1">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <div className="flex-1">
                      <InlineTextFormatter text={cleanLine} onCommandClick={onCommandClick} />
                    </div>
                  </div>
                );
              }
              return (
                <p key={lIdx}>
                  <InlineTextFormatter text={line} onCommandClick={onCommandClick} />
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Helper for bold, italic, code tags, and clickable 'Commands' */
function InlineTextFormatter({
  text,
  onCommandClick,
}: {
  text: string;
  onCommandClick?: ((cmd: string) => void) | undefined;
}) {
  // Regex splits bold (**...**), italics (*...* or '...'), inline code (`...`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|'[^']{3,25}')/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={idx}
              className="rounded-md border border-border/80 bg-secondary/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        // Clickable command chips like 'Go to Tracker'
        if (part.startsWith("'") && part.endsWith("'") && onCommandClick) {
          const cmd = part.slice(1, -1);
          if (/^(go to|open|browse|show|edit|switch to)/i.test(cmd)) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onCommandClick(cmd)}
                className="inline-flex items-center gap-0.5 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer mx-0.5"
              >
                <span>{cmd}</span>
                <ChevronRight size={10} />
              </button>
            );
          }
        }
        return part;
      })}
    </>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<AssistantTab>("chat");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoReadTts, setAutoReadTts] = useState(true);
  const [firstTimeDismissed, setFirstTimeDismissed] = useState(false);
  const [autoSendCountdown, setAutoSendCountdown] = useState<number | null>(null);

  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Quick Tools State
  const [toolCompany, setToolCompany] = useState("");
  const [toolRole, setToolRole] = useState("");
  const [isGeneratingTool, setIsGeneratingTool] = useState(false);

  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();
  const { user } = useAuth();

  const userProfile = user?.id ? getProfile(user.id) : null;
  const applicantName = userProfile?.fullName || user?.name || "Candidate";

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "welcome-1",
      role: "assistant",
      timestamp: "Just now",
      content:
        `👋 **Hi ${applicantName}! I'm your JobPilot Copilot.**\n\n` +
        "I can answer career questions, analyze ATS résumés, draft tailored cover letters, run mock interviews, or **navigate across JobPilot using hands-free voice commands**.\n\n" +
        "How can I help you accelerate your job search today?",
    },
  ]);

  // Cancel any active auto-send countdown
  const cancelAutoSend = useCallback(() => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoSendCountdown(null);
  }, []);

  // Voice Navigation Handler
  const handleNavigationDetected = useCallback(
    (match: NavigationMatch) => {
      cancelAutoSend();
      const navMessage: MessageItem = {
        id: `nav-${Date.now()}`,
        role: "assistant",
        timestamp: "Just now",
        isVoiceNav: true,
        navDestination: match.label,
        content: `🚀 **Voice Navigation**: Switching to **${match.label}** (${match.route})...`,
      };

      setMessages((prev) => [...prev, navMessage]);
      void navigate({ to: match.route as any });
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    },
    [navigate, cancelAutoSend]
  );

  // Send message forward reference
  const sendRef = useRef<(text?: string) => Promise<void>>(undefined);

  // Trigger 2-second auto-send countdown for dictated speech
  const triggerAutoSendCountdown = useCallback(
    (spokenText: string) => {
      cancelAutoSend();
      const targetText = spokenText.trim();
      if (!targetText) return;

      const startTime = Date.now();
      const durationMs = 2000;
      setAutoSendCountdown(2.0);

      countdownIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, (durationMs - elapsed) / 1000);
        setAutoSendCountdown(Number(remaining.toFixed(1)));
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        }
      }, 100);

      autoSendTimerRef.current = setTimeout(() => {
        cancelAutoSend();
        setActiveTab("chat");
        if (sendRef.current) {
          void sendRef.current(targetText);
        }
      }, durationMs);
    },
    [cancelAutoSend]
  );

  // Voice Assistant Hook
  const {
    isListening,
    transcript,
    audioLevel,
    isSpeaking,
    isSupported: isVoiceSupported,
    error: voiceError,
    toggleListening,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    setTranscript,
  } = useVoiceAssistant({
    onTranscript: (liveText) => {
      if (liveText) {
        setInput(liveText);
        triggerAutoSendCountdown(liveText);
      }
    },
    onNavigationDetected: handleNavigationDetected,
  });

  // Global Keyboard Shortcut (Ctrl+J or Cmd+J to toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open && activeTab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, activeTab]);

  // Copy message text helper
  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Text-To-Speech toggle
  const handleToggleSpeak = (id: string, text: string) => {
    if (speakingMsgId === id && isSpeaking) {
      stopSpeaking();
      setSpeakingMsgId(null);
    } else {
      setSpeakingMsgId(id);
      speak(text);
    }
  };

  // Send message
  const send = async (overrideText?: string) => {
    cancelAutoSend();
    const text = (overrideText || input).trim();
    if (!text || isSending) return;

    // Check voice navigation in typed text as well
    const navMatch = matchVoiceNavigationText(text);
    if (navMatch) {
      handleNavigationDetected(navMatch);
      setInput("");
      return;
    }

    const userMsg: MessageItem = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: "Just now",
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setTranscript("");
    setIsSending(true);

    try {
      const apiMessages: ChatMessage[] = [
        SYSTEM_PROMPT,
        {
          role: "system",
          content: `Context: Active user is ${applicantName}. Current route is ${currentPath}. User target role: ${userProfile?.targetRole || "Software Engineer"}. Top skills: ${userProfile?.skills?.join(", ") || "TypeScript, React"}.`,
        },
        ...nextMessages.map(({ role, content }) => ({ role, content })),
      ];

      const reply = await chat(apiMessages);
      const assistantMsg: MessageItem = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: reply,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-Readout TTS for assistant response
      if (autoReadTts && reply) {
        speak(reply);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Sorry, I ran into an issue: ${err instanceof Error ? err.message : "unknown error"}. Please check your connection or try again.`,
          timestamp: "Just now",
        },
      ]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  };

  sendRef.current = send;

  // Quick Cover Letter Tool
  const handleGenerateToolCoverLetter = async () => {
    if (!toolCompany || !toolRole) return;
    setIsGeneratingTool(true);
    try {
      const letter = await generateCoverLetter(
        applicantName,
        toolCompany,
        toolRole,
        `Responsibilities for ${toolRole} at ${toolCompany}`,
        userProfile?.skills?.join(", ")
      );
      setActiveTab("chat");
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-cl-${Date.now()}`,
          role: "user",
          content: `Draft a tailored cover letter for ${toolRole} at ${toolCompany}.`,
          timestamp: "Just now",
        },
        {
          id: `ast-cl-${Date.now()}`,
          role: "assistant",
          content: `Here is your customized cover letter for **${toolRole}** at **${toolCompany}**:\n\n${letter}`,
          timestamp: "Just now",
        },
      ]);
      setToolCompany("");
      setToolRole("");
    } finally {
      setIsGeneratingTool(false);
    }
  };

  // Page-specific contextual suggestions
  const getContextChips = () => {
    switch (currentPath) {
      case "/tracker":
        return [
          { label: "📊 Stage Workflow", prompt: "Explain the job tracker stages and how to organize my applications." },
          { label: "📅 Interview Prep", prompt: "How do I schedule an interview reminder and prepare for technical screening?" },
          { label: "🧭 Next Steps", prompt: "What should I focus on next in my application pipeline?" },
        ];
      case "/browse":
        return [
          { label: "⚡ How Auto-Apply Works", prompt: "How does JobPilot auto-apply to Workday and Greenhouse jobs?" },
          { label: "🎯 Match Scores", prompt: "How do match scores get calculated against my profile?" },
          { label: "📄 Jump to Résumé", prompt: "Take me to my profile to review my parsed skills." },
        ];
      case "/profile":
        return [
          { label: "✨ ATS Score Tips", prompt: "Give me actionable tips to optimize my résumé for ATS parsers." },
          { label: "🔍 PDF Extraction", prompt: "How does JobPilot extract skills and work experience from my PDF?" },
          { label: "💼 Matched Jobs", prompt: "Take me to browse jobs that match my target role." },
        ];
      case "/inbox":
        return [
          { label: "✉️ Recruiter Reply", prompt: "Give me a professional email template to reply to a recruiter interview request." },
          { label: "⏰ Follow-up Template", prompt: "How should I follow up on an application after 7 days of no response?" },
        ];
      default:
        return [
          { label: "🚀 Quick 1-Min Tour", prompt: "Take me on a quick tour of JobPilot's superpowers!" },
          { label: "🎙️ Voice Commands", prompt: "What voice commands can I use to switch pages and navigate?" },
          { label: "✍️ Draft Cover Letter", prompt: "Help me write a persuasive 8-line cover letter." },
          { label: "🎯 Mock Interview", prompt: "Start a mock interview session with 3 common engineering questions." },
        ];
    }
  };

  // Quick navigation keywords matcher for text input
  function matchVoiceNavigationText(text: string): NavigationMatch | null {
    const clean = text.toLowerCase().trim();
    const map: Record<string, { route: string; label: string }> = {
      dashboard: { route: "/dashboard", label: "Dashboard" },
      browse: { route: "/browse", label: "Browse Jobs" },
      tracker: { route: "/tracker", label: "Job Tracker" },
      inbox: { route: "/inbox", label: "Inbox" },
      profile: { route: "/profile", label: "Profile & Résumé" },
      settings: { route: "/settings", label: "Settings" },
      applications: { route: "/applications", label: "Applications" },
    };

    for (const [key, val] of Object.entries(map)) {
      if (
        clean === `go to ${key}` ||
        clean === `open ${key}` ||
        clean === `switch to ${key}` ||
        clean === `show ${key}` ||
        clean === key
      ) {
        return { route: val.route, label: val.label, matchedPhrase: clean };
      }
    }
    return null;
  }

  // --- Render Floating Launcher Pill ---
  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Floating Tooltip Pill */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/80 bg-background/95 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-105">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="text-foreground font-medium">JobPilot Copilot</span>
          <kbd className="rounded border border-border/70 bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Ctrl+J
          </kbd>
        </div>

        {/* Main Launcher Button */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open JobPilot AI Copilot"
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-cyan-600 text-white shadow-xl shadow-indigo-600/25 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-600/35 active:scale-95"
        >
          <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
          <JobPilotLogo size={30} className="transition-transform group-hover:rotate-6" />

          {/* Voice Indicator Badge */}
          {isVoiceSupported && (
            <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white ring-2 ring-background">
              <Mic size={11} />
            </span>
          )}
        </button>
      </div>
    );
  }

  // --- Render Full Copilot Panel ---
  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
        expanded
          ? "h-[85vh] w-[38rem] max-w-[calc(100vw-2rem)]"
          : "h-[37rem] w-[26rem] max-w-[calc(100vw-2.5rem)]"
      }`}
    >
      {/* --- Top Header (Clean, spacious, beautifully aligned) --- */}
      <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-indigo-600/10 via-background to-cyan-600/10 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <JobPilotLogo size={34} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-foreground truncate">JobPilot Copilot</h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live • STT Ready
              </span>
              <span>•</span>
              <kbd className="text-[10px] font-mono opacity-80 bg-secondary/80 px-1 rounded">Ctrl+J</kbd>
            </div>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          {/* TTS Auto-Read Pill Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isSpeaking) stopSpeaking();
              setAutoReadTts(!autoReadTts);
            }}
            title={autoReadTts ? "Auto-TTS Readout: ON (Click to disable)" : "Auto-TTS Readout: OFF (Click to enable)"}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
              autoReadTts
                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
            }`}
          >
            <Volume2 size={13} className={isSpeaking ? "animate-bounce text-indigo-600" : ""} />
            <span>TTS {autoReadTts ? "ON" : "OFF"}</span>
          </button>

          {/* Sound Tone Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute audio cues" : "Unmute audio cues"}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              cancelAutoSend();
              setMessages([
                {
                  id: "reset",
                  role: "assistant",
                  timestamp: "Just now",
                  content: "Chat cleared! How can I assist you now?",
                },
              ]);
            }}
            title="Clear conversation"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Trash2 size={15} />
          </button>

          {/* Expand/Compact */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Compact view" : "Expand view"}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground hidden sm:inline-flex"
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              cancelAutoSend();
              setOpen(false);
            }}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-rose-500"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* --- TTS Speaking Live Wave Banner --- */}
      {isSpeaking && (
        <div className="flex items-center justify-between border-b border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 via-primary/10 to-cyan-500/15 px-4 py-2 text-xs text-indigo-700 dark:text-indigo-300 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <span className="h-3.5 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" />
              <span className="h-4.5 w-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="h-2.5 w-1 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.3s]" />
            </div>
            <span className="font-bold text-[11px]">JobPilot Copilot is reading aloud…</span>
          </div>
          <button
            type="button"
            onClick={stopSpeaking}
            className="rounded-lg bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/30 transition-colors"
          >
            Stop Audio
          </button>
        </div>
      )}

      {/* --- Navigation Tabs (Equal 4-Column Grid, No Awkward Wrapping) --- */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="grid grid-cols-4 gap-1 p-1 bg-secondary/50 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "chat"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot size={13} />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("voice")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "voice"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mic size={13} className={isListening ? "text-rose-500 animate-pulse" : ""} />
            <span>Voice</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tools")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "tools"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles size={13} className="text-amber-500" />
            <span>Tools</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tour")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "tour"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Compass size={13} />
            <span>Tour</span>
          </button>
        </div>
      </div>

      {/* --- Context Awareness Banner --- */}
      <div className="flex items-center justify-between border-b border-border/40 bg-secondary/20 px-3.5 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <RouteIcon size={12} className="text-muted-foreground" />
          <span className="font-semibold text-foreground">Current:</span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
            {currentPath}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <PlatformLogo platform="workday" className="h-3.5 w-3.5" />
          <PlatformLogo platform="greenhouse" className="h-3.5 w-3.5" />
          <PlatformLogo platform="lever" className="h-3.5 w-3.5" />
          <PlatformLogo platform="ashby" className="h-3.5 w-3.5" />
          <PlatformLogo platform="linkedin" className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* --- TAB CONTENT 1: CHAT --- */}
      {activeTab === "chat" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5">
            {/* First-time guided welcome card */}
            {!firstTimeDismissed && (
              <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-primary/5 to-cyan-500/10 p-3 text-xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-indigo-600 dark:text-indigo-400" />
                    <span className="font-bold text-foreground">First time with JobPilot?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFirstTimeDismissed(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  Try speaking to switch pages hands-free, or click below to launch the 1-minute guided tour.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("tour")}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Play size={10} fill="currentColor" />
                    <span>Start Quick Tour</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("voice")}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary transition-colors"
                  >
                    <Mic size={11} />
                    <span>Voice Commands</span>
                  </button>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`group relative max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all shadow-xs ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs"
                      : m.isVoiceNav
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-foreground rounded-bl-xs"
                      : "bg-secondary/70 border border-border/60 text-foreground rounded-bl-xs"
                  }`}
                >
                  {/* Rich formatted message content */}
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap font-medium">{m.content}</p>
                  ) : (
                    <FormattedMessageContent
                      content={m.content}
                      onCommandClick={(cmd) => {
                        const nav = matchVoiceNavigationText(cmd);
                        if (nav) handleNavigationDetected(nav);
                      }}
                    />
                  )}

                  {/* Navigation Destination CTA if message was a voice nav */}
                  {m.isVoiceNav && m.navDestination && (
                    <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Arrived at {m.navDestination}
                      </span>
                      <ChevronRight size={13} className="text-emerald-600" />
                    </div>
                  )}

                  {/* Message Action Bar */}
                  {m.role === "assistant" && !m.isVoiceNav && (
                    <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-1.5 text-[10px] text-muted-foreground opacity-90">
                      <span>{m.timestamp}</span>
                      <div className="flex items-center gap-1">
                        {/* Read Aloud */}
                        <button
                          type="button"
                          onClick={() => handleToggleSpeak(m.id, m.content)}
                          title="Read aloud"
                          className="rounded p-1 hover:bg-background/80 hover:text-foreground transition-colors"
                        >
                          {speakingMsgId === m.id && isSpeaking ? (
                            <Square size={11} className="text-rose-500 fill-current" />
                          ) : (
                            <Volume2 size={11} />
                          )}
                        </button>
                        {/* Copy */}
                        <button
                          type="button"
                          onClick={() => handleCopy(m.id, m.content)}
                          title="Copy text"
                          className="rounded p-1 hover:bg-background/80 hover:text-foreground transition-colors"
                        >
                          {copiedId === m.id ? (
                            <Check size={11} className="text-emerald-500" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-secondary/80 border border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span>JobPilot Copilot is thinking…</span>
                </div>
              </div>
            )}

            {!isAiConfigured() && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Sparkles size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-bold">Offline Intelligence Mode Active</p>
                  <p className="mt-0.5 opacity-90">
                    Smart local career strategies, voice navigation, and resume tips are fully operational. Add{" "}
                    <code className="font-mono font-bold">VITE_OPENROUTER_API_KEY</code> for live LLM completions.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Contextual Quick Suggestion Chips */}
          <div className="border-t border-border/40 bg-secondary/20 px-3 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {getContextChips().map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void send(chip.prompt)}
                  className="shrink-0 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95 shadow-2xs"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Transcript Floating Indicator */}
          {isListening && transcript && (
            <div className="border-t border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span className="font-bold text-[11px]">Hearing:</span>
                <span className="truncate italic">"{transcript}"</span>
              </div>
            </div>
          )}

          {/* 2-Second Auto-Send Countdown Banner */}
          {autoSendCountdown !== null && (
            <div className="border-t border-indigo-500/40 bg-gradient-to-r from-indigo-500/15 via-primary/10 to-cyan-500/15 px-3.5 py-2 text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600 dark:bg-indigo-400"></span>
                </span>
                <span className="font-bold text-foreground">
                  Sending speech in {autoSendCountdown.toFixed(1)}s
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cancelAutoSend}
                  className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cancelAutoSend();
                    void send();
                  }}
                  className="rounded-md bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  Send Now
                </button>
              </div>
            </div>
          )}

          {/* --- Input Box & STT Mic --- */}
          <div className="border-t border-border/70 bg-card p-3">
            <div className="flex items-end gap-2">
              {/* Mic STT Button */}
              {isVoiceSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? "Stop listening" : "Click to speak voice commands"}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all ${
                    isListening
                      ? "bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30 scale-105"
                      : "bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground"
                  }`}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}

              {/* Text Input Area */}
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder={
                    isListening ? "Listening to your voice..." : "Ask career question or type 'go to tracker'…"
                  }
                  className="max-h-24 w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all placeholder:text-muted-foreground/70"
                />
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={() => void send()}
                disabled={isSending || !input.trim()}
                aria-label="Send message"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white disabled:opacity-40 hover:opacity-95 active:scale-95 transition-all shadow-md"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 2: VOICE NAVIGATOR --- */}
      {activeTab === "voice" && (
        <div className="flex flex-1 flex-col overflow-y-auto p-5 space-y-4">
          <div className="text-center py-3">
            {/* Interactive Voice Orb */}
            <div className="relative inline-flex items-center justify-center">
              <button
                type="button"
                onClick={toggleListening}
                style={{
                  transform: isListening ? `scale(${1 + Math.min(audioLevel, 100) * 0.003})` : undefined,
                }}
                className={`relative z-10 grid h-24 w-24 place-items-center rounded-full transition-all duration-200 cursor-pointer shadow-xl ${
                  isListening
                    ? "bg-rose-500 text-white shadow-rose-500/50 scale-105"
                    : "bg-gradient-to-tr from-indigo-600 via-indigo-700 to-cyan-500 text-white shadow-indigo-500/25 hover:scale-105"
                }`}
              >
                {isListening ? (
                  <div className="flex items-center gap-1">
                    <span className="h-5 w-1.5 rounded-full bg-white animate-pulse" />
                    <span className="h-9 w-1.5 rounded-full bg-white animate-pulse [animation-delay:0.15s]" />
                    <span className="h-4 w-1.5 rounded-full bg-white animate-pulse [animation-delay:0.3s]" />
                  </div>
                ) : (
                  <Mic size={36} />
                )}
              </button>

              {/* Pulsing Ripple Rings */}
              {isListening && (
                <>
                  <span className="absolute h-32 w-32 animate-ping rounded-full bg-rose-400/30" />
                  <span className="absolute h-40 w-40 animate-pulse rounded-full bg-rose-400/20" />
                </>
              )}
            </div>

            {/* Voice Status Heading */}
            <h3 className="mt-3.5 text-sm font-bold text-foreground flex items-center justify-center gap-1.5">
              {isListening ? (
                <span className="flex items-center gap-1.5 text-rose-500 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Listening to your voice…
                </span>
              ) : (
                <span>Voice Navigation Hub</span>
              )}
            </h3>

            <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
              {isListening
                ? "Speak a destination or question. Click orb to stop."
                : "Click the orb above to speak any navigation command or career question."}
            </p>

            {/* Error Alert Box */}
            {voiceError && (
              <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
                <span>{voiceError}</span>
                <button
                  type="button"
                  onClick={startListening}
                  className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-rose-700"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Live Captured Speech Card */}
            {transcript && (
              <div className="mt-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-left space-y-1.5 animate-fade-in">
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    Captured Speech:
                  </span>
                  {autoSendCountdown !== null && (
                    <span>Auto-sending in {autoSendCountdown.toFixed(1)}s</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-foreground italic">
                  "{transcript}"
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      cancelAutoSend();
                      setActiveTab("chat");
                      void send(transcript);
                    }}
                    className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors shadow-xs"
                  >
                    Send to Copilot Now
                  </button>
                  <button
                    type="button"
                    onClick={cancelAutoSend}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Voice Command Triggers */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              INSTANT VOICE COMMANDS (1-CLICK JUMP)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Dashboard", cmd: "Go to Dashboard", route: "/dashboard", icon: "📊" },
                { label: "Browse Jobs", cmd: "Browse Jobs", route: "/browse", icon: "🔍" },
                { label: "Job Tracker", cmd: "Go to Tracker", route: "/tracker", icon: "📋" },
                { label: "Applications", cmd: "Show Applications", route: "/applications", icon: "📁" },
                { label: "Inbox Messages", cmd: "Open Inbox", route: "/inbox", icon: "✉️" },
                { label: "Profile & Résumé", cmd: "Edit Résumé", route: "/profile", icon: "👤" },
              ].map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    handleNavigationDetected({
                      route: item.route,
                      label: item.label,
                      matchedPhrase: item.cmd,
                    });
                    setActiveTab("chat");
                  }}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-secondary/40 p-2.5 text-left text-xs transition-all hover:bg-primary/10 hover:border-primary/50 group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <div>
                      <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                        "{item.cmd}"
                      </p>
                      <p className="text-[10px] text-muted-foreground">{item.route}</p>
                    </div>
                  </div>
                  <ArrowRight size={12} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 3: QUICK TOOLS --- */}
      {activeTab === "tools" && (
        <div className="flex flex-1 flex-col overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">AI Career Quick Tools</h3>
            <p className="text-xs text-muted-foreground">
              Generate job-specific assets and simulate interviews in seconds.
            </p>
          </div>

          {/* Tool 1: Instant Cover Letter Builder */}
          <div className="rounded-2xl border border-border/80 bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-bold text-foreground">1-Click Tailored Cover Letter</h4>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={toolCompany}
                onChange={(e) => setToolCompany(e.target.value)}
                placeholder="Target Company (e.g. Stripe, OpenAI)"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                value={toolRole}
                onChange={(e) => setToolRole(e.target.value)}
                placeholder="Target Role (e.g. Senior Frontend Engineer)"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateToolCoverLetter}
                disabled={isGeneratingTool || !toolCompany || !toolRole}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isGeneratingTool ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>Generate Cover Letter</span>
              </button>
            </div>
          </div>

          {/* Tool 2: Mock Interview Generator */}
          <div className="rounded-2xl border border-border/80 bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase size={16} className="text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-foreground">Mock Interview Simulator</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Launch a structured mock interview with STAR method scoring for your target role.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("chat");
                  void send("Start a mock behavioral interview for a Senior Software Engineer. Ask question 1.");
                }}
                className="flex-1 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
              >
                Behavioral (STAR)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("chat");
                  void send("Start a mock technical system design interview for a Fullstack Engineer. Ask question 1.");
                }}
                className="flex-1 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
              >
                System Design
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 4: GUIDED TOUR --- */}
      {activeTab === "tour" && (
        <div className="flex flex-1 flex-col overflow-y-auto p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">JobPilot 1-Minute Walkthrough</h3>
            <p className="text-xs text-muted-foreground">
              Follow these 4 essential steps to supercharge your job hunting workflow.
            </p>
          </div>

          <div className="space-y-3">
            {ONBOARDING_STEPS.map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5 space-y-1.5 transition-all hover:bg-secondary/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                      {s.step}
                    </span>
                    <h4 className="text-xs font-bold text-foreground">{s.title}</h4>
                  </div>
                  <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {s.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pl-8">{s.desc}</p>
                <div className="pl-8 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      void navigate({ to: s.route as any });
                      setActiveTab("chat");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    <span>Open {s.badge} Page</span>
                    <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer"
            >
              Ready! Start Chatting with Copilot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
