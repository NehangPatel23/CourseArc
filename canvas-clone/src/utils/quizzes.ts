import {
  formatAssignmentDueDate,
  formatAvailabilityColumn,
  isAssignmentClosedToStudents,
  isAssignmentNotYetAvailable,
  isStudentViewableAssignment,
  type Assignment,
} from "./assignments";
import { isItemGradeVisible } from "./gradeVisibility";
import { isQuizAvailabilityUnlocked } from "./quizAccommodations";
import {
  isAccessCodeExpired,
  isOneTimeTokenValid,
} from "./quizAccess";
import { getItemCompleted, loadProgress } from "./progress";
import {
  normalizeEssayRubric,
  type RubricCriterionDef,
} from "./assignmentRubric";
import { getStudentSectionName } from "./courseSections";
import { applyEffectiveDates } from "./dueDateOverrides";

export type QuizQuestionType =
  | "multiple_choice"
  | "multiple_answers"
  | "true_false"
  | "short_answer"
  | "fill_in_blank"
  | "fill_in_multiple_blanks"
  | "numerical"
  | "matching"
  | "ordering"
  | "calculated"
  | "likert"
  | "hotspot"
  | "essay"
  | "inline_code"
  | "coding"
  | "note"
  /** Local pick-N pool: draw `pickCount` from `groupQuestions` each attempt. */
  | "group";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type FillBlankSlot = {
  id: string;
  label?: string;
  acceptedAnswers: string[];
};

export type MatchingPair = {
  id: string;
  left: string;
  right: string;
};

export type HotspotRegion = {
  id: string;
  /** 0–100 percent of image width */
  x: number;
  /** 0–100 percent of image height */
  y: number;
  w: number;
  h: number;
  label?: string;
};

export type CalculatedVariableDef = {
  name: string;
  min: number;
  max: number;
  decimals?: number;
};

/** Preset partial-credit bands for numerical questions (± full, ± partial). */
export type NumericalBandPreset = "exact" | "tight" | "moderate" | "loose";

export type CodeLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "cpp"
  | "c"
  | "sql"
  | "html"
  | "css"
  | "other";

/** One stdin → expected-stdout case for coding auto-grade / Run. */
export type CodeTestCase = {
  id: string;
  label?: string;
  stdin: string;
  expectedStdout: string;
  /**
   * Hash of normalized expected output/source. Used when plaintext
   * expectedStdout is stripped for students.
   */
  expectedHash?: string;
  /** Hide I/O from students; still used for grading. */
  hidden?: boolean;
  /** Relative weight for partial credit (default 1). */
  weight?: number;
  /** Soft per-test timeout override (ms). */
  timeoutMs?: number;
  /** Match stdout with RegExp (string form). When set, exact expectedStdout is optional. */
  expectedRegex?: string;
  /**
   * JS/TS only: assert snippet. Receives `stdout`, `stdin`, `expected`.
   * Must return true / throw. Runs after the student program.
   */
  assertJs?: string;
  /**
   * JS/TS property harness: expand into N random-int stdin cases.
   * Replace `{{n}}` in expectedStdout; optional assertJs also runs.
   */
  propertyHarness?: {
    enabled: boolean;
    count?: number;
    min?: number;
    max?: number;
  };
};

/** Multi-file coding scaffold / student files. */
export type CodeFile = {
  path: string;
  content: string;
  /** When true (or first file), treated as the primary entry for Wandbox. */
  main?: boolean;
};

/** Languages runnable locally in a Web Worker (no network). */
export const LOCAL_CODE_RUNNER_LANGUAGES: readonly CodeLanguage[] = [
  "javascript",
  "typescript",
  "python",
];

/**
 * Languages runnable via the free Wandbox online compiler API.
 * @see https://wandbox.org/
 */
export const REMOTE_CODE_RUNNER_LANGUAGES: readonly CodeLanguage[] = [
  "c",
  "cpp",
  "java",
  "sql",
];

/** Markup languages graded via iframe preview + source/DOM compare (local). */
export const HTML_CSS_RUNNER_LANGUAGES: readonly CodeLanguage[] = ["html", "css"];

/** All languages the quiz code runner can execute (local, remote, or HTML/CSS). */
export const CODE_RUNNER_LANGUAGES: readonly CodeLanguage[] = [
  ...LOCAL_CODE_RUNNER_LANGUAGES,
  ...REMOTE_CODE_RUNNER_LANGUAGES,
  ...HTML_CSS_RUNNER_LANGUAGES,
];

export function isLocalCodeRunnerLanguage(
  language: CodeLanguage | string | undefined,
): boolean {
  return (
    language === "javascript" ||
    language === "typescript" ||
    language === "python"
  );
}

export function isRemoteCodeRunnerLanguage(
  language: CodeLanguage | string | undefined,
): boolean {
  return (
    language === "c" ||
    language === "cpp" ||
    language === "java" ||
    language === "sql"
  );
}

export function isHtmlCssRunnerLanguage(
  language: CodeLanguage | string | undefined,
): boolean {
  return language === "html" || language === "css";
}

export function isCodeRunnerLanguage(
  language: CodeLanguage | string | undefined,
): boolean {
  return (
    isLocalCodeRunnerLanguage(language) ||
    isRemoteCodeRunnerLanguage(language) ||
    isHtmlCssRunnerLanguage(language)
  );
}

export const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  c: "C",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  other: "Other",
};

/** How the "score that counts" is chosen across multiple attempts. */
export type QuizScoringPolicy =
  | "latest"
  | "highest"
  | "lowest"
  | "average"
  | "first";

export type QuizType = "graded" | "practice" | "survey";

export const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  graded: "Graded quiz",
  practice: "Practice quiz",
  survey: "Survey",
};

export const QUIZ_SCORING_POLICY_LABELS: Record<QuizScoringPolicy, string> = {
  latest: "Latest attempt",
  highest: "Highest score",
  lowest: "Lowest score",
  average: "Average of all attempts",
  first: "First attempt",
};

