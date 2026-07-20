import { loadUser } from "./userStore";
import { getCourseById } from "./coursesStore";
import { notifyGradesPosted } from "./notifications";

export type StudentGradePublishOverride = "published" | "hidden";

export type CourseGradePublishState = {
  allPublished: boolean;
  /** Per-column default: true = published for all students (unless cell/student override). */
  columns: Record<string, boolean>;
  students: Record<string, StudentGradePublishOverride>;
  /** Per-cell overrides keyed as `${studentId}::${columnKey}`. */
  cells: Record<string, StudentGradePublishOverride>;
};

export const GRADE_PUBLISH_CHANGED_EVENT = "canvasClone:gradePublishChanged";

export const SUMMARY_OVERALL_PERCENT_KEY = "summary:overallPercent";
export const SUMMARY_LETTER_KEY = "summary:letter";

export function cellPublishKey(studentId: string, columnKey: string) {
  return `${studentId}::${columnKey}`;
}

function key(courseId: string) {
  return `canvasClone:gradePublish:${courseId}`;
}

function defaultState(): CourseGradePublishState {
  return { allPublished: false, columns: {}, students: {}, cells: {} };
}

export function loadGradePublishState(courseId: string): CourseGradePublishState {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<CourseGradePublishState>;
    return {
      allPublished: parsed.allPublished ?? false,
      columns: parsed.columns ?? {},
      students: parsed.students ?? {},
      cells: parsed.cells ?? {},
    };
  } catch {
    return defaultState();
  }
}

function saveGradePublishState(courseId: string, state: CourseGradePublishState) {
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(state));
    window.dispatchEvent(new Event(GRADE_PUBLISH_CHANGED_EVENT));
  } catch {}
}

export function getStudentGradePublishStatus(
  courseId: string,
  studentId: string,
): "published" | "hidden" | "default" {
  const override = loadGradePublishState(courseId).students[studentId];
  return override ?? "default";
}

/**
 * Whole-student visibility (no column). Used for course-level badges and row toggles.
 * Precedence: per-student override → allPublished.
 */
export function isGradeVisibleToStudent(
  courseId: string,
  studentId = loadUser().id,
): boolean {
  const state = loadGradePublishState(courseId);
  const override = state.students[studentId];
  if (override === "published") return true;
  if (override === "hidden") return false;
  return state.allPublished;
}

/**
 * Column / item visibility for a student.
 * Precedence: per-cell → explicit column setting → per-student global → allPublished.
 *
 * Explicit column post/hide (gradebook header eye) must win over a whole-student
 * override so posting one assignment shows that grade even when the class (or
 * student) is otherwise hidden.
 */
export function isColumnGradeVisible(
  courseId: string,
  columnKey: string,
  studentId = loadUser().id,
): boolean {
  const state = loadGradePublishState(courseId);
  const cell = state.cells[cellPublishKey(studentId, columnKey)];
  if (cell === "published") return true;
  if (cell === "hidden") return false;

  if (Object.prototype.hasOwnProperty.call(state.columns, columnKey)) {
    return state.columns[columnKey] === true;
  }

  const studentOverride = state.students[studentId];
  if (studentOverride === "published") return true;
  if (studentOverride === "hidden") return false;

  return state.allPublished;
}

/** Alias used by GradePro student surfaces for item-level gating. */
export function isItemGradeVisible(
  courseId: string,
  columnKey: string,
  studentId = loadUser().id,
): boolean {
  return isColumnGradeVisible(courseId, columnKey, studentId);
}

export function getColumnPublishStatus(
  courseId: string,
  columnKey: string,
): "published" | "hidden" | "default" {
  const state = loadGradePublishState(courseId);
  if (!Object.prototype.hasOwnProperty.call(state.columns, columnKey)) {
    return "default";
  }
  return state.columns[columnKey] ? "published" : "hidden";
}

/** Effective column default without student overrides (for header icon). */
export function isColumnPublishedForAll(courseId: string, columnKey: string): boolean {
  const state = loadGradePublishState(courseId);
  if (Object.prototype.hasOwnProperty.call(state.columns, columnKey)) {
    return state.columns[columnKey] === true;
  }
  return state.allPublished;
}

