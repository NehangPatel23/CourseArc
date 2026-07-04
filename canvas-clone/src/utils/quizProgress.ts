import { loadUser } from "./userStore";
import type { QuizAnswer } from "./quizSubmissions";
import { submitQuizAttempt } from "./quizSubmissions";
import { normalizeQuizQuestions } from "./quizzes";
import type { Quiz } from "./quizzes";

/**
 * A snapshot of an in-progress (not yet submitted) quiz attempt. Persisted so a
 * student can navigate away and resume with their answers intact and the timer
 * still running (remaining time is derived from `startedAt`).
 */
export type QuizProgress = {
  startedAt: number;
  answers: QuizAnswer[];
  markedForReview: string[];
  updatedAt: number;
};

const KEY_PREFIX = "canvasClone:quizProgress:";

function storageKey(courseId: string) {
  return `${KEY_PREFIX}${courseId}`;
}

function entryKey(quizId: string, studentId: string) {
  return `${quizId}:${studentId}`;
}

function loadAll(courseId: string): Record<string, QuizProgress> {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(courseId: string, data: Record<string, QuizProgress>) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(data));
  } catch {}
}

export function getQuizProgress(
  courseId: string,
  quizId: string,
  studentId = loadUser().id,
): QuizProgress | undefined {
  return loadAll(courseId)[entryKey(quizId, studentId)];
}

export function saveQuizProgress(
  courseId: string,
  quizId: string,
  progress: Omit<QuizProgress, "updatedAt">,
  studentId = loadUser().id,
) {
  const all = loadAll(courseId);
  all[entryKey(quizId, studentId)] = { ...progress, updatedAt: Date.now() };
  saveAll(courseId, all);
}

export function clearQuizProgress(
  courseId: string,
  quizId: string,
  studentId = loadUser().id,
) {
  const all = loadAll(courseId);
  const key = entryKey(quizId, studentId);
  if (key in all) {
    delete all[key];
    saveAll(courseId, all);
  }
}

/** True once an in-progress attempt has run past the quiz's time limit. */
export function isQuizProgressExpired(
  quiz: Quiz,
  progress: QuizProgress,
  now = Date.now(),
): boolean {
  const limitMs = quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60000 : 0;
  return limitMs > 0 && now - progress.startedAt >= limitMs;
}

/**
 * If the student has an in-progress attempt whose timer already expired, submit
 * it with whatever answers were saved (registering the score) and clear the
 * progress. Returns true when an attempt was finalized.
 */
export function finalizeExpiredQuizProgress(courseId: string, quiz: Quiz): boolean {
  const p = getQuizProgress(courseId, quiz.id);
  if (!p || !isQuizProgressExpired(quiz, p)) return false;
  const map = new Map(p.answers.map((a) => [a.questionId, a]));
  const answers = normalizeQuizQuestions(quiz.questions).map(
    (q) => map.get(q.id) ?? { questionId: q.id },
  );
  submitQuizAttempt(courseId, quiz, answers);
  clearQuizProgress(courseId, quiz.id);
  return true;
}
