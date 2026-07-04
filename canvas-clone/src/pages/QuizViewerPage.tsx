import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  BadgeCheck,
  CheckCircle2,
  Circle,
  FileText,
  Pencil,
  Rocket,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import RichContentViewer from "../components/RichContentViewer";
import ScoreDial from "../components/ScoreDial";
import { useStudentView } from "../hooks/useStudentView";
import { resolveStudentBackPath } from "../utils/courseNavigation";
import { getCourseById } from "../utils/coursesStore";
import {
  autoPublishQuiz,
  canStudentTakeQuiz,
  formatQuizAvailabilityRange,
  formatQuizDateTime,
  formatTimeLimitDisplay,
  getQuizAllowedAttemptsLabel,
  getQuizById,
  getQuizLockedAt,
  getQuizQuestionCount,
  getQuizScoringPolicy,
  isQuizNotYetAvailable,
  isStudentViewableQuiz,
  loadQuizzes,
  QUIZ_SCORING_POLICY_LABELS,
  saveQuizzes,
} from "../utils/quizzes";
import {
  getRemainingAttempts,
  getStudentAttemptStats,
  getStudentAttemptsForQuiz,
  getStudentFinalScore,
} from "../utils/quizSubmissions";
import {
  finalizeExpiredQuizProgress,
  getQuizProgress,
  isQuizProgressExpired,
} from "../utils/quizProgress";

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm text-canvas-grayDark">
      <span className="font-semibold">{label}</span> <span>{value}</span>
    </div>
  );
}

