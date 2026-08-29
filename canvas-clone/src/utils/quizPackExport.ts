import { exportQuizToJson } from "./quizExport";
import { loadActiveQuizzes, loadTrashedQuizzes } from "./quizSoftDelete";
import type { Quiz } from "./quizzes";

export type QuizPackPayload = {
  version: 1;
  kind: "quiz_pack";
  courseId: string;
  exportedAt: number;
  quizzes: Quiz[];
};

export function exportCourseQuizPack(courseId: string, includeTrash = false): string {
  const active = loadActiveQuizzes(courseId);
  const trash = includeTrash ? loadTrashedQuizzes(courseId) : [];
  const payload: QuizPackPayload = {
    version: 1,
    kind: "quiz_pack",
    courseId,
    exportedAt: Date.now(),
    quizzes: [...active, ...trash].map((q) => JSON.parse(exportQuizToJson(q)) as Quiz),
  };
  return JSON.stringify(payload, null, 2);
}

export type QuizPackImportResult = {
  imported: number;
  skipped: number;
  titles: string[];
};

export function parseQuizPackJson(raw: string): QuizPackPayload | null {
  try {
    const parsed = JSON.parse(raw) as QuizPackPayload;
    if (parsed?.kind !== "quiz_pack" || !Array.isArray(parsed.quizzes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Merge pack quizzes into course (by id — skip existing ids). */
export function importCourseQuizPack(
  _courseId: string,
  pack: QuizPackPayload,
  existing: Quiz[],
): { next: Quiz[]; result: QuizPackImportResult } {
  const ids = new Set(existing.map((q) => q.id));
  const added: Quiz[] = [];
  let skipped = 0;
  for (const q of pack.quizzes) {
    if (ids.has(q.id)) {
      skipped += 1;
      continue;
    }
    added.push({ ...q, deletedAt: undefined });
    ids.add(q.id);
  }
  return {
    next: [...added, ...existing],
    result: {
      imported: added.length,
      skipped,
      titles: added.map((q) => q.title),
    },
  };
}
