import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { getApplication, updateApplication, deleteApplication } from "@/lib/applications-service";
import type { ApplicationDocument, ApplicationStatus } from "@/lib/types";
import { APPLICATION_STATUSES } from "@/lib/types";
import { toast } from "sonner";
import { AppError } from "@/lib/types";
import { ArrowLeft, Loader2, Save, Trash2, Building2, Briefcase, Calendar, MapPin, DollarSign, ClipboardCopy, Sparkles, Copy, X, ExternalLink } from "lucide-react";
import { DocumentsSection } from "@/components/documents-section";
import { getProfile, autofillText } from "@/lib/profile";
import { generateCoverLetter } from "@/lib/ai";

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

  // AI Cover Letter modal state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLetterText, setAiLetterText] = useState("");
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);

  // Form State
  const statusRef = useRef<HTMLSelectElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
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
        applicationUrl: urlRef.current?.value || undefined,
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

  const handleGenerateLetter = async () => {
    if (!user || !application) return;
    setIsGeneratingLetter(true);
    setShowAiModal(true);
    try {
      const profile = getProfile(user.id);
      const letter = await generateCoverLetter(
        profile.fullName || user.name || "Candidate",
        application.company,
        application.jobTitle,
        application.jobDescription,
        profile.resumeText
      );
      setAiLetterText(letter);
      toast.success("AI Cover Letter generated!");
    } catch (error) {
      console.error("Failed to generate cover letter:", error);
      toast.error("Failed to generate AI cover letter.");
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const handleCopyAutofill = async () => {
    if (!user) return;
    const profile = getProfile(user.id);
    const block = autofillText(profile);
    if (!block && !profile.resumeText) {
      toast.error("Add your details on the dashboard (Résumé & Profile) first.");
      return;
    }
    const payload = [block, profile.resumeText && `\nRésumé:\n${profile.resumeText}`]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Details copied — paste them into the application form.");
    } catch {
      toast.error("Couldn't access the clipboard. Copy manually from your profile.");
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
          <div className="flex items-center gap-4">
            <Link
              to="/applications"
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={15} />
              Applications
            </Link>
            <span className="text-border">•</span>
            <Link
              to="/"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Website Home
            </Link>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {application.applicationUrl && (
              <a
                href={application.applicationUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 text-xs font-bold text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors flex items-center gap-1.5 border border-border"
              >
                <ExternalLink size={14} className="text-primary" />
                Launch Portal
              </a>
            )}
            <button
              onClick={handleGenerateLetter}
              title="Generate tailored cover letter using AI"
              className="px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
            >
              <Sparkles size={14} />
              AI Cover Letter
            </button>
            <button
              onClick={handleCopyAutofill}
              title="Copy your saved details to paste into the career portal"
              className="px-3 py-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <ClipboardCopy size={14} />
              Copy details
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-2 text-xs font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </button>
          </div>
        </div>
      </header>

      {/* AI Cover Letter Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">AI Tailored Cover Letter</h3>
                  <p className="text-xs text-muted-foreground">{application.jobTitle} at {application.company}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[220px]">
              {isGeneratingLetter ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 size={28} className="animate-spin text-primary mb-3" />
                  <p className="text-sm font-medium">Crafting tailored cover letter with AI...</p>
                </div>
              ) : (
                <textarea
                  value={aiLetterText}
                  onChange={(e) => setAiLetterText(e.target.value)}
                  rows={12}
                  className="w-full rounded-xl border border-input bg-background p-4 text-sm font-sans leading-relaxed focus:border-primary focus:outline-none resize-none"
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
              <button
                onClick={() => {
                  if (notesRef.current && aiLetterText) {
                    notesRef.current.value = notesRef.current.value
                      ? `${notesRef.current.value}\n\n--- AI Cover Letter ---\n${aiLetterText}`
                      : aiLetterText;
                    toast.success("Cover letter added to Application Notes! Click 'Save Changes' to persist.");
                    setShowAiModal(false);
                  }
                }}
                disabled={isGeneratingLetter || !aiLetterText}
                className="px-4 py-2 text-xs font-bold text-foreground bg-secondary hover:bg-secondary/80 rounded-xl"
              >
                Insert into Notes
              </button>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(aiLetterText);
                  toast.success("Cover letter copied to clipboard!");
                }}
                disabled={isGeneratingLetter || !aiLetterText}
                className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-xl flex items-center gap-1.5 shadow-md shadow-primary/20"
              >
                <Copy size={14} />
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <ExternalLink size={12} /> Career Portal URL
                </label>
                <input
                  type="url"
                  ref={urlRef}
                  defaultValue={application.applicationUrl || ""}
                  placeholder="https://boards.greenhouse.io/..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
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
