import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getApplications } from "@/lib/applications-service";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Bell,
  Sparkles,
  Shield,
  Download,
  Trash2,
  Save,
  Check,
  Bot,
  User,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings & Preferences — JobPilot" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [interviewAlerts, setInterviewAlerts] = useState(true);
  const [minMatchScore, setMinMatchScore] = useState(60);
  const [aiTone, setAiTone] = useState("Professional & Technical");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Preferences saved successfully!");
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const apps = await getApplications(user.id);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(apps, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `jobpilot-applications-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Applications exported to JSON!");
    } catch {
      toast.error("Failed to export data.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      <DashboardSidebar />

      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-5xl mx-auto overflow-y-auto w-full space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <SettingsIcon size={14} /> Preferences & Data Control
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Account Settings
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize AI match thresholds, notification channels, and data export.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
          {/* AI Matching & Crawler Settings */}
          <div className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/70 pb-3">
              <Bot size={16} className="text-primary" /> AI Matcher & Crawler Preferences
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Minimum AI Match Score Filter ({minMatchScore}%)
                </label>
                <input
                  type="range"
                  min={30}
                  max={90}
                  step={5}
                  value={minMatchScore}
                  onChange={(e) => setMinMatchScore(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="text-[10px] text-muted-foreground">
                  Only show job recommendations with compatibility above {minMatchScore}%.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  AI Cover Letter Tone
                </label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="Professional & Technical">Professional & Technical (Recommended)</option>
                  <option value="Conversational & Direct">Conversational & Direct</option>
                  <option value="High-Impact & Executive">High-Impact & Executive</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Remote-First Opportunities</p>
                <p className="text-[11px] text-muted-foreground">Prioritize 100% remote jobs in match engine</p>
              </div>
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/70 pb-3">
              <Bell size={16} className="text-primary" /> Notifications & Reminders
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">Interview Calendar Reminders</p>
                  <p className="text-[11px] text-muted-foreground">Receive browser and email notifications before scheduled rounds</p>
                </div>
                <input
                  type="checkbox"
                  checked={interviewAlerts}
                  onChange={(e) => setInterviewAlerts(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div>
                  <p className="font-semibold text-foreground">Daily Recruiter Digest</p>
                  <p className="text-[11px] text-muted-foreground">Summary of high-match job postings matching your résumé</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Data Export & Backup */}
          <div className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/70 pb-3">
              <Download size={16} className="text-primary" /> Data Export & Security
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Export All Tracked Applications</p>
                <p className="text-[11px] text-muted-foreground">Download your complete application dossier, notes, and dates as JSON</p>
              </div>
              <button
                type="button"
                onClick={handleExportData}
                disabled={isExporting}
                className="px-4 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
              >
                <Download size={13} />
                {isExporting ? "Exporting..." : "Export JSON"}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-95"
            >
              <Save size={14} /> Save Preferences
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
