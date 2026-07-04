import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Flag,
  XCircle,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import QuizQuestionCard from "../components/QuizQuestionCard";
import RichContentViewer from "../components/RichContentViewer";
import UnavailableScreen from "../components/UnavailableScreen";
import { StatusAlertBanner } from "../components/ui/StatusAlert";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import {
  autoPublishQuiz,
  canStudentTakeQuiz,
  formatQuizDateTime,
  formatTimeLimitDisplay,
  getQuizById,
  getQuizQuestionCount,
  isStudentViewableQuiz,
  loadQuizzes,
  normalizeQuizQuestions,
  quizShowsCorrectAnswers,
  quizShowsResponses,
  saveQuizzes,
  totalQuizQuestionPoints,
  type Quiz,
} from "../utils/quizzes";
import {
  gradeQuizAttempt,
  getAttemptEffectiveScore,
  getRemainingAttempts,
  getStudentAttemptsForQuiz,
  hasAnswer,
  markQuizAttemptResponsesViewed,
  submitQuizAttempt,
  type GradedResult,
  type QuizAnswer,
} from "../utils/quizSubmissions";
import {
  clearQuizProgress,
  getQuizProgress,
  saveQuizProgress,
} from "../utils/quizProgress";

type AnswerState = Record<string, QuizAnswer>;

