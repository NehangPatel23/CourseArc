import { loadAnnouncements, isStudentVisibleAnnouncement } from "./announcements";
import {
  appointmentGroupCourseIds,
  appointmentSlotCalendarState,
  effectiveAppointmentLocation,
  ensureDemoAppointmentGroup,
  loadAppointmentGroupsForCourses,
  studentCanSeeAppointmentGroup,
} from "./appointmentGroups";
import { getAssignmentById, loadAssignments, isStudentViewableAssignment } from "./assignments";
import { getStudentSubmission } from "./assignmentSubmissions";
import {
  ensureDemoCustomEvents,
  expandCustomEventOccurrences,
  listCustomCalendarEvents,
  PERSONAL_CALENDAR_ID,
} from "./calendarCustomEvents";
import { loadVisibleCourseTodos } from "./courseTodos";
import { loadCourses } from "./coursesStore";
import { isItemGradeVisible } from "./gradeVisibility";
import {
  getEffectiveDueAt,
  listCalendarDueVariants,
} from "./dueDateOverrides";
import {
  getScoringPolicyAttempt,
  getStudentFinalScore,
} from "./quizSubmissions";
import {
  getQuizById,
  loadQuizzes,
  isStudentViewableQuiz,
  quizShowsScoreToStudent,
} from "./quizzes";
import { isStudentVisibleTopic, loadTopics } from "./discussions";
import { readStudentView } from "./studentView";
import { loadUser } from "./userStore";

export type CalendarFilterId = string | "all" | typeof PERSONAL_CALENDAR_ID;

export type CalendarEventType =
  | "assignment"
  | "quiz"
  | "discussion"
  | "announcement"
  | "todo"
  | "event"
  | "appointment";

export type CalendarEvent = {
  id: string;
  courseId: string;
  title: string;
  date: Date;
  type: CalendarEventType;
  path: string;
  color: string;
  courseShortName: string;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  description?: string;
  customEventId?: string;
  occurrenceStartAt?: number;
  appointmentGroupId?: string;
  appointmentSlotId?: string;
  /** True when this slot has a confirmed signup or waitlist (solid chip). */
  appointmentBooked?: boolean;
  /** Current user holds a confirmed seat or waitlist spot. */
  appointmentMine?: boolean;
  appointmentWaitlisted?: boolean;
  appointmentSeats?: { taken: number; max: number; waitlisted?: number };
  dueItemKind?: "assignment" | "quiz" | "discussion";
  dueItemId?: string;
  dueVariantId?: string;
};

export const CALENDAR_TYPE_META: Record<
  CalendarEventType,
  { label: string; short: string; accent: string }
> = {
  assignment: { label: "Assignments", short: "Due", accent: "#008EE2" },
  quiz: { label: "Quizzes", short: "Quiz", accent: "#9B59B6" },
  discussion: { label: "Discussions", short: "Disc", accent: "#D35400" },
  announcement: { label: "Announcements", short: "Post", accent: "#27AE60" },
  todo: { label: "To-dos", short: "To-do", accent: "#F39C12" },
  event: { label: "Events", short: "Event", accent: "#0E7C7B" },
  appointment: { label: "Appointments", short: "Appt", accent: "#C0392B" },
};

