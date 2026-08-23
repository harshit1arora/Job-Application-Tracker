import { useState } from "react";
import { type UserProfile, saveProfile, getMissingProfileFields } from "@/lib/profile";
import { toast } from "sonner";
import { Sparkles, X, Check, AlertCircle, User, Phone, MapPin, Briefcase, Award } from "lucide-react";

interface MissingFieldsModalProps {
  userId: string;
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onClose: () => void;
}

export function MissingFieldsModal({
  userId,
  profile,
  onProfileUpdated,
  onClose,
}: MissingFieldsModalProps) {
  const missingFields = getMissingProfileFields(profile);

  const [form, setForm] = useState<UserProfile>({ ...profile });
  const [skillsInput, setSkillsInput] = useState((profile.skills || []).join(", "));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const skillsArray = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: UserProfile = {
      ...form,
      skills: skillsArray.length > 0 ? skillsArray : form.skills,
      location: form.city || form.location,
    };

    saveProfile(userId, updated);
    onProfileUpdated(updated);
    toast.success("Profile updated! All application fields are ready.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">AI Application Gap Assistant</h3>
              <p className="text-xs text-muted-foreground">
                We noticed a few missing details needed for 1-click job applications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {missingFields.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-600 dark:text-amber-300">
              <span className="font-semibold">Missing from your résumé:</span>{" "}
              {missingFields.join(", ")}. Fill them below so employers have your complete contact information.
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <User size={13} className="text-primary" /> Full Name
              </label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Alex Carter"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <Phone size={13} className="text-primary" /> Phone Number
              </label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +1 (415) 890-2341"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <MapPin size={13} className="text-primary" /> City / Location
              </label>
              <input
                type="text"
                required
                value={form.city || form.location}
                onChange={(e) => setForm({ ...form, city: e.target.value, location: e.target.value })}
                placeholder="e.g. San Francisco, CA or Remote"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <Award size={13} className="text-primary" /> Experience / Age
              </label>
              <input
                type="text"
                required
                value={form.ageOrExperience || ""}
                onChange={(e) => setForm({ ...form, ageOrExperience: e.target.value })}
                placeholder="e.g. 4+ Years Experience (or Age 26)"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
              <Briefcase size={13} className="text-primary" /> Target Role / Title
            </label>
            <input
              type="text"
              required
              value={form.targetRole || ""}
              onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
              placeholder="e.g. Senior Full Stack Engineer"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-muted-foreground mb-1">
              Key Technical Skills (comma separated)
            </label>
            <input
              type="text"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="e.g. React, TypeScript, Node.js, C#, Python, PostgreSQL"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-muted-foreground mb-1">LinkedIn URL</label>
              <input
                type="text"
                value={form.linkedin || ""}
                onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                placeholder="linkedin.com/in/alexcarter"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-muted-foreground mb-1">Portfolio / GitHub</label>
              <input
                type="text"
                value={form.portfolio || ""}
                onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
                placeholder="github.com/alexcarter"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border mt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary transition-colors"
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow hover:opacity-95 transition-opacity"
            >
              <Check size={14} />
              Save Details & Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
