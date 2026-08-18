import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/landing/Logo";
import { toast } from "sonner";
import {
  Send,
  Calendar,
  CheckCircle,
  Briefcase,
  Search,
  Filter,
  Plus,
  LogOut,
  Sparkles,
  ExternalLink,
  Bot,
  RefreshCw,
  Clock,
  TrendingUp,
  Moon,
  Sun,
  User as UserIcon,
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

interface JobApplication {
  id: string;
  company: string;
  role: string;
  platform: "Workday" | "Greenhouse" | "Lever" | "Ashby" | "LinkedIn";
  date: string;
  matchScore: number;
  status: "Applied" | "Interview" | "Under Review" | "Offer" | "Rejected";
}

const INITIAL_APPLICATIONS: JobApplication[] = [
  {
    id: "app-1",
    company: "Stripe",
    role: "Senior Software Engineer, Core Payments",
    platform: "Greenhouse",
    date: "Today, 10:24 AM",
    matchScore: 97,
    status: "Applied",
  },
  {
    id: "app-2",
    company: "Linear",
    role: "Full Stack Engineer, Collaboration",
    platform: "Ashby",
    date: "Yesterday",
    matchScore: 94,
    status: "Under Review",
  },
  {
    id: "app-3",
    company: "Vercel",
    role: "Frontend Engineer, AI Platform",
    platform: "Lever",
    date: "2 days ago",
    matchScore: 92,
    status: "Interview",
  },
  {
    id: "app-4",
    company: "Figma",
    role: "Software Engineer, Canvas Infrastructure",
    platform: "Workday",
    date: "3 days ago",
    matchScore: 89,
    status: "Applied",
  },
  {
    id: "app-5",
    company: "Notion",
    role: "Systems & Backend Engineer",
    platform: "Lever",
    date: "4 days ago",
    matchScore: 96,
    status: "Interview",
  },
];

function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const [applications, setApplications] = useState<JobApplication[]>(INITIAL_APPLICATIONS);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isBotRunning, setIsBotRunning] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New application form state
  const [newCompany, setNewCompany] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newPlatform, setNewPlatform] = useState<JobApplication["platform"]>("Greenhouse");

  const handleLogout = () => {
    logout();
    toast.success("Successfully logged out.");
    navigate({ to: "/" });
  };

  const handleAddApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newRole.trim()) {
      toast.error("Please fill in both company and role");
      return;
    }

    const newApp: JobApplication = {
      id: `app-${Date.now()}`,
      company: newCompany.trim(),
      role: newRole.trim(),
      platform: newPlatform,
      date: "Just now",
      matchScore: Math.floor(Math.random() * 12) + 88, // 88% - 99%
      status: "Applied",
    };

    setApplications([newApp, ...applications]);
    setNewCompany("");
    setNewRole("");
    setShowAddModal(false);
    toast.success(`Tracked application for ${newApp.company}!`);
  };

  const toggleBot = () => {
    setIsBotRunning((prev) => !prev);
    if (!isBotRunning) {
      toast.success("AI Crawler activated! Watching 50,000+ career boards.");
    } else {
      toast.info("AI Crawler paused.");
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: JobApplication["status"]) => {
    switch (status) {
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
            <div className="text-2xl font-bold tracking-tight">{applications.length + 19}</div>
            <div className="mt-1 text-[11px] text-emerald-500 font-medium flex items-center gap-1">
              <TrendingUp size={12} /> +12 submitted this week
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Interviews</span>
              <Calendar size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {applications.filter((a) => a.status === "Interview").length + 2}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Upcoming: Stripe & Notion</div>
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
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-input bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Applied">Applied</option>
                <option value="Under Review">Under Review</option>
                <option value="Interview">Interview</option>
                <option value="Offer">Offer</option>
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
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No applications found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-semibold text-foreground text-sm">{app.company}</div>
                        <div className="text-muted-foreground text-xs mt-0.5">{app.role}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium bg-background text-foreground/80">
                          {app.platform}
                        </span>
                      </td>
                      <td className="py-4 px-4">
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
                        </div>
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">{app.date}</td>
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
                        <button
                          onClick={() => toast.info(`Viewing application details for ${app.company}`)}
                          className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
                        >
                          View Details
                          <ExternalLink size={12} />
                        </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-1">Track New Job Application</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Add an application manually or let AI track its status updates.
            </p>

            <form onSubmit={handleAddApplication} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Airbnb"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Role Title</label>
                <input
                  type="text"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g. Lead Frontend Engineer"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">ATS Platform</label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as any)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="Greenhouse">Greenhouse</option>
                  <option value="Lever">Lever</option>
                  <option value="Ashby">Ashby</option>
                  <option value="Workday">Workday</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Save & Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
