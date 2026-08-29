import {
  effectiveAppointmentLocation,
  formatAppointmentSlotRange,
  type AppointmentGroup,
  type AppointmentSlot,
} from "./appointmentGroups";
import { copyIcsToClipboard, downloadIcsFile, escapeIcs, icsDate, wrapIcsCalendar } from "./icsFormat";
import { htmlPreview } from "./htmlPreview";

function slotVEvent(group: AppointmentGroup, slot: AppointmentSlot, stamp: Date) {
  const location = effectiveAppointmentLocation(group, slot);
  const description = [
    htmlPreview(group.description).text,
    htmlPreview(slot.notesHtml).text,
    formatAppointmentSlotRange(slot.startAt, slot.endAt),
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VEVENT",
    `UID:appointment:${group.id}:${slot.id}@coursearc.local`,
    `DTSTAMP:${icsDate(stamp)}`,
    `DTSTART:${icsDate(new Date(slot.startAt))}`,
    `DTEND:${icsDate(new Date(slot.endAt))}`,
    `SUMMARY:${escapeIcs(group.title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
  ];
  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  lines.push("END:VEVENT");
  return lines;
}

export function buildAppointmentSlotIcs(group: AppointmentGroup, slot: AppointmentSlot) {
  return wrapIcsCalendar("-//CourseArc//Appointments//EN", slotVEvent(group, slot, new Date()));
}

export function buildAppointmentGroupIcs(group: AppointmentGroup) {
  const stamp = new Date();
  return wrapIcsCalendar(
    "-//CourseArc//Appointments//EN",
    group.slots.flatMap((slot) => slotVEvent(group, slot, stamp)),
  );
}

function safeIcsName(title: string) {
  return title.replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "appointment";
}

export function downloadAppointmentSlotIcs(group: AppointmentGroup, slot: AppointmentSlot) {
  downloadIcsFile(`${safeIcsName(group.title)}.ics`, buildAppointmentSlotIcs(group, slot));
}

export function downloadAppointmentGroupIcs(group: AppointmentGroup) {
  downloadIcsFile(`${safeIcsName(group.title)}-group.ics`, buildAppointmentGroupIcs(group));
}

export async function copyAppointmentSlotIcs(group: AppointmentGroup, slot: AppointmentSlot) {
  await copyIcsToClipboard(buildAppointmentSlotIcs(group, slot));
}

export async function copyAppointmentGroupIcs(group: AppointmentGroup) {
  await copyIcsToClipboard(buildAppointmentGroupIcs(group));
}
