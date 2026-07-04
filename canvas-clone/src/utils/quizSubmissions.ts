import { loadUser } from "./userStore";
import type { FeedbackEntry, SubmissionComment } from "./assignmentSubmissions";
import {
  normalizeQuizQuestions,
  totalQuizQuestionPoints,
  uid,
  type Quiz,
  type QuizQuestion,
} from "./quizzes";

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
  const questions = normalizeQuizQuestions(quiz.questions);
  const maxScore = totalQuizQuestionPoints(questions);

  if (attempts.length === 0) {
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
    };
  }

  const scores = attempts.map((a) => getAttemptEffectiveScore(a));
  const total = scores.reduce((sum, s) => sum + s, 0);
  const uniqueStudents = new Set(attempts.map((a) => a.studentId)).size;

  const perQuestion = questions.map((question) => {
    let correctCount = 0;
    let answeredCount = 0;
    for (const attempt of attempts) {
      const answer = attempt.answers.find((a) => a.questionId === question.id);
      if (answer) answeredCount += 1;
      if (isAnswerCorrect(question, answer)) correctCount += 1;
    }
    return {
      questionId: question.id,
      correctCount,
      answeredCount,
      correctPercent: attempts.length ? Math.round((correctCount / attempts.length) * 100) : 0,
    };
  });

  return {
    attemptCount: attempts.length,
    uniqueStudents,
    averageScore: total / attempts.length,
    highScore: Math.max(...scores),
    lowScore: Math.min(...scores),
    maxScore,
    perQuestion,
  };
}