export function getQuizScoringPolicy(
  quiz: Pick<Quiz, "scoringPolicy">,
): QuizScoringPolicy {
  return quiz.scoringPolicy ?? "highest";
}

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  points: number;
  /** multiple_choice + multiple_answers */
  choices?: string[];
  /** Per-choice feedback shown in review (MC / multi-answer). */
  choiceFeedbacks?: string[];
  /** multiple_choice */
  correctChoiceIndex?: number;
  /** multiple_answers */
  correctChoiceIndices?: number[];
  /** true_false */
  correctTrueFalse?: boolean;
  /** short_answer */
  correctShortAnswer?: string;
  /** fill_in_blank — any accepted answer counts as correct */
  acceptedAnswers?: string[];
  /** fill_in_multiple_blanks — use {{blankId}} in prompt */
  fillBlanks?: FillBlankSlot[];
  /** ordering — shuffled display order indices into `orderingItems` */
  orderingItems?: string[];
  /** ordering — correct sequence as indices into `orderingItems` */
  correctOrder?: number[];
  /** calculated — formula using variable names, e.g. `(x + y) * 2` */
  calculatedFormula?: string;
  calculatedVariables?: CalculatedVariableDef[];
  calculatedTolerance?: number;
  /** likert — scale endpoints (survey or graded with `correctLikertValue`) */
  likertMin?: number;
  likertMax?: number;
  likertMinLabel?: string;
  likertMaxLabel?: string;
  correctLikertValue?: number;
  /** hotspot — image URL (data-URL or course file path) */
  hotspotImageUrl?: string;
  hotspotRegions?: HotspotRegion[];
  /** hotspot — ids of correct region(s) */
  correctHotspotIds?: string[];
  /** numerical band preset for editor convenience */
  numericalBandPreset?: NumericalBandPreset;
  /** When true, earned points add to score but not to max (bonus). */
  extraCredit?: boolean;
  /** numerical */
  correctNumber?: number;
  tolerance?: number;
  /**
   * Outer ± band for partial credit on numerical questions (when partial credit
   * is enabled). Answers within `tolerance` earn full credit; between tolerance
   * and `partialTolerance` earn a linearly decreasing share; outside earn 0.
   * Ignored when unset or ≤ tolerance.
   */
  partialTolerance?: number;
  /** matching */
  matchingPairs?: MatchingPair[];
  /**
   * When answers are shuffled, optional display order for matching dropdowns
   * (right-side values). Graded by value, not index.
   */
  matchingRightOrder?: string[];
  /**
   * When answers are shuffled, display order for True/False options.
   * Graded by boolean value, not position.
   */
  trueFalseOrder?: boolean[];
  /** inline_code + coding */
  language?: CodeLanguage;
  /** Starter / scaffold shown in the student editor */
  starterCode?: string;
  /** Multi-file scaffold (when set, take UI shows tabs; combined for the runner). */
  codeFiles?: CodeFile[];
  /** Reference solution for optional auto-grade (coding) or display */
  correctCode?: string;
  /** When the sample answer (`correctCode`) was last edited (ms). */
  correctCodeUpdatedAt?: number;
  /** When true, exclude this question’s key from printed answer keys. */
  omitFromAnswerKey?: boolean;
  /** Soft line hint for inline_code (1–N) */
  codeMaxLines?: number;
  /** When true, coding questions auto-grade via normalized correctCode match */
  autoGradeCode?: boolean;
  /**
   * Stdin/stdout test cases for coding questions. When present and the language
   * is runnable (JS/TS/Python locally, or C/C++/Java/SQL via Wandbox),
   * auto-grade via the client code runner.
   */
  codeTests?: CodeTestCase[];
  /** SQL: schema/setup script prepended before each student run (Wandbox). */
  sqlSetup?: string;
  /**
   * TypeScript transpile mode. Sucrase strips types only — `strict` is documented
   * as best-effort (no full tsc). Default `transpile`.
   */
  tsTranspileMode?: "transpile" | "strip";
  /** Soft default timeout (ms) for this question’s tests when a case has none. */
  codeTimeoutMs?: number;
  /**
   * Always-shown post-grade note (fallback when correct/incorrect-specific
   * feedback is unset). Prefer `correctFeedback` / `incorrectFeedback`.
   */
  feedback?: string;
  /** Shown after grading when the answer is fully correct. */
  correctFeedback?: string;
  /** Shown after grading when the answer is incorrect or only partially correct. */
  incorrectFeedback?: string;
  /**
   * Per-question override for partial credit on multiple_answers / matching /
   * numerical. When unset, the quiz-level `partialCredit` setting applies.
   */
  partialCredit?: boolean;
  /**
   * Per-question override for penalizing wrong multi-answer picks.
   * When unset, the quiz-level `partialCreditPenalty` setting applies.
   */
  partialCreditPenalty?: boolean;
  /**
   * Per-question minimum similarity (0–1) for fill-in / short-answer near-match
   * partial credit. When unset, the quiz-level `nearMatchThreshold` (or 0.5)
   * applies.
   */
  nearMatchThreshold?: number;
  /**
   * When true, student must add a short comment before submitting this essay.
   * Quiz-level `requireEssayComment` can also apply.
   */
  requireEssayComment?: boolean;
  /**
   * For `type: "group"` — how many member questions to draw per attempt.
   * Clamped to the size of `groupQuestions` at resolve time.
   */
  pickCount?: number;
  /**
   * For `type: "group"` — pool of questions to pick from (no nested groups).
   */
  groupQuestions?: QuizQuestion[];
  /**
   * For `type: "essay"` — optional grading rubric (criteria + ratings).
   * Used in GradePro to derive per-question points.
   */
  rubric?: RubricCriterionDef[];
  /** Optional tags for filtering (#65). */
  tags?: string[];
  /** Difficulty label (#66). */
  difficulty?: QuestionDifficulty;
  /** Bloom taxonomy level (#66). */
  bloomLevel?: BloomLevel;
};

/** How multi-bank draws work on a quiz attempt. */
export type QuizBankPoolMode = "per_bank" | "combined";

export type QuizBankPoolSource = {
  bankId: string;
  /** Used when mode is `per_bank`. Ignored for combined totals. */
  pickCount: number;
};

export type QuizBankPool = {
  mode: QuizBankPoolMode;
  sources: QuizBankPoolSource[];
  /** Total questions across all sources when mode is `combined`. */
  totalPickCount?: number;
};

/** @deprecated single-bank shape; still accepted via normalizeQuizBankPool */
export type LegacyQuizBankPool = { bankId: string; pickCount: number };

export function normalizeQuizBankPool(raw: unknown): QuizBankPool | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;

  if (typeof r.bankId === "string" && r.bankId.trim() && !Array.isArray(r.sources)) {
    return {
      mode: "per_bank",
      sources: [
        {
          bankId: r.bankId.trim(),
          pickCount: Math.max(1, Number(r.pickCount) || 1),
        },
      ],
    };
  }

  if (!Array.isArray(r.sources)) return undefined;
  const sources: QuizBankPoolSource[] = r.sources
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const entry = s as Record<string, unknown>;
      const bankId = String(entry.bankId ?? "").trim();
      if (!bankId) return null;
      return {
        bankId,
        pickCount: Math.max(0, Number(entry.pickCount) || 0),
      };
    })
    .filter((s): s is QuizBankPoolSource => s != null);

  if (sources.length === 0) return undefined;

  const mode: QuizBankPoolMode = r.mode === "combined" ? "combined" : "per_bank";
  return {
    mode,
    sources,
    totalPickCount:
      mode === "combined" ? Math.max(1, Number(r.totalPickCount) || 1) : undefined,
  };
}

/** Expected number of questions drawn for an attempt from this pool. */
export function bankPoolDrawCount(pool: QuizBankPool): number {
  if (pool.mode === "combined") return pool.totalPickCount ?? 0;
  return pool.sources.reduce((n, s) => n + Math.max(0, s.pickCount || 0), 0);
}

