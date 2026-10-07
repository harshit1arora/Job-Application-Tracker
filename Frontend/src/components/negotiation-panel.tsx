import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, X, Copy, Mail, AlertTriangle, Handshake } from "lucide-react";
import { generateNegotiationPlan, computeCounter, NEGOTIATION_PRIORITIES } from "@/lib/negotiation";
import { parseSavedPlan, saveNegotiationPlan } from "@/lib/offers-service";
import { formatMoney } from "@/lib/offer-math";
import { NEGOTIATION_TONES } from "@/lib/types";
import type { NegotiationPlan, NegotiationTone, OfferDocument } from "@/lib/types";

interface NegotiationPanelProps {
  userId: string;
  offer: OfferDocument;
  /** Other offers in the same currency (used as honest leverage). */
  otherOffers: OfferDocument[];
  applicantName?: string | undefined;
  onClose: () => void;
  onSaved: (offer: OfferDocument) => void;
}

const inputClass =
  "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none";

const TONE_LABELS: Record<NegotiationTone, string> = {
  collaborative: "Collaborative",
  firm: "Firm",
  enthusiastic: "Enthusiastic",
};

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy — select the text and copy manually.");
  }
}

export function NegotiationPanel({
  userId,
  offer,
  otherOffers,
  applicantName,
  onClose,
  onSaved,
}: NegotiationPanelProps) {
  const [tone, setTone] = useState<NegotiationTone>("collaborative");
  const [targetBase, setTargetBase] = useState("");
  const [priorities, setPriorities] = useState<string[]>(["Base salary"]);
  const [leverage, setLeverage] = useState("");
  const [highlights, setHighlights] = useState("");
  const [useCompeting, setUseCompeting] = useState(otherOffers.length > 0);
  const [plan, setPlan] = useState<NegotiationPlan | null>(() => parseSavedPlan(offer));
  const [tab, setTab] = useState<"email" | "phone" | "pushback">("email");
  const [isGenerating, setIsGenerating] = useState(false);

  const money = (value: number) => formatMoney(value, offer.currency);
  const parsedTarget = targetBase.trim() ? Number(targetBase.replace(/,/g, "")) : undefined;
  const targetInvalid = parsedTarget !== undefined && (!Number.isFinite(parsedTarget) || parsedTarget <= 0);
  const competing = useCompeting ? otherOffers : [];
  const preview = computeCounter(offer, {
    targetBase: targetInvalid ? undefined : parsedTarget,
    leverage,
    competingOffers: competing,
  });

  const togglePriority = (name: string) =>
    setPriorities((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name].slice(0, 5)));

  const handleGenerate = async () => {
    if (targetInvalid) {
      toast.error("Enter a valid target base salary or leave it empty.");
      return;
    }
    setIsGenerating(true);
    try {
      const generated = await generateNegotiationPlan(userId, offer, {
        tone,
        targetBase: parsedTarget,
        leverage,
        candidateHighlights: highlights,
        priorities,
        competingOffers: competing,
        applicantName,
      });
      setPlan(generated);
      setTab("email");
      try {
        const saved = await saveNegotiationPlan(userId, offer.id, generated);
        onSaved(saved);
      } catch {
        toast.message("Plan generated, but it could not be saved to the offer.");
      }
      if (generated.source === "template") {
        toast.message("AI is unavailable right now — used the built-in negotiation template.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate a plan.");
    } finally {
      setIsGenerating(false);
    }
  };

  const mailto = plan
    ? `mailto:?subject=${encodeURIComponent(plan.email.subject)}&body=${encodeURIComponent(plan.email.body)}`
    : "#";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5">
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-primary/10 via-card to-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <Handshake size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Negotiation coach — {offer.company}
              </h2>
              <p className="text-xs text-muted-foreground">
                Current base {money(offer.baseSalary)} · {offer.jobTitle}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-muted-foreground hover:bg-secondary/60">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tone</span>
                <div className="flex gap-1.5 mt-1">
                  {NEGOTIATION_TONES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        tone === t
                          ? "bg-[#0d131f] text-white dark:bg-white dark:text-black border-transparent"
                          : "border-input text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      {TONE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Target base (optional)
                </span>
                <input
                  inputMode="decimal"
                  value={targetBase}
                  onChange={(e) => setTargetBase(e.target.value)}
                  className={inputClass}
                  placeholder={`Leave empty for a suggestion (${money(preview.target)})`}
                />
                {targetInvalid ? <span className="text-[11px] font-semibold text-rose-500">Enter a positive number.</span> : null}
              </label>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  What matters most (up to 5)
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {NEGOTIATION_PRIORITIES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => togglePriority(name)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        priorities.includes(name)
                          ? "bg-primary/15 border-primary text-primary"
                          : "border-input text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {otherOffers.length > 0 ? (
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={useCompeting} onChange={(e) => setUseCompeting(e.target.checked)} />
                  Use my {otherOffers.length} other offer{otherOffers.length > 1 ? "s" : ""} as leverage
                </label>
              ) : null}
            </div>

            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Leverage / context (optional)
                </span>
                <textarea
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  rows={2}
                  maxLength={1500}
                  className={inputClass}
                  placeholder="e.g. Final-round at another company; relocating for this role…"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Your strongest selling points (optional)
                </span>
                <textarea
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  rows={2}
                  maxLength={3000}
                  className={inputClass}
                  placeholder="Only real achievements — the coach will not invent any."
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Lowest counter", value: preview.floor },
              { label: "Target", value: preview.target },
              { label: "Opening ask", value: preview.opening },
            ].map((cell) => (
              <div key={cell.label}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{cell.label}</div>
                <div className="text-base font-black text-foreground">{money(cell.value)}</div>
              </div>
            ))}
            <div className="col-span-3 text-[11px] text-muted-foreground">
              +{preview.raisePct}% on base · {preview.rationale}
            </div>
          </div>

          {preview.aggressive ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>This target is more than 25% above the offer. It may land badly — consider a smaller step.</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-95 disabled:opacity-60"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {plan ? "Regenerate plan" : "Generate negotiation plan"}
          </button>

          {plan ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span
                  className={`px-2 py-0.5 rounded-full border font-bold ${
                    plan.source === "ai"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {plan.source === "ai" ? "Written by AI" : "Built-in template"}
                </span>
                <span>Saved to this offer · review and personalise before sending.</span>
              </div>

              <section>
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground mb-1">Strategy</h3>
                <p className="text-sm text-foreground/90 leading-relaxed">{plan.strategy}</p>
              </section>

              <section>
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground mb-1">Talking points</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/90">
                  {plan.talkingPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="flex gap-1.5 mb-2">
                  {(
                    [
                      ["email", "Email"],
                      ["phone", "Phone script"],
                      ["pushback", "If they push back"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        tab === key
                          ? "bg-[#0d131f] text-white dark:bg-white dark:text-black"
                          : "text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {tab === "email" ? (
                  <div className="rounded-xl border border-border/80 p-3 space-y-2">
                    <div className="text-xs font-bold text-foreground">Subject: {plan.email.subject}</div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">{plan.email.body}</pre>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => copyText(`Subject: ${plan.email.subject}\n\n${plan.email.body}`, "Email")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-semibold hover:bg-secondary/60"
                      >
                        <Copy size={13} /> Copy
                      </button>
                      <a
                        href={mailto}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-semibold hover:bg-secondary/60"
                      >
                        <Mail size={13} /> Open in email app
                      </a>
                    </div>
                  </div>
                ) : null}

                {tab === "phone" ? (
                  <div className="rounded-xl border border-border/80 p-3 space-y-2">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">{plan.phoneScript}</pre>
                    <button
                      type="button"
                      onClick={() => copyText(plan.phoneScript, "Script")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-semibold hover:bg-secondary/60"
                    >
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                ) : null}

                {tab === "pushback" ? (
                  <div className="space-y-2">
                    {plan.pushbackResponses.map((item, i) => (
                      <div key={i} className="rounded-xl border border-border/80 p-3">
                        <div className="text-xs font-bold text-foreground">“{item.objection}”</div>
                        <p className="text-sm text-foreground/90 mt-1">{item.response}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              {plan.risks.length > 0 ? (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
                    Keep in mind
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-foreground/90">
                    {plan.risks.map((risk, i) => (
                      <li key={i}>{risk}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
