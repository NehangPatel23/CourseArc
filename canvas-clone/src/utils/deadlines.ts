import { mockDashboardEvents } from "../data/mockData";
import { loadCourses, type Course } from "./coursesStore";
import type { ResolvedDashboardEvent } from "./dashboard";
import { resolveWeekEvents } from "./dashboard";

export type DeadlineItem = ResolvedDashboardEvent & {
  overdue: boolean;
  course?: Course;
};

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

export function isOverdue(date: Date, now = new Date()) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < now.getTime();
}

function resolveAllEvents(now = new Date()): DeadlineItem[] {
  const weekStart = startOfWeek(now);
  const courses = loadCourses();

  return mockDashboardEvents.map((event) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + event.dayOffset);
    const course = courses.find((c) => c.id === event.courseId);
    const resolved = resolveWeekEvents([event], now)[0];
    if (!resolved) {
      return {
        ...event,
        date,
        dayLabel: "",
        courseColor: course?.color ?? "canvas-blue",
        courseShortName: course?.short_name ?? "Course",
        displayLabel: event.label,
        overdue: isOverdue(date, now),
        course,
      } as DeadlineItem;
    }
    return {
      ...resolved,
      overdue: isOverdue(resolved.date, now),
      course,
    };
  });
}

export function getUpcomingDeadlines(range: "week" | "all" = "all", now = new Date()) {
  const all = resolveAllEvents(now);
  if (range === "week") {
    const weekEvents = resolveWeekEvents(mockDashboardEvents, now);
    const weekKeys = new Set(weekEvents.map((e) => `${e.courseId}-${e.label}`));
    return all.filter((e) => weekKeys.has(`${e.courseId}-${e.label}`));
  }
  return all.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getOverdueItems(now = new Date()) {
  return getUpcomingDeadlines("all", now).filter((e) => e.overdue && e.type === "due");
}

export function getNextDueForCourse(courseId: string, now = new Date()): DeadlineItem | null {
  const upcoming = getUpcomingDeadlines("all", now)
    .filter((e) => e.courseId === courseId && !e.overdue)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return upcoming[0] ?? null;
}
