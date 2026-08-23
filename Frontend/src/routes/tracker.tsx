import { useState, useEffect, useMemo } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getApplications } from "@/lib/applications-service";
import { getReminders, createReminder, deleteReminder, markReminderComplete } from "@/lib/reminders-service";
import type { ApplicationDocument, ReminderDocument, ReminderType } from "@/lib/types";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Building2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Trash2,
  Video,
  FileCheck,
  X,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";

export const Route = createFileRoute("/tracker")({
  head: () => ({
    meta: [{ title: "Timeline Calendar & Interview Tracker — JobPilot" }],
  }),
  component: TrackerPage,
});

function TrackerPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<ApplicationDocument[]>([]);
  const [reminders, setReminders] = useState<ReminderDocument[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<ReminderType | "all">("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [formAppId, setFormAppId] = useState("");
  const [formType, setFormType] = useState<ReminderType>("interview");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formMessage, setFormMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !user) {
      navigate({ to: "/login" });
      return;
    }
    if (user) {
      void loadData(user.id);
    }
  }, [user, isAuthenticated, navigate]);

  const loadData = async (userId: string) => {
    try {
      const [apps, rems] = await Promise.all([
        getApplications(userId),
        getReminders(userId),
      ]);
      setApplications(apps);
      setReminders(rems);
      if (apps.length > 0 && !formAppId) {
        setFormAppId(apps[0]?.id || "");
      }
    } catch {
      toast.error("Failed to load calendar events.");
    }
  };

  const appMap = useMemo(() => {
    const map = new Map<string, ApplicationDocument>();
    applications.forEach((a) => map.set(a.id, a));
    return map;
  }, [applications]);

  const calendarEvents = useMemo(() => {
    const list: Array<{
      id: string;
      dateStr: string;
      date: Date;
      type: ReminderType;
      title: string;
      company: string;
      applicationId?: string;
      isCompleted: boolean;
      originalReminderId?: string;
    }> = [];

    reminders.forEach((r) => {
      const app = r.applicationId ? appMap.get(r.applicationId) : undefined;
      const parsedDate = r.reminderDate.includes("T") ? parseISO(r.reminderDate) : new Date(r.reminderDate);
      list.push({
        id: r.id,
        dateStr: format(parsedDate, "yyyy-MM-dd"),
        date: parsedDate,
        type: r.type,
        title: r.message || `${app?.company || "Company"} — ${r.type.toUpperCase()}`,
        company: app?.company || "Application",
        applicationId: r.applicationId,
        isCompleted: r.isCompleted,
        originalReminderId: r.id,
      });
    });

    applications.forEach((a) => {
      if (a.followUpDate) {
        const parsedDate = new Date(a.followUpDate);
        const exists = list.some((e) => e.applicationId === a.id && e.dateStr === a.followUpDate);
        if (!exists) {
          const type: ReminderType = a.status === "Interview" ? "interview" : "follow-up";
          list.push({
            id: `app-fu-${a.id}`,
            dateStr: a.followUpDate,
            date: parsedDate,
            type,
            title: a.status === "Interview" ? `${a.company} — Scheduled Interview` : `${a.company} — Process Follow-up`,
            company: a.company,
            applicationId: a.id,
            isCompleted: false,
          });
        }
      }
    });

    return list;
  }, [reminders, applications, appMap]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const filteredEvents = useMemo(() => {
    if (filterType === "all") return calendarEvents;
    return calendarEvents.filter((e) => e.type === filterType);
  }, [calendarEvents, filterType]);

  const selectedDayEvents = useMemo(() => {
    const targetStr = format(selectedDate, "yyyy-MM-dd");
    return filteredEvents.filter((e) => e.dateStr === targetStr);
  }, [filteredEvents, selectedDate]);

  const getTypeStyle = (type: ReminderType) => {
    switch (type) {
      case "interview":
        return {
          bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
          border: "border-emerald-500/30",
          text: "text-emerald-600 dark:text-emerald-400",
          dot: "bg-emerald-500",
          label: "Interview Scheduled",
          icon: Video,
        };
      case "follow-up":
        return {
          bg: "bg-blue-500/15 dark:bg-blue-500/20",
          border: "border-blue-500/30",
          text: "text-blue-600 dark:text-blue-400",
          dot: "bg-blue-500",
          label: "Recruiter Follow-up",
          icon: Clock,
        };
      case "deadline":
        return {
          bg: "bg-amber-500/15 dark:bg-amber-500/20",
          border: "border-amber-500/30",
          text: "text-amber-600 dark:text-amber-400",
          dot: "bg-amber-500",
          label: "Assessment / Deadline",
          icon: AlertCircle,
        };
      case "application-update":
        return {
          bg: "bg-purple-500/15 dark:bg-purple-500/20",
          border: "border-purple-500/30",
          text: "text-purple-600 dark:text-purple-400",
          dot: "bg-purple-500",
          label: "Status / Offer Update",
          icon: FileCheck,
        };
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formAppId || !formDate) return;

    setIsSubmitting(true);
    try {
      const newRem = await createReminder(user.id, {
        applicationId: formAppId,
        type: formType,
        reminderDate: formDate,
        message: formMessage.trim() || undefined,
      });

      setReminders((prev) => [newRem, ...prev]);
      toast.success("Event scheduled on your calendar!");
      setShowAddForm(false);
      setFormMessage("");
    } catch {
      toast.error("Failed to add event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (reminderId: string) => {
    if (!user) return;
    try {
      await deleteReminder(user.id, reminderId);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
      toast.success("Event removed.");
    } catch {
      toast.error("Failed to remove event.");
    }
  };

  const handleComplete = async (reminderId: string) => {
    if (!user) return;
    try {
      await markReminderComplete(user.id, reminderId);
      setReminders((prev) =>
        prev.map((r) => (r.id === reminderId ? { ...r, isCompleted: true } : r))
      );
      toast.success("Marked as completed!");
    } catch {
      toast.error("Failed to update status.");
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfcfd] dark:bg-[#0b0f17] text-foreground flex flex-col md:flex-row antialiased selection:bg-primary/20">
      <DashboardSidebar />

      <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto overflow-y-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <CalendarIcon size={14} /> Color-Coded Schedule
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Interview & Process Timeline
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keep track of scheduled interviews (🟢), follow-ups (🔵), assessment deadlines (🟠), and offers (🟣).
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-95"
          >
            <Plus size={15} />
            Schedule Event
          </button>
        </div>

        {/* Legend bar & Month Nav */}
        <div className="px-5 py-3 rounded-2xl border border-border/80 bg-white dark:bg-[#111622] flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-semibold text-[11px] uppercase tracking-wider mr-1">
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setFilterType(filterType === "interview" ? "all" : "interview")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                filterType === "interview"
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Interviews ({calendarEvents.filter((e) => e.type === "interview").length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType(filterType === "follow-up" ? "all" : "follow-up")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                filterType === "follow-up"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Follow-ups ({calendarEvents.filter((e) => e.type === "follow-up").length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType(filterType === "deadline" ? "all" : "deadline")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                filterType === "deadline"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Deadlines ({calendarEvents.filter((e) => e.type === "deadline").length})
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-secondary transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 rounded-lg border border-border bg-background hover:bg-secondary"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-foreground px-2 min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 rounded-lg border border-border bg-background hover:bg-secondary"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Matrix Grid + Side Agenda */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 2 Cols: Monthly Matrix */}
          <div className="lg:col-span-2 rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-5 shadow-xs flex flex-col">
            <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-2 flex-1 min-h-[420px]">
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayEvents = filteredEvents.filter((e) => e.dateStr === dateStr);
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[74px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs"
                        : today
                        ? "border-primary/50 bg-secondary/50"
                        : isCurrentMonth
                        ? "border-border/70 bg-background/50 hover:border-primary/40 hover:bg-secondary/30"
                        : "border-border/30 opacity-40 bg-secondary/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold leading-none ${
                          today
                            ? "h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px]"
                            : isSelected
                            ? "text-primary"
                            : "text-foreground/90"
                        }`}
                      >
                        {format(day, "d")}
                      </span>

                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-0.5 mt-1">
                      {dayEvents.slice(0, 2).map((ev) => {
                        const style = getTypeStyle(ev.type);
                        return (
                          <div
                            key={ev.id}
                            className={`truncate rounded px-1 py-0.5 text-[9px] font-semibold border ${style.bg} ${style.border} ${style.text}`}
                            title={`${ev.company} — ${ev.title}`}
                          >
                            {ev.company}
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <span className="text-[8px] font-bold text-muted-foreground pl-0.5">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 1 Col: Selected Day Agenda & Form */}
          <div className="rounded-2xl border border-border/80 bg-white dark:bg-[#111622] p-5 shadow-xs flex flex-col space-y-4">
            <div className="pb-3 border-b border-border/70 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {format(selectedDate, "EEEE, MMMM d")}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {selectedDayEvents.length} scheduled event(s)
                </p>
              </div>
              {isToday(selectedDate) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Today
                </span>
              )}
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs my-auto">
                <CalendarIcon size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-semibold text-foreground">No events on this day</p>
                <p className="text-[11px] mt-0.5">Click 'Schedule Event' to add an interview or deadline.</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
                {selectedDayEvents.map((ev) => {
                  const style = getTypeStyle(ev.type);
                  const Icon = style.icon;

                  return (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-xl border ${style.border} ${style.bg} space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.text} bg-background/80`}
                        >
                          <Icon size={11} /> {style.label}
                        </span>

                        {ev.originalReminderId && (
                          <div className="flex items-center gap-1">
                            {!ev.isCompleted && (
                              <button
                                type="button"
                                onClick={() => handleComplete(ev.originalReminderId!)}
                                className="p-1 text-muted-foreground hover:text-emerald-500"
                                title="Mark done"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(ev.originalReminderId!)}
                              className="p-1 text-muted-foreground hover:text-rose-500"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                          <Building2 size={12} className="text-muted-foreground" /> {ev.company}
                        </h4>
                        <p className="text-xs text-foreground/90 font-medium mt-0.5">
                          {ev.title}
                        </p>
                      </div>

                      {ev.applicationId && (
                        <Link
                          to="/applications/$applicationId"
                          params={{ applicationId: ev.applicationId }}
                          className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1 pt-1"
                        >
                          View Application <ExternalLink size={11} />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Add Form Drawer */}
            {showAddForm && (
              <div className="pt-3 border-t border-border/70 animate-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Sparkles size={12} className="text-primary" /> Schedule Event
                  </h4>
                  <button onClick={() => setShowAddForm(false)} className="p-1 text-muted-foreground">
                    <X size={13} />
                  </button>
                </div>

                <form onSubmit={handleCreateReminder} className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">Company</label>
                    <select
                      value={formAppId}
                      onChange={(e) => setFormAppId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-input bg-background p-1.5 text-xs text-foreground focus:outline-none"
                    >
                      {applications.map((a) => (
                        <option key={a.id} value={a.id}>{a.company} — {a.jobTitle}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">Event Type</label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as ReminderType)}
                        className="w-full rounded-lg border border-input bg-background p-1.5 text-xs text-foreground focus:outline-none"
                      >
                        <option value="interview">🟢 Interview</option>
                        <option value="follow-up">🔵 Follow-up</option>
                        <option value="deadline">🟠 Deadline</option>
                        <option value="application-update">🟣 Update</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">Date</label>
                      <input
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background p-1.5 text-xs text-foreground focus:outline-none [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Technical System Design screening on Zoom"
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background p-1.5 text-xs text-foreground focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 py-1 rounded-lg border border-border text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-1 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow"
                    >
                      {isSubmitting ? "Saving..." : "Save Event"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