export type Quiz = {
  id: string;
  title: string;
  dueAt?: number;
  points?: number;
  published?: boolean;
  description?: string;
  status?: "draft" | "published";
  publishAt?: number;
  /** When set, published quizzes revert to draft at this time (#69). */
  unpublishAt?: number;
  availableFrom?: number;
  availableUntil?: number;
  timeLimitMinutes?: number;
  questionCount?: number;
  questions?: QuizQuestion[];
  /**
   * When set, each attempt draws questions from one or more banks
   * (stable per attempt via seed) and appends them after any inline `questions`.
   * Legacy `{ bankId, pickCount }` is accepted and normalized on read.
   */
  bankPool?: QuizBankPool | LegacyQuizBankPool;
  shuffleAnswers?: boolean;
  /** Randomize question order per attempt (default false). */
  shuffleQuestions?: boolean;
  /**
   * graded (default): counts in gradebook.
   * practice: scored for the student, excluded from gradebook.
   * survey: unscored for students; no answer key; excluded from gradebook.
   */
  quizType?: QuizType;
  /** When set, students must enter this code before starting (session-remembered). */
  accessCode?: string;
  /** Access code stops working after this time (#93). */
  accessCodeExpiresAt?: number;
  /** One-time link token — single use per browser session (#94). */
  oneTimeAccessToken?: string;
  /**
   * Section-specific availability windows (#91).
   * Empty / unset = all sections use quiz-level windows.
   */
  sectionAvailability?: {
    section: string;
    availableFrom?: number;
    availableUntil?: number;
  }[];
  /** Restrict quiz to these section tags (empty = all). */
  allowedSections?: string[];
  /** Module item that must be completed before take (#95). */
  requiredModuleItem?: { moduleTitle: string; itemLabel: string };
  /** Practice: show feedback after each question (#143). */
  practiceInstantFeedback?: boolean;
  /** Practice: retake only questions missed on prior attempt (#88). */
  practiceRetakeWrongOnly?: boolean;
  /** Practice: show projected score before submit (#90). */
  practiceScorePreview?: boolean;
  /** Soft-delete timestamp — quiz lives in trash until restored (#150). */
  deletedAt?: number;
  /** Share preview URL key for TAs (#140). */
  previewShareKey?: string;
  /**
   * When true, hide the attempt score from students until the attempt is fully
   * graded (auto-graded, or instructor has graded it). Graded quizzes still
   * also respect gradebook post/hide.
   */
  hideScoreUntilGraded?: boolean;
  /** Show one question at a time while taking (default: all questions). */
  oneQuestionAtATime?: boolean;
  /** When one-at-a-time, block returning to earlier questions (default false). */
  lockPreviousQuestions?: boolean;
  /**
   * When true, leaving the quiz tab/window pauses the attempt behind a blur
   * overlay until the student acknowledges return. Optional maxLeaveCount
   * auto-submits after too many leaves.
   */
  lockOnLeave?: boolean;
  /** Max leave events before auto-submit (only when lockOnLeave). */
  maxLeaveCount?: number;
  /** Warn the student the first time they leave (lockOnLeave). */
  warnOnLeave?: boolean;
  /** Prompt to enter browser fullscreen before starting (soft focus mode). */
  requireFullscreen?: boolean;
  /**
   * When true with lockOnLeave, also treat window blur (debounced) as a leave
   * in addition to visibilitychange (tab switch / minimize).
   */
  lockOnBlur?: boolean;
  /**
   * Minutes without keyboard/pointer activity before warn + leave / auto-submit.
   * Soft heartbeat only — not a hard proctor.
   */
  idleTimeoutMinutes?: number;
  /** Soft-block paste on essay and coding responses (toast; not a hard lock). */
  softDisablePaste?: boolean;
  /** Block submit until every non-note question has been viewed. */
  requireViewAllQuestions?: boolean;
  /** Collect a seat / station number before start. */
  collectSeatNumber?: boolean;
  /**
   * When collectSeatNumber is on, require a non-empty seat (default true).
   * When false, the student may skip.
   */
  requireSeatNumber?: boolean;
  allowMultipleAttempts?: boolean;
  allowedAttempts?: number;
  /** Which attempt's score counts when multiple attempts are allowed. */
  scoringPolicy?: QuizScoringPolicy;
  /** Whether students may see their own responses after submitting (default true). */
  letStudentsSeeResponses?: boolean;
  /** When true, responses are only viewable once immediately after each attempt. */
  showResponsesOnlyOnce?: boolean;
  /** Whether students may see the correct answers (default true). */
  showCorrectAnswers?: boolean;
  /** Only reveal correct answers on/after this time. */
  showCorrectAnswersAt?: number;
  /** Stop revealing correct answers after this time. */
  hideCorrectAnswersAt?: number;
  /**
   * Award proportional credit on multiple-answers and matching questions
   * (correct picks/pairs ÷ total). Default false (all-or-nothing).
   */
  partialCredit?: boolean;
  /**
   * When partial credit is on, subtract wrong multi-answer picks from the
   * credit ratio (floor at 0). Matching is unaffected.
   */
  partialCreditPenalty?: boolean;
  /**
   * Minimum text similarity (0–1) for fill-in / short-answer near-match partial
   * credit. Default 0.5 (50%). Per-question `nearMatchThreshold` overrides this.
   */
  nearMatchThreshold?: number;
  /**
   * Fraction of question points deducted on wrong MC/TF guess (0–1).
   * e.g. 0.25 → wrong MC loses 25% of points (floor 0).
   */
  guessingPenalty?: number;
  /** Require a comment on every essay question before submit. */
  requireEssayComment?: boolean;
  /**
   * Soft originality (client-side peer/self text similarity). Not Turnitin.
   * When omitted, originality UI stays on with sensible defaults.
   */
  softOriginality?: SoftOriginalitySettings;
  /** When true, GradePro hides student names until the grade is posted. */
  anonymousGrading?: boolean;
  /** Assignment group for weighted grading. */
  groupId?: string;
  /** Per-quiz Monaco override (#31). undefined = inherit course setting; true/false = force. */
  monacoEditor?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

/** Quiz-level soft originality / similarity options. */
export type SoftOriginalitySettings = {
  /** Default true — when false, hide similarity tooling for this quiz. */
  enabled?: boolean;
  /** Compare a student's attempts to their own earlier attempts (default true). */
  includeSelfAttempts?: boolean;
  /** Also compare against other quizzes in the course with similar prompts (default false). */
  includeOtherQuizzes?: boolean;
  /** Normalize coding answers before compare (default true). */
  normalizeCode?: boolean;
  /** Newline- or semicolon-separated boilerplate phrases to ignore. */
  excludeText?: string;
  /** Minimum combined match percent (0–100) to keep a pair (default 1). */
  minMatchPercent?: number;
};

/** Whether the student may see their own responses in the review. */
export function quizShowsResponses(quiz: Quiz): boolean {
  return quiz.letStudentsSeeResponses !== false;
}

export function getQuizType(quiz: Pick<Quiz, "quizType">): QuizType {
  return quiz.quizType ?? "graded";
}

/** Strip answer-key fields so survey items are prompts/options only. */
export function stripSurveyAnswerKeys(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((q) => {
    if (q.type === "note" || q.type === "group") {
      return {
        ...q,
        points: 0,
        groupQuestions:
          q.type === "group"
            ? stripSurveyAnswerKeys(q.groupQuestions ?? [])
            : undefined,
      };
    }
    const next: QuizQuestion = {
      ...q,
      points: 0,
      feedback: undefined,
      correctFeedback: undefined,
      incorrectFeedback: undefined,
      correctChoiceIndex: undefined,
      correctChoiceIndices: undefined,
      correctTrueFalse: undefined,
      correctShortAnswer: undefined,
      correctNumber: undefined,
      tolerance: undefined,
      partialTolerance: undefined,
      partialCredit: undefined,
      partialCreditPenalty: undefined,
      nearMatchThreshold: undefined,
      correctCode: undefined,
      autoGradeCode: false,
      codeTests: undefined,
      rubric: undefined,
    };
    if (q.type === "fill_in_blank" || q.type === "inline_code") {
      next.acceptedAnswers = undefined;
    }
    return next;
  });
}

/** Practice and surveys never appear as gradebook columns. */
export function quizCountsInGradebook(quiz: Pick<Quiz, "quizType" | "points">): boolean {
  return getQuizType(quiz) === "graded" && typeof quiz.points === "number" && quiz.points > 0;
}

/** Whether the correct-answer key may be revealed to students right now. */
export function quizShowsCorrectAnswers(quiz: Quiz, now = Date.now()): boolean {
  if (getQuizType(quiz) === "survey") return false;
  if (quiz.showCorrectAnswers === false) return false;
  if (typeof quiz.showCorrectAnswersAt === "number" && now < quiz.showCorrectAnswersAt) {
    return false;
  }
  if (typeof quiz.hideCorrectAnswersAt === "number" && now > quiz.hideCorrectAnswersAt) {
    return false;
  }
  return true;
}

/**
 * Whether a student may see the numeric score for this quiz/attempt.
 * Surveys never show scores. Graded quizzes require the gradebook column to be
 * posted. Optional hide-until-graded waits until the instructor grades the
 * attempt (`gradedAt`) — auto-score alone is not enough, so practice quizzes
 * with this flag stay hidden until GradePro release.
 */
export function quizShowsScoreToStudent(
  quiz: Quiz,
  opts: {
    courseId: string;
    studentId: string;
    /** When checking a specific attempt (hide-until-graded). */
    attempt?: { autoGraded: boolean; gradedAt?: number } | null;
  },
): boolean {
  const type = getQuizType(quiz);
  if (type === "survey") return false;

  if (quiz.hideScoreUntilGraded) {
    const attempt = opts.attempt;
    if (!attempt || typeof attempt.gradedAt !== "number") return false;
  }

  if (type === "practice") return true;

  // Graded: honor gradebook post/hide for this quiz column.
  return isItemGradeVisible(opts.courseId, `quiz:${quiz.id}`, opts.studentId);
}

export function createMatchingPair(): MatchingPair {
  return { id: uid("mp"), left: "", right: "" };
}

export function createQuizQuestion(type: QuizQuestionType): QuizQuestion {
  const base: QuizQuestion = { id: uid("qq"), type, prompt: "", points: 1 };
  switch (type) {
    case "multiple_choice":
      return { ...base, choices: ["", "", "", ""], correctChoiceIndex: 0 };
    case "multiple_answers":
      return { ...base, choices: ["", "", "", ""], correctChoiceIndices: [] };
    case "true_false":
      return { ...base, correctTrueFalse: true };
    case "short_answer":
      return { ...base, correctShortAnswer: "" };
    case "fill_in_blank":
      return { ...base, acceptedAnswers: [""] };
    case "fill_in_multiple_blanks":
      return {
        ...base,
        fillBlanks: [{ id: uid("fb"), label: "blank1", acceptedAnswers: [""] }],
        prompt: "Enter {{blank1}} here.",
      };
    case "numerical":
      return { ...base, correctNumber: 0, tolerance: 0, partialTolerance: undefined };
    case "matching":
      return { ...base, matchingPairs: [createMatchingPair(), createMatchingPair()] };
    case "ordering":
      return {
        ...base,
        orderingItems: ["First item", "Second item", "Third item"],
        correctOrder: [0, 1, 2],
      };
    case "calculated":
      return {
        ...base,
        calculatedFormula: "x + y",
        calculatedVariables: [
          { name: "x", min: 1, max: 10, decimals: 0 },
          { name: "y", min: 1, max: 10, decimals: 0 },
        ],
        calculatedTolerance: 0,
        prompt: "If x = [x] and y = [y], what is x + y?",
      };
    case "likert":
      return {
        ...base,
        points: 0,
        likertMin: 1,
        likertMax: 5,
        likertMinLabel: "Strongly disagree",
        likertMaxLabel: "Strongly agree",
      };
    case "hotspot":
      return {
        ...base,
        hotspotImageUrl: "",
        hotspotRegions: [],
        correctHotspotIds: [],
      };
    case "essay":
      return { ...base };
    case "note":
      return { ...base, points: 0 };
    case "group":
      return { ...base, points: 0, pickCount: 1, groupQuestions: [] };
    case "inline_code":
      return {
        ...base,
        language: "javascript",
        acceptedAnswers: [""],
        codeMaxLines: 5,
        starterCode: "",
      };
    case "coding":
      return {
        ...base,
        points: 5,
        language: "python",
        starterCode: CODE_STARTER_TEMPLATES.python ?? "",
        correctCode: "",
        autoGradeCode: false,
        codeTests: [],
      };
    default:
      return base;
  }
}

export function normalizeQuizQuestions(questions?: QuizQuestion[]): QuizQuestion[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => {
    if (q.type === "group") {
      const members = Array.isArray(q.groupQuestions)
        ? q.groupQuestions.filter((m) => m && m.type !== "group")
        : [];
      const pickCount = Math.max(0, Math.min(members.length || 0, Math.floor(Number(q.pickCount) || 0)));
      return {
        ...q,
        points: 0,
        pickCount: members.length === 0 ? 0 : Math.max(1, pickCount || 1),
        groupQuestions: members.map((m) =>
          m.type === "essay"
            ? { ...m, rubric: normalizeEssayRubric(m.rubric) }
            : m,
        ),
      };
    }
    if (q.type === "essay") {
      return { ...q, rubric: normalizeEssayRubric(q.rubric) };
    }
    return q;
  });
}

