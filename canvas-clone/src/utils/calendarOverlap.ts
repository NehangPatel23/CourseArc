import { getCalendarEvents, type CalendarEvent } from "./calendarEvents";
import { loadUser } from "./userStore";

export type CalendarOverlap = {
  title: string;
  startAt: number;
  endAt: number;
};

function rangeOf(event: CalendarEvent): { start: number; end: number } {
  const start = event.date.getTime();
  const end = event.endDate?.getTime() ?? start + 30 * 60 * 1000;
  return { start, end };
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function findOverlappingCalendarItems(
  startAt: number,
  endAt: number,
  opts?: { ignoreEventId?: string; ignoreAppointmentSlotId?: string; userId?: string },
): CalendarOverlap[] {
  const userId = opts?.userId ?? loadUser().id;
  void userId;
  const hits: CalendarOverlap[] = [];
  for (const event of getCalendarEvents("all", new Date(startAt))) {
    if (opts?.ignoreEventId && event.customEventId === opts.ignoreEventId) continue;
    if (opts?.ignoreAppointmentSlotId && event.appointmentSlotId === opts.ignoreAppointmentSlotId) {
      continue;
    }
    if (event.type !== "event" && event.type !== "appointment") continue;
    const { start, end } = rangeOf(event);
    if (rangesOverlap(startAt, endAt || startAt + 30 * 60 * 1000, start, end)) {
      hits.push({ title: event.title, startAt: start, endAt: end });
    }
  }
  return hits;
}
