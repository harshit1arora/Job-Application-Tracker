import { useState, useEffect } from "react";
import { type UserProfile, autofillText, getAutofillFieldMap, getMissingProfileFields } from "@/lib/profile";
import { generateCoverLetter } from "@/lib/ai";
import { toast } from "sonner";
import {
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  X,
  Building2,
  Briefcase,
  MapPin,
  FileText,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { SuggestedJob } from "@/lib/types";

interface ApplyPortalModalProps {
  job: SuggestedJob;
  profile: UserProfile;
  onOpenMissingFields: () => void;
  onApplyAndTrack: (job: SuggestedJob) => Promise<void>;
  onClose: () => void;
}

export function ApplyPortalModal({
  job,
  profile,
  onOpenMissingFields,
  onApplyAndTrack,
  onClose,
}: ApplyPortalModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string>("");
  const [showLetterPreview, setShowLetterPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const missingFields = getMissingProfileFields(profile);
  const fieldMap = getAutofillFieldMap(profile);

  // Auto-generate tailored 8-10 line letter for this specific job & company
  useEffect(() => {
    let isMounted = true;
    const generate = async () => {
      setIsGeneratingLetter(true);
      setShowLetterPreview(true);
      try {
        const letter = await generateCoverLetter(
          profile.fullName || "Alex Carter",
          job.company,
          job.role,
          job.description,
          profile.skills?.join(", ") || profile.resumeText
        );
        if (isMounted) setCoverLetter(letter);
      } catch {
        // fallback handled inside generateCoverLetter
      } finally {
        if (isMounted) setIsGeneratingLetter(false);
      }
    };
    void generate();
    return () => {
      isMounted = false;
    };
  }, [job.company, job.role, profile.fullName]);

  const handleCopySingle = async (key: string, value: string) => {
    if (!value) {
      toast.error(`Please provide your ${key} first.`);
      onOpenMissingFields();
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopiedField(key);
    toast.success(`Copied ${key} to clipboard!`);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleCopyMaster = async () => {
    const payload = autofillText(profile);
    if (!payload.trim()) {
      toast.error("Profile is empty. Please upload or fill your resume first.");
      return;
    }
    await navigator.clipboard.writeText(payload);
    toast.success("Complete application data bundle copied! You can paste into forms.");
  };

  const handleGenerateCoverLetter = async () => {
    setIsGeneratingLetter(true);
    setShowLetterPreview(true);
    try {
      const letter = await generateCoverLetter(
        profile.fullName || "Candidate",
        job.company,
        job.role,
        job.description,
        profile.resumeText
      );
      setCoverLetter(letter);
      toast.success("AI tailored cover letter generated!");
    } catch {
      toast.error("Failed to generate cover letter.");
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const handleLaunchAndTrack = async () => {
    setIsSubmitting(true);
    try {
      // 1. Copy autofill data to clipboard automatically
      await navigator.clipboard.writeText(autofillText(profile));

      // 2. Open career portal
      window.open(job.portalUrl, "_blank", "noopener,noreferrer");

      // 3. Save application to dashboard
      await onApplyAndTrack(job);

      toast.success(`Redirected to ${job.company} portal! Application is now tracked on your dashboard.`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              <Building2 size={14} />
              {job.company} • {job.source}
            </div>
            <h2 className="text-xl font-bold text-foreground">{job.role}</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {job.location}
              </span>
              <span>•</span>
              <span className="text-foreground font-medium">{job.salaryRange}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Missing fields alert */}
        {missingFields.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-300">
              <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              <span>
                Missing fields: <strong>{missingFields.join(", ")}</strong>
              </span>
            </div>
            <button
              onClick={onOpenMissingFields}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 underline hover:opacity-80"
            >
              Fill with AI Assistant
            </button>
          </div>
        )}

        {/* AI Match Overview */}
        <div className="mb-5 rounded-xl border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles size={13} className="text-primary" /> AI Match Score
            </span>
            <span className="text-sm font-black text-emerald-500">{job.matchScore ?? 92}% Match</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{job.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.requiredSkills.map((sk) => (
              <span
                key={sk}
                className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/90"
              >
                {sk}
              </span>
            ))}
          </div>
        </div>

        {/* 1-Click Auto-Fill Sheet */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <FileText size={15} className="text-primary" /> Pre-Filled Application Sheet
              </h3>
              <p className="text-[11px] text-muted-foreground">
                All details parsed from your résumé. Click any field to copy instantly into the career portal.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyMaster}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Copy size={13} />
              Copy Master Bundle
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {Object.entries(fieldMap).map(([key, value]) => (
              <div
                key={key}
                onClick={() => handleCopySingle(key, value)}
                className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  value
                    ? "border-border bg-background hover:border-primary/50 hover:bg-secondary/40"
                    : "border-dashed border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                }`}
                title="Click to copy to clipboard"
              >
                <div className="truncate mr-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{key}</p>
                  <p className="text-xs font-medium text-foreground truncate mt-0.5">
                    {value || "Missing — click to add"}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-1 rounded-md text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                >
                  {copiedField === key ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI Cover Letter Generator */}
        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles size={14} className="text-violet-500" /> AI Tailored Cover Letter
            </span>
            <button
              type="button"
              onClick={handleGenerateCoverLetter}
              disabled={isGeneratingLetter}
              className="text-xs font-bold text-violet-500 hover:text-violet-400 transition-colors flex items-center gap-1"
            >
              {isGeneratingLetter ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {coverLetter ? "Regenerate Letter" : "Generate 1-Click Letter"}
            </button>
          </div>

          {showLetterPreview && (
            <div className="mt-2">
              {isGeneratingLetter ? (
                <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  Generating tailored letter for {job.company}...
                </div>
              ) : (
                <div className="relative">
                  <textarea
                    rows={8}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background p-3 text-xs leading-relaxed text-foreground focus:outline-none focus:border-primary font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(coverLetter);
                      toast.success("Cover letter copied!");
                    }}
                    className="absolute right-2 bottom-3 px-2 py-1 bg-secondary text-[11px] font-semibold rounded hover:bg-accent flex items-center gap-1"
                  >
                    <Copy size={11} /> Copy Letter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border mt-auto">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-500" />
            Auto-tracks as "Applied" on your dashboard
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial rounded-xl border border-border px-4 py-2.5 text-xs font-semibold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLaunchAndTrack}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95 transition-opacity disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ExternalLink size={14} />
              )}
              Launch Career Portal & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
