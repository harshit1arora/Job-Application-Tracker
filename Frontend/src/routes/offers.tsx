import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Handshake,
  Trophy,
  Loader2,
  Scale,
  Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { OfferFormModal } from "@/components/offer-form-modal";
import { NegotiationPanel } from "@/components/negotiation-panel";
import { getApplications } from "@/lib/applications-service";
import { deleteOffer, getOffers, updateOffer } from "@/lib/offers-service";
import { getProfile } from "@/lib/profile";
import {
  DEFAULT_WEIGHTS,
  compareOffers,
  formatMoney,
  haveSameCurrency,
} from "@/lib/offer-math";
import type { BestMetric, ComparisonWeights } from "@/lib/offer-math";
import { OFFER_STATUSES } from "@/lib/types";
import type { ApplicationDocument, OfferDocument, OfferStatus } from "@/lib/types";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [{ title: "Offers & Negotiation — JobPilot" }],
  }),
  component: OffersPage,
});

const PREFILL_KEY = "jobpilot_offer_prefill";
const MAX_COMPARE = 4;

const STATUS_STYLES: Record<OfferStatus, string> = {
  Pending: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Negotiating: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Declined: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

function daysUntil(date: string | undefined): number | null {
  if (!date) return null;
  const target = new Date(`${date}T23:59:59`).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500" aria-label={`${value} out of 5`}>
      {"★".repeat(value)}
      <span className="text-muted-foreground/40">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function OffersPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [offers, setOffers] = useState<OfferDocument[]>([]);
  const [applications, setApplications] = useState<ApplicationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [weights, setWeights] = useState<ComparisonWeights>(DEFAULT_WEIGHTS);
  const [formOffer, setFormOffer] = useState<OfferDocument | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [prefillApplication, setPrefillApplication] = useState<ApplicationDocument | null>(null);
  const [negotiating, setNegotiating] = useState<OfferDocument | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated && !user) {
      navigate({ to: "/login" });
      return;
    }
    if (!user) return;
    let active = true;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [offerList, appList] = await Promise.all([getOffers(user.id), getApplications(user.id)]);
        if (!active) return;
        setOffers(offerList);
        setApplications(appList);
        setSelected((prev) => prev.filter((id) => offerList.some((o) => o.id === id)));

        // Arrived from an application marked "Offer": open the form pre-filled.
        let prefillId: string | null = null;
        try {
          prefillId = sessionStorage.getItem(PREFILL_KEY);
          if (prefillId) sessionStorage.removeItem(PREFILL_KEY);
        } catch {
          prefillId = null;
        }
        const source = prefillId ? appList.find((a) => a.id === prefillId) : undefined;
        if (source) {
          const alreadyHasOffer = offerList.some((o) => o.applicationId === source.id);
          if (alreadyHasOffer) {
            toast.message(`${source.company} already has an offer on file.`);
          } else {
            setPrefillApplication(source);
            setFormOffer(null);
            setShowForm(true);
          }
        }
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to load offers.";
        setLoadError(message);
        toast.error(message);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, isAuthenticated, isAuthLoading, navigate]);

  const selectedOffers = useMemo(
    () => offers.filter((o) => selected.includes(o.id)),
    [offers, selected],
  );
  const selectedCurrency = selectedOffers[0]?.currency;
  const comparison = useMemo(
    () => (selectedOffers.length >= 2 && haveSameCurrency(selectedOffers) ? compareOffers(selectedOffers, weights) : []),
    [selectedOffers, weights],
  );

  const toggleSelected = (offer: OfferDocument) => {
    setSelected((prev) => {
      if (prev.includes(offer.id)) return prev.filter((id) => id !== offer.id);
      if (prev.length >= MAX_COMPARE) {
        toast.message(`You can compare up to ${MAX_COMPARE} offers at a time.`);
        return prev;
      }
      return [...prev, offer.id];
    });
  };

  const handleSaved = (saved: OfferDocument) => {
    setOffers((prev) => {
      const exists = prev.some((o) => o.id === saved.id);
      return exists ? prev.map((o) => (o.id === saved.id ? saved : o)) : [saved, ...prev];
    });
    setNegotiating((prev) => (prev && prev.id === saved.id ? saved : prev));
    setShowForm(false);
    setFormOffer(null);
    setPrefillApplication(null);
  };

  const handleStatusChange = async (offer: OfferDocument, status: OfferStatus) => {
    if (!user) return;
    try {
      const updated = await updateOffer(user.id, offer.id, { status });
      setOffers((prev) => prev.map((o) => (o.id === offer.id ? updated : o)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the status.");
    }
  };

  const handleDelete = async (offer: OfferDocument) => {
    if (!user) return;
    if (!window.confirm(`Delete the offer from ${offer.company}? This cannot be undone.`)) return;
    try {
      await deleteOffer(user.id, offer.id);
      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
      setSelected((prev) => prev.filter((id) => id !== offer.id));
      toast.success("Offer deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the offer.");
    }
  };

  const rows: Array<{
    label: string;
    metric?: BestMetric;
    render: (item: (typeof comparison)[number]) => string;
  }> = [
    { label: "Base salary", metric: "baseSalary", render: (i) => formatMoney(i.offer.baseSalary, i.offer.currency) },
    { label: "Annual bonus", metric: "annualBonus", render: (i) => formatMoney(i.offer.annualBonus, i.offer.currency) },
    { label: "Signing bonus", metric: "signingBonus", render: (i) => formatMoney(i.offer.signingBonus, i.offer.currency) },
    {
      label: "Equity (total / per yr)",
      metric: "equityValue",
      render: (i) =>
        `${formatMoney(i.offer.equityValue, i.offer.currency)} / ${formatMoney(i.metrics.equityPerYear, i.offer.currency)}`,
    },
    { label: "Retirement match", render: (i) => `${i.offer.retirementMatchPct}%` },
    { label: "Other benefits / yr", render: (i) => formatMoney(i.offer.otherBenefitsValue, i.offer.currency) },
    { label: "Total comp / yr", metric: "annualTotal", render: (i) => formatMoney(i.metrics.annualTotal, i.offer.currency) },
    { label: "First-year total", metric: "firstYear", render: (i) => formatMoney(i.metrics.firstYear, i.offer.currency) },
    { label: "4-year value", render: (i) => formatMoney(i.metrics.fourYear, i.offer.currency) },
    { label: "PTO days", metric: "ptoDays", render: (i) => (i.offer.ptoDays !== undefined ? String(i.offer.ptoDays) : "—") },
    { label: "Work mode", render: (i) => i.offer.workMode },
    { label: "Location", render: (i) => i.offer.location || "—" },
    { label: "Deadline", render: (i) => i.offer.deadline || "—" },
  ];

  const weightLabels: Array<[keyof ComparisonWeights, string]> = [
    ["compensation", "Compensation"],
    ["growth", "Growth"],
    ["workLife", "Work-life"],
    ["culture", "Culture"],
  ];

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      <DashboardSidebar />

      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto overflow-y-auto w-full space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <Scale size={14} /> Offer Comparison &amp; Negotiation
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Offers ({offers.length})
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare packages side by side, then let the coach draft your counter-offer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormOffer(null);
              setPrefillApplication(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-95 transition-opacity"
          >
            <Plus size={15} /> Add offer
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
            <Loader2 className="animate-spin" size={16} /> Loading offers…
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-600 dark:text-rose-300">
            {loadError}
          </div>
        ) : offers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white dark:bg-[#111622] p-10 text-center space-y-3">
            <Briefcase className="mx-auto text-muted-foreground" size={28} />
            <h2 className="text-base font-bold">No offers yet</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Add an offer to see its true yearly value (equity spread over vesting, bonuses, benefits), compare
              it with others and generate negotiation scripts.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              <Plus size={14} /> Add your first offer
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {offers.map((offer) => {
                const checked = selected.includes(offer.id);
                const otherCurrency = Boolean(selectedCurrency) && selectedCurrency !== offer.currency;
                const remaining = daysUntil(offer.deadline);
                const closed = offer.status === "Accepted" || offer.status === "Declined";
                const total = compareOffers([offer])[0]?.metrics.annualTotal ?? 0;
                return (
                  <div
                    key={offer.id}
                    className={`rounded-2xl border bg-white dark:bg-[#111622] p-4 shadow-xs space-y-3 ${
                      checked ? "border-primary ring-1 ring-primary/40" : "border-border/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate">{offer.company}</h3>
                        <p className="text-xs text-muted-foreground truncate">{offer.jobTitle}</p>
                      </div>
                      <select
                        value={offer.status}
                        onChange={(e) => handleStatusChange(offer, e.target.value as OfferStatus)}
                        aria-label={`Status of ${offer.company} offer`}
                        className={`rounded-full border px-2 py-1 text-[10px] font-bold focus:outline-none ${STATUS_STYLES[offer.status]}`}
                      >
                        {OFFER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="text-2xl font-black">{formatMoney(total, offer.currency)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        total comp / yr · base {formatMoney(offer.baseSalary, offer.currency)}
                      </div>
                    </div>

                    {remaining !== null && !closed ? (
                      <div
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                          remaining < 0 ? "text-rose-500" : remaining <= 3 ? "text-amber-500" : "text-muted-foreground"
                        }`}
                      >
                        <Clock size={12} />
                        {remaining < 0
                          ? `Deadline passed ${Math.abs(remaining)}d ago`
                          : remaining === 0
                            ? "Decision due today"
                            : `${remaining}d left to decide`}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-1">
                      <label
                        className={`flex items-center gap-2 text-xs font-semibold ${otherCurrency ? "opacity-50" : ""}`}
                        title={otherCurrency ? "Different currency — can't be compared directly" : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={otherCurrency}
                          onChange={() => toggleSelected(offer)}
                        />
                        Compare
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setNegotiating(offer)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1.5 text-[11px] font-bold hover:bg-emerald-500/20"
                        >
                          <Handshake size={13} /> {offer.negotiationPlan ? "Plan" : "Negotiate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormOffer(offer);
                            setShowForm(true);
                          }}
                          aria-label={`Edit ${offer.company} offer`}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary/60"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(offer)}
                          aria-label={`Delete ${offer.company} offer`}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <section className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-black flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" /> Side-by-side comparison
                </h2>
                <span className="text-[11px] text-muted-foreground">
                  {selected.length}/{MAX_COMPARE} selected — tick “Compare” on at least two offers
                </span>
              </div>

              {selectedOffers.length >= 2 && !haveSameCurrency(selectedOffers) ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  The selected offers use different currencies, so they can't be compared directly.
                </p>
              ) : null}

              {comparison.length >= 2 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {weightLabels.map(([key, label]) => (
                      <label key={key} className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {label}: {weights[key]}
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={weights[key]}
                          onChange={(e) => setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                          className="w-full mt-1"
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeights(DEFAULT_WEIGHTS)}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Reset weights
                  </button>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/70 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4 font-bold"> </th>
                          {comparison.map((item) => (
                            <th key={item.offer.id} className="py-2 px-3 font-bold">
                              <div className="text-foreground text-xs normal-case">{item.offer.company}</div>
                              <div className="font-medium normal-case text-muted-foreground">{item.offer.jobTitle}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/50 bg-primary/5">
                          <td className="py-2.5 pr-4 font-bold">Weighted score</td>
                          {comparison.map((item) => (
                            <td key={item.offer.id} className="py-2.5 px-3 font-black text-sm">
                              {item.rank === 1 ? <Trophy size={13} className="inline mr-1 text-amber-500" /> : null}
                              {item.weightedScore}
                              <span className="ml-1 text-[10px] font-semibold text-muted-foreground">#{item.rank}</span>
                            </td>
                          ))}
                        </tr>
                        {rows.map((row) => (
                          <tr key={row.label} className="border-b border-border/40">
                            <td className="py-2 pr-4 font-semibold text-muted-foreground">{row.label}</td>
                            {comparison.map((item) => {
                              const best = row.metric ? item.bestIn.includes(row.metric) : false;
                              return (
                                <td
                                  key={item.offer.id}
                                  className={`py-2 px-3 ${best ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}`}
                                >
                                  {row.render(item)}
                                  {best ? <span className="ml-1">▲</span> : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {(
                          [
                            ["Growth", "growthRating"],
                            ["Work-life balance", "workLifeRating"],
                            ["Culture & team", "cultureRating"],
                          ] as const
                        ).map(([label, key]) => (
                          <tr key={key} className="border-b border-border/40">
                            <td className="py-2 pr-4 font-semibold text-muted-foreground">{label}</td>
                            {comparison.map((item) => (
                              <td key={item.offer.id} className="py-2 px-3">
                                <Stars value={item.offer[key]} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ▲ marks the best value in each row. Compensation score is relative to the best offer in the set;
                    4-year value assumes today's package stays flat. Verify equity value with the company.
                  </p>
                </>
              ) : null}
            </section>
          </>
        )}
      </main>

      {showForm && user ? (
        <OfferFormModal
          userId={user.id}
          applications={applications}
          offer={formOffer}
          prefillApplication={prefillApplication}
          onClose={() => {
            setShowForm(false);
            setFormOffer(null);
            setPrefillApplication(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {negotiating && user ? (
        <NegotiationPanel
          userId={user.id}
          offer={negotiating}
          otherOffers={offers.filter((o) => o.id !== negotiating.id && o.currency === negotiating.currency)}
          applicantName={getProfile(user.id).fullName || user.name}
          onClose={() => setNegotiating(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
