import { loadQuizzes, saveQuizzes, type Quiz } from "./quizzes";

function readAll(courseId: string): Quiz[] {
  try {
    const raw = window.localStorage.getItem(`canvasClone:quizzes:${courseId}`);
    if (!raw) return loadQuizzes(courseId);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Active quizzes (not in trash). */
export function loadActiveQuizzes(courseId: string): Quiz[] {
  return readAll(courseId).filter((q) => !q.deletedAt);
}

export function loadTrashedQuizzes(courseId: string): Quiz[] {
  return readAll(courseId)
    .filter((q) => typeof q.deletedAt === "number")
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export function softDeleteQuiz(courseId: string, quizId: string): boolean {
  const all = readAll(courseId);
  const idx = all.findIndex((q) => q.id === quizId);
  if (idx < 0) return false;
  const now = Date.now();
  all[idx] = { ...all[idx]!, deletedAt: now, updatedAt: now };
  saveQuizzes(courseId, all);
  return true;
}

export function restoreQuiz(courseId: string, quizId: string): boolean {
  const all = readAll(courseId);
  const idx = all.findIndex((q) => q.id === quizId);
  if (idx < 0) return false;
  const { deletedAt: _d, ...rest } = all[idx]!;
  all[idx] = { ...rest, updatedAt: Date.now() };
  saveQuizzes(courseId, all);
  return true;
}

export function permanentlyDeleteQuiz(courseId: string, quizId: string): boolean {
  const all = readAll(courseId);
  const next = all.filter((q) => q.id !== quizId);
  if (next.length === all.length) return false;
  saveQuizzes(courseId, next);
  return true;
}

export function emptyQuizTrash(courseId: string): number {
  const all = readAll(courseId);
  const kept = all.filter((q) => !q.deletedAt);
  const removed = all.length - kept.length;
  if (removed > 0) saveQuizzes(courseId, kept);
  return removed;
}
