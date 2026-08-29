import {
  getAppointmentSlot,
  rescheduleAppointmentSlot,
} from "./appointmentGroups";
import { notifyAppointmentRescheduled } from "./appointmentNotify";
import { getAssignmentById, loadAssignments, saveAssignments } from "./assignments";
import {
  getCustomCalendarEvent,
  rescheduleCustomEventOccurrence,
} from "./calendarCustomEvents";
import type { CalendarEvent } from "./calendarEvents";
import { loadTopics, saveTopics } from "./discussions";
import {
  loadDueDateOverrides,
  saveDueDateOverrides,
  type DueDateItemKind,
} from "./dueDateOverrides";
import { getQuizById, loadQuizzes, saveQuizzes } from "./quizzes";

export type DueDragPayload = {
  kind: "due";
  courseId: string;
  itemKind: DueDateItemKind;
  itemId: string;
  variantId: string;
  originalStartAt: number;
};

export type CustomDragPayload = {
  kind: "custom";
  eventId: string;
  occurrenceStartAt: number;
};

export type AppointmentDragPayload = {
  kind: "appointment";
  courseId: string;
  groupId: string;
  slotId: string;
  originalStartAt: number;
};

export type CalendarDragPayload = DueDragPayload | CustomDragPayload | AppointmentDragPayload;

export const CALENDAR_DRAG_MIME = "application/x-canvas-calendar";

export function writeCalendarDragData(dataTransfer: DataTransfer, payload: CalendarDragPayload) {
  const json = JSON.stringify(payload);
  dataTransfer.setData(CALENDAR_DRAG_MIME, json);
  dataTransfer.setData("text/plain", json);
  dataTransfer.effectAllowed = "move";
}

export function readCalendarDragData(dataTransfer: DataTransfer): string | undefined {
  return (
    dataTransfer.getData(CALENDAR_DRAG_MIME) ||
    dataTransfer.getData("text/plain") ||
    undefined
  );
}

export function parseCalendarDragPayload(raw: string): CalendarDragPayload | null {
  try {
    const v = JSON.parse(raw) as CalendarDragPayload;
    if (v?.kind === "custom" && typeof v.eventId === "string") return v;
    if (v?.kind === "due" && typeof v.itemId === "string") return v;
    if (
      v?.kind === "appointment" &&
      typeof v.courseId === "string" &&
      typeof v.groupId === "string" &&
      typeof v.slotId === "string" &&
      typeof v.originalStartAt === "number"
    ) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

export function calendarEventDragPayload(event: CalendarEvent): CalendarDragPayload | null {
  if (event.customEventId) {
    return {
      kind: "custom",
      eventId: event.customEventId,
      occurrenceStartAt: event.occurrenceStartAt ?? event.date.getTime(),
    };
  }
  if (event.appointmentGroupId && event.appointmentSlotId) {
    return {
      kind: "appointment",
      courseId: event.courseId,
      groupId: event.appointmentGroupId,
      slotId: event.appointmentSlotId,
      originalStartAt: event.date.getTime(),
    };
  }
  if (event.dueItemKind && event.dueItemId && event.dueVariantId) {
    return {
      kind: "due",
      courseId: event.courseId,
      itemKind: event.dueItemKind,
      itemId: event.dueItemId,
      variantId: event.dueVariantId,
      originalStartAt: event.date.getTime(),
    };
  }
  return null;
}

function writeItemDueAt(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
  dueAt: number,
): boolean {
  if (itemKind === "assignment") {
    const items = loadAssignments(courseId);
    if (!items.some((a) => a.id === itemId)) return false;
    saveAssignments(
      courseId,
      items.map((a) => (a.id === itemId ? { ...a, dueAt, updatedAt: Date.now() } : a)),
    );
    return true;
  }
  if (itemKind === "quiz") {
    const items = loadQuizzes(courseId);
    if (!items.some((q) => q.id === itemId)) return false;
    saveQuizzes(
      courseId,
      items.map((q) => (q.id === itemId ? { ...q, dueAt, updatedAt: Date.now() } : q)),
    );
    return true;
  }
  const topics = loadTopics(courseId);
  if (!topics.some((t) => t.id === itemId)) return false;
  saveTopics(
    courseId,
    topics.map((t) => (t.id === itemId ? { ...t, dueAt } : t)),
  );
  return true;
}

export function rescheduleDueDate(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
  variantId: string,
  newDueAt: number,
): boolean {
  if (variantId === "everyone" || !variantId) {
    return writeItemDueAt(courseId, itemKind, itemId, newDueAt);
  }
  const all = loadDueDateOverrides(courseId);
  const hit = all.find((o) => o.id === variantId && o.itemKind === itemKind && o.itemId === itemId);
  if (!hit) return false;
  saveDueDateOverrides(
    courseId,
    all.map((o) => (o.id === hit.id ? { ...o, dueAt: newDueAt } : o)),
  );
  return true;
}

export function dueItemStillExists(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
): boolean {
  if (itemKind === "assignment") return Boolean(getAssignmentById(courseId, itemId));
  if (itemKind === "quiz") return Boolean(getQuizById(courseId, itemId));
  return loadTopics(courseId).some((t) => t.id === itemId);
}

function stampTimeOfDay(dayAt: number, from: number) {
  const d = new Date(dayAt);
  const o = new Date(from);
  d.setHours(o.getHours(), o.getMinutes(), 0, 0);
  return d.getTime();
}

/** Apply a calendar drag. `keepTimeOfDay` is for month-view drops onto a day. */
export function applyCalendarDrop(
  raw: string,
  targetAt: number,
  opts?: { keepTimeOfDay?: boolean },
): boolean {
  const payload = parseCalendarDragPayload(raw);
  if (!payload) return false;
  if (payload.kind === "custom") {
    const event = getCustomCalendarEvent(payload.eventId);
    if (!event) return false;
    const duration =
      typeof event.endAt === "number" ? Math.max(0, event.endAt - event.startAt) : 30 * 60 * 1000;
    const startAt = opts?.keepTimeOfDay
      ? stampTimeOfDay(targetAt, payload.occurrenceStartAt)
      : targetAt;
    rescheduleCustomEventOccurrence(payload.eventId, payload.occurrenceStartAt, startAt, duration);
    return true;
  }
  if (payload.kind === "appointment") {
    const loaded = getAppointmentSlot(payload.courseId, payload.groupId, payload.slotId);
    if (!loaded) return false;
    const startAt = opts?.keepTimeOfDay
      ? stampTimeOfDay(targetAt, payload.originalStartAt)
      : targetAt;
    const previousStartAt = loaded.slot.startAt;
    const previousEndAt = loaded.slot.endAt;
    const next = rescheduleAppointmentSlot(
      payload.courseId,
      payload.groupId,
      payload.slotId,
      startAt,
    );
    if (!next) return false;
    const slot = next.slots.find((s) => s.id === payload.slotId);
    if (slot) notifyAppointmentRescheduled(next, slot, previousStartAt, previousEndAt);
    return true;
  }
  const startAt = opts?.keepTimeOfDay
    ? stampTimeOfDay(targetAt, payload.originalStartAt)
    : targetAt;
  return rescheduleDueDate(
    payload.courseId,
    payload.itemKind,
    payload.itemId,
    payload.variantId,
    startAt,
  );
}

