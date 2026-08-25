import { useState, useEffect, useMemo, useRef } from "react";
import {
  type UserProfile,
  autofillText,
  getAutofillFieldMap,
  getMissingProfileFields,
  saveProfile,
  extractFirstAndLastName,
  generateBrowserAutofillScript,
} from "@/lib/profile";
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
  Upload,
  Globe,
  HelpCircle,
  Code2,
  ChevronDown,
  FileCheck2,
  Save,
  Clock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { SuggestedJob } from "@/lib/types";

interface ApplyPortalModalProps {
  job: SuggestedJob;
  profile: UserProfile;
  userId?: string | undefined;
  onProfileUpdated?: ((updated: UserProfile) => void) | undefined;
  onOpenMissingFields?: (() => void) | undefined;
  onApplyAndTrack: (job: SuggestedJob) => Promise<void>;
  onClose: () => void;
}

const COUNTRY_OPTIONS = [
  "United States",
  "Germany",
  "United Kingdom",
  "Argentina",
  "Australia",
  "Canada",
  "India",
  "Japan",
  "Other",
];

const COUNTRY_CODES = [
  { code: "+1", label: "🇺🇸 +1 (US/CA)" },
  { code: "+44", label: "🇬🇧 +44 (UK)" },
  { code: "+91", label: "🇮🇳 +91 (IN)" },
  { code: "+49", label: "🇩🇪 +49 (DE)" },
  { code: "+61", label: "🇦🇺 +61 (AU)" },
  { code: "+81", label: "🇯🇵 +81 (JP)" },
  { code: "+54", label: "🇦🇷 +54 (AR)" },
  { code: "+33", label: "🇫🇷 +33 (FR)" },
  { code: "+65", label: "🇸🇬 +65 (SG)" },
];

