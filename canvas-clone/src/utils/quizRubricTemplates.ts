/**
 * Saved essay rubric templates (course-local localStorage library).
 */

import type { RubricCriterionDef } from "./assignmentRubric";
import { createDefaultEssayRubric } from "./assignmentRubric";

export type QuizRubricTemplate = {
  id: string;
  title: string;
  criteria: RubricCriterionDef[];
  updatedAt: number;
};

const PREFIX = "canvasClone:quizRubricTemplates:";

function key(courseId: string) {
  return `${PREFIX}${courseId}`;
}

function load(courseId: string): QuizRubricTemplate[] {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuizRubricTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(courseId: string, rows: QuizRubricTemplate[]) {
  window.localStorage.setItem(key(courseId), JSON.stringify(rows));
}

export function listQuizRubricTemplates(courseId: string): QuizRubricTemplate[] {
  return load(courseId).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveQuizRubricTemplate(
  courseId: string,
  input: { title: string; criteria: RubricCriterionDef[]; id?: string },
): QuizRubricTemplate {
  const title = input.title.trim() || "Untitled rubric";
  const criteria = input.criteria.length
    ? input.criteria
    : createDefaultEssayRubric(10);
  const all = load(courseId);
  if (input.id) {
    const next = all.map((row) =>
      row.id === input.id
        ? { ...row, title, criteria, updatedAt: Date.now() }
        : row,
    );
    const found = next.find((r) => r.id === input.id);
    if (found) {
      save(courseId, next);
      return found;
    }
  }
  const created: QuizRubricTemplate = {
    id: `qrtrt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    title,
    criteria,
    updatedAt: Date.now(),
  };
  save(courseId, [created, ...all]);
  return created;
}

export function deleteQuizRubricTemplate(courseId: string, id: string): void {
  save(
    courseId,
    load(courseId).filter((r) => r.id !== id),
  );
}

/** Replace all essay rubric templates (course package import). */
export function replaceQuizRubricTemplates(
  courseId: string,
  rows: QuizRubricTemplate[],
): void {
  save(courseId, Array.isArray(rows) ? rows : []);
}
