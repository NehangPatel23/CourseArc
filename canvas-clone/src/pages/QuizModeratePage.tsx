import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Mail,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Timer,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import CanvasModal from "../components/CanvasModal";
import CourseHeader from "../components/CourseHeader";
import PageIdentityHeader from "../components/PageIdentityHeader";
import QuizQuestionCard from "../components/QuizQuestionCard";
import { useToast } from "../components/ui/Toast";
import { usePermissions } from "../utils/permissions";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import {
  ACCOMMODATION_TIME_EXPLAINER,
  exportAccommodationsPayload,
  formatAccommodationGrantParts,
  getQuizAccommodation,
  getQuizAccommodationBreakdown,
  importAccommodationsPayload,
  normalizeTimeMultiplier,
  QUIZ_ACCOMMODATIONS_CHANGED_EVENT,
  setQuizAccommodation,
  type EffectiveQuizAccommodation,
} from "../utils/quizAccommodations";
import { loadRoster, COURSE_ROSTER_CHANGED_EVENT, type RosterMember } from "../utils/courseRoster";
import {
  formatQuizDateTime,
  formatTimeLimitDisplay,
  getQuizAllowedAttemptsLabel,
  getQuizById,
  getQuizType,
  quizItemLabel,
  type Quiz,
} from "../utils/quizzes";
import {
  deleteQuizAttempt,
  deleteStudentQuizAttempts,
  describePartialCredit,
  formatQuizSubmitReason,
  getAttemptEffectiveScore,
  getRemainingAttempts,
  getStudentAttemptsForQuiz,
  gradeQuizAttempt,
  hasAnswer,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
  resolveQuizQuestions,
  setAttemptKeepForGrade,
  type QuizAttempt,
} from "../utils/quizSubmissions";
import {
  bulkExtendInProgressAttempts,
  clearQuizProgress,
  extendInProgressAttempt,
  forceSubmitInProgressAttempt,
  getProgressTimeLimitMinutes,
  listInProgressForQuiz,
  QUIZ_PROGRESS_CHANGED_EVENT,
  type QuizProgressChangedDetail,
} from "../utils/quizProgress";
import { sendInboxMessage } from "../utils/inbox";
import { matchesSearch } from "../utils/listFilters";
import { initialsFromName } from "../utils/avatar";
import { loadUser } from "../utils/userStore";

type ProgressSort =
  | "leaves-desc"
  | "leaves-asc"
  | "time-left-asc"
  | "time-left-desc";

type Draft = {
  extraMinutes: string;
  extraAttempts: string;
  timeMultiplier: string;
  unlockAvailability: boolean;
  note: string;
};

const EMPTY_DRAFT: Draft = {
  extraMinutes: "",
  extraAttempts: "",
  timeMultiplier: "",
  unlockAvailability: false,
  note: "",
};

function draftFromAccommodation(
  courseId: string,
  studentId: string,
  quizId: string,
): Draft {
  const row = getQuizAccommodation(courseId, studentId, quizId);
  return {
    extraMinutes: row?.extraMinutes ? String(row.extraMinutes) : "",
    extraAttempts: row?.extraAttempts ? String(row.extraAttempts) : "",
    timeMultiplier:
      row?.timeMultiplier && row.timeMultiplier > 1 ? String(row.timeMultiplier) : "",
    unlockAvailability: Boolean(row?.unlockAvailability),
    note: row?.note ?? "",
  };
}