/** Flatten group containers into a lookup of every question id (top-level + members). */
export function collectQuizQuestionLookup(questions: QuizQuestion[]): Map<string, QuizQuestion> {
  const lookup = new Map<string, QuizQuestion>();
  for (const q of normalizeQuizQuestions(questions)) {
    lookup.set(q.id, q);
    if (q.type === "group") {
      for (const m of q.groupQuestions ?? []) lookup.set(m.id, m);
    }
  }
  return lookup;
}

/**
 * Expand local question groups into a flat attempt list.
 * Each group is replaced by a seeded pick of `pickCount` members (order shuffled).
 */
export function expandQuizQuestionGroups(
  questions: QuizQuestion[],
  seed: string,
  pickIds: (ids: string[], count: number, seed: string) => string[],
): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const q of normalizeQuizQuestions(questions)) {
    if (q.type !== "group") {
      out.push(q);
      continue;
    }
    const members = q.groupQuestions ?? [];
    if (members.length === 0) continue;
    const count = Math.max(0, Math.min(members.length, Math.floor(q.pickCount ?? 0)));
    if (count <= 0) continue;
    const byId = new Map(members.map((m) => [m.id, m]));
    const ids = pickIds(
      members.map((m) => m.id),
      count,
      `${seed}:group:${q.id}`,
    );
    for (const id of ids) {
      const m = byId.get(id);
      if (m) out.push(m);
    }
  }
  return out;
}

/** Expected attempt item count for inline questions (groups contribute pickCount). */
export function countInlineAttemptItems(questions: QuizQuestion[] = []): number {
  return normalizeQuizQuestions(questions).reduce((sum, q) => {
    if (q.type === "group") {
      const n = q.groupQuestions?.length ?? 0;
      return sum + Math.max(0, Math.min(n, Math.floor(q.pickCount ?? 0)));
    }
    return sum + 1;
  }, 0);
}

