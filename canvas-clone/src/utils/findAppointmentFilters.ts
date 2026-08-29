import {
  appointmentGroupCourseIds,
  slotHasCapacity,
  type AppointmentGroup,
  type AppointmentSlot,
} from "./appointmentGroups";
import { htmlPreview } from "./htmlPreview";

export type AvailabilityFilter = "all" | "open" | "mine";
export type TimeOfDayFilter = "any" | "morning" | "afternoon" | "evening";

export type FindAppointmentFilterState = {
  query: string;
  courseFilterId: string;
  availability: AvailabilityFilter;
  timeOfDay: TimeOfDayFilter;
  fromMs?: number;
  toMs?: number;
  /** `0` / omitted = any length. */
  durationMinutes?: number;
  /** When true, include slots whose end time is already past. Default hides them unless the student holds the slot. */
  includePast?: boolean;
  studentId: string;
  now?: number;
};

export type FindAppointmentMatch = {
  group: AppointmentGroup;
  slots: AppointmentSlot[];
};

export function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function addCalendarDays(ms: number, days: number) {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function timeOfDayBucket(ms: number): Exclude<TimeOfDayFilter, "any"> {
  const h = new Date(ms).getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function slotDurationMinutes(slot: AppointmentSlot) {
  return Math.round((slot.endAt - slot.startAt) / 60_000);
}

function studentHoldsSlot(slot: AppointmentSlot, studentId: string) {
  return (
    slot.signups.some((s) => s.studentId === studentId) ||
    (slot.waitlist ?? []).some((s) => s.studentId === studentId)
  );
}

export function slotMatchesFindFilters(
  slot: AppointmentSlot,
  filters: FindAppointmentFilterState,
): boolean {
  const now = filters.now ?? Date.now();
  const mine = studentHoldsSlot(slot, filters.studentId);
  if (slot.endAt < now && !mine && !filters.includePast) return false;

  const from = filters.fromMs != null ? startOfDay(filters.fromMs) : undefined;
  const to = filters.toMs != null ? endOfDay(filters.toMs) : undefined;
  if (from != null && slot.startAt < from) return false;
  if (to != null && slot.startAt > to) return false;
  if (filters.timeOfDay !== "any" && timeOfDayBucket(slot.startAt) !== filters.timeOfDay) {
    return false;
  }
  if (filters.durationMinutes && slotDurationMinutes(slot) !== filters.durationMinutes) {
    return false;
  }
  if (filters.availability === "mine") return mine;
  if (filters.availability === "open") return slotHasCapacity(slot) || mine;
  return true;
}

export function filterFindAppointmentGroups(
  groups: AppointmentGroup[],
  filters: FindAppointmentFilterState,
  courseName: (id: string) => string,
  focusGroupId?: string,
): FindAppointmentMatch[] {
  const q = filters.query.trim().toLowerCase();
  const rows: FindAppointmentMatch[] = [];

  for (const group of groups) {
    if (
      filters.courseFilterId !== "all" &&
      !appointmentGroupCourseIds(group).includes(filters.courseFilterId)
    ) {
      continue;
    }

    const haystack = [
      group.title,
      group.location ?? "",
      htmlPreview(group.description).text,
      ...appointmentGroupCourseIds(group).map(courseName),
    ]
      .join(" ")
      .toLowerCase();
    if (q && !haystack.includes(q)) continue;

    const slots = group.slots
      .filter((slot) => slotMatchesFindFilters(slot, filters))
      .sort((a, b) => a.startAt - b.startAt);
    if (slots.length === 0) continue;
    rows.push({ group, slots });
  }

  rows.sort((a, b) => (a.slots[0]?.startAt ?? 0) - (b.slots[0]?.startAt ?? 0));
  if (!focusGroupId) return rows;
  const hit = rows.find((r) => r.group.id === focusGroupId);
  const rest = rows.filter((r) => r.group.id !== focusGroupId);
  return hit ? [hit, ...rest] : rows;
}
