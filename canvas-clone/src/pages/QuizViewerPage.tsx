import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  FileText,
  Pencil,
  Rocket,
  ShieldAlert,
  UserCog,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import BackToModulesButton from "../components/BackToModulesButton";
import GradeActionButton from "../components/GradeActionButton";
import RichContentViewer from "../components/RichContentViewer";
import ScoreDial from "../components/ScoreDial";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import { usePermissions } from "../utils/permissions";
import { resolveStudentBackPath } from "../utils/courseNavigation";
import { getCourseById } from "../utils/coursesStore";
import {
  downloadJsonFile,
  exportQuizToJson,
  quizExportFilename,
} from "../utils/quizExport";
import {
  downloadTextFile,
  exportQuizToQtiXml,
  quizQtiFilename,
} from "../utils/quizQtiExport";
import {
  isQuizAccessUnlocked,
  quizRequiresAccessCode,
  unlockQuizAccess,
  verifyQuizAccessCode,
} from "../utils/quizAccess";
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
  getQuizType,
  isQuizNotYetAvailable,
  isStudentViewableQuiz,
  loadQuizzes,
  QUIZ_SCORING_POLICY_LABELS,
  QUIZ_TYPE_LABELS,
  quizShowsResponses,
  quizShowsScoreToStudent,
  saveQuizzes,
} from "../utils/quizzes";
import {
  getAttemptEffectiveScore,
  getRemainingAttempts,
  getScoringPolicyAttempt,
  getStudentAttemptStats,
  getStudentAttemptsForQuiz,
  getStudentFinalScore,
} from "../utils/quizSubmissions";
import {
  finalizeExpiredQuizProgress,
  getQuizProgress,
  isQuizProgressExpired,
} from "../utils/quizProgress";
import {
  getQuizAccommodationBreakdown,
  getEffectiveTimeLimitMinutes,
  isQuizAvailabilityUnlocked,
  QUIZ_ACCOMMODATIONS_CHANGED_EVENT,
} from "../utils/quizAccommodations";
import { loadUser } from "../utils/userStore";
import { applyEffectiveDates, hasDueDateOverrides } from "../utils/dueDateOverrides";

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm text-canvas-grayDark">
      <span className="font-semibold">{label}</span> <span>{value}</span>
    </div>
  );
}

function AccessCodeMeta({
  code,
  showCode,
  locked,
}: {
  code: string;
  showCode: boolean;
  locked: boolean;
}) {
  const { showToast } = useToast();
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast("Access code copied", "positive");
    } catch {
      showToast("Could not copy access code", "negative");
    }
  };

  if (!showCode) {
    return <MetaCell label="Access code" value={locked ? "Locked" : "Required"} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-canvas-grayDark">
      <span>
        <span className="font-semibold">Access code</span>{" "}
        <span className="font-mono tracking-wide">{code}</span>
      </span>
      <button
        type="button"
        onClick={() => void copyCode()}
        className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
        title="Copy access code"
      >
        <Copy className="h-3 w-3" />
        Copy
      </button>
    </div>
  );
}

