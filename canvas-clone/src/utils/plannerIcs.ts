import { getCalendarEvents } from "./calendarEvents";
import { escapeIcs, icsAllDay, icsDate, wrapIcsCalendar, downloadIcsFile } from "./icsFormat";

export function buildPlannerIcs(courseId: string | "all" = "all") {
  const events = getCalendarEvents(courseId, new Date());
  const stamp = icsDate(new Date());
  const vevents: string[] = [];
  for (const e of events) {
    const end = e.endDate ?? new Date(e.date.getTime() + 30 * 60 * 1000);
    const lines = ["BEGIN:VEVENT", `UID:${e.id}@coursearc.local`, `DTSTAMP:${stamp}`];
    if (e.allDay) {
      const next = new Date(e.date);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${icsAllDay(e.date)}`, `DTEND;VALUE=DATE:${icsAllDay(next)}`);
    } else {
      lines.push(`DTSTART:${icsDate(e.date)}`, `DTEND:${icsDate(end)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(e.title)}`, `DESCRIPTION:${escapeIcs(e.courseShortName)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
    lines.push("END:VEVENT");
    vevents.push(...lines);
  }
  return wrapIcsCalendar("-//CourseArc//Planner//EN", vevents);
}

export function downloadPlannerIcs(courseId: string | "all" = "all") {
  downloadIcsFile("planner.ics", buildPlannerIcs(courseId));
}