const PERSONAL_COLOR = "#6B7280";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatEventTime(event: CalendarEvent): string | null {
  if (event.allDay) return "All day";
  const h = event.date.getHours();
  const m = event.date.getMinutes();
  if (h === 0 && m === 0) return null;
  const start = event.date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (event.endDate && event.endDate.getTime() !== event.date.getTime()) {
    const end = event.endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${start}–${end}`;
  }
  return start;
}

export function appointmentOccupancyChipText(seats?: {
  taken: number;
  max: number;
  waitlisted?: number;
}) {
  if (!seats) return "";
  const wait = seats.waitlisted ? ` · w${seats.waitlisted}` : "";
  return `${seats.taken}/${seats.max}${wait}`;
}

export function appointmentChipLabel(event: CalendarEvent) {
  if (event.type !== "appointment") return event.title;
  const occ = appointmentOccupancyChipText(event.appointmentSeats);
  return occ ? `${event.title} ${occ}` : event.title;
}

export function isUnbookedAppointment(event: CalendarEvent) {
  return event.type === "appointment" && event.appointmentBooked === false;
}

export function calendarEventTypeColor(event: Pick<CalendarEvent, "type">) {
  return CALENDAR_TYPE_META[event.type].accent;
}

/** Type-colored pills (matching the Show filters); course color is the leading pip. */
export function calendarEventChipAppearance(event: CalendarEvent) {
  const typeColor = calendarEventTypeColor(event);
  const courseColor = event.color;
  const unbooked = isUnbookedAppointment(event);
  if (unbooked) {
    return {
      unbooked: true as const,
      typeColor,
      courseColor,
      className:
        "rounded-md border-2 border-dashed font-medium opacity-[0.72] hover:opacity-95",
      style: {
        borderColor: typeColor,
        color: typeColor,
        backgroundColor: `${typeColor}1a`,
      },
    };
  }
  return {
    unbooked: false as const,
    typeColor,
    courseColor,
    className: "rounded-full text-white hover:brightness-110",
    style: { backgroundColor: typeColor },
  };
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getCalendarEvents(
  courseId: CalendarFilterId = "all",
  now = new Date(),
): CalendarEvent[] {
  const user = loadUser();
  const studentView = readStudentView();
  const courses =
    courseId === PERSONAL_CALENDAR_ID
      ? []
      : courseId === "all"
        ? loadCourses().filter((c) => c.published && !c.archived)
        : loadCourses().filter((c) => c.id === courseId);

  const events: CalendarEvent[] = [];

  for (const course of courses) {
    ensureDemoCustomEvents(course.id);
    ensureDemoAppointmentGroup(course.id);

    for (const a of loadAssignments(course.id)) {
      if (!isStudentViewableAssignment(a, now.getTime())) continue;
      if (studentView) {
        const dueAt = getEffectiveDueAt(course.id, "assignment", a.id, a.dueAt, user.id);
        if (typeof dueAt !== "number") continue;
        events.push({
          id: `assignment:${a.id}`,
          courseId: course.id,
          title: a.title,
          date: new Date(dueAt),
          type: "assignment",
          path: `/courses/${course.id}/assignments/${a.id}`,
          color: course.color,
          courseShortName: course.short_name,
        });
        continue;
      }
      const variants = listCalendarDueVariants(course.id, "assignment", a.id, a.dueAt);
      for (const v of variants) {
        events.push({
          id: `assignment:${a.id}:${v.variantId}`,
          courseId: course.id,
          title: v.label ? `${a.title} (${v.label})` : a.title,
          date: new Date(v.dueAt),
          type: "assignment",
          path: `/courses/${course.id}/assignments/${a.id}`,
          color: course.color,
          courseShortName: course.short_name,
          dueItemKind: "assignment",
          dueItemId: a.id,
          dueVariantId: v.variantId,
        });
      }
    }

    for (const q of loadQuizzes(course.id)) {
      if (!isStudentViewableQuiz(q, now.getTime())) continue;
      if (studentView) {
        const dueAt = getEffectiveDueAt(course.id, "quiz", q.id, q.dueAt, user.id);
        if (typeof dueAt === "number") {
          events.push({
            id: `quiz:${q.id}`,
            courseId: course.id,
            title: q.title,
            date: new Date(dueAt),
            type: "quiz",
            path: `/courses/${course.id}/quizzes/${q.id}`,
            color: course.color,
            courseShortName: course.short_name,
          });
        }
      } else {
        const variants = listCalendarDueVariants(course.id, "quiz", q.id, q.dueAt);
        for (const v of variants) {
          events.push({
            id: `quiz:${q.id}:${v.variantId}`,
            courseId: course.id,
            title: v.label ? `${q.title} (${v.label})` : q.title,
            date: new Date(v.dueAt),
            type: "quiz",
            path: `/courses/${course.id}/quizzes/${q.id}`,
            color: course.color,
            courseShortName: course.short_name,
            dueItemKind: "quiz",
            dueItemId: q.id,
            dueVariantId: v.variantId,
          });
        }
      }
      if (typeof q.availableFrom === "number") {
        events.push({
          id: `quiz-open:${q.id}`,
          courseId: course.id,
          title: `${q.title} opens`,
          date: new Date(q.availableFrom),
          type: "quiz",
          path: `/courses/${course.id}/quizzes/${q.id}`,
          color: course.color,
          courseShortName: course.short_name,
        });
      }
      if (typeof q.availableUntil === "number") {
        events.push({
          id: `quiz-close:${q.id}`,
          courseId: course.id,
          title: `${q.title} closes`,
          date: new Date(q.availableUntil),
          type: "quiz",
          path: `/courses/${course.id}/quizzes/${q.id}`,
          color: course.color,
          courseShortName: course.short_name,
        });
      }
    }

    for (const t of loadTopics(course.id)) {
      if (!t.graded || typeof t.dueAt !== "number") continue;
      if (studentView && !isStudentVisibleTopic(t, now.getTime())) continue;
      if (!studentView && !(t.published || t.status === "published")) continue;
      if (studentView) {
        const dueAt = getEffectiveDueAt(course.id, "discussion", t.id, t.dueAt, user.id);
        if (typeof dueAt !== "number") continue;
        events.push({
          id: `discussion:${t.id}`,
          courseId: course.id,
          title: t.title,
          date: new Date(dueAt),
          type: "discussion",
          path: `/courses/${course.id}/discussions/${t.id}`,
          color: course.color,
          courseShortName: course.short_name,
        });
        continue;
      }
      const variants = listCalendarDueVariants(course.id, "discussion", t.id, t.dueAt);
      for (const v of variants) {
        events.push({
          id: `discussion:${t.id}:${v.variantId}`,
          courseId: course.id,
          title: v.label ? `${t.title} (${v.label})` : t.title,
          date: new Date(v.dueAt),
          type: "discussion",
          path: `/courses/${course.id}/discussions/${t.id}`,
          color: course.color,
          courseShortName: course.short_name,
          dueItemKind: "discussion",
          dueItemId: t.id,
          dueVariantId: v.variantId,
        });
      }
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

    for (const todo of loadVisibleCourseTodos(course.id, user.id)) {
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

  const visibleCourseIds = courses.map((c) => c.id);
  if (visibleCourseIds.length) {
    for (const group of loadAppointmentGroupsForCourses(visibleCourseIds)) {
      if (studentView && !group.published) continue;
      const linked = appointmentGroupCourseIds(group);
      const colorCourse =
        courses.find((c) => c.id === (courseId !== "all" && courseId !== PERSONAL_CALENDAR_ID ? courseId : group.courseId)) ??
        courses.find((c) => linked.includes(c.id)) ??
        loadCourses().find((c) => c.id === group.courseId);
      for (const slot of group.slots) {
        const state = appointmentSlotCalendarState(slot, {
          studentView,
          studentId: user.id,
        });
        const isOpen = group.published && !state.full;
        if (studentView && !state.mine && !isOpen) continue;
        if (studentView && !state.mine && !studentCanSeeAppointmentGroup(group, user.id)) continue;
        events.push({
          id: `appointment:${group.id}:${slot.id}`,
          courseId: group.courseId,
          title: `${group.title}${state.titleSuffix}`,
          date: new Date(slot.startAt),
          endDate: new Date(slot.endAt),
          type: "appointment",
          path: `/calendar?appointment=${encodeURIComponent(group.id)}&course=${encodeURIComponent(group.courseId)}&slot=${encodeURIComponent(slot.id)}`,
          color: colorCourse?.color ?? PERSONAL_COLOR,
          courseShortName: colorCourse?.short_name ?? "Course",
          location: effectiveAppointmentLocation(group, slot),
          description: group.description,
          appointmentGroupId: group.id,
          appointmentSlotId: slot.id,
          appointmentBooked: state.appointmentBooked,
          appointmentMine: state.mine,
          appointmentWaitlisted:
            studentView && (slot.waitlist ?? []).some((s) => s.studentId === user.id),
          appointmentSeats: {
            taken: state.taken,
            max: state.max,
            waitlisted: state.waitlisted,
          },
        });
      }
    }
  }

  const custom = listCustomCalendarEvents({
    userId: user.id,
    courseId,
  });
  for (const e of custom) {
    const course = e.courseId ? loadCourses().find((c) => c.id === e.courseId) : undefined;
    const occurrences = expandCustomEventOccurrences(e);
    occurrences.forEach((occ, i) => {
      events.push({
        id: i === 0 ? `event:${e.id}` : `event:${e.id}:${occ.startAt}`,
        courseId: e.courseId ?? PERSONAL_CALENDAR_ID,
        title: e.title,
        date: new Date(occ.startAt),
        endDate: typeof occ.endAt === "number" ? new Date(occ.endAt) : undefined,
        allDay: e.allDay,
        type: "event",
        path: `/calendar?event=${encodeURIComponent(e.id)}`,
        color: course?.color ?? PERSONAL_COLOR,
        courseShortName: course?.short_name ?? "Personal",
        location: e.location,
        description: e.description,
        customEventId: e.id,
        occurrenceStartAt: occ.startAt,
      });
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getCalendarEventsForMonth(
  month: Date,
  courseId: CalendarFilterId = "all",
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
  courseId: CalendarFilterId = "all",
  now = new Date(),
): CalendarEvent[] {
  const start = startOfDay(now).getTime();
  return getCalendarEvents(courseId, now)
    .filter((e) => e.date.getTime() >= start)
    .slice(0, limit);
}

/** Booked meeting still in the future — for Planner / dashboard, not open sign-up chips. */
export function isBookedUpcomingAppointment(event: CalendarEvent, now = new Date()) {
  if (event.type !== "appointment") return false;
  const end = event.endDate ?? event.date;
  if (end.getTime() < now.getTime()) return false;
  if (readStudentView()) return Boolean(event.appointmentMine);
  return Boolean(event.appointmentBooked);
}

export function isCalendarEventOverdue(event: CalendarEvent, now = new Date()) {
  if (event.type === "announcement" || event.type === "event" || event.type === "appointment") {
    return false;
  }
  const end = startOfDay(event.date);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < now.getTime();
}

export type CalendarEventStudentBadge =
  | { kind: "overdue" }
  | { kind: "score"; label: string }
  | { kind: "submitted" };

/**
 * Calendar badge for a student: Overdue only when past due and not submitted;
 * otherwise show the score (or Submitted when a score isn't visible yet).
 */
export function getCalendarEventStudentBadge(
  event: CalendarEvent,
  studentId = loadUser().id,
  now = new Date(),
  opts?: { hideUnpostedScores?: boolean },
): CalendarEventStudentBadge | null {
  if (event.type === "announcement" || event.type === "event" || event.type === "appointment") {
    return null;
  }

  const pastDue = isCalendarEventOverdue(event, now);
  const hideScores = opts?.hideUnpostedScores ?? false;

  if (event.type === "todo" || event.type === "discussion") {
    return pastDue ? { kind: "overdue" } : null;
  }

  if (event.type === "assignment") {
    const assignmentId = event.id.replace(/^assignment:/, "").replace(/:.*$/, "");
    const sub = getStudentSubmission(event.courseId, assignmentId, studentId);
    if (!sub) return pastDue ? { kind: "overdue" } : null;

    const assignment = getAssignmentById(event.courseId, assignmentId);
    const scoreVisible =
      !hideScores || isItemGradeVisible(event.courseId, `assignment:${assignmentId}`, studentId);
    if (
      scoreVisible &&
      sub.status === "graded" &&
      typeof sub.score === "number" &&
      typeof assignment?.points === "number"
    ) {
      return { kind: "score", label: `${sub.score}/${assignment.points}` };
    }
    return { kind: "submitted" };
  }

  if (event.type === "quiz") {
    const quizId = event.id.replace(/^(?:quiz-open|quiz-close|quiz):/, "").replace(/:.*$/, "");
    const quiz = getQuizById(event.courseId, quizId);
    if (!quiz) return pastDue ? { kind: "overdue" } : null;

    const final = getStudentFinalScore(event.courseId, quiz, studentId);
    if (!final) return pastDue ? { kind: "overdue" } : null;

    const policyAttempt = getScoringPolicyAttempt(event.courseId, quiz, studentId);
    const scoreVisible =
      !hideScores ||
      quizShowsScoreToStudent(quiz, {
        courseId: event.courseId,
        studentId,
        attempt: policyAttempt ?? null,
      });
    if (scoreVisible) {
      const score = Math.round(final.score * 10) / 10;
      return { kind: "score", label: `${score}/${final.maxScore}` };
    }
    return { kind: "submitted" };
  }

  return null;
}
