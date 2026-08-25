import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { SuggestedJobsSection } from "@/components/suggested-jobs-section";
import { ApplyPortalModal } from "@/components/apply-portal-modal";
import { MissingFieldsModal } from "@/components/missing-fields-modal";
import { QuickFillWidget } from "@/components/quick-fill-widget";
import { CURATED_JOBS_CATALOG } from "@/lib/jobs-catalog";
import { getProfile, saveProfile, type UserProfile } from "@/lib/profile";
import { suggestJobsForResume } from "@/lib/ai";
import { createApplication } from "@/lib/applications-service";
import type { SuggestedJob } from "@/lib/types";
import { toast } from "sonner";
import { Search, Sparkles, Building2, MapPin, Zap, Filter, Briefcase } from "lucide-react";

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [{ title: "Browse Jobs — JobPilot AI" }],
  }),
  component: BrowseJobsPage,
});

function BrowseJobsPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [suggestedJobs, setSuggestedJobs] = useState<SuggestedJob[]>(CURATED_JOBS_CATALOG);
  const [selectedApplyJob, setSelectedApplyJob] = useState<SuggestedJob | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !user) {
      navigate({ to: "/login" });
      return;
    }
    if (user) {
      const p = getProfile(user.id);
      setProfile(p);
      void rankJobs(p);
    }
  }, [user, isAuthenticated, navigate]);

  const rankJobs = async (p: UserProfile) => {
    try {
      const ranked = await suggestJobsForResume(
        {
          fullName: p.fullName,
          email: p.email,
          phone: p.phone,
          city: p.city || p.location,
          ageOrExperience: p.ageOrExperience || "3+ YOE",
          targetRole: p.targetRole || "Software Engineer",
          skills: p.skills && p.skills.length > 0 ? p.skills : ["React", "TypeScript", "Node.js"],
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

  const handleApplyAndTrackJob = async (job: SuggestedJob) => {
    if (!user) return;
    try {
      await createApplication(user.id, {
        company: job.company,
        jobTitle: job.role,
        applicationSource: job.source,
        status: "Applied",
        applicationUrl: job.portalUrl,
        location: job.location,
        salaryRange: job.salaryRange,
        jobDescription: job.description,
        notes: `Applied via Browse Jobs portal. Match score: ${job.matchScore ?? 90}%.`,
      });
      toast.success(`Application for ${job.company} added to your tracker!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to record application.");
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      <DashboardSidebar />

      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto overflow-y-auto w-full space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <Sparkles size={14} /> AI Job Discovery Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Browse Tech Opportunities
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live openings ranked by AI compatibility with your résumé skills and preferred role.
            </p>
          </div>
        </div>

        {profile && (
          <SuggestedJobsSection
            jobs={suggestedJobs}
            profile={profile}
            onApplyClick={(job) => setSelectedApplyJob(job)}
          />
        )}
      </main>

      {profile && <QuickFillWidget profile={profile} />}

      {selectedApplyJob && profile && (
        <ApplyPortalModal
          job={selectedApplyJob}
          profile={profile}
          userId={user?.id}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            void rankJobs(updated);
          }}
          onOpenMissingFields={() => {
            setSelectedApplyJob(null);
            setShowMissingModal(true);
          }}
          onApplyAndTrack={handleApplyAndTrackJob}
          onClose={() => setSelectedApplyJob(null)}
        />
      )}

      {showMissingModal && profile && user && (
        <MissingFieldsModal
          userId={user.id}
          profile={profile}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            void rankJobs(updated);
          }}
          onClose={() => setShowMissingModal(false)}
        />
      )}
    </div>
  );
}
