import { loadCourses, type Course } from "./coursesStore";
import { loadModulesFromStorage, type ModuleT, type ModuleRequirementsMode } from "./modules";
import { buildModuleLockedMap } from "./access";
import {
  getItemCompleted,
  getModuleCompletion,
  isItemUnlocked,
  loadProgress,
  type ProgressState,
} from "./progress";

const LAST_VISIT_KEY = "canvasClone:lastVisit";

export type LastVisit = {
  courseId: string;
  path: string;
  timestamp: number;
};

export type DashboardEvent = {
  courseId: string;
  /** 0 = Monday of current week, 6 = Sunday */
  dayOffset: number;
  label: string;
  type: "due" | "review" | "office";
};

export type ResolvedDashboardEvent = DashboardEvent & {
  date: Date;
  dayLabel: string;
  courseColor: string;
  courseShortName: string;
  displayLabel: string;
};

export type CourseSort = "updated" | "name" | "term";

export type { Course };

export function recordLastVisit(courseId: string, path: string) {
  try {
    const payload: LastVisit = {
      courseId,
      path,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(LAST_VISIT_KEY, JSON.stringify(payload));
  } catch {}
}

export function getLastVisit(): LastVisit | null {
  try {
    const raw = window.localStorage.getItem(LAST_VISIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastVisit;
    if (!parsed?.courseId || !parsed?.path) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function filterCoursesByQuery(courses: Course[], query: string): Course[] {
  const q = query.trim().toLowerCase();
  if (!q) return courses;
  return courses.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.short_name.toLowerCase().includes(q),
  );
}

export function sortCourses(courses: Course[], sort: CourseSort): Course[] {
  const copy = [...courses];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "term":
      return copy.sort((a, b) => a.term.localeCompare(b.term));
    case "updated":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function resolveWeekEvents(
  events: DashboardEvent[],
  now = new Date(),
): ResolvedDashboardEvent[] {
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  return events
    .map((event) => {
      const course = loadCourses().find((c) => c.id === event.courseId);
      const date = new Date(weekStart);
      date.setDate(date.getDate() + event.dayOffset);

      return {
        ...event,
        date,
        dayLabel: DAY_LABELS[event.dayOffset] ?? "",
        courseColor: course?.color ?? "canvas-blue",
        courseShortName: course?.short_name ?? "Course",
        displayLabel: course
          ? `${course.short_name} — ${event.label}`
          : event.label,
      };
    })
    .filter((event) => event.date >= weekStart && event.date <= weekEnd)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function countDueThisWeek(events: DashboardEvent[], now = new Date()) {
  return resolveWeekEvents(events, now).filter((e) => e.type === "due").length;
}

function computeProgressFromModules(
  modules: ModuleT[],
  progress: ProgressState,
): number {
  let completed = 0;
  let total = 0;

  for (const mod of modules) {
    const { completedCount, totalCount } = getModuleCompletion(mod, progress);
    completed += completedCount;
    total += totalCount;
  }

  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function getCourseProgressPercent(courseId: string): number {
  const modules = loadModulesFromStorage();
  const progress = loadProgress(courseId);
  return computeProgressFromModules(modules, progress);
}

export function getPrimaryCourseId(studentView: boolean): string | null {
  const courses = studentView
    ? loadCourses().filter((c) => c.published)
    : loadCourses();
  return courses[0]?.id ?? null;
}

export type UpNextItem = {
  moduleTitle: string;
  itemLabel: string;
  path: string;
};

export function getUpNextItem(courseId: string): UpNextItem | null {
  const modules = loadModulesFromStorage();
  const progress = loadProgress(courseId);
  const modLocked = buildModuleLockedMap(modules, progress);

  for (const m of modules) {
    if (modLocked.get(m.title)) continue;
    const mode = (m.requirementsMode ?? "none") as ModuleRequirementsMode;
    for (const item of m.items as { type?: string; label: string; pageId?: string; fileId?: string }[]) {
      if (!isItemUnlocked(m, mode, progress, item.label)) continue;
      if (getItemCompleted(progress, m.title, item.label)) continue;
      let path = `/courses/${courseId}/modules`;
      if (item.type === "page" && item.pageId) {
        path = `/courses/${courseId}/pages/${item.pageId}/view`;
      } else if (item.type === "file" && item.fileId) {
        path = `/courses/${courseId}/files/${item.fileId}`;
      }
      return { moduleTitle: m.title, itemLabel: item.label, path };
    }
  }
  return null;
}
