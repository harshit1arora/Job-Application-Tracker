import { useState, useEffect } from "react";
import type { NextBestAction } from "@/lib/career-intelligence";
import { executeActionCompletion } from "@/lib/career-intelligence";
import { type UserProfile, EMPTY_PROFILE } from "@/lib/profile";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Target,
  X,
  FileCheck2,
  BookOpen,
  Loader2,
  Code2,
} from "lucide-react";
import { toast } from "sonner";

interface NextBestActionCardProps {
  action: NextBestAction;
  profile?: UserProfile | undefined;
  userId?: string | undefined;
  onActionCompleted?: (() => void) | undefined;
  onStartTask?: ((action: NextBestAction) => void) | undefined;
}

export function NextBestActionCard({
  action,
  profile,
  userId,
  onActionCompleted,
  onStartTask,
}: NextBestActionCardProps) {
  const [isCompleted, setIsCompleted] = useState(action.completed);
  const [showMicroTaskModal, setShowMicroTaskModal] = useState(false);
  const [taskNote, setTaskNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state if action completed status changes
  useEffect(() => {
    setIsCompleted(action.completed);
  }, [action.completed, action.id]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showMicroTaskModal) {
        setShowMicroTaskModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMicroTaskModal]);

  const handleMarkComplete = () => {
    if (isCompleted || isSubmitting) return;

    if (!userId) {
      setIsCompleted(true);
      toast.success("Action marked complete.");
      onActionCompleted?.();
      return;
    }

    const currentProfile = profile || EMPTY_PROFILE;
    const res = executeActionCompletion(userId, action, currentProfile);

    if (!res.success) {
      toast.error(res.message);
      if (onStartTask) {
        onStartTask(action);
      }
      return;
    }

    setIsCompleted(true);
    toast.success(res.message);
    onActionCompleted?.();
  };

  const handleStartTaskClick = () => {
    if (onStartTask) {
      onStartTask(action);
      return;
    }

    // Default built-in handling if onStartTask is not provided:
    if (action.actionType === "IMPROVE_SKILL") {
      setShowMicroTaskModal(true);
    } else {
      handleMarkComplete();
    }
  };

  const submitMicroTask = () => {
    if (isSubmitting || !userId) return;
    setIsSubmitting(true);

    try {
      const currentProfile = profile || EMPTY_PROFILE;
      const res = executeActionCompletion(userId, action, currentProfile, {
        skillNote: taskNote.trim() || action.suggestedTask,
      });

      if (!res.success) {
        toast.error(res.message);
      } else {
        setIsCompleted(true);
        setShowMicroTaskModal(false);
        setTaskNote("");
        toast.success(res.message);
        onActionCompleted?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-5 sm:p-6 shadow-sm">
        {/* Decorative subtle accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                <Target size={13} /> Your Next Best Action
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-md border border-border">
                <Clock size={12} /> ~{action.effortMinutes} mins effort
              </span>

              {action.estimatedImpact !== undefined && action.estimatedImpact > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  <TrendingUp size={12} /> Projected Impact: ~+{action.estimatedImpact} readiness
                  pts
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
              → {action.title}
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Why it matters:</strong> {action.reason}
            </p>

            <div className="p-3 rounded-xl bg-background/80 border border-border text-xs text-foreground">
              <span className="font-bold text-primary mr-1">Suggested Micro-Task:</span>
              {action.suggestedTask}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 justify-center">
            {!isCompleted && (
              <button
                type="button"
                onClick={handleStartTaskClick}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer disabled:opacity-50"
              >
                Start Task <ArrowRight size={13} />
              </button>
            )}

            <button
              type="button"
              onClick={handleMarkComplete}
              disabled={isCompleted || isSubmitting}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isCompleted
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 cursor-default"
                  : "border-border bg-secondary hover:bg-secondary/80 text-foreground"
              }`}
            >
              <CheckCircle2 size={13} className={isCompleted ? "text-emerald-500" : ""} />
              {isCompleted ? "Completed ✓" : "Mark Complete"}
            </button>
          </div>
        </div>
      </div>

      {/* Micro-Task Completion Modal (for IMPROVE_SKILL) */}
      {showMicroTaskModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="micro-task-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMicroTaskModal(false);
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Code2 size={18} />
                </span>
                <div>
                  <h3 id="micro-task-modal-title" className="text-base font-bold text-foreground">
                    Record Practical Skill Evidence
                  </h3>
                  <p className="text-xs text-muted-foreground">{action.targetSkill} Micro-Task</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMicroTaskModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-secondary/40 border border-border">
                <span className="font-semibold text-foreground block mb-1">
                  Recommended Objective:
                </span>
                <p className="text-muted-foreground leading-relaxed">{action.suggestedTask}</p>
              </div>

              <div>
                <label
                  htmlFor="micro-task-note"
                  className="block font-semibold text-foreground mb-1"
                >
                  Practical Notes or Link (Optional):
                </label>
                <textarea
                  id="micro-task-note"
                  rows={3}
                  value={taskNote}
                  onChange={(e) => setTaskNote(e.target.value)}
                  placeholder="e.g. Created Dockerfile with multi-stage build; tested container locally on port 3000; repo link: github.com/..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowMicroTaskModal(false)}
                className="px-4 py-2 rounded-xl border border-border bg-secondary text-xs font-semibold hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitMicroTask}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Saving Evidence...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} /> Complete & Record Proof
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
