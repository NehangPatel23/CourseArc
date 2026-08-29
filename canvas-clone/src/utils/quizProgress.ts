import { loadUser } from "./userStore";
import type { QuizAnswer } from "./quizSubmissions";
import {
  addQuizAttemptComment,
  getStudentAttemptsForQuiz,
  resolveQuizQuestions,
  submitQuizAttempt,
  type QuizAttempt,
} from "./quizSubmissions";
import type { Quiz } from "./quizzes";
import { getEffectiveTimeLimitMinutes } from "./quizAccommodations";
import { staffCommentRole } from "./permissions";

/**
 * A snapshot of an in-progress (not yet submitted) quiz attempt. Persisted so a
 * student can navigate away and resume with their answers intact and the timer
 * still running (remaining time is derived from `startedAt` + limits).
 */
export type QuizProgress = {
  startedAt: number;
  answers: QuizAnswer[];
  markedForReview: string[];
  /** Current question index when taking one-at-a-time. */
  currentQuestionIndex?: number;
  /** Furthest question index reached (for lock-previous mode). */
  furthestQuestionIndex?: number;
  /**
   * One-shot extra minutes for this attempt only (not a persistent accommodation).
   * Instructor can grant from Moderate while the student is in progress.
   */
  attemptExtraMinutes?: number;
  /** Accumulated focus/view time per question (ms) for analytics. */
  questionTimeMs?: Record<string, number>;
  /** How many times the student left the tab during this attempt (lock-on-leave). */
  leaveCount?: number;
  /** Timestamps (ms) of each leave event. */
  leaveEvents?: number[];
  /** Optional seat / station collected at start. */
  seatNumber?: string;
  /** Soft proctoring metadata (no real IP without a server). */
  clientMeta?: { userAgent?: string; timezone?: string };
  /** Question ids the student has scrolled into / opened. */
  viewedQuestionIds?: string[];
  updatedAt: number;
};

export type InProgressQuizEntry = {
  studentId: string;
  progress: QuizProgress;
};

export type QuizProgressChangedDetail = {
  courseId: string;
  quizId: string;
  studentId: string;
};

export const QUIZ_PROGRESS_CHANGED_EVENT = "canvasClone:quizProgressChanged";

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

function saveAll(
  courseId: string,
  data: Record<string, QuizProgress>,
  detail?: Omit<QuizProgressChangedDetail, "courseId">,
) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(data));
    if (detail) {
      window.dispatchEvent(
        new CustomEvent<QuizProgressChangedDetail>(QUIZ_PROGRESS_CHANGED_EVENT, {
          detail: { courseId, ...detail },
        }),
      );
      try {
        const bc = new BroadcastChannel("canvasClone:quizProgress");
        bc.postMessage({
          type: "progress",
          courseId,
          quizId: detail.quizId,
          studentId: detail.studentId,
          progress: data[entryKey(detail.quizId, detail.studentId)] ?? null,
        });
        bc.close();
      } catch {
        /* BroadcastChannel unsupported */
      }
    }
  } catch {}
}

export function getQuizProgress(
  courseId: string,
  quizId: string,
  studentId = loadUser().id,
): QuizProgress | undefined {
  return loadAll(courseId)[entryKey(quizId, studentId)];
}

/** All students with an in-progress attempt on this quiz. */
export function listInProgressForQuiz(
  courseId: string,
  quizId: string,
): InProgressQuizEntry[] {
  const all = loadAll(courseId);
  const prefix = `${quizId}:`;
  const out: InProgressQuizEntry[] = [];
  for (const [key, progress] of Object.entries(all)) {
    if (!key.startsWith(prefix)) continue;
    const studentId = key.slice(prefix.length);
    if (!studentId) continue;
    out.push({ studentId, progress });
  }
  return out.sort((a, b) => a.progress.startedAt - b.progress.startedAt);
}

export function saveQuizProgress(
  courseId: string,
  quizId: string,
  progress: Omit<QuizProgress, "updatedAt">,
  studentId = loadUser().id,
) {
  const all = loadAll(courseId);
  all[entryKey(quizId, studentId)] = { ...progress, updatedAt: Date.now() };
  saveAll(courseId, all, { quizId, studentId });
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
    saveAll(courseId, all, { quizId, studentId });
  }
}

/**
 * Add one-shot minutes to an in-progress attempt. Returns false if no progress.
 */
export function extendInProgressAttempt(
  courseId: string,
  quizId: string,
  studentId: string,
  extraMinutes: number,
): boolean {
  const n = Math.max(0, Math.floor(extraMinutes));
  if (n <= 0) return false;
  const existing = getQuizProgress(courseId, quizId, studentId);
  if (!existing) return false;
  saveQuizProgress(
    courseId,
    quizId,
    {
      startedAt: existing.startedAt,
      answers: existing.answers,
      markedForReview: existing.markedForReview,
      currentQuestionIndex: existing.currentQuestionIndex,
      furthestQuestionIndex: existing.furthestQuestionIndex,
      attemptExtraMinutes: (existing.attemptExtraMinutes ?? 0) + n,
      questionTimeMs: existing.questionTimeMs,
      leaveCount: existing.leaveCount,
      leaveEvents: existing.leaveEvents,
      seatNumber: existing.seatNumber,
      clientMeta: existing.clientMeta,
      viewedQuestionIds: existing.viewedQuestionIds,
    },
    studentId,
  );
  return true;
}

