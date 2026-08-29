import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Flag,
  Maximize,
  Printer,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import ConfirmActionModal from "../components/ConfirmActionModal";
import CanvasModal from "../components/CanvasModal";
import QuizQuestionCard from "../components/QuizQuestionCard";
import RichContentViewer from "../components/RichContentViewer";
import UnavailableScreen from "../components/UnavailableScreen";
import { StatusAlertBanner } from "../components/ui/StatusAlert";
import { useToast } from "../components/ui/Toast";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useStudentView } from "../hooks/useStudentView";
import {
  autoPublishQuiz,
  canStudentTakeQuiz,
  formatQuizDateTime,
  formatTimeLimitDisplay,
  formatPoints,
  getQuizById,
  getQuizQuestionCount,
  getQuizScoringPolicy,
  getQuizType,
  isStudentViewableQuiz,
  loadQuizzes,
  quizItemLabel,
  quizShowsCorrectAnswers,
  quizShowsResponses,
  quizShowsScoreToStudent,
  QUIZ_SCORING_POLICY_LABELS,
  saveQuizzes,
  sanitizeQuestionForStudent,
  totalQuizQuestionPoints,
  type Quiz,
  type QuizQuestion,
} from "../utils/quizzes";
import {
  isQuizAccessUnlocked,
  quizRequiresAccessCode,
  unlockQuizAccess,
  verifyQuizAccessCode,
  consumeOneTimeToken,
} from "../utils/quizAccess";
import { GRADE_PUBLISH_CHANGED_EVENT } from "../utils/gradeVisibility";
import {
  gradeQuizAttempt,
  getAttemptEffectiveScore,
  describePartialCredit,
  scoreQuestionAnswer,
  getRemainingAttempts,
  getScoringPolicyAttempt,
  resolveQuizQuestions,
  getStudentAttemptsForQuiz,
  hasAnswer,
  isEssayCommentMissing,
  markQuizAttemptResponsesViewed,
  quizAttemptShuffleSeed,
  submitQuizAttempt,
  attachCodingTestResults,
  type GradedResult,
  type QuizAnswer,
  type QuizSubmitReason,
} from "../utils/quizSubmissions";
import {
  clearQuizProgress,
  getQuizProgress,
  QUIZ_PROGRESS_CHANGED_EVENT,
  saveQuizProgress,
  type QuizProgress,
  type QuizProgressChangedDetail,
} from "../utils/quizProgress";
import {
  enqueueQuizSubmit,
  peekQueuedQuizSubmit,
  removeQueuedQuizSubmit,
} from "../utils/quizOfflineQueue";
import {
  courseIdFromAccommodationsStorageKey,
  getEffectiveQuizAccommodation,
  getEffectiveTimeLimitMinutes,
  isQuizAccommodationsStorageKey,
  QUIZ_ACCOMMODATIONS_CHANGED_EVENT,
  type QuizAccommodationsChangedDetail,
} from "../utils/quizAccommodations";
import { loadUser } from "../utils/userStore";
import { applyEffectiveDates } from "../utils/dueDateOverrides";
import { shouldUseMonacoEditor } from "../utils/quizEditorPrefs";
import { useQuizT } from "../utils/quizI18n";

type AnswerState = Record<string, QuizAnswer>;

type SubmitConfirmState = {
  unanswered: { id: string; label: string; index: number }[];
  marked: { id: string; label: string; index: number }[];
  missingEssayComments: { id: string; label: string; index: number }[];
  scorePreview?: { score: number; maxScore: number };
};