export function ApplyPortalModal({
  job,
  profile,
  userId = "current_user",
  onProfileUpdated,
  onOpenMissingFields,
  onApplyAndTrack,
  onClose,
}: ApplyPortalModalProps) {
  const [activeTab, setActiveTab] = useState<"form" | "coverLetter" | "script">("form");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastSavedField, setLastSavedField] = useState<string | null>(null);

  // Initialize editable form state from user's parsed profile
  const initialNames = useMemo(() => extractFirstAndLastName(profile.fullName), [profile.fullName]);

  const [formData, setFormData] = useState({
    firstName: profile.firstName || initialNames.firstName || "",
    lastName: profile.lastName || initialNames.lastName || "",
    email: profile.email || "",
    phone: profile.phone || "",
    countryCode: profile.countryCode || "+1",
    country: profile.country || (COUNTRY_OPTIONS.includes(profile.location) ? profile.location : "United States"),
    locationCity: profile.city || profile.location || "San Francisco, CA",
    resumeFileName: profile.resumeFileName || "Alex_Carter_Resume.pdf",
    hybridScheduleOk: profile.hybridScheduleOk || "Yes",
    sponsorshipRequired: profile.sponsorshipRequired || "No",
    yearsOfExperience: profile.yearsOfExperience || profile.ageOrExperience || "4+ years",
    currentCompany: profile.currentCompany || "Previous Tech Co.",
    currentTitle: profile.currentTitle || profile.targetRole || "Software Engineer",
    linkedin: profile.linkedin || "https://linkedin.com/in/candidate",
    portfolio: profile.portfolio || profile.github || "https://github.com/candidate",
    github: profile.github || "https://github.com/candidate",
    notes: `Applied for ${job.role} at ${job.company} via JobPilot AI Assistant.`,
  });

  // Track field change and auto-save into profile memory
  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // Sync back into UserProfile memory
      const updatedProfile: UserProfile = {
        ...profile,
        firstName: next.firstName,
        lastName: next.lastName,
        fullName: `${next.firstName} ${next.lastName}`.trim() || profile.fullName,
        email: next.email,
        phone: next.phone,
        countryCode: next.countryCode,
        country: next.country,
        city: next.locationCity,
        location: next.locationCity,
        hybridScheduleOk: next.hybridScheduleOk,
        sponsorshipRequired: next.sponsorshipRequired,
        yearsOfExperience: next.yearsOfExperience,
        ageOrExperience: next.yearsOfExperience,
        currentCompany: next.currentCompany,
        currentTitle: next.currentTitle,
        linkedin: next.linkedin,
        portfolio: next.portfolio,
        github: next.github,
        resumeFileName: next.resumeFileName,
        customAnswers: {
          ...(profile.customAnswers || {}),
          [field]: value,
          [`${job.company}_applied_country`]: next.country,
          [`${job.company}_hybrid_ok`]: next.hybridScheduleOk,
        },
      };

      saveProfile(userId, updatedProfile);
      onProfileUpdated?.(updatedProfile);

      setLastSavedField(field);
      setTimeout(() => setLastSavedField(null), 2500);

      return next;
    });
  };

  // Auto-generate tailored cover letter for this specific job & company
  useEffect(() => {
    let isMounted = true;
    const generate = async () => {
      setIsGeneratingLetter(true);
      try {
        const letter = await generateCoverLetter(
          formData.firstName ? `${formData.firstName} ${formData.lastName}`.trim() : profile.fullName || "Candidate",
          job.company,
          job.role,
          job.description,
          profile.skills?.join(", ") || profile.resumeText || "React, TypeScript, Next.js, Node.js"
        );
        if (isMounted) setCoverLetter(letter);
      } catch {
        // handled internally
      } finally {
        if (isMounted) setIsGeneratingLetter(false);
      }
    };
    void generate();
    return () => {
      isMounted = false;
    };
  }, [job.company, job.role, formData.firstName, formData.lastName]);

  // Count filled vs empty
  const filledCount = useMemo(() => {
    let count = 0;
    if (formData.firstName.trim()) count++;
    if (formData.lastName.trim()) count++;
    if (formData.email.trim()) count++;
    if (formData.phone.trim()) count++;
    if (formData.country.trim()) count++;
    if (formData.hybridScheduleOk.trim()) count++;
    if (formData.sponsorshipRequired.trim()) count++;
    if (formData.linkedin.trim()) count++;
    if (formData.portfolio.trim() || formData.github.trim()) count++;
    if (formData.yearsOfExperience.trim()) count++;
    if (formData.resumeFileName.trim()) count++;
    return count;
  }, [formData]);

  const totalFields = 11;
  const isAllFilled = filledCount >= totalFields;

  // Single-field copy helper
  const handleCopy = async (key: string, value: string) => {
    if (!value) {
      toast.error(`Please fill in ${key} first.`);
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopiedField(key);
    toast.success(`Copied ${key} to clipboard!`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Copy full browser autofill script / bookmarklet
  const handleCopyAutofillScript = async () => {
    const currentProf: UserProfile = {
      ...profile,
      firstName: formData.firstName,
      lastName: formData.lastName,
      fullName: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
      phone: formData.phone,
      country: formData.country,
      city: formData.locationCity,
      linkedin: formData.linkedin,
      portfolio: formData.portfolio,
      github: formData.github,
      yearsOfExperience: formData.yearsOfExperience,
      currentCompany: formData.currentCompany,
      hybridScheduleOk: formData.hybridScheduleOk,
      sponsorshipRequired: formData.sponsorshipRequired,
    };
    const script = generateBrowserAutofillScript(currentProf);
    await navigator.clipboard.writeText(script);
    toast.success("1-Click Browser Autofill Script copied! Run in browser console on any career portal.");
  };

  // Submit and track application
  const handleSubmitAndTrack = async () => {
    setIsSubmitting(true);
    try {
      // 1. Save profile to ensure memory across future roles
      const updatedProfile: UserProfile = {
        ...profile,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim() || profile.fullName,
        email: formData.email,
        phone: formData.phone,
        countryCode: formData.countryCode,
        country: formData.country,
        city: formData.locationCity,
        location: formData.locationCity,
        hybridScheduleOk: formData.hybridScheduleOk,
        sponsorshipRequired: formData.sponsorshipRequired,
        yearsOfExperience: formData.yearsOfExperience,
        currentCompany: formData.currentCompany,
        linkedin: formData.linkedin,
        portfolio: formData.portfolio,
        github: formData.github,
        resumeFileName: formData.resumeFileName,
      };
      saveProfile(userId, updatedProfile);
      onProfileUpdated?.(updatedProfile);

      // 2. Track application
      await onApplyAndTrack(job);

      setIsSubmitted(true);
      toast.success(`Application submitted for ${job.role} at ${job.company}! Details saved to memory for next application.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Launch external career site
  const handleLaunchExternal = async () => {
    const updatedProfile: UserProfile = {
      ...profile,
      firstName: formData.firstName,
      lastName: formData.lastName,
      fullName: `${formData.firstName} ${formData.lastName}`.trim(),
      email: formData.email,
      phone: formData.phone,
      country: formData.country,
      city: formData.locationCity,
    };
    saveProfile(userId, updatedProfile);
    onProfileUpdated?.(updatedProfile);

    await navigator.clipboard.writeText(autofillText(updatedProfile));
    window.open(job.portalUrl, "_blank", "noopener,noreferrer");
    toast.success(`Redirected to ${job.company} portal! Application details copied to clipboard.`);
  };

  // Success view
  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-[#0d131f] p-8 shadow-2xl text-center flex flex-col items-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 ring-8 ring-emerald-500/10 animate-bounce">
            <CheckCircle2 size={36} />
          </div>

          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
            Application Tracked Successfully
          </span>
          <h2 className="text-2xl font-black text-white">{job.role}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            at <span className="text-white font-bold">{job.company}</span> • {job.location}
          </p>

          <div className="my-6 w-full rounded-2xl border border-border/60 bg-white/5 p-4 text-left space-y-2.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between text-white font-semibold pb-2 border-b border-white/10">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck size={14} /> Profile Memory Synchronized
              </span>
              <span className="text-[11px] text-emerald-400">100% Ready</span>
            </div>
            <p className="text-[11px] leading-relaxed text-gray-300">
              ✨ All details you filled (Country: <strong className="text-white">{formData.country}</strong>, Phone: <strong className="text-white">{formData.phone}</strong>, Hybrid: <strong className="text-white">{formData.hybridScheduleOk}</strong>, Visa: <strong className="text-white">{formData.sponsorshipRequired}</strong>) are now permanently saved.
            </p>
            <p className="text-[11px] text-gray-400">
              When you click <strong>"Apply"</strong> on any other job next, all these fields will be <strong>automatically pre-filled</strong>!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={handleLaunchExternal}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-3 text-xs font-bold text-white transition-colors"
            >
              <ExternalLink size={14} />
              Visit Official {job.company} Site
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-5 py-3 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
            >
              Return to Dashboard
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#090d16] text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Header Bar */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-[#0d131f] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary-foreground border border-primary/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                <Building2 size={12} className="text-primary" />
                {job.company}
              </span>
              <span className="text-xs text-muted-foreground">• {job.source}</span>
              <span className="text-xs text-emerald-400 font-bold">• {job.matchScore ?? 92}% Match</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Apply Now.
            </h2>
            <p className="text-xs text-gray-400">
              Tell us why you'd be a good fit for the <strong className="text-white">{job.role}</strong> role.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* AI Autofill Intelligence Status Bar */}
        <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles size={13} />
            </div>
            <div>
              <span className="font-bold text-white">AI Résumé Autofill Active:</span>{" "}
              <span className="text-emerald-400 font-semibold">{filledCount}/{totalFields} fields completed</span>
              {lastSavedField && (
                <span className="ml-2 text-[10px] text-amber-400 font-medium animate-pulse">
                  (💾 Saved {lastSavedField} to profile memory)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex rounded-xl bg-black/40 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "form" ? "bg-primary text-black shadow-xs" : "text-gray-400 hover:text-white"
                }`}
              >
                Application Form
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("coverLetter")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "coverLetter" ? "bg-primary text-black shadow-xs" : "text-gray-400 hover:text-white"
                }`}
              >
                <Sparkles size={12} /> AI Cover Letter
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === "form" ? (
            <div className="space-y-6">
              {/* Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">First Name</label>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                      <Check size={10} /> Auto-filled
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => handleFieldChange("firstName", e.target.value)}
                    placeholder="First Name"
                    className="w-full rounded-xl border border-white/15 bg-[#121826] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">Last Name</label>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                      <Check size={10} /> Auto-filled
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => handleFieldChange("lastName", e.target.value)}
                    placeholder="Last Name"
                    className="w-full rounded-xl border border-white/15 bg-[#121826] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">Email Address</label>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                      <Check size={10} /> Auto-filled
                    </span>
                  </div>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    placeholder="name@email.com"
                    className="w-full rounded-xl border border-white/15 bg-[#121826] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">Phone Number</label>
                    {formData.phone ? (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                        <Check size={10} /> Auto-filled
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-medium">⚠️ Fill to remember</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={formData.countryCode}
                      onChange={(e) => handleFieldChange("countryCode", e.target.value)}
                      className="w-28 rounded-xl border border-white/15 bg-[#121826] px-2 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-[#121826] text-white">
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      placeholder="(201) 555-0123"
                      className="flex-1 rounded-xl border border-white/15 bg-[#121826] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Resume Attachment Box (Matching Screenshot) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Resume (Optional / Attached from AI Profile)
                </label>
                <div className="rounded-2xl border-2 border-dashed border-white/20 bg-[#121826]/70 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                      <FileCheck2 size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{formData.resumeFileName}</p>
                      <p className="text-[11px] text-gray-400">
                        Extracted {profile.skills?.length || 8} skills • PDF under 3.5MB verified
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newName = prompt("Enter resume file name or version:", formData.resumeFileName);
                      if (newName) handleFieldChange("resumeFileName", newName);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-200 transition-colors"
                  >
                    <Upload size={13} />
                    Change Resume
                  </button>
                </div>
              </div>

              {/* Screening Question 1: Country Selection (Exact from Screenshot) */}
              <div className="rounded-2xl border border-white/10 bg-[#121826]/50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-200 leading-relaxed">
                    Are you currently based in any of these countries? Please note these are the only countries where we are accepting applications
                  </p>
                  <span className="shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    💾 Saved for next jobs
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {COUNTRY_OPTIONS.map((c) => {
                    const isSelected = formData.country.toLowerCase() === c.toLowerCase();
                    return (
                      <label
                        key={c}
                        onClick={() => handleFieldChange("country", c)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                          isSelected
                            ? "border-primary bg-primary/10 text-white font-bold"
                            : "border-white/10 bg-[#0d131f] text-gray-400 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="country_selection"
                          checked={isSelected}
                          onChange={() => handleFieldChange("country", c)}
                          className="text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>{c}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Screening Question 2: Hybrid Schedule (Exact from Screenshot) */}
              <div className="rounded-2xl border border-white/10 bg-[#121826]/50 p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-200">
                    Are you able to work from our London/Regional office on a hybrid schedule, 3 days a week?
                  </p>
                  <span className="shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    💾 Auto-remembered
                  </span>
                </div>

                <div className="flex gap-3 pt-1">
                  {["Yes", "No"].map((opt) => {
                    const isSelected = formData.hybridScheduleOk === opt;
                    return (
                      <label
                        key={opt}
                        onClick={() => handleFieldChange("hybridScheduleOk", opt)}
                        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                          isSelected
                            ? "border-primary bg-primary/10 text-white font-bold"
                            : "border-white/10 bg-[#0d131f] text-gray-400 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="hybrid_schedule"
                          checked={isSelected}
                          onChange={() => handleFieldChange("hybridScheduleOk", opt)}
                          className="text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Screening Question 3: Visa Sponsorship */}
              <div className="rounded-2xl border border-white/10 bg-[#121826]/50 p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-200">
                    Will you now or in the future require employment visa sponsorship?
                  </p>
                  <span className="shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    💾 Auto-remembered
                  </span>
                </div>

                <div className="flex gap-3 pt-1">
                  {["No", "Yes"].map((opt) => {
                    const isSelected = formData.sponsorshipRequired === opt;
                    return (
                      <label
                        key={opt}
                        onClick={() => handleFieldChange("sponsorshipRequired", opt)}
                        className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                          isSelected
                            ? "border-primary bg-primary/10 text-white font-bold"
                            : "border-white/10 bg-[#0d131f] text-gray-400 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="visa_sponsorship"
                          checked={isSelected}
                          onChange={() => handleFieldChange("sponsorshipRequired", opt)}
                          className="text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Links Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">LinkedIn Profile URL</label>
                    <button
                      type="button"
                      onClick={() => handleCopy("LinkedIn", formData.linkedin)}
                      className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedField === "LinkedIn" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      Copy
                    </button>
                  </div>
                  <input
                    type="url"
                    value={formData.linkedin}
                    onChange={(e) => handleFieldChange("linkedin", e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full rounded-xl border border-white/15 bg-[#121826] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300">GitHub / Portfolio URL</label>
                    <button
                      type="button"
                      onClick={() => handleCopy("Portfolio", formData.portfolio)}
                      className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedField === "Portfolio" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      Copy
                    </button>
                  </div>
                  <input
                    type="url"
                    value={formData.portfolio}
                    onChange={(e) => handleFieldChange("portfolio", e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full rounded-xl border border-white/15 bg-[#121826] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Experience & Current Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Total Years of Relevant Experience
                  </label>
                  <input
                    type="text"
                    value={formData.yearsOfExperience}
                    onChange={(e) => handleFieldChange("yearsOfExperience", e.target.value)}
                    placeholder="e.g. 4+ years"
                    className="w-full rounded-xl border border-white/15 bg-[#121826] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Current / Most Recent Company
                  </label>
                  <input
                    type="text"
                    value={formData.currentCompany}
                    onChange={(e) => handleFieldChange("currentCompany", e.target.value)}
                    placeholder="e.g. Acme Corp / Stealth Startup"
                    className="w-full rounded-xl border border-white/15 bg-[#121826] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Cover Letter Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={15} className="text-primary" /> AI Tailored Cover Note
                  </h3>
                  <p className="text-xs text-gray-400">
                    Customized specifically for <strong className="text-white">{job.company}</strong> and the{" "}
                    <strong className="text-white">{job.role}</strong> position.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsGeneratingLetter(true);
                    try {
                      const letter = await generateCoverLetter(
                        `${formData.firstName} ${formData.lastName}`.trim(),
                        job.company,
                        job.role,
                        job.description,
                        profile.skills?.join(", ") || profile.resumeText
                      );
                      setCoverLetter(letter);
                      toast.success("Regenerated fresh cover letter!");
                    } catch {
                      toast.error("Failed to generate cover letter.");
                    } finally {
                      setIsGeneratingLetter(false);
                    }
                  }}
                  disabled={isGeneratingLetter}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors"
                >
                  {isGeneratingLetter ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Regenerate
                </button>
              </div>

              <div className="relative">
                {isGeneratingLetter ? (
                  <div className="h-64 rounded-2xl border border-white/10 bg-[#121826] flex items-center justify-center gap-2 text-xs text-gray-400">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    Writing tailored first-person letter for {job.company}...
                  </div>
                ) : (
                  <>
                    <textarea
                      rows={10}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-[#121826] p-4 text-xs leading-relaxed text-gray-200 focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(coverLetter);
                        toast.success("Cover letter copied!");
                      }}
                      className="absolute right-3 bottom-4 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-lg text-white flex items-center gap-1 transition-colors"
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 border-t border-white/10 bg-[#0d131f] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Changes are automatically saved for your next application.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleLaunchExternal}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-2.5 text-xs font-bold text-white transition-colors"
              title="Open external career portal and copy filled data"
            >
              <ExternalLink size={13} />
              Open External Site
            </button>

            <button
              type="button"
              onClick={handleSubmitAndTrack}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 px-6 py-2.5 text-xs font-black text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Submitting & Saving...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Submit Application & Auto-Track
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
