import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import GradeProShell, {
  gradeProChipClass,
  gradeProNavBtnClass,
  gradeProSegClass,
  gradeProSegBtnClass,
} from "../components/GradeProShell";
import Icon from "../icons/Icon";
import ConfirmActionModal from "../components/ConfirmActionModal";
import QuizQuestionCard from "../components/QuizQuestionCard";
import QuizEssayRubricPanel from "../components/QuizEssayRubricPanel";
import { QuizLeaveTimelineFromAttempt } from "../components/QuizLeaveTimeline";
import GradeEmptyState from "../components/GradeEmptyState";
import MissingStudentsPanel from "../components/MissingStudentsPanel";
import GradePublishButton from "../components/GradePublishButton";
import StudentGradeProScoreSection from "../components/StudentGradeProScoreSection";
import { SimpleStudentCommentComposer } from "../components/SubmissionCommentComposer";
import RichPromptField from "../components/RichPromptField";
import RichContentViewer from "../components/RichContentViewer";
import { StatusAlertBanner } from "../components/ui/StatusAlert";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import { isTypingTarget } from "../hooks/useKeyboardShortcuts";
import {
  defaultAssessments,
  emptyRubricAssessments,
  sumRubricAssessments,
  type RubricAssessment,
  type RubricCriterionDef,
} from "../utils/assignmentRubric";
import { graderDisplayName } from "../utils/anonymousGrading";
import { getCourseById } from "../utils/coursesStore";
import { getRosterStudentName } from "../utils/gradebook";
import {
  GRADE_PUBLISH_CHANGED_EVENT,
  isItemGradeVisible,
} from "../utils/gradeVisibility";
import {
  addQuizCommentBankEntry,
  deleteQuizCommentBankEntry,
  listQuizCommentBank,
} from "../utils/quizCommentBank";
import QuizSimilarityReportPanel from "../components/QuizSimilarityReportPanel";
import QuizPageSkeleton from "../components/QuizPageSkeleton";
import { buildQuizSimilarityCorpus } from "../utils/quizSimilarityCorpus";
import {
  flattenQuizQuestionItems,
  formatPoints,
  formatQuizDateTime,
  getQuizById,
  getQuizType,
  isGradedQuizQuestion,
  loadQuizzes,
  quizItemLabel,
  quizShowsScoreToStudent,
  saveQuizzes,
  type Quiz,
  type QuizQuestion,
} from "../utils/quizzes";
import {
  addQuizAttemptComment,
  appendQuizAttemptFeedback,
  codingAnswerSource,
  deleteQuizAttemptComment,
  deleteQuizAttemptFeedback,
  describePartialCredit,
  getAttemptBaseScore,
  getAttemptEffectiveScore,
  getAttemptsForQuiz,
  gradeQuizAttempt,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
  regradeQuizQuestionAcrossAttempts,
  releaseQuizAttemptScore,
  resolveQuizQuestions,
  setQuizAttemptFudgePoints,
  setQuizAttemptQuestionScores,
  unreleaseQuizAttemptScore,
  type QuizAnswer,
  type QuizAttempt,
} from "../utils/quizSubmissions";
import { loadUser } from "../utils/userStore";
import { staffCommentRole } from "../utils/permissions";
import { richTextIsEmpty, wrapPlainTextAsHtml } from "../utils/richContent";

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

