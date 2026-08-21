import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/landing/Logo";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { ApplicationDocument, ApplicationSource, ApplicationStatus, DashboardStats } from "@/lib/types";
import { AppError } from "@/lib/types";
import { createApplication, getApplications } from "@/lib/applications-service";
import { matchScore, isAiConfigured } from "@/lib/ai";
import { getProfile, saveProfile, type UserProfile } from "@/lib/profile";
import {
  Send,
  Calendar,
  CheckCircle,
  Search,
  Plus,
  LogOut,
  Sparkles,
  ExternalLink,
  Bot,
  TrendingUp,
  Loader2,
  FileText,
  Zap,
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

// JobApplication interface and INITIAL_APPLICATIONS removed.
// Using ApplicationDocument from @/lib/types — backed by Firestore.

function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  // Real data from Firestore
  const [applications, setApplications] = useState<ApplicationDocument[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState(true);

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "All">("All");
  const [isBotRunning, setIsBotRunning] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // AI résumé matching
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resumeDraft, setResumeDraft] = useState("");
  const [isScoring, setIsScoring] = useState(false);

  // Load the saved résumé/profile once the user is known (localStorage).
  // Prefill name/email from the signed-in account if not set yet.
  useEffect(() => {
    if (!user) return;
    const p = getProfile(user.id);
    setProfile({
      ...p,
      fullName: p.fullName || user.name || "",
      email: p.email || user.email || "",
    });
    setResumeDraft(p.resumeText);
  }, [user?.id]);

  const setField = (field: keyof UserProfile, value: string) =>
    setProfile((p) => (p ? { ...p, [field]: value } : p));

  const handleSaveResume = () => {
    if (!user || !profile) return;
    const updated = { ...profile, resumeText: resumeDraft.trim() };
    saveProfile(user.id, updated);
    setProfile(updated);
    toast.success("Profile saved. Contact details will autofill applications; click \"Score matches\" to rank jobs.");
  };

  // Embeds the résumé against each application's job text and fills matchScore.
  // Scores are held in local state only (no Firestore write) — recompute anytime.
  const handleScoreMatches = async () => {
    if (!user || !profile?.resumeText.trim()) {
      toast.error("Add your résumé first, then score matches.");
      return;
    }
    if (applications.length === 0) {
      toast.error("Track an application first.");
      return;
    }
    setIsScoring(true);
    try {
      const scored = await Promise.all(
        applications.map(async (app) => {
          const jobText = app.jobDescription?.trim() || `${app.jobTitle} at ${app.company}`;
          try {
            const score = await matchScore(profile.resumeText, jobText);
            return { ...app, matchScore: score };
          } catch {
            return app; // leave unscored on a per-row failure
          }
        })
      );
      setApplications(scored);
      const best = [...scored].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))[0];
      if (best?.matchScore !== undefined) {
        toast.success(`Top match: ${best.company} — ${best.matchScore}%. Apply there first!`);
      }
    } catch (error) {
      console.error("Match scoring failed:", error);
      toast.error("AI match scoring failed. Please try again.");
    } finally {
      setIsScoring(false);
    }
  };

  // New application form state has been moved to the AddApplicationModal component.

  // Load real applications from Firestore when the authenticated user is available
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setIsLoadingApps(true);
      try {
        const apps = await getApplications(user.id);
        setApplications(apps);

        // Compute dashboard stats from the loaded applications (single Firestore read)
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
        toast.error("Failed to load your applications. Please refresh the page.");
      } finally {
        setIsLoadingApps(false);
      }
    };

    void loadData();
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    toast.success("Successfully logged out.");
    navigate({ to: "/" });
  };

  const handleAddApplication = async (newCompany: string, newRole: string, newPlatform: ApplicationSource) => {
    if (!user) return;

    if (!newCompany.trim() || !newRole.trim()) {
      toast.error("Please fill in both company and role.");
      return;
    }

    try {
      const newApp = await Promise.race([
        createApplication(user.id, {
          company: newCompany.trim(),
          jobTitle: newRole.trim(),
          applicationSource: newPlatform,
          status: "Applied",
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Database connection timed out. Please ensure you have created a Firestore Database in your Firebase Console.")), 8000)
        )
      ]);

      // Optimistic update — add to local state without re-fetching Firestore
      setApplications((prev) => [newApp, ...prev]);
      setDashboardStats((prev) => {
        if (!prev) {
          return {
            totalApplications: 1,
            byStatus: { saved: 0, applied: 1, underReview: 0, interview: 0, offer: 0, rejected: 0 },
            recentApplications: [newApp],
            upcomingFollowUps: [],
          };
        }
        return {
          ...prev,
          totalApplications: prev.totalApplications + 1,
          byStatus: { ...prev.byStatus, applied: prev.byStatus.applied + 1 },
          recentApplications: [newApp, ...prev.recentApplications].slice(0, 5),
        };
      });

      setShowAddModal(false);
      toast.success(`Application for ${newApp.company} saved!`);
    } catch (error: any) {
      console.error("Save application error:", error);
      if (error instanceof AppError) {
        toast.error(error.message);
      } else if (error?.message) {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.error("Failed to save application. Please try again.");
      }
    }
  };

  const toggleBot = () => {
    setIsBotRunning((prev) => !prev);
    if (!isBotRunning) {
      toast.success("AI Crawler activated! Watching 50,000+ career boards.");
    } else {
      toast.info("AI Crawler paused.");
    }
  };

  // Client-side filter on loaded Firestore data (fast on small datasets)
  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      (app.company || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.jobTitle || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ApplicationStatus): string => {
    switch (status) {
      case "Saved":
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
      case "Applied":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "Under Review":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "Interview":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "Offer":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "Rejected":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
  };

  if (!isAuthenticated && !user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <Logo className="h-10 w-10 mx-auto mb-4 text-foreground" />
          <h2 className="text-2xl font-bold">Authentication Required</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Please log in or create an account to view your application dashboard.
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <Logo className="h-6 w-6 text-foreground" />
              <span className="text-lg font-bold tracking-tight text-foreground">JobPilot</span>
            </Link>
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Bot size={13} />
              AI Agent Connected
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-xs text-muted-foreground hover:text-foreground hidden sm:inline-block mr-2 transition-colors"
            >
              Landing Page
            </Link>
            <div className="flex items-center gap-2 border-l border-border pl-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-xs font-semibold leading-tight text-foreground">{user?.name || "User"}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Log out"
                className="ml-2 p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-5 py-8">
        {/* Welcome Banner */}
        <div className="mb-8 rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-card to-card p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              <Sparkles size={14} />
              Live AI Pipeline Active
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Welcome, {user?.name || "Candidate"}!
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Target role: <span className="font-medium text-foreground">{user?.targetRole || "Software Engineer"}</span> • Automated matching is currently running.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleBot}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all shadow-sm ${
                isBotRunning
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-secondary text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isBotRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
              {isBotRunning ? "AI Crawler: Active" : "AI Crawler: Paused"}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow hover:opacity-95 transition-opacity"
            >
              <Plus size={15} />
              Track New Application
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Total Applications</span>
              <Send size={16} className="text-primary" />
            </div>
            <div className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {isLoadingApps ? <Loader2 size={20} className="animate-spin text-muted-foreground" /> : (dashboardStats?.totalApplications ?? 0)}
            </div>
            <div className="mt-1 text-[11px] text-emerald-500 font-medium flex items-center gap-1">
              <TrendingUp size={12} /> Real-time from Firestore
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Interviews</span>
              <Calendar size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {isLoadingApps ? <Loader2 size={20} className="animate-spin text-muted-foreground" /> : (dashboardStats?.byStatus.interview ?? 0)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {dashboardStats && dashboardStats.upcomingFollowUps.length > 0
                ? `Next: ${dashboardStats.upcomingFollowUps[0]?.company ?? ""}`
                : "No upcoming follow-ups"}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">ATS Match Rate</span>
              <CheckCircle size={16} className="text-purple-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight">94.2%</div>
            <div className="mt-1 text-[11px] text-emerald-500 font-medium">Top 5% candidate match</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Crawled ATS Boards</span>
              <Bot size={16} className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight">54,120</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Workday, Ashby, Lever, GH</div>
          </div>
        </div>

        {/* AI Résumé Match Panel */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={16} className="text-primary" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">Résumé & Profile</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Save your résumé and contact details once. AI ranks where you're a strong match, and your details autofill each application (Copy on the detail page).
          </p>

          {/* Contact details — used for one-click autofill on career portals */}
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ["fullName", "Full name", "e.g. Priya Sharma"],
              ["email", "Email", "you@example.com"],
              ["phone", "Phone", "+91 98765 43210"],
              ["location", "Location", "Bengaluru, India"],
              ["linkedin", "LinkedIn URL", "linkedin.com/in/…"],
              ["portfolio", "Portfolio / GitHub", "github.com/…"],
            ] as [keyof UserProfile, string, string][]).map(([field, label, placeholder]) => (
              <div key={field}>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{label}</label>
                <input
                  type="text"
                  value={profile?.[field] ?? ""}
                  onChange={(e) => setField(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            ))}
          </div>

          <textarea
            value={resumeDraft}
            onChange={(e) => setResumeDraft(e.target.value)}
            rows={6}
            placeholder="Paste your résumé text here (skills, experience, education)…"
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveResume}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary transition-colors"
            >
              <FileText size={14} />
              Save Profile
            </button>
            <button
              onClick={handleScoreMatches}
              disabled={isScoring || !profile?.resumeText.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:opacity-95 transition-opacity disabled:opacity-60"
            >
              {isScoring ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {isScoring ? "Scoring…" : "Score matches with AI"}
            </button>
            {!isAiConfigured() && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                Set VITE_OPENROUTER_API_KEY in .env to enable AI.
              </span>
            )}
          </div>
        </div>

        {/* Applications Section */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">Tracked Applications</h2>
              <p className="text-xs text-muted-foreground">Real-time status updates from company ATS portals</p>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search company or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-lg border border-input bg-background/50 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-56"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "All")}
                className="rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Saved">Saved</option>
                <option value="Applied">Applied</option>
                <option value="Under Review">Under Review</option>
                <option value="Interview">Interview</option>
                <option value="Offer">Offer</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Company & Role</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Match Score</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadingApps ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                        <Loader2 size={16} className="animate-spin" />
                        Loading your applications...
                      </div>
                    </td>
                  </tr>
                ) : filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground text-xs">
                      {applications.length === 0
                        ? "No applications tracked yet. Add your first application above!"
                        : "No applications found matching your search."}
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-semibold text-foreground text-sm">{app.company}</div>
                        <div className="text-muted-foreground text-xs mt-0.5">{app.jobTitle}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium bg-background text-foreground/80">
                          {app.applicationSource}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {app.matchScore !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {app.matchScore}%
                            </span>
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${app.matchScore}%` }}
                              />
                            </div>
                            {app.matchScore >= 75 && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Zap size={10} /> Strong
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">— (score with AI)</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">
                        {app.createdAt ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true }) : "Unknown date"}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getStatusBadge(
                            app.status
                          )}`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <Link
                          to="/applications/$applicationId"
                          params={{ applicationId: app.id }}
                          className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
                        >
                          View Details
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Application Modal */}
      {showAddModal && (
        <AddApplicationModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddApplication}
        />
      )}
    </div>
  );
}

// Extracted Modal Component to prevent DashboardPage from re-rendering on every keystroke
function AddApplicationModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (company: string, role: string, source: ApplicationSource) => void;
}) {
  const companyRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const platformRef = useRef<HTMLSelectElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (companyRef.current && roleRef.current && platformRef.current) {
      setIsSubmitting(true);
      try {
        await onSubmit(
          companyRef.current.value,
          roleRef.current.value,
          platformRef.current.value as ApplicationSource
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-foreground mb-1">Track New Job Application</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Add an application manually or let AI track its status updates.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Company Name</label>
            <input
              type="text"
              required
              ref={companyRef}
              defaultValue=""
              placeholder="e.g. Airbnb"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Role Title</label>
            <input
              type="text"
              required
              ref={roleRef}
              defaultValue=""
              placeholder="e.g. Lead Frontend Engineer"
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
