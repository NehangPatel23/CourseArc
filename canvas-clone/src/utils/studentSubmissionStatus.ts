import { getAssignmentById, loadAssignments, isStudentViewableAssignment } from "./assignments";
import { getStudentSubmission } from "./assignmentSubmissions";
import { loadCourses } from "./coursesStore";
import {
  getParticipationForStudent,
} from "./discussionParticipations";
import { isGradedDiscussion, loadTopics } from "./discussions";
import type { GradebookColumn, GradebookColumnKind } from "./gradebook";
import { isLateSubmission } from "./latePenalty";
import { getStudentAttemptsForQuiz } from "./quizSubmissions";
import { loadQuizzes, isStudentViewableQuiz, getQuizById } from "./quizzes";
import { loadUser } from "./userStore";
import { loadRoster } from "./courseRoster";
import { isGradeExcused } from "./excusedGrades";
import { getEffectiveDueAt } from "./dueDateOverrides";

export type StudentSubmissionStatus =
  | "missing"
  | "late"
  | "submitted"
  | "graded"
  | "upcoming"
  | "none"
  | "excused";

export type MissingWorkItem = {
  courseId: string;
  courseShortName: string;
  courseColor: string;
  kind: GradebookColumnKind;
  itemId: string;
  title: string;
  dueAt: number;
  path: string;
};

function itemIdFromColumn(column: GradebookColumn): string {
  return column.id.replace(/^(assignment|quiz|discussion):/, "");
}

function dueAtForColumn(courseId: string, column: GradebookColumn, studentId?: string): number | undefined {
  const itemId = itemIdFromColumn(column);
  if (column.kind === "assignment") {
    const due = getAssignmentById(courseId, itemId)?.dueAt;
    return studentId
      ? getEffectiveDueAt(courseId, "assignment", itemId, due, studentId)
      : due;
  }
  if (column.kind === "quiz") {
    const due = getQuizById(courseId, itemId)?.dueAt;
    return studentId
      ? getEffectiveDueAt(courseId, "quiz", itemId, due, studentId)
      : due;
  }
  const due = loadTopics(courseId).find((t) => t.id === itemId)?.dueAt;
  return studentId
    ? getEffectiveDueAt(courseId, "discussion", itemId, due, studentId)
    : due;
}

function hasSubmission(
  courseId: string,
  column: GradebookColumn,
  studentId: string,
): { exists: boolean; submittedAt?: number; graded: boolean } {
  const itemId = itemIdFromColumn(column);

  if (column.kind === "assignment") {
    const sub = getStudentSubmission(courseId, itemId, studentId);
    if (!sub) return { exists: false, graded: false };
    return {
      exists: true,
      submittedAt: sub.submittedAt,
      graded: sub.status === "graded",
    };
  }

  if (column.kind === "quiz") {
    const attempts = getStudentAttemptsForQuiz(courseId, itemId, studentId);
    if (attempts.length === 0) return { exists: false, graded: false };
    const latest = [...attempts].sort((a, b) => b.submittedAt - a.submittedAt)[0];
    return {
      exists: true,
      submittedAt: latest.submittedAt,
      graded: typeof latest.score === "number" || latest.gradedAt != null,
    };
  }

  const part = getParticipationForStudent(courseId, itemId, studentId);
  if (!part || part.replyCount <= 0) {
    // Graded discussions may create a participation row with replyCount 0 when missing.
    if (part?.status === "graded") {
      return { exists: true, submittedAt: part.firstPostedAt, graded: true };
    }
    return { exists: false, graded: false };
  }
  return {
    exists: true,
    submittedAt: part.firstPostedAt,
    graded: part.status === "graded",
  };
}

/**
 * Live submission status for a gradebook column (does not persist "missing").
 */
export function getStudentSubmissionStatus(
  courseId: string,
  column: GradebookColumn,
  studentId = loadUser().id,
  now = Date.now(),
): StudentSubmissionStatus {
  if (isGradeExcused(courseId, column.id, studentId)) return "excused";
  const dueAt = dueAtForColumn(courseId, column, studentId);
  const { exists, submittedAt, graded } = hasSubmission(courseId, column, studentId);

  if (exists) {
    if (submittedAt != null && isLateSubmission({ submittedAt }, dueAt)) {
      return "late";
    }
    return graded ? "graded" : "submitted";
  }

  if (typeof dueAt === "number" && dueAt < now) {
    return "missing";
  }

  if (typeof dueAt === "number") {
    return "upcoming";
  }

  return "none";
}