/** Total timed minutes for an in-progress attempt (accommodations + one-shot). */
export function getProgressTimeLimitMinutes(
  courseId: string,
  quiz: Quiz,
  progress: QuizProgress,
  studentId: string,
): number | undefined {
  const base = getEffectiveTimeLimitMinutes(quiz, courseId, studentId);
  if (base == null) return undefined;
  return base + Math.max(0, progress.attemptExtraMinutes ?? 0);
}

/** True once an in-progress attempt has run past the effective time limit. */
export function isQuizProgressExpired(
  courseId: string,
  quiz: Quiz,
  progress: QuizProgress,
  now = Date.now(),
  studentId = loadUser().id,
): boolean {
  const limitMinutes = getProgressTimeLimitMinutes(courseId, quiz, progress, studentId);
  const limitMs = limitMinutes ? limitMinutes * 60000 : 0;
  return limitMs > 0 && now - progress.startedAt >= limitMs;
}

/**
 * If the student has an in-progress attempt whose timer already expired, submit
 * it with whatever answers were saved (registering the score) and clear the
 * progress. Returns true when an attempt was finalized.
 */
export async function finalizeExpiredQuizProgress(
  courseId: string,
  quiz: Quiz,
): Promise<boolean> {
  const user = loadUser();
  const p = getQuizProgress(courseId, quiz.id, user.id);
  if (!p || !isQuizProgressExpired(courseId, quiz, p, Date.now(), user.id)) return false;
  const attemptNumber = getStudentAttemptsForQuiz(courseId, quiz.id, user.id).length + 1;
  const questions = resolveQuizQuestions(courseId, quiz, {
    studentId: user.id,
    attemptId: "in-progress",
    attemptNumber,
  });
  const map = new Map(p.answers.map((a) => [a.questionId, a]));
  const answers = questions.map((q) => map.get(q.id) ?? { questionId: q.id });
  await submitQuizAttempt(courseId, quiz, answers, {
    questions,
    questionIds: questions.map((q) => q.id),
    startedAt: p.startedAt,
    questionTimeMs: p.questionTimeMs,
    leaveCount: p.leaveCount,
    leaveEvents: p.leaveEvents,
    markedForReview: p.markedForReview,
    seatNumber: p.seatNumber,
    clientMeta: p.clientMeta,
    submitReason: "timeout",
  });
  clearQuizProgress(courseId, quiz.id, user.id);
  return true;
}

/**
 * Instructor force-submit: grade saved progress as the student, attach an
 * optional comment, clear progress. Returns the new attempt or null.
 */
export async function forceSubmitInProgressAttempt(
  courseId: string,
  quiz: Quiz,
  studentId: string,
  opts?: { studentName?: string; comment?: string },
): Promise<QuizAttempt | null> {
  const p = getQuizProgress(courseId, quiz.id, studentId);
  if (!p) return null;
  const attemptNumber =
    getStudentAttemptsForQuiz(courseId, quiz.id, studentId).length + 1;
  const questions = resolveQuizQuestions(courseId, quiz, {
    studentId,
    attemptId: "in-progress",
    attemptNumber,
  });
  const map = new Map(p.answers.map((a) => [a.questionId, a]));
  const answers = questions.map((q) => map.get(q.id) ?? { questionId: q.id });
  const attempt = await submitQuizAttempt(courseId, quiz, answers, {
    questions,
    questionIds: questions.map((q) => q.id),
    startedAt: p.startedAt,
    questionTimeMs: p.questionTimeMs,
    leaveCount: p.leaveCount,
    leaveEvents: p.leaveEvents,
    markedForReview: p.markedForReview,
    seatNumber: p.seatNumber,
    clientMeta: p.clientMeta,
    submitReason: "force_end",
    forStudent: {
      id: studentId,
      name: opts?.studentName?.trim() || studentId,
    },
  });
  if (opts?.comment?.trim()) {
    addQuizAttemptComment(courseId, attempt.id, opts.comment.trim(), staffCommentRole());
  }
  clearQuizProgress(courseId, quiz.id, studentId);
  return attempt;
}

/** Extend every in-progress attempt for a quiz by the same number of minutes. */
export function bulkExtendInProgressAttempts(
  courseId: string,
  quizId: string,
  extraMinutes: number,
): number {
  const rows = listInProgressForQuiz(courseId, quizId);
  let n = 0;
  for (const row of rows) {
    if (extendInProgressAttempt(courseId, quizId, row.studentId, extraMinutes)) n += 1;
  }
  return n;
}
