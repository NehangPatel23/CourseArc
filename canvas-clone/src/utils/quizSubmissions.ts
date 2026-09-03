import { loadUser } from "./userStore";
import { recordAudit } from "./auditLog";
import type { FeedbackEntry, SubmissionComment } from "./assignmentSubmissions";
import type { RubricAssessment } from "./assignmentRubric";
import {
  collectQuizQuestionIds,
  collectQuizQuestionLookup,
  codingUsesTestRunner,
  combineCodeFiles,
  expandQuizQuestionGroups,
  flattenQuizQuestionItems,
  getQuizType,
  normalizeCode,
  normalizeQuizBankPool,
  normalizeQuizQuestions,
  scaleQuestionsToTargetPoints,
  totalQuizQuestionPoints,
  uid,
  type Quiz,
  type QuizQuestion,
} from "./quizzes";
import {
  runCodeTests,
  scoreFromCodeTestResults,
  type CodeTestRunResult,
} from "./codeRunner";
import {
  getQuestionBank,
  getQuestionsAcrossBanks,
  loadQuestionBanks,
  seededPickIds,
  seededShuffle,
} from "./questionBanks";
import { getCourseById } from "./coursesStore";
import { notifyQuizSubmitted } from "./notifications";
import {
  evaluateFormula,
} from "./quizFormula";
import { getEffectiveQuizAccommodation } from "./quizAccommodations";

export type QuizAnswer = {
  questionId: string;
  /** multiple_choice */
  choiceIndex?: number;
  /** multiple_answers */
  choiceIndices?: number[];
  /** true_false */
  trueFalse?: boolean;
  /** short_answer + fill_in_blank + inline_code + coding */
  shortAnswer?: string;
  /** numerical */
  number?: number;
  /** matching — pairId -> chosen right-side value */
  matches?: Record<string, string>;
  /** ordering — current order as indices into orderingItems */
  ordering?: number[];
  /** fill_in_multiple_blanks — blankId -> response */
  blankAnswers?: Record<string, string>;
  /** calculated — generated variable values for this attempt */
  calculatedVars?: Record<string, number>;
  /** likert — selected scale value */
  likertValue?: number;
  /** hotspot — selected region id(s) */
  hotspotIds?: string[];
  /** essay — required reflection comment (#85) */
  essayComment?: string;
  /** file_upload */
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  fileStorageKey?: string;
  /** Coding test-runner outcomes (stored on submit for review / sync regrade). */
  codeTestResults?: CodeTestRunResult[];
};

/** True when the student supplied any response for a question. */
export function hasAnswer(answer?: QuizAnswer): boolean {
  if (!answer) return false;
  return (
    typeof answer.choiceIndex === "number" ||
    (Array.isArray(answer.choiceIndices) && answer.choiceIndices.length > 0) ||
    typeof answer.trueFalse === "boolean" ||
    (typeof answer.shortAnswer === "string" && answer.shortAnswer.trim() !== "") ||
    typeof answer.number === "number" ||
    (typeof answer.shortAnswer === "string" && answer.shortAnswer.trim() !== "") ||
    (answer.matches != null && Object.keys(answer.matches).length > 0) ||
    (Array.isArray(answer.ordering) && answer.ordering.length > 0) ||
    (answer.blankAnswers != null && Object.keys(answer.blankAnswers).length > 0) ||
    (answer.calculatedVars != null && Object.keys(answer.calculatedVars).length > 0) ||
    typeof answer.likertValue === "number" ||
    (Array.isArray(answer.hotspotIds) && answer.hotspotIds.length > 0) ||
    (typeof answer.essayComment === "string" && answer.essayComment.trim() !== "") ||
    Boolean(answer.fileStorageKey || (answer.fileName && answer.fileName.trim()))
  );
}

/** Why an attempt was submitted (soft proctor / Moderate force-end). */
export type QuizSubmitReason =
  | "timeout"
  | "max_leaves"
  | "manual"
  | "force_end"
  | "idle";

export type QuizAttempt = {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  attemptNumber: number;
  answers: QuizAnswer[];
  score: number;
  maxScore: number;
  /** Whether every question was auto-gradable (short answers with a key). */
  autoGraded: boolean;
  submittedAt: number;
  /** How the attempt was submitted (defaults to manual when omitted). */
  submitReason?: QuizSubmitReason;
  /** Instructor override of the auto-computed score (takes precedence when set). */
  manualScore?: number;
  /**
   * Points added (or subtracted) on top of the base score (manual or auto).
   * Effective score = (manualScore ?? score) + (fudgePoints ?? 0).
   */
  fudgePoints?: number;
  gradedAt?: number;
  gradedBy?: string;
  comments?: SubmissionComment[];
  feedbackEntries?: FeedbackEntry[];
  /** Instructor's manually adjusted points per question (questionId -> earned). */
  questionScores?: Record<string, number>;
  /**
   * Per-question rubric assessments for essay questions (questionId -> criteria).
   * Drives `questionScores` when grading with a rubric in GradePro.
   */
  questionRubricAssessments?: Record<string, RubricAssessment[]>;
  /** Set once the student has viewed their responses (for show-once gating). */
  responsesViewed?: boolean;
  /** Question ids used for this attempt (bank pool or inline subset). */
  questionIds?: string[];
  /** When the student began this attempt (from in-progress progress). */
  startedAt?: number;
  /** Accumulated focus/view time per question (ms) for analytics. */
  questionTimeMs?: Record<string, number>;
  /** Tab-leave count when lock-on-leave was enabled. */
  leaveCount?: number;
  /** Timestamps of leave events. */
  leaveEvents?: number[];
  /** Questions the student marked for review while taking. */
  markedForReview?: string[];
  /** Optional seat / station number. */
  seatNumber?: string;
  clientMeta?: { userAgent?: string; timezone?: string };
  /**
   * Soft originality snapshot computed at submit time against peers already on file.
   * Recomputed live in reports; this is a point-in-time flag for Moderate / inbox.
   */
  softOriginalitySnapshot?: {
    overallPct: number;
    peerPct: number;
    selfPct: number;
    matchCount: number;
    peerMatchCount: number;
    selfMatchCount: number;
    computedAt: number;
  };
  /** Instructor pinned this attempt as the one that counts (overrides scoring policy). */
  keepForGrade?: boolean;
};

/** True when an essay question requires a reflection comment before submit. */
export function questionRequiresEssayComment(
  quiz: Quiz,
  question: QuizQuestion,
): boolean {
  if (question.type !== "essay") return false;
  return Boolean(quiz.requireEssayComment || question.requireEssayComment);
}

/** True when the student answered the essay but omitted a required reflection comment. */
export function isEssayCommentMissing(
  quiz: Quiz,
  question: QuizQuestion,
  answer?: QuizAnswer,
): boolean {
  if (!questionRequiresEssayComment(quiz, question)) return false;
  if (!hasAnswer(answer)) return false;
  return (answer?.essayComment ?? "").trim() === "";
}

/** Stable seed for shuffle + bank draws for a given attempt number. */
export function quizAttemptShuffleSeed(
  quizId: string,
  studentId: string,
  attemptNumber: number,
): string {
  return `${studentId}:${quizId}:attempt${Math.max(1, attemptNumber)}`;
}

/** Remap choice indices / display order for one question (attempt-stable). */
export function shuffleQuestionAnswers(question: QuizQuestion, seed: string): QuizQuestion {
  switch (question.type) {
    case "multiple_choice": {
      const choices = question.choices ?? [];
      if (choices.length <= 1) return question;
      const order = seededShuffle(
        choices.map((_, i) => i),
        seed,
      );
      const remapped = order.map((i) => choices[i]);
      const correctSrc = question.correctChoiceIndex ?? 0;
      return {
        ...question,
        choices: remapped,
        correctChoiceIndex: Math.max(0, order.indexOf(correctSrc)),
      };
    }
    case "multiple_answers": {
      const choices = question.choices ?? [];
      if (choices.length <= 1) return question;
      const order = seededShuffle(
        choices.map((_, i) => i),
        seed,
      );
      const remapped = order.map((i) => choices[i]);
      const correctChoiceIndices = (question.correctChoiceIndices ?? [])
        .map((i) => order.indexOf(i))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      return { ...question, choices: remapped, correctChoiceIndices };
    }
    case "true_false": {
      const trueFalseOrder = seededShuffle([true, false], seed);
      return { ...question, trueFalseOrder };
    }
    case "matching": {
      const pairs = question.matchingPairs ?? [];
      if (pairs.length === 0) return question;
      const matchingPairs = seededShuffle(pairs, `${seed}:lefts`);
      const rights = [...new Set(pairs.map((p) => p.right).filter(Boolean))];
      const matchingRightOrder = seededShuffle(rights, `${seed}:rights`);
      return { ...question, matchingPairs, matchingRightOrder };
    }
    default:
      return question;
  }
}

/**
 * Apply quiz shuffle settings to a resolved question list.
 * When `preserveOrder` is true (replaying `questionIds`), skip question-order shuffle.
 */
export function applyQuizShuffles(
  questions: QuizQuestion[],
  quiz: Pick<Quiz, "shuffleAnswers" | "shuffleQuestions">,
  seed: string,
  opts?: { preserveOrder?: boolean },
): QuizQuestion[] {
  let next = questions;
  if (quiz.shuffleQuestions && !opts?.preserveOrder) {
    next = seededShuffle(next, `${seed}:qorder`);
  }
  if (quiz.shuffleAnswers) {
    next = next.map((q) => shuffleQuestionAnswers(q, `${seed}:ans:${q.id}`));
  }
  return next;
}

