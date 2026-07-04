import type { Course } from "./coursesStore";

export type CourseNavItemId =
  | "home"
  | "announcements"
  | "discussions"
  | "assignments"
  | "quizzes"
  | "modules"
  | "pages"
  | "files"
  | "grades";

export const STUDENT_COURSE_NAV_ITEMS: { id: CourseNavItemId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "announcements", label: "Announcements" },
  { id: "discussions", label: "Discussions" },
  { id: "assignments", label: "Assignments" },
  { id: "quizzes", label: "Quizzes" },
  { id: "modules", label: "Modules" },
  { id: "pages", label: "Pages" },
  { id: "files", label: "Files" },
  { id: "grades", label: "Grades" },
];

export function getStudentHiddenNavItems(course?: Course | null): CourseNavItemId[] {
  return course?.studentNavHidden ?? [];
}

export function isCourseNavItemVisibleToStudents(
  id: CourseNavItemId,
  course?: Course | null,
): boolean {
  return !getStudentHiddenNavItems(course).includes(id);
}

export function getStudentVisibleNavIds(course?: Course | null): CourseNavItemId[] {
  return STUDENT_COURSE_NAV_ITEMS.filter((item) =>
    isCourseNavItemVisibleToStudents(item.id, course),
  ).map((item) => item.id);
}

export function getCourseNavPath(courseId: string, id: CourseNavItemId): string {
  const base = `/courses/${courseId}`;
  if (id === "home") return base;
  return `${base}/${id}`;
}

/** True when pathname is the course sidebar list/index route (not a deep-linked item). */
export function getCourseNavIdFromListPath(
  pathname: string,
  courseId: string,
): CourseNavItemId | null {
  const base = `/courses/${courseId}`;
  if (pathname === base || pathname === `${base}/home`) return "home";

  for (const item of STUDENT_COURSE_NAV_ITEMS) {
    if (item.id === "home") continue;
    if (pathname === `${base}/${item.id}`) return item.id;
  }

  return null;
}

export function isHiddenNavListPath(
  pathname: string,
  courseId: string,
  course?: Course | null,
): boolean {
  const navId = getCourseNavIdFromListPath(pathname, courseId);
  if (!navId) return false;
  return !isCourseNavItemVisibleToStudents(navId, course);
}

export function getStudentNavFallbackPath(courseId: string, course?: Course | null): string {
  const visible = getStudentVisibleNavIds(course);
  const first = visible[0] ?? "home";
  return getCourseNavPath(courseId, first);
}

/** Student-safe path to a nav list page, or a fallback when that list is hidden. */
export function getStudentNavListPath(
  courseId: string,
  navId: CourseNavItemId,
  course?: Course | null,
): string {
  if (isCourseNavItemVisibleToStudents(navId, course)) {
    return getCourseNavPath(courseId, navId);
  }
  return getStudentNavFallbackPath(courseId, course);
}

/** Prefer an explicit back target unless it points at a hidden nav list page. */
export function resolveStudentBackPath(
  courseId: string,
  navId: CourseNavItemId,
  course?: Course | null,
  preferred?: string | null,
): string {
  if (preferred && !isHiddenNavListPath(preferred, courseId, course)) {
    return preferred;
  }
  return getStudentNavListPath(courseId, navId, course);
}

/** Toggle student visibility for a nav item; returns null if all items would be hidden. */
export function computeStudentNavHiddenAfterToggle(
  currentHidden: CourseNavItemId[],
  id: CourseNavItemId,
  makeVisible: boolean,
): CourseNavItemId[] | null {
  const next = makeVisible
    ? currentHidden.filter((item) => item !== id)
    : currentHidden.includes(id)
      ? currentHidden
      : [...currentHidden, id];
  if (next.length >= STUDENT_COURSE_NAV_ITEMS.length) return null;
  return next;
}