export default function QuizViewerPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const { canEditCourseContent: canEdit } = usePermissions();
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
  const [accessUnlocked, setAccessUnlocked] = useState(() => {
    if (!quizId) return false;
    const q = getQuizById(effectiveCourseId, quizId);
    return isQuizAccessUnlocked(effectiveCourseId, quizId, q?.accessCode);
  });
  const [accessDraft, setAccessDraft] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;
    setAccessUnlocked(
      isQuizAccessUnlocked(effectiveCourseId, quizId, quiz?.accessCode),
    );
  }, [effectiveCourseId, quizId, quiz?.accessCode]);

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

  useEffect(() => {
    const bump = () => setRefreshTick((t) => t + 1);
    window.addEventListener(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, bump);
  }, []);

  // If a saved in-progress attempt has already run out of time, submit it now
  // (registering its score) so the student sees a completed attempt and "Retake"
  // rather than a stale "Resume".
  useEffect(() => {
    if (!studentView || !quiz) return;
    let cancelled = false;
    void (async () => {
      const finalized = await finalizeExpiredQuizProgress(effectiveCourseId, quiz);
      if (finalized && !cancelled) setRefreshTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
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

  if (!quiz || !quizId) {
    return (
      <div className="flex h-full w-full flex-col bg-canvas-grayLight">
        <CourseHeader />
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-gray-500">
          Quiz not found.
        </div>
      </div>
    );
  }

  const now = Date.now();
  const studentId = loadUser().id;
  const datedQuiz = studentView
    ? applyEffectiveDates(effectiveCourseId, "quiz", quiz, studentId)
    : quiz;
  const availabilityUnlocked = studentView
    ? isQuizAvailabilityUnlocked(effectiveCourseId, studentId, quiz.id)
    : false;
  const notYetAvailable = !availabilityUnlocked && isQuizNotYetAvailable(datedQuiz, now);
  const lockedAt = availabilityUnlocked ? null : getQuizLockedAt(datedQuiz, now);
  const canTake = canStudentTakeQuiz(quiz, now, {
    courseId: effectiveCourseId,
    studentId: studentView ? studentId : undefined,
  });
  const availabilityRange = formatQuizAvailabilityRange(datedQuiz);
  const timeLimit = formatTimeLimitDisplay(
    studentView
      ? getEffectiveTimeLimitMinutes(quiz, effectiveCourseId, studentId) ??
          quiz.timeLimitMinutes
      : quiz.timeLimitMinutes,
  );
  const questionCount = getQuizQuestionCount(quiz);
  const accommodationBreakdown = studentView
    ? getQuizAccommodationBreakdown(effectiveCourseId, studentId, quiz.id)
    : {
        courseWide: {
          extraMinutes: 0,
          extraAttempts: 0,
          timeMultiplier: 1,
          unlockAvailability: false,
        },
        perQuiz: {
          extraMinutes: 0,
          extraAttempts: 0,
          timeMultiplier: 1,
          unlockAvailability: false,
        },
        effective: {
          extraMinutes: 0,
          extraAttempts: 0,
          timeMultiplier: 1,
          unlockAvailability: false,
        },
      };
  const accommodation = accommodationBreakdown.effective;
  const attemptsLabel = (() => {
    const base = getQuizAllowedAttemptsLabel(quiz);
    if (!studentView || accommodation.extraAttempts <= 0) return base;
    return `${base} (+${accommodation.extraAttempts} extra)`;
  })();

  const dueLabel = datedQuiz.dueAt ? formatQuizDateTime(datedQuiz.dueAt) : "No due date";
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
  const policyAttempt = studentView
    ? getScoringPolicyAttempt(effectiveCourseId, quiz)
    : undefined;
  const scoreVisible =
    studentView &&
    quizShowsScoreToStudent(quiz, {
      courseId: effectiveCourseId,
      studentId,
      attempt: policyAttempt ?? priorAttempts[priorAttempts.length - 1] ?? null,
    });
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
    !!inProgress && !isQuizProgressExpired(effectiveCourseId, quiz, inProgress, now);
  const canResume = hasInProgress && canTake;
  // Only prompt for the access code once the quiz window is open and they can
  // start or resume — not while locked / not yet available.
  const needsAccessCode =
    studentView &&
    quizRequiresAccessCode(quiz.accessCode) &&
    !accessUnlocked &&
    (canResume || canRetake);
  const quizType = getQuizType(quiz);

  const submitAccessCode = (e: FormEvent) => {
    e.preventDefault();
    if (!verifyQuizAccessCode(quiz.accessCode, accessDraft)) {
      setAccessError("Incorrect access code.");
      return;
    }
    unlockQuizAccess(effectiveCourseId, quiz.id, accessDraft);
    setAccessUnlocked(true);
    setAccessError(null);
    setAccessDraft("");
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <BackToModulesButton courseId={effectiveCourseId} />
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
                    {canEdit && (
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
                    )}
                    {canEdit && (
                    <Link
                      to={`/courses/${effectiveCourseId}/quizzes/${quizId}/edit`}
                      title="Edit quiz"
                      aria-label="Edit quiz"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                    )}
                    <button
                      type="button"
                      title="Export quiz as JSON"
                      aria-label="Export quiz as JSON"
                      onClick={() => {
                        downloadJsonFile(
                          quizExportFilename(quiz.title),
                          exportQuizToJson(quiz),
                        );
                        showToast("Quiz exported as JSON", "positive");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </button>
                    <button
                      type="button"
                      title="Export quiz as QTI XML"
                      aria-label="Export quiz as QTI XML"
                      onClick={() => {
                        downloadTextFile(
                          quizQtiFilename(quiz.title),
                          exportQuizToQtiXml(quiz),
                          "application/xml",
                        );
                        showToast("Quiz exported as QTI XML", "positive");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      QTI
                    </button>
                    <GradeActionButton
                      to={`/courses/${effectiveCourseId}/quizzes/${quizId}/grade`}
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 border-y border-gray-300 py-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetaCell
                  label="Due"
                  value={
                    !studentView && hasDueDateOverrides(effectiveCourseId, "quiz", quiz.id)
                      ? `${dueLabel} · Multiple dates`
                      : dueLabel
                  }
                />
                <MetaCell label="Points" value={pointsLabel} />
                <MetaCell label="Questions" value={questionsLabel} />
                <MetaCell
                  label="Available"
                  value={availabilityRange ?? "Always available"}
                />
                <MetaCell label="Time Limit" value={timeLimit ?? "None"} />
                <MetaCell label="Allowed Attempts" value={attemptsLabel} />
                <MetaCell label="Type" value={QUIZ_TYPE_LABELS[quizType]} />
                {quizRequiresAccessCode(quiz.accessCode) && (
                  <AccessCodeMeta
                    code={quiz.accessCode!.trim()}
                    showCode={!studentView}
                    locked={!accessUnlocked}
                  />
                )}
              </div>

              <h2 className="mt-8 text-xl font-semibold text-canvas-grayDark">Instructions</h2>
              {quiz.description ? (
                <div className="prose prose-sm mt-4 max-w-none text-canvas-grayDark">
                  <RichContentViewer html={quiz.description} courseId={effectiveCourseId} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No additional instructions.</p>
              )}

              {studentView &&
                (accommodation.extraMinutes > 0 ||
                  accommodation.extraAttempts > 0 ||
                  accommodation.timeMultiplier > 1 ||
                  accommodation.unlockAvailability) && (
                  <div className="mt-6 rounded-lg border border-canvas-blue/20 bg-canvas-blueTint/40 px-4 py-3 text-sm text-canvas-grayDark">
                    <p className="font-semibold">Accommodations for this quiz</p>
                    <ul className="mt-1 list-inside list-disc text-gray-600">
                      {accommodation.timeMultiplier > 1 && (
                        <li>
                          {accommodation.timeMultiplier}× time limit
                          {(accommodationBreakdown.courseWide.timeMultiplier > 1 ||
                            accommodationBreakdown.perQuiz.timeMultiplier > 1) && (
                            <span className="text-gray-500">
                              {" "}
                              (
                              {[
                                accommodationBreakdown.courseWide.timeMultiplier > 1
                                  ? `${accommodationBreakdown.courseWide.timeMultiplier}× course-wide`
                                  : null,
                                accommodationBreakdown.perQuiz.timeMultiplier > 1
                                  ? `${accommodationBreakdown.perQuiz.timeMultiplier}× for this quiz`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                              )
                            </span>
                          )}
                        </li>
                      )}
                      {accommodation.extraMinutes > 0 && (
                        <li>
                          +{accommodation.extraMinutes} minute
                          {accommodation.extraMinutes === 1 ? "" : "s"} on the time limit
                          {(accommodationBreakdown.courseWide.extraMinutes > 0 ||
                            accommodationBreakdown.perQuiz.extraMinutes > 0) && (
                            <span className="text-gray-500">
                              {" "}
                              (
                              {[
                                accommodationBreakdown.courseWide.extraMinutes > 0
                                  ? `${accommodationBreakdown.courseWide.extraMinutes} course-wide`
                                  : null,
                                accommodationBreakdown.perQuiz.extraMinutes > 0
                                  ? `${accommodationBreakdown.perQuiz.extraMinutes} for this quiz`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                              )
                            </span>
                          )}
                        </li>
                      )}
                      {accommodation.extraAttempts > 0 && (
                        <li>
                          +{accommodation.extraAttempts} attempt
                          {accommodation.extraAttempts === 1 ? "" : "s"}
                          {(accommodationBreakdown.courseWide.extraAttempts > 0 ||
                            accommodationBreakdown.perQuiz.extraAttempts > 0) && (
                            <span className="text-gray-500">
                              {" "}
                              (
                              {[
                                accommodationBreakdown.courseWide.extraAttempts > 0
                                  ? `${accommodationBreakdown.courseWide.extraAttempts} course-wide`
                                  : null,
                                accommodationBreakdown.perQuiz.extraAttempts > 0
                                  ? `${accommodationBreakdown.perQuiz.extraAttempts} for this quiz`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                              )
                            </span>
                          )}
                        </li>
                      )}
                      {accommodation.unlockAvailability && (
                        <li>Available outside the normal availability window</li>
                      )}
                    </ul>
                    {accommodation.note && (
                      <p className="mt-2 text-xs text-gray-500">Note: {accommodation.note}</p>
                    )}
                  </div>
                )}

              {studentView && finalScore && scoreVisible && (
                <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-2xl border border-canvas-blue/20 bg-gradient-to-br from-canvas-blueTint via-white to-white p-6 shadow-sm">
                  <div className="flex flex-col items-center text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-canvas-blueDark">
                      {quizType === "practice" ? "Practice score" : "Your score"}
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
                    {typeof policyAttempt?.fudgePoints === "number" &&
                      policyAttempt.fudgePoints !== 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          Includes {policyAttempt.fudgePoints > 0 ? "+" : ""}
                          {formatScore(policyAttempt.fudgePoints)} fudge
                        </p>
                      )}
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
                    {priorAttempts.length > 1 && (
                      <div className="mt-4 w-full border-t border-canvas-blue/10 pt-4 text-left">
                        <label className="block text-xs font-medium text-gray-600">
                          View attempt
                          <select
                            className="form-input mt-1.5 h-9 w-full text-sm"
                            defaultValue=""
                            onChange={(e) => {
                              const id = e.target.value;
                              if (!id) return;
                              navigate(
                                `/courses/${effectiveCourseId}/quizzes/${quizId}/take?review=1&attempt=${encodeURIComponent(id)}`,
                              );
                              e.target.value = "";
                            }}
                          >
                            <option value="" disabled>
                              Choose an attempt…
                            </option>
                            {priorAttempts.map((a) => {
                              const counts = policyAttempt?.id === a.id;
                              const pts = scoreVisible
                                ? formatScore(getAttemptEffectiveScore(a))
                                : "—";
                              return (
                                <option key={a.id} value={a.id}>
                                  Attempt {a.attemptNumber}
                                  {scoreVisible ? ` · ${pts} pts` : ""}
                                  {counts ? " · counts toward score" : ""}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        {quiz.allowMultipleAttempts && (
                          <p className="mt-1.5 text-[11px] text-gray-400">
                            Showing{" "}
                            {QUIZ_SCORING_POLICY_LABELS[getQuizScoringPolicy(quiz)].toLowerCase()}
                            {` of ${priorAttempts.length}`}
                          </p>
                        )}
                      </div>
                    )}
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

              {studentView && priorAttempts.length > 0 && !scoreVisible && (
                <div className="mx-auto mt-8 max-w-md rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-center text-sm text-gray-600">
                  {quizType === "survey"
                    ? "Survey submitted. Thank you — no score is shown for surveys."
                    : quiz.hideScoreUntilGraded
                      ? "Your score will appear once this attempt is fully graded."
                      : "Your score is hidden until your instructor posts grades for this quiz."}
                  {priorAttempts.length > 1 && quizShowsResponses(quiz) && (
                    <div className="mt-3 text-left">
                      <label className="block text-xs font-medium text-gray-600">
                        View attempt
                        <select
                          className="form-input mt-1.5 h-9 w-full text-sm"
                          defaultValue=""
                          onChange={(e) => {
                            const id = e.target.value;
                            if (!id) return;
                            navigate(
                              `/courses/${effectiveCourseId}/quizzes/${quizId}/take?review=1&attempt=${encodeURIComponent(id)}`,
                            );
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>
                            Choose an attempt…
                          </option>
                          {priorAttempts.map((a) => (
                            <option key={a.id} value={a.id}>
                              Attempt {a.attemptNumber}
                              {policyAttempt?.id === a.id ? " · counts toward score" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-10 flex flex-col items-center gap-2">
                {studentView ? (
                  needsAccessCode ? (
                    <form
                      onSubmit={submitAccessCode}
                      className="w-full max-w-sm rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-canvas-grayDark">
                        Access code required
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Enter the code from your instructor to unlock this quiz.
                      </p>
                      <input
                        type="text"
                        value={accessDraft}
                        onChange={(e) => {
                          setAccessDraft(e.target.value);
                          setAccessError(null);
                        }}
                        className="form-input mt-3 h-10"
                        placeholder="Access code"
                        autoComplete="off"
                      />
                      {accessError && (
                        <p className="mt-1.5 text-xs text-red-600">{accessError}</p>
                      )}
                      <button type="submit" className="btn-canvas-primary mt-3 w-full">
                        Unlock quiz
                      </button>
                    </form>
                  ) : canResume ? (
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
                      {priorAttempts.length > 0
                        ? quizType === "survey"
                          ? "Retake survey"
                          : "Retake Quiz"
                        : quizType === "survey"
                          ? "Start survey"
                          : "Take Quiz"}
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
                {!studentView && quizRequiresAccessCode(quiz.accessCode) && (
                  <span className="text-xs text-gray-500">
                    Preview does not require the access code.
                  </span>
                )}
                {canResume && !needsAccessCode && (
                  <span className="text-xs font-medium text-canvas-blueDark">
                    You have an attempt in progress
                  </span>
                )}
                {studentView &&
                  !needsAccessCode &&
                  !canResume &&
                  canRetake &&
                  quiz.allowMultipleAttempts &&
                  remaining !== Infinity && (
                  <span className="text-xs text-gray-500">
                    {remaining} attempt{remaining === 1 ? "" : "s"} remaining
                  </span>
                )}
              </div>

              {studentView && !canTake && notYetAvailable && (
                <p className="mt-8 border-t border-gray-300 pt-4 text-sm text-gray-700">
                  This quiz is not yet available.
                  {datedQuiz.availableFrom
                    ? ` It will open ${formatQuizDateTime(datedQuiz.availableFrom)}.`
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
                      to={`/courses/${effectiveCourseId}/quizzes/${quizId}/moderate`}
                      className="flex w-full items-center gap-3 py-3 text-left text-sm text-canvas-blue hover:underline"
                    >
                      <UserCog className="h-4 w-4 shrink-0 text-gray-500" />
                      Moderate this Quiz
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={`/courses/${effectiveCourseId}/quizzes/${quizId}/similarity`}
                      className="flex w-full items-center gap-3 py-3 text-left text-sm text-canvas-blue hover:underline"
                    >
                      <ShieldAlert className="h-4 w-4 shrink-0 text-gray-500" />
                      Similarity Inbox
                    </Link>
                  </li>
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