/** Expected points from a question group (average member points × pickCount). */
export function groupExpectedPoints(group: QuizQuestion): number {
  if (group.type !== "group") return 0;
  const members = (group.groupQuestions ?? []).filter((m) => m.type !== "note");
  if (members.length === 0) return 0;
  const pick = Math.max(0, Math.min(members.length, Math.floor(group.pickCount ?? 0)));
  if (pick <= 0) return 0;
  const avg =
    members.reduce((s, m) => s + (m.points > 0 ? m.points : 0), 0) / members.length;
  return Math.round(avg * pick * 100) / 100;
}

/** Flatten groups into a linear list (containers removed; members kept). */
export function flattenQuizQuestionItems(questions: QuizQuestion[] = []): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const q of normalizeQuizQuestions(questions)) {
    if (q.type === "group") {
      out.push(...(q.groupQuestions ?? []));
    } else {
      out.push(q);
    }
  }
  return out;
}

/** All question ids in the quiz (top-level + group members). */
export function collectQuizQuestionIds(questions: QuizQuestion[] = []): Set<string> {
  return new Set(collectQuizQuestionLookup(questions).keys());
}

export function getQuizQuestionCount(
  quiz: Pick<Quiz, "questions" | "questionCount" | "bankPool">,
): number {
  const pool = normalizeQuizBankPool(quiz.bankPool);
  const poolDraw = pool ? bankPoolDrawCount(pool) : 0;
  const inline = countInlineAttemptItems(quiz.questions);
  if (inline > 0 || poolDraw > 0) return inline + poolDraw;
  return quiz.questionCount ?? 0;
}

export function totalQuizQuestionPoints(questions: QuizQuestion[] = []): number {
  return normalizeQuizQuestions(questions).reduce((sum, q) => {
    if (q.type === "note") return sum;
    if (q.type === "group") return sum + groupExpectedPoints(q);
    if (q.extraCredit) return sum;
    return sum + (q.points > 0 ? q.points : 0);
  }, 0);
}

/** Apply numerical band preset to tolerance fields. */
export function applyNumericalBandPreset(
  preset: NumericalBandPreset,
  correctNumber: number,
): { tolerance: number; partialTolerance?: number } {
  const mag = Math.max(Math.abs(correctNumber), 1);
  switch (preset) {
    case "exact":
      return { tolerance: 0, partialTolerance: undefined };
    case "tight":
      return { tolerance: mag * 0.01, partialTolerance: mag * 0.05 };
    case "moderate":
      return { tolerance: mag * 0.02, partialTolerance: mag * 0.1 };
    case "loose":
      return { tolerance: mag * 0.05, partialTolerance: mag * 0.2 };
    default:
      return { tolerance: 0, partialTolerance: undefined };
  }
}

export const NUMERICAL_BAND_PRESET_LABELS: Record<NumericalBandPreset, string> = {
  exact: "Exact (±0)",
  tight: "Tight (±1% / ±5% partial)",
  moderate: "Moderate (±2% / ±10% partial)",
  loose: "Loose (±5% / ±20% partial)",
};

/** Format points for display without floating-point noise. */
export function formatPoints(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const n = Math.round(value * 100) / 100;
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** True when the item is a scored question (not a note/separator/group container). */
export function isGradedQuizQuestion(question: Pick<QuizQuestion, "type">): boolean {
  return question.type !== "note" && question.type !== "group";
}

/** Nav / card label: notes and groups stay unlabeled as questions; graded items get sequential numbers. */
export function quizItemLabel(
  questions: Pick<QuizQuestion, "type">[],
  index: number,
): string {
  const item = questions[index];
  if (!item) return `Question ${index + 1}`;
  if (item.type === "note") return "Note";
  if (item.type === "group") return "Question group";
  const n = questions.slice(0, index + 1).filter(isGradedQuizQuestion).length;
  return `Question ${n}`;
}

/**
 * Scale graded-question weights to `targetPoints` using largest-remainder
 * so each question gets a whole-number point value (notes stay at 0).
 */
export function scaleQuestionsToTargetPoints(
  questions: QuizQuestion[],
  targetPoints: number | undefined | null,
): QuizQuestion[] {
  if (!questions.length) return questions;
  if (typeof targetPoints !== "number" || !(targetPoints > 0)) {
    return questions.map((q) =>
      q.type === "note" || q.type === "group"
        ? { ...q, points: 0 }
        : { ...q, points: Math.max(0, Math.round(q.points || 0)) },
    );
  }

  const target = Math.round(targetPoints);
  const weights = questions.map((q) =>
    q.type === "note" || q.type === "group"
      ? 0
      : q.points > 0
        ? Math.max(1, Math.round(q.points))
        : 1,
  );
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) {
    return questions.map((q) => ({
      ...q,
      points: q.type === "note" || q.type === "group" ? 0 : q.points,
    }));
  }

  const exact = weights.map((w) => (w / weightSum) * target);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = target - floors.reduce((a, b) => a + b, 0);
  const byFrac = exact
    .map((x, i) => ({ i, frac: x - floors[i], w: weights[i] }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.frac - a.frac || b.w - a.w);

  const pts = [...floors];
  for (let k = 0; k < remainder && k < byFrac.length; k++) {
    pts[byFrac[k].i] += 1;
  }

  return questions.map((q, i) => ({
    ...q,
    points: q.type === "note" || q.type === "group" ? 0 : Math.max(0, pts[i]),
  }));
}

export const QUIZ_QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  multiple_choice: "Multiple choice",
  multiple_answers: "Multiple answers",
  true_false: "True / False",
  short_answer: "Short answer",
  fill_in_blank: "Fill in the blank",
  fill_in_multiple_blanks: "Fill in multiple blanks",
  numerical: "Numerical",
  matching: "Matching",
  ordering: "Ordering / ranking",
  calculated: "Calculated / formula",
  likert: "Likert scale",
  hotspot: "Hotspot (image)",
  essay: "Essay",
  inline_code: "Inline code",
  coding: "Coding",
  note: "Note / instruction",
  group: "Question group (pick N)",
};

/** Normalize code for comparison (trim lines, unify newlines). */
export function normalizeCode(src: string): string {
  return src
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
}

export function quizzesKey(courseId: string) {
  return `canvasClone:quizzes:${courseId}`;
}

export { formatAssignmentDueDate as formatQuizDueDate, formatAvailabilityColumn };

export function formatTimeLimit(minutes?: number): string | null {
  if (minutes == null || minutes <= 0) return null;
  return `${minutes} min`;
}

/** Canvas-style time limit label, e.g. "10 Minutes". */
export function formatTimeLimitDisplay(minutes?: number): string | null {
  if (minutes == null || minutes <= 0) return null;
  return `${minutes} Minute${minutes === 1 ? "" : "s"}`;
}

/** Canvas-style datetime, e.g. "Jan 13, 2022 at 12:20pm". */
export function formatQuizDateTime(ts: number): string {
  return formatAssignmentDueDate(ts).replace(" by ", " at ");
}

export function formatQuizAvailabilityRange(
  quiz: Pick<Quiz, "availableFrom" | "availableUntil">,
): string | null {
  const { availableFrom, availableUntil } = quiz;
  if (typeof availableFrom === "number" && typeof availableUntil === "number") {
    return `${formatQuizDateTime(availableFrom)} - ${formatQuizDateTime(availableUntil)}`;
  }
  if (typeof availableFrom === "number") {
    return `from ${formatQuizDateTime(availableFrom)}`;
  }
  if (typeof availableUntil === "number") {
    return `until ${formatQuizDateTime(availableUntil)}`;
  }
  return null;
}

