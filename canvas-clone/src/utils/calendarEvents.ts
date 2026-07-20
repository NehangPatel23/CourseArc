import { loadAnnouncements, isStudentVisibleAnnouncement } from "./announcements";
import { loadAssignments, isStudentViewableAssignment } from "./assignments";
import { loadVisibleCourseTodos } from "./courseTodos";
import { loadCourses } from "./coursesStore";
import { loadUser } from "./userStore";
import { loadQuizzes, isStudentViewableQuiz } from "./quizzes";

export type CalendarEventType = "assignment" | "quiz" | "announcement" | "todo";

export type CalendarEvent = {
  id: string;
  courseId: string;
  title: string;
  date: Date;
  type: CalendarEventType;
  path: string;
  color: string;
  courseShortName: string;
};

export const CALENDAR_TYPE_META: Record<
  CalendarEventType,
  { label: string; short: string; accent: string }
> = {
  assignment: { label: "Assignments", short: "Due", accent: "#008EE2" },
  quiz: { label: "Quizzes", short: "Quiz", accent: "#9B59B6" },
  announcement: { label: "Announcements", short: "Post", accent: "#27AE60" },
  todo: { label: "To-dos", short: "To-do", accent: "#F39C12" },
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatEventTime(event: CalendarEvent): string | null {
  const h = event.date.getHours();
  const m = event.date.getMinutes();
  if (h === 0 && m === 0) return null;
  return event.date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getCalendarEvents(
  courseId: string | "all" = "all",
  now = new Date(),
): CalendarEvent[] {
  const courses =
    courseId === "all"
      ? loadCourses().filter((c) => c.published && !c.archived)
      : loadCourses().filter((c) => c.id === courseId);

  const events: CalendarEvent[] = [];

  for (const course of courses) {
    for (const a of loadAssignments(course.id)) {
      if (!isStudentViewableAssignment(a, now.getTime())) continue;
      if (typeof a.dueAt !== "number") continue;
      events.push({
        id: `assignment:${a.id}`,
        courseId: course.id,
        title: a.title,
        date: new Date(a.dueAt),
        type: "assignment",
        path: `/courses/${course.id}/assignments/${a.id}`,
        color: course.color,
        courseShortName: course.short_name,
      });
    }

    for (const q of loadQuizzes(course.id)) {
      if (!isStudentViewableQuiz(q, now.getTime())) continue;
      if (typeof q.dueAt !== "number") continue;
      events.push({
        id: `quiz:${q.id}`,
        courseId: course.id,
        title: q.title,
        date: new Date(q.dueAt),
        type: "quiz",
        path: `/courses/${course.id}/quizzes/${q.id}`,
        color: course.color,
        courseShortName: course.short_name,
      });
    }

    for (const a of loadAnnouncements(course.id)) {
      if (!isStudentVisibleAnnouncement(a, now.getTime())) continue;
      const when = a.publishedAt ?? a.postedAt;
      if (typeof when !== "number") continue;
      events.push({
        id: `announcement:${a.id}`,
        courseId: course.id,
        title: a.title,
        date: new Date(when),
        type: "announcement",
        path: `/courses/${course.id}/announcements/${a.id}`,
        color: course.color,
        courseShortName: course.short_name,
      });
    }

    const userId = loadUser().id;
    for (const todo of loadVisibleCourseTodos(course.id, userId)) {
      if (typeof todo.dueAt !== "number") continue;
      if (todo.completed) continue;
      events.push({
        id: `todo:${todo.id}`,
        courseId: course.id,
        title: todo.title,
        date: new Date(todo.dueAt),
        type: "todo",
        path: `/courses/${course.id}`,
        color: course.color,
        courseShortName: course.short_name,
      });
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getCalendarEventsForMonth(
  month: Date,
  courseId: string | "all" = "all",
  now = new Date(),
): Map<number, CalendarEvent[]> {
  const map = new Map<number, CalendarEvent[]>();
  for (const e of getCalendarEvents(courseId, now)) {
    if (e.date.getMonth() !== month.getMonth() || e.date.getFullYear() !== month.getFullYear()) {
      continue;
    }
    const day = e.date.getDate();
    const list = map.get(day) ?? [];
    list.push(e);
    map.set(day, list);
  }
  return map;
}

/** Upcoming events from today forward (inclusive), limited. */
export function getUpcomingCalendarEvents(
  limit = 12,
  courseId: string | "all" = "all",
  now = new Date(),
): CalendarEvent[] {
  const start = startOfDay(now).getTime();
  return getCalendarEvents(courseId, now)
    .filter((e) => e.date.getTime() >= start)
    .slice(0, limit);
}

export function isCalendarEventOverdue(event: CalendarEvent, now = new Date()) {
  if (event.type === "announcement") return false;
  const end = startOfDay(event.date);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < now.getTime();
}
