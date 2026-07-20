export type CourseHomeWidgetId =
  | "instructorTools"
  | "announcements"
  | "upcomingAssignments"
  | "grades"
  | "needsGrading"
  | "recentDiscussions"
  | "todo"
  | "comingUp"
  | "recentFiles"
  | "courseLinks";

export type CourseHomeLayoutPrefs = {
  widgets: CourseHomeWidgetId[];
  hidden: CourseHomeWidgetId[];
};

const DEFAULT_STUDENT: CourseHomeWidgetId[] = [
  "announcements",
  "upcomingAssignments",
  "grades",
  "recentDiscussions",
  "todo",
  "comingUp",
  "recentFiles",
  "courseLinks",
];

const DEFAULT_INSTRUCTOR: CourseHomeWidgetId[] = [
  "instructorTools",
  "announcements",
  "upcomingAssignments",
  "needsGrading",
  "recentDiscussions",
  "todo",
  "comingUp",
  "recentFiles",
  "courseLinks",
];

const STUDENT_AVAILABLE: CourseHomeWidgetId[] = [...DEFAULT_STUDENT];
const INSTRUCTOR_AVAILABLE: CourseHomeWidgetId[] = [...DEFAULT_INSTRUCTOR];

function layoutKey(courseId: string, studentView: boolean) {
  return `canvasClone:courseHomeLayout:${courseId}:${studentView ? "student" : "instructor"}`;
}

function normalizeLayout(
  studentView: boolean,
  parsed: Partial<CourseHomeLayoutPrefs>,
): CourseHomeLayoutPrefs {
  const available = new Set(studentView ? STUDENT_AVAILABLE : INSTRUCTOR_AVAILABLE);
  const defaults = studentView ? DEFAULT_STUDENT : DEFAULT_INSTRUCTOR;
  const widgets = (parsed.widgets ?? defaults).filter((id) => available.has(id));
  const hidden = (parsed.hidden ?? []).filter((id) => available.has(id));
  const visible = widgets.filter((id) => !hidden.includes(id));
  const missing = defaults.filter((id) => !visible.includes(id) && !hidden.includes(id));
  return { widgets: [...visible, ...missing], hidden };
}

export function loadCourseHomeLayout(
  courseId: string,
  studentView: boolean,
): CourseHomeLayoutPrefs {
  try {
    const raw = window.localStorage.getItem(layoutKey(courseId, studentView));
    if (!raw) {
      return {
        widgets: studentView ? [...DEFAULT_STUDENT] : [...DEFAULT_INSTRUCTOR],
        hidden: [],
      };
    }
    return normalizeLayout(studentView, JSON.parse(raw));
  } catch {
    return {
      widgets: studentView ? [...DEFAULT_STUDENT] : [...DEFAULT_INSTRUCTOR],
      hidden: [],
    };
  }
}

export function saveCourseHomeLayout(
  courseId: string,
  studentView: boolean,
  prefs: CourseHomeLayoutPrefs,
): void {
  try {
    window.localStorage.setItem(
      layoutKey(courseId, studentView),
      JSON.stringify(normalizeLayout(studentView, prefs)),
    );
    window.dispatchEvent(new Event("canvasClone:courseHomeLayoutChanged"));
  } catch {}
}

export function reorderCourseHomeWidgets(
  courseId: string,
  studentView: boolean,
  widgets: CourseHomeWidgetId[],
): void {
  const current = loadCourseHomeLayout(courseId, studentView);
  saveCourseHomeLayout(courseId, studentView, { ...current, widgets });
}

export function toggleCourseHomeWidgetVisibility(
  courseId: string,
  studentView: boolean,
  id: CourseHomeWidgetId,
): void {
  const current = loadCourseHomeLayout(courseId, studentView);
  const hidden = current.hidden.includes(id)
    ? current.hidden.filter((x) => x !== id)
    : [...current.hidden, id];
  saveCourseHomeLayout(courseId, studentView, { ...current, hidden });
}

export function resetCourseHomeLayout(courseId: string, studentView: boolean): void {
  saveCourseHomeLayout(courseId, studentView, {
    widgets: studentView ? [...DEFAULT_STUDENT] : [...DEFAULT_INSTRUCTOR],
    hidden: [],
  });
}

export const COURSE_HOME_WIDGET_LABELS: Record<CourseHomeWidgetId, string> = {
  instructorTools: "Instructor Tools",
  announcements: "Announcements",
  upcomingAssignments: "Upcoming Assignments",
  grades: "Grades",
  needsGrading: "Needs Grading",
  recentDiscussions: "Recent Discussions",
  todo: "To Do",
  comingUp: "Coming Up",
  recentFiles: "Recent Files",
  courseLinks: "Course Links",
};

export function getAvailableCourseHomeWidgets(studentView: boolean): CourseHomeWidgetId[] {
  return studentView ? [...STUDENT_AVAILABLE] : [...INSTRUCTOR_AVAILABLE];
}