export function setAllGradesPublished(courseId: string, published: boolean) {
  const state = loadGradePublishState(courseId);
  const wasPublished = state.allPublished;

  const students = { ...state.students };
  if (published) {
    for (const [studentId, override] of Object.entries(students)) {
      if (override === "hidden") delete students[studentId];
    }
  } else {
    for (const [studentId, override] of Object.entries(students)) {
      if (override === "published") delete students[studentId];
    }
  }

  // Reset column overrides so course-wide post/hide is the clear default.
  saveGradePublishState(courseId, {
    ...state,
    allPublished: published,
    students,
    columns: {},
  });
  if (published && !wasPublished) {
    const course = getCourseById(courseId);
    notifyGradesPosted(courseId, course?.title ?? "your course", false);
  }
}

export function setColumnGradesPublished(
  courseId: string,
  columnKey: string,
  published: boolean,
) {
  const state = loadGradePublishState(courseId);
  const wasVisible = isColumnPublishedForAll(courseId, columnKey);
  const columns = { ...state.columns, [columnKey]: published };

  // Clear conflicting per-cell overrides for this column.
  const cells = { ...state.cells };
  const suffix = `::${columnKey}`;
  for (const k of Object.keys(cells)) {
    if (!k.endsWith(suffix)) continue;
    const override = cells[k];
    if (published && override === "hidden") delete cells[k];
    if (!published && override === "published") delete cells[k];
  }

  saveGradePublishState(courseId, { ...state, columns, cells });
  if (published && !wasVisible) {
    const course = getCourseById(courseId);
    notifyGradesPosted(courseId, course?.title ?? "your course", false);
  }
}

export function toggleColumnGradeVisibility(courseId: string, columnKey: string) {
  const published = isColumnPublishedForAll(courseId, columnKey);
  setColumnGradesPublished(courseId, columnKey, !published);
}

export function setCellGradePublished(
  courseId: string,
  studentId: string,
  columnKey: string,
  published: boolean,
) {
  const wasVisible = isColumnGradeVisible(courseId, columnKey, studentId);
  const state = loadGradePublishState(courseId);
  const cells = {
    ...state.cells,
    [cellPublishKey(studentId, columnKey)]: published
      ? ("published" as const)
      : ("hidden" as const),
  };
  saveGradePublishState(courseId, { ...state, cells });
  if (published && !wasVisible) {
    const course = getCourseById(courseId);
    notifyGradesPosted(courseId, course?.title ?? "your course", true);
  }
}

export function setStudentGradePublished(
  courseId: string,
  studentId: string,
  published: boolean,
) {
  const wasVisible = isGradeVisibleToStudent(courseId, studentId);
  const state = loadGradePublishState(courseId);
  const students = { ...state.students };
  if (published) {
    students[studentId] = "published";
  } else {
    students[studentId] = "hidden";
  }
  saveGradePublishState(courseId, { ...state, students });
  if (published && !wasVisible) {
    const course = getCourseById(courseId);
    notifyGradesPosted(courseId, course?.title ?? "your course", true);
  }
}

/**
 * Post/hide a specific item for one student (GradePro header button).
 * Uses per-cell override so other columns stay unchanged.
 */
export function setStudentItemGradePublished(
  courseId: string,
  studentId: string,
  columnKey: string,
  published: boolean,
) {
  setCellGradePublished(courseId, studentId, columnKey, published);
}

export function clearStudentGradePublishOverride(courseId: string, studentId: string) {
  const state = loadGradePublishState(courseId);
  const students = { ...state.students };
  delete students[studentId];
  saveGradePublishState(courseId, { ...state, students });
}

export function toggleStudentGradeVisibility(courseId: string, studentId: string) {
  const state = loadGradePublishState(courseId);
  const current = state.students[studentId];
  const wasVisible = isGradeVisibleToStudent(courseId, studentId);
  const students = { ...state.students };

  if (current === "published") {
    students[studentId] = "hidden";
  } else if (current === "hidden") {
    delete students[studentId];
  } else if (state.allPublished) {
    students[studentId] = "hidden";
  } else {
    students[studentId] = "published";
  }

  saveGradePublishState(courseId, { ...state, students });
  const override = students[studentId];
  const nowVisible =
    override === "published" ? true : override === "hidden" ? false : state.allPublished;
  if (nowVisible && !wasVisible) {
    const course = getCourseById(courseId);
    notifyGradesPosted(courseId, course?.title ?? "your course", true);
  }
}

export function isGradesHiddenFromStudent(
  courseId: string,
  studentId: string,
): boolean {
  return getStudentGradePublishStatus(courseId, studentId) === "hidden";
}
