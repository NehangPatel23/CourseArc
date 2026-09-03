import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Icon from "../icons/Icon";
import CourseHeader from "../components/CourseHeader";
import DateTimeField from "../components/DateTimeField";
import DueDateOverridesEditor from "../components/DueDateOverridesEditor";
import QuizQuestionsEditor from "../components/QuizQuestionsEditor";
import RichContentEditor from "../components/RichContentEditor";
import { useStudentView } from "../hooks/useStudentView";
import { usePermissions } from "../utils/permissions";
import { recordAudit } from "../utils/auditLog";
import { clearQuizAccess, clearAllQuizSessionAccess, generateOneTimeAccessToken, generateQuizAccessCode } from "../utils/quizAccess";
import { applyQuizPreset, QUIZ_PRESET_LABELS, type QuizPresetId } from "../utils/quizPresets";
import { summarizeQuizSettingsDiff, type SettingsDiffLine } from "../utils/quizSettingsDiff";
import CanvasModal from "../components/CanvasModal";
import {
  bankPoolDrawCount,
  codingQuestionsMissingSample,
  getQuizPublishChecklist,
  loadQuizzes,
  normalizeQuizBankPool,
  normalizeQuizQuestions,
  QUIZ_SCORING_POLICY_LABELS,
  QUIZ_TYPE_LABELS,
  saveQuizzes,
  totalQuizQuestionPoints,
  formatPoints,
  stripSurveyAnswerKeys,
  type Quiz,
  type QuizBankPool,
  type QuizBankPoolMode,
  type QuizChecklistItem,
  type QuizQuestion,
  type QuizScoringPolicy,
  type QuizType,
  uid,
} from "../utils/quizzes";
import { clearQuizAttempts, getAttemptsForQuiz, regradeQuizAttempts } from "../utils/quizSubmissions";
import {
  loadQuestionBanks,
  type QuestionBank,
} from "../utils/questionBanks";
import QuizOnboardingChecklist from "../components/QuizOnboardingChecklist";
import QuizEditorDisclosure from "../components/QuizEditorDisclosure";
import { useToast } from "../components/ui/Toast";
import {
  getCourseMonacoDefault,
  monacoEditorFieldFromOverride,
  monacoOverrideFromQuiz,
  shouldUseMonacoEditor,
  type MonacoEditorOverride,
} from "../utils/quizEditorPrefs";
import { shouldShowQuizOnboarding } from "../utils/quizOnboarding";
import { getCourseAssignmentGroups, getCourseById, isWeightedGradingEnabled } from "../utils/coursesStore";
import AssignmentGroupSelect from "../components/AssignmentGroupSelect";
import {
  listOverridesForItem,
  replaceItemOverrides,
  type DueDateOverride,
} from "../utils/dueDateOverrides";
import {
  downloadTextFile,
  exportQuizToQtiXml,
  quizQtiFilename,
} from "../utils/quizQtiExport";

type EditorTab = "details" | "questions";

type BankPoolRow = { bankId: string; pickCount: string };

function poolRowsFromQuiz(bankPool: Quiz["bankPool"]): {
  mode: QuizBankPoolMode;
  rows: BankPoolRow[];
  total: string;
} {
  const normalized = normalizeQuizBankPool(bankPool);
  if (!normalized) {
    return { mode: "per_bank", rows: [], total: "10" };
  }
  return {
    mode: normalized.mode,
    rows: normalized.sources.map((s) => ({
      bankId: s.bankId,
      pickCount: String(s.pickCount || 1),
    })),
    total: String(normalized.totalPickCount ?? 10),
  };
}

function buildBankPoolFromEditor(
  mode: QuizBankPoolMode,
  rows: BankPoolRow[],
  combinedTotal: string,
): QuizBankPool | undefined {
  const sources = rows
    .filter((r) => r.bankId.trim())
    .map((r) => ({
      bankId: r.bankId.trim(),
      pickCount: Math.max(0, Number(r.pickCount) || 0),
    }));
  if (sources.length === 0) return undefined;
  if (mode === "combined") {
    return {
      mode: "combined",
      sources: sources.map((s) => ({ ...s, pickCount: s.pickCount || 0 })),
      totalPickCount: Math.max(1, Number(combinedTotal) || 1),
    };
  }
  const withCounts = sources.filter((s) => s.pickCount > 0);
  if (withCounts.length === 0) return undefined;
  return { mode: "per_bank", sources: withCounts };
}

