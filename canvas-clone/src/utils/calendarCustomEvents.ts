import { loadUser } from "./userStore";

export const PERSONAL_CALENDAR_ID = "personal";
export const CUSTOM_CALENDAR_EVENTS_CHANGED_EVENT =
  "canvasClone:customCalendarEventsChanged";

export type EventRecurrence = {
  freq: "daily" | "weekly" | "monthly";
  until: number;
  interval?: number;
};

export type RecurrenceEditScope = "this" | "following" | "all";

export type CustomCalendarEvent = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startAt: number;
  endAt?: number;
  allDay?: boolean;
  recurrence?: EventRecurrence;
  /** Original occurrence start times to skip (this-event deletes / detaches). */
  exceptionDates?: number[];
  /** null = personal calendar (visible only to createdBy). */
  courseId: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type CustomEventPatch = {
  title: string;
  description?: string;
  location?: string;
  startAt: number;
  endAt?: number;
  allDay?: boolean;
  recurrence?: EventRecurrence;
  courseId: string | null;
};

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

const KEY = "canvasClone:customCalendarEvents";

function addCalendarMonths(ts: number, months: number): number {
  const d = new Date(ts);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.getTime();
}

function nextOccurrenceStart(prev: number, rec: EventRecurrence): number {
  const step = Math.max(1, rec.interval ?? 1);
  if (rec.freq === "monthly") return addCalendarMonths(prev, step);
  const dayMs = 24 * 60 * 60 * 1000;
  const delta = rec.freq === "weekly" ? 7 * dayMs * step : dayMs * step;
  return prev + delta;
}

function exceptionSet(event: CustomCalendarEvent): Set<number> {
  return new Set(event.exceptionDates ?? []);
}

export function normalizeRecurrence(raw: unknown): EventRecurrence | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<EventRecurrence>;
  if (r.freq !== "daily" && r.freq !== "weekly" && r.freq !== "monthly") return undefined;
  if (typeof r.until !== "number") return undefined;
  return {
    freq: r.freq,
    until: r.until,
    interval: typeof r.interval === "number" && r.interval >= 1 ? r.interval : undefined,
  };
}

export function expandCustomEventOccurrences(
  event: CustomCalendarEvent,
  cap = 52,
): { startAt: number; endAt?: number }[] {
  const duration =
    typeof event.endAt === "number" ? event.endAt - event.startAt : 0;
  const skip = exceptionSet(event);
  const out: { startAt: number; endAt?: number }[] = [];
  const push = (startAt: number) => {
    if (skip.has(startAt)) return;
    out.push({
      startAt,
      endAt: duration > 0 ? startAt + duration : event.endAt,
    });
  };
  push(event.startAt);
  const rec = event.recurrence;
  if (!rec) return out;
  let t = nextOccurrenceStart(event.startAt, rec);
  while (t <= rec.until && out.length < cap) {
    push(t);
    t = nextOccurrenceStart(t, rec);
  }
  return out;
}

function normalizeExceptionDates(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const dates = raw.filter((n): n is number => typeof n === "number");
  return dates.length ? dates : undefined;
}

function normalize(raw: unknown): CustomCalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Partial<CustomCalendarEvent>;
  if (typeof e.id !== "string" || typeof e.title !== "string") return null;
  if (typeof e.startAt !== "number") return null;
  return {
    id: e.id,
    title: e.title,
    description: typeof e.description === "string" ? e.description : undefined,
    location: typeof e.location === "string" ? e.location : undefined,
    startAt: e.startAt,
    endAt: typeof e.endAt === "number" ? e.endAt : undefined,
    allDay: Boolean(e.allDay),
    recurrence: normalizeRecurrence((e as { recurrence?: unknown }).recurrence),
    exceptionDates: normalizeExceptionDates((e as { exceptionDates?: unknown }).exceptionDates),
    courseId: typeof e.courseId === "string" && e.courseId ? e.courseId : null,
    createdBy: typeof e.createdBy === "string" ? e.createdBy : "",
    createdAt: typeof e.createdAt === "number" ? e.createdAt : e.startAt,
    updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : e.startAt,
  };
}