function parseExtra(value: string): number | null {
  if (value.trim() === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function parseMultiplier(value: string): number | null {
  if (value.trim() === "") return 1;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return normalizeTimeMultiplier(n);
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    (a.extraMinutes.trim() || "0") === (b.extraMinutes.trim() || "0") &&
    (a.extraAttempts.trim() || "0") === (b.extraAttempts.trim() || "0") &&
    (a.timeMultiplier.trim() || "1") === (b.timeMultiplier.trim() || "1") &&
    Boolean(a.unlockAvailability) === Boolean(b.unlockAvailability) &&
    (a.note.trim() || "") === (b.note.trim() || "")
  );
}

function loadDraftMap(
  courseId: string,
  quizId: string,
  students: RosterMember[],
): Record<string, Draft> {
  const next: Record<string, Draft> = {};
  for (const m of students) {
    next[m.id] = draftFromAccommodation(courseId, m.id, quizId);
  }
  return next;
}

function draftToEffective(
  draft: Draft,
  courseWide: EffectiveQuizAccommodation,
): EffectiveQuizAccommodation {
  const minutes = parseExtra(draft.extraMinutes) ?? 0;
  const attempts = parseExtra(draft.extraAttempts) ?? 0;
  const mult = parseMultiplier(draft.timeMultiplier) ?? 1;
  return {
    extraMinutes: Math.max(courseWide.extraMinutes, minutes),
    extraAttempts: Math.max(courseWide.extraAttempts, attempts),
    timeMultiplier: Math.max(courseWide.timeMultiplier, mult),
    unlockAvailability: courseWide.unlockAvailability || draft.unlockAvailability,
    note: draft.note.trim() || courseWide.note,
  };
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatUpdatedAt(ts?: number): string | null {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

type AttemptsPreviewTarget = {
  studentId: string;
  studentName: string;
};

type PendingAttemptDelete =
  | { mode: "specific"; attemptId: string; attemptNumber: number }
  | { mode: "all" };

function StudentAttemptsPreviewModal({
  courseId,
  quiz,
  studentId,
  studentName,
  onClose,
  onDeleted,
}: {
  courseId: string;
  quiz: Quiz;
  studentId: string;
  studentName: string;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  const [attemptRev, setAttemptRev] = useState(0);

  useEffect(() => {
    const bump = () => setAttemptRev((v) => v + 1);
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, bump);
  }, []);

  const attempts = useMemo(
    () => getStudentAttemptsForQuiz(courseId, quiz.id, studentId),
    [courseId, quiz.id, studentId, attemptRev],
  );
  const ordered = useMemo(
    () => [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber),
    [attempts],
  );
  const remaining = getRemainingAttempts(quiz, courseId, studentId);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => ordered[0]?.id ?? null,
  );
  const [pendingDelete, setPendingDelete] = useState<PendingAttemptDelete | null>(
    null,
  );

  useEffect(() => {
    if (ordered.length === 0) {
      onClose();
      return;
    }
    if (!selectedId || !ordered.some((a) => a.id === selectedId)) {
      setSelectedId(ordered[0]!.id);
    }
  }, [ordered, selectedId, onClose]);

  const selected: QuizAttempt | undefined =
    ordered.find((a) => a.id === selectedId) ?? ordered[0];

  const questions = useMemo(() => {
    if (!selected) return [];
    return resolveQuizQuestions(courseId, quiz, {
      studentId,
      attemptId: selected.id,
      attemptNumber: selected.attemptNumber,
      questionIds: selected.questionIds,
    });
  }, [
    courseId,
    quiz,
    studentId,
    selected?.id,
    selected?.attemptNumber,
    selected?.questionIds,
  ]);

  const isSurvey = getQuizType(quiz) === "survey";

  const creditById = useMemo(() => {
    const map = new Map<
      string,
      { correct: boolean; partial?: boolean; earned: number; possible: number }
    >();
    if (!selected || isSurvey) return map;
    const graded = gradeQuizAttempt(quiz, selected.answers, questions);
    for (const p of graded.perQuestion) {
      const override = selected.questionScores?.[p.questionId];
      map.set(p.questionId, {
        correct: p.correct,
        partial: p.partial,
        earned: typeof override === "number" ? override : p.earned,
        possible: p.possible,
      });
    }
    return map;
  }, [selected?.id, selected?.answers, selected?.questionScores, quiz, questions, isSurvey]);

  const answeredCount = selected
    ? selected.answers.filter((a) => hasAnswer(a)).length
    : 0;
  const questionCount = questions.filter(
    (q) => q.type !== "note" && q.type !== "group",
  ).length;
  const score = selected ? getAttemptEffectiveScore(selected) : 0;
  const reasonLabel = selected
    ? formatQuizSubmitReason(selected.submitReason)
    : null;
  const durationMs =
    selected?.startedAt && selected.submittedAt
      ? Math.max(0, selected.submittedAt - selected.startedAt)
      : null;

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.mode === "all") {
      const n = deleteStudentQuizAttempts(courseId, quiz.id, studentId);
      setPendingDelete(null);
      onDeleted(n === 1 ? "Attempt deleted" : `Deleted ${n} attempts`);
      return;
    }
    deleteQuizAttempt(courseId, pendingDelete.attemptId);
    setPendingDelete(null);
    onDeleted(`Attempt #${pendingDelete.attemptNumber} deleted`);
  };

  return (
    <CanvasModal title={`Attempts · ${studentName}`} onClose={onClose} size="preview">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-gray-100 bg-gradient-to-r from-slate-50 via-white to-sky-50/40 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas-blueTint text-sm font-semibold text-canvas-blueDark">
              {initialsFromName(studentName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-canvas-grayDark">
                {studentName}
              </p>
              <p className="text-sm text-gray-500">
                {attempts.length} submitted attempt
                {attempts.length === 1 ? "" : "s"}
                {" · "}
                {remaining === Infinity ? "Unlimited" : remaining} remaining
                {" · "}
                {quiz.title}
              </p>
            </div>
            {selected && (
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-right shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Attempt #{selected.attemptNumber}
                </p>
                <p className="text-lg font-bold tabular-nums text-canvas-grayDark">
                  {Number.isFinite(score) ? score : "—"}
                  <span className="text-sm font-medium text-gray-400">
                    {" "}
                    / {selected.maxScore}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex max-h-[32vh] w-full shrink-0 flex-col border-b border-gray-100 bg-slate-50/70 md:max-h-none md:w-[240px] md:border-b-0 md:border-r">
            <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Attempts
            </p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {ordered.map((attempt) => {
                const attemptScore = getAttemptEffectiveScore(attempt);
                const active = selected?.id === attempt.id;
                return (
                  <button
                    key={attempt.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(attempt.id);
                      setPendingDelete(null);
                    }}
                    className={[
                      "w-full rounded-xl border px-3 py-2.5 text-left transition",
                      active
                        ? "border-canvas-blue bg-white shadow-sm ring-1 ring-canvas-blue/20"
                        : "border-transparent bg-white/80 hover:border-gray-200 hover:bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-canvas-grayDark">
                          #{attempt.attemptNumber}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {formatQuizDateTime(attempt.submittedAt)}
                        </p>
                      </div>
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-sm font-bold tabular-nums text-canvas-grayDark">
                        {Number.isFinite(attemptScore) ? attemptScore : "—"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_120px)]">
            {selected ? (
              <div className="space-y-4 p-4 lg:p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-gray-200">
                    Submitted {formatQuizDateTime(selected.submittedAt)}
                  </span>
                  {durationMs != null && (
                    <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-gray-200">
                      Duration {formatElapsed(durationMs)}
                    </span>
                  )}
                  <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-gray-200">
                    Answered {answeredCount}/{questionCount || "—"}
                  </span>
                  {(selected.leaveCount ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-amber-100">
                      {selected.leaveCount} leave
                      {selected.leaveCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {selected.seatNumber?.trim() && (
                    <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-gray-200">
                      Seat {selected.seatNumber.trim()}
                    </span>
                  )}
                  {reasonLabel && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 ring-1 ring-amber-100">
                      {reasonLabel}
                    </span>
                  )}
                </div>

                {questions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
                    No questions to preview for this attempt.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {questions.map((question, qIndex) => {
                      const answer = selected.answers.find(
                        (a) => a.questionId === question.id,
                      );
                      const credit = creditById.get(question.id);
                      const unanswered =
                        question.type !== "note" &&
                        question.type !== "group" &&
                        !hasAnswer(answer);
                      return (
                        <QuizQuestionCard
                          key={question.id}
                          question={question}
                          index={qIndex}
                          label={quizItemLabel(questions, qIndex)}
                          answer={answer}
                          onChange={() => {}}
                          disabled
                          unanswered={unanswered}
                          revealKey={!isSurvey}
                          review={
                            question.type === "note" ||
                            question.type === "group" ||
                            isSurvey
                              ? undefined
                              : {
                                  correct: credit?.correct ?? false,
                                  partial: credit?.partial,
                                  earned: credit?.earned,
                                  possible:
                                    credit?.possible ??
                                    (question.points > 0 ? question.points : 0),
                                  partialNote:
                                    credit?.partial
                                      ? describePartialCredit(quiz, question, answer)
                                      : undefined,
                                }
                          }
                        />
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const keep = !selected.keepForGrade;
                      if (setAttemptKeepForGrade(courseId, selected.id, keep)) {
                        onDeleted(
                          keep
                            ? `Attempt #${selected.attemptNumber} pinned for grade`
                            : `Unpinned attempt #${selected.attemptNumber}`,
                        );
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
                      selected.keepForGrade
                        ? "border-canvas-blue bg-canvas-blueTint text-canvas-blueDark"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Pin className="h-4 w-4" />
                    {selected.keepForGrade ? "Kept for grade" : "Keep for grade"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDelete({
                        mode: "specific",
                        attemptId: selected.id,
                        attemptNumber: selected.attemptNumber,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-canvas-red hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete this attempt
                  </button>
                  <Link
                    to={`/courses/${courseId}/quizzes/${quiz.id}/grade?attempt=${selected.id}`}
                    className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-medium text-gray-500 hover:text-canvas-blue"
                    onClick={onClose}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Grade in GradePro
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-10 text-sm text-gray-500">
                No attempt selected
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-3">
          {pendingDelete ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                {pendingDelete.mode === "all" ? (
                  <>
                    Delete{" "}
                    <span className="font-semibold text-canvas-grayDark">
                      all {attempts.length} attempts
                    </span>{" "}
                    for {studentName}? This cannot be undone.
                  </>
                ) : (
                  <>
                    Delete{" "}
                    <span className="font-semibold text-canvas-grayDark">
                      attempt #{pendingDelete.attemptNumber}
                    </span>{" "}
                    for {studentName}? Remaining counts will update.
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="btn-canvas-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPendingDelete}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Scroll the quiz preview to review answers. Correctness uses the answer
                key when available.
              </p>
              <div className="flex flex-wrap gap-2">
                {attempts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ mode: "all" })}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-canvas-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete all attempts
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-canvas-secondary text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CanvasModal>
  );
}

export default function QuizModeratePage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const { canManageAccommodations } = usePermissions();
  const { showToast } = useToast();

  const [quiz, setQuiz] = useState<Quiz | undefined>(() =>
    quizId ? getQuizById(effectiveCourseId, quizId) : undefined,
  );
  const [roster, setRoster] = useState<RosterMember[]>(() =>
    loadRoster(effectiveCourseId).filter((m) => m.role === "student"),
  );
  const [search, setSearch] = useState("");
  const [onlyWithGrants, setOnlyWithGrants] = useState(false);
  const [baseline, setBaseline] = useState<Record<string, Draft>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const [, setStatsTick] = useState(0);
  const [progressSort, setProgressSort] = useState<ProgressSort>("leaves-desc");
  const [onlyWithLeaves, setOnlyWithLeaves] = useState(false);
  const [leaveFlashIds, setLeaveFlashIds] = useState<Set<string>>(() => new Set());
  const prevLeaveCountsRef = useRef<Record<string, number>>({});
  const leaveFlashTimersRef = useRef<Map<string, number>>(new Map());
  const accommodationsFileRef = useRef<HTMLInputElement>(null);
  const [attemptsPreview, setAttemptsPreview] = useState<AttemptsPreviewTarget | null>(
    null,
  );

  const quizPath = `/courses/${effectiveCourseId}/quizzes/${quizId}`;

  useEffect(() => {
    if (!canManageAccommodations) navigate(quizPath, { replace: true });
  }, [canManageAccommodations, navigate, quizPath]);

  useEffect(() => {
    const refreshMeta = () => {
      if (!quizId) return;
      setQuiz(getQuizById(effectiveCourseId, quizId));
      setRoster(loadRoster(effectiveCourseId).filter((m) => m.role === "student"));
      setStatsTick((t) => t + 1);
    };
    refreshMeta();
    window.addEventListener(COURSE_ROSTER_CHANGED_EVENT, refreshMeta);
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refreshMeta);
    window.addEventListener(QUIZ_PROGRESS_CHANGED_EVENT, refreshMeta);
    window.addEventListener("canvasClone:quizzesChanged", refreshMeta);
    return () => {
      window.removeEventListener(COURSE_ROSTER_CHANGED_EVENT, refreshMeta);
      window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refreshMeta);
      window.removeEventListener(QUIZ_PROGRESS_CHANGED_EVENT, refreshMeta);
      window.removeEventListener("canvasClone:quizzesChanged", refreshMeta);
    };
  }, [effectiveCourseId, quizId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of leaveFlashTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      leaveFlashTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!quizId) return;
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<QuizProgressChangedDetail>).detail;
      if (!detail || detail.courseId !== effectiveCourseId || detail.quizId !== quizId) {
        return;
      }
      const rows = listInProgressForQuiz(effectiveCourseId, quizId);
      const nextCounts: Record<string, number> = {};
      for (const row of rows) {
        const count = row.progress.leaveCount ?? 0;
        nextCounts[row.studentId] = count;
        const prev = prevLeaveCountsRef.current[row.studentId] ?? 0;
        if (count > prev) {
          const member = loadRoster(effectiveCourseId).find((m) => m.id === row.studentId);
          const name = member?.name ?? row.studentId;
          showToast(
            `${name} left the quiz (${count} leave${count === 1 ? "" : "s"})`,
            "neutral",
          );
          setLeaveFlashIds((prevSet) => {
            const next = new Set(prevSet);
            next.add(row.studentId);
            return next;
          });
          const existing = leaveFlashTimersRef.current.get(row.studentId);
          if (existing) window.clearTimeout(existing);
          const timer = window.setTimeout(() => {
            setLeaveFlashIds((prevSet) => {
              const next = new Set(prevSet);
              next.delete(row.studentId);
              return next;
            });
            leaveFlashTimersRef.current.delete(row.studentId);
          }, 4000);
          leaveFlashTimersRef.current.set(row.studentId, timer);
        }
      }
      prevLeaveCountsRef.current = nextCounts;
    };

    // Seed baseline leave counts so the first progress event only alerts on increases.
    const seed: Record<string, number> = {};
    for (const row of listInProgressForQuiz(effectiveCourseId, quizId)) {
      seed[row.studentId] = row.progress.leaveCount ?? 0;
    }
    prevLeaveCountsRef.current = seed;

    window.addEventListener(QUIZ_PROGRESS_CHANGED_EVENT, onProgress);
    return () => window.removeEventListener(QUIZ_PROGRESS_CHANGED_EVENT, onProgress);
  }, [effectiveCourseId, quizId, showToast]);

  useEffect(() => {
    if (!quizId) return;
    setDrafts((current) => {
      const hasDirty = roster.some((m) => {
        const saved = draftFromAccommodation(effectiveCourseId, m.id, quizId);
        const draft = current[m.id];
        return draft != null && !draftsEqual(draft, saved);
      });
      if (hasDirty && Object.keys(current).length > 0) return current;
      const next = loadDraftMap(effectiveCourseId, quizId, roster);
      setBaseline(next);
      return next;
    });
  }, [effectiveCourseId, quizId, roster]);

  useEffect(() => {
    const onExternal = () => {
      if (!quizId) return;
      setDrafts((current) => {
        const dirty = roster.some((m) => {
          const b = baseline[m.id] ?? EMPTY_DRAFT;
          const d = current[m.id] ?? EMPTY_DRAFT;
          return !draftsEqual(d, b);
        });
        if (dirty) return current;
        const next = loadDraftMap(effectiveCourseId, quizId, roster);
        setBaseline(next);
        return next;
      });
      setStatsTick((t) => t + 1);
    };
    window.addEventListener(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, onExternal);
    return () => window.removeEventListener(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, onExternal);
  }, [effectiveCourseId, quizId, roster, baseline]);

  const dirtyStudentIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of roster) {
      const b = baseline[m.id] ?? EMPTY_DRAFT;
      const d = drafts[m.id] ?? EMPTY_DRAFT;
      if (!draftsEqual(d, b)) ids.push(m.id);
    }
    return ids;
  }, [roster, baseline, drafts]);

  const isDirty = dirtyStudentIds.length > 0;
  const { leaveGuardModal } = useUnsavedChangesGuard(isDirty);

  const filtered = useMemo(() => {
    let list = roster;
    if (search.trim()) {
      list = list.filter(
        (m) => matchesSearch(m.name, search) || matchesSearch(m.email ?? "", search),
      );
    }
    if (onlyWithGrants) {
      list = list.filter((m) => {
        const d = drafts[m.id] ?? EMPTY_DRAFT;
        const cw = getQuizAccommodationBreakdown(effectiveCourseId, m.id, quizId ?? "")
          .courseWide;
        const eff = draftToEffective(d, cw);
        return (
          eff.extraMinutes > 0 ||
          eff.extraAttempts > 0 ||
          eff.timeMultiplier > 1 ||
          eff.unlockAvailability
        );
      });
    }
    return list;
  }, [roster, search, onlyWithGrants, drafts, effectiveCourseId, quizId]);

  const grantedCount = useMemo(() => {
    return roster.filter((m) => {
      const d = drafts[m.id] ?? EMPTY_DRAFT;
      const cw = getQuizAccommodationBreakdown(
        effectiveCourseId,
        m.id,
        quizId ?? "",
      ).courseWide;
      const eff = draftToEffective(d, cw);
      return (
        eff.extraMinutes > 0 ||
        eff.extraAttempts > 0 ||
        eff.timeMultiplier > 1 ||
        eff.unlockAvailability
      );
    }).length;
  }, [roster, drafts, effectiveCourseId, quizId]);

  const filteredIds = useMemo(() => filtered.map((m) => m.id), [filtered]);
  const selectedVisibleCount = useMemo(
    () => filteredIds.filter((id) => selectedIds.has(id)).length,
    [filteredIds, selectedIds],
  );
  const allFilteredSelected =
    filteredIds.length > 0 && selectedVisibleCount === filteredIds.length;

  const selectedTargetIds = useMemo(
    () => [...selectedIds].filter((id) => roster.some((m) => m.id === id)),
    [selectedIds, roster],
  );

  const inProgress = useMemo(() => {
    if (!quizId) return [];
    void now;
    return listInProgressForQuiz(effectiveCourseId, quizId);
  }, [effectiveCourseId, quizId, now, roster]);

  const displayedInProgress = useMemo(() => {
    if (!quiz) return [];
    let rows = inProgress;
    if (onlyWithLeaves) {
      rows = rows.filter((row) => (row.progress.leaveCount ?? 0) > 0);
    }
    const withMeta = rows.map((row) => {
      const limitMin = getProgressTimeLimitMinutes(
        effectiveCourseId,
        quiz,
        row.progress,
        row.studentId,
      );
      const elapsed = now - row.progress.startedAt;
      const remainingMs =
        limitMin != null ? limitMin * 60000 - elapsed : Number.POSITIVE_INFINITY;
      return { ...row, remainingMs, leaveCount: row.progress.leaveCount ?? 0 };
    });
    withMeta.sort((a, b) => {
      switch (progressSort) {
        case "leaves-asc":
          return a.leaveCount - b.leaveCount;
        case "leaves-desc":
          return b.leaveCount - a.leaveCount;
        case "time-left-asc":
          return a.remainingMs - b.remainingMs;
        case "time-left-desc":
          return b.remainingMs - a.remainingMs;
        default:
          return 0;
      }
    });
    return withMeta;
  }, [inProgress, onlyWithLeaves, progressSort, quiz, effectiveCourseId, now]);

  const rosterById = useMemo(() => {
    const map = new Map<string, RosterMember>();
    for (const m of roster) map.set(m.id, m);
    return map;
  }, [roster]);

  const answeredProgressLabel = (studentId: string, progress: (typeof inProgress)[number]["progress"]) => {
    if (!quiz) return null;
    const attemptNumber =
      getStudentAttemptsForQuiz(effectiveCourseId, quiz.id, studentId).length + 1;
    const questions = resolveQuizQuestions(effectiveCourseId, quiz, {
      studentId,
      attemptId: "in-progress",
      attemptNumber,
    }).filter((q) => q.type !== "note" && q.type !== "group");
    if (questions.length === 0) return null;
    const answerMap = new Map(progress.answers.map((a) => [a.questionId, a]));
    const answered = questions.filter((q) => hasAnswer(answerMap.get(q.id))).length;
    return `${answered}/${questions.length} answered`;
  };

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

  const updateDraft = (studentId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? EMPTY_DRAFT), ...patch },
    }));
  };

  const bumpMinutes = (studentId: string, amount: number) => {
    const current = parseExtra(drafts[studentId]?.extraMinutes ?? "") ?? 0;
    updateDraft(studentId, { extraMinutes: String(current + amount) });
  };

  const bumpAttempts = (studentId: string, amount: number) => {
    const current = parseExtra(drafts[studentId]?.extraAttempts ?? "") ?? 0;
    updateDraft(studentId, { extraAttempts: String(current + amount) });
  };

  const clearStudentDraft = (studentId: string) => {
    updateDraft(studentId, { ...EMPTY_DRAFT });
  };

  const toggleSelected = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

  const bulkBumpMinutes = (amount: number) => {
    if (selectedTargetIds.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedTargetIds) {
        const current = parseExtra(next[id]?.extraMinutes ?? "") ?? 0;
        next[id] = {
          ...(next[id] ?? EMPTY_DRAFT),
          extraMinutes: String(current + amount),
        };
      }
      return next;
    });
    showToast(
      `Added +${amount} minutes to ${selectedTargetIds.length} student${
        selectedTargetIds.length === 1 ? "" : "s"
      } (draft)`,
      "neutral",
    );
  };

  const bulkBumpAttempts = (amount: number) => {
    if (selectedTargetIds.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedTargetIds) {
        const current = parseExtra(next[id]?.extraAttempts ?? "") ?? 0;
        next[id] = {
          ...(next[id] ?? EMPTY_DRAFT),
          extraAttempts: String(current + amount),
        };
      }
      return next;
    });
    showToast(
      `Added +${amount} attempt${amount === 1 ? "" : "s"} to ${selectedTargetIds.length} student${
        selectedTargetIds.length === 1 ? "" : "s"
      } (draft)`,
      "neutral",
    );
  };

  const bulkClear = () => {
    if (selectedTargetIds.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedTargetIds) next[id] = { ...EMPTY_DRAFT };
      return next;
    });
    showToast(
      `Cleared grants for ${selectedTargetIds.length} student${
        selectedTargetIds.length === 1 ? "" : "s"
      } (draft)`,
      "neutral",
    );
  };

  const discardChanges = () => {
    setDrafts({ ...baseline });
    showToast("Changes discarded", "neutral");
  };

  const saveAll = () => {
    for (const studentId of dirtyStudentIds) {
      const draft = drafts[studentId] ?? EMPTY_DRAFT;
      if (
        parseExtra(draft.extraMinutes) == null ||
        parseExtra(draft.extraAttempts) == null ||
        parseMultiplier(draft.timeMultiplier) == null
      ) {
        showToast("Enter valid non-negative numbers (multiplier ≥ 1)", "negative");
        return;
      }
    }

    for (const studentId of dirtyStudentIds) {
      const draft = drafts[studentId] ?? EMPTY_DRAFT;
      setQuizAccommodation(effectiveCourseId, {
        studentId,
        quizId,
        extraMinutes: parseExtra(draft.extraMinutes) ?? 0,
        extraAttempts: parseExtra(draft.extraAttempts) ?? 0,
        timeMultiplier: parseMultiplier(draft.timeMultiplier) ?? 1,
        unlockAvailability: draft.unlockAvailability,
        note: draft.note,
      });
    }

    const next = loadDraftMap(effectiveCourseId, quizId, roster);
    setBaseline(next);
    setDrafts(next);
    showToast(
      dirtyStudentIds.length === 1
        ? "Accommodation saved"
        : `Saved accommodations for ${dirtyStudentIds.length} students`,
      "positive",
    );
  };

  const extendNow = (studentId: string, minutes: number) => {
    const ok = extendInProgressAttempt(effectiveCourseId, quizId, studentId, minutes);
    if (!ok) {
      showToast("No in-progress attempt to extend", "negative");
      return;
    }
    setStatsTick((t) => t + 1);
    showToast(`Added +${minutes} minutes to this attempt`, "positive");
  };

  const bulkExtendAllInProgress = () => {
    if (!quizId) return;
    const n = bulkExtendInProgressAttempts(effectiveCourseId, quizId, 15);
    setStatsTick((t) => t + 1);
    if (n === 0) {
      showToast("No in-progress attempts to extend", "negative");
      return;
    }
    showToast(
      `Added +15 minutes to ${n} in-progress attempt${n === 1 ? "" : "s"}`,
      "positive",
    );
  };

  const forceEndProgress = (studentId: string) => {
    clearQuizProgress(effectiveCourseId, quizId, studentId);
    setStatsTick((t) => t + 1);
    showToast("Cleared in-progress attempt (not graded)", "neutral");
  };

  const forceSubmitProgress = async (studentId: string, studentName: string) => {
    if (!quiz) return;
    const comment = window.prompt(
      "Force-submit this attempt? Optional comment for the student:",
      "",
    );
    if (comment === null) return;
    const attempt = await forceSubmitInProgressAttempt(effectiveCourseId, quiz, studentId, {
      studentName,
      comment: comment.trim() || undefined,
    });
    setStatsTick((t) => t + 1);
    if (!attempt) {
      showToast("No in-progress attempt to force-submit", "negative");
      return;
    }
    showToast(`Force-submitted attempt for ${studentName}`, "positive");
  };

  const messageStudent = (studentId: string) => {
    if (!quiz) return;
    const member = rosterById.get(studentId);
    const name = member?.name ?? studentId;
    const subject = `Regarding quiz: ${quiz.title}`;
    const instructor = loadUser();
    const body = `Hi ${name},\n\nI'm reaching out about your in-progress attempt on "${quiz.title}". Please check in if you need help or an extension.\n\nThanks,\n${instructor.name}`;
    const sent = sendInboxMessage({
      from: instructor.name,
      fromUserId: instructor.id,
      to: member ? [{ id: member.id, name: member.name, role: member.role }] : undefined,
      subject,
      body,
      courseId: effectiveCourseId,
      preview: `Message about ${quiz.title}`,
      kind: "direct",
    });
    showToast(`Inbox message sent to ${name}`, "positive");
    navigate(`/inbox?thread=${encodeURIComponent(sent.threadId ?? sent.id)}`);
  };

  const exportAccommodations = () => {
    const payload = exportAccommodationsPayload(effectiveCourseId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accommodations-${effectiveCourseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Accommodations exported", "positive");
  };

  const importAccommodationsFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = importAccommodationsPayload(effectiveCourseId, parsed);
      if (result.error) {
        showToast(result.error, "negative");
        return;
      }
      const next = loadDraftMap(effectiveCourseId, quizId, roster);
      setBaseline(next);
      setDrafts(next);
      setStatsTick((t) => t + 1);
      showToast(
        result.imported === 1
          ? "Imported 1 accommodation"
          : `Imported ${result.imported} accommodations`,
        "positive",
      );
    } catch {
      showToast("Could not parse accommodations JSON", "negative");
    } finally {
      if (accommodationsFileRef.current) accommodationsFileRef.current.value = "";
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-8 pb-28">
          <Link
            to={quizPath}
            className="inline-flex items-center gap-1.5 text-sm text-canvas-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to quiz
          </Link>

          <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <PageIdentityHeader
                size="md"
                icon="instructor"
                label="Moderate quiz"
                title={quiz.title}
                description="Give individual students extra time, attempts, multipliers, or availability unlocks. Changes stay in draft until you save."
              />
            </div>
            <div className="grid w-full grid-cols-3 gap-3 xl:w-auto xl:min-w-[28rem] xl:shrink-0">
              <div className="rounded-2xl border border-canvas-border/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <Timer className="h-3.5 w-3.5 text-canvas-blue" />
                  Time
                </div>
                <p className="mt-1.5 text-base font-semibold text-canvas-grayDark">
                  {formatTimeLimitDisplay(quiz.timeLimitMinutes) ?? "None"}
                </p>
              </div>
              <div className="rounded-2xl border border-canvas-border/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <RotateCcw className="h-3.5 w-3.5 text-canvas-blue" />
                  Attempts
                </div>
                <p className="mt-1.5 text-base font-semibold text-canvas-grayDark">
                  {getQuizAllowedAttemptsLabel(quiz)}
                </p>
              </div>
              <div className="rounded-2xl border border-canvas-border/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <Users className="h-3.5 w-3.5 text-canvas-blue" />
                  Grants
                </div>
                <p className="mt-1.5 text-base font-semibold text-canvas-grayDark">
                  {grantedCount}
                  <span className="text-sm font-normal text-gray-400"> / {roster.length}</span>
                </p>
              </div>
            </div>
          </div>

          {!quiz.timeLimitMinutes && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This quiz has no time limit. Extra minutes and multipliers are disabled until you
              set one in the quiz editor.
            </div>
          )}

          {inProgress.length > 0 && (
            <div className="mt-6 rounded-2xl border border-canvas-blue/25 bg-white px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-canvas-grayDark">
                  In progress ({inProgress.length})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/inbox"
                    className="text-xs font-medium text-canvas-blue hover:underline"
                  >
                    Open inbox
                  </Link>
                  <button
                    type="button"
                    disabled={!quiz.timeLimitMinutes}
                    onClick={bulkExtendAllInProgress}
                    className="h-8 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    +15 all in-progress
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                One-shot extensions apply only to the current attempt.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  Sort
                  <select
                    value={progressSort}
                    onChange={(e) => setProgressSort(e.target.value as ProgressSort)}
                    className="form-input h-8 py-0 text-xs"
                  >
                    <option value="leaves-desc">Leaves (most first)</option>
                    <option value="leaves-asc">Leaves (fewest first)</option>
                    <option value="time-left-asc">Time left (least first)</option>
                    <option value="time-left-desc">Time left (most first)</option>
                  </select>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={onlyWithLeaves}
                    onChange={(e) => setOnlyWithLeaves(e.target.checked)}
                    className="accent-canvas-blue"
                  />
                  Has leaves
                </label>
              </div>
              <ul className="mt-3 divide-y divide-gray-100">
                {displayedInProgress.length === 0 ? (
                  <li className="py-3 text-sm text-gray-500">
                    No in-progress students match this filter.
                  </li>
                ) : (
                  displayedInProgress.map(({ studentId, progress, remainingMs }) => {
                    const member = rosterById.get(studentId);
                    const name = member?.name ?? studentId;
                    const elapsed = now - progress.startedAt;
                    const answeredLabel = answeredProgressLabel(studentId, progress);
                    const flashing = leaveFlashIds.has(studentId);
                    return (
                      <li
                        key={studentId}
                        className={[
                          "flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between",
                          flashing
                            ? "rounded-lg bg-amber-50/90 ring-1 ring-amber-200/80"
                            : "",
                        ].join(" ")}
                      >
                        <div className="min-w-0 px-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-canvas-grayDark">
                              {name}
                            </p>
                            {flashing && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                                Left quiz
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Elapsed {formatElapsed(elapsed)}
                            {Number.isFinite(remainingMs) && (
                              <>
                                {" · "}
                                {remainingMs > 0
                                  ? `${formatElapsed(remainingMs)} left`
                                  : "Time up"}
                              </>
                            )}
                            {answeredLabel && <> · {answeredLabel}</>}
                            {(progress.attemptExtraMinutes ?? 0) > 0 && (
                              <> · +{progress.attemptExtraMinutes} min this attempt</>
                            )}
                            {(progress.leaveCount ?? 0) > 0 && (
                              <>
                                {" · "}
                                {progress.leaveCount} leave
                                {progress.leaveCount === 1 ? "" : "s"}
                                {progress.leaveEvents && progress.leaveEvents.length > 0 && (
                                  <>
                                    {" "}
                                    (last{" "}
                                    {new Date(
                                      progress.leaveEvents[progress.leaveEvents.length - 1],
                                    ).toLocaleTimeString()}
                                    )
                                  </>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 px-1">
                          <button
                            type="button"
                            onClick={() => messageStudent(studentId)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Message
                          </button>
                          <button
                            type="button"
                            disabled={!quiz.timeLimitMinutes}
                            onClick={() => extendNow(studentId, 15)}
                            className="h-8 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +15 now
                          </button>
                          <button
                            type="button"
                            onClick={() => void forceSubmitProgress(studentId, name)}
                            className="h-8 rounded-md border border-amber-300 px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-50"
                          >
                            Force submit
                          </button>
                          <button
                            type="button"
                            onClick={() => forceEndProgress(studentId)}
                            className="h-8 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Clear progress
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students by name or email…"
                className="form-input h-10 w-full pl-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportAccommodations}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => accommodationsFileRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Import JSON
              </button>
              <input
                ref={accommodationsFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => void importAccommodationsFile(e.target.files?.[0] ?? null)}
              />
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={onlyWithGrants}
                  onChange={(e) => setOnlyWithGrants(e.target.checked)}
                  className="accent-canvas-blue"
                />
                Show only students with grants
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-canvas-border/80 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-canvas-grayDark">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                disabled={filteredIds.length === 0}
                onChange={toggleSelectAllFiltered}
                className="accent-canvas-blue"
              />
              {selectedTargetIds.length > 0
                ? `${selectedTargetIds.length} selected`
                : "Select students"}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={selectedTargetIds.length === 0 || !quiz.timeLimitMinutes}
                onClick={() => bulkBumpMinutes(15)}
                className="h-8 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +15 min selected
              </button>
              <button
                type="button"
                disabled={selectedTargetIds.length === 0}
                onClick={() => bulkBumpAttempts(1)}
                className="inline-flex h-8 items-center gap-0.5 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-canvas-blue hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />1 attempt selected
              </button>
              <button
                type="button"
                disabled={selectedTargetIds.length === 0}
                onClick={bulkClear}
                className="h-8 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear selected
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center xl:col-span-2 2xl:col-span-3">
                <Users className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-canvas-grayDark">
                  {roster.length === 0 ? "No students on the roster yet" : "No matching students"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {roster.length === 0
                    ? "Add people from the People page, then come back to moderate."
                    : "Try a different search or clear the grants filter."}
                </p>
                {roster.length === 0 && (
                  <Link
                    to={`/courses/${effectiveCourseId}/people/accommodations`}
                    className="btn-canvas-secondary mt-4 inline-flex text-sm"
                  >
                    Open Accommodations
                  </Link>
                )}
              </div>
            ) : (
              filtered.map((member) => {
                const attempts = getStudentAttemptsForQuiz(
                  effectiveCourseId,
                  quiz.id,
                  member.id,
                );
                const used = attempts.length;
                const remaining = getRemainingAttempts(quiz, effectiveCourseId, member.id);
                const draft = drafts[member.id] ?? EMPTY_DRAFT;
                const rowDirty = dirtyStudentIds.includes(member.id);
                const saved = getQuizAccommodation(effectiveCourseId, member.id, quiz.id);
                const breakdown = getQuizAccommodationBreakdown(
                  effectiveCourseId,
                  member.id,
                  quiz.id,
                );
                const effective = draftToEffective(draft, breakdown.courseWide);
                const showBreakdown =
                  effective.extraMinutes > 0 ||
                  effective.extraAttempts > 0 ||
                  effective.timeMultiplier > 1 ||
                  effective.unlockAvailability ||
                  Boolean(draft.note.trim());
                const selected = selectedIds.has(member.id);
                const updatedLabel = formatUpdatedAt(saved?.updatedAt);

                return (
                  <div
                    key={member.id}
                    className={[
                      "flex h-full flex-col rounded-2xl border bg-white px-4 py-4 shadow-sm transition-colors",
                      rowDirty
                        ? "border-canvas-blue/40 ring-1 ring-canvas-blue/15"
                        : selected
                          ? "border-canvas-blue/30"
                          : "border-canvas-border/80",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(member.id)}
                        className="mt-3 accent-canvas-blue"
                        aria-label={`Select ${member.name}`}
                      />
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas-blueTint text-sm font-semibold text-canvas-blueDark">
                        {initialsFromName(member.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-canvas-grayDark">
                            {member.name}
                          </p>
                          {rowDirty && (
                            <span className="rounded-full bg-canvas-blueTint px-2 py-0.5 text-[11px] font-medium text-canvas-blueDark">
                              Unsaved
                            </span>
                          )}
                          {showBreakdown && !rowDirty && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Active grant
                            </span>
                          )}
                        </div>
                        {member.email && (
                          <p className="truncate text-xs text-gray-500">{member.email}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {used} attempt{used === 1 ? "" : "s"} used ·{" "}
                          {remaining === Infinity ? "Unlimited" : remaining} remaining
                        </p>
                        {showBreakdown && (
                          <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-gray-500">
                            <p>
                              Effective:{" "}
                              <span className="font-medium text-canvas-grayDark">
                                {formatAccommodationGrantParts(effective)}
                              </span>
                            </p>
                            <p>
                              Course-wide{" "}
                              {formatAccommodationGrantParts(breakdown.courseWide)}
                              {" · "}
                              This quiz{" "}
                              {formatAccommodationGrantParts({
                                extraMinutes: parseExtra(draft.extraMinutes) ?? 0,
                                extraAttempts: parseExtra(draft.extraAttempts) ?? 0,
                                timeMultiplier: parseMultiplier(draft.timeMultiplier) ?? 1,
                                unlockAvailability: draft.unlockAvailability,
                              })}
                            </p>
                            {updatedLabel && (
                              <p>Last saved {updatedLabel}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                      <div>
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                          <Clock className="h-3.5 w-3.5" />
                          Extra minutes
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={draft.extraMinutes}
                            onChange={(e) =>
                              updateDraft(member.id, { extraMinutes: e.target.value })
                            }
                            placeholder="0"
                            className="form-input h-9 min-w-0 flex-1"
                            disabled={!quiz.timeLimitMinutes}
                          />
                          <button
                            type="button"
                            disabled={!quiz.timeLimitMinutes}
                            onClick={() => bumpMinutes(member.id, 15)}
                            className="h-9 shrink-0 rounded-md border border-gray-300 px-2 text-xs font-medium text-canvas-blue hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +15
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Extra attempts
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={draft.extraAttempts}
                            onChange={(e) =>
                              updateDraft(member.id, { extraAttempts: e.target.value })
                            }
                            placeholder="0"
                            className="form-input h-9 min-w-0 flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => bumpAttempts(member.id, 1)}
                            className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-md border border-gray-300 px-2 text-xs font-medium text-canvas-blue hover:bg-gray-50"
                          >
                            <Plus className="h-3.5 w-3.5" />1
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Time multiplier
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={0.25}
                          value={draft.timeMultiplier}
                          onChange={(e) =>
                            updateDraft(member.id, { timeMultiplier: e.target.value })
                          }
                          placeholder="1"
                          className="form-input h-9 w-full"
                          disabled={!quiz.timeLimitMinutes}
                        />
                      </div>

                      <div className="flex items-end">
                        <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={draft.unlockAvailability}
                            onChange={(e) =>
                              updateDraft(member.id, {
                                unlockAvailability: e.target.checked,
                              })
                            }
                            className="accent-canvas-blue"
                          />
                          Unlock availability
                        </label>
                      </div>
                    </div>

                    {quiz.timeLimitMinutes ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                        {ACCOMMODATION_TIME_EXPLAINER}
                      </p>
                    ) : null}

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        Note
                      </label>
                      <input
                        type="text"
                        value={draft.note}
                        onChange={(e) => updateDraft(member.id, { note: e.target.value })}
                        placeholder="Reason for this grant (optional)"
                        className="form-input h-9 w-full text-sm"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {used > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setAttemptsPreview({
                                studentId: member.id,
                                studentName: member.name,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-canvas-grayDark hover:border-canvas-blue/40 hover:bg-canvas-blueTint/50 hover:text-canvas-blueDark"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View attempts
                            <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gray-600 ring-1 ring-gray-200">
                              {used}
                            </span>
                          </button>
                        )}
                      </div>
                      {showBreakdown && (
                        <button
                          type="button"
                          onClick={() => clearStudentDraft(member.id)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-canvas-red"
                        >
                          Clear grants
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-canvas-border bg-white/95 px-8 py-4 backdrop-blur">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            {isDirty ? (
              <>
                <span className="font-medium text-canvas-grayDark">
                  {dirtyStudentIds.length} unsaved change
                  {dirtyStudentIds.length === 1 ? "" : "s"}
                </span>
                <span className="text-gray-400"> · </span>
                Save to apply for students
              </>
            ) : (
              "No unsaved changes"
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discardChanges}
              disabled={!isDirty}
              className="btn-canvas-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={!isDirty}
              className="btn-canvas-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>

      {leaveGuardModal}

      {attemptsPreview && quiz && (
        <StudentAttemptsPreviewModal
          courseId={effectiveCourseId}
          quiz={quiz}
          studentId={attemptsPreview.studentId}
          studentName={attemptsPreview.studentName}
          onClose={() => setAttemptsPreview(null)}
          onDeleted={(message) => {
            showToast(message, "positive");
            setStatsTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}
