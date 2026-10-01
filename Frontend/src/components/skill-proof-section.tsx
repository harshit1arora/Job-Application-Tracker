import { useState, useEffect } from "react";
import type { SkillProof, SkillVerificationChallenge, SkillVerificationEvaluation } from "@/lib/career-intelligence";
import {
  generateSkillChallenge,
  evaluateSkillVerificationAnswer,
  saveStoredSkillVerification,
  markActionCompletedInStorage,
  normalizeSkill,
} from "@/lib/career-intelligence";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Award,
  BookOpen,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface SkillProofSectionProps {
  skillProofs: SkillProof[];
  userId?: string | undefined;
  onVerificationCompleted?: (() => void) | undefined;
}

export function SkillProofSection({
  skillProofs,
  userId,
  onVerificationCompleted,
}: SkillProofSectionProps) {
  const [activeChallengeSkill, setActiveChallengeSkill] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<SkillVerificationChallenge | null>(null);
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<SkillVerificationEvaluation | null>(null);

  // Handle ESC key to close challenge modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeChallengeSkill) {
        closeChallengeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeChallengeSkill]);

  const startChallenge = async (skill: string) => {
    if (isLoadingChallenge) return;
    setActiveChallengeSkill(skill);
    setEvaluationResult(null);
    setCandidateAnswer("");
    setIsLoadingChallenge(true);

    try {
      const q = await generateSkillChallenge(skill);
      setChallenge(q);
    } catch {
      toast.error("Failed to generate challenge. Try again.");
      setActiveChallengeSkill(null);
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  const handleEvaluateAnswer = async () => {
    if (!challenge || !activeChallengeSkill || !candidateAnswer.trim() || isEvaluating) return;
    setIsEvaluating(true);

    try {
      const res = await evaluateSkillVerificationAnswer(
        activeChallengeSkill,
        challenge,
        candidateAnswer
      );
      setEvaluationResult(res);

      if (userId) {
        saveStoredSkillVerification(
          userId,
          activeChallengeSkill,
          res.score,
          res.passed ? "passed" : "failed"
        );
        if (res.passed) {
          markActionCompletedInStorage(userId, `act-verify-${normalizeSkill(activeChallengeSkill)}`);
        }
      }

      if (res.passed) {
        toast.success(`Skill Verified: ${activeChallengeSkill} (${res.score}/100)`);
      } else {
        toast.warning(`${activeChallengeSkill} verification did not pass. Review feedback below.`);
      }

      onVerificationCompleted?.();
    } catch {
      toast.error("Failed to evaluate verification response.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const closeChallengeModal = () => {
    setActiveChallengeSkill(null);
    setChallenge(null);
    setEvaluationResult(null);
    setCandidateAnswer("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase tracking-wider">
            <ShieldCheck size={14} /> Evidence-Based Skill Proof
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Moves beyond unverified claims: audits résumé mentions, candidate project repos, micro-tasks, and technical verification.
          </p>
        </div>
      </div>

      {/* Skills Evidence Table / Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {skillProofs.map((item) => {
          let scoreBadgeColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
          if (item.score < 50) {
            scoreBadgeColor = "text-rose-500 bg-rose-500/10 border-rose-500/20";
          } else if (item.score < 75) {
            scoreBadgeColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
          }

          return (
            <div
              key={item.skill}
              className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-xs hover:border-primary/30 transition-colors"
            >
              {/* Header: Skill Name & Score */}
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-foreground">{item.skill}</span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${scoreBadgeColor}`}>
                  {item.score} / 100
                </span>
              </div>

              {/* Status Ladder: Claimed -> Supported -> Verified */}
              <div className="flex items-center gap-1.5 text-[10px] font-bold">
                <span
                  className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                    item.claimed
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  Claimed {item.claimed ? "✓" : "✗"}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                    item.supported
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  Supported {item.supported ? "✓" : "⚠"}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                    item.verified
                      ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  Verified {item.verified ? "✓" : "✗"}
                </span>
              </div>

              {/* Evidence Details */}
              <div className="space-y-1 text-xs text-muted-foreground border-t border-border/60 pt-2">
                {item.evidence.notes.map((note, idx) => (
                  <p key={idx} className="flex items-start gap-1 leading-snug">
                    <span className="text-primary font-bold">•</span>
                    <span>{note}</span>
                  </p>
                ))}
              </div>

              {/* Action: Verify Skill Challenge */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground">
                  {item.verified
                    ? "Verified via challenge"
                    : item.evidence.verificationStatus === "failed"
                    ? "Failed previous challenge"
                    : "Unverified claim"}
                </span>

                <button
                  type="button"
                  onClick={() => startChallenge(item.skill)}
                  disabled={isLoadingChallenge}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={11} />
                  {item.verified ? "Retake Challenge" : "Take 1-Question Verification"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 1-Question Skill Verification Challenge Modal */}
      {activeChallengeSkill && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="challenge-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeChallengeModal();
          }}
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <h3 id="challenge-modal-title" className="text-base font-bold text-foreground">
                    Technical Verification Challenge
                  </h3>
                  <p className="text-xs text-muted-foreground">Skill: {activeChallengeSkill}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeChallengeModal}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
                aria-label="Close challenge modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            {isLoadingChallenge ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-center">
                <Loader2 size={24} className="animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">
                  Generating verified technical scenario for {activeChallengeSkill}...
                </p>
              </div>
            ) : challenge ? (
              <div className="space-y-4 text-xs">
                {/* Scenario & Question Box */}
                <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
                  <span className="font-bold text-primary uppercase tracking-wider text-[10px]">
                    Technical Scenario
                  </span>
                  <p className="text-muted-foreground leading-relaxed">{challenge.scenario}</p>

                  <span className="font-bold text-foreground uppercase tracking-wider text-[10px] block pt-1">
                    Question
                  </span>
                  <p className="text-sm font-bold text-foreground leading-relaxed">{challenge.question}</p>
                </div>

                {/* Candidate Answer Box */}
                {!evaluationResult ? (
                  <div className="space-y-3">
                    <label htmlFor="challenge-answer-input" className="block font-semibold text-foreground">
                      Your Technical Approach:
                    </label>
                    <textarea
                      id="challenge-answer-input"
                      rows={4}
                      value={candidateAnswer}
                      onChange={(e) => setCandidateAnswer(e.target.value)}
                      placeholder="Explain how you would investigate, architect, and resolve this scenario..."
                      className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={closeChallengeModal}
                        className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleEvaluateAnswer}
                        disabled={isEvaluating || !candidateAnswer.trim()}
                        className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-xl flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {isEvaluating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        Submit & Evaluate Evidence
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2 border-t border-border">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                      <span className="font-bold text-foreground">Evidence Strength Result</span>
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                          evaluationResult.passed
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {evaluationResult.score}/100 — {evaluationResult.passed ? "Passed ✓" : "Needs Review"}
                      </span>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">{evaluationResult.feedback}</p>

                    {evaluationResult.positivePoints.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">Strengths Demonstrated:</p>
                        {evaluationResult.positivePoints.map((pt, i) => (
                          <p key={i} className="text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> {pt}
                          </p>
                        ))}
                      </div>
                    )}

                    {evaluationResult.improvementPoints.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-bold text-amber-600 dark:text-amber-400">Growth Opportunities:</p>
                        {evaluationResult.improvementPoints.map((pt, i) => (
                          <p key={i} className="text-muted-foreground flex items-center gap-1.5">
                            <span className="text-amber-500 font-bold shrink-0">•</span> {pt}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={closeChallengeModal}
                        className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 rounded-xl cursor-pointer"
                      >
                        Done & Update Proof Score
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