/** Missing work across published courses for the given student. */
export function listMissingWork(
  studentId = loadUser().id,
  now = Date.now(),
): MissingWorkItem[] {
  const items: MissingWorkItem[] = [];

  for (const course of loadCourses()) {
    if (course.archived || !course.published) continue;

    for (const a of loadAssignments(course.id)) {
      if (!isStudentViewableAssignment(a, now)) continue;
      const dueAt = getEffectiveDueAt(course.id, "assignment", a.id, a.dueAt, studentId);
      if (typeof dueAt !== "number" || dueAt >= now) continue;
      const sub = getStudentSubmission(course.id, a.id, studentId);
      if (sub) continue;
      items.push({
        courseId: course.id,
        courseShortName: course.short_name,
        courseColor: course.color,
        kind: "assignment",
        itemId: a.id,
        title: a.title,
        dueAt,
        path: `/courses/${course.id}/assignments/${a.id}`,
      });
    }

    for (const q of loadQuizzes(course.id)) {
      if (!isStudentViewableQuiz(q, now)) continue;
      const dueAt = getEffectiveDueAt(course.id, "quiz", q.id, q.dueAt, studentId);
      if (typeof dueAt !== "number" || dueAt >= now) continue;
      const attempts = getStudentAttemptsForQuiz(course.id, q.id, studentId);
      if (attempts.length > 0) continue;
      items.push({
        courseId: course.id,
        courseShortName: course.short_name,
        courseColor: course.color,
        kind: "quiz",
        itemId: q.id,
        title: q.title,
        dueAt,
        path: `/courses/${course.id}/quizzes/${q.id}`,
      });
    }

    for (const t of loadTopics(course.id)) {
      if (!isGradedDiscussion(t)) continue;
      if (!(t.published || t.status === "published")) continue;
      const dueAt = getEffectiveDueAt(course.id, "discussion", t.id, t.dueAt, studentId);
      if (typeof dueAt !== "number" || dueAt >= now) continue;
      const part = getParticipationForStudent(course.id, t.id, studentId);
      if (part && (part.replyCount > 0 || part.status === "graded" || part.status === "submitted")) {
        continue;
      }
      items.push({
        courseId: course.id,
        courseShortName: course.short_name,
        courseColor: course.color,
        kind: "discussion",
        itemId: t.id,
        title: t.title,
        dueAt,
        path: `/courses/${course.id}/discussions/${t.id}`,
      });
    }
  }

  return items.sort((a, b) => a.dueAt - b.dueAt);
}

export type MissingStudentRow = {
  studentId: string;
  studentName: string;
};

export type CourseMissingItem = MissingWorkItem & {
  missingCount: number;
  missingStudents: MissingStudentRow[];
};

function studentHasItem(courseId: string, kind: GradebookColumnKind, itemId: string, studentId: string): boolean {
  if (kind === "assignment") return Boolean(getStudentSubmission(courseId, itemId, studentId));
  if (kind === "quiz") return getStudentAttemptsForQuiz(courseId, itemId, studentId).length > 0;
  const part = getParticipationForStudent(courseId, itemId, studentId);
  return Boolean(
    part && (part.replyCount > 0 || part.status === "graded" || part.status === "submitted"),
  );
}

function defaultDueForItem(
  courseId: string,
  kind: GradebookColumnKind,
  itemId: string,
): number | undefined {
  if (kind === "assignment") return getAssignmentById(courseId, itemId)?.dueAt;
  if (kind === "quiz") return getQuizById(courseId, itemId)?.dueAt;
  return loadTopics(courseId).find((t) => t.id === itemId)?.dueAt;
}

/** Students who have not submitted a due item (using each student's effective due date). */
export function listMissingStudentsForItem(
  courseId: string,
  kind: GradebookColumnKind,
  itemId: string,
  now = Date.now(),
): MissingStudentRow[] {
  const defaultDue = defaultDueForItem(courseId, kind, itemId);
  const students = loadRoster(courseId).filter((m) => m.role === "student");
  return students
    .filter((m) => {
      if (studentHasItem(courseId, kind, itemId, m.id)) return false;
      const dueAt = getEffectiveDueAt(courseId, kind, itemId, defaultDue, m.id);
      return typeof dueAt === "number" && dueAt < now;
    })
    .map((m) => ({ studentId: m.id, studentName: m.name }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

/** Missing items in one course with per-item student lists (instructor). */
export function listMissingWorkForCourse(
  courseId: string,
  now = Date.now(),
): CourseMissingItem[] {
  const course = loadCourses().find((c) => c.id === courseId);
  if (!course) return [];
  const items: CourseMissingItem[] = [];

  for (const a of loadAssignments(courseId)) {
    if (!isStudentViewableAssignment(a, now)) continue;
    const missingStudents = listMissingStudentsForItem(courseId, "assignment", a.id, now);
    if (missingStudents.length === 0) continue;
    items.push({
      courseId,
      courseShortName: course.short_name,
      courseColor: course.color,
      kind: "assignment",
      itemId: a.id,
      title: a.title,
      dueAt: a.dueAt ?? now,
      path: `/courses/${courseId}/assignments/${a.id}/grade`,
      missingCount: missingStudents.length,
      missingStudents,
    });
  }

  for (const q of loadQuizzes(courseId)) {
    if (!isStudentViewableQuiz(q, now)) continue;
    const missingStudents = listMissingStudentsForItem(courseId, "quiz", q.id, now);
    if (missingStudents.length === 0) continue;
    items.push({
      courseId,
      courseShortName: course.short_name,
      courseColor: course.color,
      kind: "quiz",
      itemId: q.id,
      title: q.title,
      dueAt: q.dueAt ?? now,
      path: `/courses/${courseId}/quizzes/${q.id}/grade`,
      missingCount: missingStudents.length,
      missingStudents,
    });
  }

  for (const t of loadTopics(courseId)) {
    if (!isGradedDiscussion(t)) continue;
    if (!(t.published || t.status === "published")) continue;
    const missingStudents = listMissingStudentsForItem(courseId, "discussion", t.id, now);
    if (missingStudents.length === 0) continue;
    items.push({
      courseId,
      courseShortName: course.short_name,
      courseColor: course.color,
      kind: "discussion",
      itemId: t.id,
      title: t.title,
      dueAt: t.dueAt ?? now,
      path: `/courses/${courseId}/discussions/${t.id}/grade`,
      missingCount: missingStudents.length,
      missingStudents,
    });
  }

  return items.sort((a, b) => a.dueAt - b.dueAt);
}

/** Cross-course instructor missing summary. */
export function listInstructorMissingWork(now = Date.now()): CourseMissingItem[] {
  const items: CourseMissingItem[] = [];
  for (const course of loadCourses()) {
    if (course.archived || !course.published) continue;
    items.push(...listMissingWorkForCourse(course.id, now));
  }
  return items.sort((a, b) => a.dueAt - b.dueAt);
}
