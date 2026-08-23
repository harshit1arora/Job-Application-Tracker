import { useState, useMemo } from "react";
import type { SuggestedJob, ApplicationSource } from "@/lib/types";
import { type UserProfile } from "@/lib/profile";
import {
  Sparkles,
  Search,
  MapPin,
  ExternalLink,
  Zap,
  Building2,
  CheckCircle,
  Briefcase,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

interface SuggestedJobsSectionProps {
  jobs: SuggestedJob[];
  profile: UserProfile;
  onApplyClick: (job: SuggestedJob) => void;
}

export function SuggestedJobsSection({
  jobs,
  profile,
  onApplyClick,
}: SuggestedJobsSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<ApplicationSource | "All">("All");

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.requiredSkills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
        job.location.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPlatform = platformFilter === "All" || job.source === platformFilter;

      return matchesSearch && matchesPlatform;
    });
  }, [jobs, searchTerm, platformFilter]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm mb-8">
      {/* Header & Controls */}
      <div className="p-5 border-b border-border bg-gradient-to-r from-primary/5 via-card to-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
            <Sparkles size={14} /> AI Matched Opportunities
          </div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Recommended Roles for Your Profile
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ranked based on your parsed résumé skills, experience, and target title ({profile.targetRole || "Software Engineer"}).
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search role, company or skill..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-56"
            />
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as ApplicationSource | "All")}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="All">All ATS Portals</option>
            <option value="Greenhouse">Greenhouse</option>
            <option value="Lever">Lever</option>
            <option value="Ashby">Ashby</option>
            <option value="Workday">Workday</option>
            <option value="LinkedIn">LinkedIn</option>
          </select>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="divide-y divide-border">
        {filteredJobs.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-xs">
            No matching jobs found. Try adjusting your search or ATS portal filter.
          </div>
        ) : (
          filteredJobs.map((job) => {
            const score = job.matchScore ?? 90;
            return (
              <div
                key={job.id}
                className="p-5 hover:bg-secondary/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 group"
              >
                {/* Job Info */}
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold text-foreground text-base tracking-tight group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <Building2 size={16} className="text-muted-foreground" />
                      {job.company}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-[11px] font-medium bg-background text-foreground/80">
                      {job.source}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Posted {job.postedDate || "recently"}</span>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground">{job.role}</h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-primary" />
                      {job.location}
                    </span>
                    <span>•</span>
                    <span className="font-medium text-foreground/90">{job.salaryRange}</span>
                    <span>•</span>
                    <span className="text-foreground/70">{job.experienceLevel || "Mid-Senior"}</span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  {/* Skills & Match Reasons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {job.requiredSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground/90"
                      >
                        {skill}
                      </span>
                    ))}
                    {job.matchReasons && job.matchReasons[0] && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <CheckCircle size={11} /> {job.matchReasons[0]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Match Score & Action */}
                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {score}%
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Match
                      </span>
                    </div>
                    <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onApplyClick(job)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Zap size={14} className="fill-primary-foreground text-primary-foreground" />
                    1-Click Apply
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