export function getQuizAllowedAttemptsLabel(quiz: Pick<Quiz, "allowMultipleAttempts" | "allowedAttempts">): string {
  if (quiz.allowMultipleAttempts) {
    const n = quiz.allowedAttempts;
    if (typeof n === "number" && n > 0) return String(n);
    return "Unlimited";
  }
  return "1";
}

export function getQuizLockedAt(quiz: Quiz, now = Date.now()): number | null {
  // Only an elapsed "available until" date locks a quiz. A past due date alone
  // does not lock it (late attempts stay allowed when no window is set).
  if (typeof quiz.availableUntil === "number" && quiz.availableUntil < now) {
    return quiz.availableUntil;
  }
  return null;
}

export type QuizTakeAccessOpts = {
  /** When set with studentId, honors per-student availability unlock accommodations. */
  courseId?: string;
  studentId?: string;
  /** One-time link token from URL (#94). */
  oneTimeToken?: string;
  now?: number;
};

function studentSectionKey(courseId: string, studentId: string) {
  return `canvasClone:studentSection:${courseId}:${studentId}`;
}

/** Demo section tag for section-scoped availability (#91). */
export function getStudentSection(courseId: string, studentId: string): string {
  const fromRoster = getStudentSectionName(courseId, studentId);
  if (fromRoster && fromRoster !== "All") return fromRoster;
  try {
    return window.localStorage.getItem(studentSectionKey(courseId, studentId)) ?? "All";
  } catch {
    return "All";
  }
}

export function setStudentSection(courseId: string, studentId: string, section: string) {
  try {
    window.localStorage.setItem(studentSectionKey(courseId, studentId), section.trim() || "All");
  } catch {}
}

function isAvailableForStudentSection(quiz: Quiz, section: string, now: number): boolean {
  if (quiz.allowedSections?.length) {
    if (!quiz.allowedSections.includes(section) && !quiz.allowedSections.includes("All")) {
      return false;
    }
  }
  const overrides = quiz.sectionAvailability ?? [];
  const match = overrides.filter((o) => o.section === section || o.section === "All");
  if (match.length === 0) return true;
  return match.some((o) => {
    if (typeof o.availableFrom === "number" && o.availableFrom > now) return false;
    if (typeof o.availableUntil === "number" && o.availableUntil < now) return false;
    return true;
  });
}

export function quizUsesCodingLanguages(quiz: Quiz): CodeLanguage[] {
  const langs = new Set<CodeLanguage>();
  const walk = (qs: QuizQuestion[]) => {
    for (const q of qs) {
      if (q.language && (q.type === "coding" || q.type === "inline_code")) {
        langs.add(q.language);
      }
      if (q.type === "group") walk(q.groupQuestions ?? []);
    }
  };
  walk(normalizeQuizQuestions(quiz.questions));
  return [...langs];
}

function quizWithEffectiveDates(quiz: Quiz, opts?: QuizTakeAccessOpts): Quiz {
  if (!opts?.courseId || !opts?.studentId) return quiz;
  return applyEffectiveDates(opts.courseId, "quiz", quiz, opts.studentId);
}

export function canStudentTakeQuiz(
  quiz: Quiz,
  now = Date.now(),
  opts?: QuizTakeAccessOpts,
): boolean {
  quiz = quizWithEffectiveDates(quiz, opts);
  if (!isStudentViewableQuiz(quiz, now)) return false;
  if (isAccessCodeExpired(quiz.accessCodeExpiresAt, now) && quiz.accessCode) {
    return false;
  }
  if (opts?.oneTimeToken && quiz.oneTimeAccessToken) {
    if (
      !isOneTimeTokenValid(
        opts.courseId ?? "",
        quiz.id,
        opts.oneTimeToken,
        quiz.oneTimeAccessToken,
      )
    ) {
      return false;
    }
  }
  if (quiz.requiredModuleItem && opts?.courseId) {
    try {
      const progress = loadProgress(opts.courseId);
      const { moduleTitle, itemLabel } = quiz.requiredModuleItem;
      if (!getItemCompleted(progress, moduleTitle, itemLabel)) return false;
    } catch {
      /* progress store unavailable — don't block the attempt */
    }
  }
  if (opts?.courseId && opts?.studentId) {
    const section = getStudentSection(opts.courseId, opts.studentId);
    if (!isAvailableForStudentSection(quiz, section, now)) return false;
  }
  const availabilityUnlocked =
    Boolean(opts?.courseId && opts?.studentId) &&
    isQuizAvailabilityUnlocked(opts!.courseId!, opts!.studentId!, quiz.id);
  if (!availabilityUnlocked) {
    if (isQuizNotYetAvailable(quiz, now)) return false;
    if (typeof quiz.availableUntil === "number" && quiz.availableUntil < now) return false;
  }
  return getQuizQuestionCount(quiz) > 0;
}

function asAssignmentLike(q: Quiz): Assignment {
  return q as unknown as Assignment;
}

export function isStudentViewableQuiz(q: Quiz, now = Date.now()) {
  return isStudentViewableAssignment(asAssignmentLike(q), now);
}

export function isQuizNotYetAvailable(q: Quiz, now = Date.now()) {
  return isAssignmentNotYetAvailable(asAssignmentLike(q), now);
}

export function isQuizClosedToStudents(q: Quiz, now = Date.now()) {
  return isAssignmentClosedToStudents(asAssignmentLike(q), now);
}

function seedQuizQuestions(): QuizQuestion[] {
  return [
    {
      id: "seed_qq_1",
      type: "multiple_choice",
      prompt: "What is the time complexity of binary search on a sorted array?",
      points: 2,
      choices: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
      correctChoiceIndex: 1,
    },
    {
      id: "seed_qq_2",
      type: "true_false",
      prompt: "Merge sort is a stable sorting algorithm.",
      points: 1,
      correctTrueFalse: true,
    },
    {
      id: "seed_qq_3",
      type: "short_answer",
      prompt: "Name one advantage of using a hash table.",
      points: 2,
      correctShortAnswer: "O(1) average lookup",
    },
  ];
}

function seedQuizzes(courseId: string): Quiz[] {
  const now = Date.now();
  const week1Questions = seedQuizQuestions();
  return [
    {
      id: `seed_quiz1_${courseId}`,
      title: "Week 1 Knowledge Check",
      dueAt: now + 7 * 86400000,
      points: totalQuizQuestionPoints(week1Questions),
      timeLimitMinutes: 30,
      questionCount: week1Questions.length,
      questions: week1Questions,
      published: true,
      status: "published",
      description: "<p>Covers material from the first week of lectures.</p>",
      shuffleAnswers: true,
      allowMultipleAttempts: true,
      allowedAttempts: 2,
      createdAt: now - 86400000 * 3,
    },
    {
      id: `seed_quiz_past_${courseId}`,
      title: "Midterm Review Quiz",
      dueAt: now - 30 * 86400000,
      points: 20,
      timeLimitMinutes: 45,
      questionCount: 10,
      published: true,
      status: "published",
      description: "<p>Practice quiz for the midterm exam.</p>",
      createdAt: now - 86400000 * 45,
    },
    {
      id: `seed_quiz_draft_${courseId}`,
      title: "Final Exam (draft)",
      dueAt: now + 60 * 86400000,
      points: 100,
      timeLimitMinutes: 120,
      questionCount: 25,
      published: false,
      status: "draft",
      description: "<p>Comprehensive final — not yet visible to students.</p>",
      createdAt: now - 86400000,
    },
  ];
}