const FONT_SCALE_KEY = "canvasClone:quizTakeFontScale";
type FontScale = "sm" | "md" | "lg";
const FONT_SCALE_CLASS: Record<FontScale, string> = {
  sm: "quiz-take-fs-sm",
  md: "quiz-take-fs-md",
  lg: "quiz-take-fs-lg",
};

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
  const navigate = useNavigate();
  const location = useLocation();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const search = new URLSearchParams(location.search);
  const oneTimeToken = search.get("token") ?? undefined;
  const isReview = search.get("review") === "1";
  const reviewAttemptId = search.get("attempt");

  const [quiz, setQuiz] = useState<Quiz | undefined>(() =>
    quizId ? getQuizById(effectiveCourseId, quizId) : undefined,
  );
  const previewKeyParam = search.get("key");
  const isTaPreview = Boolean(
    quiz?.previewShareKey && previewKeyParam && previewKeyParam === quiz.previewShareKey,
  );
  const isPreview = !studentView || search.get("preview") === "1" || isTaPreview;
  const t = useQuizT();
  const [useMonaco, setUseMonaco] = useState(() =>
    shouldUseMonacoEditor(effectiveCourseId, quiz),
  );
  useEffect(() => {
    const sync = () => setUseMonaco(shouldUseMonacoEditor(effectiveCourseId, quiz));
    sync();
    window.addEventListener("canvasClone:coursesChanged", sync);
    window.addEventListener("canvasClone:quizzesChanged", sync);
    return () => {
      window.removeEventListener("canvasClone:coursesChanged", sync);
      window.removeEventListener("canvasClone:quizzesChanged", sync);
    };
  }, [effectiveCourseId, quiz]);
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [furthestQuestionIndex, setFurthestQuestionIndex] = useState(0);
  /** When one-at-a-time is on, block the attempt until the student acknowledges. */
  const [awaitingOneAtATimeAck, setAwaitingOneAtATimeAck] = useState(false);
  /** While preparing a printout, show every question (overrides one-at-a-time). */
  const [printAllQuestions, setPrintAllQuestions] = useState(false);
  /** Include answer key in the printout (instructor preview). */
  const [printIncludeKey, setPrintIncludeKey] = useState(false);
  const [printFilter, setPrintFilter] = useState<"all" | "unanswered" | "wrong">("all");
  const [accessUnlocked, setAccessUnlocked] = useState(() => {
    if (!quizId) return false;
    const q = getQuizById(effectiveCourseId, quizId);
    return isQuizAccessUnlocked(effectiveCourseId, quizId, q?.accessCode);
  });
  const [accessDraft, setAccessDraft] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [, setGradePublishTick] = useState(0);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const firedAlertsRef = useRef<Set<number>>(new Set());
  const firedSecondAlertsRef = useRef<Set<number>>(new Set());
  const progressInitRef = useRef(false);
  const prevExtraMinutesRef = useRef<number | null>(null);
  const prevExtraAttemptsRef = useRef<number | null>(null);
  const prevAttemptExtraRef = useRef<number | null>(null);
  const [attemptExtraMinutes, setAttemptExtraMinutes] = useState(0);
  const [submitConfirm, setSubmitConfirm] = useState<SubmitConfirmState | null>(null);
  const [practiceRevealed, setPracticeRevealed] = useState<Set<string>>(new Set());
  const [wrongOnlyIds, setWrongOnlyIds] = useState<string[] | null>(null);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    try {
      const v = sessionStorage.getItem(FONT_SCALE_KEY);
      if (v === "sm" || v === "md" || v === "lg") return v;
    } catch {
      /* ignore */
    }
    return "md";
  });
  const [offlineQueued, setOfflineQueued] = useState(false);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const [navFocusIndex, setNavFocusIndex] = useState(0);
  /** Accumulated focus time per question (ms) for this in-progress attempt. */
  const [questionTimeMs, setQuestionTimeMs] = useState<Record<string, number>>({});
  const questionTimeMsRef = useRef<Record<string, number>>({});
  const timingActiveRef = useRef<{ questionId: string; enteredAt: number } | null>(
    null,
  );
  const [leaveCount, setLeaveCount] = useState(0);
  const leaveCountRef = useRef(0);
  const [leaveEvents, setLeaveEvents] = useState<number[]>([]);
  const leaveEventsRef = useRef<number[]>([]);
  const [leaveLocked, setLeaveLocked] = useState(false);
  const handleSubmitRef = useRef<(reason?: QuizSubmitReason) => void>(() => {});
  const leaveCooldownRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const idleWarnedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const [seatNumber, setSeatNumber] = useState("");
  const [seatDraft, setSeatDraft] = useState("");
  const [awaitingSeat, setAwaitingSeat] = useState(false);
  const [awaitingFullscreen, setAwaitingFullscreen] = useState(false);
  const [viewedQuestionIds, setViewedQuestionIds] = useState<Set<string>>(new Set());
  const viewedQuestionIdsRef = useRef<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveFlashTimerRef = useRef<number | null>(null);
  const clientMetaRef = useRef<{ userAgent?: string; timezone?: string } | null>(null);

  questionTimeMsRef.current = questionTimeMs;
  leaveCountRef.current = leaveCount;
  leaveEventsRef.current = leaveEvents;
  viewedQuestionIdsRef.current = viewedQuestionIds;

  const persistProgress = (
    quizIdForSave: string,
    patch: Parameters<typeof saveQuizProgress>[2],
  ) => {
    setSaveStatus("saving");
    saveQuizProgress(effectiveCourseId, quizIdForSave, patch);
    if (saveFlashTimerRef.current != null) {
      window.clearTimeout(saveFlashTimerRef.current);
    }
    saveFlashTimerRef.current = window.setTimeout(() => {
      setSaveStatus("saved");
      saveFlashTimerRef.current = window.setTimeout(() => {
        setSaveStatus("idle");
        saveFlashTimerRef.current = null;
      }, 1800);
    }, 200);
  };

  const softClientMeta = () => {
    if (clientMetaRef.current) return clientMetaRef.current;
    const meta = {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      timezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined,
    };
    clientMetaRef.current = meta;
    return meta;
  };

  /** Accumulate open interval into the map; reset or clear the active window. */
  const checkpointQuestionTiming = (
    now = Date.now(),
    pause = false,
  ): Record<string, number> => {
    const active = timingActiveRef.current;
    let next = questionTimeMsRef.current;
    if (active) {
      const add = Math.max(0, now - active.enteredAt);
      if (add > 0) {
        next = {
          ...next,
          [active.questionId]: (next[active.questionId] ?? 0) + add,
        };
        questionTimeMsRef.current = next;
      }
      timingActiveRef.current = pause
        ? null
        : { questionId: active.questionId, enteredAt: now };
    }
    return next;
  };

  const startQuestionTiming = (questionId: string, now = Date.now()) => {
    if (!questionId) return;
    const active = timingActiveRef.current;
    if (active?.questionId === questionId) return;
    const times = checkpointQuestionTiming(now, true);
    setQuestionTimeMs(times);
    timingActiveRef.current = { questionId, enteredAt: now };
  };

  // Re-check unlock when the quiz's access code changes (invalidates old session unlocks).
  useEffect(() => {
    if (!quizId) return;
    setAccessUnlocked(
      isQuizAccessUnlocked(effectiveCourseId, quizId, quiz?.accessCode),
    );
  }, [effectiveCourseId, quizId, quiz?.accessCode]);

  // Baseline extras whenever a (re)start happens so mid-attempt grants can toast.
  useEffect(() => {
    if (!quiz || isPreview) {
      prevExtraMinutesRef.current = null;
      prevExtraAttemptsRef.current = null;
      prevAttemptExtraRef.current = null;
      setAttemptExtraMinutes(0);
      return;
    }
    const acc = getEffectiveQuizAccommodation(
      effectiveCourseId,
      loadUser().id,
      quiz.id,
    );
    prevExtraMinutesRef.current = acc.extraMinutes;
    prevExtraAttemptsRef.current = acc.extraAttempts;
    const progress = getQuizProgress(effectiveCourseId, quiz.id);
    const oneshot = progress?.attemptExtraMinutes ?? 0;
    prevAttemptExtraRef.current = oneshot;
    setAttemptExtraMinutes(oneshot);
  }, [quiz, isPreview, startedAt, effectiveCourseId]);

  // Mid-attempt: persistent accommodation grants (time / attempts).
  useEffect(() => {
    if (!quiz || isPreview || result) return;
    const studentId = loadUser().id;

    const applyAccommodationChange = () => {
      const next = getEffectiveQuizAccommodation(
        effectiveCourseId,
        studentId,
        quiz.id,
      );
      const prevMin = prevExtraMinutesRef.current;
      const prevAtt = prevExtraAttemptsRef.current;
      prevExtraMinutesRef.current = next.extraMinutes;
      prevExtraAttemptsRef.current = next.extraAttempts;
      setNow(Date.now());
      if (prevMin != null && next.extraMinutes > prevMin) {
        const added = next.extraMinutes - prevMin;
        showToast(
          `Your instructor added ${added} minute${added === 1 ? "" : "s"}. Your timer has been extended.`,
          "positive",
        );
      }
      if (prevAtt != null && next.extraAttempts > prevAtt) {
        const added = next.extraAttempts - prevAtt;
        showToast(
          `Your instructor granted ${added} extra attempt${added === 1 ? "" : "s"}.`,
          "positive",
        );
      }
    };

    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<QuizAccommodationsChangedDetail>).detail;
      if (detail?.courseId && detail.courseId !== effectiveCourseId) return;
      if (
        detail?.studentIds &&
        detail.studentIds.length > 0 &&
        !detail.studentIds.includes(studentId)
      ) {
        return;
      }
      applyAccommodationChange();
    };

    const onStorage = (e: StorageEvent) => {
      if (!isQuizAccommodationsStorageKey(e.key)) return;
      const cid = courseIdFromAccommodationsStorageKey(e.key!);
      if (cid !== effectiveCourseId) return;
      applyAccommodationChange();
    };

    window.addEventListener(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [quiz, isPreview, result, effectiveCourseId, showToast]);

  // Mid-attempt: one-shot time extension on this progress row.
  useEffect(() => {
    if (!quiz || isPreview || result) return;
    const studentId = loadUser().id;

    const syncOneshot = () => {
      const progress = getQuizProgress(effectiveCourseId, quiz.id, studentId);
      const next = progress?.attemptExtraMinutes ?? 0;
      const prev = prevAttemptExtraRef.current;
      prevAttemptExtraRef.current = next;
      setAttemptExtraMinutes(next);
      setNow(Date.now());
      if (prev != null && next > prev) {
        const added = next - prev;
        showToast(
          `Your instructor added ${added} minute${added === 1 ? "" : "s"} to this attempt.`,
          "positive",
        );
      }
    };

    const onProgress = (e: Event) => {
      const detail = (e as CustomEvent<QuizProgressChangedDetail>).detail;
      if (detail?.courseId && detail.courseId !== effectiveCourseId) return;
      if (detail?.quizId && detail.quizId !== quiz.id) return;
      if (detail?.studentId && detail.studentId !== studentId) return;
      syncOneshot();
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith("canvasClone:quizProgress:")) return;
      if (e.key !== `canvasClone:quizProgress:${effectiveCourseId}`) return;
      syncOneshot();
    };

    window.addEventListener(QUIZ_PROGRESS_CHANGED_EVENT, onProgress);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(QUIZ_PROGRESS_CHANGED_EVENT, onProgress);
      window.removeEventListener("storage", onStorage);
    };
  }, [quiz, isPreview, result, effectiveCourseId, showToast]);

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

  useEffect(() => {
    const bump = () => setGradePublishTick((t) => t + 1);
    window.addEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    return () => window.removeEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
  }, []);

  const needsAccessUnlock =
    isLiveAttempt &&
    Boolean(quiz) &&
    quizRequiresAccessCode(quiz?.accessCode) &&
    !accessUnlocked &&
    canStudentTakeQuiz(quiz!, now, {
      courseId: effectiveCourseId,
      studentId: loadUser().id,
      oneTimeToken,
    });

  // Resume an in-progress attempt (or start a fresh one). Restoring startedAt to
  // its original value keeps the timer running from where the student left off.
  // One-question-at-a-time quizzes require an acknowledgment before a fresh start.
  // Access codes must be unlocked before progress starts.
  useEffect(() => {
    if (!quiz || !quizId || !isLiveAttempt || result) return;
    if (needsAccessUnlock) return;
    if (progressInitRef.current) return;
    progressInitRef.current = true;
    const existing = getQuizProgress(effectiveCourseId, quiz.id);
    if (existing) {
      const restored: AnswerState = {};
      for (const a of existing.answers) restored[a.questionId] = a;
      setAnswers(restored);
      setMarkedForReview(new Set(existing.markedForReview));
      setStartedAt(existing.startedAt);
      setCurrentQuestionIndex(existing.currentQuestionIndex ?? 0);
      setFurthestQuestionIndex(
        Math.max(
          existing.furthestQuestionIndex ?? 0,
          existing.currentQuestionIndex ?? 0,
        ),
      );
      setAttemptExtraMinutes(existing.attemptExtraMinutes ?? 0);
      prevAttemptExtraRef.current = existing.attemptExtraMinutes ?? 0;
      setQuestionTimeMs(existing.questionTimeMs ?? {});
      questionTimeMsRef.current = existing.questionTimeMs ?? {};
      const leaves = existing.leaveCount ?? 0;
      setLeaveCount(leaves);
      leaveCountRef.current = leaves;
      const events = existing.leaveEvents ?? [];
      setLeaveEvents(events);
      leaveEventsRef.current = events;
      const seat = existing.seatNumber ?? "";
      setSeatNumber(seat);
      setSeatDraft(seat);
      const viewed = new Set(existing.viewedQuestionIds ?? []);
      setViewedQuestionIds(viewed);
      viewedQuestionIdsRef.current = viewed;
      if (existing.clientMeta) clientMetaRef.current = existing.clientMeta;
      setLeaveLocked(false);
      setResumed(true);
      setAwaitingSeat(false);
      setAwaitingFullscreen(false);
      setAwaitingOneAtATimeAck(false);
    } else {
      const needSeat = Boolean(quiz.collectSeatNumber);
      const needFs = Boolean(quiz.requireFullscreen);
      if (needSeat) {
        setAwaitingSeat(true);
        setAwaitingFullscreen(needFs);
        setAwaitingOneAtATimeAck(Boolean(quiz.oneQuestionAtATime));
      } else if (needFs) {
        setAwaitingSeat(false);
        setAwaitingFullscreen(true);
        setAwaitingOneAtATimeAck(Boolean(quiz.oneQuestionAtATime));
      } else if (quiz.oneQuestionAtATime) {
        setAwaitingSeat(false);
        setAwaitingFullscreen(false);
        setAwaitingOneAtATimeAck(true);
    } else {
      const start = Date.now();
      setStartedAt(start);
        setCurrentQuestionIndex(0);
        setFurthestQuestionIndex(0);
        setQuestionTimeMs({});
        questionTimeMsRef.current = {};
        timingActiveRef.current = null;
        setLeaveCount(0);
        leaveCountRef.current = 0;
        setLeaveEvents([]);
        leaveEventsRef.current = [];
        setViewedQuestionIds(new Set());
        viewedQuestionIdsRef.current = new Set();
        setLeaveLocked(false);
        setAwaitingSeat(false);
        setAwaitingFullscreen(false);
        setAwaitingOneAtATimeAck(false);
        persistProgress(quiz.id, {
        startedAt: start,
        answers: [],
        markedForReview: [],
          currentQuestionIndex: 0,
          furthestQuestionIndex: 0,
          questionTimeMs: {},
          leaveCount: 0,
          leaveEvents: [],
          clientMeta: softClientMeta(),
          viewedQuestionIds: [],
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id, isLiveAttempt, result, needsAccessUnlock]);

  const unlockAccess = (e: FormEvent) => {
    e.preventDefault();
    if (!quiz) return;
    if (!verifyQuizAccessCode(quiz.accessCode, accessDraft)) {
      setAccessError("Incorrect access code.");
      return;
    }
    unlockQuizAccess(effectiveCourseId, quiz.id, accessDraft);
    setAccessUnlocked(true);
    setAccessError(null);
    setAccessDraft("");
  };

  const confirmSeatNumber = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = seatDraft.trim();
    const required = quiz?.requireSeatNumber !== false;
    if (!trimmed && required) {
      showToast("Enter a seat or station number to continue", "negative");
      return;
    }
    setSeatNumber(trimmed);
    setAwaitingSeat(false);
  };

  const skipSeatNumber = () => {
    setSeatNumber("");
    setSeatDraft("");
    setAwaitingSeat(false);
  };

  const enterFullscreenAndContinue = async () => {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      showToast("Could not enter fullscreen — continuing anyway", "neutral");
    }
    setAwaitingFullscreen(false);
  };

  const beginOneAtATimeAttempt = () => {
    if (!quiz) return;
    const start = Date.now();
    setStartedAt(start);
    setNow(start);
    setCurrentQuestionIndex(0);
    setFurthestQuestionIndex(0);
    setQuestionTimeMs({});
    questionTimeMsRef.current = {};
    timingActiveRef.current = null;
    setLeaveCount(0);
    leaveCountRef.current = 0;
    setLeaveEvents([]);
    leaveEventsRef.current = [];
    setViewedQuestionIds(new Set());
    viewedQuestionIdsRef.current = new Set();
    setLeaveLocked(false);
    setAwaitingOneAtATimeAck(false);
    if (isLiveAttempt) {
      persistProgress(quiz.id, {
        startedAt: start,
        answers: [],
        markedForReview: [],
        currentQuestionIndex: 0,
        furthestQuestionIndex: 0,
        questionTimeMs: {},
        leaveCount: 0,
        leaveEvents: [],
        seatNumber: seatNumber || undefined,
        clientMeta: softClientMeta(),
        viewedQuestionIds: [],
      });
    }
  };

  /** Start a fresh attempt after seat/fullscreen gates (no one-at-a-time ack). */
  const beginFreshAttemptIfReady = () => {
    if (!quiz || awaitingSeat || awaitingFullscreen || awaitingOneAtATimeAck) return;
    if (!isLiveAttempt || result) return;
    const existing = getQuizProgress(effectiveCourseId, quiz.id);
    if (existing) return;
    const start = Date.now();
    setStartedAt(start);
    setNow(start);
    persistProgress(quiz.id, {
      startedAt: start,
      answers: [],
      markedForReview: [],
      currentQuestionIndex: 0,
      furthestQuestionIndex: 0,
      questionTimeMs: {},
      leaveCount: 0,
      leaveEvents: [],
      seatNumber: seatNumber || undefined,
      clientMeta: softClientMeta(),
      viewedQuestionIds: [],
    });
  };

  // Persist the in-progress attempt whenever answers or flags change.
  useEffect(() => {
    if (!quiz || !quizId || !isLiveAttempt || result || !progressInitRef.current) return;
    if (awaitingOneAtATimeAck || awaitingSeat || awaitingFullscreen || needsAccessUnlock) {
      return;
    }
    const times = checkpointQuestionTiming(Date.now(), false);
    persistProgress(quiz.id, {
      startedAt,
      answers: Object.values(answers),
      markedForReview: [...markedForReview],
      currentQuestionIndex,
      furthestQuestionIndex,
      attemptExtraMinutes,
      questionTimeMs: times,
      leaveCount: leaveCountRef.current,
      leaveEvents: leaveEventsRef.current,
      seatNumber: seatNumber || undefined,
      clientMeta: softClientMeta(),
      viewedQuestionIds: [...viewedQuestionIdsRef.current],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    answers,
    markedForReview,
    startedAt,
    currentQuestionIndex,
    furthestQuestionIndex,
    attemptExtraMinutes,
    leaveCount,
    leaveEvents,
    seatNumber,
    viewedQuestionIds,
    quiz?.id,
    isLiveAttempt,
    result,
    awaitingOneAtATimeAck,
    awaitingSeat,
    awaitingFullscreen,
    needsAccessUnlock,
  ]);

  // After seat/fullscreen gates clear (no one-at-a-time), start the attempt.
  useEffect(() => {
    if (!quiz || !isLiveAttempt || result) return;
    if (needsAccessUnlock || awaitingSeat || awaitingFullscreen) return;
    if (awaitingOneAtATimeAck) return;
    if (getQuizProgress(effectiveCourseId, quiz.id)) return;
    beginFreshAttemptIfReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quiz?.id,
    isLiveAttempt,
    result,
    needsAccessUnlock,
    awaitingSeat,
    awaitingFullscreen,
    awaitingOneAtATimeAck,
    seatNumber,
  ]);

  useEffect(() => {
    if (!isPreview || isReview || result || !quiz) return;
    setAwaitingSeat(false);
    setAwaitingFullscreen(false);
    if (quiz.oneQuestionAtATime) setAwaitingOneAtATimeAck(true);
    else setAwaitingOneAtATimeAck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id, isPreview, isReview, result]);

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

    const reviewQuestions = resolveQuizQuestions(effectiveCourseId, quiz, {
      studentId: target.studentId,
      attemptId: target.id,
      attemptNumber: target.attemptNumber,
      questionIds: target.questionIds,
    });
    const graded = gradeQuizAttempt(quiz, target.answers, reviewQuestions);
    setResult({
      score: getAttemptEffectiveScore(target),
      maxScore: target.maxScore,
      autoGraded: target.autoGraded,
      perQuestion: graded.perQuestion,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReview, quiz?.id, effectiveCourseId, quizId, reviewAttemptId]);

  const questions = useMemo(() => {
    if (!quiz) return [];
    const user = loadUser();
    if (isReview && quizId) {
      const attempts = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id);
      const target =
        (reviewAttemptId && attempts.find((a) => a.id === reviewAttemptId)) ||
        attempts[attempts.length - 1];
      if (target) {
        return resolveQuizQuestions(effectiveCourseId, quiz, {
          studentId: target.studentId,
          attemptId: target.id,
          attemptNumber: target.attemptNumber,
          questionIds: target.questionIds,
        });
      }
    }
    // After a live submit, keep the submitted attempt's order/shuffles for the results view.
    if (result && !isPreview) {
      const attempts = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id);
      const last = attempts[attempts.length - 1];
      if (last) {
        return resolveQuizQuestions(effectiveCourseId, quiz, {
          studentId: last.studentId,
          attemptId: last.id,
          attemptNumber: last.attemptNumber,
          questionIds: last.questionIds,
        });
      }
    }
    const priorCount = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id).length;
    return resolveQuizQuestions(effectiveCourseId, quiz, {
      studentId: user.id,
      attemptId: "in-progress",
      attemptNumber: priorCount + 1,
    });
  }, [quiz, effectiveCourseId, isReview, reviewAttemptId, quizId, result, isPreview]);

  const displayQuestions = useMemo(() => {
    if (!wrongOnlyIds?.length) return questions;
    const allow = new Set(wrongOnlyIds);
    return questions.filter(
      (q) => q.type === "note" || q.type === "group" || allow.has(q.id),
    );
  }, [questions, wrongOnlyIds]);

  useEffect(() => {
    const m = /^#q=(.+)$/.exec(location.hash);
    if (!m || (!isReview && !result)) return;
    const qid = decodeURIComponent(m[1]!);
    const idx = displayQuestions.findIndex((q) => q.id === qid);
    if (idx >= 0) {
      setCurrentQuestionIndex(idx);
      setNavFocusIndex(idx);
      questionRefs.current[qid]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, isReview, result, displayQuestions]);

  const attemptSeed = useMemo(() => {
    if (!quiz) return undefined;
    const user = loadUser();
    if (isReview || (result && !isPreview)) {
      const attempts = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id);
      const target =
        (isReview &&
          reviewAttemptId &&
          attempts.find((a) => a.id === reviewAttemptId)) ||
        attempts[attempts.length - 1];
      if (target) {
        return quizAttemptShuffleSeed(quiz.id, target.studentId, target.attemptNumber);
      }
    }
    const priorCount = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id).length;
    return quizAttemptShuffleSeed(quiz.id, user.id, priorCount + 1);
  }, [quiz, effectiveCourseId, isReview, reviewAttemptId, result, isPreview]);

  const quizRequiresEssayComment = Boolean(quiz?.requireEssayComment);

  useEffect(() => {
    if (questions.length === 0) return;
    setCurrentQuestionIndex((i) => Math.min(Math.max(0, i), questions.length - 1));
    setFurthestQuestionIndex((i) => Math.min(Math.max(0, i), questions.length - 1));
  }, [questions.length]);

  const oneAtATime = Boolean(quiz?.oneQuestionAtATime) && !result && !printAllQuestions;
  const lockPrevious = oneAtATime && Boolean(quiz?.lockPreviousQuestions);

  const markQuestionViewed = (questionId: string) => {
    if (!questionId || viewedQuestionIdsRef.current.has(questionId)) return;
    const next = new Set(viewedQuestionIdsRef.current);
    next.add(questionId);
    viewedQuestionIdsRef.current = next;
    setViewedQuestionIds(next);
  };

  // Track viewed questions for requireViewAllQuestions.
  useEffect(() => {
    if (!quiz?.requireViewAllQuestions || result || awaitingOneAtATimeAck || awaitingSeat || awaitingFullscreen)
      return;
    if (oneAtATime) {
      const q = questions[currentQuestionIndex];
      if (q) markQuestionViewed(q.id);
      return;
    }
    const trackable = questions.filter((q) => q.type !== "note" && q.type !== "group");
    if (trackable.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.35) continue;
          const id = (entry.target as HTMLElement).dataset.questionId;
          if (id) markQuestionViewed(id);
        }
      },
      { threshold: [0.35] },
    );
    for (const q of trackable) {
      const el = questionRefs.current[q.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quiz?.requireViewAllQuestions,
    oneAtATime,
    currentQuestionIndex,
    questions,
    result,
    awaitingOneAtATimeAck,
    awaitingSeat,
    awaitingFullscreen,
  ]);

  const requiredViewQuestions = useMemo(
    () => questions.filter((q) => q.type !== "note" && q.type !== "group"),
    [questions],
  );
  const viewedRequiredCount = requiredViewQuestions.filter((q) =>
    viewedQuestionIds.has(q.id),
  ).length;
  const allRequiredViewed =
    !quiz?.requireViewAllQuestions ||
    requiredViewQuestions.length === 0 ||
    viewedRequiredCount >= requiredViewQuestions.length;

  // One-at-a-time: attribute focus time to the visible question.
  useEffect(() => {
    if (!isLiveAttempt || result || awaitingOneAtATimeAck || needsAccessUnlock || leaveLocked)
      return;
    if (!oneAtATime) return;
    const q = questions[currentQuestionIndex];
    if (!q || q.type === "note" || q.type === "group") return;
    startQuestionTiming(q.id);
    return () => {
      const times = checkpointQuestionTiming(Date.now(), true);
      setQuestionTimeMs(times);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    oneAtATime,
    currentQuestionIndex,
    isLiveAttempt,
    result,
    awaitingOneAtATimeAck,
    needsAccessUnlock,
    leaveLocked,
    questions,
  ]);

  // All-questions mode: attribute time to the most-visible question.
  useEffect(() => {
    if (!isLiveAttempt || result || awaitingOneAtATimeAck || needsAccessUnlock || leaveLocked)
      return;
    if (oneAtATime) return;
    const trackable = questions.filter((q) => q.type !== "note" && q.type !== "group");
    if (trackable.length === 0) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.questionId;
          if (!id) continue;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId && bestRatio >= 0.2) startQuestionTiming(bestId);
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
    );

    for (const q of trackable) {
      const el = questionRefs.current[q.id];
      if (el) observer.observe(el);
    }
    startQuestionTiming(trackable[0].id);

    return () => {
      observer.disconnect();
      const times = checkpointQuestionTiming(Date.now(), true);
      setQuestionTimeMs(times);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    oneAtATime,
    isLiveAttempt,
    result,
    awaitingOneAtATimeAck,
    needsAccessUnlock,
    leaveLocked,
    questions,
  ]);

  // Soft proctor leave detection: visibility, optional blur, fullscreen exit.
  useEffect(() => {
    if (!isLiveAttempt || result) return;

    const canRecordLeave = () =>
      !awaitingOneAtATimeAck &&
      !awaitingSeat &&
      !awaitingFullscreen &&
      !needsAccessUnlock &&
      !leaveLocked;

    const recordLeave = (opts?: { lock?: boolean; reasonIfMax?: QuizSubmitReason }) => {
      if (!quiz || !canRecordLeave()) return;
      const nowTs = Date.now();
      if (nowTs - leaveCooldownRef.current < 800) return;
      leaveCooldownRef.current = nowTs;

      const times = checkpointQuestionTiming(nowTs, true);
      setQuestionTimeMs(times);
      const nextCount = leaveCountRef.current + 1;
      const nextEvents = [...leaveEventsRef.current, nowTs];
      leaveCountRef.current = nextCount;
      leaveEventsRef.current = nextEvents;
      setLeaveCount(nextCount);
      setLeaveEvents(nextEvents);
      const shouldLock = opts?.lock !== false && Boolean(quiz.lockOnLeave);
      if (shouldLock) setLeaveLocked(true);
      setSrAnnouncement(
        `You left the quiz. Leave count ${nextCount}${
          typeof quiz.maxLeaveCount === "number" && quiz.maxLeaveCount > 0
            ? ` of ${quiz.maxLeaveCount}`
            : ""
        }.`,
      );
      if (quiz.warnOnLeave && nextCount === 1) {
        showToast("Leaving will be recorded", "neutral");
      }
      persistProgress(quiz.id, {
        startedAt,
        answers: Object.values(answers),
        markedForReview: [...markedForReview],
        currentQuestionIndex,
        furthestQuestionIndex,
        attemptExtraMinutes,
        questionTimeMs: times,
        leaveCount: nextCount,
        leaveEvents: nextEvents,
        seatNumber: seatNumber || undefined,
        clientMeta: softClientMeta(),
        viewedQuestionIds: [...viewedQuestionIdsRef.current],
      });
      const max = quiz.maxLeaveCount;
      if (typeof max === "number" && max > 0 && nextCount >= max) {
        handleSubmitRef.current(opts?.reasonIfMax ?? "max_leaves");
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        const times = checkpointQuestionTiming(Date.now(), true);
        setQuestionTimeMs(times);
        if (quiz?.lockOnLeave) recordLeave();
      } else {
        setNow(Date.now());
        if (
          !awaitingOneAtATimeAck &&
          !needsAccessUnlock &&
          !leaveLocked &&
          !(quiz?.lockOnLeave)
        ) {
          if (oneAtATime) {
            const q = questions[currentQuestionIndex];
            if (q && q.type !== "note" && q.type !== "group") startQuestionTiming(q.id);
          }
        }
      }
    };

    let blurTimer: number | null = null;
    const onBlur = () => {
      if (!quiz?.lockOnLeave || !quiz.lockOnBlur) return;
      if (document.visibilityState === "hidden") return;
      blurTimer = window.setTimeout(() => {
        if (document.visibilityState === "hidden") return;
        if (document.hasFocus()) return;
        recordLeave();
      }, 400);
    };
    const onFocus = () => {
      if (blurTimer != null) {
        window.clearTimeout(blurTimer);
        blurTimer = null;
      }
    };

    const onFullscreen = () => {
      if (!quiz?.requireFullscreen) return;
      if (document.fullscreenElement) return;
      recordLeave({ lock: Boolean(quiz.lockOnLeave) });
      showToast("Exiting fullscreen was recorded as a leave", "neutral");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      if (blurTimer != null) window.clearTimeout(blurTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLiveAttempt,
    result,
    awaitingOneAtATimeAck,
    awaitingSeat,
    awaitingFullscreen,
    needsAccessUnlock,
    leaveLocked,
    oneAtATime,
    currentQuestionIndex,
    questions,
    quiz?.lockOnLeave,
    quiz?.lockOnBlur,
    quiz?.warnOnLeave,
    quiz?.maxLeaveCount,
    quiz?.requireFullscreen,
    quiz?.id,
    startedAt,
    answers,
    markedForReview,
    furthestQuestionIndex,
    attemptExtraMinutes,
    seatNumber,
    effectiveCourseId,
  ]);

  // Idle heartbeat (#37)
  useEffect(() => {
    if (!isLiveAttempt || result || !quiz?.idleTimeoutMinutes) return;
    if (awaitingOneAtATimeAck || awaitingSeat || awaitingFullscreen || needsAccessUnlock) {
      return;
    }
    const timeoutMs = Math.max(1, quiz.idleTimeoutMinutes) * 60_000;
    const graceMs = 30_000;
    lastActivityRef.current = Date.now();
    idleWarnedRef.current = false;

    const bump = () => {
      lastActivityRef.current = Date.now();
      idleWarnedRef.current = false;
    };
    const events: (keyof DocumentEventMap)[] = [
      "pointerdown",
      "keydown",
      "mousemove",
      "touchstart",
      "scroll",
    ];
    for (const ev of events) document.addEventListener(ev, bump, { passive: true });

    const id = window.setInterval(() => {
      if (leaveLocked) {
        lastActivityRef.current = Date.now();
        return;
      }
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= timeoutMs + graceMs) {
        handleSubmitRef.current("idle");
        return;
      }
      if (idleFor >= timeoutMs && !idleWarnedRef.current) {
        idleWarnedRef.current = true;
        showToast(
          "You appear idle. Interact soon or the quiz will auto-submit.",
          "neutral",
        );
        setSrAnnouncement("Idle warning: interact soon or the quiz will auto-submit.");
      }
    }, 5000);

    return () => {
      for (const ev of events) document.removeEventListener(ev, bump);
      window.clearInterval(id);
    };
  }, [
    isLiveAttempt,
    result,
    quiz?.idleTimeoutMinutes,
    quiz?.id,
    awaitingOneAtATimeAck,
    awaitingSeat,
    awaitingFullscreen,
    needsAccessUnlock,
    leaveLocked,
    showToast,
  ]);

  const acknowledgeLeaveReturn = () => {
    setNow(Date.now());
    setLeaveLocked(false);
    if (oneAtATime) {
      const q = questions[currentQuestionIndex];
      if (q && q.type !== "note" && q.type !== "group") startQuestionTiming(q.id);
    }
  };

  const goToQuestionIndex = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    if (!quiz?.oneQuestionAtATime || result) {
      setCurrentQuestionIndex(index);
      scrollToQuestion(questions[index].id);
      return;
    }
    if (lockPrevious && index < currentQuestionIndex) return;
    if (lockPrevious && index > furthestQuestionIndex) return;
    setCurrentQuestionIndex(index);
    setFurthestQuestionIndex((f) => Math.max(f, index));
  };

  const goNextQuestion = () => {
    if (
      quiz &&
      getQuizType(quiz) === "practice" &&
      quiz.practiceInstantFeedback &&
      !result
    ) {
      const q = questions[currentQuestionIndex];
      if (
        q &&
        q.type !== "note" &&
        q.type !== "group" &&
        hasAnswer(answers[q.id])
      ) {
        setPracticeRevealed((prev) => new Set([...prev, q.id]));
      }
    }
    if (currentQuestionIndex >= questions.length - 1) return;
    const next = currentQuestionIndex + 1;
    setCurrentQuestionIndex(next);
    setFurthestQuestionIndex((f) => Math.max(f, next));
  };

  const checkPracticeAnswer = () => {
    if (!quiz || getQuizType(quiz) !== "practice" || !quiz.practiceInstantFeedback) return;
    const q = questions[currentQuestionIndex];
    if (!q || q.type === "note" || q.type === "group") return;
    if (!hasAnswer(answers[q.id])) {
      showToast("Answer this question first", "neutral");
      return;
    }
    setPracticeRevealed((prev) => new Set([...prev, q.id]));
  };

  const goPrevQuestion = () => {
    if (lockPrevious || currentQuestionIndex <= 0) return;
    setCurrentQuestionIndex((i) => i - 1);
  };

  const takingActive =
    !result &&
    !awaitingOneAtATimeAck &&
    !awaitingSeat &&
    !awaitingFullscreen &&
    !needsAccessUnlock &&
    !leaveLocked;

  useKeyboardShortcuts(
    takingActive
      ? [
          {
            key: "?",
            shift: true,
            handler: () => setCheatSheetOpen(true),
          },
          {
            key: "/",
            shift: true,
            handler: () => setCheatSheetOpen(true),
          },
          {
            key: "j",
            handler: () => {
              if (oneAtATime) goNextQuestion();
              else goToQuestionIndex(Math.min(currentQuestionIndex + 1, questions.length - 1));
            },
          },
          {
            key: "n",
            handler: () => {
              if (oneAtATime) goNextQuestion();
              else goToQuestionIndex(Math.min(currentQuestionIndex + 1, questions.length - 1));
            },
          },
          {
            key: "k",
            handler: () => {
              if (oneAtATime) goPrevQuestion();
              else goToQuestionIndex(Math.max(currentQuestionIndex - 1, 0));
            },
          },
          {
            key: "p",
            handler: () => {
              if (oneAtATime) goPrevQuestion();
              else goToQuestionIndex(Math.max(currentQuestionIndex - 1, 0));
            },
          },
          {
            key: "m",
            handler: () => {
              const q = questions[currentQuestionIndex];
              if (!q || q.type === "note" || q.type === "group") return;
              setMarkedForReview((prev) => {
                const next = new Set(prev);
                if (next.has(q.id)) next.delete(q.id);
                else next.add(q.id);
                return next;
              });
            },
          },
        ]
      : [],
  );

  const effectiveLimitMinutes =
    quiz && !isPreview
      ? getEffectiveTimeLimitMinutes(quiz, effectiveCourseId, loadUser().id)
      : quiz?.timeLimitMinutes;
  const totalLimitMinutes =
    effectiveLimitMinutes != null
      ? effectiveLimitMinutes + Math.max(0, attemptExtraMinutes)
      : undefined;
  const timeLimitMs = totalLimitMinutes ? totalLimitMinutes * 60000 : 0;
  const timeRemaining = timeLimitMs > 0 ? timeLimitMs - (now - startedAt) : Infinity;

  // Keep the quiz clock ticking during leave-lock (wall-clock from startedAt).
  // Seat / fullscreen / one-at-a-time gates delay the timer start.
  useEffect(() => {
    if (result || !quiz || awaitingOneAtATimeAck || awaitingSeat || awaitingFullscreen) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [result, quiz, awaitingOneAtATimeAck, awaitingSeat, awaitingFullscreen, leaveLocked]);

  const performSubmit = async (reason: QuizSubmitReason = "manual") => {
    if (!quiz || submitting) return;
    const answerList = questions.map(
      (q) => answers[q.id] ?? { questionId: q.id },
    );
    setSubmitting(true);
    try {
      if (isPreview) {
        const withTests = await attachCodingTestResults(questions, answerList);
        setResult(gradeQuizAttempt(quiz, withTests, questions));
        return;
      }

      const times = checkpointQuestionTiming(Date.now(), true);
      setQuestionTimeMs(times);
      const submitPayload = {
        questions,
        questionIds: questions.map((q) => q.id),
        startedAt,
        questionTimeMs: times,
        leaveCount: leaveCountRef.current,
        leaveEvents: leaveEventsRef.current,
        markedForReview: [...markedForReview],
        seatNumber: seatNumber || undefined,
        clientMeta: softClientMeta(),
        submitReason: reason,
      };

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueQuizSubmit({
          courseId: effectiveCourseId,
          quizId: quiz.id,
          studentId: loadUser().id,
          answers: answerList,
          startedAt,
          questionIds: submitPayload.questionIds,
          questionTimeMs: times,
          leaveCount: leaveCountRef.current,
          leaveEvents: leaveEventsRef.current,
          markedForReview: [...markedForReview],
          seatNumber: seatNumber || undefined,
          clientMeta: softClientMeta(),
          submitReason: reason,
        });
        persistProgress(quiz.id, {
          startedAt,
          answers: answerList,
          markedForReview: [...markedForReview],
          currentQuestionIndex,
          furthestQuestionIndex,
          attemptExtraMinutes,
          questionTimeMs: times,
          leaveCount: leaveCountRef.current,
          leaveEvents: leaveEventsRef.current,
          seatNumber: seatNumber || undefined,
          clientMeta: softClientMeta(),
          viewedQuestionIds: [...viewedQuestionIdsRef.current],
        });
        setOfflineQueued(true);
        showToast("You're offline — submit queued. It will retry when you're back online.", "neutral");
        return;
      }

      if (reason !== "manual") setAutoSubmitted(true);
      const attempt = await submitQuizAttempt(effectiveCourseId, quiz, answerList, submitPayload);
      clearQuizProgress(effectiveCourseId, quiz.id);
      setOfflineQueued(false);
      setResult({
        score: attempt.score,
        maxScore: attempt.maxScore,
        autoGraded: attempt.autoGraded,
        perQuestion: gradeQuizAttempt(quiz, attempt.answers, questions).perQuestion,
      });
      if (quiz.oneTimeAccessToken && oneTimeToken) {
        consumeOneTimeToken(effectiveCourseId, quiz.id);
      }
      if (getQuizType(quiz) === "practice" && quiz.practiceRetakeWrongOnly) {
        const graded = gradeQuizAttempt(quiz, attempt.answers, questions);
        const wrong = graded.perQuestion.filter((p) => !p.correct).map((p) => p.questionId);
        try {
          sessionStorage.setItem(
            `canvasClone:practiceWrong:${quiz.id}`,
            JSON.stringify(wrong),
          );
        } catch {}
        setWrongOnlyIds(wrong);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Submit failed";
      const looksNetwork =
        /failed to fetch|network|offline|load failed/i.test(message) ||
        (typeof navigator !== "undefined" && navigator.onLine === false);
      if (!isPreview && looksNetwork && quiz) {
        const times = questionTimeMsRef.current;
        const answerList2 = questions.map(
      (q) => answers[q.id] ?? { questionId: q.id },
    );
        enqueueQuizSubmit({
          courseId: effectiveCourseId,
          quizId: quiz.id,
          studentId: loadUser().id,
          answers: answerList2,
          startedAt,
          questionIds: questions.map((q) => q.id),
          questionTimeMs: times,
          leaveCount: leaveCountRef.current,
          leaveEvents: leaveEventsRef.current,
          markedForReview: [...markedForReview],
          seatNumber: seatNumber || undefined,
          clientMeta: softClientMeta(),
          submitReason: reason,
        });
        setOfflineQueued(true);
        showToast("Submit failed (network) — queued for retry when online.", "neutral");
      return;
    }
      setError(message);
      showToast(
        reason !== "manual"
          ? `Auto-submit failed: ${message}`
          : `Could not submit quiz: ${message}`,
        "negative",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (reason: QuizSubmitReason = "manual") => {
    if (!quiz) return;
    if (reason === "manual" && !isPreview) {
      const missingEssayComments = questions
        .map((q, index) => ({ q, index }))
        .filter(({ q }) => isEssayCommentMissing(quiz, q, answers[q.id]))
        .map(({ q, index }) => ({
          id: q.id,
          label: quizItemLabel(questions, index),
          index,
        }));
      if (missingEssayComments.length > 0) {
        setSubmitConfirm({ unanswered: [], marked: [], missingEssayComments });
        return;
      }
      const unanswered = questions
        .map((q, index) => ({ q, index }))
        .filter(
          ({ q }) =>
            q.type !== "note" && q.type !== "group" && !hasAnswer(answers[q.id]),
        )
        .map(({ q, index }) => ({
          id: q.id,
          label: quizItemLabel(questions, index),
          index,
        }));
      const marked = questions
        .map((q, index) => ({ q, index }))
        .filter(
          ({ q }) =>
            q.type !== "note" &&
            q.type !== "group" &&
            markedForReview.has(q.id),
        )
        .map(({ q, index }) => ({
          id: q.id,
          label: quizItemLabel(questions, index),
          index,
        }));
      if (unanswered.length > 0 || marked.length > 0) {
        setSubmitConfirm({
          unanswered,
          marked,
          missingEssayComments: [],
          scorePreview: buildPracticeScorePreview(),
        });
        return;
      }
      const scorePreview = buildPracticeScorePreview();
      if (scorePreview) {
        setSubmitConfirm({
          unanswered: [],
          marked: [],
          missingEssayComments: [],
          scorePreview,
        });
        return;
      }
    }
    performSubmit(reason);
  };
  handleSubmitRef.current = handleSubmit;

  function buildPracticeScorePreview():
    | { score: number; maxScore: number }
    | undefined {
    if (!quiz || getQuizType(quiz) !== "practice" || !quiz.practiceScorePreview) {
      return undefined;
    }
    const answerList = questions.map((q) => answers[q.id] ?? { questionId: q.id });
    const graded = gradeQuizAttempt(quiz, answerList, questions);
    return { score: graded.score, maxScore: graded.maxScore };
  }

  const saveAndExit = () => {
    if (!quiz || !quizId) return;
    const answerList = questions.map((q) => answers[q.id] ?? { questionId: q.id });
    persistProgress(quizId, {
      startedAt,
      answers: answerList,
      markedForReview: [...markedForReview],
      currentQuestionIndex,
      furthestQuestionIndex,
      attemptExtraMinutes,
      questionTimeMs: questionTimeMsRef.current,
      leaveCount: leaveCountRef.current,
      leaveEvents: leaveEventsRef.current,
      seatNumber: seatNumber || undefined,
      clientMeta: softClientMeta(),
      viewedQuestionIds: [...viewedQuestionIdsRef.current],
    });
    showToast("Progress saved", "positive");
    navigate(quizPath);
  };

  // #56 beforeunload during live attempt
  useEffect(() => {
    if (!isLiveAttempt || result) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isLiveAttempt, result]);

  // #54 persist font scale
  useEffect(() => {
    try {
      sessionStorage.setItem(FONT_SCALE_KEY, fontScale);
    } catch {
      /* ignore */
    }
  }, [fontScale]);

  // #55 timer live region (throttled)
  useEffect(() => {
    if (!isLiveAttempt || result || !Number.isFinite(timeRemaining)) return;
    const minutesLeft = Math.ceil(timeRemaining / 60000);
    const secondsLeft = Math.floor(timeRemaining / 1000);
    if (secondsLeft <= 60 && secondsLeft > 0 && secondsLeft % 10 === 0) {
      setSrAnnouncement(`${secondsLeft} seconds remaining`);
    } else if (secondsLeft > 60 && minutesLeft <= 5) {
      const key = `m${minutesLeft}`;
      if (!firedAlertsRef.current.has(minutesLeft + 1000)) {
        firedAlertsRef.current.add(minutesLeft + 1000);
        setSrAnnouncement(`${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} remaining`);
      }
      void key;
    }
  }, [timeRemaining, isLiveAttempt, result]);

  // #57 cross-tab progress via BroadcastChannel + storage
  useEffect(() => {
    if (!quiz || !quizId || !isLiveAttempt || result) return;
    const studentId = loadUser().id;
    const applyRemote = (progress: QuizProgress | null | undefined) => {
      if (!progress || typeof progress.updatedAt !== "number") return;
      const local = getQuizProgress(effectiveCourseId, quizId, studentId);
      if (local && local.updatedAt >= progress.updatedAt) return;
      const nextAnswers: AnswerState = {};
      for (const a of progress.answers ?? []) {
        if (a?.questionId) nextAnswers[a.questionId] = a;
      }
      setAnswers(nextAnswers);
      setMarkedForReview(new Set(progress.markedForReview ?? []));
      if (typeof progress.currentQuestionIndex === "number") {
        setCurrentQuestionIndex(progress.currentQuestionIndex);
        setNavFocusIndex(progress.currentQuestionIndex);
      }
      if (typeof progress.furthestQuestionIndex === "number") {
        setFurthestQuestionIndex(progress.furthestQuestionIndex);
      }
      if (typeof progress.leaveCount === "number") setLeaveCount(progress.leaveCount);
      if (Array.isArray(progress.leaveEvents)) setLeaveEvents(progress.leaveEvents);
      if (progress.viewedQuestionIds) {
        setViewedQuestionIds(new Set(progress.viewedQuestionIds));
      }
      showToast("Progress updated from another tab", "neutral");
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("canvasClone:quizProgress");
      bc.onmessage = (ev) => {
        const data = ev.data as {
          type?: string;
          courseId?: string;
          quizId?: string;
          studentId?: string;
          progress?: QuizProgress | null;
        };
        if (data?.type !== "progress") return;
        if (data.courseId !== effectiveCourseId || data.quizId !== quizId) return;
        if (data.studentId !== studentId) return;
        applyRemote(data.progress);
      };
    } catch {
      bc = null;
    }

    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith("canvasClone:quizProgress:")) return;
      const remote = getQuizProgress(effectiveCourseId, quizId, studentId);
      applyRemote(remote);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
    };
  }, [quiz?.id, quizId, isLiveAttempt, result, effectiveCourseId, showToast]);

  // #58 offline / online queue
  useEffect(() => {
    const onOff = () => setIsOffline(true);
    const onOn = () => setIsOffline(false);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, []);

  useEffect(() => {
    if (!quiz || !quizId || !isLiveAttempt || result) return;
    if (isOffline) return;
    const queued = peekQueuedQuizSubmit(effectiveCourseId, quiz.id, loadUser().id);
    if (!queued) {
      setOfflineQueued(false);
      return;
    }
    setOfflineQueued(true);
    let cancelled = false;
    (async () => {
      try {
        setSubmitting(true);
        const attempt = await submitQuizAttempt(
          effectiveCourseId,
          quiz,
          queued.answers,
          {
            questions,
            questionIds: queued.questionIds,
            startedAt: queued.startedAt,
            questionTimeMs: queued.questionTimeMs,
            leaveCount: queued.leaveCount,
            leaveEvents: queued.leaveEvents,
            markedForReview: queued.markedForReview,
            seatNumber: queued.seatNumber,
            clientMeta: queued.clientMeta,
            submitReason: queued.submitReason,
          },
        );
        if (cancelled) return;
        removeQueuedQuizSubmit(queued.id);
    clearQuizProgress(effectiveCourseId, quiz.id);
        setOfflineQueued(false);
    setResult({
      score: attempt.score,
      maxScore: attempt.maxScore,
      autoGraded: attempt.autoGraded,
          perQuestion: gradeQuizAttempt(quiz, attempt.answers, questions).perQuestion,
        });
        showToast("Queued submit completed", "positive");
      } catch {
        /* stay queued */
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, quiz?.id, isLiveAttempt, result]);

  // Keep nav focus index in sync with current question
  useEffect(() => {
    setNavFocusIndex(currentQuestionIndex);
  }, [currentQuestionIndex]);

  // Begin a brand-new attempt after submitting the previous one. Starts a fresh
  // in-progress record with a new timer.
  const retake = () => {
    if (!quiz) return;
    setAnswers({});
    setMarkedForReview(new Set());
    setResult(null);
    setAutoSubmitted(false);
    setResumed(false);
    setCurrentQuestionIndex(0);
    setFurthestQuestionIndex(0);
    setQuestionTimeMs({});
    questionTimeMsRef.current = {};
    timingActiveRef.current = null;
    setLeaveCount(0);
    leaveCountRef.current = 0;
    setLeaveEvents([]);
    leaveEventsRef.current = [];
    setViewedQuestionIds(new Set());
    viewedQuestionIdsRef.current = new Set();
    setLeaveLocked(false);
    setPracticeRevealed(new Set());
    setSeatNumber("");
    setSeatDraft("");
    firedAlertsRef.current.clear();
    firedSecondAlertsRef.current.clear();
    clearQuizProgress(effectiveCourseId, quiz.id);
    if (getQuizType(quiz) === "practice" && quiz.practiceRetakeWrongOnly) {
      try {
        const raw = sessionStorage.getItem(`canvasClone:practiceWrong:${quiz.id}`);
        setWrongOnlyIds(raw ? (JSON.parse(raw) as string[]) : null);
      } catch {
        setWrongOnlyIds(null);
      }
    } else {
      setWrongOnlyIds(null);
    }
    const needSeat = Boolean(quiz.collectSeatNumber);
    const needFs = Boolean(quiz.requireFullscreen);
    if (needSeat) {
      setAwaitingSeat(true);
      setAwaitingFullscreen(needFs);
      setAwaitingOneAtATimeAck(Boolean(quiz.oneQuestionAtATime));
      return;
    }
    if (needFs) {
      setAwaitingSeat(false);
      setAwaitingFullscreen(true);
      setAwaitingOneAtATimeAck(Boolean(quiz.oneQuestionAtATime));
      return;
    }
    if (quiz.oneQuestionAtATime) {
      setAwaitingOneAtATimeAck(true);
      return;
    }
    const start = Date.now();
    setStartedAt(start);
    setNow(Date.now());
    setAwaitingOneAtATimeAck(false);
    persistProgress(quiz.id, {
      startedAt: start,
      answers: [],
      markedForReview: [],
      currentQuestionIndex: 0,
      furthestQuestionIndex: 0,
      questionTimeMs: {},
      leaveCount: 0,
      leaveEvents: [],
      clientMeta: softClientMeta(),
      viewedQuestionIds: [],
    });
  };

  useEffect(() => {
    if (awaitingOneAtATimeAck || awaitingSeat || awaitingFullscreen) return;
    if (!result && !isPreview && timeLimitMs > 0 && timeRemaining <= 0 && quiz) {
      handleSubmit("timeout");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    timeRemaining,
    result,
    isPreview,
    timeLimitMs,
    quiz,
    awaitingOneAtATimeAck,
    awaitingSeat,
    awaitingFullscreen,
  ]);

  // Warn the student as their remaining time crosses each threshold. Each
  // threshold fires once per attempt and only when the quiz limit exceeds it.
  useEffect(() => {
    if (result || isPreview || timeLimitMs <= 0 || !quiz || awaitingOneAtATimeAck) return;
    const limitMinutes = totalLimitMinutes ?? 0;
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
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-gray-500">
          {t("take.quizNotFound")}
        </div>
      </div>
    );
  }

  const remaining = getRemainingAttempts(quiz, effectiveCourseId);
  const datedQuiz = applyEffectiveDates(
    effectiveCourseId,
    "quiz",
    quiz,
    loadUser().id,
  );
  const priorAttempts = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id);
  const canTake =
    isPreview ||
    (canStudentTakeQuiz(quiz, now, {
      courseId: effectiveCourseId,
      studentId: loadUser().id,
      oneTimeToken,
    }) &&
      remaining > 0);
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

  const quizType = getQuizType(quiz);
  const isPracticeInstant =
    quizType === "practice" &&
    Boolean(quiz.practiceInstantFeedback) &&
    !result &&
    !isPreview;
  const practiceInstantReview = (question: QuizQuestion) => {
    if (!isPracticeInstant || !practiceRevealed.has(question.id)) return undefined;
    if (question.type === "note" || question.type === "group") return undefined;
    const ans = answers[question.id];
    if (!hasAnswer(ans)) return undefined;
    try {
      const credit = scoreQuestionAnswer(quiz, question, ans);
      return {
        correct: credit.correct,
        partial: credit.partial || undefined,
        partialNote:
          credit.partial ? describePartialCredit(quiz, question, ans) : undefined,
      };
    } catch {
      return { correct: false };
    }
  };
  const reviewShowResponses = isPreview || quizShowsResponses(quiz);
  const reviewRevealKey =
    quizType !== "survey" && (isPreview || quizShowsCorrectAnswers(quiz, now));
  // In review mode the "only once" gate can hide responses entirely.
  const responsesVisible = reviewShowResponses && !reviewLocked;

  const resetPracticeAttempt = () => {
    if (!quiz || getQuizType(quiz) !== "practice" || result) return;
    setAnswers({});
    setMarkedForReview(new Set());
    setPracticeRevealed(new Set());
    setCurrentQuestionIndex(0);
    setFurthestQuestionIndex(0);
    setQuestionTimeMs({});
    questionTimeMsRef.current = {};
    setError(null);
    showToast("Practice attempt reset", "neutral");
  };

  const handlePrint = (
    includeKey: boolean,
    filter: "all" | "unanswered" | "wrong" = "all",
  ) => {
    if (quizType === "survey") includeKey = false;
    setPrintIncludeKey(includeKey);
    setPrintFilter(filter);
    setPrintAllQuestions(true);
    document.body.classList.add("quiz-printing");
    if (includeKey) document.body.classList.add("quiz-print-with-key");
    else document.body.classList.remove("quiz-print-with-key");
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      setPrintAllQuestions(false);
      setPrintIncludeKey(false);
      setPrintFilter("all");
      document.body.classList.remove("quiz-printing", "quiz-print-with-key");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        window.setTimeout(cleanup, 1500);
      });
    });
  };

  const scoreGateAttempt =
    !isPreview && quiz
      ? (() => {
          const attempts = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id);
          if (isReview && reviewAttemptId) {
            return attempts.find((a) => a.id === reviewAttemptId) ?? attempts[attempts.length - 1];
          }
          return attempts[attempts.length - 1];
        })()
      : null;

  const correctById = new Map(
    (result?.perQuestion ?? []).map((p) => [
      p.questionId,
      {
        correct: p.correct,
        partial: p.partial,
        earned: p.earned,
        possible: p.possible,
      },
    ]),
  );

  // Honor GradePro per-question overrides when reviewing a saved attempt.
  if (isReview && scoreGateAttempt?.questionScores) {
    for (const [qid, override] of Object.entries(scoreGateAttempt.questionScores)) {
      const existing = correctById.get(qid);
      if (!existing || !Number.isFinite(override)) continue;
      const possible = existing.possible;
      const earned = override;
      correctById.set(qid, {
        ...existing,
        earned,
        correct: possible > 0 ? earned >= possible - 1e-9 : existing.correct,
        partial:
          possible > 0 && earned > 1e-9 && earned < possible - 1e-9
            ? true
            : earned <= 1e-9
              ? false
              : existing.partial,
      });
    }
  }

  const scoreVisible =
    isPreview ||
    quizShowsScoreToStudent(quiz, {
      courseId: effectiveCourseId,
      studentId: loadUser().id,
      attempt: scoreGateAttempt ?? (result ? { autoGraded: result.autoGraded } : null),
    });

  const scoredQuestions = questions.filter(
    (q) => q.type !== "note" && q.type !== "group",
  );
  const answeredCount = scoredQuestions.filter((q) => hasAnswer(answers[q.id])).length;
  const markedCount = scoredQuestions.filter((q) => markedForReview.has(q.id)).length;
  const viewedCount = scoredQuestions.filter((q) => viewedQuestionIds.has(q.id)).length;

  const gateBlocked = studentView && !isPreview && !result && (!isStudentViewableQuiz(quiz, now) || !canTake);
  const showWorkspace = !gateBlocked && questions.length > 0;
  // Right panel (timer + question nav) — keep for live student attempts only.
  const showSidePanel =
    showWorkspace &&
    !isPreview &&
    !result &&
    !awaitingOneAtATimeAck &&
    !awaitingSeat &&
    !awaitingFullscreen &&
    !needsAccessUnlock &&
    !printAllQuestions;
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
      <h1 className="quiz-print-title text-2xl font-normal text-canvas-grayDark">
        {quiz.title}
      </h1>
      {isPreview && (
        <span className="print-hide inline-flex items-center gap-1 rounded-full bg-canvas-blueTint px-2.5 py-0.5 text-xs font-medium text-canvas-blueDark">
          <Eye className="h-3.5 w-3.5" /> Preview
        </span>
      )}
      {isReview && !isPreview && (
        <span className="print-hide inline-flex items-center gap-1 rounded-full bg-canvas-blueTint px-2.5 py-0.5 text-xs font-medium text-canvas-blueDark">
          <Eye className="h-3.5 w-3.5" /> Your responses
        </span>
      )}
    </div>
  );

  return (
    <div className="quiz-print-root relative flex h-full w-full flex-col bg-canvas-grayLight">
      <div className="quiz-print-running-header" aria-hidden>
        <span className="quiz-print-running-title">{quiz.title}</span>
        {printIncludeKey ? <span> · Answer key</span> : null}
      </div>
      <div className="quiz-print-running-footer" aria-hidden>
        <span className="quiz-print-page-num" />
      </div>
      <div className="print-hide shrink-0">
      <CourseHeader />
      </div>
      {leaveLocked && !result && (
        <div className="print-hide fixed inset-0 z-[85] flex items-center justify-center bg-white/40 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white px-6 py-5 shadow-xl">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-950">
                  {t("take.youLeftTab")}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90">
                  {quiz.warnOnLeave && leaveCount === 1
                    ? "Leaving will be recorded. The quiz is locked until you return. The time limit is still counting down."
                    : "The quiz is locked until you return. The time limit is still counting down."}
                  {typeof quiz.maxLeaveCount === "number" && quiz.maxLeaveCount > 0
                    ? ` Leaves: ${leaveCount} of ${quiz.maxLeaveCount}.`
                    : leaveCount > 0
                      ? ` Leaves this attempt: ${leaveCount}.`
                      : ""}
                </p>
                {timeLimitMs > 0 && (
                  <p
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-100/80 px-3 py-2 text-sm font-semibold text-amber-950"
                    data-testid="leave-lock-timer"
                  >
                    <Clock className="h-4 w-4 shrink-0" />
                    {t("take.timeLeft")}:{" "}
                    {formatMinutesLeft(Math.max(0, timeRemaining))}
                  </p>
                )}
                <button
                  type="button"
                  onClick={acknowledgeLeaveReturn}
                  className="btn-canvas-primary mt-4"
                >
                  {t("take.returnToQuiz")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        className={`quiz-print-main min-h-0 flex-1 overflow-y-auto bg-white px-4 py-6 sm:px-8 sm:py-8 ${FONT_SCALE_CLASS[fontScale]} ${
          leaveLocked && !result ? "pointer-events-none select-none quiz-leave-blur" : ""
        }`}
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {srAnnouncement}
        </div>
        <div className="w-full">
          <div className="print-hide mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            to={quizPath}
              className="inline-flex items-center gap-1.5 text-sm text-canvas-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to quiz
          </Link>
            {!result && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  Text
                  <select
                    value={fontScale}
                    onChange={(e) => setFontScale(e.target.value as FontScale)}
                    className="form-input h-8 py-0 text-xs"
                    aria-label="Font size"
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setCheatSheetOpen(true)}
                  className="btn-canvas-secondary px-2.5 py-1 text-xs"
                  title="Keyboard shortcuts (?)"
                >
                  Shortcuts
                </button>
              </div>
            )}
          </div>

          <div
            className={
              showSidePanel
                ? "quiz-print-layout grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"
                : "quiz-print-layout"
            }
          >
            <div>
              <div className="mb-6 print:mb-4">
                {titleHeader}
                <p className="mt-1 text-sm text-gray-500">
                  {questionCount} question{questionCount === 1 ? "" : "s"} ·{" "}
                  {formatPoints(maxScore)} pts
                  {printIncludeKey ? " · Answer key" : ""}
                </p>
                {isPreview && (
                  <div className="print-hide mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrint(false)}
                      className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                    >
                      <Printer className="h-4 w-4" />
                      Print quiz
                    </button>
                    {quizType !== "survey" && (
                      <button
                        type="button"
                        onClick={() => handlePrint(true)}
                        className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                      >
                        <Printer className="h-4 w-4" />
                        Print with answer key
                      </button>
                    )}
                  </div>
                )}
                {(isReview || (Boolean(result) && isPreview)) && quizType !== "survey" && (
                  <div className="print-hide mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrint(false, "unanswered")}
                      className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                    >
                      <Printer className="h-4 w-4" />
                      Print unanswered
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrint(false, "wrong")}
                      className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                    >
                      <Printer className="h-4 w-4" />
                      Print incorrect
                    </button>
                  </div>
                )}
              </div>

              {resumed && !result && (
                <div className="print-hide">
                <StatusAlertBanner tone="neutral" className="mb-6">
                  <span className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
                    <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0" />
                    You resumed an attempt in progress — your timer kept running.
                    </span>
                    <span className="text-gray-600">
                      {Number.isFinite(timeRemaining)
                        ? `Time left: ${formatMinutesLeft(Math.max(0, timeRemaining))}`
                        : "No time limit"}
                      {leaveCount > 0
                        ? ` · Leaves: ${leaveCount}${
                            typeof quiz.maxLeaveCount === "number" && quiz.maxLeaveCount > 0
                              ? `/${quiz.maxLeaveCount}`
                              : ""
                          }`
                        : ""}
                    </span>
                  </span>
                </StatusAlertBanner>
                </div>
              )}

              {(isOffline || offlineQueued) && !result && isLiveAttempt && (
                <div className="print-hide mb-4">
                  <StatusAlertBanner tone="neutral">
                    <span className="text-sm">
                      {isOffline
                        ? "You're offline. Answers still save locally; submit will queue until you're back online."
                        : "A submit is queued and will retry automatically."}
                    </span>
                  </StatusAlertBanner>
                </div>
              )}

              {result && (
                <div className="print-hide mb-6 rounded-lg border border-canvas-blue/30 bg-canvas-blueTint px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-canvas-grayDark">
                        {isPreview
                          ? "Preview results"
                          : isReview
                            ? "Your submission"
                            : quizType === "survey"
                              ? "Survey submitted"
                            : "Attempt submitted"}
                      </p>
                      {scoreVisible && quizType !== "survey" ? (
                      <p className="mt-0.5 text-sm text-gray-600">
                          Score:{" "}
                          <span className="font-semibold">{formatPoints(result.score)}</span> /{" "}
                          {formatPoints(result.maxScore)}
                        {result.maxScore > 0 &&
                          ` (${Math.round((result.score / result.maxScore) * 100)}%)`}
                          {typeof scoreGateAttempt?.fudgePoints === "number" &&
                            scoreGateAttempt.fudgePoints !== 0 && (
                              <span className="text-gray-500">
                                {" "}
                                ({scoreGateAttempt.fudgePoints > 0 ? "+" : ""}
                                {formatPoints(scoreGateAttempt.fudgePoints)} fudge)
                              </span>
                            )}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-gray-600">
                          {quizType === "survey"
                            ? isPreview
                              ? "Surveys collect responses only — no score or answer key."
                              : "Thank you — surveys do not show a score."
                            : quiz.hideScoreUntilGraded
                              ? "Your score will appear once this attempt is fully graded."
                              : "Your score is hidden until your instructor posts grades."}
                        </p>
                      )}
                      {!isPreview && priorAttempts.length > 1 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <label className="text-xs font-medium text-gray-600">
                            Attempt
                            <select
                              className="form-input ml-2 h-8 text-sm"
                              value={
                                reviewAttemptId &&
                                priorAttempts.some((a) => a.id === reviewAttemptId)
                                  ? reviewAttemptId
                                  : priorAttempts[priorAttempts.length - 1]?.id ?? ""
                              }
                              onChange={(e) => {
                                const id = e.target.value;
                                navigate(
                                  `${quizPath}/take?review=1&attempt=${encodeURIComponent(id)}`,
                                  { replace: true },
                                );
                              }}
                            >
                              {priorAttempts.map((a) => {
                                const policyAttempt = getScoringPolicyAttempt(
                                  effectiveCourseId,
                                  quiz,
                                  a.studentId,
                                );
                                const counts = policyAttempt?.id === a.id;
                                const pts = scoreVisible
                                  ? formatPoints(getAttemptEffectiveScore(a))
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
                            <span className="text-xs text-gray-500">
                              Showing{" "}
                              {QUIZ_SCORING_POLICY_LABELS[getQuizScoringPolicy(quiz)].toLowerCase()}
                              {` of ${priorAttempts.length}`}
                            </span>
                          )}
                    </div>
                      )}
                    </div>
                    {scoreVisible && !result.autoGraded && (
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
              ) : needsAccessUnlock ? (
                <form
                  onSubmit={unlockAccess}
                  className="max-w-md rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-canvas-grayDark">
                    Access code required
                  </p>
                  <p className="mt-1.5 text-sm text-gray-600">
                    Enter the code from your instructor before you begin.
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
                  <button type="submit" className="btn-canvas-primary mt-4">
                    Unlock and continue
                  </button>
                </form>
              ) : awaitingSeat ? (
                <form
                  onSubmit={confirmSeatNumber}
                  className="max-w-md rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm"
                >
                  <p className="text-sm font-semibold text-canvas-grayDark">
                    Seat / station number
                  </p>
                  <p className="mt-1.5 text-sm text-gray-600">
                    {quiz.requireSeatNumber === false
                      ? "Optionally enter your seat or station number, or skip."
                      : "Enter your seat or station number before you begin."}
                  </p>
                  <input
                    type="text"
                    value={seatDraft}
                    onChange={(e) => setSeatDraft(e.target.value)}
                    className="form-input mt-3 h-10"
                    placeholder="e.g. A12"
                    autoComplete="off"
                    autoFocus
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="submit" className="btn-canvas-primary">
                      Continue
                    </button>
                    {quiz.requireSeatNumber === false && (
                      <button
                        type="button"
                        onClick={skipSeatNumber}
                        className="btn-canvas-secondary"
                      >
                        Skip
                      </button>
                    )}
                  </div>
                </form>
              ) : awaitingFullscreen ? (
                <div className="max-w-md rounded-lg border border-canvas-blue/30 bg-canvas-blueTint/40 px-5 py-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Maximize className="mt-0.5 h-5 w-5 shrink-0 text-canvas-blue" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-canvas-grayDark">
                        Fullscreen required
                      </p>
                      <p className="mt-1.5 text-sm text-gray-600">
                        Enter fullscreen before starting this quiz to reduce
                        distractions.
                      </p>
                      <button
                        type="button"
                        onClick={() => void enterFullscreenAndContinue()}
                        className="btn-canvas-primary mt-4 inline-flex items-center gap-2"
                      >
                        <Maximize className="h-4 w-4" />
                        Enter fullscreen
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {(quiz.lockOnLeave ||
                    quiz.requireFullscreen ||
                    quiz.softDisablePaste ||
                    quiz.idleTimeoutMinutes ||
                    quiz.collectSeatNumber) &&
                    !result && (
                      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-canvas-blue/25 bg-canvas-blueTint/50 px-4 py-3 text-sm text-canvas-grayDark">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-canvas-blue" />
                        <div>
                          <p className="font-semibold">Soft exam mode</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
                            This quiz uses soft focus settings
                            {quiz.lockOnLeave ? " (tab leaves recorded)" : ""}
                            {quiz.requireFullscreen ? " · fullscreen preferred" : ""}
                            {quiz.idleTimeoutMinutes
                              ? ` · idle timeout ${quiz.idleTimeoutMinutes} min`
                              : ""}
                            {quiz.softDisablePaste ? " · paste soft-disabled" : ""}
                            . This is not a lockdown browser.
                          </p>
                        </div>
                      </div>
                    )}
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
                  ) : awaitingOneAtATimeAck ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-amber-950">
                            One question at a time
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90">
                            This quiz shows one question at a time
                            {quiz.lockPreviousQuestions
                              ? ". Once you move forward, you cannot return to previous questions."
                              : ". You can move between questions with Next and Previous."}{" "}
                            Make sure you are ready before you begin
                            {quiz.timeLimitMinutes
                              ? " — the timer starts when you continue."
                              : "."}
                          </p>
                          <button
                            type="button"
                            onClick={beginOneAtATimeAttempt}
                            className="btn-canvas-primary mt-4"
                          >
                            Begin quiz
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {oneAtATime && (
                        <div className="sticky top-0 z-[5] flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2.5 text-sm text-gray-600 shadow-sm backdrop-blur-sm sm:px-4">
                          <span>
                            {quizItemLabel(questions, currentQuestionIndex)}{" "}
                            <span className="text-gray-400">·</span>{" "}
                            <span className="font-semibold text-canvas-grayDark">
                              {currentQuestionIndex + 1}
                            </span>{" "}
                            of {questions.length}
                            {lockPrevious && (
                              <span className="ml-2 text-xs text-amber-700">
                                · Previous questions locked
                              </span>
                            )}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={goPrevQuestion}
                              disabled={lockPrevious || currentQuestionIndex <= 0}
                              className="btn-canvas-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                              <span className="hidden xs:inline sm:inline">Previous</span>
                            </button>
                            <button
                              type="button"
                              onClick={goNextQuestion}
                              disabled={currentQuestionIndex >= questions.length - 1}
                              className="btn-canvas-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <span className="hidden sm:inline">Next</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      {(oneAtATime && !printAllQuestions
                        ? [questions[currentQuestionIndex]].filter(Boolean)
                        : questions
                      )
                        .filter((question) => {
                          if (!printAllQuestions || printFilter === "all") return true;
                          if (question.type === "note" || question.type === "group") {
                            return false;
                          }
                          if (printFilter === "unanswered") {
                            return !hasAnswer(answers[question.id]);
                          }
                          if (printFilter === "wrong") {
                            const row = correctById.get(question.id);
                            if (!row) return !hasAnswer(answers[question.id]);
                            return !row.correct && !row.partial;
                          }
                          return true;
                        })
                        .map((question) => {
                        const index = questions.findIndex((q) => q.id === question.id);
                        const isPrinting = printAllQuestions;
                        const printKeyOk =
                          printIncludeKey &&
                          !question.omitFromAnswerKey &&
                          quizType !== "survey";
                        return (
                        <div
                          key={question.id}
                            data-question-id={question.id}
                          ref={(el) => {
                            questionRefs.current[question.id] = el;
                          }}
                            className="quiz-print-question scroll-mt-4"
                        >
                          <QuizQuestionCard
                              question={
                                result || isReview || printIncludeKey
                                  ? question
                                  : sanitizeQuestionForStudent(question)
                              }
                              gradingQuestion={
                                result || isReview || printIncludeKey
                                  ? undefined
                                  : question
                              }
                            index={index}
                              label={quizItemLabel(questions, index)}
                            answer={answers[question.id]}
                            onChange={setAnswer}
                              disabled={Boolean(result) || printIncludeKey || leaveLocked}
                              softDisablePaste={Boolean(quiz.softDisablePaste) && !result}
                              unanswered={
                                Boolean(result) &&
                                question.type !== "note" &&
                                question.type !== "group" &&
                                !hasAnswer(answers[question.id])
                              }
                            review={
                              isPrinting && printKeyOk
                                ? { correct: true }
                                : result &&
                                    quizType !== "survey" &&
                                    reviewRevealKey &&
                                    hasAnswer(answers[question.id])
                                  ? (() => {
                                      const base =
                                        correctById.get(question.id) ?? {
                                          correct: false,
                                        };
                                      return {
                                        ...base,
                                        partialNote:
                                          "partial" in base && base.partial && quiz
                                            ? describePartialCredit(
                                                quiz,
                                                question,
                                                answers[question.id],
                                              )
                                            : undefined,
                                      };
                                    })()
                                  : isPrinting
                                    ? result &&
                                      quizType !== "survey" &&
                                      hasAnswer(answers[question.id])
                                      ? (correctById.get(question.id) ?? {
                                          correct: false,
                                        })
                                      : undefined
                                    : practiceInstantReview(question)
                            }
                              revealKey={
                                isPrinting
                                  ? printKeyOk
                                  : Boolean(reviewRevealKey) ||
                                    (isPracticeInstant && practiceRevealed.has(question.id))
                              }
                            markedForReview={markedForReview.has(question.id)}
                            onToggleMarkForReview={() => toggleMarkForReview(question.id)}
                            attemptSeed={attemptSeed}
                            requireEssayComment={quizRequiresEssayComment}
                            useMonacoEditor={useMonaco}
                          />
                            {printIncludeKey &&
                              question.omitFromAnswerKey &&
                              quizType !== "survey" && (
                                <p className="mt-1 text-xs italic text-gray-500">
                                  Omitted from answer key
                                </p>
                              )}
                          </div>
                        );
                      })}
                      {oneAtATime && (
                        <div className="print-hide flex justify-between gap-2">
                          <button
                            type="button"
                            onClick={goPrevQuestion}
                            disabled={lockPrevious || currentQuestionIndex <= 0}
                            className="btn-canvas-secondary inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            {t("take.previous")}
                          </button>
                          {currentQuestionIndex < questions.length - 1 ? (
                          <button
                            type="button"
                              onClick={goNextQuestion}
                              className="btn-canvas-primary inline-flex items-center gap-1"
                          >
                              {t("take.nextQuestion")}
                              <ChevronRight className="h-4 w-4" />
                          </button>
                          ) : (
                            <span className="self-center text-xs text-gray-500">
                              {t("take.lastQuestion")}
                            </span>
                    )}
                  {isPracticeInstant &&
                    questions[currentQuestionIndex] &&
                    questions[currentQuestionIndex].type !== "note" &&
                    questions[currentQuestionIndex].type !== "group" &&
                    !practiceRevealed.has(questions[currentQuestionIndex].id) && (
                      <button
                        type="button"
                        onClick={checkPracticeAnswer}
                        className="btn-canvas-secondary text-sm"
                      >
                        Check answer
                      </button>
                    )}
                  </div>
                      )}
                    </div>
                  )}

                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                </>
              )}
            </div>

            {showSidePanel && (
              <aside className="print-hide lg:pt-1">
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
                            {datedQuiz.dueAt ? formatQuizDateTime(datedQuiz.dueAt) : "No due date"}
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
                    {!result && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Answered {answeredCount} · Viewed {viewedCount} · Marked {markedCount}
                      </p>
                    )}
                    <ul
                      className="mt-3 max-h-[22.5rem] space-y-0.5 overflow-y-auto pr-1"
                      role="listbox"
                      aria-label="Question navigator"
                      onKeyDown={(e) => {
                        if (result) return;
                        if (e.key === "ArrowDown" || e.key === "j") {
                          e.preventDefault();
                          const next = Math.min(navFocusIndex + 1, questions.length - 1);
                          setNavFocusIndex(next);
                          goToQuestionIndex(next);
                        } else if (e.key === "ArrowUp" || e.key === "k") {
                          e.preventDefault();
                          const next = Math.max(navFocusIndex - 1, 0);
                          setNavFocusIndex(next);
                          goToQuestionIndex(next);
                        } else if (e.key === "Home") {
                          e.preventDefault();
                          setNavFocusIndex(0);
                          goToQuestionIndex(0);
                        } else if (e.key === "End") {
                          e.preventDefault();
                          const last = questions.length - 1;
                          setNavFocusIndex(last);
                          goToQuestionIndex(last);
                        } else if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          goToQuestionIndex(navFocusIndex);
                        }
                      }}
                    >
                      {questions.map((question, index) => {
                        const answered =
                          question.type === "note" || question.type === "group" || hasAnswer(answers[question.id]);
                        const rev =
                          result &&
                          responsesVisible &&
                          reviewRevealKey
                            ? correctById.get(question.id)
                            : undefined;
                        const isCurrent = oneAtATime && index === currentQuestionIndex;
                        const blockedPrev =
                          oneAtATime &&
                          lockPrevious &&
                          index < currentQuestionIndex;
                        const blockedFuture =
                          oneAtATime &&
                          lockPrevious &&
                          index > furthestQuestionIndex;
                        const navDisabled = blockedPrev || blockedFuture;
                        const itemLabel = quizItemLabel(questions, index);
                        const focused = index === navFocusIndex;
                        return (
                          <li key={question.id} role="option" aria-selected={isCurrent || focused}>
                            <button
                              type="button"
                              disabled={navDisabled}
                              tabIndex={focused ? 0 : -1}
                              onFocus={() => setNavFocusIndex(index)}
                              onClick={() => goToQuestionIndex(index)}
                              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                                navDisabled
                                  ? "cursor-not-allowed text-gray-400"
                                  : isCurrent || focused
                                    ? "bg-canvas-blueTint font-medium text-canvas-blue"
                                    : "text-canvas-blue hover:bg-gray-50"
                              }`}
                              title={
                                blockedPrev
                                  ? "Previous questions are locked"
                                  : blockedFuture
                                    ? "Reach this question with Next first"
                                    : undefined
                              }
                            >
                              {question.type === "note" || question.type === "group" ? (
                                <Circle className="h-4 w-4 shrink-0 text-amber-400" />
                              ) : result && !answered ? (
                                <Circle className="h-4 w-4 shrink-0 fill-slate-200 text-slate-500" />
                              ) : result && responsesVisible && reviewRevealKey ? (
                                rev?.correct ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                                ) : rev?.partial ? (
                                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                                )
                              ) : answered ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-canvas-blue" />
                              ) : (
                                <Circle className="h-4 w-4 shrink-0 text-gray-300" />
                              )}
                              <span
                                className={`flex-1 ${
                                  result && !answered ? "font-medium text-slate-700" : ""
                                }`}
                              >
                                {itemLabel}
                              </span>
                              {result &&
                                responsesVisible &&
                                reviewRevealKey &&
                                answered &&
                                scoreVisible &&
                                question.type !== "note" && question.type !== "group" &&
                                typeof rev?.earned === "number" &&
                                typeof rev?.possible === "number" && (
                                  <span
                                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                                      rev.correct
                                        ? "bg-green-50 text-green-700"
                                        : rev.partial
                                          ? "bg-amber-50 text-amber-800"
                                          : "bg-red-50 text-red-700"
                                    }`}
                                  >
                                    {formatPoints(rev.earned)}
                                    <span className="font-normal opacity-60">
                                      /{formatPoints(rev.possible)}
                                    </span>
                                  </span>
                                )}
                              {!result &&
                                question.type !== "note" && question.type !== "group" &&
                                markedForReview.has(question.id) && (
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
                              ? `Time limit: ${effectiveLimitMinutes ?? quiz.timeLimitMinutes} min (preview \u2014 not submitted)`
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

      {showWorkspace && !awaitingOneAtATimeAck && (
        <div className="quiz-take-action-bar print-hide z-20 shrink-0 border-t border-gray-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6" data-testid="quiz-take-action-bar">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {!result && (
                <>
                  <span className="rounded-full bg-canvas-blueTint px-2 py-0.5 font-medium text-canvas-blueDark">
                    Answered {answeredCount}/{scoredQuestions.length}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                    Viewed {viewedCount}/{scoredQuestions.length}
                  </span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                    Marked {markedCount}
                  </span>
                </>
              )}
              <span className="hidden sm:inline">
                {effectiveLimitMinutes
                  ? `Time limit: ${formatTimeLimitDisplay(effectiveLimitMinutes)}`
                  : "No time limit"}
              </span>
              {isLiveAttempt && !result && saveStatus !== "idle" && (
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    saveStatus === "saving"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-green-50 text-green-800"
                  }`}
                >
                  {saveStatus === "saving" ? "Saving…" : "Saved"}
                </span>
              )}
              {leaveCount > 0 && !result && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                  Leaves: {leaveCount}
                  {typeof quiz.maxLeaveCount === "number" && quiz.maxLeaveCount > 0
                    ? ` / ${quiz.maxLeaveCount}`
                    : ""}
                </span>
              )}
              {seatNumber && !result && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                  Seat {seatNumber}
                </span>
              )}
              {quiz.requireViewAllQuestions && !result && (
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    allRequiredViewed
                      ? "bg-green-50 text-green-800"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  Viewed {viewedRequiredCount}/{requiredViewQuestions.length}
                </span>
              )}
              {!result && (
                <button
                  type="button"
                  onClick={() => setCheatSheetOpen(true)}
                  className="hidden text-gray-400 underline-offset-2 hover:underline sm:inline"
                >
                  Shortcuts: ? · J/K · M
                </button>
              )}
            </div>
            {result ? (
              <div className="flex gap-2">
                {isPreview ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAnswers({});
                      setResult(null);
                      setCurrentQuestionIndex(0);
                      setFurthestQuestionIndex(0);
                      if (quiz.oneQuestionAtATime) {
                        setAwaitingOneAtATimeAck(true);
                      } else {
                        setStartedAt(Date.now());
                        setNow(Date.now());
                      }
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
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {quizType === "practice" && !isPreview && (
                  <button
                    type="button"
                    onClick={resetPracticeAttempt}
                    className="btn-canvas-secondary w-full sm:w-auto"
                  >
                    Reset attempt
                  </button>
                )}
                {isLiveAttempt && (
                  <button
                    type="button"
                    onClick={saveAndExit}
                    className="btn-canvas-secondary w-full sm:w-auto"
                  >
                    {t("take.saveExit")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSubmit("manual")}
                  disabled={submitting || !allRequiredViewed}
                  title={
                    !allRequiredViewed
                      ? `View all questions first (${viewedRequiredCount}/${requiredViewQuestions.length})`
                      : undefined
                  }
                  className="btn-canvas-primary w-full px-6 sm:w-auto disabled:opacity-60"
                  data-testid="quiz-submit-button"
                >
                  {submitting
                    ? t("take.submitting")
                    : isPreview
                      ? quizType === "survey"
                        ? t("take.previewResponses")
                        : t("take.checkAnswers")
                      : quizType === "survey"
                        ? t("take.submitSurvey")
                        : t("take.submit")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={submitConfirm != null}
        title={t("take.confirmSubmit")}
        description={
          submitConfirm
            ? submitConfirm.missingEssayComments.length > 0
              ? `${submitConfirm.missingEssayComments.length} essay question${
                  submitConfirm.missingEssayComments.length === 1 ? "" : "s"
                } still need a required reflection comment.`
              : [
                  submitConfirm.scorePreview
                    ? `Estimated score: ${formatPoints(submitConfirm.scorePreview.score)} / ${formatPoints(submitConfirm.scorePreview.maxScore)}`
                    : null,
                  submitConfirm.unanswered.length
                    ? `${submitConfirm.unanswered.length} unanswered`
                    : null,
                  submitConfirm.marked.length
                    ? `${submitConfirm.marked.length} marked for review`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") +
                (submitConfirm.missingEssayComments.length === 0
                  ? submitConfirm.scorePreview && !submitConfirm.unanswered.length && !submitConfirm.marked.length
                    ? " Submit now?"
                    : ". Submit anyway?"
                  : "")
            : undefined
        }
        confirmText={
          submitConfirm?.missingEssayComments.length ? "OK" : "Submit anyway"
        }
        cancelText={submitConfirm?.missingEssayComments.length ? "Close" : "Cancel"}
        tone={submitConfirm?.missingEssayComments.length ? "neutral" : "primary"}
        onClose={() => setSubmitConfirm(null)}
        onConfirm={() => {
          if (submitConfirm?.missingEssayComments.length) {
            setSubmitConfirm(null);
            return;
          }
          setSubmitConfirm(null);
          performSubmit("manual");
        }}
      >
        {submitConfirm && (
          <div className="max-h-48 space-y-3 overflow-y-auto text-sm">
            {submitConfirm.scorePreview && (
              <p className="rounded-lg border border-canvas-blue/20 bg-canvas-blueTint/40 px-3 py-2 font-medium text-canvas-blueDark">
                Estimated score: {formatPoints(submitConfirm.scorePreview.score)} /{" "}
                {formatPoints(submitConfirm.scorePreview.maxScore)}
              </p>
            )}
            {submitConfirm.missingEssayComments.length > 0 && (
              <div>
                <p className="font-medium text-canvas-grayDark">Missing reflection comments</p>
                <ul className="mt-1 list-inside list-disc text-gray-600">
                  {submitConfirm.missingEssayComments.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="text-canvas-blue hover:underline"
                        onClick={() => {
                          setSubmitConfirm(null);
                          goToQuestionIndex(item.index);
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {submitConfirm.unanswered.length > 0 && (
              <div>
                <p className="font-medium text-canvas-grayDark">{t("take.unanswered")}</p>
                <ul className="mt-1 list-inside list-disc text-gray-600">
                  {submitConfirm.unanswered.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="text-canvas-blue hover:underline"
                        onClick={() => {
                          setSubmitConfirm(null);
                          goToQuestionIndex(item.index);
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {submitConfirm.marked.length > 0 && (
              <div>
                <p className="font-medium text-canvas-grayDark">{t("take.markedForReview")}</p>
                <ul className="mt-1 list-inside list-disc text-gray-600">
                  {submitConfirm.marked.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="text-canvas-blue hover:underline"
                        onClick={() => {
                          setSubmitConfirm(null);
                          goToQuestionIndex(item.index);
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </ConfirmActionModal>

      {cheatSheetOpen && (
        <CanvasModal title="Quiz shortcuts" onClose={() => setCheatSheetOpen(false)} size="md">
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              <kbd className="rounded border bg-gray-50 px-1.5 py-0.5 font-mono text-xs">?</kbd>{" "}
              Open this cheat sheet
            </li>
            <li>
              <kbd className="rounded border bg-gray-50 px-1.5 py-0.5 font-mono text-xs">J</kbd> /{" "}
              <kbd className="rounded border bg-gray-50 px-1.5 py-0.5 font-mono text-xs">N</kbd> Next
              question
            </li>
            <li>
              <kbd className="rounded border bg-gray-50 px-1.5 py-0.5 font-mono text-xs">K</kbd> /{" "}
              <kbd className="rounded border bg-gray-50 px-1.5 py-0.5 font-mono text-xs">P</kbd> Previous
              question
            </li>
            <li>
              <kbd className="rounded border bg-gray-50 px-1.5 py-0.5 font-mono text-xs">M</kbd> Mark /
              unmark for review
            </li>
            <li>Arrow keys in the question list move focus (Enter to jump)</li>
            <li>Use Save &amp; exit to leave and resume later (timer keeps running)</li>
          </ul>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="btn-canvas-primary"
              onClick={() => setCheatSheetOpen(false)}
            >
              Close
            </button>
          </div>
        </CanvasModal>
      )}
    </div>
  );
}
