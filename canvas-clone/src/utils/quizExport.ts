import type {
  Quiz,
  QuizQuestion,
  QuizScoringPolicy,
  QuizType,
  SoftOriginalitySettings,
} from "./quizzes";
import { normalizeQuizQuestions } from "./quizzes";
import type { QuizBankPool, LegacyQuizBankPool } from "./quizzes";

/** Portable quiz JSON — questions import via parseBankJson / parseBankImport. */
export type QuizExportPayload = {
  version: 1;
  kind: "quiz";
  title: string;
  questions: QuizQuestion[];
  exportedAt: number;
  /** Subset of quiz settings for documentation / future round-trip. */
  settings?: QuizExportSettings;
  bankPool?: QuizBankPool | LegacyQuizBankPool;
};

/** Full client-side settings round-trip (#72). */
export type QuizExportSettings = {
  points?: number;
  quizType?: QuizType;
  description?: string;
  timeLimitMinutes?: number;
  shuffleAnswers?: boolean;
  shuffleQuestions?: boolean;
  oneQuestionAtATime?: boolean;
  lockPreviousQuestions?: boolean;
  allowMultipleAttempts?: boolean;
  allowedAttempts?: number;
  scoringPolicy?: QuizScoringPolicy;
  partialCredit?: boolean;
  partialCreditPenalty?: boolean;
  nearMatchThreshold?: number;
  guessingPenalty?: number;
  requireEssayComment?: boolean;
  unpublishAt?: number;
  accessCodeExpiresAt?: number;
  oneTimeAccessToken?: string;
  previewShareKey?: string;
  practiceInstantFeedback?: boolean;
  practiceRetakeWrongOnly?: boolean;
  practiceScorePreview?: boolean;
  allowedSections?: string[];
  letStudentsSeeResponses?: boolean;
  showCorrectAnswers?: boolean;
  hideScoreUntilGraded?: boolean;
  anonymousGrading?: boolean;
  dueAt?: number;
  availableFrom?: number;
  availableUntil?: number;
  accessCode?: string;
  lockOnLeave?: boolean;
  maxLeaveCount?: number;
  warnOnLeave?: boolean;
  lockOnBlur?: boolean;
  requireFullscreen?: boolean;
  idleTimeoutMinutes?: number;
  softDisablePaste?: boolean;
  requireViewAllQuestions?: boolean;
  collectSeatNumber?: boolean;
  requireSeatNumber?: boolean;
  showResponsesOnlyOnce?: boolean;
  showCorrectAnswersAt?: number;
  hideCorrectAnswersAt?: number;
  groupId?: string;
  softOriginality?: SoftOriginalitySettings;
  monacoEditor?: boolean;
};

