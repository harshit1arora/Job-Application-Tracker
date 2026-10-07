import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BellRing,
  Loader2,
  RefreshCw,
  Mail,
  Clock,
  Trash2,
  Settings2,
  History,
  AlarmClock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { FollowUpDraftModal } from "@/components/followup-draft-modal";
import { getProfile } from "@/lib/profile";
import {
  deleteFollowUpLog,
  getFollowUpSnapshot,
  saveFollowUpSettings,
  scanAndCreateReminders,
  snoozeFollowUp,
} from "@/lib/followups-service";
import type { FollowUpSnapshot } from "@/lib/followups-service";
import { DEFAULT_FOLLOWUP_SETTINGS, buildFollowUpItem } from "@/lib/followup-logic";
import { AppError, FOLLOWUP_TONES } from "@/lib/types";
import type { ApplicationDocument, FollowUpItem, FollowUpSettings, FollowUpTone } from "@/lib/types";

export const Route = createFileRoute("/followups")({
  head: () => ({
    meta: [{ title: "Follow-ups — JobPilot" }],
  }),
  component: FollowUpsPage,
});

const FOCUS_KEY = "jobpilot_followup_focus";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function FollowUpsPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState<FollowUpSnapshot | null>(null);
  const [applications, setApplications] = useState<ApplicationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [draftItem, setDraftItem] = useState<FollowUpItem | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<FollowUpSettings>(DEFAULT_FOLLOWUP_SETTINGS);
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [manualAppId, setManualAppId] = useState("");

  const userId = user?.id;

  const load = useCallback(async () => {
    if (!userId) return null;
    const snap = await getFollowUpSnapshot(userId);
    const apps = snap.applications;
    setSnapshot(snap);
    setApplications(apps);
    setSettingsDraft(snap.settings);
    return { snap, apps };
  }, [userId]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated && !user) {
      navigate({ to: "/login" });
      return;
    }
    if (!userId) return;
    let active = true;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const loaded = await load();
        if (!active || !loaded) return;

        // Arrived from an application page: open its draft straight away.
        let focusId: string | null = null;
        try {
          focusId = sessionStorage.getItem(FOCUS_KEY);
          if (focusId) sessionStorage.removeItem(FOCUS_KEY);
        } catch {
          focusId = null;
        }
        const target = focusId ? loaded.apps.find((a) => a.id === focusId) : undefined;
        if (target) {
          setDraftItem(buildFollowUpItem(target, loaded.snap.logs, loaded.snap.settings));
        }

        void scanAndCreateReminders(userId, { snapshot: loaded.snap })
          .then(async (scan) => {
            if (!active || scan.created.length === 0) return;
            toast.success(`Created ${scan.created.length} follow-up reminder${scan.created.length > 1 ? "s" : ""}`);
            await load();
          })
          .catch(() => {});
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to load follow-ups.";
        setLoadError(message);
        toast.error(message);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, user, isAuthenticated, isAuthLoading, navigate, load]);

  const appNames = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);

  const handleScan = async () => {
    if (!userId) return;
    setIsScanning(true);
    try {
      const result = await scanAndCreateReminders(userId, { force: true });
      if (result.skipped === "disabled") {
        toast.message("Follow-up automation is turned off. Enable it in settings below.");
      } else if (result.created.length > 0) {
        toast.success(`Created ${result.created.length} follow-up reminder${result.created.length > 1 ? "s" : ""}`);
      } else {
        toast.message("Nothing new — every quiet application already has a reminder.");
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSnooze = async (item: FollowUpItem, days: number) => {
    if (!userId) return;
    try {
      await snoozeFollowUp(userId, item, days);
      toast.success(`Snoozed ${item.application.company} for ${days} days`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not snooze.");
    }
  };

  const handleSaveSettings = async () => {
    if (!userId) return;
    setSettingsErrors({});
    setIsSavingSettings(true);
    try {
      await saveFollowUpSettings(userId, settingsDraft);
      toast.success("Follow-up settings saved");
      await load();
    } catch (error) {
      if (error instanceof AppError && error.fields) {
        setSettingsErrors(error.fields);
        toast.error("Please fix the highlighted fields.");
      } else {
        toast.error(error instanceof Error ? error.message : "Could not save settings.");
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!userId) return;
    try {
      await deleteFollowUpLog(userId, logId);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the entry.");
    }
  };

  const openManualDraft = () => {
    if (!snapshot) return;
    const application = applications.find((a) => a.id === manualAppId);
    if (!application) {
      toast.error("Choose an application first.");
      return;
    }
    setDraftItem(buildFollowUpItem(application, snapshot.logs, snapshot.settings));
  };

  const numberField = (key: "appliedDays" | "underReviewDays" | "interviewDays" | "maxFollowUps", label: string, hint: string) => (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        min={1}
        max={key === "maxFollowUps" ? 10 : 90}
        value={settingsDraft[key]}
        onChange={(e) => setSettingsDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
        className={inputClass}
      />
      <span className="block text-[10px] text-muted-foreground">{hint}</span>
      {settingsErrors[key] ? <span className="block text-[11px] font-semibold text-rose-500">{settingsErrors[key]}</span> : null}
    </label>
  );

  const evaluation = snapshot?.evaluation;
  const applicantName = userId ? getProfile(userId).fullName || user?.name : undefined;
  const manualCandidates = applications.filter((a) => a.status !== "Rejected" && a.status !== "Saved");

  const renderItem = (item: FollowUpItem, kind: "due" | "exhausted" | "snoozed" | "upcoming") => (
    <div
      key={item.application.id}
      className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-sm truncate">{item.application.company}</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
            {item.application.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.application.jobTitle}</p>
        <p className="text-[11px] mt-1 text-muted-foreground">
          {kind === "upcoming"
            ? `Goes quiet in ${item.daysUntilDue} day${item.daysUntilDue === 1 ? "" : "s"} (after ${item.thresholdDays} days of silence)`
            : kind === "snoozed"
              ? `Quiet for ${item.daysQuiet} days · reminder set for ${item.snoozedUntil ? formatDate(item.snoozedUntil) : "later"}`
              : kind === "exhausted"
                ? `Quiet for ${item.daysQuiet} days · ${item.sentCount} follow-ups already sent — consider moving on`
                : `Quiet for ${item.daysQuiet} days (limit ${item.thresholdDays}) · follow-up #${item.followUpNumber}`}
        </p>
      </div>
      {kind === "due" || kind === "snoozed" ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDraftItem(item)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-95"
          >
            <Mail size={13} /> Draft follow-up
          </button>
          <button
            type="button"
            onClick={() => handleSnooze(item, 3)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-semibold hover:bg-secondary/60"
          >
            <AlarmClock size={13} /> Snooze 3d
          </button>
        </div>
      ) : null}
    </div>
  );

  const section = (title: string, description: string, items: FollowUpItem[], kind: "due" | "exhausted" | "snoozed" | "upcoming") =>
    items.length === 0 ? null : (
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-black">
            {title} ({items.length})
          </h2>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <div className="space-y-2.5">{items.map((item) => renderItem(item, kind))}</div>
      </section>
    );

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      <DashboardSidebar />

      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto overflow-y-auto w-full space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <BellRing size={14} /> Smart Follow-ups
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Follow-up center</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applications that go quiet get a reminder automatically, plus an AI-drafted message ready to send.
            </p>
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning || isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-xs font-bold hover:bg-secondary/60 disabled:opacity-60"
          >
            {isScanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Scan now
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
            <Loader2 className="animate-spin" size={16} /> Checking your applications…
          </div>
        ) : loadError || !snapshot || !evaluation ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-600 dark:text-rose-300">
            {loadError ?? "Unable to load follow-ups."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Need follow-up", value: evaluation.due.length, accent: "text-rose-500" },
                { label: "Snoozed / scheduled", value: evaluation.snoozed.length, accent: "text-amber-500" },
                { label: "Going quiet soon", value: evaluation.upcoming.length, accent: "text-sky-500" },
                { label: "Follow-ups sent", value: snapshot.logs.length, accent: "text-emerald-500" },
              ].map((tile) => (
                <div key={tile.label} className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-4 shadow-xs">
                  <div className={`text-2xl font-black ${tile.accent}`}>{tile.value}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground">{tile.label}</div>
                </div>
              ))}
            </div>

            {!snapshot.settings.enabled ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                Follow-up automation is turned off. Enable it in the settings below to see quiet applications.
              </div>
            ) : evaluation.due.length === 0 && evaluation.exhausted.length === 0 && evaluation.snoozed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-white dark:bg-[#111622] p-8 text-center text-xs text-muted-foreground">
                You're all caught up — no application has been quiet longer than your limits.
              </div>
            ) : null}

            {section("Needs a follow-up", "Quiet longer than your limit and no reminder scheduled for later.", evaluation.due, "due")}
            {section("Snoozed", "A reminder is scheduled for a later date.", evaluation.snoozed, "snoozed")}
            {section("Consider moving on", "You've reached your follow-up limit for these applications.", evaluation.exhausted, "exhausted")}
            {section("Going quiet soon", "Not overdue yet — here is how long until they are.", evaluation.upcoming.slice(0, 6), "upcoming")}

            <section className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-5 shadow-xs space-y-3">
              <h2 className="text-base font-black flex items-center gap-2">
                <Mail size={16} className="text-primary" /> Draft a follow-up for any application
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={manualAppId} onChange={(e) => setManualAppId(e.target.value)} className={inputClass}>
                  <option value="">Choose an application…</option>
                  {manualCandidates.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.company} · {app.jobTitle} ({app.status})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openManualDraft}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground whitespace-nowrap"
                >
                  Draft message
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-5 shadow-xs space-y-4">
              <h2 className="text-base font-black flex items-center gap-2">
                <Settings2 size={16} className="text-primary" /> Automation settings
              </h2>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={settingsDraft.enabled}
                  onChange={(e) => setSettingsDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                Detect quiet applications
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={settingsDraft.autoCreateReminders}
                  onChange={(e) => setSettingsDraft((prev) => ({ ...prev, autoCreateReminders: e.target.checked }))}
                />
                Automatically create a reminder when an application goes quiet
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {numberField("appliedDays", "Applied (days)", "Quiet after applying")}
                {numberField("underReviewDays", "Under review (days)", "Quiet while in review")}
                {numberField("interviewDays", "Interview (days)", "Quiet after an interview")}
                {numberField("maxFollowUps", "Max follow-ups", "Then suggest moving on")}
              </div>
              <label className="block space-y-1 max-w-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Default tone</span>
                <select
                  value={settingsDraft.defaultTone}
                  onChange={(e) => setSettingsDraft((prev) => ({ ...prev, defaultTone: e.target.value as FollowUpTone }))}
                  className={inputClass}
                >
                  {FOLLOWUP_TONES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
                >
                  {isSavingSettings ? <Loader2 size={14} className="animate-spin" /> : null}
                  Save settings
                </button>
                <span className="text-[11px] text-muted-foreground">
                  Quiet time is measured from the last update to an application or your last logged follow-up.
                </span>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-black flex items-center gap-2">
                <History size={16} className="text-primary" /> Follow-up history
              </h2>
              {snapshot.logs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing logged yet. Use “Mark as sent” after you send a follow-up.</p>
              ) : (
                <div className="space-y-2">
                  {snapshot.logs.slice(0, 20).map((log) => {
                    const app = appNames.get(log.applicationId);
                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-border/70 bg-white dark:bg-[#111622] p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {app ? `${app.company} · ${app.jobTitle}` : "Deleted application"}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Clock size={11} /> {formatDate(log.createdAt)} · {log.channel}
                            {log.tone ? ` · ${log.tone}` : ""}
                          </div>
                          {log.subject ? <div className="text-[11px] text-foreground/80 truncate mt-0.5">{log.subject}</div> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log.id)}
                          aria-label="Delete follow-up entry"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {draftItem && userId ? (
        <FollowUpDraftModal
          userId={userId}
          item={draftItem}
          applicantName={applicantName}
          defaultTone={snapshot?.settings.defaultTone ?? "polite"}
          onClose={() => setDraftItem(null)}
          onSent={() => {
            setDraftItem(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
