import {
  getCalendarEvents,
  isCalendarEventOverdue,
  type CalendarEvent,
} from "./calendarEvents";
import { loadCourses, type Course } from "./coursesStore";
import type { ResolvedDashboardEvent } from "./dashboard";

export type DeadlineItem = ResolvedDashboardEvent & {
  overdue: boolean;
  course?: Course;
  path?: string;
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

function toDeadlineItem(event: CalendarEvent, now: Date, weekStart: Date): DeadlineItem {
  const courses = loadCourses();
  const course = courses.find((c) => c.id === event.courseId);
  const dayOffset = Math.round(
    (startOfDay(event.date).getTime() - weekStart.getTime()) / 86400000,
  );
  const dayLabel = event.date.toLocaleDateString("en-US", { weekday: "short" });
  const type: DeadlineItem["type"] =
    event.type === "announcement" ? "review" : "due";

  return {
    courseId: event.courseId,
    dayOffset,
    label: event.title,
    type,
    date: event.date,
    dayLabel,
    courseColor: event.color,
    courseShortName: event.courseShortName,
    displayLabel: `${event.courseShortName} — ${event.title}`,
    overdue: isCalendarEventOverdue(event, now),
    course,
    path: event.path,
  };
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getUpcomingDeadlines(range: "week" | "all" = "all", now = new Date()) {
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(weekStart);
  const all = getCalendarEvents("all", now)
    .filter((e) => e.type === "assignment" || e.type === "quiz" || e.type === "todo")
    .map((e) => toDeadlineItem(e, now, weekStart))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (range === "week") {
    return all.filter((e) => e.date >= weekStart && e.date <= weekEnd);
  }
  return all;
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