/** Resolve the question set for a quiz attempt (inline + optional bank pool). */
export function resolveQuizQuestions(
  courseId: string,
  quiz: Quiz,
  opts?: {
    studentId?: string;
    attemptId?: string;
    attemptNumber?: number;
    questionIds?: string[];
  },
): QuizQuestion[] {
  const inline = normalizeQuizQuestions(quiz.questions);
  const pool = normalizeQuizBankPool(quiz.bankPool);
  const bankIds = pool?.sources.map((s) => s.bankId) ?? [];
  const studentId = opts?.studentId ?? "anon";
  const attemptNumber = opts?.attemptNumber ?? 1;
  const shuffleSeed = quizAttemptShuffleSeed(quiz.id, studentId, attemptNumber);
  // Bank draws keep attemptId in the seed so preview vs live can differ; shuffle uses attemptNumber.
  const bankSeed = `${opts?.attemptId ?? "preview"}:${studentId}:${quiz.id}`;

  const expandInlineAndBanks = (): QuizQuestion[] => {
    const expanded = expandQuizQuestionGroups(inline, bankSeed, seededPickIds);
    const fromBanks = pickBankPoolQuestions(
      courseId,
      quiz,
      pool,
      { ...opts, bankSeed },
      collectQuizQuestionIds(inline),
    );
    return fromBanks.length === 0 ? expanded : [...expanded, ...fromBanks];
  };

  let resolved: QuizQuestion[];
  const replaying = Boolean(opts?.questionIds && opts.questionIds.length > 0);

  if (replaying) {
    const lookup = collectQuizQuestionLookup(inline);
    const replayIds = opts!.questionIds!;
    const searchBankIds =
      bankIds.length > 0 ? bankIds : loadQuestionBanks(courseId).map((b) => b.id);
    if (searchBankIds.length > 0) {
      for (const q of getQuestionsAcrossBanks(courseId, searchBankIds, replayIds)) {
        lookup.set(q.id, q);
      }
    }
    let picked = replayIds.map((id) => lookup.get(id)).filter(Boolean) as QuizQuestion[];
    if (picked.length === 0 && bankIds.length > 0) {
      const allBankIds = loadQuestionBanks(courseId).map((b) => b.id);
      for (const q of getQuestionsAcrossBanks(courseId, allBankIds, replayIds)) {
        lookup.set(q.id, q);
      }
      picked = replayIds.map((id) => lookup.get(id)).filter(Boolean) as QuizQuestion[];
    }
    // Fall back to a fresh expand (inline + banks) if stored ids no longer resolve.
    resolved = picked.length > 0 ? picked : expandInlineAndBanks();
  } else {
    resolved = expandInlineAndBanks();
  }

  resolved = applyQuizShuffles(resolved, quiz, shuffleSeed, {
    preserveOrder: replaying,
  });

  // Scale weights so the attempt totals the quiz's point value (inline + bank).
  return scaleQuestionsToTargetPoints(resolved, quiz.points);
}

function pickBankPoolQuestions(
  courseId: string,
  quiz: Quiz,
  pool: ReturnType<typeof normalizeQuizBankPool>,
  opts?: { studentId?: string; attemptId?: string; bankSeed?: string },
  excludeIds: Set<string> = new Set(),
): QuizQuestion[] {
  if (!pool || pool.sources.length === 0) return [];
  const bankIds = pool.sources.map((s) => s.bankId);
  const baseSeed =
    opts?.bankSeed ??
    `${opts?.attemptId ?? "preview"}:${opts?.studentId ?? "anon"}:${quiz.id}`;

  if (pool.mode === "combined") {
    const total = pool.totalPickCount ?? 0;
    if (total <= 0) return [];
    const seen = new Set<string>(excludeIds);
    const combinedIds: string[] = [];
    for (const src of pool.sources) {
      const bank = getQuestionBank(courseId, src.bankId);
      if (!bank) continue;
      for (const q of bank.questions) {
        if (seen.has(q.id)) continue;
        seen.add(q.id);
        combinedIds.push(q.id);
      }
    }
    if (combinedIds.length === 0) return [];
    const ids = seededPickIds(combinedIds, total, `${baseSeed}:combined`);
    return getQuestionsAcrossBanks(courseId, bankIds, ids);
  }

  const out: QuizQuestion[] = [];
  const used = new Set(excludeIds);
  for (const src of pool.sources) {
    if (src.pickCount <= 0) continue;
    const bank = getQuestionBank(courseId, src.bankId);
    if (!bank || bank.questions.length === 0) continue;
    const candidateIds = bank.questions.map((q) => q.id).filter((id) => !used.has(id));
    const ids = seededPickIds(candidateIds, src.pickCount, `${baseSeed}:${src.bankId}`);
    for (const id of ids) used.add(id);
    out.push(...getQuestionsAcrossBanks(courseId, [src.bankId], ids));
  }
  return out;
}

/** The score that counts: an instructor override if present, else the auto score, plus fudge. */
export function getAttemptEffectiveScore(attempt: QuizAttempt): number {
  const base = typeof attempt.manualScore === "number" ? attempt.manualScore : attempt.score;
  const fudge =
    typeof attempt.fudgePoints === "number" && Number.isFinite(attempt.fudgePoints)
      ? attempt.fudgePoints
      : 0;
  return base + fudge;
}

/** Base score before fudge (manual override or auto). */
export function getAttemptBaseScore(attempt: QuizAttempt): number {
  return typeof attempt.manualScore === "number" ? attempt.manualScore : attempt.score;
}

export const QUIZ_ATTEMPTS_CHANGED_EVENT = "canvasClone:quizAttemptsChanged";

export function quizAttemptsKey(courseId: string) {
  return `canvasClone:quizAttempts:${courseId}`;
}