function loadAll(): CustomCalendarEvent[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize).filter((e): e is CustomCalendarEvent => Boolean(e));
  } catch {
    return [];
  }
}

function persist(items: CustomCalendarEvent[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CUSTOM_CALENDAR_EVENTS_CHANGED_EVENT));
  } catch {}
}

export function listCustomCalendarEvents(opts?: {
  userId?: string;
  courseId?: string | "all" | typeof PERSONAL_CALENDAR_ID;
}): CustomCalendarEvent[] {
  const userId = opts?.userId ?? loadUser().id;
  const courseId = opts?.courseId ?? "all";
  return loadAll().filter((e) => {
    if (e.courseId == null) {
      if (e.createdBy !== userId) return false;
      return courseId === "all" || courseId === PERSONAL_CALENDAR_ID;
    }
    if (courseId === PERSONAL_CALENDAR_ID) return false;
    if (courseId === "all") return true;
    return e.courseId === courseId;
  });
}

export function getCustomCalendarEvent(id: string): CustomCalendarEvent | undefined {
  return loadAll().find((e) => e.id === id);
}

export function canEditCustomCalendarEvent(
  event: CustomCalendarEvent,
  userId = loadUser().id,
  isInstructor = false,
): boolean {
  if (event.courseId == null) return event.createdBy === userId;
  return isInstructor;
}

export function eventHasRemainingOccurrences(event: CustomCalendarEvent): boolean {
  return expandCustomEventOccurrences(event).length > 0;
}