function formatMinutesLeft(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} Minute${minutes === 1 ? "" : "s"}, ${seconds} Second${
    seconds === 1 ? "" : "s"
  }`;
}

export default function QuizTakePage() {
  const { courseId, quizId } = useParams();
  const location = useLocation();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const search = new URLSearchParams(location.search);
  const isPreview = !studentView || search.get("preview") === "1";
  const isReview = search.get("review") === "1";
  const reviewAttemptId = search.get("attempt");

  const [quiz, setQuiz] = useState<Quiz | undefined>(() =>
    quizId ? getQuizById(effectiveCourseId, quizId) : undefined,
  );
  const [answers, setAnswers] = useState<AnswerState>({});
  const [result, setResult] = useState<GradedResult | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [showTime, setShowTime] = useState(true);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [reviewLocked, setReviewLocked] = useState(false);
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [resumed, setResumed] = useState(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const firedAlertsRef = useRef<Set<number>>(new Set());
  const firedSecondAlertsRef = useRef<Set<number>>(new Set());
  const progressInitRef = useRef(false);
  const { showToast } = useToast();

  // A real, in-progress student attempt (not an instructor preview or a
  // post-submission review) — the only case where we persist/resume progress.
  const isLiveAttempt = !isPreview && !isReview;

  const quizPath = `/courses/${effectiveCourseId}/quizzes/${quizId}`;
  const submissionPath = `${quizPath}/submission`;

  const scrollToQuestion = (id: string) => {
    questionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!quizId) return;
    const all = loadQuizzes(effectiveCourseId).map((q) => autoPublishQuiz(q));
    saveQuizzes(effectiveCourseId, all);
    setQuiz(all.find((q) => q.id === quizId));
  }, [effectiveCourseId, quizId]);

  // Resume an in-progress attempt (or start a fresh one). Restoring startedAt to
  // its original value keeps the timer running from where the student left off.
  useEffect(() => {
    if (!quiz || !quizId || !isLiveAttempt || result) return;
    if (progressInitRef.current) return;
    progressInitRef.current = true;
    const existing = getQuizProgress(effectiveCourseId, quiz.id);
    if (existing) {
      const restored: AnswerState = {};
      for (const a of existing.answers) restored[a.questionId] = a;
      setAnswers(restored);
      setMarkedForReview(new Set(existing.markedForReview));
      setStartedAt(existing.startedAt);
      setResumed(true);
    } else {
      const start = Date.now();
      setStartedAt(start);
      saveQuizProgress(effectiveCourseId, quiz.id, {
        startedAt: start,
        answers: [],
        markedForReview: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id, isLiveAttempt, result]);

  // Persist the in-progress attempt whenever answers or flags change.
  useEffect(() => {
    if (!quiz || !quizId || !isLiveAttempt || result || !progressInitRef.current) return;
    saveQuizProgress(effectiveCourseId, quiz.id, {
      startedAt,
      answers: Object.values(answers),
      markedForReview: [...markedForReview],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, markedForReview, startedAt, quiz?.id, isLiveAttempt, result]);

  // Post-submission review: load a specific attempt (?attempt=<id>, defaults to
  // the latest) read-only and honor the "only once" gate before revealing it.
  useEffect(() => {
    if (!isReview || !quiz || !quizId) return;
    const attempts = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id);
    if (attempts.length === 0) return;
    const target =
      (reviewAttemptId && attempts.find((a) => a.id === reviewAttemptId)) ||
      attempts[attempts.length - 1];
    if (!target) return;

    if (quiz.showResponsesOnlyOnce && target.responsesViewed) {
      setReviewLocked(true);
    } else if (quiz.showResponsesOnlyOnce) {
      markQuizAttemptResponsesViewed(effectiveCourseId, target.id);
    }

    const answerState: AnswerState = {};
    for (const a of target.answers) answerState[a.questionId] = a;
    setAnswers(answerState);

    const graded = gradeQuizAttempt(quiz, target.answers);
    setResult({
      score: getAttemptEffectiveScore(target),
      maxScore: target.maxScore,
      autoGraded: target.autoGraded,
      perQuestion: graded.perQuestion,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReview, quiz?.id, effectiveCourseId, quizId, reviewAttemptId]);

  const questions = useMemo(() => normalizeQuizQuestions(quiz?.questions), [quiz]);

  const timeLimitMs = quiz?.timeLimitMinutes ? quiz.timeLimitMinutes * 60000 : 0;
  const timeRemaining = timeLimitMs > 0 ? timeLimitMs - (now - startedAt) : Infinity;

  useEffect(() => {
    // Keep ticking while an attempt (or preview) is in progress so the timer
    // updates live. Preview never auto-submits (guarded elsewhere).
    if (result || !quiz) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [result, quiz]);

  const handleSubmit = (auto = false) => {
    if (!quiz) return;
    if (!auto && !isPreview) {
      const unanswered = questions.filter((q) => !hasAnswer(answers[q.id]));
      if (unanswered.length > 0) {
        const ok = window.confirm(
          `You have ${unanswered.length} unanswered question${
            unanswered.length === 1 ? "" : "s"
          }. Submit anyway?`,
        );
        if (!ok) return;
      }
    }
    const answerList = questions.map(
      (q) => answers[q.id] ?? { questionId: q.id },
    );
    if (isPreview) {
      setResult(gradeQuizAttempt(quiz, answerList));
      return;
    }
    if (auto) setAutoSubmitted(true);
    const attempt = submitQuizAttempt(effectiveCourseId, quiz, answerList);
    clearQuizProgress(effectiveCourseId, quiz.id);
    setResult({
      score: attempt.score,
      maxScore: attempt.maxScore,
      autoGraded: attempt.autoGraded,
      perQuestion: gradeQuizAttempt(quiz, answerList).perQuestion,
    });
  };

  // Begin a brand-new attempt after submitting the previous one. Starts a fresh
  // in-progress record with a new timer.
  const retake = () => {
    if (!quiz) return;
    const start = Date.now();
    setAnswers({});
    setMarkedForReview(new Set());
    setResult(null);
    setAutoSubmitted(false);
    setResumed(false);
    firedAlertsRef.current.clear();
    firedSecondAlertsRef.current.clear();
    setStartedAt(start);
    setNow(Date.now());
    clearQuizProgress(effectiveCourseId, quiz.id);
    saveQuizProgress(effectiveCourseId, quiz.id, {
      startedAt: start,
      answers: [],
      markedForReview: [],
    });
  };

  useEffect(() => {
    if (!result && !isPreview && timeLimitMs > 0 && timeRemaining <= 0 && quiz) {
      handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, result, isPreview, timeLimitMs, quiz]);

  // Warn the student as their remaining time crosses each threshold. Each
  // threshold fires once per attempt and only when the quiz limit exceeds it.
  useEffect(() => {
    if (result || isPreview || timeLimitMs <= 0 || !quiz) return;
    const limitMinutes = quiz.timeLimitMinutes ?? 0;
    const minutesLeft = timeRemaining / 60000;
    for (const threshold of [30, 15, 10, 5, 2, 1]) {
      if (
        threshold < limitMinutes &&
        minutesLeft <= threshold &&
        !firedAlertsRef.current.has(threshold)
      ) {
        firedAlertsRef.current.add(threshold);
        showToast(
          `${threshold} minute${threshold === 1 ? "" : "s"} remaining`,
          threshold <= 5 ? "negative" : "neutral",
        );
      }
    }
    // Final countdown warnings in the last minute.
    const secondsLeft = timeRemaining / 1000;
    for (const threshold of [30, 15]) {
      if (
        secondsLeft <= threshold &&
        secondsLeft > 0 &&
        !firedSecondAlertsRef.current.has(threshold)
      ) {
        firedSecondAlertsRef.current.add(threshold);
        showToast(`${threshold} seconds remaining`, "negative");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, result, isPreview, timeLimitMs, quiz]);

  if (!quiz || !quizId) {
    return (
      <div className="flex h-full w-full flex-col bg-canvas-grayLight">
        <CourseHeader />
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          Quiz not found.
        </div>
      </div>
    );
  }

  const remaining = getRemainingAttempts(quiz, effectiveCourseId);
  const priorAttempts = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id);
  const canTake = isPreview || (canStudentTakeQuiz(quiz, now) && remaining > 0);
  const questionCount = getQuizQuestionCount(quiz);
  const maxScore = totalQuizQuestionPoints(questions);

  const setAnswer = (next: QuizAnswer) => {
    setAnswers((prev) => ({ ...prev, [next.questionId]: next }));
    setError(null);
  };

  const toggleMarkForReview = (id: string) =>
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const correctById = new Map(
    (result?.perQuestion ?? []).map((p) => [p.questionId, p.correct]),
  );

  // Instructors previewing always see everything. For real student attempts,
  // honor the quiz's answer/response visibility settings.
  const reviewShowResponses = isPreview || quizShowsResponses(quiz);
  const reviewRevealKey = isPreview || quizShowsCorrectAnswers(quiz, now);
  // In review mode the "only once" gate can hide responses entirely.
  const responsesVisible = reviewShowResponses && !reviewLocked;

  const gateBlocked = studentView && !isPreview && !result && (!isStudentViewableQuiz(quiz, now) || !canTake);
  const showWorkspace = !gateBlocked && questions.length > 0;
  // Once a result is shown, drop the right panel (timer + question nav) and let
  // the content span the full width.
  const showSidePanel = showWorkspace && !result;
  const isTimed = timeLimitMs > 0;
  const elapsedMs = now - startedAt;

  // In review mode, if the responses can't be shown (hidden for this quiz, or
  // the "view once" window has already been used), show a full-screen doodle
  // page rather than any inline "not available" text.
  if (isReview && result && !responsesVisible) {
    return (
      <UnavailableScreen
        title="Responses hidden"
        message={
          reviewLocked
            ? "You've already viewed your responses for this attempt. They can only be opened once, so they're no longer available."
            : "Your instructor has hidden responses for this quiz, so your answers can't be shown. Your score is still available on the quiz page."
        }
        backTo={submissionPath}
        backLabel="Back to submission"
      />
    );
  }

  const titleHeader = (
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-normal text-canvas-grayDark">{quiz.title}</h1>
      {isPreview && (
        <span className="inline-flex items-center gap-1 rounded-full bg-canvas-blueTint px-2.5 py-0.5 text-xs font-medium text-canvas-blueDark">
          <Eye className="h-3.5 w-3.5" /> Preview
        </span>
      )}
      {isReview && !isPreview && (
        <span className="inline-flex items-center gap-1 rounded-full bg-canvas-blueTint px-2.5 py-0.5 text-xs font-medium text-canvas-blueDark">
          <Eye className="h-3.5 w-3.5" /> Your responses
        </span>
      )}
    </div>
  );

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <Link
            to={quizPath}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-canvas-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to quiz
          </Link>

          <div
            className={
              showSidePanel
                ? "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"
                : ""
            }
          >
            <div>
              <div className="mb-6">
                {titleHeader}
                <p className="mt-1 text-sm text-gray-500">
                  {questionCount} question{questionCount === 1 ? "" : "s"} · {maxScore} pts
                </p>
              </div>

              {resumed && !result && (
                <StatusAlertBanner tone="neutral" className="mb-6">
                  <span className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 shrink-0" />
                    You resumed an attempt in progress — your timer kept running.
                  </span>
                </StatusAlertBanner>
              )}

              {result && (
                <div className="mb-6 rounded-lg border border-canvas-blue/30 bg-canvas-blueTint px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-canvas-grayDark">
                        {isPreview
                          ? "Preview results"
                          : isReview
                            ? "Your submission"
                            : "Attempt submitted"}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600">
                        Score: <span className="font-semibold">{result.score}</span> /{" "}
                        {result.maxScore}
                        {result.maxScore > 0 &&
                          ` (${Math.round((result.score / result.maxScore) * 100)}%)`}
                      </p>
                    </div>
                    {!result.autoGraded && (
                      <span className="flex items-center gap-1.5 text-xs text-amber-600">
                        <AlertCircle className="h-4 w-4" /> Some answers need manual grading
                      </span>
                    )}
                  </div>
                  {autoSubmitted && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <Clock className="h-4 w-4" /> Time's up — your quiz was submitted
                      automatically.
                    </p>
                  )}
                  {!isPreview && (
                    <p className="mt-2 text-xs text-gray-500">
                      Attempts used: {priorAttempts.length}
                      {quiz.allowMultipleAttempts &&
                      typeof quiz.allowedAttempts === "number" &&
                      quiz.allowedAttempts > 0
                        ? ` of ${quiz.allowedAttempts}`
                        : quiz.allowMultipleAttempts
                          ? ""
                          : " of 1"}
                    </p>
                  )}
                </div>
              )}

              {gateBlocked ? (
                <div className="rounded-lg border border-gray-200 bg-white px-5 py-6 text-sm text-gray-600">
                  {remaining <= 0 && priorAttempts.length > 0
                    ? "You have used all of your attempts for this quiz."
                    : "This quiz is not available for you to take right now."}
                </div>
              ) : questions.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white px-5 py-6 text-sm text-gray-600">
                  This quiz doesn't have any questions yet.
                </div>
              ) : (
                <>
                  {quiz.description && (
                    <div className="mb-6 rounded-lg border border-gray-200 bg-white px-5 py-4">
                      <RichContentViewer html={quiz.description} courseId={effectiveCourseId} />
                    </div>
                  )}

                  {result && !responsesVisible ? (
                    <div className="rounded-lg border border-gray-200 bg-white px-5 py-6 text-sm text-gray-600">
                      {reviewLocked
                        ? "Your responses are no longer available for review. Your score is shown above."
                        : "Your responses are hidden for this quiz. Your score is shown above."}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {questions.map((question, index) => (
                        <div
                          key={question.id}
                          ref={(el) => {
                            questionRefs.current[question.id] = el;
                          }}
                          className="scroll-mt-4"
                        >
                          <QuizQuestionCard
                            question={question}
                            index={index}
                            answer={answers[question.id]}
                            onChange={setAnswer}
                            disabled={Boolean(result)}
                            review={
                              result
                                ? { correct: correctById.get(question.id) ?? false }
                                : undefined
                            }
                            revealKey={reviewRevealKey}
                            markedForReview={markedForReview.has(question.id)}
                            onToggleMarkForReview={() => toggleMarkForReview(question.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-200 pt-5">
                    <p className="text-xs text-gray-500">
                      {quiz.timeLimitMinutes
                        ? `Time limit: ${formatTimeLimitDisplay(quiz.timeLimitMinutes)}`
                        : "No time limit"}
                    </p>
                    {result ? (
                      <div className="flex gap-2">
                        {isPreview ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAnswers({});
                              setResult(null);
                              setStartedAt(Date.now());
                              setNow(Date.now());
                            }}
                            className="btn-canvas-secondary"
                          >
                            Reset preview
                          </button>
                        ) : !isReview && remaining > 0 ? (
                          <button
                            type="button"
                            onClick={retake}
                            className="btn-canvas-secondary"
                          >
                            Retake ({remaining} left)
                          </button>
                        ) : null}
                        <Link
                          to={isReview && !isPreview ? submissionPath : quizPath}
                          className="btn-canvas-primary"
                        >
                          Done
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSubmit(false)}
                        className="btn-canvas-primary px-6"
                      >
                        {isPreview ? "Check answers" : "Submit Quiz"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {showSidePanel && (
              <aside className="lg:pt-1">
                <div className="space-y-4 lg:sticky lg:top-4">
                  {!result && !isPreview && (
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-canvas-grayDark">
                          <Clock className="h-4 w-4 text-gray-500" />
                          {isTimed ? "Time Remaining" : "Time Running"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTime((s) => !s)}
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          {showTime ? (
                            <>
                              <EyeOff className="h-3 w-3" /> Hide
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" /> Show
                            </>
                          )}
                        </button>
                      </div>
                      {showTime && (
                        <div className="mt-2">
                          {isTimed ? (
                            <p
                              className={`text-2xl font-semibold tabular-nums ${
                                timeRemaining < 60000
                                  ? "text-red-600"
                                  : "text-canvas-grayDark"
                              }`}
                            >
                              {formatMinutesLeft(timeRemaining)}
                            </p>
                          ) : (
                            <p className="text-sm text-canvas-grayDark">
                              {formatElapsed(elapsedMs)}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            Due:{" "}
                            {quiz.dueAt ? formatQuizDateTime(quiz.dueAt) : "No due date"}
                          </p>
                          {isTimed && (
                            <p className="mt-0.5 text-xs text-amber-600">
                              Auto-submits at {formatQuizDateTime(startedAt + timeLimitMs)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-canvas-grayDark">Questions</h3>
                    <ul className="mt-3 space-y-0.5">
                      {questions.map((question, index) => {
                        const answered = hasAnswer(answers[question.id]);
                        const rev =
                          result && responsesVisible
                            ? correctById.get(question.id)
                            : undefined;
                        return (
                          <li key={question.id}>
                            <button
                              type="button"
                              onClick={() => scrollToQuestion(question.id)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-canvas-blue hover:bg-gray-50"
                            >
                              {result && responsesVisible ? (
                                rev ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                                )
                              ) : answered ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-canvas-blue" />
                              ) : (
                                <Circle className="h-4 w-4 shrink-0 text-gray-300" />
                              )}
                              <span className="flex-1">Question {index + 1}</span>
                              {!result && markedForReview.has(question.id) && (
                                <Flag className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {isPreview && !result && (
                    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-canvas-grayDark">
                          <Clock className="h-4 w-4 text-gray-500" />
                          {isTimed ? "Time Remaining" : "Time Running"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowTime((s) => !s)}
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          {showTime ? (
                            <>
                              <EyeOff className="h-3 w-3" /> Hide
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" /> Show
                            </>
                          )}
                        </button>
                      </div>
                      {showTime && (
                        <div className="mt-2">
                          {isTimed ? (
                            <p
                              className={`text-2xl font-semibold tabular-nums ${
                                timeRemaining < 60000 ? "text-red-600" : "text-canvas-grayDark"
                              }`}
                            >
                              {formatMinutesLeft(Math.max(0, timeRemaining))}
                            </p>
                          ) : (
                            <p className="text-2xl font-semibold tabular-nums text-canvas-grayDark">
                              {formatElapsed(elapsedMs)}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            {isTimed
                              ? `Time limit: ${quiz.timeLimitMinutes} min (preview \u2014 not submitted)`
                              : "Preview timer (not submitted)"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