export function loadQuizAttempts(courseId: string): QuizAttempt[] {
  try {
    const raw = window.localStorage.getItem(quizAttemptsKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQuizAttempts(courseId: string, attempts: QuizAttempt[]) {
  try {
    window.localStorage.setItem(quizAttemptsKey(courseId), JSON.stringify(attempts));
    window.dispatchEvent(new Event(QUIZ_ATTEMPTS_CHANGED_EVENT));
  } catch {}
}

export function getAttemptsForQuiz(courseId: string, quizId: string): QuizAttempt[] {
  return loadQuizAttempts(courseId).filter((a) => a.quizId === quizId);
}

/** Delete a single attempt. Does not renumber remaining attempts. */
export function deleteQuizAttempt(courseId: string, attemptId: string): boolean {
  const all = loadQuizAttempts(courseId);
  const next = all.filter((a) => a.id !== attemptId);
  if (next.length === all.length) return false;
  saveQuizAttempts(courseId, next);
  return true;
}

/** Pin one attempt as the grade that counts (clears keep on sibling attempts). */
export function setAttemptKeepForGrade(
  courseId: string,
  attemptId: string,
  keep: boolean,
): boolean {
  const all = loadQuizAttempts(courseId);
  const idx = all.findIndex((a) => a.id === attemptId);
  if (idx < 0) return false;
  const target = all[idx]!;
  const next = all.map((a) => {
    if (a.quizId !== target.quizId || a.studentId !== target.studentId) return a;
    if (a.id === attemptId) {
      return keep ? { ...a, keepForGrade: true } : { ...a, keepForGrade: undefined };
    }
    if (keep) return { ...a, keepForGrade: undefined };
    return a;
  });
  saveQuizAttempts(courseId, next);
  return true;
}

/** Delete every attempt for one student on one quiz. */
export function deleteStudentQuizAttempts(
  courseId: string,
  quizId: string,
  studentId: string,
): number {
  const all = loadQuizAttempts(courseId);
  const next = all.filter((a) => !(a.quizId === quizId && a.studentId === studentId));
  const removed = all.length - next.length;
  if (removed > 0) saveQuizAttempts(courseId, next);
  return removed;
}

export function getStudentAttemptsForQuiz(
  courseId: string,
  quizId: string,
  studentId = loadUser().id,
): QuizAttempt[] {
  return getAttemptsForQuiz(courseId, quizId)
    .filter((a) => a.studentId === studentId)
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
}

export function getBestStudentAttempt(
  courseId: string,
  quizId: string,
  studentId = loadUser().id,
): QuizAttempt | undefined {
  const attempts = getStudentAttemptsForQuiz(courseId, quizId, studentId);
  if (attempts.length === 0) return undefined;
  return attempts.reduce(
    (best, a) =>
      getAttemptEffectiveScore(a) > getAttemptEffectiveScore(best) ? a : best,
    attempts[0],
  );
}

/**
 * The attempt that "counts" for gradebook / GradePro deep links under the
 * quiz scoring policy. For average (no single attempt), returns the latest.
 */
export function getScoringPolicyAttempt(
  courseId: string,
  quiz: Quiz,
  studentId = loadUser().id,
): QuizAttempt | undefined {
  const attempts = getStudentAttemptsForQuiz(courseId, quiz.id, studentId);
  if (attempts.length === 0) return undefined;
  const kept = attempts.filter((a) => a.keepForGrade);
  if (kept.length === 1) return kept[0];
  const policy = quiz.scoringPolicy ?? "highest";
  if (policy === "latest" || policy === "average") {
    return attempts[attempts.length - 1];
  }
  if (policy === "first") {
    return attempts[0];
  }
  if (policy === "lowest") {
    return attempts.reduce(
      (worst, a) =>
        getAttemptEffectiveScore(a) < getAttemptEffectiveScore(worst) ? a : worst,
      attempts[0],
    );
  }
  // highest (default)
  return attempts.reduce(
    (best, a) =>
      getAttemptEffectiveScore(a) > getAttemptEffectiveScore(best) ? a : best,
    attempts[0],
  );
}

/**
 * The final score for a student across all attempts, honoring the quiz's
 * scoring policy (highest by default, latest, or average).
 */
export function getStudentFinalScore(
  courseId: string,
  quiz: Quiz,
  studentId = loadUser().id,
): { score: number; maxScore: number; attemptCount: number; fudgePoints?: number } | undefined {
  const attempts = getStudentAttemptsForQuiz(courseId, quiz.id, studentId);
  if (attempts.length === 0) return undefined;
  const kept = attempts.filter((a) => a.keepForGrade);
  if (kept.length === 1) {
    const a = kept[0]!;
    return {
      score: getAttemptEffectiveScore(a),
      maxScore: a.maxScore,
      attemptCount: attempts.length,
      fudgePoints: a.fudgePoints,
    };
  }
  const scores = attempts.map((a) => getAttemptEffectiveScore(a));
  const maxScore = attempts[attempts.length - 1].maxScore;
  const policy = quiz.scoringPolicy ?? "highest";
  let score: number;
  let fudgePoints: number | undefined;
  if (policy === "latest") {
    score = scores[scores.length - 1];
    fudgePoints = attempts[attempts.length - 1]?.fudgePoints;
  } else if (policy === "first") {
    score = scores[0];
    fudgePoints = attempts[0]?.fudgePoints;
  } else if (policy === "lowest") {
    const idx = scores.reduce(
      (best, s, i) => (s < scores[best]! ? i : best),
      0,
    );
    score = scores[idx]!;
    fudgePoints = attempts[idx]?.fudgePoints;
  } else if (policy === "average") {
    score = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const fudgeSum = attempts.reduce((sum, a) => sum + (a.fudgePoints ?? 0), 0);
    fudgePoints = fudgeSum / attempts.length;
  } else {
    const idx = scores.reduce(
      (best, s, i) => (s > scores[best]! ? i : best),
      0,
    );
    score = scores[idx]!;
    fudgePoints = attempts[idx]?.fudgePoints;
  }
  const fudge =
    typeof fudgePoints === "number" && Number.isFinite(fudgePoints) && fudgePoints !== 0
      ? Math.round(fudgePoints * 100) / 100
      : undefined;
  return { score, maxScore, attemptCount: attempts.length, fudgePoints: fudge };
}

/** Per-student attempt breakdown for richer score displays. */
export function getStudentAttemptStats(
  courseId: string,
  quiz: Quiz,
  studentId = loadUser().id,
):
  | {
      attemptCount: number;
      highest: number;
      lowest: number;
      latest: number;
      first: number;
      average: number;
      maxScore: number;
      lastSubmittedAt: number;
    }
  | undefined {
  const attempts = getStudentAttemptsForQuiz(courseId, quiz.id, studentId);
  if (attempts.length === 0) return undefined;
  const scores = attempts.map((a) => getAttemptEffectiveScore(a));
  return {
    attemptCount: attempts.length,
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    latest: scores[scores.length - 1],
    first: scores[0],
    average: scores.reduce((sum, s) => sum + s, 0) / scores.length,
    maxScore: attempts[attempts.length - 1].maxScore,
    lastSubmittedAt: Math.max(...attempts.map((a) => a.submittedAt)),
  };
}

export function getRemainingAttempts(quiz: Quiz, courseId: string, studentId = loadUser().id): number {
  const used = getStudentAttemptsForQuiz(courseId, quiz.id, studentId).length;
  const { extraAttempts } = getEffectiveQuizAccommodation(courseId, studentId, quiz.id);
  if (quiz.allowMultipleAttempts) {
    const allowed = quiz.allowedAttempts;
    if (typeof allowed === "number" && allowed > 0) {
      return Math.max(0, allowed + extraAttempts - used);
    }
    return Infinity;
  }
  return Math.max(0, 1 + extraAttempts - used);
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** True when a question can be automatically graded. */
export function isQuestionAutoGradable(question: QuizQuestion): boolean {
  switch (question.type) {
    case "multiple_choice":
      return typeof question.correctChoiceIndex === "number";
    case "multiple_answers":
      return (question.correctChoiceIndices?.length ?? 0) > 0;
    case "true_false":
      return typeof question.correctTrueFalse === "boolean";
    case "short_answer":
      return Boolean(question.correctShortAnswer && question.correctShortAnswer.trim());
    case "fill_in_blank":
      return (question.acceptedAnswers ?? []).some((a) => a.trim() !== "");
    case "fill_in_multiple_blanks":
      return (question.fillBlanks ?? []).some((b) =>
        (b.acceptedAnswers ?? []).some((a) => a.trim() !== ""),
      );
    case "numerical":
      return typeof question.correctNumber === "number";
    case "ordering":
      return (question.correctOrder?.length ?? 0) > 0;
    case "calculated":
      return Boolean(question.calculatedFormula?.trim());
    case "likert":
      return typeof question.correctLikertValue === "number";
    case "hotspot":
      return (question.correctHotspotIds?.length ?? 0) > 0;
    case "matching":
      return (
        (question.matchingPairs?.length ?? 0) > 0 &&
        (question.matchingPairs ?? []).every((p) => p.left.trim() && p.right.trim())
      );
    case "inline_code":
      return (question.acceptedAnswers ?? []).some((a) => a.trim() !== "");
    case "coding":
      if (codingUsesTestRunner(question)) return true;
      return Boolean(question.autoGradeCode && question.correctCode?.trim());
    case "essay":
    case "file_upload":
      return false;
    case "note":
    case "group":
      return true;
    default:
      return false;
  }
}

export function isAnswerCorrect(question: QuizQuestion, answer?: QuizAnswer): boolean {
  if (question.type === "note" || question.type === "group") return true;
  if (!answer) return false;
  switch (question.type) {
    case "multiple_choice":
      return (
        typeof question.correctChoiceIndex === "number" &&
        answer.choiceIndex === question.correctChoiceIndex
      );
    case "multiple_answers": {
      const key = question.correctChoiceIndices ?? [];
      if (key.length === 0) return false;
      const picked = answer.choiceIndices ?? [];
      if (picked.length !== key.length) return false;
      const keySet = new Set(key);
      return picked.every((i) => keySet.has(i));
    }
    case "true_false":
      return (
        typeof question.correctTrueFalse === "boolean" &&
        answer.trueFalse === question.correctTrueFalse
      );
    case "short_answer": {
      const key = normalizeText(question.correctShortAnswer);
      if (!key) return false;
      return normalizeText(answer.shortAnswer) === key;
    }
    case "fill_in_blank": {
      const accepted = (question.acceptedAnswers ?? [])
        .map((a) => normalizeText(a))
        .filter(Boolean);
      if (accepted.length === 0) return false;
      return accepted.includes(normalizeText(answer.shortAnswer));
    }
    case "fill_in_multiple_blanks": {
      const blanks = question.fillBlanks ?? [];
      if (blanks.length === 0) return false;
      const responses = answer.blankAnswers ?? {};
      return blanks.every((b) => {
        const accepted = (b.acceptedAnswers ?? []).map((a) => normalizeText(a)).filter(Boolean);
        if (accepted.length === 0) return false;
        return accepted.includes(normalizeText(responses[b.id]));
      });
    }
    case "ordering": {
      const key = question.correctOrder ?? [];
      const picked = answer.ordering ?? [];
      if (key.length === 0 || picked.length !== key.length) return false;
      return key.every((v, i) => picked[i] === v);
    }
    case "calculated": {
      const vars = answer.calculatedVars ?? {};
      const expected = evaluateFormula(question.calculatedFormula ?? "", vars);
      if (Number.isNaN(expected)) return false;
      if (typeof answer.number !== "number" || Number.isNaN(answer.number)) return false;
      const tol =
        typeof question.calculatedTolerance === "number"
          ? Math.abs(question.calculatedTolerance)
          : 0;
      return Math.abs(answer.number - expected) <= tol;
    }
    case "likert":
      return (
        typeof question.correctLikertValue === "number" &&
        answer.likertValue === question.correctLikertValue
      );
    case "hotspot": {
      const key = question.correctHotspotIds ?? [];
      const picked = answer.hotspotIds ?? [];
      if (key.length === 0 || picked.length !== key.length) return false;
      const keySet = new Set(key);
      return picked.every((id) => keySet.has(id));
    }
    case "numerical": {
      if (typeof question.correctNumber !== "number") return false;
      if (typeof answer.number !== "number" || Number.isNaN(answer.number)) return false;
      const tol = typeof question.tolerance === "number" ? Math.abs(question.tolerance) : 0;
      return Math.abs(answer.number - question.correctNumber) <= tol;
    }
    case "matching": {
      const pairs = question.matchingPairs ?? [];
      if (pairs.length === 0) return false;
      const matches = answer.matches ?? {};
      return pairs.every((p) => normalizeText(matches[p.id]) === normalizeText(p.right));
    }
    case "inline_code": {
      const accepted = (question.acceptedAnswers ?? [])
        .map((a) => normalizeCode(a))
        .filter(Boolean);
      if (accepted.length === 0) return false;
      return accepted.includes(normalizeCode(answer.shortAnswer ?? ""));
    }
    case "coding": {
      if (codingUsesTestRunner(question)) {
        const results = answer.codeTestResults;
        const tests = question.codeTests ?? [];
        if (!results || results.length === 0) return false;
        if (results.some((r) => r.unsupported)) return false;
        return (
          results.length === tests.length &&
          results.every((r) => r.passed) &&
          tests.every((t) => results.some((r) => r.testId === t.id && r.passed))
        );
      }
      if (!question.autoGradeCode) return false;
      const key = normalizeCode(question.correctCode ?? "");
      if (!key) return false;
      return normalizeCode(answer.shortAnswer ?? "") === key;
    }
    case "essay":
    case "file_upload":
      return false;
    default:
      return false;
  }
}

export type GradedResult = {
  score: number;
  maxScore: number;
  autoGraded: boolean;
  perQuestion: {
    questionId: string;
    /** Fully correct (all-or-nothing pass). */
    correct: boolean;
    /** Earned some but not all points under partial credit. */
    partial?: boolean;
    earned: number;
    possible: number;
  }[];
};

function resolveGuessingPenalty(quiz: Quiz): number {
  const p = quiz.guessingPenalty;
  if (typeof p !== "number" || !Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

function applyGuessingPenalty(
  quiz: Quiz,
  question: QuizQuestion,
  earned: number,
  possible: number,
  correct: boolean,
): number {
  if (correct || possible <= 0) return earned;
  const penalty = resolveGuessingPenalty(quiz);
  if (penalty <= 0) return earned;
  if (question.type !== "multiple_choice" && question.type !== "true_false") return earned;
  const deduction = Math.round(possible * penalty * 100) / 100;
  return Math.max(0, earned - deduction);
}

function questionUsesPartialCredit(quiz: Quiz, question: QuizQuestion): boolean {
  if (question.partialCredit === true) return true;
  if (question.partialCredit === false) return false;
  return quiz.partialCredit === true;
}

function questionUsesPartialCreditPenalty(quiz: Quiz, question: QuizQuestion): boolean {
  if (question.partialCreditPenalty === true) return true;
  if (question.partialCreditPenalty === false) return false;
  return quiz.partialCreditPenalty === true;
}

/** Clamp near-match threshold to [0, 1]; default 0.5. */
export function resolveNearMatchThreshold(
  quiz: Quiz,
  question?: QuizQuestion,
): number {
  const raw =
    typeof question?.nearMatchThreshold === "number" &&
    Number.isFinite(question.nearMatchThreshold)
      ? question.nearMatchThreshold
      : typeof quiz.nearMatchThreshold === "number" &&
          Number.isFinite(quiz.nearMatchThreshold)
        ? quiz.nearMatchThreshold
        : 0.5;
  return Math.min(1, Math.max(0, raw));
}

/** Levenshtein distance for near-match partial credit on text answers. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = b.length + 1;
  let prev = Array.from({ length: rows }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      cur.push(Math.min(prev[j + 1] + 1, cur[j] + 1, prev[j] + cost));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

function bestTextMatch(
  raw: string | undefined,
  accepted: string[],
): { exact: boolean; similarity: number; matched: string } | null {
  const value = normalizeText(raw);
  if (!value) return null;
  const keys = accepted.map((a) => normalizeText(a)).filter(Boolean);
  if (keys.length === 0) return null;
  let best = { exact: false, similarity: 0, matched: keys[0]! };
  for (const key of keys) {
    if (value === key) return { exact: true, similarity: 1, matched: key };
    const dist = editDistance(value, key);
    const denom = Math.max(value.length, key.length, 1);
    const similarity = Math.max(0, 1 - dist / denom);
    if (similarity > best.similarity) best = { exact: false, similarity, matched: key };
  }
  return best;
}

/**
 * Points earned for one answer. Supports proportional credit for
 * multiple_answers and matching, distance-band credit for numerical,
 * and near-match credit for fill_in_blank / short_answer when partial credit
 * is enabled.
 */
export function scoreQuestionAnswer(
  quiz: Quiz,
  question: QuizQuestion,
  answer?: QuizAnswer,
): { correct: boolean; partial: boolean; earned: number; possible: number } {
  if (question.type === "note" || question.type === "group") {
    return { correct: true, partial: false, earned: 0, possible: 0 };
  }
  const possible = question.points > 0 ? question.points : 0;
  const usePartial = questionUsesPartialCredit(quiz, question);

  if (question.type === "multiple_answers" && usePartial) {
    const key = question.correctChoiceIndices ?? [];
    if (key.length === 0 || possible <= 0) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    const picked = answer?.choiceIndices ?? [];
    const keySet = new Set(key);
    let right = 0;
    let wrong = 0;
    for (const i of picked) {
      if (keySet.has(i)) right += 1;
      else wrong += 1;
    }
    const fullyCorrect = right === key.length && wrong === 0 && picked.length === key.length;
    if (fullyCorrect) {
      return { correct: true, partial: false, earned: possible, possible };
    }
    let ratio = right / key.length;
    if (questionUsesPartialCreditPenalty(quiz, question)) {
      ratio = Math.max(0, (right - wrong) / key.length);
    }
    const earned = Math.round(ratio * possible * 100) / 100;
    return {
      correct: false,
      partial: earned > 0,
      earned,
      possible,
    };
  }

  if (question.type === "matching" && usePartial) {
    const pairs = question.matchingPairs ?? [];
    if (pairs.length === 0 || possible <= 0) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    const matches = answer?.matches ?? {};
    let right = 0;
    for (const p of pairs) {
      if (normalizeText(matches[p.id]) === normalizeText(p.right)) right += 1;
    }
    const fullyCorrect = right === pairs.length;
    if (fullyCorrect) {
      return { correct: true, partial: false, earned: possible, possible };
    }
    const earned = Math.round((right / pairs.length) * possible * 100) / 100;
    return {
      correct: false,
      partial: earned > 0,
      earned,
      possible,
    };
  }

  if (question.type === "numerical" && usePartial) {
    if (typeof question.correctNumber !== "number" || possible <= 0) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    if (typeof answer?.number !== "number" || Number.isNaN(answer.number)) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    const tol = typeof question.tolerance === "number" ? Math.abs(question.tolerance) : 0;
    const outerRaw =
      typeof question.partialTolerance === "number" ? Math.abs(question.partialTolerance) : 0;
    const outer = Math.max(outerRaw, tol);
    const dist = Math.abs(answer.number - question.correctNumber);
    if (dist <= tol) {
      return { correct: true, partial: false, earned: possible, possible };
    }
    if (outer > tol && dist <= outer) {
      const ratio = 1 - (dist - tol) / (outer - tol);
      const earned = Math.round(Math.max(0, ratio) * possible * 100) / 100;
      return {
        correct: false,
        partial: earned > 0,
        earned,
        possible,
      };
    }
    return { correct: false, partial: false, earned: 0, possible };
  }

  if (
    (question.type === "fill_in_blank" || question.type === "short_answer") &&
    usePartial
  ) {
    const accepted =
      question.type === "fill_in_blank"
        ? question.acceptedAnswers ?? []
        : question.correctShortAnswer
          ? [question.correctShortAnswer]
          : [];
    const match = bestTextMatch(answer?.shortAnswer, accepted);
    if (!match || possible <= 0) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    if (match.exact) {
      return { correct: true, partial: false, earned: possible, possible };
    }
    const threshold = resolveNearMatchThreshold(quiz, question);
    // Require at least the configured similarity for any credit; scale by similarity.
    if (match.similarity < threshold) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    const earned = Math.round(match.similarity * possible * 100) / 100;
    // Never award full points for a non-exact match.
    const capped = Math.min(earned, Math.round((possible - 0.01) * 100) / 100);
    return {
      correct: false,
      partial: capped > 0,
      earned: Math.max(0, capped),
      possible,
    };
  }

  if (question.type === "fill_in_multiple_blanks" && usePartial) {
    const blanks = question.fillBlanks ?? [];
    if (blanks.length === 0 || possible <= 0) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    const responses = answer?.blankAnswers ?? {};
    let right = 0;
    for (const b of blanks) {
      const accepted = (b.acceptedAnswers ?? []).map((a) => normalizeText(a)).filter(Boolean);
      if (accepted.includes(normalizeText(responses[b.id]))) right += 1;
    }
    if (right === blanks.length) {
      return { correct: true, partial: false, earned: possible, possible };
    }
    const earned = Math.round((right / blanks.length) * possible * 100) / 100;
    return { correct: false, partial: earned > 0, earned, possible };
  }

  if (question.type === "ordering" && usePartial) {
    const key = question.correctOrder ?? [];
    const picked = answer?.ordering ?? [];
    if (key.length === 0 || possible <= 0) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    let right = 0;
    for (let i = 0; i < key.length; i++) {
      if (picked[i] === key[i]) right += 1;
    }
    if (right === key.length && picked.length === key.length) {
      return { correct: true, partial: false, earned: possible, possible };
    }
    const earned = Math.round((right / key.length) * possible * 100) / 100;
    return { correct: false, partial: earned > 0, earned, possible };
  }

  if (question.type === "coding" && codingUsesTestRunner(question)) {
    const results = answer?.codeTestResults ?? [];
    if (results.length === 0) {
      return { correct: false, partial: false, earned: 0, possible };
    }
    return scoreFromCodeTestResults(results, possible, question.codeTests);
  }

  const correct = isAnswerCorrect(question, answer);
  let earned = correct ? possible : 0;
  earned = applyGuessingPenalty(quiz, question, earned, possible, correct);
  return {
    correct,
    partial: false,
    earned,
    possible,
  };
}

/**
 * Human-readable reason for a partial score (for student/instructor review).
 */
export function describePartialCredit(
  quiz: Quiz,
  question: QuizQuestion,
  answer?: QuizAnswer,
): string | undefined {
  const credit = scoreQuestionAnswer(quiz, question, answer);
  if (!credit.partial) return undefined;
  const pts = `${formatPointsSafe(credit.earned)} / ${formatPointsSafe(credit.possible)}`;

  if (question.type === "multiple_answers") {
    const key = question.correctChoiceIndices ?? [];
    const picked = answer?.choiceIndices ?? [];
    const keySet = new Set(key);
    const right = picked.filter((i) => keySet.has(i)).length;
    const wrong = picked.filter((i) => !keySet.has(i)).length;
    const penalty = questionUsesPartialCreditPenalty(quiz, question);
    return penalty
      ? `Partial credit (${pts}): ${right} correct and ${wrong} incorrect pick${wrong === 1 ? "" : "s"} of ${key.length} required.`
      : `Partial credit (${pts}): ${right} of ${key.length} correct choices selected.`;
  }

  if (question.type === "matching") {
    const pairs = question.matchingPairs ?? [];
    const matches = answer?.matches ?? {};
    const right = pairs.filter(
      (p) => normalizeText(matches[p.id]) === normalizeText(p.right),
    ).length;
    let note = `Partial credit (${pts}): ${right} of ${pairs.length} pairs matched.`;
    if (quiz.shuffleAnswers) {
      note +=
        " Left prompts and right options were shuffled for this attempt; scoring matches by pair content, not display order.";
    }
    return note;
  }

  if (question.type === "numerical") {
    const tol = typeof question.tolerance === "number" ? Math.abs(question.tolerance) : 0;
    const outer =
      typeof question.partialTolerance === "number"
        ? Math.abs(question.partialTolerance)
        : tol;
    const dist =
      typeof answer?.number === "number" && typeof question.correctNumber === "number"
        ? Math.abs(answer.number - question.correctNumber)
        : undefined;
    return dist != null
      ? `Partial credit (${pts}): answer was ±${formatPointsSafe(dist)} from the key (full credit within ±${formatPointsSafe(tol)}, partial through ±${formatPointsSafe(outer)}).`
      : `Partial credit (${pts}): within the partial-credit margin.`;
  }

  if (question.type === "fill_in_blank" || question.type === "short_answer") {
    const accepted =
      question.type === "fill_in_blank"
        ? question.acceptedAnswers ?? []
        : question.correctShortAnswer
          ? [question.correctShortAnswer]
          : [];
    const match = bestTextMatch(answer?.shortAnswer, accepted);
    if (!match) return `Partial credit (${pts}).`;
    const pct = Math.round(match.similarity * 100);
    const minPct = Math.round(resolveNearMatchThreshold(quiz, question) * 100);
    return `Partial credit (${pts}): close to “${match.matched}” (${pct}% similar; minimum ${minPct}%).`;
  }

  if (question.type === "coding" && codingUsesTestRunner(question)) {
    const results = answer?.codeTestResults ?? [];
    const passed = results.filter((r) => r.passed).length;
    const total = (question.codeTests ?? []).length || results.length;
    return `Partial credit (${pts}): passed ${passed} of ${total} test${total === 1 ? "" : "s"}.`;
  }

  return `Partial credit (${pts}).`;
}

function formatPointsSafe(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Run the JS test harness for one coding answer and return score + results. */
export async function scoreCodingAnswer(
  question: QuizQuestion,
  code: string,
): Promise<{
  correct: boolean;
  partial: boolean;
  earned: number;
  possible: number;
  results: CodeTestRunResult[];
}> {
  const possible = question.points > 0 ? question.points : 0;
  const tests = question.codeTests ?? [];
  if (!codingUsesTestRunner(question) || tests.length === 0) {
    return { correct: false, partial: false, earned: 0, possible, results: [] };
  }
  try {
    const results = await runCodeTests({
      language: question.language,
      code,
      tests,
      timeoutMs: question.codeTimeoutMs,
      files: question.codeFiles,
      sqlSetup: question.sqlSetup,
      tsTranspileMode: question.tsTranspileMode,
    });
    return { ...scoreFromCodeTestResults(results, possible, tests), results };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const results = tests.map((t) => ({
      testId: t.id,
      passed: false,
      stdout: "",
      stderr: "",
      error: `Runner error: ${message}`,
    }));
    return { ...scoreFromCodeTestResults(results, possible, tests), results };
  }
}

/** Resolve student coding source (plain string or multi-file JSON payload). */
export function codingAnswerSource(answer?: QuizAnswer): string {
  const codeRaw = answer?.shortAnswer ?? "";
  try {
    const parsed = JSON.parse(codeRaw) as {
      __cc_files__?: { path: string; content: string; main?: boolean }[];
    };
    if (parsed?.__cc_files__?.length) {
      return combineCodeFiles(parsed.__cc_files__);
    }
  } catch {
    /* plain string */
  }
  return codeRaw;
}

/**
 * Attach `codeTestResults` for runnable coding questions.
 * On submit: reuse Run-tests results when present; skip the runner for empty
 * answers and for code the student never ran (scores as 0) so submit stays fast.
 * Instructor regrade (`forceRerun`) still runs non-empty answers.
 * Runner failures become failed-test results instead of throwing.
 */
export async function attachCodingTestResults(
  questions: QuizQuestion[],
  answers: QuizAnswer[],
  opts?: { forceRerun?: boolean },
): Promise<QuizAnswer[]> {
  const byId = new Map(answers.map((a) => [a.questionId, { ...a }]));
  for (const question of questions) {
    if (!codingUsesTestRunner(question)) continue;
    const existing = byId.get(question.id) ?? { questionId: question.id };
    const tests = question.codeTests ?? [];
    const code = codingAnswerSource(existing);

    // Empty → 0 points without spinning up Pyodide/Wandbox.
    if (!code.trim()) {
      if (existing.codeTestResults) {
        const cleared = { ...existing };
        delete cleared.codeTestResults;
        byId.set(question.id, cleared);
      }
      continue;
    }

    // Submit path: keep prior Run-tests results (already on the answer); do not
    // launch the runner for code the student never tested — scores as 0.
    if (!opts?.forceRerun) continue;

    try {
      const { results } = await scoreCodingAnswer(question, code);
      byId.set(question.id, { ...existing, codeTestResults: results });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      byId.set(question.id, {
        ...existing,
        codeTestResults: tests.map((t) => ({
          testId: t.id,
          passed: false,
          stdout: "",
          stderr: "",
          error: `Grading failed: ${message}`,
        })),
      });
    }
  }
  return questions.map((q) => byId.get(q.id) ?? { questionId: q.id });
}

export function gradeQuizAttempt(
  quiz: Quiz,
  answers: QuizAnswer[],
  questionsOverride?: QuizQuestion[],
): GradedResult {
  const questions = questionsOverride
    ? questionsOverride
    : scaleQuestionsToTargetPoints(
        expandQuizQuestionGroups(
          normalizeQuizQuestions(quiz.questions),
          `${quiz.id}:grade-fallback`,
          seededPickIds,
        ),
        quiz.points,
      );
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  // Surveys collect responses only — no answer key, no score.
  if (getQuizType(quiz) === "survey") {
    return {
      score: 0,
      maxScore: 0,
      autoGraded: true,
      perQuestion: questions.map((question) => ({
        questionId: question.id,
        correct: true,
        earned: 0,
        possible: 0,
      })),
    };
  }

  let score = 0;
  let autoGraded = true;
  const perQuestion = questions.map((question) => {
    if (question.type === "note" || question.type === "group") {
      return { questionId: question.id, correct: true, earned: 0, possible: 0 };
    }
    if (!isQuestionAutoGradable(question)) autoGraded = false;
    const credit = scoreQuestionAnswer(quiz, question, answerMap.get(question.id));
    score += credit.earned;
    return {
      questionId: question.id,
      correct: credit.correct,
      partial: credit.partial || undefined,
      earned: credit.earned,
      possible: credit.possible,
    };
  });
  return {
    score: Math.round(score * 100) / 100,
    maxScore: totalQuizQuestionPoints(questions),
    autoGraded,
    perQuestion,
  };
}

export async function submitQuizAttempt(
  courseId: string,
  quiz: Quiz,
  answers: QuizAnswer[],
  options?: {
    questionIds?: string[];
    questions?: QuizQuestion[];
    startedAt?: number;
    questionTimeMs?: Record<string, number>;
    leaveCount?: number;
    leaveEvents?: number[];
    markedForReview?: string[];
    seatNumber?: string;
    clientMeta?: { userAgent?: string; timezone?: string };
    submitReason?: QuizSubmitReason;
    /** Instructor force-submit: grade as this student instead of the current user. */
    forStudent?: { id: string; name: string };
  },
): Promise<QuizAttempt> {
  const user = loadUser();
  const studentId = options?.forStudent?.id ?? user.id;
  const studentName = options?.forStudent?.name ?? user.name;
  const priorAttempts = getStudentAttemptsForQuiz(courseId, quiz.id, studentId);
  const attemptNumber = priorAttempts.length + 1;
  const questions =
    options?.questions ??
    resolveQuizQuestions(courseId, quiz, {
      studentId,
      attemptNumber,
      questionIds: options?.questionIds,
    });
  const answersWithTests = await attachCodingTestResults(questions, answers);
  const graded = gradeQuizAttempt(quiz, answersWithTests, questions);
  const reason = options?.submitReason ?? "manual";
  let softOriginalitySnapshot: QuizAttempt["softOriginalitySnapshot"];
  try {
    const { computeSoftOriginalitySnapshot } = await import("./quizSimilarityCorpus");
    softOriginalitySnapshot = computeSoftOriginalitySnapshot(courseId, quiz, {
      studentId,
      studentName,
      answers: answersWithTests,
      questionIds: questions.map((q) => q.id),
    });
  } catch {
    softOriginalitySnapshot = undefined;
  }
  const attempt: QuizAttempt = {
    id: uid("qatt"),
    quizId: quiz.id,
    studentId,
    studentName,
    attemptNumber,
    answers: answersWithTests,
    score: graded.score,
    maxScore: graded.maxScore,
    autoGraded: graded.autoGraded,
    submittedAt: Date.now(),
    questionIds: questions.map((q) => q.id),
    ...(reason !== "manual" ? { submitReason: reason } : {}),
    ...(options?.startedAt != null ? { startedAt: options.startedAt } : {}),
    ...(options?.questionTimeMs && Object.keys(options.questionTimeMs).length > 0
      ? { questionTimeMs: options.questionTimeMs }
      : {}),
    ...(options?.leaveCount != null && options.leaveCount > 0
      ? { leaveCount: options.leaveCount }
      : {}),
    ...(options?.leaveEvents?.length ? { leaveEvents: options.leaveEvents } : {}),
    ...(options?.markedForReview?.length
      ? { markedForReview: options.markedForReview }
      : {}),
    ...(options?.seatNumber?.trim()
      ? { seatNumber: options.seatNumber.trim() }
      : {}),
    ...(options?.clientMeta ? { clientMeta: options.clientMeta } : {}),
    ...(softOriginalitySnapshot ? { softOriginalitySnapshot } : {}),
  };
  saveQuizAttempts(courseId, [...loadQuizAttempts(courseId), attempt]);
  const course = getCourseById(courseId);
  notifyQuizSubmitted({
    courseId,
    courseTitle: course?.title ?? "your course",
    quizId: quiz.id,
    quizTitle: quiz.title,
    studentName,
    needsManualGrading: !graded.autoGraded,
  });
  return attempt;
}

/** Human label for submitReason (review / GradePro). */
export function formatQuizSubmitReason(reason?: QuizSubmitReason): string | null {
  if (!reason || reason === "manual") return null;
  switch (reason) {
    case "timeout":
      return "Auto-submitted (time limit)";
    case "max_leaves":
      return "Auto-submitted (max leaves)";
    case "idle":
      return "Auto-submitted (idle)";
    case "force_end":
      return "Force-submitted by instructor";
    default:
      return null;
  }
}

export function getAttemptById(
  courseId: string,
  attemptId: string,
): QuizAttempt | undefined {
  return loadQuizAttempts(courseId).find((a) => a.id === attemptId);
}

function updateAttempt(
  courseId: string,
  attemptId: string,
  updater: (attempt: QuizAttempt) => QuizAttempt,
) {
  const next = loadQuizAttempts(courseId).map((a) =>
    a.id === attemptId ? updater(a) : a,
  );
  saveQuizAttempts(courseId, next);
}

/** Set (or clear) an instructor score override for an attempt. */
export function setQuizAttemptScore(
  courseId: string,
  attemptId: string,
  score: number | undefined,
) {
  const user = loadUser();
  updateAttempt(courseId, attemptId, (a) => ({
    ...a,
    manualScore: typeof score === "number" && Number.isFinite(score) ? score : undefined,
    gradedAt: Date.now(),
    gradedBy: user.name,
  }));
  recordAudit({
    action: "quiz_score_override",
    courseId,
    summary: `Overrode quiz attempt score to ${typeof score === "number" ? score : "(cleared)"}`,
    detail: `Attempt ${attemptId}`,
    href: `/courses/${courseId}/quizzes`,
  });
}

/**
 * Mark an attempt as graded/released without changing the score.
 * Used for "Hide score until graded" so instructors can unlock auto-scored
 * results without re-entering points.
 */
export function releaseQuizAttemptScore(courseId: string, attemptId: string) {
  const user = loadUser();
  updateAttempt(courseId, attemptId, (a) => ({
    ...a,
    gradedAt: Date.now(),
    gradedBy: user.name,
  }));
}

/** Undo a release so hide-until-graded hides the score again. */
export function unreleaseQuizAttemptScore(courseId: string, attemptId: string) {
  updateAttempt(courseId, attemptId, (a) => {
    const next = { ...a };
    delete next.gradedAt;
    delete next.gradedBy;
    return next;
  });
}

/**
 * Save per-question earned points plus the resulting total. The total becomes
 * the attempt's effective (manual) score so it flows through everywhere.
 */
export function setQuizAttemptQuestionScores(
  courseId: string,
  attemptId: string,
  questionScores: Record<string, number>,
  totalScore: number,
  questionRubricAssessments?: Record<string, RubricAssessment[]>,
) {
  const user = loadUser();
  updateAttempt(courseId, attemptId, (a) => {
    const next: QuizAttempt = {
      ...a,
      questionScores,
      manualScore: Number.isFinite(totalScore) ? totalScore : a.score,
      gradedAt: Date.now(),
      gradedBy: user.name,
    };
    if (questionRubricAssessments && Object.keys(questionRubricAssessments).length > 0) {
      next.questionRubricAssessments = questionRubricAssessments;
    } else {
      delete next.questionRubricAssessments;
    }
    return next;
  });
  recordAudit({
    action: "quiz_question_score",
    courseId,
    summary: `Saved per-question scores (total ${Number.isFinite(totalScore) ? totalScore : "n/a"})`,
    detail: `Attempt ${attemptId}`,
    href: `/courses/${courseId}/quizzes`,
  });
}

/** Set fudge points added on top of the base (auto or manual) score. */
export function setQuizAttemptFudgePoints(
  courseId: string,
  attemptId: string,
  fudgePoints: number | undefined,
) {
  const user = loadUser();
  updateAttempt(courseId, attemptId, (a) => {
    const next = { ...a };
    if (typeof fudgePoints === "number" && Number.isFinite(fudgePoints) && fudgePoints !== 0) {
      next.fudgePoints = Math.round(fudgePoints * 100) / 100;
    } else {
      delete next.fudgePoints;
    }
    next.gradedAt = Date.now();
    next.gradedBy = user.name;
    return next;
  });
}

export function addQuizAttemptComment(
  courseId: string,
  attemptId: string,
  body: string,
  role: SubmissionComment["role"] = "instructor",
): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  const user = loadUser();
  const comment: SubmissionComment = {
    id: uid("qc"),
    author: user.name,
    body: trimmed,
    createdAt: Date.now(),
    role,
  };
  updateAttempt(courseId, attemptId, (a) => ({
    ...a,
    comments: [...(a.comments ?? []), comment],
  }));
}

export function deleteQuizAttemptComment(
  courseId: string,
  attemptId: string,
  commentId: string,
): void {
  updateAttempt(courseId, attemptId, (a) => ({
    ...a,
    comments: (a.comments ?? []).filter((c) => c.id !== commentId),
  }));
}

export function appendQuizAttemptFeedback(
  courseId: string,
  attemptId: string,
  body: string,
): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  const user = loadUser();
  const entry: FeedbackEntry = {
    id: uid("qfbk"),
    body: trimmed,
    author: user.name,
    createdAt: Date.now(),
  };
  updateAttempt(courseId, attemptId, (a) => ({
    ...a,
    feedbackEntries: [...(a.feedbackEntries ?? []), entry],
  }));
}

export function deleteQuizAttemptFeedback(
  courseId: string,
  attemptId: string,
  entryId: string,
): void {
  updateAttempt(courseId, attemptId, (a) => ({
    ...a,
    feedbackEntries: (a.feedbackEntries ?? []).filter((e) => e.id !== entryId),
  }));
}

/** Mark an attempt's responses as viewed (used for the show-once gate). */
export function markQuizAttemptResponsesViewed(
  courseId: string,
  attemptId: string,
): void {
  const existing = getAttemptById(courseId, attemptId);
  if (!existing || existing.responsesViewed) return;
  updateAttempt(courseId, attemptId, (a) => ({ ...a, responsesViewed: true }));
}

/** Remove all attempts for a quiz (used when an instructor resets attempts). */
export function clearQuizAttempts(courseId: string, quizId: string): void {
  const next = loadQuizAttempts(courseId).filter((a) => a.quizId !== quizId);
  saveQuizAttempts(courseId, next);
}

/**
 * Re-run auto-grading for every attempt on a quiz (e.g. after partial-credit
 * or answer-key changes). Preserves fudge points; optionally clears manual
 * score / per-question overrides. Re-runs coding tests for non-empty answers
 * (`forceRerun`); empty coding answers stay unscored by the runner.
 */
export async function regradeQuizAttempts(
  courseId: string,
  quiz: Quiz,
  opts?: { resetOverrides?: boolean },
): Promise<{ updated: number }> {
  const all = loadQuizAttempts(courseId);
  let updated = 0;
  const next: QuizAttempt[] = [];
  for (const attempt of all) {
    if (attempt.quizId !== quiz.id) {
      next.push(attempt);
      continue;
    }
    const questions = resolveQuizQuestions(courseId, quiz, {
      studentId: attempt.studentId,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      questionIds: attempt.questionIds,
    });
    const answersWithTests = await attachCodingTestResults(questions, attempt.answers, {
      forceRerun: true,
    });
    const graded = gradeQuizAttempt(quiz, answersWithTests, questions);
    updated += 1;
    const patched: QuizAttempt = {
      ...attempt,
      answers: answersWithTests,
      score: graded.score,
      maxScore: graded.maxScore,
      autoGraded: graded.autoGraded,
    };
    if (opts?.resetOverrides) {
      delete patched.manualScore;
      delete patched.questionScores;
      delete patched.questionRubricAssessments;
    }
    next.push(patched);
  }
  if (updated > 0) {
    saveQuizAttempts(courseId, next);
    recordAudit({
      action: "quiz_regrade",
      courseId,
      summary: `Regraded ${updated} attempt${updated === 1 ? "" : "s"} on “${quiz.title}”`,
      detail: opts?.resetOverrides ? "Cleared manual overrides" : "Kept manual overrides",
      href: `/courses/${courseId}/quizzes/${quiz.id}`,
    });
  }
  return { updated };
}

/**
 * Re-score one question across all attempts (auto-grade / coding rerun).
 * Optionally clears per-question manual overrides for that question id.
 */
export async function regradeQuizQuestionAcrossAttempts(
  courseId: string,
  quiz: Quiz,
  questionId: string,
  opts?: { resetOverride?: boolean },
): Promise<{ updated: number }> {
  const all = loadQuizAttempts(courseId);
  let updated = 0;
  const next: QuizAttempt[] = [];
  for (const attempt of all) {
    if (attempt.quizId !== quiz.id) {
      next.push(attempt);
      continue;
    }
    const questions = resolveQuizQuestions(courseId, quiz, {
      studentId: attempt.studentId,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      questionIds: attempt.questionIds,
    });
    const target = questions.find((q) => q.id === questionId);
    if (!target) {
      next.push(attempt);
      continue;
    }
    let answers = attempt.answers;
    if (codingUsesTestRunner(target)) {
      answers = await attachCodingTestResults([target], attempt.answers, {
        forceRerun: true,
      });
      // Merge: keep other answers, replace this question's answer blob
      const byId = new Map(attempt.answers.map((a) => [a.questionId, a]));
      for (const a of answers) byId.set(a.questionId, a);
      answers = questions.map((q) => byId.get(q.id) ?? { questionId: q.id });
    }
    const patched: QuizAttempt = { ...attempt, answers };
    if (opts?.resetOverride && patched.questionScores) {
      const qs = { ...patched.questionScores };
      delete qs[questionId];
      if (Object.keys(qs).length === 0) delete patched.questionScores;
      else patched.questionScores = qs;
      if (patched.questionRubricAssessments) {
        const ra = { ...patched.questionRubricAssessments };
        delete ra[questionId];
        if (Object.keys(ra).length === 0) delete patched.questionRubricAssessments;
        else patched.questionRubricAssessments = ra;
      }
    }
    const graded = gradeQuizAttempt(quiz, patched.answers, questions);
    patched.score = graded.score;
    patched.maxScore = graded.maxScore;
    patched.autoGraded = graded.autoGraded;
    updated += 1;
    next.push(patched);
  }
  if (updated > 0) {
    saveQuizAttempts(courseId, next);
    const question = quiz.questions?.find((q) => q.id === questionId);
    recordAudit({
      action: "quiz_regrade",
      courseId,
      summary: `Regraded a question across ${updated} attempt${updated === 1 ? "" : "s"} on “${quiz.title}”`,
      detail: question ? question.id : questionId,
      href: `/courses/${courseId}/quizzes/${quiz.id}`,
    });
  }
  return { updated };
}

export type QuizStatistics = {
  attemptCount: number;
  uniqueStudents: number;
  averageScore: number;
  highScore: number;
  lowScore: number;
  maxScore: number;
  perQuestion: {
    questionId: string;
    correctCount: number;
    answeredCount: number;
    correctPercent: number;
  }[];
};

export function computeQuizStatistics(quiz: Quiz, attempts: QuizAttempt[]): QuizStatistics {
  const detailed = computeDetailedQuizStatistics(quiz, attempts);
  return {
    attemptCount: detailed.attemptCount,
    uniqueStudents: detailed.uniqueStudents,
    averageScore: detailed.averageScore,
    highScore: detailed.highScore,
    lowScore: detailed.lowScore,
    maxScore: detailed.maxScore,
    perQuestion: detailed.questionDetails.map((q) => ({
      questionId: q.questionId,
      correctCount: Math.round((q.correctPercent / 100) * detailed.attemptCount),
      answeredCount: q.answeredCount,
      correctPercent: q.correctPercent,
    })),
  };
}

export type OptionStat = {
  label: string;
  count: number;
  percent: number;
  isCorrect: boolean;
};

export type QuestionDetailStat = {
  questionId: string;
  type: QuizQuestion["type"];
  prompt: string;
  points: number;
  answeredCount: number;
  skippedCount: number;
  correctPercent: number;
  averageEarned: number;
  discrimination: number | null;
  /** Median focus time across attempts that recorded timing for this question. */
  medianTimeMs: number | null;
  /** How many attempts contributed a time sample for this question. */
  timeSampleCount: number;
  options: OptionStat[];
};

export type ScoreBucket = {
  label: string;
  count: number;
};

export type SlowQuestionStat = {
  questionId: string;
  prompt: string;
  medianTimeMs: number;
};

export type DetailedQuizStatistics = QuizStatistics & {
  medianScore: number;
  stdDev: number;
  averagePercent: number;
  scoreDistribution: ScoreBucket[];
  questionDetails: QuestionDetailStat[];
  /** Top questions by median focus time (desc), up to 5. */
  slowestQuestions: SlowQuestionStat[];
};

/** Human-readable duration for quiz analytics (e.g. "45s", "2m 10s"). */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function pointBiserial(
  binary: number[],
  continuous: number[],
): number | null {
  if (binary.length < 3 || binary.length !== continuous.length) return null;
  const n1 = binary.filter((v) => v === 1).length;
  const n0 = binary.filter((v) => v === 0).length;
  if (n1 === 0 || n0 === 0) return null;

  const mean1 =
    continuous.filter((_, i) => binary[i] === 1).reduce((s, v) => s + v, 0) / n1;
  const mean0 =
    continuous.filter((_, i) => binary[i] === 0).reduce((s, v) => s + v, 0) / n0;
  const std = populationStdDev(continuous);
  if (std === 0) return null;
  return ((mean1 - mean0) / std) * Math.sqrt((n1 * n0) / binary.length ** 2);
}

function buildScoreDistribution(
  attempts: QuizAttempt[],
): ScoreBucket[] {
  const buckets: ScoreBucket[] = [
    { label: "0–10%", count: 0 },
    { label: "10–20%", count: 0 },
    { label: "20–30%", count: 0 },
    { label: "30–40%", count: 0 },
    { label: "40–50%", count: 0 },
    { label: "50–60%", count: 0 },
    { label: "60–70%", count: 0 },
    { label: "70–80%", count: 0 },
    { label: "80–90%", count: 0 },
    { label: "90–100%", count: 0 },
  ];

  for (const attempt of attempts) {
    const pct =
      attempt.maxScore > 0
        ? (getAttemptEffectiveScore(attempt) / attempt.maxScore) * 100
        : 0;
    const idx = Math.min(9, Math.max(0, Math.floor(pct / 10)));
    buckets[idx].count += 1;
  }
  return buckets;
}

function normalizeAnswerLabel(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function formatNumericalLabel(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return String(value);
}

function buildQuestionOptions(
  quiz: Quiz,
  question: QuizQuestion,
  attempts: QuizAttempt[],
  attemptCount: number,
  skippedCount: number,
): OptionStat[] {
  const toPercent = (count: number) =>
    attemptCount > 0 ? Math.round((count / attemptCount) * 100) : 0;

  const noAnswer: OptionStat = {
    label: "No answer",
    count: skippedCount,
    percent: toPercent(skippedCount),
    isCorrect: false,
  };

  switch (question.type) {
    case "multiple_choice": {
      const choices = question.choices ?? [];
      const optionStats = choices.map((choice, index) => {
        const choiceKey = normalizeAnswerLabel(choice);
        const count = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          if (typeof answer?.choiceIndex !== "number") return false;
          const qForAttempt =
            quiz.shuffleAnswers === true
              ? shuffleQuestionAnswers(
                  question,
                  `${quizAttemptShuffleSeed(quiz.id, attempt.studentId, attempt.attemptNumber)}:ans:${question.id}`,
                )
              : question;
          return (
            normalizeAnswerLabel(qForAttempt.choices?.[answer.choiceIndex]) === choiceKey
          );
        }).length;
        return {
          label: choice.trim() || `Option ${index + 1}`,
          count,
          percent: toPercent(count),
          isCorrect: question.correctChoiceIndex === index,
        };
      });
      return [...optionStats, noAnswer];
    }
    case "multiple_answers": {
      const choices = question.choices ?? [];
      const correctSet = new Set(question.correctChoiceIndices ?? []);
      const optionStats = choices.map((choice, index) => {
        const choiceKey = normalizeAnswerLabel(choice);
        const count = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          const picked = answer?.choiceIndices ?? [];
          if (picked.length === 0) return false;
          const qForAttempt =
            quiz.shuffleAnswers === true
              ? shuffleQuestionAnswers(
                  question,
                  `${quizAttemptShuffleSeed(quiz.id, attempt.studentId, attempt.attemptNumber)}:ans:${question.id}`,
                )
              : question;
          return picked.some(
            (i) => normalizeAnswerLabel(qForAttempt.choices?.[i]) === choiceKey,
          );
        }).length;
        return {
          label: choice.trim() || `Option ${index + 1}`,
          count,
          percent: toPercent(count),
          isCorrect: correctSet.has(index),
        };
      });
      if (questionUsesPartialCredit(quiz, question)) {
        const correctCount = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          return isAnswerCorrect(question, answer);
        }).length;
        const partialCount = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          if (!hasAnswer(answer) || isAnswerCorrect(question, answer)) return false;
          return scoreQuestionAnswer(quiz, question, answer).partial;
        }).length;
        const incorrectCount = Math.max(
          0,
          attemptCount - skippedCount - correctCount - partialCount,
        );
        return [
          ...optionStats,
          {
            label: "Fully correct set",
            count: correctCount,
            percent: toPercent(correctCount),
            isCorrect: true,
          },
          {
            label: "Partial credit",
            count: partialCount,
            percent: toPercent(partialCount),
            isCorrect: false,
          },
          {
            label: "Incorrect set",
            count: incorrectCount,
            percent: toPercent(incorrectCount),
            isCorrect: false,
          },
          noAnswer,
        ];
      }
      return [...optionStats, noAnswer];
    }
    case "true_false": {
      const trueCount = attempts.filter((attempt) => {
        const answer = attempt.answers.find((a) => a.questionId === question.id);
        return answer?.trueFalse === true;
      }).length;
      const falseCount = attempts.filter((attempt) => {
        const answer = attempt.answers.find((a) => a.questionId === question.id);
        return answer?.trueFalse === false;
      }).length;
      return [
        {
          label: "True",
          count: trueCount,
          percent: toPercent(trueCount),
          isCorrect: question.correctTrueFalse === true,
        },
        {
          label: "False",
          count: falseCount,
          percent: toPercent(falseCount),
          isCorrect: question.correctTrueFalse === false,
        },
        noAnswer,
      ];
    }
    case "short_answer":
    case "fill_in_blank":
    case "numerical": {
      if (question.type === "numerical") {
        const tol =
          typeof question.tolerance === "number" ? Math.abs(question.tolerance) : 0;
        const outer =
          typeof question.partialTolerance === "number"
            ? Math.abs(question.partialTolerance)
            : 0;
        const bandPartial =
          questionUsesPartialCredit(quiz, question) && outer > tol;
        if (bandPartial) {
          const correctCount = attempts.filter((attempt) => {
            const answer = attempt.answers.find((a) => a.questionId === question.id);
            return scoreQuestionAnswer(quiz, question, answer).correct;
          }).length;
          const partialCount = attempts.filter((attempt) => {
            const answer = attempt.answers.find((a) => a.questionId === question.id);
            return scoreQuestionAnswer(quiz, question, answer).partial;
          }).length;
          const incorrectCount = Math.max(
            0,
            attemptCount - skippedCount - correctCount - partialCount,
          );
          return [
            {
              label: "Fully correct",
              count: correctCount,
              percent: toPercent(correctCount),
              isCorrect: true,
            },
            {
              label: "Partial credit",
              count: partialCount,
              percent: toPercent(partialCount),
              isCorrect: false,
            },
            {
              label: "Incorrect",
              count: incorrectCount,
              percent: toPercent(incorrectCount),
              isCorrect: false,
            },
            noAnswer,
          ];
        }
      }
      if (
        (question.type === "short_answer" || question.type === "fill_in_blank") &&
        questionUsesPartialCredit(quiz, question)
      ) {
        const correctCount = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          return scoreQuestionAnswer(quiz, question, answer).correct;
        }).length;
        const partialCount = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          return scoreQuestionAnswer(quiz, question, answer).partial;
        }).length;
        if (partialCount > 0 || correctCount > 0) {
          const incorrectCount = Math.max(
            0,
            attemptCount - skippedCount - correctCount - partialCount,
          );
          return [
            {
              label: "Fully correct",
              count: correctCount,
              percent: toPercent(correctCount),
              isCorrect: true,
            },
            {
              label: "Partial credit",
              count: partialCount,
              percent: toPercent(partialCount),
              isCorrect: false,
            },
            {
              label: "Incorrect",
              count: incorrectCount,
              percent: toPercent(incorrectCount),
              isCorrect: false,
            },
            noAnswer,
          ];
        }
      }
      const groups = new Map<string, { label: string; count: number; isCorrect: boolean }>();
      for (const attempt of attempts) {
        const answer = attempt.answers.find((a) => a.questionId === question.id);
        if (!hasAnswer(answer)) continue;
        let label = "";
        if (question.type === "numerical") {
          label = formatNumericalLabel(answer?.number);
        } else {
          label = (answer?.shortAnswer ?? "").trim();
        }
        if (!label) continue;
        const key = normalizeAnswerLabel(label);
        const correct = isAnswerCorrect(question, answer);
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          groups.set(key, { label, count: 1, isCorrect: correct });
        }
      }
      const top = [...groups.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map((g) => ({
          label: g.label,
          count: g.count,
          percent: toPercent(g.count),
          isCorrect: g.isCorrect,
        }));
      return [...top, noAnswer];
    }
    case "matching": {
      const correctCount = attempts.filter((attempt) => {
        const answer = attempt.answers.find((a) => a.questionId === question.id);
        return isAnswerCorrect(question, answer);
      }).length;
      const partialCount = attempts.filter((attempt) => {
        const answer = attempt.answers.find((a) => a.questionId === question.id);
        if (!hasAnswer(answer) || isAnswerCorrect(question, answer)) return false;
        const credit = scoreQuestionAnswer(quiz, question, answer);
        return credit.partial;
      }).length;
      const incorrectCount = Math.max(
        0,
        attemptCount - skippedCount - correctCount - partialCount,
      );
      return [
        {
          label: "Fully correct",
          count: correctCount,
          percent: toPercent(correctCount),
          isCorrect: true,
        },
        {
          label: "Partial credit",
          count: partialCount,
          percent: toPercent(partialCount),
          isCorrect: false,
        },
        {
          label: "Incorrect",
          count: incorrectCount,
          percent: toPercent(incorrectCount),
          isCorrect: false,
        },
        noAnswer,
      ];
    }
    case "likert": {
      const min = question.likertMin ?? 1;
      const max = question.likertMax ?? 5;
      const optionStats: OptionStat[] = [];
      for (let v = min; v <= max; v++) {
        const count = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          return answer?.likertValue === v;
        }).length;
        let label = String(v);
        if (v === min && question.likertMinLabel) label = `${v} — ${question.likertMinLabel}`;
        else if (v === max && question.likertMaxLabel) label = `${v} — ${question.likertMaxLabel}`;
        optionStats.push({
          label,
          count,
          percent: toPercent(count),
          isCorrect:
            typeof question.correctLikertValue === "number"
              ? question.correctLikertValue === v
              : false,
        });
      }
      return [...optionStats, noAnswer];
    }
    case "essay":
    case "file_upload":
    case "coding":
    case "note":
    case "group":
      return [];
    case "inline_code": {
      const correctCount = attempts.filter((attempt) => {
        const answer = attempt.answers.find((a) => a.questionId === question.id);
        return isAnswerCorrect(question, answer);
      }).length;
      const incorrectCount = attemptCount - skippedCount - correctCount;
      return [
        {
          label: "Correct",
          count: correctCount,
          percent: toPercent(correctCount),
          isCorrect: true,
        },
        {
          label: "Incorrect",
          count: Math.max(0, incorrectCount),
          percent: toPercent(Math.max(0, incorrectCount)),
          isCorrect: false,
        },
        noAnswer,
      ];
    }
    default:
      return [noAnswer];
  }
}

