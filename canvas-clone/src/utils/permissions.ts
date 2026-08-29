import { useMemo } from "react";
import { readViewAs, useViewAs, type ViewAs } from "./studentView";

export type { ViewAs };

export function isStudentView(view: ViewAs = readViewAs()): boolean {
  return view === "student";
}

export function isTaView(view: ViewAs = readViewAs()): boolean {
  return view === "ta";
}

export function isInstructorView(view: ViewAs = readViewAs()): boolean {
  return view === "instructor";
}

/** TA or instructor — unpublished content, grading, moderation. */
export function isStaffView(view: ViewAs = readViewAs()): boolean {
  return view === "ta" || view === "instructor";
}

/** Course content TAs can author in Canvas: assignments, quizzes, pages, modules, files, discussions, announcements, banks, syllabus. */
export function canEditCourseContent(view: ViewAs = readViewAs()): boolean {
  return isStaffView(view);
}

/** Assignments — add, edit, delete, and publish (Canvas `manage_assignments_*`). */
export function canEditAssignments(view: ViewAs = readViewAs()): boolean {
  return canEditCourseContent(view);
}

/** Pages — create, update, and delete (Canvas `manage_wiki_*`). */
export function canEditPages(view: ViewAs = readViewAs()): boolean {
  return canEditCourseContent(view);
}

/** Publish or unpublish the course itself. */
export function canPublishCourse(view: ViewAs = readViewAs()): boolean {
  return isStaffView(view);
}

/** Course settings, import/export, nav visibility. */
export function canManageCourse(view: ViewAs = readViewAs()): boolean {
  return view === "instructor";
}

/** Add or remove instructors and TAs. */
export function canManageStaffRoster(view: ViewAs = readViewAs()): boolean {
  return view === "instructor";
}

/** Add students to the roster. */
export function canAddStudents(view: ViewAs = readViewAs()): boolean {
  return isStaffView(view);
}

/** Quiz/time accommodations and moderate extras. */
export function canManageAccommodations(view: ViewAs = readViewAs()): boolean {
  return isStaffView(view);
}

/** Appointment groups and due-date drag (Canvas manage calendar). */
export function canManageCalendarSchedule(view: ViewAs = readViewAs()): boolean {
  return isStaffView(view);
}

/** Create, edit, or delete courses from the catalog. */
export function canCreateCourses(view: ViewAs = readViewAs()): boolean {
  return view === "instructor";
}

/** Stamp on staff-authored grade comments (Canvas Teacher vs TA). */
export function staffCommentRole(view: ViewAs = readViewAs()): "ta" | "instructor" {
  return view === "ta" ? "ta" : "instructor";
}

export function usePermissions() {
  const viewAs = useViewAs();
  return useMemo(
    () => ({
      viewAs,
      isStudentView: isStudentView(viewAs),
      isTaView: isTaView(viewAs),
      isInstructorView: isInstructorView(viewAs),
      isStaffView: isStaffView(viewAs),
      canEditCourseContent: canEditCourseContent(viewAs),
      canEditAssignments: canEditAssignments(viewAs),
      canEditPages: canEditPages(viewAs),
      canPublishCourse: canPublishCourse(viewAs),
      canManageCourse: canManageCourse(viewAs),
      canManageStaffRoster: canManageStaffRoster(viewAs),
      canAddStudents: canAddStudents(viewAs),
      canManageAccommodations: canManageAccommodations(viewAs),
      canManageCalendarSchedule: canManageCalendarSchedule(viewAs),
      canCreateCourses: canCreateCourses(viewAs),
      staffCommentRole: staffCommentRole(viewAs),
    }),
    [viewAs],
  );
}
