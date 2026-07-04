import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import QuizQuestionCard from "../components/QuizQuestionCard";
import { StatusAlertBanner } from "../components/ui/StatusAlert";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import { getCourseById } from "../utils/coursesStore";
import {
  formatQuizDateTime,
  getQuizById,
  normalizeQuizQuestions,
  type Quiz,
  type QuizQuestion,
} from "../utils/quizzes";
import {
  addQuizAttemptComment,
  appendQuizAttemptFeedback,
  deleteQuizAttemptComment,
  deleteQuizAttemptFeedback,
  getAttemptEffectiveScore,
  getAttemptsForQuiz,
  gradeQuizAttempt,
  isAnswerCorrect,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
  setQuizAttemptQuestionScores,
  type QuizAttempt,
} from "../utils/quizSubmissions";

const SIDEBAR_MIN_WIDTH = 300;
const SIDEBAR_MAX_WIDTH = 720;
const SIDEBAR_DEFAULT_WIDTH = 400;
const SIDEBAR_WIDTH_KEY = "canvasClone:quizGraderSidebarWidth";

function readSidebarWidth(): number {
  try {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, stored));
    }
  } catch {}
  return SIDEBAR_DEFAULT_WIDTH;
}

export default function QuizSpeedGraderPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const course = getCourseById(effectiveCourseId);
  const { showToast } = useToast();

  const [quiz, setQuiz] = useState<Quiz | undefined>(() =>
    quizId ? getQuizById(effectiveCourseId, quizId) : undefined,
  );
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() =>
    quizId ? getAttemptsForQuiz(effectiveCourseId, quizId) : [],
  );
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState("");
  const [questionScoreDrafts, setQuestionScoreDrafts] = useState<Record<string, string>>({});
  const initialDraftsRef = useRef<Record<string, string>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleSidebarResizeStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    sidebarResizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!sidebarResizeRef.current) return;
      const delta = sidebarResizeRef.current.startX - e.clientX;
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, sidebarResizeRef.current.startWidth + delta),
      );
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (!sidebarResizeRef.current) return;
      sidebarResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((width) => {
        try {
          window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
        } catch {}
        return width;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const quizPath = `/courses/${effectiveCourseId}/quizzes/${quizId}`;

  useEffect(() => {
    if (studentView) navigate(quizPath, { replace: true });
  }, [studentView, navigate, quizPath]);

  useEffect(() => {
    const refresh = () => {
      if (!quizId) return;
      setQuiz(getQuizById(effectiveCourseId, quizId));
      setAttempts(
        getAttemptsForQuiz(effectiveCourseId, quizId).sort(
          (a, b) => b.submittedAt - a.submittedAt,
        ),
      );
    };
    refresh();
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refresh);
  }, [effectiveCourseId, quizId]);

  const questions = useMemo(() => normalizeQuizQuestions(quiz?.questions), [quiz]);
  const safeIndex = Math.min(index, Math.max(0, attempts.length - 1));
  const attempt = attempts[safeIndex];

  // Reset editable grade + drafts when switching to a different attempt.
  useEffect(() => {
    if (!attempt || !quiz) {
      setScore("");
      setQuestionScoreDrafts({});
      initialDraftsRef.current = {};
      setCommentDraft("");
      setFeedbackDraft("");
      return;
    }
    setScore(String(getAttemptEffectiveScore(attempt)));
    const graded = gradeQuizAttempt(quiz, attempt.answers);
    const autoEarned = new Map(graded.perQuestion.map((p) => [p.questionId, p.earned]));
    const drafts: Record<string, string> = {};
    for (const q of questions) {
      const override = attempt.questionScores?.[q.id];
      drafts[q.id] = String(override ?? autoEarned.get(q.id) ?? 0);
    }
    setQuestionScoreDrafts(drafts);
    initialDraftsRef.current = drafts;
    setCommentDraft("");
    setFeedbackDraft("");
  }, [attempt?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const averageScore = useMemo(() => {
    if (attempts.length === 0) return 0;
    return (
      attempts.reduce((sum, a) => sum + getAttemptEffectiveScore(a), 0) / attempts.length
    );
  }, [attempts]);

  if (!quiz || !quizId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d3b45] text-sm text-white/80">
        Quiz not found.{" "}
        <Link to={`/courses/${effectiveCourseId}/quizzes`} className="ml-2 underline">
          Back to Quizzes
        </Link>
      </div>
    );
  }

  const maxScore = attempt?.maxScore ?? 0;
  const effectiveScore = attempt ? getAttemptEffectiveScore(attempt) : 0;
  const isOverridden =
    attempt && typeof attempt.manualScore === "number" && attempt.manualScore !== attempt.score;
  // Live total mirrors the editable "Grade out of X" field so the summary
  // updates as per-question points are adjusted (before saving).
  const liveScoreNum = score.trim() === "" ? effectiveScore : Number(score);
  const liveScore = Number.isFinite(liveScoreNum) ? liveScoreNum : effectiveScore;
  const liveScorePct =
    attempt && attempt.maxScore > 0 ? Math.round((liveScore / attempt.maxScore) * 100) : 0;

  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const scrollToQuestion = (id: string) =>
    questionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Editing a single question's points recomputes the running total so the
  // "Grade out of X" field always mirrors the sum of per-question points.
  const updateQuestionScore = (questionId: string, value: string) => {
    const next = { ...questionScoreDrafts, [questionId]: value };
    setQuestionScoreDrafts(next);
    const sum = questions.reduce((s, q) => {
      const v = Number(next[q.id]);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);
    setScore(String(sum));
  };

  const handleSaveGrade = () => {
    if (!attempt) return;
    const qScores: Record<string, number> = {};
    for (const q of questions) {
      const raw = questionScoreDrafts[q.id];
      const val = raw === "" || raw == null ? 0 : Number(raw);
      if (Number.isNaN(val) || val < 0) {
        showToast("Question points must be 0 or more", "negative");
        return;
      }
      if (q.points > 0 && val > q.points) {
        showToast(
          `A question exceeds its ${q.points}-point maximum. Fix it before saving.`,
          "negative",
        );
        return;
      }
      qScores[q.id] = val;
    }
    const num = score.trim() === "" ? undefined : Number(score);
    if (num != null && (Number.isNaN(num) || num < 0 || num > attempt.maxScore)) {
      showToast(`Score must be between 0 and ${attempt.maxScore}`, "negative");
      return;
    }
    const total = num ?? questions.reduce((s, q) => s + (qScores[q.id] ?? 0), 0);
    setQuizAttemptQuestionScores(effectiveCourseId, attempt.id, qScores, total);
    if (feedbackDraft.trim()) {
      appendQuizAttemptFeedback(effectiveCourseId, attempt.id, feedbackDraft);
      setFeedbackDraft("");
    }
    initialDraftsRef.current = { ...questionScoreDrafts };
    showToast("Grade saved", "positive");
  };

  const handleAddComment = () => {
    if (!attempt || !commentDraft.trim()) return;
    addQuizAttemptComment(effectiveCourseId, attempt.id, commentDraft.trim(), "instructor");
    setCommentDraft("");
    showToast("Comment added", "positive");
  };

  const handlePostFeedback = () => {
    if (!attempt || !feedbackDraft.trim()) return;
    appendQuizAttemptFeedback(effectiveCourseId, attempt.id, feedbackDraft);
    setFeedbackDraft("");
    showToast("Feedback added", "positive");
  };

  const comments = attempt?.comments ?? [];
  const feedbackEntries = attempt?.feedbackEntries ?? [];

  // Save grade is only enabled once the score, per-question points, or pending
  // feedback changes.
  const questionScoresDirty =
    !!attempt &&
    questions.some(
      (q) => (questionScoreDrafts[q.id] ?? "") !== (initialDraftsRef.current[q.id] ?? ""),
    );
  const isDirty =
    !!attempt &&
    (score.trim() !== String(getAttemptEffectiveScore(attempt)) ||
      feedbackDraft.trim() !== "" ||
      questionScoresDirty);

  // Questions the instructor accidentally gave more than their max points.
  const overMaxQuestions = attempt
    ? questions.filter((q) => q.points > 0 && Number(questionScoreDrafts[q.id]) > q.points)
    : [];
  const hasOverMax = overMaxQuestions.length > 0;

  const setAllQuestionsToMax = () => {
    const next = { ...questionScoreDrafts };
    for (const q of overMaxQuestions) next[q.id] = String(q.points);
    setQuestionScoreDrafts(next);
    const sum = questions.reduce((s, q) => {
      const v = Number(next[q.id]);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);
    setScore(String(sum));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#2d3b45] text-white">
      <header className="flex shrink-0 items-center gap-4 border-b border-black/20 px-4 py-2 text-sm">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            to={quizPath}
            className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
            title="Close GradePro"
          >
            <X className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-semibold">{quiz.title}</p>
            <p className="truncate text-xs text-white/70">
              GradePro{course ? ` — ${course.title}` : ""}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-6 text-xs text-white/80 lg:flex">
          <span>{attempts.length} Attempts</span>
          <span>
            {averageScore.toFixed(1)} / {maxScore} Average
          </span>
          <span>
            {attempts.length === 0 ? "0/0" : `${safeIndex + 1}/${attempts.length}`} Viewing
          </span>
        </div>

        <div className="flex items-center gap-2">
          {attempts.length > 0 && (
            <AttemptSelect attempts={attempts} index={safeIndex} onSelect={setIndex} />
          )}
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={safeIndex <= 0}
            className="rounded p-1.5 hover:bg-white/10 disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(attempts.length - 1, i + 1))}
            disabled={safeIndex >= attempts.length - 1}
            className="rounded p-1.5 hover:bg-white/10 disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          {attempt && (
            <div className="ml-2 flex items-center gap-2 rounded bg-white/10 px-3 py-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-green text-xs font-bold">
                {initials(attempt.studentName)}
              </span>
              <span className="max-w-[140px] truncate text-sm">{attempt.studentName}</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[#eef0f3] p-6">
          {!attempt ? (
            <div className="mx-auto mt-10 max-w-lg rounded-lg border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-600">
              No submissions to grade yet.
            </div>
          ) : (
            <div className="mx-auto max-w-5xl space-y-4">
              {questions.map((question, qIndex) => {
                const answer = attempt.answers.find((a) => a.questionId === question.id);
                const correct = isAnswerCorrect(question, answer);
                return (
                  <div
                    key={question.id}
                    ref={(el) => {
                      questionRefs.current[question.id] = el;
                    }}
                    className="scroll-mt-4"
                  >
                    <QuizQuestionCard
                      question={question}
                      index={qIndex}
                      answer={answer}
                      onChange={() => {}}
                      disabled
                      review={{ correct }}
                      revealKey
                    />
                    <PerQuestionPoints
                      question={question}
                      value={questionScoreDrafts[question.id] ?? ""}
                      onChange={(v) => updateQuestionScore(question.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside
          style={{ width: sidebarWidth }}
          className="relative flex shrink-0 flex-col border-l border-gray-300 bg-white text-canvas-grayDark"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize grading panel"
            onMouseDown={handleSidebarResizeStart}
            className="absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none hover:bg-canvas-blue/15 active:bg-canvas-blue/25"
          />
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {attempt ? (
              <>
                <div>
                  <p className="text-sm font-semibold">{attempt.studentName}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Attempt #{attempt.attemptNumber} · Submitted{" "}
                    {formatQuizDateTime(attempt.submittedAt)}
                  </p>
                </div>

                {hasOverMax && (
                  <StatusAlertBanner tone="negative">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {overMaxQuestions.length} question
                          {overMaxQuestions.length === 1 ? "" : "s"} over the maximum
                        </p>
                        <p className="mt-0.5 text-xs">
                          A question was given more points than it's worth. Saving is
                          disabled until this is fixed.
                        </p>
                        <button
                          type="button"
                          onClick={setAllQuestionsToMax}
                          className="mt-2 rounded-md bg-canvas-red px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Set all to max
                        </button>
                      </div>
                    </div>
                  </StatusAlertBanner>
                )}

                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 text-center">
                  <p className="text-3xl font-semibold text-canvas-grayDark">
                    {liveScore}
                    <span className="text-lg font-normal text-gray-400"> / {attempt.maxScore}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{liveScorePct}% score</p>
                  {!attempt.autoGraded && (
                    <p className="mt-1 text-xs text-amber-600">Manual review suggested</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Grade out of {attempt.maxScore}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={attempt.maxScore}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Auto-graded score: {attempt.score} / {attempt.maxScore}
                    {isOverridden && " · manually adjusted"}
                  </p>
                </div>

                <div className="border-t border-canvas-border pt-4">
                  <h3 className="mb-2 text-sm font-semibold">Comments</h3>
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {comments.length === 0 && (
                      <p className="text-sm text-gray-500">No comments yet.</p>
                    )}
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="group rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-canvas-grayDark">
                            {c.author}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              deleteQuizAttemptComment(effectiveCourseId, attempt.id, c.id)
                            }
                            className="text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-canvas-red"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{c.body}</p>
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    rows={2}
                    placeholder="Add a comment for this attempt..."
                    className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={!commentDraft.trim()}
                    className="mt-2 text-sm text-canvas-blue hover:underline disabled:opacity-50"
                  >
                    Post comment
                  </button>
                </div>

                <div className="border-t border-canvas-border pt-4">
                  <h3 className="mb-2 text-sm font-semibold">Quiz feedback</h3>
                  <p className="mb-3 text-xs text-gray-500">Visible to the student after grading.</p>
                  {feedbackEntries.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {feedbackEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="group rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-canvas-grayDark">
                              {entry.author}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                deleteQuizAttemptFeedback(effectiveCourseId, attempt.id, entry.id)
                              }
                              className="text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-canvas-red"
                              aria-label="Delete feedback"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">
                            {entry.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={feedbackDraft}
                    onChange={(e) => setFeedbackDraft(e.target.value)}
                    rows={3}
                    placeholder="Write feedback for the student..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handlePostFeedback}
                    disabled={!feedbackDraft.trim()}
                    className="mt-2 text-sm text-canvas-blue hover:underline disabled:opacity-50"
                  >
                    Post feedback
                  </button>
                </div>

                <div className="border-t border-canvas-border pt-4">
                  <h3 className="text-sm font-semibold">Questions</h3>
                  <ul className="mt-2 space-y-0.5">
                    {questions.map((question, qIndex) => {
                      const answer = attempt.answers.find((a) => a.questionId === question.id);
                      const correct = isAnswerCorrect(question, answer);
                      return (
                        <li key={question.id}>
                          <button
                            type="button"
                            onClick={() => scrollToQuestion(question.id)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                          >
                            {correct ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                            )}
                            Question {qIndex + 1}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">No submissions yet.</p>
            )}
          </div>

          {attempt && (
            <div className="shrink-0 border-t border-canvas-border p-5">
              <button
                type="button"
                onClick={handleSaveGrade}
                disabled={!isDirty || hasOverMax}
                title={hasOverMax ? "Fix questions over their maximum first" : undefined}
                className="btn-canvas-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save grade
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Dark, on-theme attempt selector. Uses a custom menu (not a native <select>)
 * so the trigger text stays white on every OS.
 */
function AttemptSelect({
  attempts,
  index,
  onSelect,
}: {
  attempts: QuizAttempt[];
  index: number;
  onSelect: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = (a: QuizAttempt) =>
    `${a.studentName} — Attempt #${a.attemptNumber} (${getAttemptEffectiveScore(a)}/${a.maxScore})`;
  const current = attempts[index];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-[260px] items-center gap-2 rounded-md border border-white/20 bg-canvas-grayMedium px-3 py-1.5 text-sm font-medium text-white shadow-sm outline-none hover:bg-canvas-grayMedium/80 focus:border-canvas-blue"
      >
        <span className="truncate">{current ? label(current) : "Select attempt"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-1 max-h-72 w-[260px] overflow-auto rounded-md border border-white/10 bg-canvas-surfaceRaised py-1 text-sm text-white shadow-canvas-dark"
        >
          {attempts.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                onClick={() => {
                  onSelect(i);
                  setOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-white/10 ${
                  i === index ? "bg-white/10 font-semibold" : ""
                }`}
              >
                <span className="truncate">{label(a)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Instructor-editable points for a single question, shown under its card. */
function PerQuestionPoints({
  question,
  value,
  onChange,
}: {
  question: QuizQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const over = question.points > 0 && Number(value) > question.points;
  return (
    <div
      className={`mt-1.5 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-sm text-canvas-grayDark shadow-sm ${
        over ? "border-canvas-red bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      <span className="mr-auto text-xs font-medium text-gray-500">Adjust points</span>
      {over && (
        <span className="flex items-center gap-1 text-xs font-medium text-canvas-red">
          <AlertTriangle className="h-3.5 w-3.5" />
          Max is {question.points}
        </span>
      )}
      {over && (
        <button
          type="button"
          onClick={() => onChange(String(question.points))}
          className="rounded-md border border-canvas-red px-2 py-1 text-xs font-semibold text-canvas-red hover:bg-red-100"
        >
          Set to max
        </button>
      )}
      <input
        type="number"
        min={0}
        max={question.points > 0 ? question.points : undefined}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-20 rounded-md border px-2 py-1 text-right text-sm outline-none focus:ring-2 ${
          over
            ? "border-canvas-red text-canvas-red focus:border-canvas-red focus:ring-canvas-red/30"
            : "border-gray-300 focus:border-canvas-blue focus:ring-canvas-blue/30"
        }`}
      />
      <span className="text-gray-400">/ {question.points}</span>
    </div>
  );
}
