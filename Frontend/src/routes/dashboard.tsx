import { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/landing/Logo";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { ApplicationDocument, ApplicationSource, ApplicationStatus, DashboardStats, SuggestedJob, ReminderDocument } from "@/lib/types";
import { AppError } from "@/lib/types";
import { createApplication, getApplications } from "@/lib/applications-service";
import { getReminders } from "@/lib/reminders-service";
import { matchScore, parseResumeWithAi, suggestJobsForResume } from "@/lib/ai";
import { getProfile, saveProfile, mergeParsedResumeIntoProfile, getMissingProfileFields, type UserProfile } from "@/lib/profile";
import { extractTextFromFile, SAMPLE_RESUME_PRESET } from "@/lib/resume-parser";
import { CURATED_JOBS_CATALOG } from "@/lib/jobs-catalog";
import { SuggestedJobsSection } from "@/components/suggested-jobs-section";
import { MissingFieldsModal } from "@/components/missing-fields-modal";
import { ApplyPortalModal } from "@/components/apply-portal-modal";
import { QuickFillWidget } from "@/components/quick-fill-widget";
import { InterviewCalendarModal } from "@/components/interview-calendar-modal";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import {
  LayoutDashboard,
  Search,
  FileText,
  Inbox,
  Calendar,
  User,
  Settings,
  Plus,
  LogOut,
  Sparkles,
  ExternalLink,
  Bot,
  TrendingUp,
  Loader2,
  Zap,
  Upload,
  Phone,
  MapPin,
  Briefcase,
  AlertTriangle,
  FileCheck2,
  ChevronRight,
  ArrowUpRight,
  Layers,
  Send,
  MoreVertical,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobPilot Application Tracker" },
      { name: "description", content: "Track your automated job applications, AI crawler progress, and interview pipeline." },
    ],
  }),
  component: DashboardPage,
});

type NavTab = "dashboard" | "browse" | "applications" | "inbox" | "tracker" | "profile" | "settings";

// Color presets for top match cards matching reference image
const MATCH_CARD_THEMES = [
  {
    bg: "bg-[#fef8ed] dark:bg-amber-950/25 border-[#fdecd0] dark:border-amber-900/40",
    hover: "hover:border-amber-300 dark:hover:border-amber-700",
  },
  {
    bg: "bg-[#f1faf3] dark:bg-emerald-950/25 border-[#d7f1df] dark:border-emerald-900/40",
    hover: "hover:border-emerald-300 dark:hover:border-emerald-700",
  },
  {
    bg: "bg-[#f6f5ff] dark:bg-violet-950/25 border-[#e5e1fc] dark:border-violet-900/40",
    hover: "hover:border-violet-300 dark:hover:border-violet-700",
  },
  {
    bg: "bg-[#fff2f2] dark:bg-rose-950/25 border-[#fddede] dark:border-rose-900/40",
    hover: "hover:border-rose-300 dark:hover:border-rose-700",
  },
];

