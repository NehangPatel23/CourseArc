import { useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { useParams } from "react-router-dom";
import Icon from "../icons/Icon";
import {
  CODE_SNIPPETS,
  codingUsesTestRunner,
  combineCodeFiles,
  formatPoints,
  isCodeRunnerLanguage,
  isHtmlCssRunnerLanguage,
  isRemoteCodeRunnerLanguage,
  type CodeFile,
  type QuizQuestion,
} from "../utils/quizzes";
import type { QuizAnswer } from "../utils/quizSubmissions";
import {
  buildHtmlCssSrcdoc,
  runCodeTests,
  type CodeTestRunResult,
} from "../utils/codeRunner";
import { useToast } from "./ui/Toast";
import CodeRunnerErrorBoundary from "./CodeRunnerErrorBoundary";
import QuizCodeEditor from "./QuizCodeEditor";
import { useQuizT } from "../utils/quizI18n";
import QuizPrompt from "./QuizPrompt";
import FileUploadAnswer from "./FileUploadAnswer";
import RichPromptField from "./RichPromptField";
import { EssayCommentInput, QuizPhase7Inputs } from "./QuizPhase7Inputs";
import { quizFileStorageKey } from "../utils/quizFileAnswers";
import { loadUser } from "../utils/userStore";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";

function prismLang(language: string | undefined): string {
  if (language === "cpp") return "cpp";
  if (language === "html") return "markup";
  if (language === "c") return "c";
  return language ?? "javascript";
}

function highlightCode(code: string, language: string | undefined): string {
  try {
    const lang = prismLang(language);
    const grammar = Prism.languages[lang];
    if (!grammar) return code;
    return Prism.highlight(code, grammar, lang);
  } catch {
    return code;
  }
}

const FEEDBACK_SECTION =
  /^(Answer|Why|Common mistake|Takeaway|Expected|Correct|Accepted):\s*(.*)$/i;

function normalizeFeedbackTitle(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (key === "answer" || key === "correct" || key === "expected" || key === "accepted") {
    return "Answer";
  }
  if (key === "why") return "Why";
  if (key === "common mistake") return "Common mistake";
  if (key === "takeaway") return "Takeaway";
  return raw.trim();
}

function parseFeedbackSections(text: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = [];
  let current: { title: string; body: string } | null = null;

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const match = FEEDBACK_SECTION.exec(line.trim());
    if (match) {
      if (current && (current.body.trim() || current.title)) sections.push(current);
      current = {
        title: normalizeFeedbackTitle(match[1]),
        body: match[2] ?? "",
      };
      continue;
    }
    if (!current) {
      if (line.trim()) current = { title: "Feedback", body: line };
      continue;
    }
    current.body = current.body ? `${current.body}\n${line}` : line;
  }
  if (current) sections.push(current);
  return sections
    .map((s) => ({ title: s.title, body: s.body.trim() }))
    .filter((s) => s.body || s.title === "Answer");
}

