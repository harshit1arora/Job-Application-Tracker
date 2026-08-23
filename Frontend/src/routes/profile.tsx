import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { MissingFieldsModal } from "@/components/missing-fields-modal";
import { getProfile, saveProfile, mergeParsedResumeIntoProfile, getMissingProfileFields, type UserProfile } from "@/lib/profile";
import { parseResumeWithAi } from "@/lib/ai";
import { extractTextFromFile, SAMPLE_RESUME_PRESET } from "@/lib/resume-parser";
import { toast } from "sonner";
import {
  User,
  Upload,
  Sparkles,
  FileText,
  Phone,
  MapPin,
  Briefcase,
  Award,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile & Résumé Parser — JobPilot" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated && !user) {
      navigate({ to: "/login" });
      return;
    }
    if (user) {
      const p = getProfile(user.id);
      const initial: UserProfile = {
        ...p,
        fullName: p.fullName || user.name || "Alex Morgan",
        email: p.email || user.email || "alex.morgan@example.com",
      };
      setProfile(initial);
      setResumeText(initial.resumeText || "");
      setSkillsInput((initial.skills || []).join(", "));
    }
  }, [user, isAuthenticated, navigate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsParsing(true);
    toast.info(`Extracting text from ${file.name}...`);
    try {
      const text = await extractTextFromFile(file);
      setResumeText(text);

      toast.info("AI is extracting structured candidate fields...");
      const parsed = await parseResumeWithAi(text);

      const current = profile || getProfile(user.id);
      const merged = mergeParsedResumeIntoProfile(current, parsed);

      saveProfile(user.id, merged);
      setProfile(merged);
      setSkillsInput((merged.skills || []).join(", "));

      const missing = getMissingProfileFields(merged);
      if (missing.length > 0) {
        toast.success(`Résumé parsed! Check ${missing.length} missing fields.`);
        setShowMissingModal(true);
      } else {
        toast.success("Résumé parsed successfully!");
      }
    } catch {
      toast.error("Failed to parse file.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLoadSample = async () => {
    if (!user) return;
    setIsParsing(true);
    setResumeText(SAMPLE_RESUME_PRESET);
    toast.info("AI parsing sample candidate résumé...");

    try {
      const parsed = await parseResumeWithAi(SAMPLE_RESUME_PRESET);
      const current = profile || getProfile(user.id);
      const merged = mergeParsedResumeIntoProfile(current, parsed);

      saveProfile(user.id, merged);
      setProfile(merged);
      setSkillsInput((merged.skills || []).join(", "));

      toast.success("Sample résumé parsed & profile populated!");
    } catch {
      toast.error("Failed to parse sample.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleManualSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setIsSaving(true);
    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: UserProfile = {
      ...profile,
      skills,
      resumeText,
    };

    saveProfile(user.id, updated);
    setProfile(updated);
    setIsSaving(false);
    toast.success("Profile & résumé details saved!");
  };

  const missing = profile ? getMissingProfileFields(profile) : [];

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      <DashboardSidebar />

      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto overflow-y-auto w-full space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <User size={14} /> Candidate Profile & AI Parser
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Résumé & Profile Settings
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload your résumé to automatically parse contact information, skills, and experience for 1-click job auto-fill.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              disabled={isParsing}
              className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              Load Sample Résumé
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="text-xs font-bold text-primary-foreground bg-primary px-4 py-2 rounded-xl transition-all shadow-md shadow-primary/20 flex items-center gap-1.5 hover:opacity-90"
            >
              {isParsing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload Résumé File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md,application/pdf,text/plain"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* Missing fields alert */}
        {missing.length > 0 && (
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs text-amber-600 dark:text-amber-300">
              <AlertTriangle size={16} className="text-amber-500 shrink-0" />
              <span>
                <strong>{missing.length} application details missing:</strong> {missing.join(", ")}. Fill them below so employers have your complete contact information.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowMissingModal(true)}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg shrink-0"
            >
              AI Gap Assistant
            </button>
          </div>
        )}

        {/* Form Grid */}
        {profile && (
          <form onSubmit={handleManualSave} className="space-y-6">
            <div className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-6 shadow-xs space-y-5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/70 pb-3">
                <FileText size={16} className="text-primary" /> Parsed Candidate Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+1 (415) 890-2341"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">City / Location</label>
                  <input
                    type="text"
                    value={profile.city || profile.location}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value, location: e.target.value })}
                    placeholder="San Francisco, CA or Remote"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Experience / Age</label>
                  <input
                    type="text"
                    value={profile.ageOrExperience || ""}
                    onChange={(e) => setProfile({ ...profile, ageOrExperience: e.target.value })}
                    placeholder="e.g. 4+ Years Experience / Age 26"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Target Role / Title</label>
                  <input
                    type="text"
                    value={profile.targetRole || ""}
                    onChange={(e) => setProfile({ ...profile, targetRole: e.target.value })}
                    placeholder="e.g. Senior Full Stack Engineer"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block font-semibold text-muted-foreground mb-1">
                    Key Technical Skills (comma separated)
                  </label>
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="e.g. React, TypeScript, Node.js, Python, PostgreSQL, AWS, Docker"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">LinkedIn Profile</label>
                  <input
                    type="text"
                    value={profile.linkedin || ""}
                    onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })}
                    placeholder="linkedin.com/in/username"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Portfolio / GitHub</label>
                  <input
                    type="text"
                    value={profile.portfolio || ""}
                    onChange={(e) => setProfile({ ...profile, portfolio: e.target.value })}
                    placeholder="github.com/username"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Education</label>
                  <input
                    type="text"
                    value={profile.education || ""}
                    onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                    placeholder="B.S. in Computer Science"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Raw Resume Text Card */}
            <div className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText size={16} className="text-primary" /> Raw Résumé Text
              </h3>
              <p className="text-xs text-muted-foreground">
                This raw text is used by the AI embedding model to rank match scores against job descriptions.
              </p>
              <textarea
                rows={8}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste or upload your résumé text..."
                className="w-full rounded-xl border border-input bg-background p-3.5 text-xs text-foreground font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-95 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save & Update Profile
              </button>
            </div>
          </form>
        )}
      </main>

      {showMissingModal && profile && user && (
        <MissingFieldsModal
          userId={user.id}
          profile={profile}
          onProfileUpdated={(updated) => {
            setProfile(updated);
            setSkillsInput((updated.skills || []).join(", "));
          }}
          onClose={() => setShowMissingModal(false)}
        />
      )}
    </div>
  );
}
