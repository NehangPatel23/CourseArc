import {
  formatAppointmentSlotRange,
  loadAppointmentGroupsForCourses,
} from "./appointmentGroups";
import { notifyAppointmentActivity } from "./appointmentNotify";
import { loadCourses } from "./coursesStore";
import { loadSettings } from "./settingsStore";
import { readStudentView } from "./studentView";
import { loadUser } from "./userStore";

export const APPOINTMENT_REMINDERS_KEY = "canvasClone:appointmentReminders";

export type AppointmentReminderKind = "24h" | "1h" | "waitlist24h" | "instructorDay";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function appointmentReminderKey(
  userId: string,
  slotId: string,
  kind: AppointmentReminderKind,
) {
  return `${userId}:${slotId}:${kind}`;
}

function loadSeen(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(APPOINTMENT_REMINDERS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function saveSeen(keys: string[]) {
  try {
    window.localStorage.setItem(APPOINTMENT_REMINDERS_KEY, JSON.stringify(keys));
  } catch {}
}

function dayStamp(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Client-side reminders for the current user. Dedupe keys live in localStorage. */
export function runAppointmentReminders(now = Date.now()): { sent: number } {
  if (loadSettings().notifyAppointments === false) return { sent: 0 };
  const user = loadUser();
  const seen = new Set(loadSeen());
  let sent = 0;

  const send = (
    slotId: string,
    kind: AppointmentReminderKind,
    input: { audience: "student" | "instructor"; title: string; body: string; courseId: string },
  ) => {
    const key = appointmentReminderKey(user.id, slotId, kind);
    if (seen.has(key)) return;
    notifyAppointmentActivity({
      ...input,
      href: "/calendar",
    });
    seen.add(key);
    sent += 1;
  };

  const courseIds =
    user.enrolledCourseIds.length > 0 ? user.enrolledCourseIds : loadCourses().map((c) => c.id);
  const groups = loadAppointmentGroupsForCourses(courseIds);

  for (const group of groups) {
    if (!group.published) continue;
    for (const slot of group.slots) {
      const until = slot.startAt - now;
      if (until <= 0) continue;
      const confirmed = slot.signups.some((s) => s.studentId === user.id);
      const waitlisted = (slot.waitlist ?? []).some((s) => s.studentId === user.id);
      const when = formatAppointmentSlotRange(slot.startAt, slot.endAt);
      if (confirmed && until <= HOUR) {
        send(slot.id, "1h", {
          audience: "student",
          title: `Appointment in 1 hour: ${group.title}`,
          body: `${group.title} starts soon (${when}).`,
          courseId: group.courseId,
        });
      }
      if (confirmed && until <= DAY) {
        send(slot.id, "24h", {
          audience: "student",
          title: `Appointment tomorrow: ${group.title}`,
          body: `You’re confirmed for ${group.title} (${when}).`,
          courseId: group.courseId,
        });
      }
      if (waitlisted && until <= DAY) {
        send(slot.id, "waitlist24h", {
          audience: "student",
          title: `Still waitlisted: ${group.title}`,
          body: `You’re still waitlisted for ${group.title} (${when}).`,
          courseId: group.courseId,
        });
      }
    }
  }

  if (!readStudentView()) {
    const dayStart = startOfLocalDay(now);
    const dayEnd = dayStart + DAY;
    let meetingCount = 0;
    let courseId = courseIds[0] ?? "";
    for (const group of groups) {
      const n = group.slots.filter((s) => s.startAt >= dayStart && s.startAt < dayEnd).length;
      if (n === 0) continue;
      meetingCount += n;
      courseId = group.courseId;
    }
    if (meetingCount > 0) {
      send(`day:${dayStamp(now)}`, "instructorDay", {
        audience: "instructor",
        title: `You have ${meetingCount} meeting${meetingCount === 1 ? "" : "s"} today`,
        body: `Appointment slots on your calendars today: ${meetingCount}.`,
        courseId,
      });
    }
  }

  saveSeen([...seen]);
  return { sent };
}