function QuestionFeedbackPanel({
  feedback,
  tone = "neutral",
}: {
  feedback: string;
  tone?: "correct" | "incorrect" | "neutral";
}) {
  const sections = parseFeedbackSections(feedback);
  if (sections.length === 0) return null;

  const hasStructured = sections.some((s) =>
    ["Answer", "Why", "Common mistake", "Takeaway"].includes(s.title),
  );

  const shell =
    tone === "correct"
      ? "border-green-300 bg-green-50/80"
      : tone === "incorrect"
        ? "border-red-200 bg-red-50/70"
        : "border-canvas-blue/25 bg-canvas-blueTint/80";
  const header =
    tone === "correct"
      ? "border-green-200 text-green-800"
      : tone === "incorrect"
        ? "border-red-200 text-red-800"
        : "border-canvas-blue/20 text-canvas-blueDark";
  const label =
    tone === "correct"
      ? "Correct feedback"
      : tone === "incorrect"
        ? "Incorrect feedback"
        : "Feedback";

  return (
    <div className={`mt-5 overflow-hidden rounded-lg border ${shell}`}>
      <div className={`border-b px-4 py-2.5 ${header}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <div className="space-y-4 px-4 py-4">
        {hasStructured ? (
          sections.map((section, i) => (
            <div key={`${section.title}-${i}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-canvas-blue">
                {section.title}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-canvas-grayDark">
                {section.body}
              </p>
            </div>
          ))
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-canvas-grayDark">
            {feedback.trim()}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Renders a single quiz question. Used both when taking a quiz (interactive) and
 * in review/grading contexts (disabled, with correct/incorrect highlighting).
 *
 * - `review` present => show correct/incorrect badge and mark the student's picks.
 * - `revealKey` => additionally reveal the answer key (correct option/values).
 * - `unanswered` => slate highlight + badge (distinct from incorrect).
 */
export default function QuizQuestionCard({
  question,
  index,
  answer,
  onChange,
  disabled,
  review,
  revealKey = true,
  markedForReview = false,
  onToggleMarkForReview,
  label,
  unanswered = false,
  scoreDraft,
  onScoreChange,
  gradingQuestion,
  softDisablePaste = false,
  attemptSeed,
  requireEssayComment = false,
  useMonacoEditor = false,
}: {
  question: QuizQuestion;
  index: number;
  answer?: QuizAnswer;
  onChange: (next: QuizAnswer) => void;
  disabled: boolean;
  review?: {
    correct: boolean;
    partial?: boolean;
    earned?: number;
    possible?: number;
    /** Student-facing explanation of how partial credit was calculated. */
    partialNote?: string;
  };
  revealKey?: boolean;
  markedForReview?: boolean;
  onToggleMarkForReview?: () => void;
  /** Override header label (e.g. "Note" or "Question 3"). */
  label?: string;
  /** Emphasize that the student left this question blank (distinct from incorrect). */
  unanswered?: boolean;
  /** When set with onScoreChange, shows an inline editable score in the header. */
  scoreDraft?: string;
  onScoreChange?: (value: string) => void;
  /**
   * Full question used for Run tests / grading when `question` is sanitized
   * (e.g. HTML/CSS answer keys stripped for students).
   */
  gradingQuestion?: QuizQuestion;
  /** Soft-block paste on essay/coding (toast; not a hard lock). */
  softDisablePaste?: boolean;
  /** Stable seed for calculated-question variable generation. */
  attemptSeed?: string;
  /** Require essay reflection comment (#85). */
  requireEssayComment?: boolean;
  /** Monaco code editor for coding fields (#31). */
  useMonacoEditor?: boolean;
}) {
  const { showToast } = useToast();
  const t = useQuizT();
  const { courseId: routeCourseId, quizId: routeQuizId } = useParams();
  const courseId = routeCourseId ?? "1";
  const quizId = routeQuizId ?? "preview";
  const onPasteCapture = (e: ClipboardEvent) => {
    if (!softDisablePaste || disabled) return;
    e.preventDefault();
    showToast("Paste is disabled for this quiz", "neutral", "errors");
  };
  const [runResults, setRunResults] = useState<CodeTestRunResult[] | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runProgress, setRunProgress] = useState<string | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [stderrOpen, setStderrOpen] = useState<Record<string, boolean>>({});
  const [fileTab, setFileTab] = useState(0);

  const runTestsSource = gradingQuestion ?? question;
  const multiFiles = (question.codeFiles?.length ?? 0) > 1 ? question.codeFiles! : null;

  // Prefill coding answers with starter so Monaco / Run tests see real content (not only a placeholder).
  useEffect(() => {
    if (disabled || review) return;
    if (question.type !== "coding" && question.type !== "inline_code") return;
    if (multiFiles) return;
    if (typeof answer?.shortAnswer === "string") return;
    const starter = question.starterCode ?? "";
    if (!starter) return;
    onChange({ questionId: question.id, shortAnswer: starter });
    // Parent onChange (setState) is often an unstable identity — seed once per question/answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit onChange
  }, [
    disabled,
    review,
    question.id,
    question.type,
    question.starterCode,
    multiFiles,
    answer?.shortAnswer,
  ]);

  const workingFiles: CodeFile[] | null = useMemo(() => {
    if (!multiFiles) return null;
    const raw = answer?.shortAnswer ?? "";
    try {
      const parsed = JSON.parse(raw) as { __cc_files__?: CodeFile[] };
      if (parsed?.__cc_files__?.length) return parsed.__cc_files__;
    } catch {
      /* single string → put in main */
    }
    return multiFiles.map((f, i) => ({
      ...f,
      content: i === 0 && raw && !raw.trimStart().startsWith("{") ? raw : f.content,
    }));
  }, [multiFiles, answer?.shortAnswer]);

  const isNetworkError = (msg: string) =>
    /failed to fetch|networkerror|network error|load failed|err_network|offline|wandbox unavailable/i.test(
      msg,
    );

  const handleRunTests = async () => {
    setRunBusy(true);
    setRunError(null);
    setRunProgress(null);
    try {
      const code = workingFiles
        ? combineCodeFiles(workingFiles)
        : (answer?.shortAnswer ?? "");
      const results = await runCodeTests({
        language: runTestsSource.language,
        code,
        tests: runTestsSource.codeTests ?? [],
        timeoutMs: runTestsSource.codeTimeoutMs,
        files: workingFiles ?? runTestsSource.codeFiles,
        sqlSetup: runTestsSource.sqlSetup,
        tsTranspileMode: runTestsSource.tsTranspileMode,
        onProgress: (m) => setRunProgress(m),
      });
      setRunResults(results);
      onChange({
        questionId: question.id,
        shortAnswer: workingFiles
          ? JSON.stringify({ __cc_files__: workingFiles })
          : code,
        codeTestResults: results,
      });
    } catch (e) {
      setRunResults(null);
      const raw = e instanceof Error ? e.message : "Failed to run tests";
      setRunError(
        isNetworkError(raw)
          ? typeof navigator !== "undefined" && navigator.onLine === false
            ? "Offline — reconnect and retry (Wandbox languages need network)"
            : "Network error — check connection and retry"
          : raw,
      );
    } finally {
      setRunBusy(false);
      setRunProgress(null);
    }
  };

  const setCodeValue = (nextCode: string) => {
    onChange({ questionId: question.id, shortAnswer: nextCode });
    setRunResults(null);
  };

  const setWorkingFileContent = (index: number, content: string) => {
    if (!workingFiles) return;
    const next = workingFiles.map((f, i) => (i === index ? { ...f, content } : f));
    onChange({
      questionId: question.id,
      shortAnswer: JSON.stringify({ __cc_files__: next }),
    });
    setRunResults(null);
  };

  const choices = question.choices ?? [];
  const isNote = question.type === "note" || question.type === "group";
  const headerLabel =
    label ??
    (question.type === "group"
      ? "Question group"
      : question.type === "note"
        ? "Note"
        : `Question ${index + 1}`);
  const borderClass = isNote
    ? "border-amber-200"
    : unanswered
      ? "border-slate-400"
      : review
    ? review.correct
      ? "border-green-300"
          : review.partial
            ? "border-amber-300"
      : "border-red-300"
    : markedForReview
      ? "border-amber-300"
      : "border-arc-line";
  const showMarkToggle = Boolean(onToggleMarkForReview) && !disabled && !review && !isNote;

  const reviewFeedback = (() => {
    if (!review || !revealKey) return null;
    if (unanswered) {
      const text =
        question.feedback?.trim() ||
        question.correctFeedback?.trim() ||
        question.incorrectFeedback?.trim();
      return text ? { text, tone: "neutral" as const } : null;
    }
    if (review.correct) {
      const text = question.correctFeedback?.trim() || question.feedback?.trim();
      return text ? { text, tone: "correct" as const } : null;
    }
    const text = question.incorrectFeedback?.trim() || question.feedback?.trim();
    return text ? { text, tone: "incorrect" as const } : null;
  })();

  if (isNote) {
  return (
      <div className={`rounded-lg border bg-amber-50/60 text-arc-ink shadow-sm ${borderClass}`} onPasteCapture={onPasteCapture}>
        <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Icon name="help" size={16} className="text-amber-700" />
            {headerLabel}
          </span>
          <span className="text-xs text-amber-700/80">Not scored</span>
        </div>
        <div className="px-5 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-canvas-grayDark">
            {question.prompt || (
              <span className="italic text-gray-400">
                {question.type === "group" ? "Empty question group" : "Empty note"}
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border bg-arc-ivory text-arc-ink shadow-sm ${borderClass}`}
      onPasteCapture={onPasteCapture}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 ${
          unanswered ? "border-arc-ink/15 bg-arc-paper/80" : "border-arc-ink/10 bg-arc-paper/60"
        }`}
      >
        <span className="min-w-0 text-sm font-semibold text-canvas-grayDark">{headerLabel}</span>
        <div className="flex shrink-0 items-center gap-2">
          {showMarkToggle && (
            <button
              type="button"
              onClick={onToggleMarkForReview}
              aria-pressed={markedForReview}
              title={
                markedForReview
                  ? "Marked for review — click to unmark"
                  : "Mark this question for review"
              }
              className={`inline-flex items-center justify-center rounded-md border p-1.5 transition-colors ${
                markedForReview
                  ? "border-amber-300 bg-amber-50 text-amber-600"
                  : "border-gray-300 bg-arc-paper text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              <Icon name="pin" size={16} className={`${markedForReview ? "fill-amber-400" : ""}`} />
              <span className="sr-only">
                {markedForReview ? "Marked for review" : "Mark for review"}
              </span>
            </button>
          )}
          {unanswered ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-200/90 px-2.5 py-1 text-xs font-semibold text-slate-700">
              <Icon name="circle" size={14} />
              Unanswered
              </span>
          ) : review ? (
            <QuestionResultBadge
              correct={review.correct}
              partial={review.partial}
              earned={
                typeof review.earned === "number"
                  ? review.earned
                  : scoreDraft != null && Number.isFinite(Number(scoreDraft))
                    ? Number(scoreDraft)
                    : undefined
              }
              possible={review.possible ?? (question.points > 0 ? question.points : undefined)}
              scoreDraft={scoreDraft}
              onScoreChange={onScoreChange}
            />
          ) : (
            <span className="rounded-full bg-arc-paper px-2.5 py-1 text-xs font-medium tabular-nums text-arc-mute">
              {formatPoints(question.points)}{" "}
              {Math.abs(question.points - 1) < 1e-9 ? "pt" : "pts"}
              </span>
          )}
        </div>
      </div>
      <div className="px-5 py-5">
        {question.type !== "calculated" && question.type !== "fill_in_multiple_blanks" && (
          <QuizPrompt text={question.prompt} />
        )}

        <QuizPhase7Inputs
          question={question}
          answer={answer}
          disabled={disabled}
          review={Boolean(review)}
          revealKey={revealKey}
          attemptSeed={attemptSeed}
          onChange={onChange}
        />

        {question.type === "multiple_choice" && (
          <div className="mt-5 space-y-2.5">
            {choices.map((choice, choiceIndex) => {
              const selected = answer?.choiceIndex === choiceIndex;
              const hasKey = typeof question.correctChoiceIndex === "number";
              const isKey = review && revealKey && hasKey && question.correctChoiceIndex === choiceIndex;
              const wrongPick =
                review && selected && hasKey && question.correctChoiceIndex !== choiceIndex;
              return (
                <label
                  key={choiceIndex}
                  className={`flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm transition ${
                    disabled ? "cursor-default" : "cursor-pointer hover:bg-gray-50"
                  } ${
                    isKey
                      ? "border-green-300 bg-green-50"
                      : wrongPick
                        ? "border-red-300 bg-red-50"
                        : selected
                          ? "border-canvas-blue bg-canvas-blueTint"
                          : "border-arc-ink/10"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange({ questionId: question.id, choiceIndex })}
                    className="accent-canvas-blue"
                  />
                  <span className="text-canvas-grayDark">
                    {choice || <span className="italic text-gray-400">Empty choice</span>}
                  </span>
                  {isKey && (
                    <Icon name="checkCircle" size={16} className="quiz-key-mark text-green-600" />
                  )}
                  {wrongPick && <Icon name="close" size={16} className="text-red-600" />}
                </label>
              );
            })}
            {review &&
              revealKey &&
              choices.map((_choice, choiceIndex) => {
                const fb = question.choiceFeedbacks?.[choiceIndex]?.trim();
                if (!fb || answer?.choiceIndex !== choiceIndex) return null;
                return (
                  <p key={`mc-fb-${choiceIndex}`} className="text-xs text-gray-600">
                    <span className="font-medium">Choice feedback:</span> {fb}
                  </p>
                );
              })}
          </div>
        )}

        {question.type === "true_false" && (
          <div className="mt-5 space-y-2.5">
            {(question.trueFalseOrder ?? [true, false]).map((val) => {
              const selected = answer?.trueFalse === val;
              const hasKey = typeof question.correctTrueFalse === "boolean";
              const isKey = review && revealKey && hasKey && question.correctTrueFalse === val;
              const wrongPick = review && selected && hasKey && question.correctTrueFalse !== val;
              return (
                <label
                  key={String(val)}
                  className={`flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm transition ${
                    disabled ? "cursor-default" : "cursor-pointer hover:bg-gray-50"
                  } ${
                    isKey
                      ? "border-green-300 bg-green-50"
                      : wrongPick
                        ? "border-red-300 bg-red-50"
                        : selected
                          ? "border-canvas-blue bg-canvas-blueTint"
                          : "border-arc-ink/10"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange({ questionId: question.id, trueFalse: val })}
                    className="accent-canvas-blue"
                  />
                  <span className="text-canvas-grayDark">{val ? "True" : "False"}</span>
                  {isKey && (
                    <Icon name="checkCircle" size={16} className="quiz-key-mark text-green-600" />
                  )}
                  {wrongPick && <Icon name="close" size={16} className="text-red-600" />}
                </label>
              );
            })}
          </div>
        )}

        {question.type === "multiple_answers" && (
          <div className="mt-5 space-y-2.5">
            {!review && (
              <p className="mb-1 text-xs text-gray-500">Select all that apply.</p>
            )}
            {choices.map((choice, choiceIndex) => {
              const picked = (answer?.choiceIndices ?? []).includes(choiceIndex);
              const keyIndices = question.correctChoiceIndices;
              const hasKey = Array.isArray(keyIndices);
              const inKey = hasKey && keyIndices.includes(choiceIndex);
              const isKey = review && revealKey && inKey;
              const wrongPick = review && picked && hasKey && !inKey;
              return (
                <label
                  key={choiceIndex}
                  className={`flex items-center gap-3 rounded-md border px-4 py-2.5 text-sm transition ${
                    disabled ? "cursor-default" : "cursor-pointer hover:bg-gray-50"
                  } ${
                    isKey
                      ? "border-green-300 bg-green-50"
                      : wrongPick
                        ? "border-red-300 bg-red-50"
                        : picked
                          ? "border-canvas-blue bg-canvas-blueTint"
                          : "border-arc-ink/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={picked}
                    disabled={disabled}
                    onChange={() => {
                      const set = new Set(answer?.choiceIndices ?? []);
                      if (set.has(choiceIndex)) set.delete(choiceIndex);
                      else set.add(choiceIndex);
                      onChange({
                        questionId: question.id,
                        choiceIndices: [...set].sort((a, b) => a - b),
                      });
                    }}
                    className="accent-canvas-blue"
                  />
                  <span className="text-canvas-grayDark">
                    {choice || <span className="italic text-gray-400">Empty choice</span>}
                  </span>
                  {isKey && (
                    <Icon name="checkCircle" size={16} className="quiz-key-mark text-green-600" />
                  )}
                  {wrongPick && <Icon name="close" size={16} className="text-red-600" />}
                </label>
              );
            })}
          </div>
        )}

        {question.type === "short_answer" && (
          <div className="mt-4">
            <input
              value={answer?.shortAnswer ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ questionId: question.id, shortAnswer: e.target.value })}
              placeholder="Type your answer"
              className="form-input disabled:bg-gray-50"
            />
            {review && revealKey && question.correctShortAnswer && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">Expected answer:</span> {question.correctShortAnswer}
              </p>
            )}
          </div>
        )}

        {question.type === "fill_in_blank" && (
          <div className="mt-4">
            <input
              value={answer?.shortAnswer ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ questionId: question.id, shortAnswer: e.target.value })}
              placeholder="Type your answer"
              className="form-input disabled:bg-gray-50"
            />
            {review && revealKey && (question.acceptedAnswers ?? []).some((a) => a.trim()) && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">Accepted:</span>{" "}
                {(question.acceptedAnswers ?? []).filter((a) => a.trim()).join(", ")}
              </p>
            )}
          </div>
        )}

        {question.type === "numerical" && (
          <div className="mt-4">
            <input
              type="number"
              value={answer?.number ?? ""}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  questionId: question.id,
                  number: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="Enter a number"
              className="form-input max-w-xs disabled:bg-gray-50"
            />
            {review && revealKey && typeof question.correctNumber === "number" && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">Correct value:</span> {question.correctNumber}
                {question.tolerance ? ` (± ${question.tolerance})` : ""}
              </p>
            )}
          </div>
        )}

        {question.type === "matching" && (
          <div className="mt-5 space-y-2.5">
            {(() => {
              const rightOptions =
                question.matchingRightOrder && question.matchingRightOrder.length > 0
                  ? question.matchingRightOrder
                  : [
                ...new Set(
                  (question.matchingPairs ?? []).map((p) => p.right).filter(Boolean),
                ),
              ].sort();
              return (question.matchingPairs ?? []).map((pair) => {
                const chosen = answer?.matches?.[pair.id] ?? "";
                const correct = review
                  ? chosen.trim().toLowerCase() === pair.right.trim().toLowerCase()
                  : undefined;
                return (
                  <div key={pair.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm text-canvas-grayDark">
                      {pair.left}
                    </span>
                    <span className="text-gray-400">→</span>
                    <select
                      value={chosen}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange({
                          questionId: question.id,
                          matches: { ...(answer?.matches ?? {}), [pair.id]: e.target.value },
                        })
                      }
                      className={`form-input max-w-[45%] ${
                        review
                          ? correct
                            ? "border-green-300 bg-green-50"
                            : "border-red-300 bg-red-50"
                          : ""
                      }`}
                    >
                      <option value="">Select…</option>
                      {rightOptions.map((r, i) => (
                        <option key={i} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {review &&
                      (correct ? (
                        <Icon name="checkCircle" size={16} className="text-green-600" />
                      ) : (
                        <Icon name="close" size={16} className="text-red-600" />
                      ))}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {question.type === "essay" && (
          <div className="mt-4">
            <RichPromptField
              value={answer?.shortAnswer ?? ""}
              onChange={(html) => onChange({ questionId: question.id, shortAnswer: html })}
              courseId={courseId}
              mountKey={`${question.id}-essay`}
              placeholder="Write your response — images allowed"
              height={200}
              disabled={disabled}
              alwaysEdit={!disabled}
            />
            {review && (
              <p className="mt-2 text-xs text-amber-600">
                This response will be graded manually.
              </p>
            )}
            <EssayCommentInput
              question={question}
              answer={answer}
              disabled={disabled}
              required={requireEssayComment || Boolean(question.requireEssayComment)}
              onChange={onChange}
            />
          </div>
        )}

        {question.type === "file_upload" && (
          <FileUploadAnswer
            question={question}
            answer={answer}
            onChange={onChange}
            disabled={disabled}
            review={Boolean(review)}
            storageKey={quizFileStorageKey({
              courseId,
              quizId,
              studentId: loadUser().id,
              questionId: question.id,
            })}
          />
        )}

        {(question.type === "inline_code" || question.type === "coding") && (
          <div className="mt-4">
            {(() => {
              const studentStored = answer?.shortAnswer;
              const starter = question.starterCode ?? "";
              const studentCode =
                typeof studentStored === "string" ? studentStored : starter;
              const sampleCode =
                question.type === "coding"
                  ? (question.correctCode ?? "").trim()
                  : (
                      (question.acceptedAnswers ?? []).find((a) => a.trim()) ?? ""
                    ).trim();
              const showSampleInBox = Boolean(
                review && revealKey && !(studentStored ?? "").trim(),
              );
              const displayCode = showSampleInBox
                ? sampleCode
                : workingFiles
                  ? workingFiles[Math.min(fileTab, workingFiles.length - 1)]?.content ??
                    ""
                  : studentCode;
              const snippets =
                !disabled && !showSampleInBox && question.type === "coding"
                  ? CODE_SNIPPETS[question.language ?? "javascript"]
                  : undefined;
              const snippetActions =
                snippets && snippets.length > 0 ? (
                  <>
                    {snippets.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (workingFiles) {
                            const cur =
                              workingFiles[
                                Math.min(fileTab, workingFiles.length - 1)
                              ]?.content ?? "";
                            setWorkingFileContent(fileTab, `${cur}${s.insert}`);
                          } else {
                            const base =
                              typeof studentStored === "string" ? studentStored : starter;
                            setCodeValue(`${base}${s.insert}`);
                          }
                        }}
                        className="rounded border border-slate-600/30 bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-arc-ivory disabled:opacity-50"
                      >
                        + {s.label}
                      </button>
                    ))}
                  </>
                ) : undefined;
              return (
                <>
                  {showSampleInBox && (
                    <p className="mb-1 text-xs font-semibold text-emerald-800">
                      Sample answer
                    </p>
                  )}
                  {workingFiles && !showSampleInBox && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {workingFiles.map((f, i) => (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => setFileTab(i)}
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            fileTab === i
                              ? "bg-canvas-blue text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {f.path}
                          {f.main ? " ★" : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {disabled || showSampleInBox ? (
                    <div className="overflow-hidden bg-arc-ivory ring-1 ring-arc-ink/10">
                      {question.language && (
                        <div className="border-b border-arc-ink/10 bg-arc-paper px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-arc-mute">
                          {question.language}
                          {question.type === "inline_code" && question.codeMaxLines
                            ? ` · up to ~${question.codeMaxLines} lines`
                            : ""}
                        </div>
                      )}
                      <pre
                        className={`min-h-[80px] overflow-x-auto whitespace-pre-wrap px-3 py-3 font-mono text-[13px] leading-relaxed ${
                          showSampleInBox && sampleCode
                            ? "bg-emerald-50/40"
                            : "bg-gray-50"
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: highlightCode(displayCode, question.language),
                        }}
                      />
                    </div>
                  ) : (
                    <QuizCodeEditor
                      value={displayCode}
                      onChange={(v) => {
                        if (showSampleInBox) return;
                        setRunResults(null);
                        setRunError(null);
                        setHtmlPreview(null);
                        if (workingFiles) {
                          setWorkingFileContent(fileTab, v);
                        } else {
                          onChange({
                            questionId: question.id,
                            shortAnswer: v,
                            codeTestResults: undefined,
                          });
                        }
                      }}
                      language={question.language}
                      disabled={disabled || showSampleInBox}
                      useMonaco={useMonacoEditor}
                      headerActions={snippetActions}
                      minHeight={
                        question.type === "coding"
                          ? Math.min(320, Math.max(200, (displayCode || "").split("\n").length * 20 + 48))
                          : 140
                      }
                      placeholder={
                        showSampleInBox
                          ? "No sample answer configured — add one in the question editor"
                          : "Write your code"
                      }
                    />
                  )}
                </>
              );
            })()}
            {question.type === "coding" &&
              codingUsesTestRunner(question) &&
              isCodeRunnerLanguage(question.language) && (
                <CodeRunnerErrorBoundary>
                <div className="mt-3 space-y-2">
                  {!review &&
                    question.language === "css" &&
                    (question.codeTests ?? []).some(
                      (t) =>
                        !t.hidden &&
                        t.expectedStdout.trim() &&
                        !t.expectedStdout.includes("{"),
                    ) && (
                      <div className="rounded-md border border-arc-ink/10 bg-arc-paper px-3 py-2 text-xs text-arc-ink">
                        <p className="font-semibold text-gray-600">Required properties</p>
                        <ul className="mt-1 space-y-1 font-mono">
                          {(question.codeTests ?? [])
                            .filter(
                              (t) =>
                                !t.hidden &&
                                t.expectedStdout.trim() &&
                                !t.expectedStdout.includes("{"),
                            )
                            .map((t) => (
                              <li key={t.id} className="whitespace-pre-wrap">
                                {t.expectedStdout.trim()}
                              </li>
                            ))}
                        </ul>
    </div>
                    )}
                  {!review && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={disabled || runBusy}
                        onClick={() => void handleRunTests()}
                        className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {runBusy ? (
                          <Icon name="rotate" size={14} className="animate-spin" />
                        ) : (
                          <Icon name="play" size={14} />
                        )}
                        {runBusy ? t("take.running") : t("take.runTests")}
                      </button>
                      {runProgress && (
                        <span className="text-xs text-canvas-blue">{runProgress}</span>
                      )}
                      <span className="text-xs text-gray-500">
                        {question.language === "python" ? (
                          <>
                            Read <code className="rounded bg-arc-paper px-1">stdin</code> /{" "}
                            <code className="rounded bg-arc-paper px-1">input()</code>; write with{" "}
                            <code className="rounded bg-arc-paper px-1">print</code>
                            {runBusy
                              ? " · loading Python (cached after first download)…"
                              : ""}
                          </>
                        ) : isHtmlCssRunnerLanguage(question.language) ? (
                          <>
                            Grades by normalized source
                            {question.language === "html" ? " or body text" : ""}
                            {" · "}
                            CSS may use{" "}
                            <code className="rounded bg-arc-paper px-1">
                              computed:#id prop:value
                            </code>
                          </>
                        ) : isRemoteCodeRunnerLanguage(question.language) ? (
                          <>
                            Runs on free{" "}
                            <a
                              href="https://wandbox.org/"
                              target="_blank"
                              rel="noreferrer"
                              className="text-canvas-blue hover:underline"
                            >
                              Wandbox
                            </a>{" "}
                            (needs network)
                            {question.language === "java"
                              ? " · use class Main (not public)"
                              : ""}
                            {typeof navigator !== "undefined" &&
                            navigator.onLine === false
                              ? " · currently offline"
                              : runBusy
                                ? " · contacting Wandbox…"
                                : ""}
                          </>
                        ) : (
                          <>
                            Read <code className="rounded bg-arc-paper px-1">stdin</code>; write
                            with <code className="rounded bg-arc-paper px-1">console.log</code>
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  {!review && isHtmlCssRunnerLanguage(question.language) && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const code = answer?.shortAnswer ?? "";
                          const scaffold =
                            question.codeTests?.[0]?.stdin ?? "";
                          const srcdoc = buildHtmlCssSrcdoc(
                            question.language === "css" ? "css" : "html",
                            code,
                            scaffold,
                          );
                          setHtmlPreview(srcdoc);
                        }}
                        className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        <Icon name="eye" size={14} />
                        Preview
                      </button>
                      {htmlPreview != null && (
                        <div className="overflow-hidden rounded-md border border-arc-ink/10 bg-arc-ivory">
                          <div className="flex items-center justify-between border-b border-arc-ink/10 bg-arc-paper px-2 py-1">
                            <span className="text-[11px] font-medium text-gray-500">
                              Sandboxed preview
                            </span>
                            <button
                              type="button"
                              onClick={() => setHtmlPreview(null)}
                              className="text-[11px] text-gray-500 hover:text-canvas-grayDark"
                            >
                              Close
                            </button>
                          </div>
                          <iframe
                            title="HTML/CSS preview"
                            sandbox=""
                            srcDoc={htmlPreview}
                            className="h-48 w-full bg-arc-ivory"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {runError && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-canvas-red">
                      <p>{runError}</p>
                      {/network error/i.test(runError) && (
                        <button
                          type="button"
                          disabled={disabled || runBusy}
                          onClick={() => void handleRunTests()}
                          className="rounded border border-red-200 bg-arc-paper px-2 py-0.5 font-medium text-canvas-red hover:bg-red-50 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  )}
                  {(() => {
                    const displayResults =
                      review && answer?.codeTestResults?.length
                        ? answer.codeTestResults
                        : runResults;
                    if (!displayResults || displayResults.length === 0) return null;
                    const tests = question.codeTests ?? [];
                    return (
                      <ul className="space-y-2 rounded-md border border-arc-ink/10 bg-arc-paper p-3 text-xs">
                        {displayResults.map((r) => {
                          const test = tests.find((t) => t.id === r.testId);
                          const hidden = Boolean(test?.hidden);
                          const label =
                            test?.label?.trim() ||
                            (hidden ? "Hidden test" : `Test`);
                          return (
                            <li key={r.testId} className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {r.passed ? (
                                  <Icon name="checkCircle" size={14} className="text-canvas-green" />
                                ) : (
                                  <Icon name="close" size={14} className="text-canvas-red" />
                                )}
                                <span className="font-medium text-canvas-grayDark">
                                  {label}
                                  {hidden ? " (hidden)" : ""}
                                </span>
                                <span
                                  className={
                                    r.passed ? "text-canvas-green" : "text-canvas-red"
                                  }
                                >
                                  {r.passed ? "Passed" : "Failed"}
                                </span>
                              </div>
                              {!hidden && (
                                <div className="ml-5 space-y-1 font-mono text-[11px] text-gray-600">
                                  {test && isHtmlCssRunnerLanguage(question.language) ? (
                                    <>
                                      {/* For HTML/CSS, expected is the solution — never show it
                                          while answering (incl. instructor preview). Only after
                                          submit when the answer key is revealed.
                                          CSS property checklists (no `{`) may show as requirements. */}
                                      {question.language === "css" && test.stdin.trim() && (
                                        <p>
                                          <span className="font-sans font-semibold text-gray-500">
                                            scaffold:{" "}
                                          </span>
                                          {test.stdin}
                                        </p>
                                      )}
                                      {question.language === "css" &&
                                        test.expectedStdout.trim() &&
                                        !test.expectedStdout.includes("{") &&
                                        !(review && revealKey) && (
                                          <div>
                                            <p className="font-sans font-semibold text-gray-500">
                                              Required properties:
                                            </p>
                                            <pre className="mt-0.5 whitespace-pre-wrap">
                                              {test.expectedStdout.trim()}
                                            </pre>
                                          </div>
                                        )}
                                      {review && revealKey ? (
                                        <>
                                          <p>
                                            <span className="font-sans font-semibold text-gray-500">
                                              expected:{" "}
                                            </span>
                                            {test.expectedStdout || "(empty)"}
                                          </p>
                                          <p>
                                            <span className="font-sans font-semibold text-gray-500">
                                              yours:{" "}
                                            </span>
                                            {r.stdout || "(empty)"}
                                          </p>
                                        </>
                                      ) : (
                                        <p className="font-sans text-gray-500">
                                          {r.passed
                                            ? "Your code matched the expected result."
                                            : "Your code did not match the expected result."}
                                        </p>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {test && (
                                        <p>
                                          <span className="font-sans font-semibold text-gray-500">
                                            stdin:{" "}
                                          </span>
                                          {test.stdin || "(empty)"}
                                        </p>
                                      )}
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="rounded border border-arc-ink/10 bg-arc-ivory p-1.5">
                                          <p className="font-sans font-semibold text-gray-500">
                                            expected
                                          </p>
                                          <pre className="mt-0.5 whitespace-pre-wrap">
                                            {test?.expectedStdout ||
                                              (test?.expectedRegex
                                                ? `/${test.expectedRegex}/`
                                                : "(empty)")}
                                          </pre>
                                        </div>
                                        <div className="rounded border border-arc-ink/10 bg-arc-ivory p-1.5">
                                          <p className="font-sans font-semibold text-gray-500">
                                            actual
                                          </p>
                                          <pre className="mt-0.5 whitespace-pre-wrap">
                                            {r.stdout || "(empty)"}
                                          </pre>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                      {(() => {
                                        const errText = r.error || r.stderr || "";
                                        const long = errText.length > 160;
                                        const open = stderrOpen[r.testId] ?? !long;
                                        return (
                                    <div className="text-canvas-red">
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold"
                                        onClick={() =>
                                          setStderrOpen((prev) => ({
                                            ...prev,
                                            [r.testId]: !open,
                                          }))
                                        }
                                      >
                                        {open ? (
                                          <Icon name="chevronDown" size={12} />
                                        ) : (
                                          <Icon name="chevronRight" size={12} />
                                        )}
                                        {r.error ? "Error / stderr" : "stderr"}
                                        {long && !open ? " (collapsed)" : ""}
                                      </button>
                                      {open && (
                                        <pre className="mt-0.5 whitespace-pre-wrap">
                                          {errText}
                                        </pre>
                                      )}
                                    </div>
                                        );
                                      })()}
                                </div>
                              )}
                              {hidden && !r.passed && r.error && (
                                <p className="ml-5 text-canvas-red">{r.error}</p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>
                </CodeRunnerErrorBoundary>
              )}
            {review &&
              revealKey &&
              question.type === "inline_code" &&
              (question.acceptedAnswers ?? []).some((a) => a.trim()) && (
                <div className="mt-2 rounded-md bg-arc-paper px-3 py-2 text-xs text-arc-mute">
                  <span className="font-semibold">Accepted solutions:</span>
                  {(question.acceptedAnswers ?? [])
                    .filter((a) => a.trim())
                    .map((a, i) => (
                      <pre key={i} className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono">
                        {a}
                      </pre>
                    ))}
                </div>
              )}
            {review &&
              revealKey &&
              question.type === "coding" &&
              (() => {
                const tests = question.codeTests ?? [];
                const hasCorrectCode = Boolean(question.correctCode?.trim());
                const accepted = (question.acceptedAnswers ?? []).filter((a) => a.trim());
                const hasTests = tests.some(
                  (t) => t.expectedStdout.trim() || t.stdin.trim(),
                );
                return (
                  <div className="mt-2 space-y-2 rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-gray-700">
                    <p className="font-semibold text-emerald-900">Answer key</p>
                    {!hasCorrectCode && (
                      <p className="rounded border border-dashed border-amber-300 bg-amber-50/80 px-2 py-1.5 text-amber-900">
                        No sample answer in the editor yet — add one under{" "}
                        <span className="font-semibold">
                          Sample answer (printed on answer key)
                        </span>{" "}
                        so it appears in the code box above.
                      </p>
                    )}
                    {accepted.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-600">
                          Alternate accepted solutions
                        </p>
                        {accepted.map((a, i) => (
                          <pre
                            key={i}
                            className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px]"
                          >
                            {a}
                          </pre>
                        ))}
                      </div>
                    )}
                    {hasTests && (
                      <div>
                        <p className="font-medium text-gray-600">
                          {isHtmlCssRunnerLanguage(question.language)
                            ? "Expected output / properties"
                            : "Test cases (stdin → expected)"}
                        </p>
                        <ul className="mt-1 space-y-2">
                          {tests.map((t, i) => (
                            <li
                              key={t.id}
                              className="rounded border border-emerald-100 bg-white/80 px-2 py-1.5 font-mono text-[11px]"
                            >
                              <p className="font-sans text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                {t.label?.trim() || `Test ${i + 1}`}
                                {t.hidden ? " · hidden" : ""}
                              </p>
                              {question.language === "css" &&
                              t.expectedStdout.trim() &&
                              !t.expectedStdout.includes("{") ? (
                                <pre className="mt-1 whitespace-pre-wrap">
                                  {t.expectedStdout.trim()}
                                </pre>
                              ) : (
                                <>
                                  {t.stdin.trim() ? (
                                    <p className="mt-1">
                                      <span className="font-sans font-semibold text-gray-500">
                                        stdin:{" "}
                                      </span>
                                      {t.stdin}
                                    </p>
                                  ) : null}
                                  <p className="mt-0.5">
                                    <span className="font-sans font-semibold text-gray-500">
                                      expected:{" "}
                                    </span>
                                    {t.expectedStdout.trim() || "(empty)"}
                                  </p>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            {review &&
              question.type === "coding" &&
              !codingUsesTestRunner(question) &&
              !question.autoGradeCode &&
              !question.correctCode?.trim() &&
              !(question.acceptedAnswers ?? []).some((a) => a.trim()) && (
                <p className="mt-2 text-xs text-amber-600">Graded manually in GradePro.</p>
              )}
          </div>
        )}

        {review && revealKey && review.partial && review.partialNote && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950">
            {review.partialNote}
          </p>
        )}

        {review && reviewFeedback && (
          <QuestionFeedbackPanel feedback={reviewFeedback.text} tone={reviewFeedback.tone} />
        )}
      </div>
    </div>
  );
}

/** Combined correct/incorrect + score chip for review headers. */
function QuestionResultBadge({
  correct,
  partial,
  earned,
  possible,
  scoreDraft,
  onScoreChange,
}: {
  correct: boolean;
  partial?: boolean;
  earned?: number;
  possible?: number;
  scoreDraft?: string;
  onScoreChange?: (value: string) => void;
}) {
  const tone = correct ? "correct" : partial ? "partial" : "incorrect";
  const shell =
    tone === "correct"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "partial"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-red-200 bg-red-50 text-red-800";
  const scoreShell =
    tone === "correct"
      ? "bg-green-100/90 text-green-900"
      : tone === "partial"
        ? "bg-amber-100/90 text-amber-950"
        : "bg-red-100/90 text-red-900";
  const label = correct ? "Correct" : partial ? "Partial" : "Incorrect";
  const resultIcon = correct ? "checkCircle" : partial ? "warning" : "close";
  const max = possible ?? 0;
  const over =
    Boolean(onScoreChange) &&
    max > 0 &&
    scoreDraft != null &&
    Number(scoreDraft) > max;
  const showScore = typeof earned === "number" || onScoreChange;

  return (
    <span
      className={`quiz-result-badge inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-0.5 text-xs font-medium ${shell} ${
        over ? "ring-2 ring-canvas-red/40" : ""
      }`}
    >
      <Icon name={resultIcon} size={14} className="shrink-0" />
      <span className="shrink-0">{label}</span>
      {showScore && (
        <>
          <span className="mx-0.5 h-3 w-px shrink-0 bg-current opacity-20" aria-hidden />
          {onScoreChange ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${
                over ? "bg-red-200 text-canvas-red" : scoreShell
              }`}
            >
              <input
                type="number"
                min={0}
                max={max > 0 ? max : undefined}
                step={0.25}
                value={scoreDraft ?? ""}
                onChange={(e) => onScoreChange(e.target.value)}
                aria-label="Points earned"
                title={over ? `Maximum is ${formatPoints(max)}` : undefined}
                className="w-12 rounded border-0 bg-transparent p-0 text-right text-xs font-semibold tabular-nums outline-none focus:ring-0"
              />
              <span className="font-normal opacity-70">/ {formatPoints(max)}</span>
              {over && (
                <button
                  type="button"
                  onClick={() => onScoreChange(String(max))}
                  className="rounded px-1 text-[10px] font-semibold underline-offset-2 hover:underline"
                >
                  Max
                </button>
              )}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 tabular-nums ${scoreShell}`}
            >
              <span className="font-semibold">{formatPoints(earned ?? 0)}</span>
              <span className="font-normal opacity-60">/</span>
              <span className="font-normal opacity-70">{formatPoints(max)}</span>
            </span>
          )}
        </>
      )}
    </span>
  );
}
