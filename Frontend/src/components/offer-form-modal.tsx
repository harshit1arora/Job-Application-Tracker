import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, X, Briefcase, Info } from "lucide-react";
import { createOffer, updateOffer } from "@/lib/offers-service";
import type { OfferPatch } from "@/lib/offers-service";
import { parseSalaryRange } from "@/lib/offer-math";
import { AppError, CURRENCIES, OFFER_STATUSES, WORK_MODES } from "@/lib/types";
import type {
  ApplicationDocument,
  CreateOfferInput,
  OfferDocument,
  OfferStatus,
  WorkMode,
} from "@/lib/types";

interface OfferFormModalProps {
  userId: string;
  applications: ApplicationDocument[];
  /** Existing offer to edit. When omitted the modal creates a new offer. */
  offer?: OfferDocument | null;
  /** Application to pre-fill from (e.g. when arriving from an application marked "Offer"). */
  prefillApplication?: ApplicationDocument | null;
  onClose: () => void;
  onSaved: (offer: OfferDocument) => void;
}

const inputClass =
  "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none";

function toNumber(value: string): number | undefined {
  const trimmed = value.replace(/,/g, "").trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && !error ? <span className="block text-[10px] text-muted-foreground">{hint}</span> : null}
      {error ? <span className="block text-[11px] font-semibold text-rose-500">{error}</span> : null}
    </label>
  );
}

function RatingPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${label} ${n} of 5`}
            className={`h-8 w-8 rounded-lg border text-xs font-bold transition-colors ${
              n <= value
                ? "border-primary bg-primary/15 text-primary"
                : "border-input text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OfferFormModal({
  userId,
  applications,
  offer,
  prefillApplication,
  onClose,
  onSaved,
}: OfferFormModalProps) {
  const isEdit = Boolean(offer);

  const initialSalary = prefillApplication ? parseSalaryRange(prefillApplication.salaryRange) : null;
  const initialCurrency =
    offer?.currency ??
    (initialSalary?.currency && (CURRENCIES as readonly string[]).includes(initialSalary.currency)
      ? initialSalary.currency
      : "USD");

  const [applicationId, setApplicationId] = useState<string>(
    offer?.applicationId ?? prefillApplication?.id ?? "",
  );
  const [company, setCompany] = useState(offer?.company ?? prefillApplication?.company ?? "");
  const [jobTitle, setJobTitle] = useState(offer?.jobTitle ?? prefillApplication?.jobTitle ?? "");
  const [location, setLocation] = useState(offer?.location ?? prefillApplication?.location ?? "");
  const [workMode, setWorkMode] = useState<WorkMode>(offer?.workMode ?? "Hybrid");
  const [currency, setCurrency] = useState<string>(initialCurrency);
  const [baseSalary, setBaseSalary] = useState(
    offer ? String(offer.baseSalary) : initialSalary ? String(initialSalary.midpoint) : "",
  );
  const [annualBonus, setAnnualBonus] = useState(offer ? String(offer.annualBonus) : "0");
  const [signingBonus, setSigningBonus] = useState(offer ? String(offer.signingBonus) : "0");
  const [equityValue, setEquityValue] = useState(offer ? String(offer.equityValue) : "0");
  const [equityVestYears, setEquityVestYears] = useState(offer ? String(offer.equityVestYears) : "4");
  const [retirementMatchPct, setRetirementMatchPct] = useState(
    offer ? String(offer.retirementMatchPct) : "0",
  );
  const [otherBenefitsValue, setOtherBenefitsValue] = useState(
    offer ? String(offer.otherBenefitsValue) : "0",
  );
  const [ptoDays, setPtoDays] = useState(offer?.ptoDays !== undefined ? String(offer.ptoDays) : "");
  const [growthRating, setGrowthRating] = useState(offer?.growthRating ?? 3);
  const [workLifeRating, setWorkLifeRating] = useState(offer?.workLifeRating ?? 3);
  const [cultureRating, setCultureRating] = useState(offer?.cultureRating ?? 3);
  const [deadline, setDeadline] = useState(offer?.deadline ?? "");
  const [status, setStatus] = useState<OfferStatus>(offer?.status ?? "Pending");
  const [notes, setNotes] = useState(offer?.notes ?? "");
  const [prefillNote, setPrefillNote] = useState<string | null>(
    initialSalary ? "Base salary was pre-filled from the application's salary range — enter the exact offer." : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const applyApplication = (id: string) => {
    setApplicationId(id);
    const application = applications.find((a) => a.id === id);
    if (!application) return;
    setCompany(application.company);
    setJobTitle(application.jobTitle);
    if (application.location) setLocation(application.location);
    const parsed = parseSalaryRange(application.salaryRange);
    if (parsed) {
      setBaseSalary(String(parsed.midpoint));
      if (parsed.currency && (CURRENCIES as readonly string[]).includes(parsed.currency)) {
        setCurrency(parsed.currency);
      }
      setPrefillNote(
        "Base salary was pre-filled from the application's salary range — enter the exact offer.",
      );
    } else {
      setPrefillNote(null);
    }
  };

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setErrors({});

    const numbers = {
      baseSalary: toNumber(baseSalary),
      annualBonus: toNumber(annualBonus) ?? 0,
      signingBonus: toNumber(signingBonus) ?? 0,
      equityValue: toNumber(equityValue) ?? 0,
      equityVestYears: toNumber(equityVestYears) ?? 4,
      retirementMatchPct: toNumber(retirementMatchPct) ?? 0,
      otherBenefitsValue: toNumber(otherBenefitsValue) ?? 0,
      ptoDays: toNumber(ptoDays),
    };

    setIsSaving(true);
    try {
      let saved: OfferDocument;
      if (offer) {
        const patch: OfferPatch = {
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          location: location.trim() || null,
          workMode,
          currency,
          baseSalary: numbers.baseSalary ?? 0,
          annualBonus: numbers.annualBonus,
          signingBonus: numbers.signingBonus,
          equityValue: numbers.equityValue,
          equityVestYears: numbers.equityVestYears,
          retirementMatchPct: numbers.retirementMatchPct,
          otherBenefitsValue: numbers.otherBenefitsValue,
          ptoDays: numbers.ptoDays ?? null,
          growthRating,
          workLifeRating,
          cultureRating,
          deadline: deadline || null,
          status,
          notes: notes.trim() || null,
        };
        saved = await updateOffer(userId, offer.id, patch);
        toast.success(`Updated offer from ${saved.company}`);
      } else {
        const input: CreateOfferInput = {
          applicationId: applicationId || undefined,
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          location: location.trim() || undefined,
          workMode,
          currency,
          baseSalary: numbers.baseSalary ?? 0,
          annualBonus: numbers.annualBonus,
          signingBonus: numbers.signingBonus,
          equityValue: numbers.equityValue,
          equityVestYears: numbers.equityVestYears,
          retirementMatchPct: numbers.retirementMatchPct,
          otherBenefitsValue: numbers.otherBenefitsValue,
          ptoDays: numbers.ptoDays,
          growthRating,
          workLifeRating,
          cultureRating,
          deadline: deadline || undefined,
          status,
          notes: notes.trim() || undefined,
        };
        saved = await createOffer(userId, input);
        toast.success(`Added offer from ${saved.company}`);
      }
      onSaved(saved);
    } catch (error) {
      if (error instanceof AppError && error.fields) {
        setErrors(error.fields);
        toast.error("Please fix the highlighted fields.");
      } else {
        toast.error(error instanceof Error ? error.message : "Could not save the offer.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const linkableApplications = applications.filter((a) => a.status !== "Rejected");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-primary/10 via-card to-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/30">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{isEdit ? "Edit offer" : "Add a job offer"}</h2>
              <p className="text-xs text-muted-foreground">
                Enter yearly amounts. Equity is the total grant value and is spread over its vesting period.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {!isEdit && linkableApplications.length > 0 ? (
            <Field label="Link to a tracked application (optional)">
              <select
                value={applicationId}
                onChange={(e) => applyApplication(e.target.value)}
                className={inputClass}
              >
                <option value="">— Not linked —</option>
                {linkableApplications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.company} · {app.jobTitle} ({app.status})
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {prefillNote ? (
            <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-[11px] text-sky-700 dark:text-sky-300">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{prefillNote}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company" error={errors["company"]}>
              <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} placeholder="e.g. Stripe" />
            </Field>
            <Field label="Job title" error={errors["jobTitle"]}>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={inputClass} placeholder="e.g. Senior Engineer" />
            </Field>
            <Field label="Location" error={errors["location"]}>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="City, country" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Work mode" error={errors["workMode"]}>
                <select value={workMode} onChange={(e) => setWorkMode(e.target.value as WorkMode)} className={inputClass}>
                  {WORK_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency" error={errors["currency"]}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground mb-2">Compensation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Base salary / yr" error={errors["baseSalary"]}>
                <input inputMode="decimal" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className={inputClass} placeholder="e.g. 1800000" />
              </Field>
              <Field label="Annual bonus" error={errors["annualBonus"]}>
                <input inputMode="decimal" value={annualBonus} onChange={(e) => setAnnualBonus(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Signing bonus (one-time)" error={errors["signingBonus"]}>
                <input inputMode="decimal" value={signingBonus} onChange={(e) => setSigningBonus(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Equity (total grant)" error={errors["equityValue"]}>
                <input inputMode="decimal" value={equityValue} onChange={(e) => setEquityValue(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Vesting (years)" error={errors["equityVestYears"]}>
                <input inputMode="decimal" value={equityVestYears} onChange={(e) => setEquityVestYears(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Retirement match (% of base)" error={errors["retirementMatchPct"]}>
                <input inputMode="decimal" value={retirementMatchPct} onChange={(e) => setRetirementMatchPct(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Other benefits value / yr" error={errors["otherBenefitsValue"]} hint="Insurance, allowances, stipends">
                <input inputMode="decimal" value={otherBenefitsValue} onChange={(e) => setOtherBenefitsValue(e.target.value)} className={inputClass} />
              </Field>
              <Field label="PTO days / yr" error={errors["ptoDays"]}>
                <input inputMode="numeric" value={ptoDays} onChange={(e) => setPtoDays(e.target.value)} className={inputClass} placeholder="optional" />
              </Field>
              <Field label="Decision deadline" error={errors["deadline"]} hint="Adds a reminder to your tracker">
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${inputClass} [color-scheme:dark]`} />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground mb-2">
              How does it feel? (1 = poor, 5 = excellent)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <RatingPicker label="Growth" value={growthRating} onChange={setGrowthRating} />
              <RatingPicker label="Work-life balance" value={workLifeRating} onChange={setWorkLifeRating} />
              <RatingPicker label="Culture & team" value={cultureRating} onChange={setCultureRating} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Status" error={errors["status"]}>
              <select value={status} onChange={(e) => setStatus(e.target.value as OfferStatus)} className={inputClass}>
                {OFFER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" error={errors["notes"]}>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Anything worth remembering: team, manager, visa, relocation…"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-card">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-95 disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isEdit ? "Save changes" : "Add offer"}
          </button>
        </div>
      </form>
    </div>
  );
}