function ensureDemoQuizzes(courseId: string, items: Quiz[]): Quiz[] {
  const publishedSeeds = seedQuizzes(courseId).filter((q) => q.status === "published" || q.published);
  const ids = new Set(items.map((q) => q.id));
  const missing = publishedSeeds.filter((q) => !ids.has(q.id));
  if (missing.length === 0) return items;
  return dedupeById([...missing, ...items]);
}

export function loadQuizzes(courseId: string): Quiz[] {
  try {
    const raw = window.localStorage.getItem(quizzesKey(courseId));
    if (!raw) {
      const seed = seedQuizzes(courseId);
      saveQuizzes(courseId, seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    const deduped = dedupeById(arr);
    const merged = ensureDemoQuizzes(courseId, deduped);
    if (merged.length !== deduped.length) {
      saveQuizzes(courseId, merged);
    }
    return merged.filter((q) => !q.deletedAt);
  } catch {
    return seedQuizzes(courseId);
  }
}

export function saveQuizzes(courseId: string, items: Quiz[]) {
  try {
    window.localStorage.setItem(quizzesKey(courseId), JSON.stringify(dedupeById(items)));
    window.dispatchEvent(new Event("canvasClone:quizzesChanged"));
  } catch {}
}

export function getQuizById(courseId: string, quizId: string): Quiz | undefined {
  return loadQuizzes(courseId).find((q) => q.id === quizId);
}

export function autoPublishQuiz(q: Quiz, now = Date.now()): Quiz {
  let next = q;
  if (next.status === "draft" && next.publishAt && next.publishAt <= now) {
    next = {
      ...next,
      status: "published",
      published: true,
      publishAt: undefined,
      updatedAt: now,
    };
  }
  if (
    (next.status === "published" || next.published) &&
    typeof next.unpublishAt === "number" &&
    next.unpublishAt <= now
  ) {
    next = {
      ...next,
      status: "draft",
      published: false,
      unpublishAt: undefined,
      updatedAt: now,
    };
  }
  return next;
}

export function duplicateQuiz(q: Quiz): Quiz {
  const now = Date.now();
  const remapQuestion = (question: QuizQuestion): QuizQuestion => ({
    ...question,
    id: uid("qq"),
    codeTests: question.codeTests?.map((t) => ({ ...t, id: uid("ct") })),
    groupQuestions: question.groupQuestions?.map(remapQuestion),
    matchingPairs: question.matchingPairs?.map((p) => ({ ...p, id: uid("mp") })),
  });
  const questions = normalizeQuizQuestions(q.questions).map(remapQuestion);
  return {
    ...q,
    // Preserve quizType, accessCode, hideScoreUntilGraded, and other settings via spread.
    id: uid("quiz"),
    title: `${q.title} (copy)`,
    status: "draft",
    published: false,
    publishAt: undefined,
    questions,
    questionCount: questions.length,
    quizType: q.quizType,
    accessCode: q.accessCode,
    hideScoreUntilGraded: q.hideScoreUntilGraded,
    lockOnLeave: q.lockOnLeave,
    maxLeaveCount: q.maxLeaveCount,
    createdAt: now,
    updatedAt: now,
  };
}

/** Duplicate a quiz into another course's quiz list (draft). */
export function copyQuizToCourse(
  quiz: Quiz,
  targetCourseId: string,
): Quiz {
  const copy = duplicateQuiz(quiz);
  const existing = loadQuizzes(targetCourseId);
  saveQuizzes(targetCourseId, [copy, ...existing]);
  return copy;
}

export function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

export function createCodeTestCase(): CodeTestCase {
  return { id: uid("ct"), stdin: "", expectedStdout: "", hidden: false, weight: 1 };
}

/** Attach expectedHash so plaintext expected can be stripped on take. */
export function withCodeTestHashes(
  language: CodeLanguage | string | undefined,
  tests: CodeTestCase[] | undefined,
): CodeTestCase[] | undefined {
  if (!tests?.length) return tests;
  if (!isCodeRunnerLanguage(language)) return tests;
  return tests.map((t) => {
    const expected = t.expectedStdout ?? "";
    if (!expected.trim()) return t;
    // CSS property checklists / computed lines stay plaintext (requirements).
    if (
      language === "css" &&
      expected.trim() &&
      !expected.includes("{") &&
      !/^computed:/im.test(expected)
    ) {
      return t;
    }
    // Regex judges don't need a hash of expectedStdout.
    if ((t.expectedRegex ?? "").trim()) return t;
    return {
      ...t,
      expectedHash: t.expectedHash ?? hashForCodeTest(expected),
    };
  });
}

function hashForCodeTest(expected: string): string {
  // Lazy inline FNV — mirrors codeRunnerHtml.hashNormalizedSource without circular import.
  const n = expected
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let h = 2166136261;
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Strip answer keys from coding questions shown while taking.
 * Keeps expectedHash; clears full expectedStdout (except CSS property checklists).
 * Hidden tests clear stdin/expected entirely for students.
 */
export function sanitizeQuestionForStudent(question: QuizQuestion): QuizQuestion {
  if (question.type !== "coding" || !isCodeRunnerLanguage(question.language)) {
    return question;
  }
  const tests = withCodeTestHashes(question.language, question.codeTests);
  if (!tests) return question;
  return {
    ...question,
    correctCode: undefined,
    codeTests: tests.map((t) => {
      if (t.hidden) {
        return {
          ...t,
          stdin: "",
          expectedStdout: "",
          expectedRegex: undefined,
          assertJs: undefined,
          expectedHash: t.expectedHash,
        };
      }
      const expected = t.expectedStdout ?? "";
      if (
        question.language === "css" &&
        expected.trim() &&
        !expected.includes("{") &&
        !/^computed:/im.test(expected)
      ) {
        return t;
      }
      if ((t.expectedRegex ?? "").trim()) {
        return { ...t, expectedStdout: "" };
      }
      if (!expected.trim()) return t;
      return {
        ...t,
        expectedStdout: "",
        expectedHash: t.expectedHash ?? hashForCodeTest(expected),
        assertJs: undefined,
      };
    }),
  };
}

export const JAVA_STARTER_CODE = `class Main {
  public static void main(String[] args) throws Exception {
    java.util.Scanner sc = new java.util.Scanner(System.in);
    // TODO: read input and print the answer
  }
}
`;

export const CODE_STARTER_TEMPLATES: Partial<Record<CodeLanguage, string>> = {
  javascript: `// Read from stdin (string). Print with console.log.
const line = stdin.trim();
console.log(line);
`,
  typescript: `// Read from stdin (string). Print with console.log.
const line: string = stdin.trim();
console.log(line);
`,
  python: `# Read from stdin. Print with print().
line = stdin.strip()
print(line)
`,
  java: JAVA_STARTER_CODE,
  cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);
  string line;
  getline(cin, line);
  cout << line << "\\n";
  return 0;
}
`,
  c: `#include <stdio.h>
int main(void) {
  char buf[1024];
  if (fgets(buf, sizeof buf, stdin)) {
    fputs(buf, stdout);
  }
  return 0;
}
`,
  sql: `-- Write a SELECT (schema may be provided in SQL setup).
SELECT 1;
`,
  html: `<!DOCTYPE html>
<html>
  <body>
    <h1>Hello</h1>
  </body>
</html>
`,
  css: `.target {
  color: navy;
}
`,
  other: `// Other languages are manual / GradePro only (no auto runner).
`,
};

/** Optional insertable snippets for the coding editor (not full LSP). */
export const CODE_SNIPPETS: Partial<
  Record<CodeLanguage, { label: string; insert: string }[]>
> = {
  javascript: [
    { label: "for loop", insert: "for (let i = 0; i < n; i++) {\n  \n}\n" },
    { label: "parseInt", insert: "const n = Number(stdin.trim());\n" },
  ],
  typescript: [
    { label: "for loop", insert: "for (let i = 0; i < n; i++) {\n  \n}\n" },
    { label: "parseInt", insert: "const n: number = Number(stdin.trim());\n" },
  ],
  python: [
    { label: "for range", insert: "for i in range(n):\n    pass\n" },
    { label: "map ints", insert: "nums = list(map(int, stdin.split()))\n" },
  ],
  java: [
    { label: "read int", insert: "int n = sc.nextInt();\n" },
  ],
  sql: [
    { label: "SELECT *", insert: "SELECT * FROM table_name;\n" },
  ],
};

export function starterForLanguage(language: CodeLanguage | string | undefined): string {
  if (!language) return "";
  return CODE_STARTER_TEMPLATES[language as CodeLanguage] ?? "";
}

/** Combine multi-file sources for the runner. */
export function combineCodeFiles(
  files: CodeFile[] | undefined,
  fallback = "",
): string {
  if (!files?.length) return fallback;
  if (files.length === 1) return files[0]!.content;
  const main =
    files.find((f) => f.main) ??
    files.find((f) => /main\./i.test(f.path)) ??
    files[0]!;
  const others = files.filter((f) => f !== main);
  const parts = [
    ...others.map((f) => `// --- ${f.path} ---\n${f.content}`),
    `// --- ${main.path} (main) ---\n${main.content}`,
  ];
  return parts.join("\n\n");
}