function safeReturnPath(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function buildGraderSearchParams(
  attemptId: string,
  returnTo: string | null,
): Record<string, string> {
  const params: Record<string, string> = { attempt: attemptId };
  if (returnTo) params.returnTo = returnTo;
  return params;
}

function isOverlayModalOpen(): boolean {
  if (document.body.style.overflow === "hidden") return true;
  return Boolean(document.querySelector('[class*="z-[999]"]'));
}

function attemptIsScored(a: QuizAttempt): boolean {
  return typeof a.gradedAt === "number" || a.autoGraded;
}

function formatAnswerPreview(question: QuizQuestion, answer?: QuizAnswer): string {
  if (!answer) return "—";
  switch (question.type) {
    case "multiple_choice": {
      const idx = answer.choiceIndex;
      if (typeof idx !== "number") return "—";
      return question.choices?.[idx] ?? `Choice ${idx + 1}`;
    }
    case "multiple_answers": {
      const idxs = answer.choiceIndices ?? [];
      if (idxs.length === 0) return "—";
      return idxs
        .map((i) => question.choices?.[i] ?? `#${i + 1}`)
        .join(", ");
    }
    case "true_false":
      return answer.trueFalse == null ? "—" : answer.trueFalse ? "True" : "False";
    case "numerical":
      return typeof answer.number === "number" ? String(answer.number) : "—";
    case "matching": {
      const vals = Object.values(answer.matches ?? {}).filter(Boolean);
      return vals.length ? vals.join(", ") : "—";
    }
    case "essay":
    case "short_answer":
    case "fill_in_blank":
    case "inline_code":
      return (answer.shortAnswer ?? "").trim() || "—";
    case "file_upload":
      return answer.fileName?.trim() || "—";
    case "coding": {
      const src = codingAnswerSource(answer).trim();
      return src || "—";
    }
    default:
      return "—";
  }
}

function patchQuizQuestionRubric(
  courseId: string,
  quizId: string,
  questionId: string,
  criteria: RubricCriterionDef[],
): void {
  const all = loadQuizzes(courseId);
  const patchList = (list: QuizQuestion[]): QuizQuestion[] =>
    list.map((q) => {
      if (q.id === questionId) return { ...q, rubric: criteria };
      if (q.type === "group" && q.groupQuestions?.length) {
        return { ...q, groupQuestions: patchList(q.groupQuestions) };
      }
      return q;
    });
  saveQuizzes(
    courseId,
    all.map((quiz) =>
      quiz.id === quizId ? { ...quiz, questions: patchList(quiz.questions ?? []) } : quiz,
    ),
  );
}

export default function QuizSpeedGraderPage() {
  const { courseId, quizId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const currentUser = loadUser();
  const course = getCourseById(effectiveCourseId);
  const { showToast } = useToast();

  const [quiz, setQuiz] = useState<Quiz | undefined>(() =>
    quizId ? getQuizById(effectiveCourseId, quizId) : undefined,
  );
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() =>
    quizId ? getAttemptsForQuiz(effectiveCourseId, quizId) : [],
  );
  const [index, setIndex] = useState(0);

  const navigateToAttempt = (nextIndex: number) => {
    setIndex(nextIndex);
    const nextAttempt = rosterAttempts[nextIndex];
    if (nextAttempt) {
      setSearchParams(
        buildGraderSearchParams(nextAttempt.id, searchParams.get("returnTo")),
        { replace: true },
      );
    }
  };
  const [score, setScore] = useState("");
  const [fudgeDraft, setFudgeDraft] = useState("");
  const [questionScoreDrafts, setQuestionScoreDrafts] = useState<Record<string, string>>({});
  const [rubricDrafts, setRubricDrafts] = useState<Record<string, RubricAssessment[]>>({});
  const initialDraftsRef = useRef<Record<string, string>>({});
  const initialRubricDraftsRef = useRef<Record<string, RubricAssessment[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [publishTick, setPublishTick] = useState(0);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [attemptFilter, setAttemptFilter] = useState<"all" | "manual" | "flagged">("all");
  const [minLeaves, setMinLeaves] = useState<number>(0);
  const [scoredFilter, setScoredFilter] = useState<"all" | "unscored" | "scored">("all");
  const [graderView, setGraderView] = useState<"attempt" | "question">("attempt");
  const [byQuestionId, setByQuestionId] = useState<string>("");
  const [byQuestionScoreDrafts, setByQuestionScoreDrafts] = useState<Record<string, string>>({});
  const [commentBankTick, setCommentBankTick] = useState(0);
  const [regradeConfirmOpen, setRegradeConfirmOpen] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const [gradeShellReady, setGradeShellReady] = useState(false);
  const columnKey = quizId ? `quiz:${quizId}` : "";

  useEffect(() => {
    const bump = () => setPublishTick((n) => n + 1);
    window.addEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
    return () => window.removeEventListener(GRADE_PUBLISH_CHANGED_EVENT, bump);
  }, []);

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
  const exitPath = safeReturnPath(searchParams.get("returnTo"), quizPath);

  const rosterAttempts = useMemo(() => {
    let base = studentView
      ? attempts.filter((a) => a.studentId === currentUser.id)
      : attempts;
    if (!studentView) {
      if (attemptFilter === "manual") base = base.filter((a) => !a.autoGraded);
      else if (attemptFilter === "flagged") {
        base = base.filter((a) => (a.markedForReview?.length ?? 0) > 0);
      }
      if (minLeaves > 0) {
        base = base.filter((a) => (a.leaveCount ?? 0) >= minLeaves);
      }
      if (scoredFilter === "scored") {
        base = base.filter(attemptIsScored);
      } else if (scoredFilter === "unscored") {
        base = base.filter((a) => !attemptIsScored(a));
      }
    }
    return base;
  }, [studentView, attempts, currentUser.id, attemptFilter, minLeaves, scoredFilter]);

  useEffect(() => {
    const refresh = () => {
      if (!quizId) return;
      setQuiz(getQuizById(effectiveCourseId, quizId));
      setAttempts(
        getAttemptsForQuiz(effectiveCourseId, quizId).sort(
          (a, b) => b.submittedAt - a.submittedAt,
        ),
      );
      setGradeShellReady(true);
    };
    refresh();
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refresh);
  }, [effectiveCourseId, quizId]);

  const attemptIdParam = searchParams.get("attempt");
  const studentIdParam = searchParams.get("student");

  useEffect(() => {
    if (attemptIdParam && rosterAttempts.length > 0) {
      const idx = rosterAttempts.findIndex((a) => a.id === attemptIdParam);
      if (idx >= 0) setIndex(idx);
      return;
    }
    if (studentIdParam && rosterAttempts.length > 0) {
      const idx = rosterAttempts.findIndex((a) => a.studentId === studentIdParam);
      if (idx >= 0) setIndex(idx);
    }
  }, [attemptIdParam, studentIdParam, rosterAttempts]);

  const safeIndex = Math.min(index, Math.max(0, rosterAttempts.length - 1));
  const attempt = rosterAttempts[safeIndex];
  const questions = useMemo(() => {
    if (!quiz) return [];
    if (!attempt) {
      return resolveQuizQuestions(effectiveCourseId, quiz, {
        studentId: "preview",
        attemptId: "preview",
        attemptNumber: 1,
      });
    }
    return resolveQuizQuestions(effectiveCourseId, quiz, {
      studentId: attempt.studentId,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      questionIds:
        attempt.questionIds && attempt.questionIds.length > 0
          ? attempt.questionIds
          : attempt.answers.map((a) => a.questionId),
    });
  }, [quiz, attempt, effectiveCourseId]);
  const studentOnlyMode =
    !!studentIdParam && !rosterAttempts.some((a) => a.studentId === studentIdParam);
  const pendingStudentName = studentOnlyMode
    ? getRosterStudentName(effectiveCourseId, studentIdParam!)
    : null;
  const activeStudentId = attempt?.studentId ?? studentIdParam ?? null;
  const anonymousEnabled =
    !!quiz?.anonymousGrading || (quiz ? getQuizType(quiz) === "survey" : false);
  const displayNameFor = (studentId: string, realName: string) =>
    graderDisplayName({
      courseId: effectiveCourseId,
      columnKey,
      studentId,
      realName,
      anonymousEnabled,
    });
  const headerDisplayName = attempt
    ? displayNameFor(attempt.studentId, attempt.studentName)
    : studentOnlyMode && studentIdParam && pendingStudentName
      ? displayNameFor(studentIdParam, pendingStudentName)
      : pendingStudentName;
  const showingAnonymousAlias =
    anonymousEnabled &&
    typeof headerDisplayName === "string" &&
    /^Student \d+$/.test(headerDisplayName);

  // Reset editable grade + drafts when switching to a different attempt.
  useEffect(() => {
    if (!attempt || !quiz) {
      setScore("");
      setFudgeDraft("");
      setQuestionScoreDrafts({});
      setRubricDrafts({});
      initialDraftsRef.current = {};
      initialRubricDraftsRef.current = {};
      setCommentDraft("");
      setFeedbackDraft("");
      return;
    }
    setScore(String(getAttemptBaseScore(attempt)));
    setFudgeDraft(
      typeof attempt.fudgePoints === "number" && attempt.fudgePoints !== 0
        ? String(attempt.fudgePoints)
        : "",
    );
    const graded = gradeQuizAttempt(quiz, attempt.answers, questions);
    const autoEarned = new Map(graded.perQuestion.map((p) => [p.questionId, p.earned]));
    const drafts: Record<string, string> = {};
    const nextRubrics: Record<string, RubricAssessment[]> = {};
    for (const q of questions) {
      const savedRubric = attempt.questionRubricAssessments?.[q.id];
      if (q.type === "essay" && (q.rubric?.length ?? 0) > 0) {
        const override = attempt.questionScores?.[q.id];
        const assessments = savedRubric?.length
          ? defaultAssessments(q.rubric!, savedRubric)
          : emptyRubricAssessments(q.rubric!);
        nextRubrics[q.id] = assessments;
        const rubricTotal = sumRubricAssessments(assessments);
        const earned =
          typeof override === "number"
            ? override
            : savedRubric?.length
              ? Math.min(q.points > 0 ? q.points : rubricTotal, rubricTotal)
              : (autoEarned.get(q.id) ?? 0);
        drafts[q.id] = String(earned);
      } else {
        const override = attempt.questionScores?.[q.id];
        drafts[q.id] = String(override ?? autoEarned.get(q.id) ?? 0);
      }
    }
    setQuestionScoreDrafts(drafts);
    setRubricDrafts(nextRubrics);
    initialDraftsRef.current = drafts;
    initialRubricDraftsRef.current = nextRubrics;
    setCommentDraft("");
    setFeedbackDraft("");
  }, [attempt?.id, questions]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradedBreakdown = useMemo(() => {
    if (!attempt || !quiz) return null;
    return gradeQuizAttempt(quiz, attempt.answers, questions);
  }, [attempt, quiz, questions]);

  const creditById = useMemo(() => {
    const map = new Map<
      string,
      { correct: boolean; partial?: boolean; earned: number; possible: number }
    >();
    for (const p of gradedBreakdown?.perQuestion ?? []) {
      map.set(p.questionId, {
        correct: p.correct,
        partial: p.partial,
        earned: p.earned,
        possible: p.possible,
      });
    }
    return map;
  }, [gradedBreakdown]);

  const averageScore = useMemo(() => {
    if (rosterAttempts.length === 0) return 0;
    return (
      rosterAttempts.reduce((sum, a) => sum + getAttemptEffectiveScore(a), 0) / rosterAttempts.length
    );
  }, [rosterAttempts]);

  const allQuizQuestions = useMemo(
    () => (quiz ? flattenQuizQuestionItems(quiz.questions).filter(isGradedQuizQuestion) : []),
    [quiz],
  );

  useEffect(() => {
    if (!byQuestionId && allQuizQuestions.length > 0) {
      setByQuestionId(allQuizQuestions[0]!.id);
    } else if (
      byQuestionId &&
      allQuizQuestions.length > 0 &&
      !allQuizQuestions.some((q) => q.id === byQuestionId)
    ) {
      setByQuestionId(allQuizQuestions[0]!.id);
    }
  }, [allQuizQuestions, byQuestionId]);

  const selectedByQuestion = useMemo(
    () => allQuizQuestions.find((q) => q.id === byQuestionId),
    [allQuizQuestions, byQuestionId],
  );

  useEffect(() => {
    if (graderView !== "question" || !selectedByQuestion) {
      setByQuestionScoreDrafts({});
      return;
    }
    const next: Record<string, string> = {};
    for (const a of rosterAttempts) {
      const qs = resolveQuizQuestions(effectiveCourseId, quiz!, {
        studentId: a.studentId,
        attemptId: a.id,
        attemptNumber: a.attemptNumber,
        questionIds: a.questionIds,
      });
      const q = qs.find((item) => item.id === selectedByQuestion.id);
      if (!q) {
        next[a.id] = "";
        continue;
      }
      const graded = gradeQuizAttempt(quiz!, a.answers, qs);
      const auto = graded.perQuestion.find((p) => p.questionId === q.id)?.earned ?? 0;
      const override = a.questionScores?.[q.id];
      next[a.id] = String(override ?? auto);
    }
    setByQuestionScoreDrafts(next);
  }, [graderView, selectedByQuestion, rosterAttempts, effectiveCourseId, quiz]);

  const similarityData = useMemo(() => {
    if (!quiz || studentView) {
      return {
        rows: [],
        pairs: [],
        questionMeta: [] as { id: string; label: string; type?: string }[],
        textsByAttemptQuestion: {} as Record<string, Record<string, string>>,
        wordCountByAttempt: {} as Record<string, number>,
      };
    }
    return buildQuizSimilarityCorpus(quiz, attempts, {
      courseId: effectiveCourseId,
      columnKey,
      anonymousEnabled: Boolean(quiz.anonymousGrading),
      threshold: 0.01,
    });
  }, [quiz, studentView, attempts, effectiveCourseId, columnKey]);

  const commentBankEntries = useMemo(() => {
    void commentBankTick;
    return listQuizCommentBank(effectiveCourseId);
  }, [effectiveCourseId, commentBankTick]);

  useEffect(() => {
    if (studentView || graderView !== "attempt") return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isOverlayModalOpen() || regradeConfirmOpen) return;
      if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        navigateToAttempt(Math.max(0, safeIndex - 1));
      } else if (e.key === "ArrowRight" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        navigateToAttempt(Math.min(rosterAttempts.length - 1, safeIndex + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studentView, graderView, safeIndex, rosterAttempts.length, regradeConfirmOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quizId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-arc-moss text-sm text-arc-cream/80">
        Quiz not found.{" "}
        <Link to={`/courses/${effectiveCourseId}/quizzes`} className="ml-2 underline">
          Back to Quizzes
        </Link>
      </div>
    );
  }

  if (!gradeShellReady || !quiz) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-arc-paper p-8">
        {!gradeShellReady ? (
          <QuizPageSkeleton rows={6} />
        ) : (
          <div className="text-sm text-gray-600">
            Quiz not found.{" "}
            <Link to={`/courses/${effectiveCourseId}/quizzes`} className="text-canvas-blue underline">
              Back to Quizzes
            </Link>
          </div>
        )}
      </div>
    );
  }

  const maxScore = attempt?.maxScore ?? 0;
  const isOverridden =
    attempt && typeof attempt.manualScore === "number" && attempt.manualScore !== attempt.score;
  const fudgeNum = fudgeDraft.trim() === "" ? 0 : Number(fudgeDraft);
  const fudgeValue = Number.isFinite(fudgeNum) ? fudgeNum : 0;
  const baseFallback = attempt ? getAttemptBaseScore(attempt) : 0;
  const liveBaseNum = score.trim() === "" ? baseFallback : Number(score);
  const liveBase = Number.isFinite(liveBaseNum) ? liveBaseNum : baseFallback;
  const liveScore = liveBase + fudgeValue;
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

  const updateEssayRubric = (questionId: string, assessments: RubricAssessment[]) => {
    const question = questions.find((q) => q.id === questionId);
    const rubricTotal = sumRubricAssessments(assessments);
    const capped =
      question && question.points > 0
        ? Math.min(question.points, rubricTotal)
        : rubricTotal;
    setRubricDrafts((prev) => ({ ...prev, [questionId]: assessments }));
    const nextScores = { ...questionScoreDrafts, [questionId]: String(capped) };
    setQuestionScoreDrafts(nextScores);
    const sum = questions.reduce((s, q) => {
      const v = Number(nextScores[q.id]);
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
    const rubricPayload: Record<string, RubricAssessment[]> = {};
    for (const [qid, assessments] of Object.entries(rubricDrafts)) {
      if (assessments.length > 0) rubricPayload[qid] = assessments;
    }
    setQuizAttemptQuestionScores(
      effectiveCourseId,
      attempt.id,
      qScores,
      total,
      Object.keys(rubricPayload).length > 0 ? rubricPayload : undefined,
    );
    const fudgeRaw = fudgeDraft.trim() === "" ? undefined : Number(fudgeDraft);
    if (fudgeRaw != null && Number.isNaN(fudgeRaw)) {
      showToast("Fudge points must be a number", "negative");
      return;
    }
    setQuizAttemptFudgePoints(effectiveCourseId, attempt.id, fudgeRaw);
    if (!richTextIsEmpty(feedbackDraft)) {
      appendQuizAttemptFeedback(effectiveCourseId, attempt.id, feedbackDraft);
      setFeedbackDraft("");
    }
    initialDraftsRef.current = { ...questionScoreDrafts };
    initialRubricDraftsRef.current = { ...rubricDrafts };
    showToast("Grade saved", "positive", "grading");
  };

  const handleAddComment = () => {
    if (!attempt || richTextIsEmpty(commentDraft)) return;
    addQuizAttemptComment(effectiveCourseId, attempt.id, commentDraft, staffCommentRole());
    setCommentDraft("");
    showToast("Comment added", "positive", "grading");
  };

  const handlePostFeedback = () => {
    if (!attempt || richTextIsEmpty(feedbackDraft)) return;
    appendQuizAttemptFeedback(effectiveCourseId, attempt.id, feedbackDraft);
    setFeedbackDraft("");
    showToast("Feedback added", "positive", "grading");
  };

  const handleReleaseScore = () => {
    if (!attempt) return;
    releaseQuizAttemptScore(effectiveCourseId, attempt.id);
    showToast("Score released to student", "positive", "grading");
  };

  const handleUnreleaseScore = () => {
    if (!attempt) return;
    unreleaseQuizAttemptScore(effectiveCourseId, attempt.id);
    showToast("Score hidden from student", "neutral", "grading");
  };

  const comments = attempt?.comments ?? [];
  const feedbackEntries = attempt?.feedbackEntries ?? [];
  const visibilityStudentId = attempt?.studentId ?? studentIdParam ?? currentUser.id;
  const itemVisible =
    Boolean(columnKey) &&
    isItemGradeVisible(effectiveCourseId, columnKey, visibilityStudentId);
  void publishTick;
  const visibleStudentComments = studentView
    ? comments.filter((c) => c.role === "student" || itemVisible)
    : comments;
  const visibleFeedbackEntries = studentView && !itemVisible ? [] : feedbackEntries;
  const showAnswerReview = !studentView || itemVisible;
  const isSurvey = getQuizType(quiz) === "survey";
  const showKeyReview = showAnswerReview && !isSurvey;
  const studentScoreVisible =
    !!attempt &&
    quizShowsScoreToStudent(quiz, {
      courseId: effectiveCourseId,
      studentId: visibilityStudentId,
      attempt,
    });
  const canReleaseScore =
    !studentView &&
    !isSurvey &&
    !!attempt &&
    Boolean(quiz.hideScoreUntilGraded);

  // Save grade is only enabled once the score, per-question points, or pending
  // feedback changes.
  const questionScoresDirty =
    !!attempt &&
    questions.some(
      (q) => (questionScoreDrafts[q.id] ?? "") !== (initialDraftsRef.current[q.id] ?? ""),
    );
  const rubricsDirty =
    !!attempt &&
    questions.some((q) => {
      const cur = JSON.stringify(rubricDrafts[q.id] ?? []);
      const init = JSON.stringify(initialRubricDraftsRef.current[q.id] ?? []);
      return cur !== init;
    });
  const isDirty =
    !!attempt &&
    (score.trim() !== String(getAttemptEffectiveScore(attempt)) ||
      !richTextIsEmpty(feedbackDraft) ||
      questionScoresDirty ||
      rubricsDirty);

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

  const saveByQuestionScore = (targetAttempt: QuizAttempt, value: string) => {
    if (!quiz || !selectedByQuestion) return;
    const raw = value.trim() === "" ? 0 : Number(value);
    if (!Number.isFinite(raw) || raw < 0) {
      showToast("Question points must be 0 or more", "negative");
      return;
    }
    if (selectedByQuestion.points > 0 && raw > selectedByQuestion.points) {
      showToast(
        `Score cannot exceed ${selectedByQuestion.points} points`,
        "negative",
      );
      return;
    }
    const qs = resolveQuizQuestions(effectiveCourseId, quiz, {
      studentId: targetAttempt.studentId,
      attemptId: targetAttempt.id,
      attemptNumber: targetAttempt.attemptNumber,
      questionIds: targetAttempt.questionIds,
    });
    if (!qs.some((q) => q.id === selectedByQuestion.id)) {
      showToast("This attempt does not include that question", "negative");
      return;
    }
    const graded = gradeQuizAttempt(quiz, targetAttempt.answers, qs);
    const qScores: Record<string, number> = { ...(targetAttempt.questionScores ?? {}) };
    qScores[selectedByQuestion.id] = raw;
    let total = 0;
    for (const q of qs) {
      if (!isGradedQuizQuestion(q)) continue;
      if (typeof qScores[q.id] === "number") {
        total += qScores[q.id]!;
      } else {
        total += graded.perQuestion.find((p) => p.questionId === q.id)?.earned ?? 0;
      }
    }
    setQuizAttemptQuestionScores(effectiveCourseId, targetAttempt.id, qScores, total);
    showToast("Question score saved", "positive", "grading");
  };

  const handleRegradeQuestion = async (resetOverride: boolean) => {
    if (!quiz || !selectedByQuestion) return;
    setRegrading(true);
    try {
      const { updated } = await regradeQuizQuestionAcrossAttempts(
        effectiveCourseId,
        quiz,
        selectedByQuestion.id,
        { resetOverride },
      );
      showToast(
        `Regraded ${updated} attempt${updated === 1 ? "" : "s"}`,
        "positive",
        "grading",
      );
      setAttempts(
        getAttemptsForQuiz(effectiveCourseId, quiz.id).sort(
          (a, b) => b.submittedAt - a.submittedAt,
        ),
      );
      setQuiz(getQuizById(effectiveCourseId, quiz.id));
    } catch {
      showToast("Regrade failed", "negative");
    } finally {
      setRegrading(false);
      setRegradeConfirmOpen(false);
    }
  };

  const goToAttemptId = (attemptId: string) => {
    const idx = rosterAttempts.findIndex((a) => a.id === attemptId);
    if (idx < 0) {
      const allIdx = attempts.findIndex((a) => a.id === attemptId);
      if (allIdx < 0) return;
      setAttemptFilter("all");
      setScoredFilter("all");
      setMinLeaves(0);
      setGraderView("attempt");
      setSearchParams(
        buildGraderSearchParams(attemptId, searchParams.get("returnTo")),
        { replace: true },
      );
      return;
    }
    setGraderView("attempt");
    navigateToAttempt(idx);
  };

  return (
    <>
    <GradeProShell
      exitTo={exitPath}
      title={quiz.title}
      subtitle={`GradePro${course ? ` — ${course.title}` : ""}`}
      stats={
        !studentView ? (
          <>
            <span>{rosterAttempts.length} Attempts</span>
            <span>
              {averageScore.toFixed(1)} / {maxScore} Average
            </span>
            <span>
              {rosterAttempts.length === 0 ? "0/0" : `${safeIndex + 1}/${rosterAttempts.length}`} Viewing
            </span>
          </>
        ) : (
          <span className="text-arc-cream/90">Your quiz attempt</span>
        )
      }
      toolbar={
        !studentView ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className={gradeProSegClass}>
              {(
                [
                  ["all", "All"],
                  ["manual", "Needs review"],
                  ["flagged", "Student flagged"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setAttemptFilter(key);
                    setIndex(0);
                  }}
                  className={gradeProSegBtnClass(attemptFilter === key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-arc-cream/70">
              Leaves ≥
              <input
                type="number"
                min={0}
                value={minLeaves || ""}
                placeholder="0"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setMinLeaves(Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
                  setIndex(0);
                }}
                className="w-12 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-arc-cream outline-none"
              />
            </label>
            <div className={gradeProSegClass}>
              {(
                [
                  ["all", "All scores"],
                  ["unscored", "Unscored"],
                  ["scored", "Scored"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setScoredFilter(key);
                    setIndex(0);
                  }}
                  className={gradeProSegBtnClass(scoredFilter === key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={gradeProSegClass}>
              {(
                [
                  ["attempt", "By attempt"],
                  ["question", "By question"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGraderView(key)}
                  className={gradeProSegBtnClass(graderView === key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : undefined
      }
      trailing={
        <>
          {!studentView && rosterAttempts.length > 0 && graderView === "attempt" && (
            <AttemptSelect
              attempts={rosterAttempts}
              index={safeIndex}
              onSelect={navigateToAttempt}
              courseId={effectiveCourseId}
              columnKey={columnKey}
              anonymousEnabled={anonymousEnabled}
            />
          )}
          {!studentView && graderView === "attempt" && (
            <>
              <button
                type="button"
                onClick={() => navigateToAttempt(Math.max(0, safeIndex - 1))}
                disabled={safeIndex <= 0}
                className={gradeProNavBtnClass}
                title="Previous attempt (← / j)"
              >
                <Icon name="chevronLeft" size={20} />
              </button>
              <button
                type="button"
                onClick={() =>
                  navigateToAttempt(Math.min(rosterAttempts.length - 1, safeIndex + 1))
                }
                disabled={safeIndex >= rosterAttempts.length - 1}
                className={gradeProNavBtnClass}
                title="Next attempt (→ / k)"
              >
                <Icon name="chevronRight" size={20} />
              </button>
            </>
          )}
          {(attempt || studentOnlyMode) && graderView === "attempt" && (
            <div className={gradeProChipClass}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-arc-sage text-xs font-bold text-white">
                {initials(headerDisplayName ?? "?")}
              </span>
              <span className="max-w-[140px] truncate text-sm">{headerDisplayName}</span>
              {showingAnonymousAlias && (
                <span className="hidden rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 sm:inline">
                  Anonymous until posted
                </span>
              )}
            </div>
          )}
          {!studentView && activeStudentId && (
            <GradePublishButton
              courseId={effectiveCourseId}
              studentId={activeStudentId}
              columnKey={columnKey}
              variant="dark"
            />
          )}
        </>
      }
    >
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-arc-paper p-6 text-arc-ink">
          {studentOnlyMode ? (
            <GradeEmptyState
              fill
              title="No submission yet"
              subtitle={`${pendingStudentName} has not taken this quiz.`}
            />
          ) : !studentView && graderView === "question" ? (
            <div className="mx-auto w-full max-w-5xl space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-arc-line bg-arc-ivory p-4 text-canvas-grayDark">
                <label className="min-w-[200px] flex-1 text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Question</span>
                  <select
                    value={byQuestionId}
                    onChange={(e) => setByQuestionId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {allQuizQuestions.map((q, i) => (
                      <option key={q.id} value={q.id}>
                        {quizItemLabel(allQuizQuestions, i)} — {q.prompt.slice(0, 60)}
                        {q.prompt.length > 60 ? "…" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedByQuestion && (
                  <button
                    type="button"
                    disabled={regrading || allQuizQuestions.length === 0}
                    onClick={() => setRegradeConfirmOpen(true)}
                    className="btn-canvas-secondary text-sm disabled:opacity-50"
                  >
                    Regrade this question for all attempts
                  </button>
                )}
              </div>
              {rosterAttempts.length === 0 ? (
                <GradeEmptyState
                  fill
                  title="No attempts match filters"
                  subtitle="Adjust filters to see attempts for this question."
                />
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-arc-ivory text-arc-ink">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Answer</th>
                        <th className="w-28 px-3 py-2 font-medium">Score</th>
                        <th className="w-24 px-3 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rosterAttempts.map((a) => {
                        const ans = a.answers.find((x) => x.questionId === byQuestionId);
                        const preview = selectedByQuestion
                          ? formatAnswerPreview(selectedByQuestion, ans)
                          : "—";
                        return (
                          <tr key={a.id} className="align-top">
                            <td className="px-3 py-2">
                              <p className="font-medium">
                                {displayNameFor(a.studentId, a.studentName)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Attempt #{a.attemptNumber}
                                {(a.leaveCount ?? 0) > 0 ? ` · ${a.leaveCount} leaves` : ""}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <p className="line-clamp-3 max-w-xl whitespace-pre-wrap text-gray-700">
                                {preview}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={selectedByQuestion?.points || undefined}
                                  value={byQuestionScoreDrafts[a.id] ?? ""}
                                  onChange={(e) =>
                                    setByQuestionScoreDrafts((prev) => ({
                                      ...prev,
                                      [a.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={() =>
                                    saveByQuestionScore(a, byQuestionScoreDrafts[a.id] ?? "")
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-16 rounded border border-gray-300 px-1.5 py-1 text-sm"
                                />
                                <span className="text-xs text-gray-500">
                                  / {selectedByQuestion?.points ?? "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => goToAttemptId(a.id)}
                                className="text-xs font-medium text-canvas-blue hover:underline"
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : !attempt ? (
            <GradeEmptyState
              fill
              title="No submissions to grade yet"
              subtitle="When students complete this quiz, their attempts will appear here."
            />
          ) : questions.length === 0 ? (
            <GradeEmptyState
              fill
              title="Question details unavailable"
              subtitle="This attempt is saved, but the question set could not be loaded. Open the quiz editor to restore questions, then return to GradePro."
            />
          ) : (
            <div className="w-full space-y-4 px-4">
              {questions.map((question, qIndex) => {
                const answer = attempt.answers.find((a) => a.questionId === question.id);
                const credit = creditById.get(question.id);
                const draftRaw = questionScoreDrafts[question.id];
                const draftNum = draftRaw === "" || draftRaw == null ? NaN : Number(draftRaw);
                const earned =
                  question.type === "note" || question.type === "group" || isSurvey
                    ? undefined
                    : Number.isFinite(draftNum)
                      ? draftNum
                      : credit?.earned;
                const possible =
                  question.type === "note" || question.type === "group"
                    ? undefined
                    : credit?.possible ?? (question.points > 0 ? question.points : 0);
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
                      label={quizItemLabel(questions, qIndex)}
                      answer={answer}
                      onChange={() => {}}
                      disabled
                      review={
                        question.type === "note" || question.type === "group" || isSurvey
                          ? undefined
                          : showKeyReview || typeof earned === "number"
                            ? {
                                correct: credit?.correct ?? false,
                                partial: credit?.partial,
                                earned,
                                possible,
                                partialNote:
                                  credit?.partial && quiz
                                    ? describePartialCredit(quiz, question, answer)
                                    : undefined,
                              }
                            : undefined
                      }
                      revealKey={showKeyReview}
                      scoreDraft={
                        !studentView && question.type !== "note" && !isSurvey
                          ? (questionScoreDrafts[question.id] ?? "")
                          : undefined
                      }
                      onScoreChange={
                        !studentView && question.type !== "note" && !isSurvey
                          ? (v) => updateQuestionScore(question.id, v)
                          : undefined
                      }
                    />
                    {question.type === "essay" &&
                      (question.rubric?.length ?? 0) > 0 &&
                      !isSurvey && (
                        <QuizEssayRubricPanel
                          rubric={question.rubric!}
                          assessments={
                            rubricDrafts[question.id] ??
                            emptyRubricAssessments(question.rubric!)
                          }
                          onChange={(assessments) =>
                            updateEssayRubric(question.id, assessments)
                          }
                          readOnly={studentView}
                          questionPoints={question.points}
                          courseId={studentView ? undefined : effectiveCourseId}
                          onApplyTemplate={
                            studentView
                              ? undefined
                              : (criteria) => {
                                  patchQuizQuestionRubric(
                                    effectiveCourseId,
                                    quiz.id,
                                    question.id,
                                    criteria,
                                  );
                                  setQuiz(getQuizById(effectiveCourseId, quiz.id));
                                  setRubricDrafts((prev) => ({
                                    ...prev,
                                    [question.id]: emptyRubricAssessments(criteria),
                                  }));
                                }
                          }
                        />
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside
          style={{ width: sidebarWidth }}
          className="relative flex shrink-0 flex-col border-l border-arc-ink/10 bg-arc-ivory text-arc-ink"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize grading panel"
            onMouseDown={handleSidebarResizeStart}
            className="absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none hover:bg-arc-copper/15 active:bg-arc-copper/25"
          />
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {studentOnlyMode && studentView ? (
              <>
                <StudentGradeProScoreSection
                  courseId={effectiveCourseId}
                  columnKey={columnKey}
                  maxPoints={quiz.points ?? 0}
                  score={null}
                  isGraded={false}
                />
                <p className="text-sm text-gray-500">You haven&apos;t taken this quiz yet.</p>
              </>
            ) : attempt ? (
              <>
                <div>
                  <p className="text-sm font-semibold">
                    {displayNameFor(attempt.studentId, attempt.studentName)}
                  </p>
                  {showingAnonymousAlias && (
                    <p className="mt-1 inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      Anonymous until posted
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-500">
                    Attempt #{attempt.attemptNumber} · Submitted{" "}
                    {formatQuizDateTime(attempt.submittedAt)}
                  </p>
                  <QuizLeaveTimelineFromAttempt attempt={attempt} className="mt-3" />
                </div>

                {!studentView && similarityData.questionMeta.length > 0 && quizId && (
                  <QuizSimilarityReportPanel
                    courseId={effectiveCourseId}
                    quizId={quizId}
                    attemptId={attempt.id}
                    pairs={similarityData.pairs}
                    questionMeta={similarityData.questionMeta}
                    textsByAttemptQuestion={similarityData.textsByAttemptQuestion}
                    onOpenAttempt={goToAttemptId}
                  />
                )}

                {studentView ? (
                  <>
                    {isSurvey ? (
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                        <p className="text-sm font-medium text-canvas-grayDark">
                          Survey response
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Surveys do not show a score.
                        </p>
                      </div>
                    ) : (
                      <StudentGradeProScoreSection
                        courseId={effectiveCourseId}
                        columnKey={columnKey}
                        maxPoints={attempt.maxScore}
                        score={
                          studentScoreVisible
                            ? getAttemptEffectiveScore(attempt)
                            : null
                        }
                        isGraded={studentScoreVisible}
                      />
                    )}

                    <div className="border-t border-canvas-border pt-4">
                      <h3 className="mb-2 text-sm font-semibold">Comments</h3>
                      <div className="max-h-40 space-y-2 overflow-y-auto">
                        {visibleStudentComments.length === 0 && (
                          <p className="text-sm text-gray-500">No comments yet.</p>
                        )}
                        {visibleStudentComments.map((c) => (
                          <div
                            key={c.id}
                            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <span className="text-xs font-semibold text-canvas-grayDark">
                              {c.author}
                            </span>
                            <RichContentViewer
                              html={wrapPlainTextAsHtml(c.body)}
                              courseId={effectiveCourseId}
                              spacing="compact"
                              className="mt-0.5 text-sm text-gray-700"
                            />
                          </div>
                        ))}
                      </div>
                      <SimpleStudentCommentComposer
                        courseId={effectiveCourseId}
                        onSubmit={(body) => {
                          addQuizAttemptComment(
                            effectiveCourseId,
                            attempt.id,
                            body,
                            "student",
                          );
                          showToast("Comment added", "positive", "grading");
                        }}
                      />
                    </div>

                    <div className="border-t border-canvas-border pt-4">
                      <h3 className="mb-2 text-sm font-semibold">Quiz feedback</h3>
                      {!itemVisible ? (
                        <p className="text-sm text-gray-500">
                          Feedback will appear when your grade is posted
                        </p>
                      ) : visibleFeedbackEntries.length === 0 ? (
                        <p className="text-sm text-gray-500">No feedback yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {visibleFeedbackEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                            >
                              <p className="whitespace-pre-wrap text-sm text-gray-700">{entry.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                {!studentView && hasOverMax && (
                  <StatusAlertBanner tone="negative">
                    <div className="flex items-start gap-2">
                      <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
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
                  {canReleaseScore && (
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      {typeof attempt.gradedAt === "number" ? (
                        <>
                          <p className="text-xs font-medium text-emerald-700">
                            Score released to student
                          </p>
                          <button
                            type="button"
                            onClick={handleUnreleaseScore}
                            className="mt-1.5 text-xs text-canvas-blue hover:underline"
                          >
                            Hide score again
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-amber-700">
                            Score hidden until released
                          </p>
                          <button
                            type="button"
                            onClick={handleReleaseScore}
                            className="btn-canvas-secondary mt-2 w-full text-sm"
                          >
                            Release score
                          </button>
                        </>
                      )}
                    </div>
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
                    Auto-graded score: {formatPoints(attempt.score)} /{" "}
                    {formatPoints(attempt.maxScore)}
                    {isOverridden && " · manually adjusted"}
                  </p>
                  <label className="mb-1 mt-3 block text-xs font-medium text-gray-600">
                    Fudge points
                  </label>
                  <input
                    type="number"
                    step={0.25}
                    value={fudgeDraft}
                    onChange={(e) => setFudgeDraft(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Added on top of the grade above. Effective:{" "}
                    <span className="font-medium text-canvas-grayDark">
                      {formatPoints(liveScore)}
                    </span>
                    {fudgeValue !== 0 &&
                      ` (${fudgeValue > 0 ? "+" : ""}${formatPoints(fudgeValue)} fudge)`}
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
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                        <RichContentViewer
                          html={wrapPlainTextAsHtml(c.body)}
                          courseId={effectiveCourseId}
                          spacing="compact"
                          className="mt-0.5 text-sm text-gray-700"
                        />
                      </div>
                    ))}
                  </div>
                  <RichPromptField
                    value={commentDraft}
                    onChange={setCommentDraft}
                    courseId={effectiveCourseId}
                    mountKey={`quiz-sg-comment-${attempt.id}`}
                    placeholder="Add a comment for this attempt..."
                    height={140}
                    alwaysEdit
                  />
                  <CommentBankTools
                    entries={commentBankEntries}
                    draft={commentDraft}
                    onInsert={(body) =>
                      setCommentDraft((prev) =>
                        richTextIsEmpty(prev)
                          ? wrapPlainTextAsHtml(body)
                          : `${prev}${wrapPlainTextAsHtml(body)}`,
                      )
                    }
                    onSave={() => {
                      if (richTextIsEmpty(commentDraft)) return;
                      addQuizCommentBankEntry(effectiveCourseId, commentDraft);
                      setCommentBankTick((n) => n + 1);
                      showToast("Saved to comment bank", "positive", "grading");
                    }}
                    onDelete={(id) => {
                      deleteQuizCommentBankEntry(effectiveCourseId, id);
                      setCommentBankTick((n) => n + 1);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={richTextIsEmpty(commentDraft)}
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
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                          <RichContentViewer
                            html={wrapPlainTextAsHtml(entry.body)}
                            courseId={effectiveCourseId}
                            spacing="compact"
                            className="mt-0.5 text-sm text-gray-700"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <RichPromptField
                    value={feedbackDraft}
                    onChange={setFeedbackDraft}
                    courseId={effectiveCourseId}
                    mountKey={`quiz-sg-feedback-${attempt.id}`}
                    placeholder="Write feedback for the student..."
                    height={160}
                    alwaysEdit
                  />
                  <CommentBankTools
                    entries={commentBankEntries}
                    draft={feedbackDraft}
                    onInsert={(body) =>
                      setFeedbackDraft((prev) =>
                        richTextIsEmpty(prev)
                          ? wrapPlainTextAsHtml(body)
                          : `${prev}${wrapPlainTextAsHtml(body)}`,
                      )
                    }
                    onSave={() => {
                      if (richTextIsEmpty(feedbackDraft)) return;
                      addQuizCommentBankEntry(effectiveCourseId, feedbackDraft);
                      setCommentBankTick((n) => n + 1);
                      showToast("Saved to comment bank", "positive", "grading");
                    }}
                    onDelete={(id) => {
                      deleteQuizCommentBankEntry(effectiveCourseId, id);
                      setCommentBankTick((n) => n + 1);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handlePostFeedback}
                    disabled={richTextIsEmpty(feedbackDraft)}
                    className="mt-2 text-sm text-canvas-blue hover:underline disabled:opacity-50"
                  >
                    Post feedback
                  </button>
                </div>

                <div className="border-t border-canvas-border pt-4">
                  <h3 className="text-sm font-semibold">Questions</h3>
                  <ul className="mt-2 space-y-0.5">
                    {questions.map((question, qIndex) => {
                      const credit = creditById.get(question.id);
                      const draftRaw = questionScoreDrafts[question.id];
                      const draftNum =
                        draftRaw === "" || draftRaw == null ? NaN : Number(draftRaw);
                      const earned =
                        question.type === "note" || question.type === "group"
                          ? null
                          : Number.isFinite(draftNum)
                            ? draftNum
                            : credit?.earned ?? null;
                      const possible =
                        question.type === "note" || question.type === "group"
                          ? null
                          : credit?.possible ?? (question.points > 0 ? question.points : 0);
                      return (
                        <li key={question.id}>
                          <button
                            type="button"
                            onClick={() => scrollToQuestion(question.id)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                          >
                            {question.type === "note" || question.type === "group" ? (
                              <Icon name="circle" size={16} className="shrink-0 text-amber-400" />
                            ) : credit?.correct ? (
                              <Icon name="checkCircle" size={16} className="shrink-0 text-green-600" />
                            ) : credit?.partial ? (
                              <Icon name="warning" size={16} className="shrink-0 text-amber-600" />
                            ) : (
                              <Icon name="close" size={16} className="shrink-0 text-red-600" />
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              {quizItemLabel(questions, qIndex)}
                            </span>
                            {earned != null && possible != null && (
                              <span
                                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                                  credit?.correct
                                    ? "bg-green-50 text-green-700"
                                    : credit?.partial
                                      ? "bg-amber-50 text-amber-800"
                                      : "bg-red-50 text-red-700"
                                }`}
                              >
                                {formatPoints(earned)}
                                <span className="font-normal opacity-60">
                                  /{formatPoints(possible)}
                                </span>
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">No submissions yet.</p>
            )}
          </div>

          {attempt && !studentView && graderView === "attempt" && (
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
          {!studentView && quizId && (
            <div className="shrink-0 p-4">
              <MissingStudentsPanel
                courseId={effectiveCourseId}
                kind="quiz"
                itemId={quizId}
                gradePath={`/courses/${effectiveCourseId}/quizzes/${quizId}/grade`}
              />
            </div>
          )}
        </aside>
    </GradeProShell>

      <ConfirmActionModal
        isOpen={regradeConfirmOpen}
        title="Regrade this question for all attempts?"
        description={
          selectedByQuestion
            ? `Re-score “${selectedByQuestion.prompt.slice(0, 80)}${
                selectedByQuestion.prompt.length > 80 ? "…" : ""
              }” across every attempt for this quiz. You can optionally clear GradePro overrides for this question.`
            : "Re-score this question across every attempt."
        }
        confirmText={regrading ? "Regrading…" : "Regrade (keep overrides)"}
        tone="primary"
        onClose={() => !regrading && setRegradeConfirmOpen(false)}
        onConfirm={() => {
          void handleRegradeQuestion(false);
        }}
      >
        <button
          type="button"
          disabled={regrading}
          onClick={() => void handleRegradeQuestion(true)}
          className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          Regrade and reset score overrides
        </button>
      </ConfirmActionModal>
    </>
  );
}

/**
 * Dark, on-theme attempt selector. Uses a custom menu (not a native <select>)
 * so the trigger text stays white on every OS.
 */
function CommentBankTools({
  entries,
  draft,
  onInsert,
  onSave,
  onDelete,
}: {
  entries: { id: string; body: string; category?: string }[];
  draft: string;
  onInsert: (body: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const categories = Array.from(
    new Set(entries.map((e) => e.category?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));
  const visible =
    categoryFilter === "all"
      ? entries
      : entries.filter((e) => (e.category || "Uncategorized") === categoryFilter);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-medium text-canvas-blue hover:underline"
        >
          Comment bank{entries.length > 0 ? ` (${entries.length})` : ""}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.trim()}
          className="text-xs font-medium text-canvas-blue hover:underline disabled:opacity-40"
        >
          Save to bank
        </button>
      </div>
      {open && (
        <div className="space-y-1.5 rounded-md border border-gray-200 bg-gray-50 p-1.5">
          {categories.length > 0 && (
            <label className="flex items-center gap-2 px-1 text-xs text-gray-600">
              <span className="shrink-0">Category</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="min-w-0 flex-1 rounded border border-gray-200 bg-arc-paper px-1.5 py-0.5 text-xs"
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-2 py-1 text-xs text-gray-500">No canned comments yet.</li>
            ) : (
              visible.map((entry) => (
                <li
                  key={entry.id}
                  className="group flex items-start gap-1 rounded px-1.5 py-1 hover:bg-arc-ivory"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onInsert(entry.body);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 text-left text-xs text-gray-700"
                  >
                    {entry.category ? (
                      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        {entry.category}
                      </span>
                    ) : null}
                    {entry.body.length > 120 ? `${entry.body.slice(0, 120)}…` : entry.body}
                  </button>
                  <button
                    type="button"
                    aria-label="Delete bank entry"
                    onClick={() => onDelete(entry.id)}
                    className="shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-canvas-red"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
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
  courseId,
  columnKey,
  anonymousEnabled,
}: {
  attempts: QuizAttempt[];
  index: number;
  onSelect: (i: number) => void;
  courseId: string;
  columnKey: string;
  anonymousEnabled: boolean;
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

  const label = (a: QuizAttempt) => {
    const name = graderDisplayName({
      courseId,
      columnKey,
      studentId: a.studentId,
      realName: a.studentName,
      anonymousEnabled,
    });
    return `${name} — Attempt #${a.attemptNumber} (${getAttemptEffectiveScore(a)}/${a.maxScore})`;
  };
  const current = attempts[index];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-[260px] items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-arc-cream shadow-sm outline-none hover:bg-white/15 focus:border-arc-copper"
      >
        <span className="truncate">{current ? label(current) : "Select attempt"}</span>
        <Icon name="chevronDown" size={16} className="shrink-0 text-arc-cream/70" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-1 max-h-72 w-[260px] overflow-auto border border-white/10 bg-arc-moss-raised py-1 text-sm text-arc-cream shadow-lift"
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
