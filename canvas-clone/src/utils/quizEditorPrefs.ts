import { getCourseById } from "./coursesStore";
import type { Quiz } from "./quizzes";

export type MonacoEditorOverride = "inherit" | "on" | "off";

/** Course-level Monaco default (#31). */
export function getCourseMonacoDefault(courseId: string): boolean {
  return getCourseById(courseId)?.monacoCodeEditor === true;
}

export function monacoOverrideFromQuiz(quiz?: Quiz | null): MonacoEditorOverride {
  if (quiz?.monacoEditor === true) return "on";
  if (quiz?.monacoEditor === false) return "off";
  return "inherit";
}

export function monacoEditorFieldFromOverride(
  override: MonacoEditorOverride,
): boolean | undefined {
  if (override === "inherit") return undefined;
  return override === "on";
}

/**
 * Resolve Monaco vs plain textarea for coding fields (#31).
 * Quiz explicit on/off wins; otherwise the course setting applies universally.
 */
export function shouldUseMonacoEditor(
  courseId: string,
  quiz?: Pick<Quiz, "monacoEditor"> | Quiz | null,
): boolean {
  if (quiz?.monacoEditor === true) return true;
  if (quiz?.monacoEditor === false) return false;
  return getCourseMonacoDefault(courseId);
}
