import { sendInboxMessage } from "./inbox";
import { notifyAppointmentEvent } from "./notifications";
import { loadSettings } from "./settingsStore";
import {
  formatAppointmentSlotRange,
  type AppointmentGroup,
  type AppointmentSlot,
} from "./appointmentGroups";

export function notifyAppointmentActivity(input: {
  audience: "student" | "instructor" | "all";
  title: string;
  body: string;
  courseId: string;
  href?: string;
}) {
  const href = input.href ?? "/calendar";
  notifyAppointmentEvent({
    audience: input.audience,
    title: input.title,
    body: input.body,
    courseId: input.courseId,
    href,
  });
  if (loadSettings().notifyAppointments === false) return;
  sendInboxMessage({
    from: "CourseArc System",
    fromUserId: "system",
    subject: input.title,
    body: input.body,
    courseId: input.courseId,
    href,
    kind: "appointment",
    audience: input.audience,
  });
}

export function appointmentSlotHref(group: AppointmentGroup, slotId: string) {
  return `/calendar?appointment=${encodeURIComponent(group.id)}&course=${encodeURIComponent(group.courseId)}&slot=${encodeURIComponent(slotId)}`;
}

export function notifyAppointmentRescheduled(
  group: AppointmentGroup,
  slot: Pick<AppointmentSlot, "id" | "startAt" | "endAt" | "signups" | "waitlist">,
  previousStartAt: number,
  previousEndAt: number,
) {
  const people = slot.signups.length + (slot.waitlist?.length ?? 0);
  if (!people) return;
  notifyAppointmentActivity({
    audience: "student",
    title: `Appointment rescheduled: ${group.title}`,
    body: `${group.title} moved from ${formatAppointmentSlotRange(previousStartAt, previousEndAt)} to ${formatAppointmentSlotRange(slot.startAt, slot.endAt)}.`,
    courseId: group.courseId,
    href: appointmentSlotHref(group, slot.id),
  });
}
