/**
 * chat-widget.tsx — floating AI assistant, mounted on every page via __root.
 *
 * Powered by a free OpenRouter chat model (see lib/ai.ts). The system prompt
 * scopes it to job-search help so it stays on-topic.
 */
import { useRef, useState } from "react";
import { chat, isAiConfigured, type ChatMessage } from "@/lib/ai";
import { Bot, Send, X, Loader2, MessageCircle } from "lucide-react";

const SYSTEM: ChatMessage = {
  role: "system",
  content:
    "You are JobPilot Assistant, a concise, encouraging career coach inside a job-application tracker. " +
    "Help users with résumés, cover letters, interview prep, job-search strategy, and using the app. " +
    "Keep answers short and practical. If asked something unrelated to careers or the app, gently steer back.",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your JobPilot assistant. Ask me about résumés, interviews, or your job search." },
  ]);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setIsSending(true);
    try {
      const reply = await chat([SYSTEM, ...next]);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Sorry — I couldn't respond: ${err instanceof Error ? err.message : "unknown error"}` },
      ]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
            <Bot size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">JobPilot Assistant</p>
            <p className="text-[11px] text-muted-foreground leading-tight">AI career coach</p>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-secondary px-3 py-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
            </div>
          </div>
        )}
        {!isAiConfigured() && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
            AI key missing — set VITE_OPENROUTER_API_KEY in your .env file.
          </p>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Ask anything about your job search…"
            className="max-h-24 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={isSending || !input.trim()}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
