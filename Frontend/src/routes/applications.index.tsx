import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getApplications, createApplication } from "@/lib/applications-service";
import type { ApplicationDocument, ApplicationStatus, ApplicationSource } from "@/lib/types";
import { AppError } from "@/lib/types";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  Search,
  Plus,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  Filter,
  CheckCircle,
  Clock,
  Briefcase,
} from "lucide-react";

export const Route = createFileRoute("/applications/")({
  head: () => ({
    meta: [{ title: "Applications Pipeline — JobPilot" }],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<ApplicationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "All">("All");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !user) {
      navigate({ to: "/login" });
      return;
    }
    if (user) {
      void loadApplications(user.id);
    }
  }, [user, isAuthenticated, navigate]);

  const loadApplications = async (userId: string) => {
    setIsLoading(true);
    try {
      const data = await getApplications(userId);
      setApplications(data);
    } catch {
      toast.error("Failed to load applications.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddApplication = async (
    company: string,
    role: string,
    source: ApplicationSource,
    url?: string
  ) => {
    if (!user) return;
    try {
      const newApp = await createApplication(user.id, {
        company: company.trim(),
        jobTitle: role.trim(),
        applicationSource: source,
        status: "Applied",
        ...(url ? { applicationUrl: url.trim() } : {}),
      });
      setApplications((prev) => [newApp, ...prev]);
      setShowAddModal(false);
      toast.success(`Application for ${newApp.company} saved!`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save application.");
    }
  };

  const filtered = applications.filter((app) => {
    const matchesSearch =
      (app.company || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.jobTitle || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.notes || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ApplicationStatus) => {
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

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      <DashboardSidebar applicationsCount={applications.length} />

      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto overflow-y-auto w-full space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <FileText size={14} /> Pipeline Management
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Tracked Applications ({applications.length})
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your active career applications, interview stages, and direct portal links.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-95 transition-opacity"
          >
            <Plus size={15} />
            Track New Application
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#111622] p-4 rounded-2xl border border-border/80 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search company, role or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-input bg-background/50 pl-8 pr-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {(["All", "Applied", "Interview", "Under Review", "Saved", "Offer", "Rejected"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === status
                    ? "bg-[#0d131f] text-white dark:bg-white dark:text-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Applications Table */}
        <div className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8f9fb] dark:bg-[#151c2a] border-b border-border/70 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6 font-bold">COMPANY & ROLE</th>
                  <th className="py-3.5 px-6 font-bold">PORTAL SOURCE</th>
                  <th className="py-3.5 px-6 font-bold">MATCH SCORE</th>
                  <th className="py-3.5 px-6 font-bold">STATUS</th>
                  <th className="py-3.5 px-6 font-bold">APPLIED DATE</th>
                  <th className="py-3.5 px-6 text-right font-bold">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin text-primary" />
                        Loading applications...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No applications found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((app) => (
                    <tr
                      key={app.id}
                      className="hover:bg-secondary/20 transition-colors group cursor-pointer"
                      onClick={() => navigate({ to: `/applications/${app.id}` })}
                    >
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

                      <td className="py-4 px-6">
                        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium bg-background text-foreground/80">
                          {app.applicationSource}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {app.matchScore ?? 90}%
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getStatusBadge(
                            app.status
                          )}`}
                        >
                          {app.status}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-muted-foreground font-medium">
                        {app.createdAt
                          ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })
                          : "Recently"}
                      </td>

                      <td className="py-4 px-6 text-right space-x-2">
                        {app.applicationUrl && (
                          <a
                            href={app.applicationUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1 border border-border px-2 py-1 rounded-lg"
                          >
                            Portal <ExternalLink size={11} />
                          </a>
                        )}
                        <Link
                          to="/applications/$applicationId"
                          params={{ applicationId: app.id }}
                          className="text-xs text-primary hover:underline font-bold inline-flex items-center gap-1"
                        >
                          Details
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

      {/* Add Modal */}
      {showAddModal && (
        <AddAppModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddApplication}
        />
      )}
    </div>
  );
}

function AddAppModal({
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
        <h3 className="text-lg font-bold text-foreground mb-1">Track Custom Application</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Add any career opening to track its interview pipeline.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-muted-foreground mb-1">Company Name</label>
            <input
              type="text"
              required
              ref={companyRef}
              placeholder="e.g. Airbnb"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-muted-foreground mb-1">Role Title</label>
            <input
              type="text"
              required
              ref={roleRef}
              placeholder="e.g. Lead Frontend Engineer"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-muted-foreground mb-1">Source Platform</label>
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
            <label className="block font-semibold text-muted-foreground mb-1">Career Portal URL (Optional)</label>
            <input
              type="url"
              ref={urlRef}
              placeholder="https://careers.airbnb.com/..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-border py-2.5 font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground hover:opacity-90 shadow"
            >
              {isSubmitting ? "Saving..." : "Save & Track"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
