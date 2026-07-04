import { mockCourses as seedCourses } from "../data/mockData";
import { cleanupCourseData } from "./courseCleanup";
import type { AssignmentSubmissionType } from "./assignments";
import { DEFAULT_LATE_PENALTY_PRESET_ID, type LatePenaltyPreset } from "./latePenalty";
import { toLatePenaltyPreset, type CourseCustomLatePenaltyPreset } from "./courseLatePenalty";
import type { CourseNavItemId } from "./courseNavigation";

export const COURSE_COLORS = [
  "#E74C3C",
  "#27AE60",
  "#3498DB",
  "#9B59B6",
  "#F39C12",
  "#1ABC9C",
];

export type Course = {
  id: string;
  short_name: string;
  title: string;
  code: string;
  term: string;
  color: string;
  published: boolean;
  updated_at: string;
  archived?: boolean;
  defaultLatePenaltyPresetId?: string;
  defaultAllowLateSubmissions?: boolean;
  defaultAllowResubmissions?: boolean;
  defaultSubmissionType?: AssignmentSubmissionType;
  customLatePenaltyPresets?: CourseCustomLatePenaltyPreset[];
  studentNavHidden?: CourseNavItemId[];
};

export function getCourseLatePenaltyPresets(course?: Course): LatePenaltyPreset[] {
  return (course?.customLatePenaltyPresets ?? []).map(toLatePenaltyPreset);
}

export function getCourseAssignmentDefaults(course?: Course) {
  return {
    submissionType: course?.defaultSubmissionType ?? ("online_text" as AssignmentSubmissionType),
    allowLateSubmissions: course?.defaultAllowLateSubmissions ?? true,
    allowResubmissions: course?.defaultAllowResubmissions ?? true,
    latePenaltyPresetId:
      course?.defaultLatePenaltyPresetId ?? DEFAULT_LATE_PENALTY_PRESET_ID,
  };
}

const COURSES_KEY = "canvasClone:courses";

function readRaw(): Course[] {
  try {
    const raw = window.localStorage.getItem(COURSES_KEY);
    if (!raw) return seedCourses.map((c) => ({ ...c, archived: false }));
    const parsed = JSON.parse(raw) as Course[];
    return Array.isArray(parsed) && parsed.length
      ? parsed.map((c) => ({ ...c, archived: c.archived ?? false }))
      : seedCourses.map((c) => ({ ...c, archived: false }));
  } catch {
    return seedCourses.map((c) => ({ ...c, archived: false }));
  }
}

export function loadCourses(includeArchived = true): Course[] {
  const all = readRaw();
  return includeArchived ? all : all.filter((c) => !c.archived);
}

export function getDistinctTerms(): string[] {
  const terms = new Set(loadCourses().map((c) => c.term).filter(Boolean));
  return [...terms].sort((a, b) => b.localeCompare(a));
}

export function saveCourses(courses: Course[]) {
  try {
    window.localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
    window.dispatchEvent(new Event("canvasClone:coursesChanged"));
  } catch {}
}

export function updateCourse(id: string, patch: Partial<Course>) {
  const courses = readRaw().map((c) =>
    c.id === id
      ? { ...c, ...patch, updated_at: patch.updated_at ?? new Date().toISOString().slice(0, 10) }
      : c,
  );
  saveCourses(courses);
}

export function addCourse(course: Omit<Course, "id" | "updated_at" | "archived"> & { id?: string }) {
  const courses = readRaw();
  const id = course.id ?? String(Date.now());
  courses.push({
    ...course,
    id,
    archived: false,
    updated_at: new Date().toISOString().slice(0, 10),
  } as Course);
  saveCourses(courses);
  return id;
}

export function getCourseById(id: string): Course | undefined {
  return readRaw().find((c) => c.id === id);
}

export function archiveCourse(id: string) {
  updateCourse(id, { archived: true, published: false });
}

export function unarchiveCourse(id: string) {
  updateCourse(id, { archived: false });
}

export function deleteCourse(id: string) {
  deleteCourses([id]);
}

export function deleteCourses(ids: string[]) {
  const toDelete = new Set(ids.filter(Boolean));
  if (!toDelete.size) return;
  cleanupCourseData([...toDelete]);
  const courses = readRaw().filter((c) => !toDelete.has(c.id));
  saveCourses(courses);
}

export function duplicateCourse(sourceId: string): string | null {
  const source = getCourseById(sourceId);
  if (!source) return null;
  return addCourse({
    title: `${source.title} (Copy)`,
    code: `${source.code}-COPY`,
    short_name: source.short_name,
    term: source.term,
    color: source.color,
    published: false,
    defaultLatePenaltyPresetId: source.defaultLatePenaltyPresetId,
    defaultAllowLateSubmissions: source.defaultAllowLateSubmissions,
    defaultAllowResubmissions: source.defaultAllowResubmissions,
    defaultSubmissionType: source.defaultSubmissionType,
    customLatePenaltyPresets: source.customLatePenaltyPresets,
    studentNavHidden: source.studentNavHidden,
  });
}

export { duplicateCourseWithContent } from "./courseDuplicate";