export function buildQuizExportSettings(quiz: Quiz): QuizExportSettings {
  const settings: QuizExportSettings = {};
  if (typeof quiz.points === "number") settings.points = quiz.points;
  if (quiz.quizType) settings.quizType = quiz.quizType;
  if (quiz.description) settings.description = quiz.description;
  if (typeof quiz.timeLimitMinutes === "number") {
    settings.timeLimitMinutes = quiz.timeLimitMinutes;
  }
  if (quiz.shuffleAnswers) settings.shuffleAnswers = true;
  if (quiz.shuffleQuestions) settings.shuffleQuestions = true;
  if (quiz.oneQuestionAtATime) settings.oneQuestionAtATime = true;
  if (quiz.lockPreviousQuestions) settings.lockPreviousQuestions = true;
  if (quiz.allowMultipleAttempts) settings.allowMultipleAttempts = true;
  if (typeof quiz.allowedAttempts === "number") {
    settings.allowedAttempts = quiz.allowedAttempts;
  }
  if (quiz.scoringPolicy) settings.scoringPolicy = quiz.scoringPolicy;
  if (quiz.partialCredit) settings.partialCredit = true;
  if (quiz.partialCreditPenalty) settings.partialCreditPenalty = true;
  if (typeof quiz.nearMatchThreshold === "number") {
    settings.nearMatchThreshold = quiz.nearMatchThreshold;
  }
  if (typeof quiz.guessingPenalty === "number" && quiz.guessingPenalty > 0) {
    settings.guessingPenalty = quiz.guessingPenalty;
  }
  if (quiz.requireEssayComment) settings.requireEssayComment = true;
  if (typeof quiz.unpublishAt === "number") settings.unpublishAt = quiz.unpublishAt;
  if (typeof quiz.accessCodeExpiresAt === "number") {
    settings.accessCodeExpiresAt = quiz.accessCodeExpiresAt;
  }
  if (quiz.oneTimeAccessToken) settings.oneTimeAccessToken = quiz.oneTimeAccessToken;
  if (quiz.previewShareKey) settings.previewShareKey = quiz.previewShareKey;
  if (quiz.practiceInstantFeedback) settings.practiceInstantFeedback = true;
  if (quiz.practiceRetakeWrongOnly) settings.practiceRetakeWrongOnly = true;
  if (quiz.practiceScorePreview) settings.practiceScorePreview = true;
  if (quiz.allowedSections?.length) settings.allowedSections = [...quiz.allowedSections];
  if (quiz.letStudentsSeeResponses === false) {
    settings.letStudentsSeeResponses = false;
  }
  if (quiz.showCorrectAnswers === false) settings.showCorrectAnswers = false;
  if (quiz.hideScoreUntilGraded) settings.hideScoreUntilGraded = true;
  if (quiz.anonymousGrading) settings.anonymousGrading = true;
  if (typeof quiz.dueAt === "number") settings.dueAt = quiz.dueAt;
  if (typeof quiz.availableFrom === "number") settings.availableFrom = quiz.availableFrom;
  if (typeof quiz.availableUntil === "number") settings.availableUntil = quiz.availableUntil;
  if (quiz.accessCode) settings.accessCode = quiz.accessCode;
  if (quiz.lockOnLeave) settings.lockOnLeave = true;
  if (typeof quiz.maxLeaveCount === "number") settings.maxLeaveCount = quiz.maxLeaveCount;
  if (quiz.warnOnLeave) settings.warnOnLeave = true;
  if (quiz.lockOnBlur) settings.lockOnBlur = true;
  if (quiz.requireFullscreen) settings.requireFullscreen = true;
  if (typeof quiz.idleTimeoutMinutes === "number") {
    settings.idleTimeoutMinutes = quiz.idleTimeoutMinutes;
  }
  if (quiz.softDisablePaste) settings.softDisablePaste = true;
  if (quiz.requireViewAllQuestions) settings.requireViewAllQuestions = true;
  if (quiz.collectSeatNumber) settings.collectSeatNumber = true;
  if (quiz.requireSeatNumber === false) settings.requireSeatNumber = false;
  if (quiz.showResponsesOnlyOnce) settings.showResponsesOnlyOnce = true;
  if (typeof quiz.showCorrectAnswersAt === "number") {
    settings.showCorrectAnswersAt = quiz.showCorrectAnswersAt;
  }
  if (typeof quiz.hideCorrectAnswersAt === "number") {
    settings.hideCorrectAnswersAt = quiz.hideCorrectAnswersAt;
  }
  if (quiz.groupId) settings.groupId = quiz.groupId;
  if (quiz.softOriginality) settings.softOriginality = { ...quiz.softOriginality };
  if (typeof quiz.monacoEditor === "boolean") settings.monacoEditor = quiz.monacoEditor;
  return settings;
}

/** Apply exported settings onto a quiz draft (does not set id/status/questions). */
export function applyQuizExportSettings(
  base: Quiz,
  settings?: QuizExportSettings,
): Quiz {
  if (!settings) return base;
  return {
    ...base,
    ...settings,
    softOriginality: settings.softOriginality
      ? { ...settings.softOriginality }
      : base.softOriginality,
  };
}

/** Full quiz export (questions + settings). Re-importable as questions JSON. */
export function exportQuizToJson(quiz: Quiz): string {
  const payload: QuizExportPayload = {
    version: 1,
    kind: "quiz",
    title: quiz.title,
    questions: normalizeQuizQuestions(quiz.questions),
    exportedAt: Date.now(),
    settings: buildQuizExportSettings(quiz),
  };
  if (quiz.bankPool) payload.bankPool = quiz.bankPool;
  return JSON.stringify(payload, null, 2);
}

/** Questions-only export (same shape banks use, plus kind for clarity). */
export function exportQuizQuestionsToJson(
  title: string,
  questions: QuizQuestion[],
): string {
  const payload: QuizExportPayload = {
    version: 1,
    kind: "quiz",
    title: title.trim() || "Quiz questions",
    questions: normalizeQuizQuestions(questions),
    exportedAt: Date.now(),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadJsonFile(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function quizExportFilename(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "quiz"}.json`;
}
