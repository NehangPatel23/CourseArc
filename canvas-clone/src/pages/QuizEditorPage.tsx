import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import DateTimeField from "../components/DateTimeField";
import QuizQuestionsEditor from "../components/QuizQuestionsEditor";
import RichContentEditor from "../components/RichContentEditor";
import { useStudentView } from "../hooks/useStudentView";
import {
  loadQuizzes,
  normalizeQuizQuestions,
  QUIZ_SCORING_POLICY_LABELS,
  saveQuizzes,
  totalQuizQuestionPoints,
  type Quiz,
  type QuizQuestion,
  type QuizScoringPolicy,
  uid,
} from "../utils/quizzes";
import { clearQuizAttempts, getAttemptsForQuiz } from "../utils/quizSubmissions";

type EditorTab = "details" | "questions";

export default function QuizEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, quizId } = useParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);

  const fromState = (location.state as { from?: string } | null)?.from;
  const backTo = fromState ?? `/courses/${effectiveCourseId}/quizzes`;

  // After saving, return to the quiz viewer (unless we came from elsewhere,
  // e.g. a module, in which case honor that origin).
  const afterSave = (id: string) =>
    navigate(fromState ?? `/courses/${effectiveCourseId}/quizzes/${id}`);

  useEffect(() => {
    if (studentView) navigate(backTo, { replace: true });
  }, [studentView, navigate, backTo]);

  const all = useMemo(() => loadQuizzes(effectiveCourseId), [effectiveCourseId]);
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
  const [points, setPoints] = useState(existing?.points?.toString() ?? "");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    existing?.timeLimitMinutes?.toString() ?? "",
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    normalizeQuizQuestions(existing?.questions),
  );
  const [publishAt, setPublishAt] = useState<number | undefined>(existing?.publishAt);
  const [availableFrom, setAvailableFrom] = useState<number | undefined>(existing?.availableFrom);
  const [availableUntil, setAvailableUntil] = useState<number | undefined>(existing?.availableUntil);
  const [shuffleAnswers, setShuffleAnswers] = useState(existing?.shuffleAnswers ?? true);
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

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setDueAt(existing?.dueAt);
    setPoints(existing?.points?.toString() ?? "");
    setTimeLimitMinutes(existing?.timeLimitMinutes?.toString() ?? "");
    setQuestions(normalizeQuizQuestions(existing?.questions));
    setPublishAt(existing?.publishAt);
    setAvailableFrom(existing?.availableFrom);
    setAvailableUntil(existing?.availableUntil);
    setShuffleAnswers(existing?.shuffleAnswers ?? true);
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
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const questionPointsTotal = totalQuizQuestionPoints(questions);
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
    const before = JSON.stringify(normalizeQuizQuestions(existing.questions));
    const after = JSON.stringify(questions);
    return before !== after;
  }, [existing, questions]);

  // Pending save while the reset-attempts confirmation modal is open.
  const [pendingAction, setPendingAction] = useState<null | "draft" | "publish">(null);

  const runAction = (action: "draft" | "publish") =>
    action === "draft" ? onSaveDraft() : onPublish();

  const requestSave = (action: "draft" | "publish") => {
    if (existingAttemptCount > 0 && contentChanged) {
      setPendingAction(action);
      return;
    }
    runAction(action);
  };

  const confirmSave = (resetAttempts: boolean) => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    if (resetAttempts && quizId) clearQuizAttempts(effectiveCourseId, quizId);
    runAction(action);
  };

  const upsert = (patch: Partial<Quiz> & Pick<Quiz, "id">) => {
    const next = [...all];
    const idx = next.findIndex((x) => x.id === patch.id);
    const now = Date.now();
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...patch, updatedAt: now };
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
        shuffleAnswers: patch.shuffleAnswers,
        allowMultipleAttempts: patch.allowMultipleAttempts,
        allowedAttempts: patch.allowedAttempts,
        scoringPolicy: patch.scoringPolicy,
        letStudentsSeeResponses: patch.letStudentsSeeResponses,
        showResponsesOnlyOnce: patch.showResponsesOnlyOnce,
        showCorrectAnswers: patch.showCorrectAnswers,
        showCorrectAnswersAt: patch.showCorrectAnswersAt,
        hideCorrectAnswersAt: patch.hideCorrectAnswersAt,
        createdAt: now,
        updatedAt: now,
      });
    }
    saveQuizzes(effectiveCourseId, next);
  };

  const buildPatch = (status: "draft" | "published", published: boolean): Partial<Quiz> => {
    const questionPoints = totalQuizQuestionPoints(questions);
    const resolvedPoints = points ? Number(points) : questionPoints > 0 ? questionPoints : undefined;

    return {
      title: title.trim(),
      description: description.trim() || undefined,
      dueAt,
      points: resolvedPoints,
      status,
      published,
      publishAt: status === "draft" ? publishAt : undefined,
      availableFrom,
      availableUntil,
      timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : undefined,
      questions,
      questionCount: questions.length,
      shuffleAnswers,
      allowMultipleAttempts,
      allowedAttempts: !allowMultipleAttempts
        ? 1
        : unlimitedAttempts
          ? undefined
          : Number(allowedAttempts) || undefined,
      scoringPolicy: allowMultipleAttempts ? scoringPolicy : undefined,
      letStudentsSeeResponses,
      showResponsesOnlyOnce: letStudentsSeeResponses ? showResponsesOnlyOnce : false,
      showCorrectAnswers,
      showCorrectAnswersAt: showCorrectAnswers ? showCorrectAnswersAt : undefined,
      hideCorrectAnswersAt: showCorrectAnswers ? hideCorrectAnswersAt : undefined,
    };
  };

  const onSaveDraft = () => {
    if (!canSave || hasWindowError) return;
    const id = isNew ? uid("quiz") : existing?.id;
    if (isNew) {
      upsert({ id: id as string, ...buildPatch("draft", false) });
    } else if (existing) {
      upsert({ id: existing.id, ...buildPatch("draft", false) });
    }
    if (id) afterSave(id);
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
      afterSave(id);
      return;
    }

    if (!existing) return navigate(backTo);

    if (shouldSchedule) {
      upsert({ id: existing.id, ...buildPatch("draft", false), publishAt });
    } else {
      upsert({ id: existing.id, ...buildPatch("published", true), publishAt: undefined });
    }
    afterSave(existing.id);
  };

  const tabs: { id: EditorTab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "questions", label: `Questions${questions.length ? ` (${questions.length})` : ""}` },
  ];

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8 text-canvas-grayDark">
        <div className="w-full">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-gray-500" />
            <h1 className="text-2xl font-semibold text-canvas-grayDark">
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

          {existingAttemptCount > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {existingAttemptCount} student attempt
                {existingAttemptCount === 1 ? " has" : "s have"} already been made on this quiz.
                Editing questions or answers may make existing scores inaccurate — you'll be asked
                whether to reset attempts when you save.
              </p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-xl border border-canvas-border bg-white p-5 shadow-sm">
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
                      {questionPointsTotal > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          Question total: {questionPointsTotal} pts
                        </p>
                      )}
                    </div>
                  </div>

                  <RichContentEditor
                    label="Description"
                    value={existing?.description ?? ""}
                    onChange={setDescription}
                    height={360}
                    courseId={effectiveCourseId}
                    mountKey={quizId ?? "new-quiz"}
                  />

                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="form-section-title">Quiz settings</div>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      </div>
                    </div>
                    <label className="form-checkbox-label mt-3">
                      <input
                        type="checkbox"
                        checked={shuffleAnswers}
                        onChange={(e) => setShuffleAnswers(e.target.checked)}
                      />
                      Shuffle answers
                    </label>
                    <label className="form-checkbox-label mt-2">
                      <input
                        type="checkbox"
                        checked={allowMultipleAttempts}
                        onChange={(e) => setAllowMultipleAttempts(e.target.checked)}
                      />
                      Allow multiple attempts
                    </label>
                    {allowMultipleAttempts && (
                      <>
                        <label className="form-checkbox-label mt-2">
                          <input
                            type="checkbox"
                            checked={unlimitedAttempts}
                            onChange={(e) => setUnlimitedAttempts(e.target.checked)}
                          />
                          Allow unlimited attempts
                        </label>
                        {!unlimitedAttempts && (
                          <div className="mt-3 max-w-xs">
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
                        <div className="mt-3 max-w-xs">
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
                          <p className="mt-1 text-xs text-gray-500">
                            Which attempt counts toward the student's grade.
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                    <div className="form-section-title">Publishing & availability</div>
                    <DateTimeField
                      label="Publish later"
                      value={publishAt}
                      onChange={setPublishAt}
                      disabled={isPublished}
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  </div>

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
                    <p className="text-xs text-gray-500">
                      Controls what students see after submitting. Instructors always see full
                      results in preview and GradePro.
                    </p>
                  </div>
                </>
              ) : (
                <QuizQuestionsEditor questions={questions} onChange={setQuestions} />
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
                <div className="rounded-xl border border-canvas-border bg-white p-5 shadow-sm">
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
                      <dd className="font-medium text-canvas-grayDark">{questions.length}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Points</dt>
                      <dd className="font-medium text-canvas-grayDark">
                        {points !== "" ? points : questionPointsTotal || "—"}
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

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-canvas-grayDark">
                  Reset student attempts?
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  You changed the quiz content and {existingAttemptCount} attempt
                  {existingAttemptCount === 1 ? " has" : "s have"} already been submitted. You can
                  discard those attempts so students can retake the quiz, or keep them (existing
                  scores may no longer match the new questions).
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="btn-canvas-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmSave(false)}
                className="btn-canvas-secondary"
              >
                Keep attempts
              </button>
              <button
                type="button"
                onClick={() => confirmSave(true)}
                className="rounded-md bg-canvas-red px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reset all attempts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