export default function QuizEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, quizId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const { canEditCourseContent } = usePermissions();

  const fromState = (location.state as { from?: string; groupId?: string } | null)?.from;
  const presetGroupId = (location.state as { groupId?: string } | null)?.groupId;
  const backTo = fromState ?? `/courses/${effectiveCourseId}/quizzes`;

  // After saving, return to the quiz viewer (unless we came from elsewhere,
  // e.g. a module, in which case honor that origin).
  const afterSave = (id: string) =>
    navigate(fromState ?? `/courses/${effectiveCourseId}/quizzes/${id}`);

  useEffect(() => {
    if (!canEditCourseContent) navigate(backTo, { replace: true });
  }, [canEditCourseContent, navigate, backTo]);

  const all = useMemo(() => loadQuizzes(effectiveCourseId), [effectiveCourseId]);
  const banks = useMemo(() => loadQuestionBanks(effectiveCourseId), [effectiveCourseId]);
  const course = useMemo(() => getCourseById(effectiveCourseId), [effectiveCourseId]);
  const assignmentGroups = useMemo(
    () => getCourseAssignmentGroups(course),
    [course],
  );
  const defaultGroupId = "";
  const { showToast } = useToast();
  const isNew = !quizId || quizId === "new";
  const existing = useMemo(() => {
    if (isNew) return undefined;
    return all.find((q) => q.id === quizId);
  }, [all, quizId, isNew]);

  useEffect(() => {
    if (!studentView && !isNew && !existing) navigate(backTo, { replace: true });
  }, [studentView, isNew, existing, navigate, backTo]);

  const [activeTab, setActiveTab] = useState<EditorTab>("details");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [dueAt, setDueAt] = useState<number | undefined>(existing?.dueAt);
  const [dueOverrides, setDueOverrides] = useState<
    Array<Omit<DueDateOverride, "itemKind" | "itemId"> & Partial<Pick<DueDateOverride, "itemKind" | "itemId">>>
  >(() => (existing ? listOverridesForItem(effectiveCourseId, "quiz", existing.id) : []));
  const [points, setPoints] = useState(existing?.points?.toString() ?? "");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    existing?.timeLimitMinutes?.toString() ?? "",
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    normalizeQuizQuestions(existing?.questions),
  );
  const initialPool = poolRowsFromQuiz(existing?.bankPool);
  const [bankPoolMode, setBankPoolMode] = useState<QuizBankPoolMode>(initialPool.mode);
  const [bankPoolRows, setBankPoolRows] = useState<BankPoolRow[]>(initialPool.rows);
  const [combinedPickCount, setCombinedPickCount] = useState(initialPool.total);
  const [publishAt, setPublishAt] = useState<number | undefined>(existing?.publishAt);
  const [unpublishAt, setUnpublishAt] = useState<number | undefined>(existing?.unpublishAt);
  const [accessCodeExpiresAt, setAccessCodeExpiresAt] = useState<number | undefined>(
    existing?.accessCodeExpiresAt,
  );
  const [oneTimeAccessToken, setOneTimeAccessToken] = useState(
    existing?.oneTimeAccessToken ?? "",
  );
  const [previewShareKey, setPreviewShareKey] = useState(existing?.previewShareKey ?? "");
  const [practiceInstantFeedback, setPracticeInstantFeedback] = useState(
    existing?.practiceInstantFeedback ?? false,
  );
  const [practiceRetakeWrongOnly, setPracticeRetakeWrongOnly] = useState(
    existing?.practiceRetakeWrongOnly ?? false,
  );
  const [practiceScorePreview, setPracticeScorePreview] = useState(
    existing?.practiceScorePreview ?? false,
  );
  const [allowedSectionsText, setAllowedSectionsText] = useState(
    (existing?.allowedSections ?? []).join(", "),
  );
  const [settingsDiff, setSettingsDiff] = useState<SettingsDiffLine[] | null>(null);
  const [pendingSettingsAction, setPendingSettingsAction] = useState<null | "draft" | "publish">(
    null,
  );
  const [availableFrom, setAvailableFrom] = useState<number | undefined>(existing?.availableFrom);
  const [availableUntil, setAvailableUntil] = useState<number | undefined>(existing?.availableUntil);
  const [shuffleAnswers, setShuffleAnswers] = useState(existing?.shuffleAnswers ?? true);
  const [shuffleQuestions, setShuffleQuestions] = useState(
    existing?.shuffleQuestions ?? false,
  );
  const [quizType, setQuizType] = useState<QuizType>(existing?.quizType ?? "graded");
  const [accessCode, setAccessCode] = useState(existing?.accessCode ?? "");
  const [hideScoreUntilGraded, setHideScoreUntilGraded] = useState(
    existing?.hideScoreUntilGraded ?? false,
  );
  const [oneQuestionAtATime, setOneQuestionAtATime] = useState(
    existing?.oneQuestionAtATime ?? false,
  );
  const [lockPreviousQuestions, setLockPreviousQuestions] = useState(
    existing?.lockPreviousQuestions ?? false,
  );
  const [lockOnLeave, setLockOnLeave] = useState(existing?.lockOnLeave ?? false);
  const [maxLeaveCount, setMaxLeaveCount] = useState(
    existing?.maxLeaveCount != null ? String(existing.maxLeaveCount) : "",
  );
  const [warnOnLeave, setWarnOnLeave] = useState(existing?.warnOnLeave ?? false);
  const [lockOnBlur, setLockOnBlur] = useState(existing?.lockOnBlur ?? false);
  const [requireFullscreen, setRequireFullscreen] = useState(
    existing?.requireFullscreen ?? false,
  );
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(
    existing?.idleTimeoutMinutes != null ? String(existing.idleTimeoutMinutes) : "",
  );
  const [softDisablePaste, setSoftDisablePaste] = useState(
    existing?.softDisablePaste ?? false,
  );
  const [monacoOverride, setMonacoOverride] = useState<MonacoEditorOverride>(() =>
    monacoOverrideFromQuiz(existing),
  );
  const [courseMonacoDefault, setCourseMonacoDefault] = useState(() =>
    getCourseMonacoDefault(effectiveCourseId),
  );
  const [softOrigEnabled, setSoftOrigEnabled] = useState(
    existing?.softOriginality?.enabled !== false,
  );
  const [softOrigSelf, setSoftOrigSelf] = useState(
    existing?.softOriginality?.includeSelfAttempts !== false,
  );
  const [softOrigOtherQuizzes, setSoftOrigOtherQuizzes] = useState(
    Boolean(existing?.softOriginality?.includeOtherQuizzes),
  );
  const [softOrigNormalizeCode, setSoftOrigNormalizeCode] = useState(
    existing?.softOriginality?.normalizeCode !== false,
  );
  const [softOrigExcludeText, setSoftOrigExcludeText] = useState(
    existing?.softOriginality?.excludeText ?? "",
  );
  const [softOrigMinPct, setSoftOrigMinPct] = useState(
    existing?.softOriginality?.minMatchPercent != null
      ? String(existing.softOriginality.minMatchPercent)
      : "1",
  );
  const [requireViewAllQuestions, setRequireViewAllQuestions] = useState(
    existing?.requireViewAllQuestions ?? false,
  );
  const [collectSeatNumber, setCollectSeatNumber] = useState(
    existing?.collectSeatNumber ?? false,
  );
  const [requireSeatNumber, setRequireSeatNumber] = useState(
    existing?.requireSeatNumber !== false,
  );
  const [allowMultipleAttempts, setAllowMultipleAttempts] = useState(
    existing?.allowMultipleAttempts ?? false,
  );
  // Unlimited is the default whenever multiple attempts are enabled without an
  // explicit cap (allowedAttempts == null means Infinity in getRemainingAttempts).
  const [unlimitedAttempts, setUnlimitedAttempts] = useState(
    existing?.allowMultipleAttempts ? existing?.allowedAttempts == null : true,
  );
  const [allowedAttempts, setAllowedAttempts] = useState(
    existing?.allowedAttempts?.toString() ?? "2",
  );
  const [scoringPolicy, setScoringPolicy] = useState<QuizScoringPolicy>(
    existing?.scoringPolicy ?? "highest",
  );
  const [letStudentsSeeResponses, setLetStudentsSeeResponses] = useState(
    existing?.letStudentsSeeResponses ?? true,
  );
  const [showResponsesOnlyOnce, setShowResponsesOnlyOnce] = useState(
    existing?.showResponsesOnlyOnce ?? false,
  );
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(
    existing?.showCorrectAnswers ?? true,
  );
  const [showCorrectAnswersAt, setShowCorrectAnswersAt] = useState<number | undefined>(
    existing?.showCorrectAnswersAt,
  );
  const [hideCorrectAnswersAt, setHideCorrectAnswersAt] = useState<number | undefined>(
    existing?.hideCorrectAnswersAt,
  );
  const [anonymousGrading, setAnonymousGrading] = useState(
    existing?.anonymousGrading ?? false,
  );
  const [partialCredit, setPartialCredit] = useState(existing?.partialCredit ?? false);
  const [partialCreditPenalty, setPartialCreditPenalty] = useState(
    existing?.partialCreditPenalty ?? false,
  );
  const [nearMatchThresholdPct, setNearMatchThresholdPct] = useState(
    String(
      Math.round(
        (typeof existing?.nearMatchThreshold === "number"
          ? existing.nearMatchThreshold
          : 0.5) * 100,
      ),
    ),
  );
  const [guessingPenaltyPct, setGuessingPenaltyPct] = useState(
    String(
      Math.round(
        (typeof existing?.guessingPenalty === "number" ? existing.guessingPenalty : 0) * 100,
      ),
    ),
  );
  const [requireEssayComment, setRequireEssayComment] = useState(
    existing?.requireEssayComment ?? false,
  );
  const [groupId, setGroupId] = useState(existing?.groupId ?? presetGroupId ?? defaultGroupId);
  const useMonaco = shouldUseMonacoEditor(effectiveCourseId, {
    monacoEditor: monacoEditorFieldFromOverride(monacoOverride),
  });
  const advancedHasOverrides =
    (quizType !== "practice" && lockOnLeave) ||
    requireFullscreen ||
    Boolean(idleTimeoutMinutes.trim()) ||
    softDisablePaste ||
    requireViewAllQuestions ||
    collectSeatNumber ||
    monacoOverride !== "inherit" ||
    softOrigEnabled ||
    Boolean(oneTimeAccessToken.trim()) ||
    Boolean(previewShareKey.trim()) ||
    (quizType !== "survey" &&
      (anonymousGrading ||
        partialCredit ||
        Number(guessingPenaltyPct) > 0 ||
        requireEssayComment));
  const showOnboarding = shouldShowQuizOnboarding(effectiveCourseId, quizId);

  useEffect(() => {
    const syncCourseMonaco = () => setCourseMonacoDefault(getCourseMonacoDefault(effectiveCourseId));
    syncCourseMonaco();
    window.addEventListener("canvasClone:coursesChanged", syncCourseMonaco);
    return () => window.removeEventListener("canvasClone:coursesChanged", syncCourseMonaco);
  }, [effectiveCourseId]);

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setDueAt(existing?.dueAt);
    setDueOverrides(
      existing ? listOverridesForItem(effectiveCourseId, "quiz", existing.id) : [],
    );
    setPoints(existing?.points?.toString() ?? "");
    setTimeLimitMinutes(existing?.timeLimitMinutes?.toString() ?? "");
    setQuestions(normalizeQuizQuestions(existing?.questions));
    const pool = poolRowsFromQuiz(existing?.bankPool);
    setBankPoolMode(pool.mode);
    setBankPoolRows(pool.rows);
    setCombinedPickCount(pool.total);
    setPublishAt(existing?.publishAt);
    setUnpublishAt(existing?.unpublishAt);
    setAccessCodeExpiresAt(existing?.accessCodeExpiresAt);
    setOneTimeAccessToken(existing?.oneTimeAccessToken ?? "");
    setPreviewShareKey(existing?.previewShareKey ?? "");
    setPracticeInstantFeedback(existing?.practiceInstantFeedback ?? false);
    setPracticeRetakeWrongOnly(existing?.practiceRetakeWrongOnly ?? false);
    setPracticeScorePreview(existing?.practiceScorePreview ?? false);
    setAllowedSectionsText((existing?.allowedSections ?? []).join(", "));
    setAvailableFrom(existing?.availableFrom);
    setAvailableUntil(existing?.availableUntil);
    setShuffleAnswers(existing?.shuffleAnswers ?? true);
    setShuffleQuestions(existing?.shuffleQuestions ?? false);
    setQuizType(existing?.quizType ?? "graded");
    setAccessCode(existing?.accessCode ?? "");
    setHideScoreUntilGraded(existing?.hideScoreUntilGraded ?? false);
    setOneQuestionAtATime(existing?.oneQuestionAtATime ?? false);
    setLockPreviousQuestions(existing?.lockPreviousQuestions ?? false);
    setLockOnLeave(existing?.lockOnLeave ?? false);
    setMaxLeaveCount(
      existing?.maxLeaveCount != null ? String(existing.maxLeaveCount) : "",
    );
    setWarnOnLeave(existing?.warnOnLeave ?? false);
    setLockOnBlur(existing?.lockOnBlur ?? false);
    setRequireFullscreen(existing?.requireFullscreen ?? false);
    setIdleTimeoutMinutes(
      existing?.idleTimeoutMinutes != null ? String(existing.idleTimeoutMinutes) : "",
    );
    setSoftDisablePaste(existing?.softDisablePaste ?? false);
    setMonacoOverride(monacoOverrideFromQuiz(existing));
    setSoftOrigEnabled(existing?.softOriginality?.enabled !== false);
    setSoftOrigSelf(existing?.softOriginality?.includeSelfAttempts !== false);
    setSoftOrigOtherQuizzes(Boolean(existing?.softOriginality?.includeOtherQuizzes));
    setSoftOrigNormalizeCode(existing?.softOriginality?.normalizeCode !== false);
    setSoftOrigExcludeText(existing?.softOriginality?.excludeText ?? "");
    setSoftOrigMinPct(
      existing?.softOriginality?.minMatchPercent != null
        ? String(existing.softOriginality.minMatchPercent)
        : "1",
    );
    setRequireViewAllQuestions(existing?.requireViewAllQuestions ?? false);
    setCollectSeatNumber(existing?.collectSeatNumber ?? false);
    setRequireSeatNumber(existing?.requireSeatNumber !== false);
    setAllowMultipleAttempts(existing?.allowMultipleAttempts ?? false);
    setUnlimitedAttempts(
      existing?.allowMultipleAttempts ? existing?.allowedAttempts == null : true,
    );
    setAllowedAttempts(existing?.allowedAttempts?.toString() ?? "2");
    setScoringPolicy(existing?.scoringPolicy ?? "highest");
    setLetStudentsSeeResponses(existing?.letStudentsSeeResponses ?? true);
    setShowResponsesOnlyOnce(existing?.showResponsesOnlyOnce ?? false);
    setShowCorrectAnswers(existing?.showCorrectAnswers ?? true);
    setShowCorrectAnswersAt(existing?.showCorrectAnswersAt);
    setHideCorrectAnswersAt(existing?.hideCorrectAnswersAt);
    setAnonymousGrading(existing?.anonymousGrading ?? false);
    setPartialCredit(existing?.partialCredit ?? false);
    setPartialCreditPenalty(existing?.partialCreditPenalty ?? false);
    setNearMatchThresholdPct(
      String(
        Math.round(
          (typeof existing?.nearMatchThreshold === "number"
            ? existing.nearMatchThreshold
            : 0.5) * 100,
        ),
      ),
    );
    setGuessingPenaltyPct(
      String(
        Math.round(
          (typeof existing?.guessingPenalty === "number" ? existing.guessingPenalty : 0) * 100,
        ),
      ),
    );
    setRequireEssayComment(existing?.requireEssayComment ?? false);
    setGroupId(existing?.groupId ?? presetGroupId ?? defaultGroupId);
  }, [existing?.id, defaultGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const questionPointsTotal = totalQuizQuestionPoints(questions);
  const bankPoolPreview = useMemo(
    () => buildBankPoolFromEditor(bankPoolMode, bankPoolRows, combinedPickCount),
    [bankPoolMode, bankPoolRows, combinedPickCount],
  );
  const bankDrawCount = bankPoolPreview ? bankPoolDrawCount(bankPoolPreview) : 0;
  const attemptQuestionCount = questions.length + bankDrawCount;
  const quizPointsTarget = points.trim() !== "" && Number(points) > 0 ? Number(points) : undefined;

  // Keep Details → Points in sync with the sum of question weights whenever the
  // field still matches that sum (or is empty). A deliberately different value
  // (scale-to-N) is left alone until the instructor clears/resets it.
  const prevQuestionPointsTotalRef = useRef<number | null>(null);
  useEffect(() => {
    prevQuestionPointsTotalRef.current = null;
  }, [existing?.id]);

  useEffect(() => {
    if (quizType === "survey") {
      prevQuestionPointsTotalRef.current = questionPointsTotal;
      return;
    }
    const prevTotal = prevQuestionPointsTotalRef.current;
    prevQuestionPointsTotalRef.current = questionPointsTotal;
    if (prevTotal === null) return;

    setPoints((current) => {
      const trimmed = current.trim();
      if (trimmed === "") {
        return questionPointsTotal > 0 ? String(questionPointsTotal) : "";
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return current;
      if (n === prevTotal) {
        return questionPointsTotal > 0 ? String(questionPointsTotal) : "";
      }
      return current;
    });
  }, [questionPointsTotal, quizType]);

  const canSave = title.trim().length > 0;
  const hasWindowError =
    typeof availableFrom === "number" &&
    typeof availableUntil === "number" &&
    availableUntil < availableFrom;
  const isPublished = existing?.status === "published";

  const existingAttemptCount = useMemo(
    () => (!isNew && quizId ? getAttemptsForQuiz(effectiveCourseId, quizId).length : 0),
    [isNew, quizId, effectiveCourseId],
  );

  // Detect whether the graded content (questions/answers/points) changed, which
  // is what would invalidate existing student attempts.
  const contentChanged = useMemo(() => {
    if (!existing) return false;
    const beforeQ = JSON.stringify(normalizeQuizQuestions(existing.questions));
    const afterQ = JSON.stringify(questions);
    const beforePool = JSON.stringify(normalizeQuizBankPool(existing.bankPool) ?? null);
    const afterPool = JSON.stringify(bankPoolPreview ?? null);
    return beforeQ !== afterQ || beforePool !== afterPool;
  }, [existing, questions, bankPoolPreview]);

  const scoringSettingsChanged = useMemo(() => {
    if (!existing) return false;
    if (Boolean(existing.partialCredit) !== Boolean(partialCredit)) return true;
    if (Boolean(existing.partialCreditPenalty) !== Boolean(partialCreditPenalty)) return true;
    const before =
      typeof existing.nearMatchThreshold === "number" ? existing.nearMatchThreshold : 0.5;
    const afterRaw = Number(nearMatchThresholdPct);
    const after = Number.isFinite(afterRaw)
      ? Math.min(1, Math.max(0, afterRaw / 100))
      : 0.5;
    if (Math.abs(before - after) > 1e-9) return true;
    const gpBefore =
      typeof existing.guessingPenalty === "number" ? existing.guessingPenalty : 0;
    const gpAfterRaw = Number(guessingPenaltyPct);
    const gpAfter = Number.isFinite(gpAfterRaw)
      ? Math.min(1, Math.max(0, gpAfterRaw / 100))
      : 0;
    if (Math.abs(gpBefore - gpAfter) > 1e-9) return true;
    if (Boolean(existing.requireEssayComment) !== Boolean(requireEssayComment)) return true;
    return false;
  }, [
    existing,
    partialCredit,
    partialCreditPenalty,
    nearMatchThresholdPct,
    guessingPenaltyPct,
    requireEssayComment,
  ]);

  // Pending save while the reset-attempts confirmation modal is open.
  const [pendingAction, setPendingAction] = useState<null | "draft" | "publish">(null);
  const [publishChecklist, setPublishChecklist] = useState<QuizChecklistItem[] | null>(
    null,
  );

  const runAction = (action: "draft" | "publish") =>
    action === "draft" ? onSaveDraft() : onPublish();

  const warnMissingSamples = (qs: QuizQuestion[]) => {
    if (quizType === "survey") return;
    const missing = codingQuestionsMissingSample(qs);
    if (missing.length > 0) {
      showToast(
        missing.length === 1
          ? "1 coding question has tests but no sample answer (answer key)"
          : `${missing.length} coding questions have tests but no sample answer (answer key)`,
        "neutral",
        "errors",
      );
    }
  };

  const requestSave = (action: "draft" | "publish") => {
    if (action === "publish") {
      const draftForCheck = {
        title,
        questions,
        quizType,
        points: Number(points) || 0,
      } as Pick<Quiz, "title" | "questions" | "quizType" | "points">;
      const checklist = getQuizPublishChecklist(draftForCheck);
      if (checklist.length > 0) {
        setPublishChecklist(checklist);
        return;
      }
    }
    if (existing && !contentChanged) {
      const diff = summarizeQuizSettingsDiff(existing, buildPatch(action === "publish" ? "published" : "draft", action === "publish"));
      if (diff.length > 0) {
        setSettingsDiff(diff);
        setPendingSettingsAction(action);
        return;
      }
    }
    if (existingAttemptCount > 0 && (contentChanged || scoringSettingsChanged)) {
      setPendingAction(action);
      return;
    }
    runAction(action);
  };

  const confirmSettingsDiffSave = () => {
    const action = pendingSettingsAction;
    setSettingsDiff(null);
    setPendingSettingsAction(null);
    if (!action) return;
    if (existingAttemptCount > 0 && (contentChanged || scoringSettingsChanged)) {
      setPendingAction(action);
      return;
    }
    runAction(action);
  };

  const confirmPublishFromChecklist = () => {
    const hasErrors = (publishChecklist ?? []).some((i) => i.severity === "error");
    if (hasErrors) return;
    setPublishChecklist(null);
    if (existingAttemptCount > 0 && (contentChanged || scoringSettingsChanged)) {
      setPendingAction("publish");
      return;
    }
    runAction("publish");
  };

  const confirmSave = async (
    mode: "keep" | "regrade" | "regrade-clear" | "reset",
  ) => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    if (mode === "reset" && quizId) clearQuizAttempts(effectiveCourseId, quizId);
    runAction(action);
    if ((mode === "regrade" || mode === "regrade-clear") && quizId) {
      const saved = loadQuizzes(effectiveCourseId).find((q) => q.id === quizId);
      if (saved) {
        const { updated } = await regradeQuizAttempts(effectiveCourseId, saved, {
          resetOverrides: mode === "regrade-clear",
        });
        showToast(
          mode === "regrade-clear"
            ? updated === 1
              ? "Regraded 1 attempt and cleared GradePro overrides"
              : `Regraded ${updated} attempts and cleared GradePro overrides`
            : updated === 1
              ? "Regraded 1 attempt with the new scoring settings"
              : `Regraded ${updated} attempts with the new scoring settings`,
          "positive",
          "grading",
        );
      }
    }
  };

  const upsert = (patch: Partial<Quiz> & Pick<Quiz, "id">) => {
    const next = [...all];
    const idx = next.findIndex((x) => x.id === patch.id);
    const now = Date.now();
    if (idx >= 0) {
      const prev = next[idx];
      next[idx] = { ...prev, ...patch, updatedAt: now };
      // Inherit course Monaco: drop explicit override key
      if (!("monacoEditor" in patch) || patch.monacoEditor === undefined) {
        delete next[idx].monacoEditor;
      }
      if ((prev.accessCode ?? "").trim() !== (next[idx].accessCode ?? "").trim()) {
        clearQuizAccess(effectiveCourseId, patch.id);
      }
      if (patch.questions && JSON.stringify(prev.questions) !== JSON.stringify(patch.questions)) {
        recordAudit({
          action: "quiz_key_changed",
          courseId: effectiveCourseId,
          summary: `Updated questions or answer keys on “${next[idx].title || "Untitled quiz"}”`,
          href: `/courses/${effectiveCourseId}/quizzes/${patch.id}/edit`,
        });
      }
    } else {
      next.unshift({
        id: patch.id,
        title: patch.title ?? "",
        description: patch.description,
        dueAt: patch.dueAt,
        points: patch.points,
        status: patch.status ?? "draft",
        published: patch.published ?? false,
        publishAt: patch.publishAt,
        availableFrom: patch.availableFrom,
        availableUntil: patch.availableUntil,
        timeLimitMinutes: patch.timeLimitMinutes,
        questionCount: patch.questionCount ?? 0,
        questions: patch.questions ?? [],
        bankPool: patch.bankPool,
        shuffleAnswers: patch.shuffleAnswers,
        shuffleQuestions: patch.shuffleQuestions,
        quizType: patch.quizType,
        accessCode: patch.accessCode,
        hideScoreUntilGraded: patch.hideScoreUntilGraded,
        oneQuestionAtATime: patch.oneQuestionAtATime,
        lockPreviousQuestions: patch.lockPreviousQuestions,
        lockOnLeave: patch.lockOnLeave,
        maxLeaveCount: patch.maxLeaveCount,
        warnOnLeave: patch.warnOnLeave,
        requireFullscreen: patch.requireFullscreen,
        requireViewAllQuestions: patch.requireViewAllQuestions,
        collectSeatNumber: patch.collectSeatNumber,
        allowMultipleAttempts: patch.allowMultipleAttempts,
        allowedAttempts: patch.allowedAttempts,
        scoringPolicy: patch.scoringPolicy,
        letStudentsSeeResponses: patch.letStudentsSeeResponses,
        showResponsesOnlyOnce: patch.showResponsesOnlyOnce,
        showCorrectAnswers: patch.showCorrectAnswers,
        showCorrectAnswersAt: patch.showCorrectAnswersAt,
        hideCorrectAnswersAt: patch.hideCorrectAnswersAt,
        anonymousGrading: patch.anonymousGrading,
        partialCredit: patch.partialCredit,
        partialCreditPenalty: patch.partialCreditPenalty,
        nearMatchThreshold: patch.nearMatchThreshold,
        groupId: patch.groupId,
        monacoEditor: patch.monacoEditor,
        createdAt: now,
        updatedAt: now,
      });
    }
    saveQuizzes(effectiveCourseId, next);
  };

  const persistDueOverrides = (itemId: string) => {
    replaceItemOverrides(effectiveCourseId, "quiz", itemId, dueOverrides);
  };

  const buildPatch = (status: "draft" | "published", published: boolean): Partial<Quiz> => {
    const questionPoints = totalQuizQuestionPoints(questions);
    const resolvedPoints = points ? Number(points) : questionPoints > 0 ? questionPoints : undefined;
    const bankPool = buildBankPoolFromEditor(bankPoolMode, bankPoolRows, combinedPickCount);
    const poolDraw = bankPool ? bankPoolDrawCount(bankPool) : 0;

    return {
      title: title.trim(),
      description: description.trim() || undefined,
      dueAt,
      points: quizType === "survey" ? undefined : resolvedPoints,
      status,
      published,
      publishAt: status === "draft" ? publishAt : undefined,
      availableFrom,
      availableUntil,
      timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : undefined,
      questions:
        quizType === "survey" ? stripSurveyAnswerKeys(questions) : questions,
      questionCount: questions.length + poolDraw,
      bankPool,
      shuffleAnswers,
      shuffleQuestions,
      quizType,
      accessCode: accessCode.trim() || undefined,
      hideScoreUntilGraded: quizType === "survey" ? false : hideScoreUntilGraded,
      oneQuestionAtATime,
      lockPreviousQuestions: oneQuestionAtATime ? lockPreviousQuestions : false,
      lockOnLeave: quizType === "practice" ? false : lockOnLeave,
      maxLeaveCount:
        quizType !== "practice" && lockOnLeave
          ? maxLeaveCount.trim()
            ? Math.max(1, Number(maxLeaveCount) || 1)
            : undefined
          : undefined,
      warnOnLeave: quizType !== "practice" && lockOnLeave ? warnOnLeave : false,
      lockOnBlur: quizType !== "practice" && lockOnLeave ? lockOnBlur : false,
      requireFullscreen,
      idleTimeoutMinutes: idleTimeoutMinutes.trim()
        ? Math.max(1, Number(idleTimeoutMinutes) || 1)
        : undefined,
      softDisablePaste,
      monacoEditor: monacoEditorFieldFromOverride(monacoOverride),
      softOriginality: {
        enabled: softOrigEnabled,
        includeSelfAttempts: softOrigSelf,
        includeOtherQuizzes: softOrigOtherQuizzes,
        normalizeCode: softOrigNormalizeCode,
        excludeText: softOrigExcludeText.trim() || undefined,
        minMatchPercent: (() => {
          const n = Number(softOrigMinPct);
          if (!Number.isFinite(n)) return 1;
          return Math.max(0, Math.min(100, Math.round(n)));
        })(),
      },
      requireViewAllQuestions,
      collectSeatNumber,
      requireSeatNumber: collectSeatNumber ? requireSeatNumber : undefined,
      allowMultipleAttempts,
      allowedAttempts: !allowMultipleAttempts
        ? 1
        : unlimitedAttempts
          ? undefined
          : Number(allowedAttempts) || undefined,
      scoringPolicy: allowMultipleAttempts ? scoringPolicy : undefined,
      letStudentsSeeResponses,
      showResponsesOnlyOnce: letStudentsSeeResponses ? showResponsesOnlyOnce : false,
      showCorrectAnswers: quizType === "survey" ? false : showCorrectAnswers,
      showCorrectAnswersAt:
        quizType !== "survey" && showCorrectAnswers ? showCorrectAnswersAt : undefined,
      hideCorrectAnswersAt:
        quizType !== "survey" && showCorrectAnswers ? hideCorrectAnswersAt : undefined,
      anonymousGrading: quizType === "survey" ? false : anonymousGrading,
      partialCredit: quizType === "survey" ? false : partialCredit,
      partialCreditPenalty:
        quizType !== "survey" && partialCredit ? partialCreditPenalty : false,
      nearMatchThreshold:
        quizType !== "survey" && partialCredit
          ? (() => {
              const n = Number(nearMatchThresholdPct);
              if (!Number.isFinite(n)) return 0.5;
              return Math.min(1, Math.max(0, Math.round(n) / 100));
            })()
          : undefined,
      guessingPenalty:
        quizType !== "survey"
          ? (() => {
              const n = Number(guessingPenaltyPct);
              if (!Number.isFinite(n) || n <= 0) return undefined;
              return Math.min(1, Math.max(0, Math.round(n) / 100));
            })()
          : undefined,
      requireEssayComment: quizType !== "survey" && requireEssayComment ? true : undefined,
      unpublishAt:
        status === "published" && typeof unpublishAt === "number" ? unpublishAt : undefined,
      accessCodeExpiresAt: accessCode.trim() ? accessCodeExpiresAt : undefined,
      oneTimeAccessToken: oneTimeAccessToken.trim() || undefined,
      previewShareKey: previewShareKey.trim() || undefined,
      practiceInstantFeedback: quizType === "practice" ? practiceInstantFeedback : undefined,
      practiceRetakeWrongOnly: quizType === "practice" ? practiceRetakeWrongOnly : undefined,
      practiceScorePreview: quizType === "practice" ? practiceScorePreview : undefined,
      allowedSections: (() => {
        const secs = allowedSectionsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return secs.length ? secs : undefined;
      })(),
      groupId: quizType === "graded" ? groupId || undefined : undefined,
    };
  };

  const applyPreset = (preset: QuizPresetId) => {
    const patch = applyQuizPreset({}, preset);
    if (patch.quizType) setQuizType(patch.quizType);
    if (typeof patch.timeLimitMinutes === "number") {
      setTimeLimitMinutes(String(patch.timeLimitMinutes));
    } else if (patch.timeLimitMinutes === undefined && preset !== "exam") {
      setTimeLimitMinutes("");
    }
    if (typeof patch.shuffleAnswers === "boolean") setShuffleAnswers(patch.shuffleAnswers);
    if (typeof patch.shuffleQuestions === "boolean") setShuffleQuestions(patch.shuffleQuestions);
    if (typeof patch.allowMultipleAttempts === "boolean") {
      setAllowMultipleAttempts(patch.allowMultipleAttempts);
    }
    if (typeof patch.lockOnLeave === "boolean") setLockOnLeave(patch.lockOnLeave);
    if (typeof patch.showCorrectAnswers === "boolean") setShowCorrectAnswers(patch.showCorrectAnswers);
    if (typeof patch.practiceInstantFeedback === "boolean") {
      setPracticeInstantFeedback(patch.practiceInstantFeedback);
    }
    if (typeof patch.practiceScorePreview === "boolean") {
      setPracticeScorePreview(patch.practiceScorePreview);
    }
    showToast(`Applied ${QUIZ_PRESET_LABELS[preset]} preset`, "positive", "saved");
  };

  const onSaveDraft = () => {
    if (!canSave || hasWindowError) return;
    warnMissingSamples(questions);
    const id = isNew ? uid("quiz") : existing?.id;
    if (isNew) {
      upsert({ id: id as string, ...buildPatch("draft", false) });
    } else if (existing) {
      upsert({ id: existing.id, ...buildPatch("draft", false) });
    }
    if (id) persistDueOverrides(id);
    if (id) {
      showToast("Quiz saved", "positive", "saved");
      afterSave(id);
    }
    else navigate(backTo);
  };

  const onPublish = () => {
    if (!canSave || hasWindowError) return;
    const now = Date.now();
    const shouldSchedule =
      typeof publishAt === "number" && Number.isFinite(publishAt) && publishAt > now;

    if (isNew) {
      const id = uid("quiz");
      if (shouldSchedule) {
        upsert({ id, ...buildPatch("draft", false), publishAt });
      } else {
        upsert({ id, ...buildPatch("published", true), publishAt: undefined });
      }
      persistDueOverrides(id);
      showToast(shouldSchedule ? "Quiz scheduled" : "Quiz published", "positive", "published");
      afterSave(id);
      return;
    }

    if (!existing) return navigate(backTo);

    if (shouldSchedule) {
      upsert({ id: existing.id, ...buildPatch("draft", false), publishAt });
    } else {
      upsert({ id: existing.id, ...buildPatch("published", true), publishAt: undefined });
    }
    persistDueOverrides(existing.id);
    showToast(shouldSchedule ? "Quiz scheduled" : "Quiz published", "positive", "published");
    afterSave(existing.id);
  };

  const tabs: { id: EditorTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "questions", label: `Questions${attemptQuestionCount ? ` (${attemptQuestionCount})` : ""}` },
  ];

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-transparent px-8 py-8 text-arc-ink">
        <div className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon name="help" size={20} className="text-gray-500" />
              <h1 className="font-display text-2xl font-medium text-arc-ink">
                {isNew ? "New Quiz" : "Edit Quiz"}
              </h1>
              {!isNew && (
                <span
                  className={[
                    "ml-2 rounded-full border px-2 py-0.5 text-xs font-medium",
                    isPublished
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-gray-200 bg-gray-50 text-gray-700",
                  ].join(" ")}
                >
                  {isPublished ? "Published" : "Draft"}
                </span>
              )}
            </div>
            {!isNew && existing && questions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const draftQuiz = {
                    ...existing,
                    ...buildPatch(existing.status ?? "draft", Boolean(existing.published)),
                    title: title.trim() || existing.title,
                    questions,
                  } as Quiz;
                  downloadTextFile(
                    quizQtiFilename(draftQuiz.title),
                    exportQuizToQtiXml(draftQuiz),
                    "application/xml",
                  );
                  showToast("Quiz exported as QTI XML", "positive", "files");
                }}
                className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
              >
                <Icon name="download" size={16} />
                Export QTI
              </button>
            )}
          </div>

          {existingAttemptCount > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Icon name="warning" size={16} className="mt-0.5" />
              <p>
                {existingAttemptCount} student attempt
                {existingAttemptCount === 1 ? " has" : "s have"} already been made on this quiz.
                Editing questions or answers may make existing scores inaccurate — you'll be asked
                whether to reset attempts when you save.
              </p>
            </div>
          )}

          {showOnboarding && (
            <QuizOnboardingChecklist
              courseId={effectiveCourseId}
              quiz={{
                id: existing?.id ?? "new-quiz",
                title,
                questions,
                dueAt,
                availableFrom,
                availableUntil,
                published: Boolean(existing?.published) || isPublished,
                status: isPublished ? "published" : "draft",
              }}
            />
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="bg-arc-ivory p-5 ring-1 ring-arc-ink/10">
            <div className="flex border-b border-gray-200 text-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 -mb-px border-b-2 ${
                    activeTab === tab.id
                      ? "border-canvas-blue text-canvas-blue font-medium"
                      : "border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              {activeTab === "details" ? (
                <>
                  <div>
                    <div className="form-label">Title</div>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Quiz title"
                      className="form-input"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DateTimeField label="Due date" value={dueAt} onChange={setDueAt} />
                    <div>
                      <div className="form-label">Points</div>
                      <input
                        type="number"
                        min={0}
                        value={points}
                        onChange={(e) => setPoints(e.target.value)}
                        placeholder={questionPointsTotal > 0 ? String(questionPointsTotal) : "10"}
                        className="form-input h-10"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {questionPointsTotal > 0
                          ? `Follows inline question weights (${formatPoints(questionPointsTotal)} pts) as you edit. `
                          : ""}
                        Set a different value to scale attempt scores to that total instead.
                      </p>
                    </div>
                  </div>

                  {quizType === "graded" && (
                    <AssignmentGroupSelect
                      groups={assignmentGroups}
                      value={groupId}
                      onChange={setGroupId}
                      weighted={isWeightedGradingEnabled(course)}
                    />
                  )}

                  <RichContentEditor
                    label="Description"
                    value={existing?.description ?? ""}
                    onChange={setDescription}
                    height={360}
                    courseId={effectiveCourseId}
                    mountKey={quizId ?? "new-quiz"}
                  />

                  <div className="rounded-lg border border-gray-200 p-5">
                    <div className="form-section-title">Options</div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(Object.keys(QUIZ_PRESET_LABELS) as QuizPresetId[]).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="btn-canvas-secondary px-3 py-1.5 text-xs"
                        >
                          {QUIZ_PRESET_LABELS[preset]} preset
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <div className="form-label">Quiz type</div>
                        <select
                          value={quizType}
                          onChange={(e) => {
                            const next = e.target.value as QuizType;
                            setQuizType(next);
                            if (next === "practice") {
                              setLockOnLeave(false);
                              setMaxLeaveCount("");
                              setWarnOnLeave(false);
                              setLockOnBlur(false);
                            }
                            if (next === "survey") {
                              setQuestions((qs) => stripSurveyAnswerKeys(qs));
                              setPoints("");
                              setShowCorrectAnswers(false);
                              setHideScoreUntilGraded(false);
                            }
                          }}
                          className="form-input h-10"
                        >
                          {(Object.keys(QUIZ_TYPE_LABELS) as QuizType[]).map((t) => (
                            <option key={t} value={t}>
                              {QUIZ_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                          {quizType === "graded"
                            ? "Scores count in the gradebook when posted."
                            : quizType === "practice"
                              ? "Students see scores for practice; not in the gradebook."
                              : "No scores or answer key for students; not in the gradebook."}
                        </p>
                      </div>
                      <div>
                        <div className="form-label">Time limit (minutes)</div>
                        <input
                          type="number"
                          min={0}
                          value={timeLimitMinutes}
                          onChange={(e) => setTimeLimitMinutes(e.target.value)}
                          placeholder="30"
                          className="form-input h-10"
                        />
                        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                          Leave blank for no time limit.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-gray-100 pt-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Presentation
                      </p>
                      <div className="space-y-3">
                        <label className="form-checkbox-label">
                          <input
                            type="checkbox"
                            checked={shuffleAnswers}
                            onChange={(e) => setShuffleAnswers(e.target.checked)}
                          />
                          Shuffle answers
                        </label>
                        <label className="form-checkbox-label">
                          <input
                            type="checkbox"
                            checked={shuffleQuestions}
                            onChange={(e) => setShuffleQuestions(e.target.checked)}
                          />
                          Shuffle questions
                        </label>
                        <div className="space-y-3">
                          <label className="form-checkbox-label">
                            <input
                              type="checkbox"
                              checked={oneQuestionAtATime}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setOneQuestionAtATime(on);
                                if (!on) setLockPreviousQuestions(false);
                              }}
                            />
                            Show one question at a time
                          </label>
                          {oneQuestionAtATime && (
                            <label className="form-checkbox-label ml-6 rounded-md border border-gray-100 bg-gray-50/70 px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={lockPreviousQuestions}
                                onChange={(e) => setLockPreviousQuestions(e.target.checked)}
                              />
                              Prevent returning to previous questions
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-gray-100 pt-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Attempts
                      </p>
                      <div className="space-y-3">
                        <label className="form-checkbox-label">
                          <input
                            type="checkbox"
                            checked={allowMultipleAttempts}
                            onChange={(e) => setAllowMultipleAttempts(e.target.checked)}
                          />
                          Allow multiple attempts
                        </label>
                        {allowMultipleAttempts && (
                          <div className="ml-6 space-y-4 rounded-md border border-gray-100 bg-gray-50/70 p-3.5">
                            <label className="form-checkbox-label">
                              <input
                                type="checkbox"
                                checked={unlimitedAttempts}
                                onChange={(e) => setUnlimitedAttempts(e.target.checked)}
                              />
                              Allow unlimited attempts
                            </label>
                            {!unlimitedAttempts && (
                              <div className="max-w-xs">
                                <div className="form-label">Allowed attempts</div>
                                <input
                                  type="number"
                                  min={2}
                                  value={allowedAttempts}
                                  onChange={(e) => setAllowedAttempts(e.target.value)}
                                  placeholder="2"
                                  className="form-input h-10"
                                />
                              </div>
                            )}
                            {quizType !== "survey" && (
                              <div className="max-w-xs">
                                <div className="form-label">Score to keep</div>
                                <select
                                  value={scoringPolicy}
                                  onChange={(e) =>
                                    setScoringPolicy(e.target.value as QuizScoringPolicy)
                                  }
                                  className="form-input h-10"
                                >
                                  {(
                                    Object.keys(QUIZ_SCORING_POLICY_LABELS) as QuizScoringPolicy[]
                                  ).map((policy) => (
                                    <option key={policy} value={policy}>
                                      {QUIZ_SCORING_POLICY_LABELS[policy]}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                                  Which attempt counts toward the student's
                                  {quizType === "graded" ? " grade" : " recorded score"}.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {quizType === "practice" && (
                      <div className="mt-6 border-t border-gray-100 pt-5">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Practice
                        </p>
                        <div className="space-y-3 rounded-md border border-slate-200/80 bg-slate-50/60 p-3.5">
                          <label className="form-checkbox-label">
                            <input
                              type="checkbox"
                              checked={practiceInstantFeedback}
                              onChange={(e) => setPracticeInstantFeedback(e.target.checked)}
                            />
                            Show explanations after each question
                          </label>
                          <label className="form-checkbox-label">
                            <input
                              type="checkbox"
                              checked={practiceRetakeWrongOnly}
                              onChange={(e) => setPracticeRetakeWrongOnly(e.target.checked)}
                            />
                            Retake wrong questions only
                          </label>
                          <label className="form-checkbox-label">
                            <input
                              type="checkbox"
                              checked={practiceScorePreview}
                              onChange={(e) => setPracticeScorePreview(e.target.checked)}
                            />
                            Score preview before submit
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 rounded-lg border border-gray-200 p-5">
                    <div className="form-section-title">Publishing &amp; access</div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DateTimeField
                        label="Publish later"
                        value={publishAt}
                        onChange={setPublishAt}
                        disabled={isPublished}
                      />
                      <DateTimeField
                        label="Schedule unpublish"
                        value={unpublishAt}
                        onChange={setUnpublishAt}
                        disabled={!isPublished}
                      />
                    </div>
                    <label className="block text-sm">
                      <span className="form-label">Allowed sections (comma-separated)</span>
                      <input
                        value={allowedSectionsText}
                        onChange={(e) => setAllowedSectionsText(e.target.value)}
                        placeholder="All (empty) or e.g. Section A, Section B"
                        className="form-input mt-1"
                      />
                    </label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DateTimeField
                        label="Available from"
                        value={availableFrom}
                        onChange={setAvailableFrom}
                      />
                      <DateTimeField
                        label="Available until"
                        value={availableUntil}
                        onChange={setAvailableUntil}
                      />
                    </div>
                    {hasWindowError && (
                      <p className="text-sm text-red-600">
                        Available until must be after available from.
                      </p>
                    )}
                    <DueDateOverridesEditor
                      courseId={effectiveCourseId}
                      overrides={dueOverrides}
                      onChange={setDueOverrides}
                    />
                    <div className="border-t border-gray-100 pt-4">
                      <div className="form-label">Access code</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value)}
                          placeholder="Optional"
                          className="form-input h-10 min-w-0 flex-1 font-mono tracking-wider"
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => setAccessCode(generateQuizAccessCode())}
                          className="btn-canvas-secondary inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm"
                          title="Generate a random access code"
                        >
                          <Icon name="rotate" size={14} />
                          Generate
                        </button>
                        {existing?.id && (
                          <button
                            type="button"
                            onClick={() => {
                              clearAllQuizSessionAccess(effectiveCourseId, existing.id);
                              showToast("Cleared session unlocks for this quiz", "positive", "deleted");
                            }}
                            className="btn-canvas-secondary inline-flex h-10 shrink-0 items-center px-3 text-sm"
                          >
                            Clear unlocks
                          </button>
                        )}
                      </div>
                      <div className="mt-3">
                        <DateTimeField
                          label="Access code expires"
                          value={accessCodeExpiresAt}
                          onChange={setAccessCodeExpiresAt}
                        />
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                        Students must enter this code before starting (remembered for this browser
                        session). Clear the field to remove the requirement.
                      </p>
                    </div>
                  </div>

                  <QuizEditorDisclosure
                    title="Advanced"
                    forceOpen={advancedHasOverrides}
                    badge={advancedHasOverrides ? "customized" : undefined}
                  >
                    <div className="space-y-5">
                      <section className="rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Proctoring
                        </p>
                        <div className="mt-3.5 space-y-3">
                          <label className="form-checkbox-label items-start">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={lockOnLeave}
                              disabled={quizType === "practice"}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setLockOnLeave(on);
                                if (!on) {
                                  setMaxLeaveCount("");
                                  setWarnOnLeave(false);
                                  setLockOnBlur(false);
                                }
                              }}
                            />
                            <span>
                              Lock and blur when student leaves the quiz tab
                              {quizType === "practice" && (
                                <span className="mt-0.5 block text-xs font-normal text-gray-500">
                                  Off for practice quizzes
                                </span>
                              )}
                            </span>
                          </label>
                          {lockOnLeave && quizType !== "practice" && (
                            <div className="ml-6 space-y-3 rounded-md border border-arc-ink/10 bg-arc-paper p-3.5">
                              <label className="form-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={warnOnLeave}
                                  onChange={(e) => setWarnOnLeave(e.target.checked)}
                                />
                                Warn on first leave
                              </label>
                              <label className="form-checkbox-label items-start">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={lockOnBlur}
                                  onChange={(e) => setLockOnBlur(e.target.checked)}
                                />
                                <span>Also count window blur (debounced) as a leave</span>
                              </label>
                              <div>
                                <div className="form-label">
                                  Auto-submit after this many leaves (optional)
                                </div>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={maxLeaveCount}
                                  onChange={(e) => setMaxLeaveCount(e.target.value)}
                                  className="form-input max-w-[8rem]"
                                  placeholder="Unlimited"
                                />
                              </div>
                            </div>
                          )}
                          <label className="form-checkbox-label">
                            <input
                              type="checkbox"
                              checked={requireFullscreen}
                              onChange={(e) => setRequireFullscreen(e.target.checked)}
                            />
                            Require fullscreen before starting
                          </label>
                          <div>
                            <div className="form-label">Idle timeout (minutes, optional)</div>
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={idleTimeoutMinutes}
                              onChange={(e) => setIdleTimeoutMinutes(e.target.value)}
                              className="form-input max-w-[8rem]"
                              placeholder="Off"
                            />
                            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                              Warn after idle, then record a leave / auto-submit if still idle.
                            </p>
                          </div>
                          <label className="form-checkbox-label items-start">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={softDisablePaste}
                              onChange={(e) => setSoftDisablePaste(e.target.checked)}
                            />
                            Soft-disable paste on essay and coding answers
                          </label>
                          <label className="form-checkbox-label items-start">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={requireViewAllQuestions}
                              onChange={(e) => setRequireViewAllQuestions(e.target.checked)}
                            />
                            Require viewing all questions before submit
                          </label>
                          <div className="space-y-3">
                            <label className="form-checkbox-label">
                              <input
                                type="checkbox"
                                checked={collectSeatNumber}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setCollectSeatNumber(on);
                                  if (!on) setRequireSeatNumber(true);
                                }}
                              />
                              Collect seat / station number
                            </label>
                            {collectSeatNumber && (
                              <label className="form-checkbox-label ml-6 rounded-md border border-arc-ink/10 bg-arc-paper px-3 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={requireSeatNumber}
                                  onChange={(e) => setRequireSeatNumber(e.target.checked)}
                                />
                                Require seat number (uncheck to allow skip)
                              </label>
                            )}
                          </div>
                        </div>
                      </section>

                      {quizType !== "survey" && (
                        <section className="rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Scoring
                          </p>
                          <div className="mt-3.5 space-y-3">
                            <label className="form-checkbox-label">
                              <input
                                type="checkbox"
                                checked={anonymousGrading}
                                onChange={(e) => setAnonymousGrading(e.target.checked)}
                              />
                              Grade anonymously
                            </label>
                            <label className="form-checkbox-label items-start">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={partialCredit}
                                onChange={(e) => setPartialCredit(e.target.checked)}
                              />
                              <span>
                                Award partial credit (multiple answers, matching, numerical &amp;
                                text)
                              </span>
                            </label>
                            {partialCredit && (
                              <div className="ml-6 space-y-3.5 rounded-md border border-arc-ink/10 bg-arc-paper p-3.5">
                                <label className="form-checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={partialCreditPenalty}
                                    onChange={(e) => setPartialCreditPenalty(e.target.checked)}
                                  />
                                  Penalize incorrect multi-answer picks
                                </label>
                                <div>
                                  <div className="form-label">Near-match threshold (%)</div>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={nearMatchThresholdPct}
                                    onChange={(e) => setNearMatchThresholdPct(e.target.value)}
                                    className="form-input h-9 w-28"
                                  />
                                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                                    Fill-in / short answer must be at least this similar to earn
                                    partial credit (default 50).
                                  </p>
                                </div>
                                <p className="text-xs leading-relaxed text-gray-500">
                                  Numerical: set a partial-credit margin (±). Matching: left/right
                                  options may shuffle; scoring is by pair content. Per-question
                                  overrides are on each question.
                                </p>
                              </div>
                            )}
                            <div>
                              <div className="form-label">Guessing penalty (% of points)</div>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={5}
                                value={guessingPenaltyPct}
                                onChange={(e) => setGuessingPenaltyPct(e.target.value)}
                                className="form-input h-9 w-28"
                              />
                              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                                Wrong multiple-choice / true-false answers lose this share of
                                question points (0 = off).
                              </p>
                            </div>
                            <label className="form-checkbox-label items-start">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={requireEssayComment}
                                onChange={(e) => setRequireEssayComment(e.target.checked)}
                              />
                              Require essay reflection comment before submit
                            </label>
                          </div>
                        </section>
                      )}

                      <section className="rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Integrity &amp; tech
                        </p>
                        <div className="mt-3.5 space-y-4">
                          <div>
                            <div className="form-label">Monaco code editor</div>
                            <select
                              value={monacoOverride}
                              onChange={(e) =>
                                setMonacoOverride(e.target.value as MonacoEditorOverride)
                              }
                              className="form-input w-full"
                            >
                              <option value="inherit">
                                Course default ({courseMonacoDefault ? "on" : "off"})
                              </option>
                              <option value="on">Always use Monaco for this quiz</option>
                              <option value="off">Always use plain editor for this quiz</option>
                            </select>
                            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                              Course setting applies to all quizzes unless you override here.
                            </p>
                          </div>

                          <div className="rounded-md border border-arc-ink/10 bg-arc-paper p-3.5">
                            <label className="form-checkbox-label items-start">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={softOrigEnabled}
                                onChange={(e) => setSoftOrigEnabled(e.target.checked)}
                              />
                              Soft originality reports (peer text similarity)
                            </label>
                            {softOrigEnabled && (
                              <div className="mt-3.5 space-y-3 border-t border-gray-100 pt-3.5">
                                <label className="form-checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={softOrigSelf}
                                    onChange={(e) => setSoftOrigSelf(e.target.checked)}
                                  />
                                  Include same-student prior attempts
                                </label>
                                <label className="form-checkbox-label items-start">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={softOrigOtherQuizzes}
                                    onChange={(e) => setSoftOrigOtherQuizzes(e.target.checked)}
                                  />
                                  Also compare other quizzes in this course (similar prompts)
                                </label>
                                <label className="form-checkbox-label items-start">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={softOrigNormalizeCode}
                                    onChange={(e) => setSoftOrigNormalizeCode(e.target.checked)}
                                  />
                                  Normalize coding answers (comments / renames)
                                </label>
                                <div>
                                  <div className="form-label">Minimum match % to list</div>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={softOrigMinPct}
                                    onChange={(e) => setSoftOrigMinPct(e.target.value)}
                                    className="form-input max-w-[8rem]"
                                  />
                                </div>
                                <div>
                                  <div className="form-label">
                                    Exclude boilerplate (one phrase per line)
                                  </div>
                                  <textarea
                                    value={softOrigExcludeText}
                                    onChange={(e) => setSoftOrigExcludeText(e.target.value)}
                                    rows={3}
                                    className="form-input w-full text-sm"
                                    placeholder={"According to the lecture notes\nIn conclusion"}
                                  />
                                </div>
                                <p className="text-xs leading-relaxed text-gray-500">
                                  Client-side only — not Turnitin or an internet database.
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-end gap-2">
                            <label className="block min-w-0 flex-1 text-sm">
                              <span className="form-label">One-time link token</span>
                              <input
                                value={oneTimeAccessToken}
                                onChange={(e) => setOneTimeAccessToken(e.target.value)}
                                className="form-input mt-1 font-mono text-sm"
                                placeholder="Optional"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setOneTimeAccessToken(generateOneTimeAccessToken())}
                              className="btn-canvas-secondary h-10 px-3 text-sm"
                            >
                              Generate
                            </button>
                          </div>
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="block min-w-0 flex-1 text-sm">
                              <span className="form-label">TA preview share key</span>
                              <input
                                value={previewShareKey}
                                onChange={(e) => setPreviewShareKey(e.target.value)}
                                className="form-input mt-1 font-mono text-sm"
                                placeholder="Optional — append ?preview=1&key=…"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setPreviewShareKey(generateOneTimeAccessToken())}
                              className="btn-canvas-secondary h-10 px-3 text-sm"
                            >
                              Generate
                            </button>
                            {existing?.id && previewShareKey.trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  const url = `${window.location.origin}/courses/${effectiveCourseId}/quizzes/${existing.id}/take?preview=1&key=${encodeURIComponent(previewShareKey.trim())}`;
                                  void navigator.clipboard.writeText(url);
                                  showToast("Preview link copied", "positive", "created");
                                }}
                                className="btn-canvas-secondary inline-flex h-10 items-center gap-1.5 px-3 text-sm"
                              >
                                <Icon name="copy" size={14} />
                                Copy link
                              </button>
                            )}
                          </div>
                        </div>
                      </section>
                    </div>
                  </QuizEditorDisclosure>

                  <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                    <div className="form-section-title">Responses &amp; answers</div>
                    <label className="form-checkbox-label">
                      <input
                        type="checkbox"
                        checked={letStudentsSeeResponses}
                        onChange={(e) => setLetStudentsSeeResponses(e.target.checked)}
                      />
                      Let students see their responses
                    </label>
                    {letStudentsSeeResponses && (
                      <label className="form-checkbox-label ml-6">
                        <input
                          type="checkbox"
                          checked={showResponsesOnlyOnce}
                          onChange={(e) => setShowResponsesOnlyOnce(e.target.checked)}
                        />
                        Only once after each attempt
                      </label>
                    )}
                    {quizType !== "survey" && (
                      <>
                        <label className="form-checkbox-label">
                          <input
                            type="checkbox"
                            checked={showCorrectAnswers}
                            onChange={(e) => setShowCorrectAnswers(e.target.checked)}
                          />
                          Let students see the correct answers
                        </label>
                        {showCorrectAnswers && (
                          <div className="ml-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <DateTimeField
                              label="Show answers at"
                              value={showCorrectAnswersAt}
                              onChange={setShowCorrectAnswersAt}
                            />
                            <DateTimeField
                              label="Hide answers at"
                              value={hideCorrectAnswersAt}
                              onChange={setHideCorrectAnswersAt}
                            />
                          </div>
                        )}
                        <label className="form-checkbox-label">
                          <input
                            type="checkbox"
                            checked={hideScoreUntilGraded}
                            onChange={(e) => setHideScoreUntilGraded(e.target.checked)}
                          />
                          Hide score until the attempt is fully graded
                        </label>
                        {hideScoreUntilGraded && (
                          <p className="ml-6 text-xs text-gray-500">
                            Students won&apos;t see points until you grade the attempt in
                            GradePro — even for auto-scored questions.
                          </p>
                        )}
                      </>
                    )}
                    {quizType === "survey" && (
                      <p className="text-xs text-amber-700">
                        Surveys never show an answer key or score to students.
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Controls what students see after submitting. Instructors always see full
                      results in preview and GradePro.
                      {quizType === "graded"
                        ? " Graded quiz scores also respect gradebook post/hide."
                        : ""}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="overflow-hidden bg-arc-ivory ring-1 ring-arc-ink/10">
                    <div className="border-b border-arc-ink/10 bg-arc-paper px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas-blueTint text-canvas-blue">
                          <Icon name="library" size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-canvas-grayDark">
                            Pull from question banks
                          </h3>
                          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                            Random bank questions are added after any fixed inline questions below.
                            Leave banks empty to use only inline questions.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      <div>
                        <div className="mb-1.5 text-xs font-medium text-gray-600">Draw mode</div>
                        <div
                          className="inline-flex w-full max-w-xl rounded-lg border border-arc-ink/10 bg-arc-paper p-0.5 sm:w-auto"
                          role="radiogroup"
                          aria-label="Draw mode"
                        >
                          {(
                            [
                              {
                                id: "per_bank" as const,
                                label: "Per-bank counts",
                                hint: "e.g. 4 from DSA + 3 from Algorithms",
                              },
                              {
                                id: "combined" as const,
                                label: "Combined total",
                                hint: "e.g. 10 from all selected banks",
                              },
                            ] as const
                          ).map((opt) => {
                            const active = bankPoolMode === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setBankPoolMode(opt.id)}
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition sm:flex-none sm:px-4 ${
                                  active
                                    ? "bg-arc-ivory text-arc-ink shadow-sm"
                                    : "text-gray-500 hover:text-canvas-grayDark"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500">
                          {bankPoolMode === "per_bank"
                            ? "Set how many questions to draw from each bank."
                            : "Pick a single total drawn across all selected banks."}
                        </p>
                      </div>

                      {bankPoolMode === "combined" && (
                        <label className="block max-w-[11rem] text-sm">
                          <span className="text-xs font-medium text-gray-600">
                            Total per attempt
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={combinedPickCount}
                            onChange={(e) => setCombinedPickCount(e.target.value)}
                            className="form-input mt-1 w-full text-sm"
                          />
                        </label>
                      )}

                      <div className="overflow-hidden rounded-lg border border-canvas-border">
                        {bankPoolRows.length === 0 ? (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-gray-500">No banks linked yet.</p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              Add a bank to start drawing random questions.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <div
                              className={`grid items-center gap-2 border-b border-arc-ink/10 bg-arc-paper px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-arc-mute ${
                                bankPoolMode === "per_bank"
                                  ? "grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_2rem]"
                                  : "grid-cols-[1.25rem_minmax(0,1fr)_2rem]"
                              }`}
                            >
                              <span aria-hidden="true" />
                              <span>Bank</span>
                              {bankPoolMode === "per_bank" && (
                                <span className="text-center">Pick</span>
                              )}
                              <span aria-hidden="true" />
                            </div>
                            <ul className="divide-y divide-canvas-border">
                              {bankPoolRows.map((row, idx) => (
                                <li
                                  key={idx}
                                  className={`grid items-center gap-2 bg-arc-ivory px-3 py-2 ${
                                    bankPoolMode === "per_bank"
                                      ? "grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_2rem]"
                                      : "grid-cols-[1.25rem_minmax(0,1fr)_2rem]"
                                  }`}
                                >
                                  <span className="text-center text-xs font-medium text-gray-400">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <label className="sr-only" htmlFor={`bank-pool-${idx}`}>
                                      Bank {idx + 1}
                                    </label>
                                    <select
                                      id={`bank-pool-${idx}`}
                                      value={row.bankId}
                                      onChange={(e) => {
                                        const next = [...bankPoolRows];
                                        next[idx] = { ...next[idx], bankId: e.target.value };
                                        setBankPoolRows(next);
                                      }}
                                      className="form-input w-full text-sm"
                                    >
                                      <option value="">Select bank…</option>
                                      {banks.map((b: QuestionBank) => (
                                        <option key={b.id} value={b.id}>
                                          {b.title} ({b.questions.length})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  {bankPoolMode === "per_bank" && (
                                    <div>
                                      <label className="sr-only" htmlFor={`bank-pick-${idx}`}>
                                        Pick count for bank {idx + 1}
                                      </label>
                                      <input
                                        id={`bank-pick-${idx}`}
                                        type="number"
                                        min={1}
                                        value={row.pickCount}
                                        onChange={(e) => {
                                          const next = [...bankPoolRows];
                                          next[idx] = {
                                            ...next[idx],
                                            pickCount: e.target.value,
                                          };
                                          setBankPoolRows(next);
                                        }}
                                        className="form-input w-full text-center text-sm tabular-nums"
                                      />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBankPoolRows(bankPoolRows.filter((_, i) => i !== idx))
                                    }
                                    className="inline-flex h-8 w-8 items-center justify-center justify-self-center rounded-md text-canvas-red hover:bg-red-50"
                                    title="Remove bank"
                                    aria-label={`Remove bank ${idx + 1}`}
                                  >
                                    <Icon name="trash" size={16} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 border-t border-arc-ink/10 bg-arc-paper px-3 py-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-canvas-blue hover:bg-canvas-blueTint disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() =>
                              setBankPoolRows([
                                ...bankPoolRows,
                                {
                                  bankId: "",
                                  pickCount: bankPoolMode === "per_bank" ? "5" : "0",
                                },
                              ])
                            }
                            disabled={banks.length === 0}
                          >
                            <Icon name="plus" size={14} />
                            Add bank
                          </button>
                          {bankPoolRows.some((r) => r.bankId) && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-arc-mute hover:bg-arc-ivory hover:text-arc-ink"
                              onClick={() => {
                                const selected = bankPoolRows
                                  .map((r) => banks.find((b) => b.id === r.bankId))
                                  .filter(Boolean) as QuestionBank[];
                                if (selected.length === 0) {
                                  showToast("Select at least one bank", "negative");
                                  return;
                                }
                                const copied = selected.flatMap((b) =>
                                  b.questions.map((q) => ({ ...q })),
                                );
                                setQuestions([...questions, ...copied]);
                                showToast(
                                  `Copied ${copied.length} questions into quiz`,
                                  "positive",
                                  "created",
                                );
                              }}
                            >
                              <Icon name="copy" size={14} />
                              Copy into quiz
                            </button>
                          )}
                          {(() => {
                            const preview = buildBankPoolFromEditor(
                              bankPoolMode,
                              bankPoolRows,
                              combinedPickCount,
                            );
                            if (!preview) return null;
                            const fromBanks = bankPoolDrawCount(preview);
                            const fixed = questions.length;
                            const total = fixed + fromBanks;
                            return (
                              <span className="ml-auto rounded-full bg-canvas-blueTint px-2.5 py-1 text-[11px] font-medium text-canvas-blue">
                                {fixed > 0
                                  ? `${fixed} fixed + ${fromBanks} from banks = ${total}`
                                  : `${fromBanks} from banks`}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {banks.length === 0 && (
                        <p className="text-xs text-amber-700">
                          No question banks in this course yet. Create one from Quizzes → Question
                          Banks.
                        </p>
                      )}
                    </div>
                  </div>
                  <QuizQuestionsEditor
                    questions={questions}
                    onChange={setQuestions}
                    bankDrawCount={bankDrawCount}
                    quizPointsTarget={quizPointsTarget}
                    surveyMode={quizType === "survey"}
                    quizTitle={title.trim() || "Quiz"}
                    courseId={effectiveCourseId}
                    currentQuizId={quizId}
                    bulkEditMode
                    useMonacoEditor={useMonaco}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button type="button" onClick={() => navigate(backTo)} className="btn-canvas-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSave || hasWindowError}
                  onClick={() => requestSave("draft")}
                  className="btn-canvas-secondary"
                >
                  {!isNew && isPublished ? "Unpublish" : "Save draft"}
                </button>
                <button
                  type="button"
                  disabled={!canSave || hasWindowError}
                  onClick={() => requestSave("publish")}
                  className="btn-canvas-primary"
                >
                  {typeof publishAt === "number" && publishAt > Date.now()
                    ? "Schedule"
                    : isPublished
                      ? "Update"
                      : "Publish"}
                </button>
              </div>
            </div>
            </div>

            <aside className="lg:pt-1">
              <div className="space-y-4 lg:sticky lg:top-4">
                <div className="bg-arc-ivory p-5 ring-1 ring-arc-ink/10">
                  <h2 className="text-sm font-semibold text-canvas-grayDark">Summary</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Status</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {isPublished ? "Published" : "Draft"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Questions</dt>
                      <dd className="text-right font-medium text-canvas-grayDark">
                        {attemptQuestionCount}
                        {bankDrawCount > 0 && (
                          <span className="mt-0.5 block text-xs font-normal text-gray-500">
                            {questions.length} fixed + {bankDrawCount} from banks
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Points</dt>
                      <dd className="text-right font-medium text-canvas-grayDark">
                        {points !== "" ? points : questionPointsTotal || "—"}
                        {quizPointsTarget != null && bankDrawCount + questions.length > 0 && (
                          <span className="mt-0.5 block text-xs font-normal text-gray-500">
                            Scaled across all attempt questions
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Time limit</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {timeLimitMinutes ? `${timeLimitMinutes} min` : "None"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Attempts</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {!allowMultipleAttempts
                          ? "1"
                          : unlimitedAttempts
                            ? "Unlimited"
                            : allowedAttempts || "Unlimited"}
                      </dd>
                    </div>
                    {oneQuestionAtATime && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Display</dt>
                        <dd className="text-right font-medium text-canvas-grayDark">
                          One at a time
                          {lockPreviousQuestions && (
                            <span className="mt-0.5 block text-xs font-normal text-gray-500">
                              No going back
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    {lockOnLeave && quizType !== "practice" && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Leave lock</dt>
                        <dd className="text-right font-medium text-canvas-grayDark">
                          On
                          {warnOnLeave && (
                            <span className="mt-0.5 block text-xs font-normal text-gray-500">
                              Warn on first leave
                            </span>
                          )}
                          {lockOnBlur && (
                            <span className="mt-0.5 block text-xs font-normal text-gray-500">
                              Includes window blur
                            </span>
                          )}
                          {maxLeaveCount.trim() && (
                            <span className="mt-0.5 block text-xs font-normal text-gray-500">
                              Auto-submit after {maxLeaveCount} leaves
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    {requireFullscreen && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Fullscreen</dt>
                        <dd className="font-medium text-canvas-grayDark">Required</dd>
                      </div>
                    )}
                    {idleTimeoutMinutes.trim() && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Idle timeout</dt>
                        <dd className="font-medium text-canvas-grayDark">
                          {idleTimeoutMinutes} min
                        </dd>
                      </div>
                    )}
                    {softDisablePaste && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Paste</dt>
                        <dd className="font-medium text-canvas-grayDark">Soft-disabled</dd>
                      </div>
                    )}
                    {requireViewAllQuestions && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">View all</dt>
                        <dd className="font-medium text-canvas-grayDark">Required</dd>
                      </div>
                    )}
                    {collectSeatNumber && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Seat number</dt>
                        <dd className="font-medium text-canvas-grayDark">
                          {requireSeatNumber ? "Required" : "Optional"}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Type</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {QUIZ_TYPE_LABELS[quizType]}
                      </dd>
                    </div>
                    {accessCode.trim() && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Access code</dt>
                        <dd className="font-medium text-canvas-grayDark">Set</dd>
                      </div>
                    )}
                    {(shuffleAnswers || shuffleQuestions) && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Shuffle</dt>
                        <dd className="text-right font-medium text-canvas-grayDark">
                          {[
                            shuffleAnswers ? "Answers" : null,
                            shuffleQuestions ? "Questions" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </dd>
                      </div>
                    )}
                    {allowMultipleAttempts && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-gray-500">Score kept</dt>
                        <dd className="text-right font-medium text-canvas-grayDark">
                          {QUIZ_SCORING_POLICY_LABELS[scoringPolicy]}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <button
                    type="button"
                    onClick={() => setActiveTab("questions")}
                    className="btn-canvas-secondary mt-4 w-full text-sm"
                  >
                    Edit questions
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {publishChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="paper-grain w-full max-w-lg bg-arc-paper p-6 shadow-lift ring-1 ring-arc-ink/10">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Icon name="warning" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-canvas-grayDark">
                  Before you publish
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Review these items. Errors must be fixed; warnings can be ignored.
                </p>
                <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
                  {publishChecklist.map((item) => (
                    <li
                      key={item.id}
                      className={
                        item.severity === "error"
                          ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800"
                          : "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900"
                      }
                    >
                      <span className="font-medium uppercase tracking-wide text-[10px]">
                        {item.severity}
                      </span>
                      <p className="mt-0.5">{item.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPublishChecklist(null)}
                className="btn-canvas-secondary"
              >
                Cancel
              </button>
              {publishChecklist.some((i) => i.severity === "error") ? (
                <button
                  type="button"
                  onClick={() => setPublishChecklist(null)}
                  className="btn-canvas-primary"
                >
                  Fix errors
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmPublishFromChecklist}
                  className="btn-canvas-primary"
                >
                  Publish anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="paper-grain w-full max-w-md bg-arc-paper p-6 shadow-lift ring-1 ring-arc-ink/10">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Icon name="warning" size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-canvas-grayDark">
                  {contentChanged ? "Update student attempts?" : "Regrade existing attempts?"}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {contentChanged
                    ? `You changed quiz content and ${existingAttemptCount} attempt${existingAttemptCount === 1 ? " has" : "s have"} already been submitted. Regrade recalculates auto scores (keeps fudge and GradePro overrides). Reset discards attempts so students can retake.`
                    : `You changed scoring settings (partial credit) and ${existingAttemptCount} attempt${existingAttemptCount === 1 ? " has" : "s have"} already been submitted. Regrade applies the new rules without wiping attempts.`}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="btn-canvas-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmSave("keep")}
                className="btn-canvas-secondary"
              >
                Keep attempts
              </button>
              <button
                type="button"
                onClick={() => confirmSave("regrade")}
                className="btn-canvas-primary"
              >
                Regrade attempts
              </button>
              <button
                type="button"
                onClick={() => confirmSave("regrade-clear")}
                className="btn-canvas-secondary"
                title="Recalculate auto scores and remove GradePro per-question / manual overrides (keeps fudge)"
              >
                Regrade &amp; clear overrides
              </button>
              <button
                type="button"
                onClick={() => confirmSave("reset")}
                className="rounded-md bg-canvas-red px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reset all attempts
              </button>
            </div>
          </div>
        </div>
      )}
      {settingsDiff && (
        <CanvasModal
          title="Settings changes"
          onClose={() => {
            setSettingsDiff(null);
            setPendingSettingsAction(null);
          }}
          size="lg"
        >
          <p className="mb-3 text-sm text-gray-600">
            Review setting changes before saving ({settingsDiff.length} change
            {settingsDiff.length === 1 ? "" : "s"}).
          </p>
          <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {settingsDiff.map((line) => (
              <li key={line.key} className="rounded-md border border-gray-200 px-3 py-2.5">
                <span className="font-medium text-canvas-grayDark">{line.label}</span>
                <div className="mt-1.5 grid gap-1 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-gray-400">Was</span>
                    <p className="break-words text-gray-600">{line.before}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Will be</span>
                    <p className="break-words font-medium text-canvas-grayDark">{line.after}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSettingsDiff(null);
                setPendingSettingsAction(null);
              }}
              className="btn-canvas-secondary"
            >
              Cancel
            </button>
            <button type="button" onClick={confirmSettingsDiffSave} className="btn-canvas-primary">
              Save changes
            </button>
          </div>
        </CanvasModal>
      )}
    </div>
  );
}
