import { loadRoster } from "./courseRoster";
import { isItemGradeVisible } from "./gradeVisibility";

/**
 * Display name for a student in GradePro.
 * When anonymous grading is on and the item grade is not yet visible to that
 * student, returns a stable `Student N` label from roster order (1-based).
 * Otherwise returns the real name.
 */
export function graderDisplayName({
  courseId,
  columnKey,
  studentId,
  realName,
  anonymousEnabled,
}: {
  courseId: string;
  columnKey: string;
  studentId: string;
  realName: string;
  anonymousEnabled: boolean;
}): string {
  if (!isIdentityHidden({ courseId, columnKey, studentId, anonymousEnabled })) {
    return realName;
  }

  const students = loadRoster(courseId).filter((m) => m.role === "student");
  const idx = students.findIndex((m) => m.id === studentId);
  const n = idx >= 0 ? idx + 1 : students.length + 1;
  return `Student ${n}`;
}

/** True when names, avatars, and file names should be hidden. */
export function isIdentityHidden({
  courseId,
  columnKey,
  studentId,
  anonymousEnabled,
}: {
  courseId: string;
  columnKey: string;
  studentId: string;
  anonymousEnabled: boolean;
}): boolean {
  if (!anonymousEnabled) return false;
  return !isItemGradeVisible(courseId, columnKey, studentId);
}

export function anonymousFileLabel(hidden: boolean, fileName?: string | null): string {
  if (!fileName) return hidden ? "Submitted file" : "File";
  return hidden ? "Submitted file" : fileName;
}
