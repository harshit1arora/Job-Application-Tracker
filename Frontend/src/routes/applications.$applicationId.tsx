import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { getApplication, updateApplication, deleteApplication } from "@/lib/applications-service";
import type { ApplicationDocument, ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUSES } from "@/lib/types";
import { toast } from "sonner";
import { AppError } from "@/lib/types";
import { ArrowLeft, Loader2, Save, Trash2, Building2, Briefcase, Calendar, MapPin, DollarSign } from "lucide-react";
import { DocumentsSection } from "@/components/documents-section";

export const Route = createFileRoute("/applications/$applicationId")({
  component: ApplicationDetailsPage,
});

function ApplicationDetailsPage() {
  const { applicationId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState<ApplicationDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const statusRef = useRef<HTMLSelectElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const salaryRef = useRef<HTMLInputElement>(null);
  const followUpRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const jdRef = useRef<HTMLTextAreaElement>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  // Load application data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const data = await getApplication(user.id, applicationId);
        if (!data) {
          toast.error("Application not found.");
          navigate({ to: "/dashboard" });
          return;
        }
        setApplication(data);
      } catch (error) {
        console.error("Failed to load application:", error);
        toast.error("Failed to load application details.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [user, applicationId, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !application) return;

    setIsSaving(true);
    try {
      const changes = {
        status: statusRef.current?.value as ApplicationStatus,
        location: locationRef.current?.value || undefined,
        salaryRange: salaryRef.current?.value || undefined,
        followUpDate: followUpRef.current?.value || undefined,
        notes: notesRef.current?.value || undefined,
        jobDescription: jdRef.current?.value || undefined,
      } as Partial<import("@/lib/types").CreateApplicationInput>;

      const updated = await updateApplication(user.id, applicationId, changes);
      setApplication(updated);
      toast.success("Application updated successfully!");
    } catch (error: any) {
      console.error("Save error:", error);
      if (error instanceof AppError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to update application.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this application? This action cannot be undone.");
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await deleteApplication(user.id, applicationId);
      toast.success("Application deleted.");
      navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete application.");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm font-medium">Loading details...</p>
      </div>
    );
  }

  if (!application) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8 max-w-4xl">
        {/* Title Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Building2 size={16} />
              <h2 className="text-sm font-bold tracking-widest uppercase">{application.company}</h2>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
              {application.jobTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Applied via {application.applicationSource} on {new Date(application.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Briefcase size={18} className="text-primary" />
                Application Notes
              </h3>
              <textarea
                ref={notesRef}
                defaultValue={application.notes || ""}
                placeholder="Jot down interview questions, recruiters' names, or things to research..."
                className="w-full min-h-[150px] rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none resize-y"
              />
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Briefcase size={18} className="text-muted-foreground" />
                Original Job Description
              </h3>
              <textarea
                ref={jdRef}
                defaultValue={application.jobDescription || ""}
                placeholder="Paste the job description here so you don't lose it when the posting goes down..."
                className="w-full min-h-[250px] rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none resize-y font-mono text-xs"
              />
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              
              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-muted-foreground mb-2">Status</label>
                <select
                  ref={statusRef}
                  defaultValue={application.status}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold focus:border-primary focus:outline-none"
                >
                  {APPLICATION_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-muted-foreground mb-2 flex items-center gap-1">
                  <MapPin size={12} /> Location
                </label>
                <input
                  type="text"
                  ref={locationRef}
                  defaultValue={application.location || ""}
                  placeholder="e.g. Remote, San Francisco"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-muted-foreground mb-2 flex items-center gap-1">
                  <DollarSign size={12} /> Salary Range
                </label>
                <input
                  type="text"
                  ref={salaryRef}
                  defaultValue={application.salaryRange || ""}
                  placeholder="e.g. $120k - $150k"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold tracking-wider uppercase text-muted-foreground mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Follow-up Date
                </label>
                <input
                  type="date"
                  ref={followUpRef}
                  defaultValue={application.followUpDate || ""}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none [color-scheme:dark]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            </div>

            {/* Documents Section */}
            <DocumentsSection applicationId={applicationId} />
            
          </div>
        </form>
      </main>
    </div>
  );
}