export default function QuizViewerPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const course = getCourseById(effectiveCourseId);

  const backTo = resolveStudentBackPath(
    effectiveCourseId,
    "quizzes",
    course,
    (location.state as { from?: string } | null)?.from ??
      `/courses/${effectiveCourseId}/quizzes`,
  );

  const [quiz, setQuiz] = useState(() =>
    quizId ? getQuizById(effectiveCourseId, quizId) : undefined,
  );
  // Bumped after we auto-finalize an expired in-progress attempt so the inline
  // score/attempt reads below recompute.
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      if (!quizId) return;
      const all = loadQuizzes(effectiveCourseId).map((q) => autoPublishQuiz(q));
      const changed = all.some(
        (q, i) => q.status !== loadQuizzes(effectiveCourseId)[i]?.status,
      );
      if (changed) saveQuizzes(effectiveCourseId, all);
      setQuiz(all.find((q) => q.id === quizId));
    };
    refresh();
    window.addEventListener("canvasClone:quizzesChanged", refresh);
    return () => window.removeEventListener("canvasClone:quizzesChanged", refresh);
  }, [effectiveCourseId, quizId]);

  // If a saved in-progress attempt has already run out of time, submit it now
  // (registering its score) so the student sees a completed attempt and "Retake"
  // rather than a stale "Resume".
  useEffect(() => {
    if (!studentView || !quiz) return;
    if (finalizeExpiredQuizProgress(effectiveCourseId, quiz)) {
      setRefreshTick((t) => t + 1);
    }
  }, [studentView, quiz, effectiveCourseId]);

  const fromPath = (location.state as { from?: string } | null)?.from;
  const fromModules = typeof fromPath === "string" && fromPath.includes("/modules");

  useEffect(() => {
    const redirectAway = (reason: string) => {
      if (fromModules) {
        navigate(`/courses/${effectiveCourseId}/modules/unavailable`, {
          replace: true,
          state: { reason, from: fromPath },
        });
      } else {
        navigate(backTo, { replace: true });
      }
    };
    if (!quiz) {
      redirectAway("This quiz is no longer available.");
      return;
    }
    if (studentView && !isStudentViewableQuiz(quiz)) {
      redirectAway("This quiz hasn't been published yet.");
    }
  }, [quiz, studentView, navigate, backTo, effectiveCourseId, fromModules, fromPath]);

  if (!quiz || !quizId) return null;

  const now = Date.now();
  const notYetAvailable = isQuizNotYetAvailable(quiz, now);
  const lockedAt = getQuizLockedAt(quiz, now);
  const canTake = canStudentTakeQuiz(quiz, now);
  const availabilityRange = formatQuizAvailabilityRange(quiz);
  const timeLimit = formatTimeLimitDisplay(quiz.timeLimitMinutes);
  const questionCount = getQuizQuestionCount(quiz);
  const attemptsLabel = getQuizAllowedAttemptsLabel(quiz);

  const dueLabel = quiz.dueAt ? formatQuizDateTime(quiz.dueAt) : "No due date";
  const pointsLabel = quiz.points != null ? String(quiz.points) : "—";
  const questionsLabel = questionCount > 0 ? String(questionCount) : "—";

  const isPublished = quiz.status === "published" || quiz.published === true;
  const togglePublish = () => {
    const all = loadQuizzes(effectiveCourseId).map((q) =>
      q.id === quiz.id
        ? {
            ...q,
            status: (isPublished ? "draft" : "published") as "draft" | "published",
            published: !isPublished,
            publishAt: undefined,
          }
        : q,
    );
    saveQuizzes(effectiveCourseId, all);
  };

  const takePath = `/courses/${effectiveCourseId}/quizzes/${quizId}/take`;
  const previewPath = `${takePath}?preview=1`;
  const priorAttempts = studentView
    ? getStudentAttemptsForQuiz(effectiveCourseId, quiz.id)
    : [];
  // The score that counts, honoring the quiz's scoring policy.
  const finalScore = studentView ? getStudentFinalScore(effectiveCourseId, quiz) : undefined;
  const finalScorePct =
    finalScore && finalScore.maxScore > 0
      ? Math.round((finalScore.score / finalScore.maxScore) * 100)
      : 0;
  const formatScore = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  const attemptStats = studentView ? getStudentAttemptStats(effectiveCourseId, quiz) : undefined;
  const remaining = studentView ? getRemainingAttempts(quiz, effectiveCourseId) : Infinity;
  const hasQuestions = questionCount > 0;
  const canRetake = canTake && remaining > 0;
  // A saved, not-yet-submitted attempt the student can pick back up. An expired
  // attempt is never resumable (it gets finalized to a completed attempt above).
  const inProgress = studentView ? getQuizProgress(effectiveCourseId, quiz.id) : undefined;
  const hasInProgress =
    !!inProgress && !isQuizProgressExpired(quiz, inProgress, now);
  const canResume = hasInProgress && canTake;

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="text-3xl font-normal text-canvas-grayDark">{quiz.title}</h1>
                  {!studentView && !isPublished && (
                    <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Unpublished
                    </span>
                  )}
                </div>
                {!studentView && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={togglePublish}
                      title={isPublished ? "Published — click to unpublish" : "Unpublished — click to publish"}
                      className={
                        isPublished
                          ? "inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
                          : "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      }
                    >
                      {isPublished ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      {isPublished ? "Published" : "Publish"}
                    </button>
                    <Link
                      to={`/courses/${effectiveCourseId}/quizzes/${quizId}/edit`}
                      title="Edit quiz"
                      aria-label="Edit quiz"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                    <Link
                      to={backTo}
                      title="Back to Quizzes"
                      aria-label="Back to Quizzes"
                      className="inline-flex items-center rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Link>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 border-y border-gray-300 py-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetaCell label="Due" value={dueLabel} />
                <MetaCell label="Points" value={pointsLabel} />
                <MetaCell label="Questions" value={questionsLabel} />
                <MetaCell
                  label="Available"
                  value={availabilityRange ?? "Always available"}
                />
                <MetaCell label="Time Limit" value={timeLimit ?? "None"} />
                <MetaCell label="Allowed Attempts" value={attemptsLabel} />
              </div>

              <h2 className="mt-8 text-xl font-semibold text-canvas-grayDark">Instructions</h2>
              {quiz.description ? (
                <div className="prose prose-sm mt-4 max-w-none text-canvas-grayDark">
                  <RichContentViewer html={quiz.description} courseId={effectiveCourseId} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No additional instructions.</p>
              )}

              {studentView && finalScore && (
                <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-2xl border border-canvas-blue/20 bg-gradient-to-br from-canvas-blueTint via-white to-white p-6 shadow-sm">
                  <div className="flex flex-col items-center text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-canvas-blueDark">
                      Your score
                    </p>
                    <div className="mt-3">
                      <ScoreDial percent={finalScorePct} size={104} />
                    </div>
                    <p className="mt-3 flex items-baseline justify-center gap-1 text-canvas-grayDark">
                      <span className="text-4xl font-bold leading-none">
                        {formatScore(finalScore.score)}
                      </span>
                      <span className="text-lg font-medium text-gray-400">
                        / {finalScore.maxScore}
                      </span>
                    </p>
                    <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-gray-500">
                      <span>
                        {finalScore.attemptCount} attempt
                        {finalScore.attemptCount === 1 ? "" : "s"}
                      </span>
                      {quiz.allowMultipleAttempts && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center rounded-full bg-canvas-blue/10 px-2 py-0.5 font-medium text-canvas-blueDark">
                            {QUIZ_SCORING_POLICY_LABELS[getQuizScoringPolicy(quiz)]}
                          </span>
                        </>
                      )}
                    </p>
                    {attemptStats && (
                      <p className="mt-1 text-xs text-gray-400">
                        Last submitted {formatQuizDateTime(attemptStats.lastSubmittedAt)}
                      </p>
                    )}
                    {attemptStats && attemptStats.attemptCount > 1 && (
                      <div className="mt-4 grid w-full grid-cols-4 gap-2 border-t border-canvas-blue/10 pt-4">
                        {[
                          { label: "Highest", value: attemptStats.highest },
                          { label: "Latest", value: attemptStats.latest },
                          { label: "Average", value: attemptStats.average },
                          { label: "Lowest", value: attemptStats.lowest },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-lg bg-white/70 px-2 py-2">
                            <p className="text-sm font-semibold text-canvas-grayDark">
                              {formatScore(stat.value)}
                            </p>
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">
                              {stat.label}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-10 flex flex-col items-center gap-2">
                {studentView ? (
                  canResume ? (
                    <Link
                      to={takePath}
                      className="btn-canvas-primary px-8 py-2.5 text-sm font-semibold"
                    >
                      Resume Quiz
                    </Link>
                  ) : canRetake ? (
                    <Link
                      to={takePath}
                      className="btn-canvas-primary px-8 py-2.5 text-sm font-semibold"
                    >
                      {priorAttempts.length > 0 ? "Retake Quiz" : "Take Quiz"}
                    </Link>
                  ) : lockedAt || notYetAvailable ? null : (
                    <button
                      type="button"
                      disabled
                      className="btn-canvas-primary cursor-not-allowed px-8 py-2.5 text-sm font-semibold opacity-50"
                    >
                      Take Quiz
                    </button>
                  )
                ) : (
                  <Link
                    to={previewPath}
                    className="btn-canvas-primary px-8 py-2.5 text-sm font-semibold"
                  >
                    Preview
                  </Link>
                )}
                {canResume && (
                  <span className="text-xs font-medium text-canvas-blueDark">
                    You have an attempt in progress
                  </span>
                )}
                {studentView && !canResume && canRetake && quiz.allowMultipleAttempts && remaining !== Infinity && (
                  <span className="text-xs text-gray-500">
                    {remaining} attempt{remaining === 1 ? "" : "s"} remaining
                  </span>
                )}
              </div>

              {studentView && !canTake && notYetAvailable && (
                <p className="mt-8 border-t border-gray-300 pt-4 text-sm text-gray-700">
                  This quiz is not yet available.
                  {quiz.availableFrom
                    ? ` It will open ${formatQuizDateTime(quiz.availableFrom)}.`
                    : ""}
                </p>
              )}

              {studentView && !canTake && lockedAt && (
                <p className="mt-8 border-t border-gray-300 pt-4 text-sm text-gray-700">
                  This quiz was locked {formatQuizDateTime(lockedAt)}.
                </p>
              )}

              {studentView && !canTake && !notYetAvailable && !lockedAt && !hasQuestions && (
                <p className="mt-8 border-t border-gray-300 pt-4 text-sm text-gray-700">
                  This quiz doesn't have any questions yet.
                </p>
              )}

              {studentView && !canRetake && remaining <= 0 && priorAttempts.length > 0 && (
                <p className="mt-8 border-t border-gray-300 pt-4 text-sm text-gray-700">
                  You have used all of your attempts for this quiz.
                </p>
              )}
            </div>

            {!studentView && (
              <aside className="lg:pt-2">
                <h3 className="text-sm font-semibold text-canvas-grayDark">Related Items</h3>
                <ul className="mt-3 divide-y divide-gray-200 border-t border-gray-200">
                  <li>
                    <Link
                      to={`/courses/${effectiveCourseId}/quizzes/${quizId}/statistics`}
                      className="flex w-full items-center gap-3 py-3 text-left text-sm text-canvas-blue hover:underline"
                    >
                      <BarChart3 className="h-4 w-4 shrink-0 text-gray-500" />
                      Quiz Statistics
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={previewPath}
                      className="flex w-full items-center gap-3 py-3 text-left text-sm text-canvas-blue hover:underline"
                    >
                      <Rocket className="h-4 w-4 shrink-0 text-gray-500" />
                      See Full Quiz
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={`/courses/${effectiveCourseId}/quizzes/${quizId}/grade`}
                      className="flex w-full items-center gap-3 py-3 text-left text-sm text-canvas-blue hover:underline"
                    >
                      <BadgeCheck className="h-4 w-4 shrink-0 text-gray-500" />
                      GradePro
                    </Link>
                  </li>
                </ul>
              </aside>
            )}

            {studentView && priorAttempts.length > 0 && (
              <aside className="lg:pt-2">
                <h3 className="text-sm font-semibold text-canvas-grayDark">Your submission</h3>
                <ul className="mt-3 divide-y divide-gray-200 border-t border-gray-200">
                  <li>
                    <Link
                      to={`/courses/${effectiveCourseId}/quizzes/${quizId}/submission`}
                      className="flex w-full items-center gap-3 py-3 text-left text-sm text-canvas-blue hover:underline"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-gray-500" />
                      Submission Details
                    </Link>
                  </li>
                </ul>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