export function upsertCustomCalendarEvent(
  input: Omit<CustomCalendarEvent, "id" | "createdAt" | "updatedAt" | "createdBy"> & {
    id?: string;
    createdBy?: string;
  },
): CustomCalendarEvent {
  const now = Date.now();
  const all = loadAll();
  const existing = input.id ? all.find((e) => e.id === input.id) : undefined;
  const event: CustomCalendarEvent = {
    id: existing?.id ?? uid("cal"),
    title: input.title.trim() || "Untitled event",
    description: input.description?.trim() || undefined,
    location: input.location?.trim() || undefined,
    startAt: input.startAt,
    endAt: input.endAt,
    allDay: input.allDay,
    recurrence: input.recurrence,
    exceptionDates:
      input.exceptionDates !== undefined
        ? input.exceptionDates?.length
          ? input.exceptionDates
          : undefined
        : existing?.exceptionDates,
    courseId: input.courseId,
    createdBy: existing?.createdBy ?? input.createdBy ?? loadUser().id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = existing
    ? all.map((e) => (e.id === event.id ? event : e))
    : [event, ...all];
  persist(next);
  return event;
}

export function deleteCustomCalendarEvent(id: string) {
  persist(loadAll().filter((e) => e.id !== id));
}

function withException(event: CustomCalendarEvent, originalStartAt: number): CustomCalendarEvent {
  const exceptionDates = [...new Set([...(event.exceptionDates ?? []), originalStartAt])];
  return { ...event, exceptionDates };
}

function shiftBy(event: CustomCalendarEvent, delta: number): CustomCalendarEvent {
  return {
    ...event,
    startAt: event.startAt + delta,
    endAt: typeof event.endAt === "number" ? event.endAt + delta : undefined,
    recurrence: event.recurrence
      ? { ...event.recurrence, until: event.recurrence.until + delta }
      : undefined,
    exceptionDates: event.exceptionDates?.map((t) => t + delta),
  };
}

export function applyCustomEventSave(
  event: CustomCalendarEvent,
  occurrenceStartAt: number | undefined,
  scope: RecurrenceEditScope,
  patch: CustomEventPatch,
): void {
  const originalStartAt = occurrenceStartAt ?? event.startAt;
  const isSeries = Boolean(event.recurrence);
  const effectiveScope = isSeries ? scope : "all";

  if (effectiveScope === "this" && isSeries) {
    upsertCustomCalendarEvent({
      ...withException(event, originalStartAt),
    });
    upsertCustomCalendarEvent({
      title: patch.title,
      description: patch.description,
      location: patch.location,
      startAt: patch.startAt,
      endAt: patch.endAt,
      allDay: patch.allDay,
      courseId: patch.courseId,
      recurrence: undefined,
      exceptionDates: [],
      createdBy: event.createdBy,
    });
    return;
  }

  if (effectiveScope === "following" && isSeries && originalStartAt !== event.startAt) {
    upsertCustomCalendarEvent({
      ...event,
      recurrence: event.recurrence
        ? { ...event.recurrence, until: originalStartAt - 1 }
        : undefined,
    });
    upsertCustomCalendarEvent({
      ...patch,
      exceptionDates: (event.exceptionDates ?? []).filter((t) => t >= originalStartAt),
      createdBy: event.createdBy,
    });
    return;
  }

  const delta = patch.startAt - originalStartAt;
  const shifted = delta ? shiftBy(event, delta) : event;
  upsertCustomCalendarEvent({
    id: event.id,
    title: patch.title,
    description: patch.description,
    location: patch.location,
    allDay: patch.allDay,
    courseId: patch.courseId,
    startAt: shifted.startAt,
    endAt: shifted.endAt,
    recurrence: patch.recurrence
      ? { ...patch.recurrence, until: shifted.recurrence?.until ?? patch.recurrence.until }
      : undefined,
    exceptionDates: shifted.exceptionDates ?? [],
    createdBy: event.createdBy,
  });
}

export function applyCustomEventDelete(
  event: CustomCalendarEvent,
  occurrenceStartAt: number | undefined,
  scope: RecurrenceEditScope,
): void {
  const originalStartAt = occurrenceStartAt ?? event.startAt;
  const isSeries = Boolean(event.recurrence);
  const effectiveScope = isSeries ? scope : "all";

  if (effectiveScope === "this" && isSeries) {
    const next = withException(event, originalStartAt);
    if (!eventHasRemainingOccurrences(next)) {
      deleteCustomCalendarEvent(event.id);
      return;
    }
    upsertCustomCalendarEvent(next);
    return;
  }

  if (effectiveScope === "following" && isSeries && originalStartAt !== event.startAt) {
    upsertCustomCalendarEvent({
      ...event,
      recurrence: event.recurrence
        ? { ...event.recurrence, until: originalStartAt - 1 }
        : undefined,
    });
    return;
  }

  deleteCustomCalendarEvent(event.id);
}

/** Drag a single occurrence. Recurring events detach; one-offs move in place. */
export function rescheduleCustomEventOccurrence(
  eventId: string,
  occurrenceStartAt: number,
  newStartAt: number,
  durationMs: number,
): void {
  const event = getCustomCalendarEvent(eventId);
  if (!event) return;
  const patch: CustomEventPatch = {
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: newStartAt,
    endAt: event.allDay ? undefined : newStartAt + Math.max(0, durationMs),
    allDay: event.allDay,
    recurrence: event.recurrence,
    courseId: event.courseId,
  };
  applyCustomEventSave(event, occurrenceStartAt, event.recurrence ? "this" : "all", patch);
}

function startOfHourTomorrow(hour = 14) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/** One demo course event so the calendar isn't empty of the new type. */
export function ensureDemoCustomEvents(courseId: string) {
  const flag = `canvasClone:customCalendarEventsSeeded:${courseId}`;
  try {
    if (window.localStorage.getItem(flag)) return;
    const all = loadAll();
    if (all.some((e) => e.courseId === courseId)) {
      window.localStorage.setItem(flag, "1");
      return;
    }
    const startAt = startOfHourTomorrow(15);
    persist([
      {
        id: `cal_seed_${courseId}`,
        title: "Review session",
        description: "Optional drop-in review before the next deadline.",
        location: "Zoom",
        startAt,
        endAt: startAt + 60 * 60 * 1000,
        allDay: false,
        courseId,
        createdBy: "1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      ...all,
    ]);
    window.localStorage.setItem(flag, "1");
  } catch {}
}
