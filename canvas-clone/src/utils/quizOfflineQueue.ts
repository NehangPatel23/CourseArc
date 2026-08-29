import type { QuizAnswer } from "./quizSubmissions";

/**
 * Offline submit queue for quiz attempts (same-origin localStorage).
 * Flushed when the browser comes back online.
 */

export type QueuedQuizSubmit = {
  id: string;
  courseId: string;
  quizId: string;
  studentId: string;
  answers: QuizAnswer[];
  startedAt: number;
  questionIds: string[];
  questionTimeMs?: Record<string, number>;
  leaveCount?: number;
  leaveEvents?: number[];
  markedForReview?: string[];
  seatNumber?: string;
  clientMeta?: { userAgent?: string; timezone?: string };
  submitReason?: import("./quizSubmissions").QuizSubmitReason;
  queuedAt: number;
};

const KEY = "canvasClone:quizSubmitQueue";

function loadQueue(): QueuedQuizSubmit[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueuedQuizSubmit[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

export function enqueueQuizSubmit(
  item: Omit<QueuedQuizSubmit, "id" | "queuedAt">,
): QueuedQuizSubmit {
  const entry: QueuedQuizSubmit = {
    ...item,
    id: `qs_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    queuedAt: Date.now(),
  };
  const next = loadQueue().filter(
    (q) =>
      !(
        q.courseId === entry.courseId &&
        q.quizId === entry.quizId &&
        q.studentId === entry.studentId
      ),
  );
  next.push(entry);
  saveQueue(next);
  return entry;
}

export function listQueuedQuizSubmits(courseId?: string, quizId?: string): QueuedQuizSubmit[] {
  return loadQueue().filter(
    (q) =>
      (courseId == null || q.courseId === courseId) &&
      (quizId == null || q.quizId === quizId),
  );
}

export function removeQueuedQuizSubmit(id: string) {
  saveQueue(loadQueue().filter((q) => q.id !== id));
}

export function peekQueuedQuizSubmit(
  courseId: string,
  quizId: string,
  studentId: string,
): QueuedQuizSubmit | undefined {
  return loadQueue().find(
    (q) =>
      q.courseId === courseId && q.quizId === quizId && q.studentId === studentId,
  );
}