export function computeDetailedQuizStatistics(
  quiz: Quiz,
  attempts: QuizAttempt[],
): DetailedQuizStatistics {
  const questions = flattenQuizQuestionItems(quiz.questions);
  const maxScore = totalQuizQuestionPoints(normalizeQuizQuestions(quiz.questions));
  const attemptCount = attempts.length;

  const emptyQuestionDetails: QuestionDetailStat[] = questions.map((q) => ({
    questionId: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points > 0 ? q.points : 0,
    answeredCount: 0,
    skippedCount: 0,
    correctPercent: 0,
    averageEarned: 0,
    discrimination: null,
    medianTimeMs: null,
    timeSampleCount: 0,
    options: [],
  }));

  if (attemptCount === 0) {
    return {
      attemptCount: 0,
      uniqueStudents: 0,
      averageScore: 0,
      highScore: 0,
      lowScore: 0,
      maxScore,
      perQuestion: questions.map((q) => ({
        questionId: q.id,
        correctCount: 0,
        answeredCount: 0,
        correctPercent: 0,
      })),
      medianScore: 0,
      stdDev: 0,
      averagePercent: 0,
      scoreDistribution: buildScoreDistribution([]),
      questionDetails: emptyQuestionDetails,
      slowestQuestions: [],
    };
  }

  const scores = attempts.map((a) => getAttemptEffectiveScore(a));
  const total = scores.reduce((sum, s) => sum + s, 0);
  const uniqueStudents = new Set(attempts.map((a) => a.studentId)).size;
  const averageScore = total / attemptCount;
  const averagePercent =
    maxScore > 0 ? Math.round((averageScore / maxScore) * 100) : 0;

  const questionDetails = questions.map((question) => {
    let correctCount = 0;
    let answeredCount = 0;
    let earnedTotal = 0;
    const correctBinary: number[] = [];
    const totalScores: number[] = [];
    const timeSamples: number[] = [];

    for (const attempt of attempts) {
      const answer = attempt.answers.find((a) => a.questionId === question.id);
      const answered = hasAnswer(answer);
      if (answered) answeredCount += 1;
      const qForAttempt =
        quiz.shuffleAnswers === true
          ? shuffleQuestionAnswers(
              question,
              `${quizAttemptShuffleSeed(quiz.id, attempt.studentId, attempt.attemptNumber)}:ans:${question.id}`,
            )
          : question;
      const correct = isAnswerCorrect(qForAttempt, answer);
      if (correct) correctCount += 1;
      correctBinary.push(correct ? 1 : 0);
      totalScores.push(getAttemptEffectiveScore(attempt));

      const possible = question.points > 0 ? question.points : 0;
      const override = attempt.questionScores?.[question.id];
      if (typeof override === "number" && Number.isFinite(override)) {
        earnedTotal += override;
      } else {
        earnedTotal += correct ? possible : 0;
      }

      const t = attempt.questionTimeMs?.[question.id];
      if (typeof t === "number" && Number.isFinite(t) && t > 0) {
        timeSamples.push(t);
      }
    }

    const skippedCount = attemptCount - answeredCount;
    const correctPercent = Math.round((correctCount / attemptCount) * 100);
    const averageEarned = earnedTotal / attemptCount;
    const timeSampleCount = timeSamples.length;

    return {
      questionId: question.id,
      type: question.type,
      prompt: question.prompt,
      points: question.points > 0 ? question.points : 0,
      answeredCount,
      skippedCount,
      correctPercent,
      averageEarned,
      discrimination: pointBiserial(correctBinary, totalScores),
      medianTimeMs: timeSampleCount > 0 ? median(timeSamples) : null,
      timeSampleCount,
      options: buildQuestionOptions(quiz, question, attempts, attemptCount, skippedCount),
    };
  });

  const perQuestion = questionDetails.map((q) => ({
    questionId: q.questionId,
    correctCount: Math.round((q.correctPercent / 100) * attemptCount),
    answeredCount: q.answeredCount,
    correctPercent: q.correctPercent,
  }));

  const slowestQuestions: SlowQuestionStat[] = questionDetails
    .filter((q) => q.medianTimeMs != null && q.medianTimeMs > 0)
    .sort((a, b) => (b.medianTimeMs ?? 0) - (a.medianTimeMs ?? 0))
    .slice(0, 5)
    .map((q) => ({
      questionId: q.questionId,
      prompt: q.prompt,
      medianTimeMs: q.medianTimeMs!,
    }));

  return {
    attemptCount,
    uniqueStudents,
    averageScore,
    highScore: Math.max(...scores),
    lowScore: Math.min(...scores),
    maxScore,
    perQuestion,
    medianScore: median(scores),
    stdDev: populationStdDev(scores),
    averagePercent,
    scoreDistribution: buildScoreDistribution(attempts),
    questionDetails,
    slowestQuestions,
  };
}
