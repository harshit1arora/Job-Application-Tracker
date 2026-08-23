import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { ApplicationDocument, ReminderDocument, ReminderType } from "@/lib/types";
import { createReminder, deleteReminder, markReminderComplete } from "@/lib/reminders-service";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Building2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Trash2,
  CalendarCheck,
  Video,
  FileCheck,
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

interface InterviewCalendarModalProps {
  userId: string;
  applications: ApplicationDocument[];
  reminders: ReminderDocument[];
  onRemindersUpdated: (updated: ReminderDocument[]) => void;
  onClose: () => void;
}

export function InterviewCalendarModal({
  userId,
  applications,
  reminders,
  onRemindersUpdated,
  onClose,
}: InterviewCalendarModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<ReminderType | "all">("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State for Quick-Add
  const [formAppId, setFormAppId] = useState(applications[0]?.id || "");
  const [formType, setFormType] = useState<ReminderType>("interview");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formMessage, setFormMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map Applications by ID
  const appMap = useMemo(() => {
    const map = new Map<string, ApplicationDocument>();
    applications.forEach((a) => map.set(a.id, a));
    return map;
  }, [applications]);

  // Merge Reminders + Application FollowUp Dates into unified Calendar Events
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

    // 1. Explicit Reminders
    reminders.forEach((r) => {
      const app = r.applicationId ? appMap.get(r.applicationId) : undefined;
      const parsedDate = r.reminderDate.includes("T") ? parseISO(r.reminderDate) : new Date(r.reminderDate);
      list.push({
        id: r.id,
        dateStr: format(parsedDate, "yyyy-MM-dd"),
        date: parsedDate,
        type: r.type,
        title: r.message || `${app?.company || "Company"} — ${r.type.toUpperCase()}`,
        company: app?.company || "Career Application",
        applicationId: r.applicationId,
        isCompleted: r.isCompleted,
        originalReminderId: r.id,
      });
    });

    // 2. Application Follow-Up Dates
    applications.forEach((a) => {
      if (a.followUpDate) {
        const parsedDate = new Date(a.followUpDate);
        // Only add if not duplicate
        const exists = list.some((e) => e.applicationId === a.id && e.dateStr === a.followUpDate);
        if (!exists) {
          const type: ReminderType = a.status === "Interview" ? "interview" : "follow-up";
          list.push({
            id: `app-fu-${a.id}`,
            dateStr: a.followUpDate,
            date: parsedDate,
            type,
            title: a.status === "Interview" ? `${a.company} — Interview Round` : `${a.company} — Next Process & Follow-up`,
            company: a.company,
            applicationId: a.id,
            isCompleted: false,
          });
        }
      }
    });

    return list;
  }, [reminders, applications, appMap]);

  // Calendar Day Generation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (filterType === "all") return calendarEvents;
    return calendarEvents.filter((e) => e.type === filterType);
  }, [calendarEvents, filterType]);

  // Events for Selected Day
  const selectedDayEvents = useMemo(() => {
    const targetStr = format(selectedDate, "yyyy-MM-dd");
    return filteredEvents.filter((e) => e.dateStr === targetStr);
  }, [filteredEvents, selectedDate]);

  // Helper color map
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
    if (!formAppId || !formDate) {
      toast.error("Please choose a company application and date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newRem = await createReminder(userId, {
        applicationId: formAppId,
        type: formType,
        reminderDate: formDate,
        message: formMessage.trim() || undefined,
      });

      onRemindersUpdated([newRem, ...reminders]);
      toast.success("Scheduled event added to your calendar!");
      setShowAddForm(false);
      setFormMessage("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add reminder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (reminderId: string) => {
    try {
      await deleteReminder(userId, reminderId);
      onRemindersUpdated(reminders.filter((r) => r.id !== reminderId));
      toast.success("Event removed.");
    } catch {
      toast.error("Failed to delete event.");
    }
  };

  const handleComplete = async (reminderId: string) => {
    try {
      await markReminderComplete(userId, reminderId);
      onRemindersUpdated(
        reminders.map((r) => (r.id === reminderId ? { ...r, isCompleted: true } : r))
      );
      toast.success("Marked event as completed!");
    } catch {
      toast.error("Failed to update status.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-primary/10 via-card to-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <CalendarIcon size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                Interview & Application Timeline Calendar
              </h2>
              <p className="text-xs text-muted-foreground">
                Track scheduled interviews (🟢), follow-ups (🔵), assessment deadlines (🟠), and offer updates (🟣)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-95 transition-opacity"
            >
              <Plus size={14} />
              Schedule Event
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:bg-secondary rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Color Legend Bar */}
        <div className="px-5 py-3 border-b border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground font-semibold text-[11px] uppercase tracking-wider mr-1">
              Legend:
            </span>
            <button
              type="button"
              onClick={() => setFilterType(filterType === "interview" ? "all" : "interview")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                filterType === "interview"
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
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
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
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
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Deadlines ({calendarEvents.filter((e) => e.type === "deadline").length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType(filterType === "application-update" ? "all" : "application-update")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                filterType === "application-update"
                  ? "bg-purple-500 text-white border-purple-500"
                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Offers & Updates ({calendarEvents.filter((e) => e.type === "application-update").length})
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
              className="p-1 rounded-lg border border-border bg-background hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-foreground px-2 min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 rounded-lg border border-border bg-background hover:bg-secondary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Calendar Body: Grid + Day Detail Drawer */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3">
          {/* Monthly Matrix (2 Columns on Large) */}
          <div className="lg:col-span-2 p-4 sm:p-5 border-r border-border flex flex-col">
            {/* Weekdays Header */}
            <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Day Cells Grid */}
            <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-[380px]">
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
                    className={`min-h-[64px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : today
                        ? "border-primary/50 bg-secondary/40"
                        : isCurrentMonth
                        ? "border-border/70 bg-background hover:border-primary/40 hover:bg-secondary/20"
                        : "border-border/30 bg-secondary/10 opacity-40"
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

                    {/* Color dot/chip indicators */}
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

          {/* Selected Day Agenda Drawer */}
          <div className="p-5 bg-card/60 flex flex-col h-full overflow-y-auto">
            <div className="pb-3 border-b border-border mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {format(selectedDate, "EEEE, MMMM d")}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {selectedDayEvents.length} scheduled event(s) for this day
                </p>
              </div>

              {isToday(selectedDate) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Today
                </span>
              )}
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="my-auto text-center py-10 text-muted-foreground text-xs">
                <CalendarCheck size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium text-foreground">No events on this day</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Click "Schedule Event" to add an interview round, follow-up, or deadline.
                </p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {selectedDayEvents.map((ev) => {
                  const style = getTypeStyle(ev.type);
                  const Icon = style.icon;

                  return (
                    <div
                      key={ev.id}
                      className={`p-3.5 rounded-xl border ${style.border} ${style.bg} transition-all space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.text} bg-background/80`}
                        >
                          <Icon size={12} />
                          {style.label}
                        </span>

                        {ev.originalReminderId && (
                          <div className="flex items-center gap-1">
                            {!ev.isCompleted && (
                              <button
                                type="button"
                                onClick={() => handleComplete(ev.originalReminderId!)}
                                className="p-1 text-muted-foreground hover:text-emerald-500 transition-colors"
                                title="Mark as completed"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(ev.originalReminderId!)}
                              className="p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                              title="Delete event"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Building2 size={13} className="text-muted-foreground" />
                          {ev.company}
                        </h4>
                        <p className="text-xs text-foreground/90 mt-0.5 leading-relaxed font-medium">
                          {ev.title}
                        </p>
                      </div>

                      {ev.applicationId && (
                        <div className="pt-1">
                          <Link
                            to="/applications/$applicationId"
                            params={{ applicationId: ev.applicationId }}
                            className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1"
                          >
                            View Application Dossier <ExternalLink size={11} />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Add Form Drawer in Sidebar */}
            {showAddForm && (
              <div className="mt-4 p-4 rounded-xl border border-border bg-card shadow-lg animate-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles size={13} className="text-primary" /> Schedule Interview / Event
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="p-1 text-muted-foreground hover:bg-secondary rounded"
                  >
                    <X size={14} />
                  </button>
                </div>

                <form onSubmit={handleCreateReminder} className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      Target Company
                    </label>
                    <select
                      value={formAppId}
                      onChange={(e) => setFormAppId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                    >
                      {applications.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.company} — {app.jobTitle}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                        Event Type
                      </label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as ReminderType)}
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                      >
                        <option value="interview">🟢 Interview</option>
                        <option value="follow-up">🔵 Follow-up</option>
                        <option value="deadline">🟠 Deadline</option>
                        <option value="application-update">🟣 Offer / Update</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        required
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      Event Notes / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Technical Round with Engineering Manager"
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-1.5 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:opacity-90 shadow"
                    >
                      {isSubmitting ? "Saving..." : "Save Event"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