/**
 * Expand property-harness cases into concrete stdin tests (JS/TS intended).
 * Deterministic-ish via simple LCG seeded by test id length (stable enough for regrade).
 */
export function expandPropertyHarnessTests(tests: CodeTestCase[]): CodeTestCase[] {
  const out: CodeTestCase[] = [];
  for (const t of tests) {
    const ph = t.propertyHarness;
    if (!ph?.enabled) {
      out.push(t);
      continue;
    }
    const count = Math.min(20, Math.max(1, Math.floor(ph.count ?? 5)));
    const min = Number.isFinite(ph.min) ? Number(ph.min) : 0;
    const max = Number.isFinite(ph.max) ? Number(ph.max) : 100;
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    let seed = 0;
    for (let i = 0; i < t.id.length; i++) seed = (seed * 31 + t.id.charCodeAt(i)) >>> 0;
    for (let i = 0; i < count; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const span = hi - lo + 1;
      const n = lo + (span <= 0 ? 0 : seed % span);
      out.push({
        ...t,
        id: `${t.id}_ph_${i}`,
        label: `${t.label?.trim() || "Property"} #${i + 1} (n=${n})`,
        stdin: String(n),
        expectedStdout: (t.expectedStdout ?? "").split("{{n}}").join(String(n)),
        propertyHarness: undefined,
      });
    }
  }
  return out;
}

/** True when this coding question should auto-grade via the JS test runner. */
export function codingUsesTestRunner(
  question: Pick<QuizQuestion, "type" | "language" | "codeTests">,
): boolean {
  if (question.type !== "coding") return false;
  if (!isCodeRunnerLanguage(question.language)) return false;
  return (question.codeTests ?? []).length > 0;
}

/** Walk top-level and group-member questions. */
export function forEachQuizQuestion(
  questions: QuizQuestion[],
  visit: (q: QuizQuestion, path: string) => void,
  pathPrefix = "",
): void {
  questions.forEach((q, i) => {
    const path = pathPrefix ? `${pathPrefix}.${i + 1}` : `${i + 1}`;
    visit(q, path);
    if (q.type === "group") {
      forEachQuizQuestion(q.groupQuestions ?? [], visit, path);
    }
  });
}

export type QuizChecklistItem = {
  id: string;
  severity: "error" | "warning";
  message: string;
};

/**
 * Publish/save validation: missing keys, empty quizzes, coding samples, etc.
 * Errors should block publish; warnings are soft (publish anyway).
 */
export function getQuizPublishChecklist(
  quiz: Pick<Quiz, "title" | "questions" | "quizType" | "points">,
): QuizChecklistItem[] {
  const items: QuizChecklistItem[] = [];
  const survey = getQuizType(quiz) === "survey";
  const title = (quiz.title ?? "").trim();
  if (!title) {
    items.push({ id: "title", severity: "error", message: "Add a quiz title." });
  }

  const topLevel = normalizeQuizQuestions(quiz.questions ?? []);
  if (topLevel.length === 0) {
    items.push({
      id: "no-questions",
      severity: "error",
      message: "Add at least one question before publishing.",
    });
    return items;
  }

  if (!survey && !(typeof quiz.points === "number" && quiz.points > 0)) {
    items.push({
      id: "points",
      severity: "warning",
      message: "Quiz points are 0 — it may not appear in the gradebook.",
    });
  }

  forEachQuizQuestion(topLevel, (q, path) => {
    if (q.type === "note" || q.type === "group") return;
    const label = `Q${path}`;

    if (!survey) {
      if (q.type === "multiple_choice" && typeof q.correctChoiceIndex !== "number") {
        items.push({
          id: `mc-${q.id}`,
          severity: "warning",
          message: `${label}: multiple choice has no correct option marked.`,
        });
      }
      if (
        q.type === "multiple_answers" &&
        !(q.correctChoiceIndices ?? []).length
      ) {
        items.push({
          id: `ma-${q.id}`,
          severity: "warning",
          message: `${label}: multiple answers has no correct options marked.`,
        });
      }
      if (q.type === "true_false" && typeof q.correctTrueFalse !== "boolean") {
        items.push({
          id: `tf-${q.id}`,
          severity: "warning",
          message: `${label}: true/false has no correct value.`,
        });
      }
      if (
        (q.type === "fill_in_blank" || q.type === "short_answer") &&
        !(q.correctShortAnswer ?? "").trim() &&
        !(q.acceptedAnswers ?? []).some((a) => a.trim())
      ) {
        items.push({
          id: `blank-${q.id}`,
          severity: "warning",
          message: `${label}: no accepted answer for auto-grade.`,
        });
      }
      if (q.type === "numerical" && typeof q.correctNumber !== "number") {
        items.push({
          id: `num-${q.id}`,
          severity: "warning",
          message: `${label}: numerical question has no correct value.`,
        });
      }
      if (
        q.type === "coding" &&
        (q.codeTests ?? []).length > 0 &&
        !(q.correctCode ?? "").trim()
      ) {
        items.push({
          id: `sample-${q.id}`,
          severity: "warning",
          message: `${label}: coding has tests but no sample answer (printed on answer key).`,
        });
      }
    }
  });

  return items;
}

/** Coding questions that have tests but an empty sample answer. */
export function codingQuestionsMissingSample(questions: QuizQuestion[]): QuizQuestion[] {
  const missing: QuizQuestion[] = [];
  forEachQuizQuestion(questions, (q) => {
    if (
      q.type === "coding" &&
      (q.codeTests ?? []).length > 0 &&
      !(q.correctCode ?? "").trim()
    ) {
      missing.push(q);
    }
  });
  return missing;
}
