import { useState, useEffect } from "react";
import type {
  CareerTwinLiteState,
  InterviewQuestionItem,
  InterviewEvaluationResult,
} from "@/lib/career-intelligence";
import {
  generateCandidateSpecificInterviewSimulation,
  evaluateInterviewSimulationAnswer,
  saveStoredInterviewPerformance,
  markActionCompletedInStorage,
} from "@/lib/career-intelligence";
import type { UserProfile } from "@/lib/profile";
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  HelpCircle,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  X,
  Award,
} from "lucide-react";
import { toast } from "sonner";

interface CareerTwinLiteSectionProps {
  careerTwin: CareerTwinLiteState;
  profile: UserProfile;
  job: {
    id: string;
    role: string;
    company: string;
    description?: string | undefined;
    requiredSkills: string[];
    experienceLevel?: string | undefined;
  };
  userId?: string | undefined;
  onInterviewCompleted?: (() => void) | undefined;
}

export function CareerTwinLiteSection({
  careerTwin,
  profile,
  job,
  userId,
  onInterviewCompleted,
}: CareerTwinLiteSectionProps) {
  const [showSimModal, setShowSimModal] = useState(false);
  const [questions, setQuestions] = useState<InterviewQuestionItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [isLoadingSim, setIsLoadingSim] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<InterviewEvaluationResult | null>(null);

  // Handle ESC key to close simulation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSimModal) {
        setShowSimModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSimModal]);

  const startSimulation = async () => {
    if (isLoadingSim) return;
    setShowSimModal(true);
    setCurrentIdx(0);
    setCandidateAnswer("");
    setEvaluation(null);
    setIsLoadingSim(true);

    try {
      const qList = await generateCandidateSpecificInterviewSimulation(profile, job, careerTwin);
      setQuestions(qList);
    } catch {
      toast.error("Failed to load interview simulation.");
      setShowSimModal(false);
    } finally {
      setIsLoadingSim(false);
    }
  };

  const submitAnswer = async () => {
    const q = questions[currentIdx];
    if (!q || !candidateAnswer.trim() || isEvaluating) return;

    setIsEvaluating(true);
    try {
      const res = await evaluateInterviewSimulationAnswer(q, candidateAnswer);
      setEvaluation(res);
      toast.success(`Evaluated question ${currentIdx + 1}!`);
    } catch {
      toast.error("Failed to evaluate answer.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const nextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
      setCandidateAnswer("");
      setEvaluation(null);
    } else {
      setShowSimModal(false);
      if (userId && evaluation) {
        saveStoredInterviewPerformance(userId, {
          jobId: job.id,
          score: evaluation.score,
          completedAt: new Date().toISOString(),
          evaluatedTopics: questions.map((q) => q.targetSkillOrTopic),
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
        });
        markActionCompletedInStorage(userId, `act-interview-${job.id}`);
      }
      toast.success("Interview simulation completed and saved to Career Twin!");
      onInterviewCompleted?.();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Role Fit Ring */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl bg-violet-500/5 dark:bg-violet-950/20 border border-violet-500/20">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
            <Bot size={14} /> Career Twin Lite — Structured Candidate State
          </div>
          <h3 className="text-base font-extrabold text-foreground mt-0.5">
            Role Fit: {careerTwin.roleFitScore} / 100 for {job.role}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Living interpretation mapping your projects ({careerTwin.projects.length}) and{" "}
            {careerTwin.experienceYears}+ YOE to {job.company}'s requirements.
          </p>
        </div>

        <button
          type="button"
          onClick={startSimulation}
          disabled={isLoadingSim}
          className="px-3.5 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all shadow-md shadow-violet-500/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {isLoadingSim ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Simulate My Interview
        </button>
      </div>

      {/* Verified Interview Performance Card if completed */}
      {careerTwin.interviewPerformance && (
        <div className="p-4 rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-500/5 via-transparent to-transparent space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Award size={14} /> Recent Mock Interview Performance
            </span>
            <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
              {careerTwin.interviewPerformance.score} / 100
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Completed on{" "}
            {new Date(careerTwin.interviewPerformance.completedAt).toLocaleDateString()} covering
            topics:{" "}
            <strong className="text-foreground">
              {careerTwin.interviewPerformance.evaluatedTopics.join(", ")}
            </strong>
            .
          </p>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border border-border bg-card">
          <p className="font-bold text-foreground mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={13} /> Strong Candidate Areas
          </p>
          <ul className="space-y-1.5">
            {careerTwin.strengths.map((str, idx) => (
              <li key={idx} className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="text-emerald-500 font-bold">✓</span> {str}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card">
          <p className="font-bold text-foreground mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <AlertTriangle size={13} /> Gaps & Evidence Building Areas
          </p>
          <ul className="space-y-1.5">
            {careerTwin.weaknesses.map((wk, idx) => (
              <li key={idx} className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="text-amber-500 font-bold">⚠</span> {wk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Likely Interview Topics */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <MessageSquare size={14} className="text-primary" /> Likely Technical Interview Areas
          </span>
          <span className="text-[10px] text-muted-foreground">Tailored to {job.company} stack</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {careerTwin.likelyInterviewAreas.map((area, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-lg bg-secondary text-foreground text-xs font-semibold border border-border"
            >
              {i + 1}. {area}
            </span>
          ))}
        </div>
      </div>

      {/* Interview Simulation Modal */}
      {showSimModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="simulation-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSimModal(false);
          }}
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Bot size={18} />
                </span>
                <div>
                  <h3 id="simulation-modal-title" className="text-base font-bold text-foreground">
                    Candidate-Specific Technical Simulation
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {job.role} @ {job.company}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {isLoadingSim ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-center">
                <Loader2 size={24} className="animate-spin text-violet-600" />
                <p className="text-xs text-muted-foreground">
                  Synthesizing interview questions based on your projects and evidence profile...
                </p>
              </div>
            ) : questions.length > 0 ? (
              <div className="space-y-4 text-xs">
                {/* Question Header & Context */}
                <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-violet-600 dark:text-violet-400 uppercase tracking-wider text-[11px]">
                      Question {currentIdx + 1} of {questions.length}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-foreground font-semibold border border-border">
                      Topic: {questions[currentIdx]?.targetSkillOrTopic}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-foreground leading-relaxed">
                    "{questions[currentIdx]?.question}"
                  </p>

                  <p className="text-[11px] text-muted-foreground italic">
                    <strong>Interviewer Context:</strong> {questions[currentIdx]?.context}
                  </p>
                </div>

                {/* Candidate Answer Box */}
                {!evaluation ? (
                  <div className="space-y-3">
                    <label
                      htmlFor="interview-answer-input"
                      className="block font-semibold text-foreground"
                    >
                      Your Technical Answer:
                    </label>
                    <textarea
                      id="interview-answer-input"
                      rows={5}
                      value={candidateAnswer}
                      onChange={(e) => setCandidateAnswer(e.target.value)}
                      placeholder="Explain your approach, architecture decisions, trade-offs, and metrics..."
                      className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all resize-none"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Tip: Mention trade-offs, latency, caching, and testing strategies.
                      </span>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={submitAnswer}
                          disabled={isEvaluating || !candidateAnswer.trim()}
                          className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-violet-500/20 cursor-pointer"
                        >
                          {isEvaluating ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Send size={13} />
                          )}
                          Evaluate Response
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2 border-t border-border">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                      <span className="font-bold text-foreground">
                        Interview Coaching Evaluation
                      </span>
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                        {evaluation.score}/100 Performance
                      </span>
                    </div>

                    <p className="text-muted-foreground leading-relaxed">{evaluation.feedback}</p>

                    {evaluation.strengths.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                          Response Strengths:
                        </p>
                        {evaluation.strengths.map((st, i) => (
                          <p key={i} className="text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> {st}
                          </p>
                        ))}
                      </div>
                    )}

                    {evaluation.improvements.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-bold text-amber-600 dark:text-amber-400">
                          Coaching Improvements:
                        </p>
                        {evaluation.improvements.map((imp, i) => (
                          <p key={i} className="text-muted-foreground flex items-center gap-1.5">
                            <span className="text-amber-500 font-bold shrink-0">•</span> {imp}
                          </p>
                        ))}
                      </div>
                    )}

                    {evaluation.suggestedFollowUp && (
                      <div className="p-2.5 rounded-lg bg-secondary/50 border border-border">
                        <p className="font-bold text-foreground text-[11px] mb-0.5">
                          Potential Recruiter Follow-up:
                        </p>
                        <p className="text-muted-foreground italic">
                          {evaluation.suggestedFollowUp}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={nextQuestion}
                        className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        {currentIdx + 1 < questions.length
                          ? "Next Question"
                          : "Complete Simulation"}
                        <ChevronRight size={13} />
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
