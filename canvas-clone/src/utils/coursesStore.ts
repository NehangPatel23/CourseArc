import { mockCourses as seedCourses } from "../data/mockData";
import { cleanupCourseData } from "./courseCleanup";
import { loadAssignments, saveAssignments, type AssignmentSubmissionType } from "./assignments";
import { loadTopics, saveTopics } from "./discussions";
import { DEFAULT_LATE_PENALTY_PRESET_ID, type LatePenaltyPreset } from "./latePenalty";
import { toLatePenaltyPreset, type CourseCustomLatePenaltyPreset } from "./courseLatePenalty";
import type { CourseNavItemId } from "./courseNavigation";
import type { GradingScheme } from "./gradingScheme";
import { loadQuizzes, saveQuizzes } from "./quizzes";

export const COURSE_COLORS = [
  "#E74C3C",
  "#27AE60",
  "#3498DB",
  "#9B59B6",
  "#F39C12",
  "#1ABC9C",
];

export type AssignmentGroup = {
  id: string;
  name: string;
  /** Weight as a percentage share (normalized against other groups with columns). */
  weight: number;
  /** Drop this many lowest-scoring items in the group before averaging. */
  dropLowest?: number;
  /** Drop this many highest-scoring items in the group before averaging. */
  dropHighest?: number;
  /** Column ids that must not be dropped. */
  neverDropIds?: string[];
  /** Extra-credit groups add to overall % without counting in the weight total. */
  extraCredit?: boolean;
};

export const DEFAULT_ASSIGNMENT_GROUP_ID = "ag_assignments";

export function normalizeAssignmentGroups(groups: AssignmentGroup[]): AssignmentGroup[] {
  const seen = new Set<string>();
  const out: AssignmentGroup[] = [];
  for (const group of groups) {
    const id = group.id?.trim() || createAssignmentGroupId();
    if (seen.has(id)) continue;
    seen.add(id);
    const name = (group.name ?? "").trim() || "Untitled group";
    out.push({
      id,
      name,
      weight: Number.isFinite(group.weight) ? Math.max(0, group.weight) : 0,
      dropLowest:
        typeof group.dropLowest === "number" && group.dropLowest > 0
          ? Math.floor(group.dropLowest)
          : undefined,
      dropHighest:
        typeof group.dropHighest === "number" && group.dropHighest > 0
          ? Math.floor(group.dropHighest)
          : undefined,
      extraCredit: group.extraCredit || undefined,
      neverDropIds: group.neverDropIds?.length ? group.neverDropIds : undefined,
    });
  }
  if (out.length === 0) {
    return [{ id: DEFAULT_ASSIGNMENT_GROUP_ID, name: "Assignments", weight: 100 }];
  }
  return out;
}

/** Group id stored on an item, or undefined when the item is unweighted. */
export function resolveItemGroupId(
  groups: AssignmentGroup[],
  groupId?: string | null,
): string | undefined {
  const resolved = normalizeAssignmentGroups(groups);
  if (groupId && resolved.some((g) => g.id === groupId)) return groupId;
  return undefined;
}

/** Reduce existing group weights so a newly added weight still fits in 100%. */
export function takeWeightFromGroups(
  groups: AssignmentGroup[],
  amount: number,
): AssignmentGroup[] {
  let remaining = Math.max(0, amount);
  if (!(remaining > 0)) return groups;
  return groups.map((g) => {
    if (remaining <= 0 || g.extraCredit) return g;
    const take = Math.min(g.weight, remaining);
    remaining -= take;
    return { ...g, weight: g.weight - take };
  });
}

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
  gradingScheme?: GradingScheme;
  /** Weighted assignment groups; omit for default single "Assignments" @ 100%. */
  assignmentGroups?: AssignmentGroup[];
  /** When false, overall grade is total points (not group weights). Default true. */
  weightedGrading?: boolean;
  /** Hide overall % / letter until the instructor posts grades. */
  hideTotalsUntilPosted?: boolean;
  /** Show per-group percentages in the gradebook. Default true. */
  showGroupSubtotals?: boolean;
  /** Course-wide Monaco default for quiz coding fields (#31). Quizzes may override. */
  monacoCodeEditor?: boolean;
  /** Treat ungraded items as 0 in student current grade. */
  treatUngradedAsZero?: boolean;
};

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

export function createAssignmentGroupId() {
  return uid("ag");
}

/** Default one "Assignments" group at 100% when the course has none configured. */
export function getCourseAssignmentGroups(course?: Course | null): AssignmentGroup[] {
  if (course?.assignmentGroups && course.assignmentGroups.length > 0) {
    return normalizeAssignmentGroups(course.assignmentGroups);
  }
  return normalizeAssignmentGroups([]);
}

export function isWeightedGradingEnabled(course?: Course | null): boolean {
  return course?.weightedGrading !== false;
}

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
      ? { ...c, ...patch, updated_at: patch.updated_at ?? new Date().toISOString() }
      : c,
  );
  saveCourses(courses);
}

/** Toggle course published state. Returns the new value, or null if the course was not found. */
export function toggleCoursePublished(id: string): boolean | null {
  const course = getCourseById(id);
  if (!course) return null;
  const published = !course.published;
  updateCourse(id, { published });
  return published;
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
    gradingScheme: source.gradingScheme,
    assignmentGroups: source.assignmentGroups,
    weightedGrading: source.weightedGrading,
    hideTotalsUntilPosted: source.hideTotalsUntilPosted,
    showGroupSubtotals: source.showGroupSubtotals,
    monacoCodeEditor: source.monacoCodeEditor,
    treatUngradedAsZero: source.treatUngradedAsZero,
  });
}

export { duplicateCourseWithContent } from "./courseDuplicate";

/**
 * Remap assignment / quiz / discussion `groupId` values that point at deleted
 * groups. Invalid ids become unweighted (cleared).
 */
export function reassignItemsToValidGroups(
  courseId: string,
  validGroupIds: Set<string>,
) {
  const assignments = loadAssignments(courseId);
  let assignmentsChanged = false;
  const nextAssignments = assignments.map((a) => {
    if (a.groupId && !validGroupIds.has(a.groupId)) {
      assignmentsChanged = true;
      return { ...a, groupId: undefined };
    }
    return a;
  });
  if (assignmentsChanged) saveAssignments(courseId, nextAssignments);

  const quizzes = loadQuizzes(courseId);
  let quizzesChanged = false;
  const nextQuizzes = quizzes.map((q) => {
    if (q.groupId && !validGroupIds.has(q.groupId)) {
      quizzesChanged = true;
      return { ...q, groupId: undefined };
    }
    return q;
  });
  if (quizzesChanged) saveQuizzes(courseId, nextQuizzes);

  const topics = loadTopics(courseId);
  let topicsChanged = false;
  const nextTopics = topics.map((t) => {
    if (t.groupId && !validGroupIds.has(t.groupId)) {
      topicsChanged = true;
      return { ...t, groupId: undefined };
    }
    return t;
  });
  if (topicsChanged) saveTopics(courseId, nextTopics);
}
