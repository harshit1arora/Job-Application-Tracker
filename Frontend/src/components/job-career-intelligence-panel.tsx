import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import type { UnifiedCareerIntelligence, NextBestAction } from "@/lib/career-intelligence";
import { executeActionCompletion } from "@/lib/career-intelligence";
import { type UserProfile, type CandidateProject, saveProfile } from "@/lib/profile";
import { SkillProofSection } from "./skill-proof-section";
import { CareerTwinLiteSection } from "./career-twin-section";
import { NextBestActionCard } from "./next-best-action-card";
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Bot,
  Target,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Plus,
  X,
  Code2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface JobCareerIntelligencePanelProps {
  intelligence: UnifiedCareerIntelligence;
  profile: UserProfile;
  job: {
    id: string;
    role: string;
    company: string;
    description?: string | undefined;
    requiredSkills: string[];
    experienceLevel?: string | undefined;
  };
  userId?: string | undefined;
  onRefreshIntelligence?: (() => void) | undefined;
  onStartTask?: ((action: NextBestAction) => void) | undefined;
}

export function JobCareerIntelligencePanel({
  intelligence,
  profile,
  job,
  userId,
  onRefreshIntelligence,
  onStartTask,
}: JobCareerIntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "proof" | "twin">("overview");
  const [showFactorBreakdown, setShowFactorBreakdown] = useState(false);
  const [showQuickAddProject, setShowQuickAddProject] = useState(false);

  // Quick project addition form state
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projTech, setProjTech] = useState("");
  const [projLink, setProjLink] = useState("");
  const [isSavingProj, setIsSavingProj] = useState(false);

  const { applicationSuccess, resumeMatch, skillProofs, careerTwin, nextBestAction } = intelligence;

  // Handle ESC key for quick project modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showQuickAddProject) {
        setShowQuickAddProject(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showQuickAddProject]);

  const handleStartTaskAction = (action: NextBestAction) => {
    if (action.actionType === "PREPARE_INTERVIEW") {
      setActiveTab("twin");
    } else if (action.actionType === "VERIFY_SKILL") {
      setActiveTab("proof");
    } else if (action.actionType === "ADD_PROJECT") {
      setShowQuickAddProject(true);
    } else if (onStartTask) {
      onStartTask(action);
    }
  };

  const handleSaveQuickProject = () => {
    if (!projName.trim() || !userId) {
      toast.error("Please provide at least a project name.");
      return;
    }
    setIsSavingProj(true);

    try {
      const newProj: CandidateProject = {
        name: projName.trim(),
        description: projDesc.trim() || "Applied software project",
        technologies: projTech
          ? projTech.split(",").map((s) => s.trim()).filter(Boolean)
          : job.requiredSkills.slice(0, 3),
        link: projLink.trim() || undefined,
      };

      const res = executeActionCompletion(userId, nextBestAction, profile, {
        project: newProj,
      });

      if (res.success) {
        setShowQuickAddProject(false);
        setProjName("");
        setProjDesc("");
        setProjTech("");
        setProjLink("");
        toast.success(res.message);
        onRefreshIntelligence?.();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsSavingProj(false);
    }
  };

  // If candidate lacks sufficient data, show helpful action prompt
  if (!applicationSuccess.hasSufficientData) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-3">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
          <AlertTriangle size={18} /> Application Intelligence — More Information Needed
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {applicationSuccess.areasReducingReadiness[0] ||
            "Add your résumé text or key skills to calculate application readiness, evidence proof, and Next Best Actions."}
        </p>
        <div className="pt-2">
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
          >
            Add Your Résumé to Profile <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  let readinessBadge = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  if (applicationSuccess.score < 40) {
    readinessBadge = "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
  } else if (applicationSuccess.score < 60) {
    readinessBadge = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  } else if (applicationSuccess.score < 80) {
    readinessBadge = "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs space-y-6 p-5 sm:p-7">
      {/* Top 3 Distinct Metrics Banner: Match vs Readiness vs Career Twin Fit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-border">
        {/* Metric 1: Resume Match */}
        <div className="p-4 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              1. Resume Match
            </span>
            <span className="text-[10px] text-muted-foreground font-semibold">Semantic Match</span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-foreground">{resumeMatch}%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              How closely your résumé text aligns with this job description.
            </p>
          </div>
        </div>

        {/* Metric 2: Application Success Score (Readiness) */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              2. Application Readiness
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${readinessBadge}`}>
              {applicationSuccess.category}
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-primary">
              {applicationSuccess.score} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Deterministic estimation of current application shortlisting readiness.
            </p>
          </div>
        </div>

        {/* Metric 3: Career Twin Role Fit */}
        <div className="p-4 rounded-xl bg-violet-500/5 dark:bg-violet-950/20 border border-violet-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              3. Career Twin Fit
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">Living State</span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-black text-violet-600 dark:text-violet-400">
              {careerTwin.roleFitScore} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Structured fit across verified skills, projects, and {careerTwin.experienceYears}+ YOE.
            </p>
          </div>
        </div>
      </div>

      {/* Primary Next-Best-Action Coach Banner (Always visible high-priority action) */}
      <NextBestActionCard
        action={nextBestAction}
        profile={profile}
        userId={userId}
        onActionCompleted={onRefreshIntelligence}
        onStartTask={handleStartTaskAction}
      />

      {/* Tab Navigation for Career Intelligence Pillars */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "overview"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          <TrendingUp size={13} />
          Readiness & Signals
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("proof")}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "proof"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          <ShieldCheck size={13} />
          Skill Evidence & Proof ({skillProofs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("twin")}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "twin"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          <Bot size={13} />
          Career Twin & Mock Interview
        </button>
      </div>

      {/* Tab 1: Overview & Signals */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Positive Signals & Readiness Reducers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 space-y-2">
              <h4 className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={14} /> Positive Readiness Signals
              </h4>
              <ul className="space-y-1.5">
                {applicationSuccess.positiveSignals.map((sig, i) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                    <span className="text-emerald-500 font-bold">✓</span> {sig}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-2">
              <h4 className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs">
                <AlertTriangle size={14} /> Areas Reducing Readiness
              </h4>
              <ul className="space-y-1.5">
                {applicationSuccess.areasReducingReadiness.map((red, i) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                    <span className="text-amber-500 font-bold">⚠</span> {red}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Historical context note */}
          {applicationSuccess.historicalContext && (
            <div className="p-3 rounded-xl bg-secondary/50 border border-border text-xs text-muted-foreground flex items-center gap-2">
              <Info size={14} className="text-primary shrink-0" />
              <span>{applicationSuccess.historicalContext}</span>
            </div>
          )}

          {/* Transparent Deterministic Factor Breakdown */}
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <button
              type="button"
              onClick={() => setShowFactorBreakdown(!showFactorBreakdown)}
              className="w-full flex items-center justify-between text-xs font-bold text-foreground cursor-pointer"
            >
              <span>Explainable Factor Breakdown (Deterministic Scoring Formula)</span>
              {showFactorBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showFactorBreakdown && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border text-xs">
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Resume Match (35%)</span>
                  <span className="font-bold text-foreground text-sm">
                    {applicationSuccess.breakdown.resumeMatch}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Required Skills (20%)</span>
                  <span className="font-bold text-foreground text-sm">
                    {applicationSuccess.breakdown.requiredSkills}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Project Relevance (15%)</span>
                  <span className="font-bold text-foreground text-sm">
                    {applicationSuccess.breakdown.projectRelevance}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Experience Relevance (10%)</span>
                  <span className="font-bold text-foreground text-sm">
                    {applicationSuccess.breakdown.experienceRelevance}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Seniority Fit (10%)</span>
                  <span className="font-bold text-foreground text-sm">
                    {applicationSuccess.breakdown.seniorityFit}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border">
                  <span className="text-muted-foreground block text-[10px]">Profile Completeness (10%)</span>
                  <span className="font-bold text-foreground text-sm">
                    {applicationSuccess.breakdown.profileCompleteness}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Skill Proof Score */}
      {activeTab === "proof" && (
        <SkillProofSection
          skillProofs={skillProofs}
          userId={userId}
          onVerificationCompleted={onRefreshIntelligence}
        />
      )}

      {/* Tab 3: Career Twin Lite */}
      {activeTab === "twin" && (
        <CareerTwinLiteSection
          careerTwin={careerTwin}
          profile={profile}
          job={job}
          userId={userId}
          onInterviewCompleted={onRefreshIntelligence}
        />
      )}

      {/* Quick Add Project Modal (for ADD_PROJECT action) */}
      {showQuickAddProject && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-project-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQuickAddProject(false);
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Code2 size={18} />
                </span>
                <div>
                  <h3 id="quick-project-modal-title" className="text-base font-bold text-foreground">
                    Add Candidate Project Proof
                  </h3>
                  <p className="text-xs text-muted-foreground">Strengthens practical evidence across your jobs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddProject(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
                aria-label="Close project modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="quick-proj-name" className="block font-semibold text-foreground mb-1">
                  Project Name *
                </label>
                <input
                  id="quick-proj-name"
                  type="text"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Distributed Payments Microservice"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label htmlFor="quick-proj-desc" className="block font-semibold text-foreground mb-1">
                  Description & Architecture
                </label>
                <textarea
                  id="quick-proj-desc"
                  rows={2}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="e.g. Designed containerized REST APIs handling Stripe webhooks with Redis caching"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div>
                <label htmlFor="quick-proj-tech" className="block font-semibold text-foreground mb-1">
                  Technologies (comma separated)
                </label>
                <input
                  id="quick-proj-tech"
                  type="text"
                  value={projTech}
                  onChange={(e) => setProjTech(e.target.value)}
                  placeholder={job.requiredSkills.slice(0, 3).join(", ") || "React, TypeScript, Docker"}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label htmlFor="quick-proj-link" className="block font-semibold text-foreground mb-1">
                  Repository or Live URL (Optional)
                </label>
                <input
                  id="quick-proj-link"
                  type="url"
                  value={projLink}
                  onChange={(e) => setProjLink(e.target.value)}
                  placeholder="https://github.com/your-username/project"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowQuickAddProject(false)}
                className="px-4 py-2 rounded-xl border border-border bg-secondary text-xs font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickProject}
                disabled={isSavingProj || !projName.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSavingProj ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Plus size={13} /> Save Project & Recalculate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
