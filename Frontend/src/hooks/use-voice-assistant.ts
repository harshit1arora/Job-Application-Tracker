import { useState, useEffect, useRef, useCallback } from "react";

export interface NavigationMatch {
  route: string;
  label: string;
  matchedPhrase: string;
}

const NAVIGATION_INTENTS: Array<{
  route: string;
  label: string;
  keywords: string[];
}> = [
  {
    route: "/dashboard",
    label: "Dashboard",
    keywords: ["dashboard", "home dashboard", "stats", "overview", "analytics", "main dashboard"],
  },
  {
    route: "/browse",
    label: "Browse Jobs",
    keywords: ["browse", "browse jobs", "find jobs", "search jobs", "job listings", "explore jobs", "search positions"],
  },
  {
    route: "/applications",
    label: "Applications",
    keywords: ["applications", "my applications", "applied jobs", "submission list", "submissions"],
  },
  {
    route: "/tracker",
    label: "Job Tracker",
    keywords: ["tracker", "job tracker", "kanban", "pipeline", "interview stages", "board", "application stages"],
  },
  {
    route: "/inbox",
    label: "Inbox",
    keywords: ["inbox", "emails", "messages", "inbox messages", "recruiter emails", "recruiter messages"],
  },
  {
    route: "/profile",
    label: "Profile & Résumé",
    keywords: ["profile", "resume", "résumé", "cv", "edit profile", "upload resume", "my resume", "candidate profile"],
  },
  {
    route: "/settings",
    label: "Settings",
    keywords: ["settings", "preferences", "account settings", "configuration", "theme settings"],
  },
  {
    route: "/",
    label: "Landing Page",
    keywords: ["landing", "home page", "front page", "website", "logout home"],
  },
];

const ACTION_PREFIXES = [
  "",
  "go to ",
  "open ",
  "take me to ",
  "switch to ",
  "show ",
  "navigate to ",
  "jump to ",
  "view ",
  "edit ",
  "update ",
  "manage ",
  "see ",
  "check ",
];

export function matchVoiceNavigation(text: string): NavigationMatch | null {
  const clean = text.toLowerCase().trim();

  for (const item of NAVIGATION_INTENTS) {
    for (const kw of item.keywords) {
      for (const prefix of ACTION_PREFIXES) {
        const pattern = `${prefix}${kw}`;
        if (clean === pattern || clean.includes(pattern)) {
          return {
            route: item.route,
            label: item.label,
            matchedPhrase: pattern,
          };
        }
      }
    }
  }

  return null;
}

export function playAcousticTone(type: "start" | "success" | "stop" | "error" = "success") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === "start") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === "success") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === "stop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch {
    // Graceful silent fallback if Web Audio is blocked by browser policy
  }
}

export function useVoiceAssistant({
  onTranscript,
  onNavigationDetected,
}: {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onNavigationDetected?: (match: NavigationMatch) => void;
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isListeningRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Store latest callbacks in refs so recognition instance does not re-initialize on every render
  const onTranscriptRef = useRef(onTranscript);
  const onNavigationDetectedRef = useRef(onNavigationDetected);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onNavigationDetectedRef.current = onNavigationDetected;
  });

  // Setup Web Speech Recognition once on mount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setError(null);
        playAcousticTone("start");
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = "";
        let isFinal = false;

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0]) {
            fullTranscript += item[0].transcript + " ";
            if (item.isFinal) {
              isFinal = true;
            }
          }
        }

        const trimmed = fullTranscript.trim();
        if (trimmed) {
          setTranscript(trimmed);
          onTranscriptRef.current?.(trimmed, isFinal);

          const navMatch = matchVoiceNavigation(trimmed);
          if (navMatch) {
            playAcousticTone("success");
            onNavigationDetectedRef.current?.(navMatch);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setError("Microphone permission denied. Please allow microphone in browser.");
          isListeningRef.current = false;
          setIsListening(false);
        } else if (event.error === "no-speech") {
          // ignore transient silence
        } else {
          setError(`Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        // Auto-restart if user has not explicitly stopped listening
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      setIsSupported(false);
      setError(err instanceof Error ? err.message : "Speech recognition failed to initialize");
    }

    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Real-time audio analyzer for mic visualizer
  const startAudioAnalyzer = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!isListeningRef.current) {
          setAudioLevel(0);
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // ignore analyzer failures
    }
  }, []);

  const stopAudioAnalyzer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    isListeningRef.current = true;
    setIsListening(true);

    void startAudioAnalyzer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // may already be started
      }
    }
  }, [startAudioAnalyzer]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    playAcousticTone("stop");
    stopAudioAnalyzer();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, [stopAudioAnalyzer]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current || isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Text-To-Speech
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    // Strip markdown formatting before speaking
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/#+\s+/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel")) &&
        v.lang.startsWith("en")
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    transcript,
    audioLevel,
    isSpeaking,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    setTranscript,
  };
}
