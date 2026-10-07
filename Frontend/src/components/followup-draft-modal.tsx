import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, X, Copy, Mail, Send } from "lucide-react";
import { generateFollowUpEmail, markFollowUpSent } from "@/lib/followups-service";
import { FOLLOWUP_TONES } from "@/lib/types";
import type { FollowUpChannel, FollowUpItem, FollowUpLog, FollowUpTone } from "@/lib/types";

interface FollowUpDraftModalProps {
  userId: string;
  item: FollowUpItem;
  applicantName?: string | undefined;
  defaultTone: FollowUpTone;
  onClose: () => void;
  onSent: (log: FollowUpLog) => void;
}

const inputClass =
  "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none";

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

export function FollowUpDraftModal({
  userId,
  item,
  applicantName,
  defaultTone,
  onClose,
  onSent,
}: FollowUpDraftModalProps) {
  const [tone, setTone] = useState<FollowUpTone>(defaultTone);
  const [channel, setChannel] = useState<"email" | "linkedin">("email");
  const [recruiterName, setRecruiterName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [source, setSource] = useState<"ai" | "template" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { application } = item;
  const ordinal = ORDINALS[item.followUpNumber - 1] ?? `#${item.followUpNumber}`;

  const generate = async () => {
    setIsGenerating(true);
    try {
      const draft = await generateFollowUpEmail(item, { tone, channel, applicantName, recruiterName });
      setSubject(draft.subject);
      setBody(draft.body);
      setSource(draft.source);
      if (draft.source === "template") {
        toast.message("AI is unavailable right now — used the built-in template.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Produce a first draft as soon as the modal opens.
  useEffect(() => {
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(channel === "email" ? `Subject: ${subject}\n\n${body}` : body);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy — select the text and copy manually.");
    }
  };

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const handleMarkSent = async () => {
    if (!body.trim()) {
      toast.error("Write or generate a message first.");
      return;
    }
    setIsSending(true);
    try {
      const log = await markFollowUpSent(userId, item, {
        channel: channel as FollowUpChannel,
        tone,
        subject: channel === "email" ? subject : undefined,
        body,
      });
      toast.success(`Logged follow-up to ${application.company}`);
      onSent(log);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log the follow-up.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-primary/10 via-card to-card flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Draft {ordinal} follow-up — {application.company}
            </h2>
            <p className="text-xs text-muted-foreground">
              {application.jobTitle} · {application.status} · quiet for {item.daysQuiet} day
              {item.daysQuiet === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-muted-foreground hover:bg-secondary/60">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tone</span>
              <select value={tone} onChange={(e) => setTone(e.target.value as FollowUpTone)} className={inputClass}>
                {FOLLOWUP_TONES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Channel</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value as "email" | "linkedin")} className={inputClass}>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn message</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recruiter name</span>
              <input value={recruiterName} onChange={(e) => setRecruiterName(e.target.value)} className={inputClass} placeholder="optional" maxLength={100} />
            </label>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-xl border border-input px-3 py-2 text-xs font-bold hover:bg-secondary/60 disabled:opacity-60"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {source ? "Regenerate" : "Generate draft"}
          </button>
          {source ? (
            <span className="ml-2 text-[11px] text-muted-foreground">
              {source === "ai" ? "Written by AI" : "Built-in template"} · edit freely before sending
            </span>
          ) : null}

          {channel === "email" ? (
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} maxLength={200} />
            </label>
          ) : null}

          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className={inputClass} maxLength={5000} />
          </label>
        </div>

        <div className="p-4 border-t border-border flex flex-wrap items-center justify-between gap-2 bg-card">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-semibold hover:bg-secondary/60"
            >
              <Copy size={13} /> Copy
            </button>
            {channel === "email" ? (
              <a
                href={mailto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-semibold hover:bg-secondary/60"
              >
                <Mail size={13} /> Open in email app
              </a>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleMarkSent}
            disabled={isSending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-95 disabled:opacity-60"
          >
            {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Mark as sent
          </button>
        </div>
      </div>
    </div>
  );
}