// Circular progress ring matching exact screenshot
function MatchScoreRing({ score }: { score: number }) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let strokeColor = "stroke-emerald-500";
  if (score < 60) strokeColor = "stroke-indigo-500";
  else if (score < 70) strokeColor = "stroke-amber-500";

  return (
    <div className="relative flex items-center justify-center h-12 w-12 shrink-0">
      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="currentColor"
          strokeWidth="3.5"
          fill="transparent"
          className="text-black/10 dark:text-white/10"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="currentColor"
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className={`${strokeColor} transition-all duration-700 ease-out`}
        />
      </svg>
      <span className="absolute text-[11px] font-black text-foreground">
        {score}%
      </span>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");

  // Applications & Reminders Data
  const [applications, setApplications] = useState<ApplicationDocument[]>([]);
  const [reminders, setReminders] = useState<ReminderDocument[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState(true);

  // Modals & UI Controls
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "All">("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedApplyJob, setSelectedApplyJob] = useState<SuggestedJob | null>(null);

  // Profile & AI Parsing
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resumeDraft, setResumeDraft] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isScoring, setIsScoring] = useState(false);

  // Suggested Jobs
  const [suggestedJobs, setSuggestedJobs] = useState<SuggestedJob[]>(CURATED_JOBS_CATALOG);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved profile on mount
  useEffect(() => {
    if (!user) return;
    const p = getProfile(user.id);
    const initialProfile: UserProfile = {
      ...p,
      fullName: p.fullName || user.name || "Alex Morgan",
      email: p.email || user.email || "alex.morgan@example.com",
      targetRole: p.targetRole || user.targetRole || "Software Developer II",
    };
    setProfile(initialProfile);
    setResumeDraft(initialProfile.resumeText || "");

    if (initialProfile.resumeText || initialProfile.targetRole) {
      void rankJobsForProfile(initialProfile);
    }
  }, [user?.id]);

  const rankJobsForProfile = async (p: UserProfile) => {
    try {
      const ranked = await suggestJobsForResume(
        {
          fullName: p.fullName,
          email: p.email,
          phone: p.phone,
          city: p.city || p.location,
          ageOrExperience: p.ageOrExperience || "4+ YOE",
          targetRole: p.targetRole || "Software Developer II",
          skills: p.skills && p.skills.length > 0 ? p.skills : ["React", "TypeScript", "Node.js", "C#"],
          education: p.education || "Computer Science",
          summary: p.summary || p.resumeText.slice(0, 180),
        },
        CURATED_JOBS_CATALOG
      );
      setSuggestedJobs(ranked);
    } catch {
      // fallback
    }
  };

  // Load applications & reminders
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setIsLoadingApps(true);
      try {
        const [apps, rems] = await Promise.all([
          getApplications(user.id),
          getReminders(user.id),
        ]);
        setApplications(apps);
        setReminders(rems);

        const today = new Date().toISOString().slice(0, 10);
        const byStatus = {
          saved: apps.filter((a) => a.status === "Saved").length,
          applied: apps.filter((a) => a.status === "Applied").length,
          underReview: apps.filter((a) => a.status === "Under Review").length,
          interview: apps.filter((a) => a.status === "Interview").length,
          offer: apps.filter((a) => a.status === "Offer").length,
          rejected: apps.filter((a) => a.status === "Rejected").length,
        };
        setDashboardStats({
          totalApplications: apps.length,
          byStatus,
          recentApplications: apps.slice(0, 5),
          upcomingFollowUps: apps
            .filter((a) => a.followUpDate !== undefined && a.followUpDate >= today)
            .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""))
            .slice(0, 5),
        });
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        toast.error("Failed to load your applications.");
      } finally {
        setIsLoadingApps(false);
      }
    };

    void loadData();
  }, [user?.id]);

  // Handle File Upload & Instant AI Extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsParsingResume(true);
    toast.info(`Extracting text from ${file.name}...`);

    try {
      const extractedText = await extractTextFromFile(file);
      setResumeDraft(extractedText);

      toast.info("AI is parsing candidate fields & skills...");
      const parsed = await parseResumeWithAi(extractedText);

      const currentProf = profile || getProfile(user.id);
      const merged = mergeParsedResumeIntoProfile(currentProf, parsed);

      saveProfile(user.id, merged);
      setProfile(merged);
      await rankJobsForProfile(merged);

      const missing = getMissingProfileFields(merged);
      if (missing.length > 0) {
        toast.success(`Résumé parsed! Check ${missing.length} missing fields.`);
        setShowMissingModal(true);
      } else {
        toast.success("Résumé parsed successfully!");
      }
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error("Failed to parse file.");
    } finally {
      setIsParsingResume(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Load sample demo resume
  const handleLoadSampleResume = async () => {
    if (!user) return;
    setIsParsingResume(true);
    setResumeDraft(SAMPLE_RESUME_PRESET);
    toast.info("AI parsing sample candidate résumé...");

    try {
      const parsed = await parseResumeWithAi(SAMPLE_RESUME_PRESET);
      const currentProf = profile || getProfile(user.id);
      const merged = mergeParsedResumeIntoProfile(currentProf, parsed);

      saveProfile(user.id, merged);
      setProfile(merged);
      await rankJobsForProfile(merged);

      toast.success("Sample résumé loaded & jobs ranked!");
    } catch {
      toast.error("Failed to parse sample.");
    } finally {
      setIsParsingResume(false);
    }
  };

  // 1-Click Apply and Auto-Track from Suggested Jobs
  const handleApplyAndTrackJob = async (job: SuggestedJob) => {
    if (!user) return;
    try {
      const newApp = await createApplication(user.id, {
        company: job.company,
        jobTitle: job.role,
        applicationSource: job.source,
        status: "Applied",
        applicationUrl: job.portalUrl,
        location: job.location,
        salaryRange: job.salaryRange,
        jobDescription: job.description,
        notes: `Applied via 1-Click AI Portal. Match score: ${job.matchScore ?? 92}%.`,
      });

      setApplications((prev) => [newApp, ...prev.filter((a) => a.company !== job.company || a.jobTitle !== job.role)]);
      setDashboardStats((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          totalApplications: prev.totalApplications + 1,
          byStatus: { ...prev.byStatus, applied: prev.byStatus.applied + 1 },
          recentApplications: [newApp, ...prev.recentApplications].slice(0, 5),
        };
      });
    } catch (err: any) {
      console.error("Auto-track error:", err);
      toast.error(err?.message || "Could not track application.");
    }
  };

  const handleAddApplication = async (
    newCompany: string,
    newRole: string,
    newPlatform: ApplicationSource,
    newUrl?: string
  ) => {
    if (!user) return;
    if (!newCompany.trim() || !newRole.trim()) {
      toast.error("Please fill in both company and role.");
      return;
    }

    try {
      const newApp = await createApplication(user.id, {
        company: newCompany.trim(),
        jobTitle: newRole.trim(),
        applicationSource: newPlatform,
        status: "Applied",
        ...(newUrl ? { applicationUrl: newUrl.trim() } : {}),
      });

      setApplications((prev) => [newApp, ...prev]);
      setShowAddModal(false);
      toast.success(`Application for ${newApp.company} tracked!`);
    } catch (error: any) {
      if (error instanceof AppError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to save application.");
      }
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out.");
    navigate({ to: "/" });
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      (app.company || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.jobTitle || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusRowConfig = (status: ApplicationStatus) => {
    switch (status) {
      case "Applied":
      case "Offer":
        return { dot: "bg-emerald-500", text: "Submitted" };
      case "Interview":
        return { dot: "bg-emerald-500", text: "Interview Scheduled" };
      case "Under Review":
        return { dot: "bg-blue-500", text: "Tailoring résumé" };
      case "Saved":
        return { dot: "bg-amber-500", text: "Queued" };
      case "Rejected":
        return { dot: "bg-rose-500", text: "Needs you" };
    }
  };

  const topMatches = suggestedJobs.slice(0, 4);
  const initials = profile?.fullName
    ? profile.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "AM";

  if (!isAuthenticated && !user) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] dark:bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <Logo className="h-10 w-10 mx-auto mb-4 text-foreground" />
          <h2 className="text-2xl font-bold">Authentication Required</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Please log in or create an account to view your application tracker.
          </p>
          <div className="flex gap-3">
            <Link
              to="/login"
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="flex-1 rounded-xl border border-border bg-secondary py-2.5 text-sm font-semibold hover:bg-accent transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      {/* Shared Left Sidebar */}
      <DashboardSidebar applicationsCount={applications.length} />

      {/* MAIN CONTENT AREA matching reference image layout */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto overflow-y-auto w-full space-y-9">
        {/* Top Section: "Top job matches" */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Top job matches
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab("browse")}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              Browse jobs <ChevronRight size={14} />
            </button>
          </div>

          {/* 4 Pastel Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topMatches.map((job, idx) => {
              const theme = MATCH_CARD_THEMES[idx % MATCH_CARD_THEMES.length]!;
              const matchScore = job.matchScore || (idx === 0 ? 71 : idx === 1 ? 60 : idx === 2 ? 64 : 58);

              return (
                <div
                  key={job.id}
                  className={`rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between min-h-[170px] ${theme.bg} ${theme.hover}`}
                >
                  {/* Card Header: Company, Role & Match Ring */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium truncate">
                        {job.company}
                      </p>
                      <h3 className="text-sm font-bold text-foreground tracking-tight leading-snug line-clamp-2">
                        {job.role}
                      </h3>
                    </div>
                    <MatchScoreRing score={matchScore} />
                  </div>

                  {/* Card Footer: Company Label + Black Pill Apply Button */}
                  <div className="flex items-center justify-between pt-4 mt-2">
                    <span className="text-xs text-muted-foreground font-medium truncate">
                      {job.company}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedApplyJob(job)}
                      className="inline-flex items-center justify-center rounded-full bg-[#0d131f] hover:bg-black text-white px-4 py-1.5 text-xs font-bold shadow-sm transition-transform active:scale-95"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Middle Quick Actions & Profile Status Pill Bar */}
        <section className="rounded-2xl border border-border/70 bg-white dark:bg-[#111622] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles size={16} />
            </div>
            <div className="text-xs">
              <p className="font-bold text-foreground">
                AI Target: {profile?.targetRole || "Software Developer II"}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {profile?.skills?.length || 8} skills detected from parsed résumé
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleLoadSampleResume}
              disabled={isParsingResume}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors"
            >
              Load Demo Résumé
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingResume}
              className="text-xs font-bold text-foreground bg-secondary hover:bg-secondary/80 border border-border px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
            >
              {isParsingResume ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Upload Résumé
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md,application/pdf,text/plain"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              onClick={() => setShowCalendarModal(true)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Calendar size={13} />
              Timeline Calendar
            </button>
          </div>
        </section>

        {/* Bottom Section: "All applications" matching reference image */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              All applications
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCalendarModal(true)}
                className="px-4 py-1.5 rounded-full border border-border bg-white dark:bg-secondary/40 text-xs font-semibold text-foreground hover:bg-secondary transition-colors shadow-2xs"
              >
                Open tracker
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-4 py-1.5 rounded-full bg-[#0d131f] hover:bg-black text-white text-xs font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-1"
              >
                <Plus size={13} />
                Submit all
              </button>
            </div>
          </div>

          {/* Applications Table Card */}
          <div className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8f9fb] dark:bg-[#151c2a] border-b border-border/70 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-6 font-bold">POSITION</th>
                    <th className="py-3.5 px-6 font-bold">RÉSUMÉ</th>
                    <th className="py-3.5 px-6 font-bold">COVER LETTER</th>
                    <th className="py-3.5 px-6 font-bold">STATUS</th>
                    <th className="py-3.5 px-6 text-right font-bold">APPLIED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoadingApps ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          Loading applications...
                        </div>
                      </td>
                    </tr>
                  ) : applications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-muted-foreground">
                        No applications tracked yet. Click "Apply" on any top job match!
                      </td>
                    </tr>
                  ) : (
                    applications.map((app, idx) => {
                      const rowConfig = getStatusRowConfig(app.status);
                      const isReady = idx % 2 === 0;

                      return (
                        <tr
                          key={app.id}
                          className="hover:bg-secondary/20 transition-colors group cursor-pointer"
                          onClick={() => navigate({ to: `/applications/${app.id}` })}
                        >
                          {/* Position (Company & Title) */}
                          <td className="py-4 px-6">
                            <div className="font-bold text-foreground text-sm tracking-tight group-hover:text-primary transition-colors flex items-center gap-1.5">
                              {app.company}
                              {app.applicationUrl && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(app.applicationUrl, "_blank");
                                  }}
                                  className="text-muted-foreground hover:text-primary"
                                  title="Open career portal"
                                >
                                  <ArrowUpRight size={13} />
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground text-xs font-normal mt-0.5">
                              {app.jobTitle}
                            </div>
                          </td>

                          {/* Résumé Status */}
                          <td className="py-4 px-6 text-foreground font-medium">
                            {isReady ? "Ready" : "Default"}
                          </td>

                          {/* Cover Letter Status */}
                          <td className="py-4 px-6 text-foreground font-medium">
                            {isReady ? "Ready" : "Off"}
                          </td>

                          {/* Status with Colored Dot */}
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center gap-2 font-medium text-foreground">
                              <span className={`h-2 w-2 rounded-full ${rowConfig.dot}`} />
                              <span>{rowConfig.text}</span>
                            </div>
                          </td>

                          {/* Applied Time */}
                          <td className="py-4 px-6 text-right text-muted-foreground font-medium">
                            {app.createdAt
                              ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })
                              : "2 days ago"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Tab view for full Browse Jobs when clicked */}
        {activeTab === "browse" && profile && (
          <section className="pt-4 border-t border-border">
            <SuggestedJobsSection
              jobs={suggestedJobs}
              profile={profile}
              onApplyClick={(job) => setSelectedApplyJob(job)}
            />
          </section>
        )}
      </main>

      {/* Floating Quick Fill Helper */}
      {profile && <QuickFillWidget profile={profile} />}

      {/* Missing Fields Modal */}
      {showMissingModal && profile && user && (
        <MissingFieldsModal
          userId={user.id}
          profile={profile}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            void rankJobsForProfile(updated);
          }}
          onClose={() => setShowMissingModal(false)}
        />
      )}

      {/* 1-Click Apply Portal Modal */}
      {selectedApplyJob && profile && (
        <ApplyPortalModal
          job={selectedApplyJob}
          profile={profile}
          userId={user?.id}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            void rankJobsForProfile(updated);
          }}
          onOpenMissingFields={() => {
            setSelectedApplyJob(null);
            setShowMissingModal(true);
          }}
          onApplyAndTrack={handleApplyAndTrackJob}
          onClose={() => setSelectedApplyJob(null)}
        />
      )}

      {/* Color-Coded Interview & Process Calendar Modal */}
      {showCalendarModal && user && (
        <InterviewCalendarModal
          userId={user.id}
          applications={applications}
          reminders={reminders}
          onRemindersUpdated={(updated) => setReminders(updated)}
          onClose={() => setShowCalendarModal(false)}
        />
      )}

      {/* Add Custom Application Modal */}
      {showAddModal && (
        <AddApplicationModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddApplication}
        />
      )}
    </div>
  );
}

function AddApplicationModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (company: string, role: string, source: ApplicationSource, url?: string) => void;
}) {
  const companyRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const platformRef = useRef<HTMLSelectElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (companyRef.current && roleRef.current && platformRef.current) {
      setIsSubmitting(true);
      try {
        await onSubmit(
          companyRef.current.value,
          roleRef.current.value,
          platformRef.current.value as ApplicationSource,
          urlRef.current?.value || undefined
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-foreground mb-1">Track Custom Job Application</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Add any career portal or application link to track its status.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Company Name</label>
            <input
              type="text"
              required
              ref={companyRef}
              placeholder="e.g. Stripe"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Role Title</label>
            <input
              type="text"
              required
              ref={roleRef}
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Application Source</label>
            <select
              ref={platformRef}
              defaultValue="Greenhouse"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="Greenhouse">Greenhouse</option>
              <option value="Lever">Lever</option>
              <option value="Ashby">Ashby</option>
              <option value="Workday">Workday</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Career Portal URL (Optional)</label>
            <input
              type="url"
              ref={urlRef}
              placeholder="https://boards.greenhouse.io/..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Track"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
