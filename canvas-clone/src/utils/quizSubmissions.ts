import { loadUser } from "./userStore";
import type { FeedbackEntry, SubmissionComment } from "./assignmentSubmissions";
import {
  normalizeQuizQuestions,
  totalQuizQuestionPoints,
  uid,
  type Quiz,
  type QuizQuestion,
} from "./quizzes";
import { getCourseById } from "./coursesStore";
import { notifyQuizSubmitted } from "./notifications";

export type QuizAnswer = {
  questionId: string;
  /** multiple_choice */
  choiceIndex?: number;
  /** multiple_answers */
  choiceIndices?: number[];
  /** true_false */
  trueFalse?: boolean;
  /** short_answer + fill_in_blank */
  shortAnswer?: string;
  /** numerical */
  number?: number;
  /** matching — pairId -> chosen right-side value */
  matches?: Record<string, string>;
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
    (answer.matches != null && Object.keys(answer.matches).length > 0)
  );
}

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
  /** Instructor override of the auto-computed score (takes precedence when set). */
  manualScore?: number;
  gradedAt?: number;
  gradedBy?: string;
  comments?: SubmissionComment[];
  feedbackEntries?: FeedbackEntry[];
  /** Instructor's manually adjusted points per question (questionId -> earned). */
  questionScores?: Record<string, number>;
  /** Set once the student has viewed their responses (for show-once gating). */
  responsesViewed?: boolean;
};

/** The score that counts: an instructor override if present, else the auto score. */
export function getAttemptEffectiveScore(attempt: QuizAttempt): number {
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
): { score: number; maxScore: number; attemptCount: number } | undefined {
  const attempts = getStudentAttemptsForQuiz(courseId, quiz.id, studentId);
  if (attempts.length === 0) return undefined;
  const scores = attempts.map((a) => getAttemptEffectiveScore(a));
  const maxScore = attempts[attempts.length - 1].maxScore;
  const policy = quiz.scoringPolicy ?? "highest";
  let score: number;
  if (policy === "latest") {
    score = scores[scores.length - 1];
  } else if (policy === "first") {
    score = scores[0];
  } else if (policy === "lowest") {
    score = Math.min(...scores);
  } else if (policy === "average") {
    score = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  } else {
    score = Math.max(...scores);
  }
  return { score, maxScore, attemptCount: attempts.length };
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
  if (quiz.allowMultipleAttempts) {
    const allowed = quiz.allowedAttempts;
    if (typeof allowed === "number" && allowed > 0) return Math.max(0, allowed - used);
    return Infinity;
  }
  return Math.max(0, 1 - used);
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
    case "numerical":
      return typeof question.correctNumber === "number";
    case "matching":
      return (
        (question.matchingPairs?.length ?? 0) > 0 &&
        (question.matchingPairs ?? []).every((p) => p.left.trim() && p.right.trim())
      );
    case "essay":
      return false;
    default:
      return false;
  }
}

export function isAnswerCorrect(question: QuizQuestion, answer?: QuizAnswer): boolean {
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
    case "essay":
      return false;
    default:
      return false;
  }
}

export type GradedResult = {
  score: number;
  maxScore: number;
  autoGraded: boolean;
  perQuestion: { questionId: string; correct: boolean; earned: number; possible: number }[];
};

export function gradeQuizAttempt(quiz: Quiz, answers: QuizAnswer[]): GradedResult {
  const questions = normalizeQuizQuestions(quiz.questions);
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  let score = 0;
  let autoGraded = true;
  const perQuestion = questions.map((question) => {
    const possible = question.points > 0 ? question.points : 0;
    if (!isQuestionAutoGradable(question)) autoGraded = false;
    const correct = isAnswerCorrect(question, answerMap.get(question.id));
    const earned = correct ? possible : 0;
    score += earned;
    return { questionId: question.id, correct, earned, possible };
  });
  return {
    score,
    maxScore: totalQuizQuestionPoints(questions),
    autoGraded,
    perQuestion,
  };
}

export function submitQuizAttempt(
  courseId: string,
  quiz: Quiz,
  answers: QuizAnswer[],
): QuizAttempt {
  const user = loadUser();
  const graded = gradeQuizAttempt(quiz, answers);
  const priorAttempts = getStudentAttemptsForQuiz(courseId, quiz.id, user.id);
  const attempt: QuizAttempt = {
    id: uid("qatt"),
    quizId: quiz.id,
    studentId: user.id,
    studentName: user.name,
    attemptNumber: priorAttempts.length + 1,
    answers,
    score: graded.score,
    maxScore: graded.maxScore,
    autoGraded: graded.autoGraded,
    submittedAt: Date.now(),
  };
  saveQuizAttempts(courseId, [...loadQuizAttempts(courseId), attempt]);
  const course = getCourseById(courseId);
  notifyQuizSubmitted({
    courseId,
    courseTitle: course?.title ?? "your course",
    quizId: quiz.id,
    quizTitle: quiz.title,
    studentName: user.name,
    needsManualGrading: !graded.autoGraded,
  });
  return attempt;
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
) {
  const user = loadUser();
  updateAttempt(courseId, attemptId, (a) => ({
    ...a,
    questionScores,
    manualScore: Number.isFinite(totalScore) ? totalScore : a.score,
    gradedAt: Date.now(),
    gradedBy: user.name,
  }));
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
  options: OptionStat[];
};

export type ScoreBucket = {
  label: string;
  count: number;
};

export type DetailedQuizStatistics = QuizStatistics & {
  medianScore: number;
  stdDev: number;
  averagePercent: number;
  scoreDistribution: ScoreBucket[];
  questionDetails: QuestionDetailStat[];
};

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
        const count = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          return answer?.choiceIndex === index;
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
        const count = attempts.filter((attempt) => {
          const answer = attempt.answers.find((a) => a.questionId === question.id);
          return (answer?.choiceIndices ?? []).includes(index);
        }).length;
        return {
          label: choice.trim() || `Option ${index + 1}`,
          count,
          percent: toPercent(count),
          isCorrect: correctSet.has(index),
        };
      });
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
      const incorrectCount = attemptCount - skippedCount - correctCount;
      return [
        {
          label: "Fully correct",
          count: correctCount,
          percent: toPercent(correctCount),
          isCorrect: true,
        },
        {
          label: "Incorrect / partial",
          count: Math.max(0, incorrectCount),
          percent: toPercent(Math.max(0, incorrectCount)),
          isCorrect: false,
        },
        noAnswer,
      ];
    }
    case "essay":
      return [];
    default:
      return [noAnswer];
  }
}

export function computeDetailedQuizStatistics(
  quiz: Quiz,
  attempts: QuizAttempt[],
): DetailedQuizStatistics {
  const questions = normalizeQuizQuestions(quiz.questions);
  const maxScore = totalQuizQuestionPoints(questions);
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

    for (const attempt of attempts) {
      const answer = attempt.answers.find((a) => a.questionId === question.id);
      const answered = hasAnswer(answer);
      if (answered) answeredCount += 1;
      const correct = isAnswerCorrect(question, answer);
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
    }

    const skippedCount = attemptCount - answeredCount;
    const correctPercent = Math.round((correctCount / attemptCount) * 100);
    const averageEarned = earnedTotal / attemptCount;

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
      options: buildQuestionOptions(question, attempts, attemptCount, skippedCount),
    };
  });

  const perQuestion = questionDetails.map((q) => ({
    questionId: q.questionId,
    correctCount: Math.round((q.correctPercent / 100) * attemptCount),
    answeredCount: q.answeredCount,
    correctPercent: q.correctPercent,
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
  };
}
