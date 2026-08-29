import { loadCourses } from "./coursesStore";
import { getSectionForStudent } from "./courseSections";
import { loadUser } from "./userStore";

export type AppointmentSignup = {
  studentId: string;
  studentName: string;
  signedUpAt: number;
};

export type AppointmentChatAudience = "personal" | "waitlist" | "confirmed";

export type AppointmentSlotMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: number;
  /** personal = DM with `studentId`; waitlist/confirmed = instructor broadcast. */
  audience?: AppointmentChatAudience;
  /** Student this personal thread belongs to. */
  studentId?: string;
};

export type AppointmentAttendance = "present" | "absent" | "late";

export type AppointmentSlot = {
  id: string;
  startAt: number;
  endAt: number;
  /** Confirmed seats for this exact time. Independent of maxSlotsPerStudent. */
  maxParticipants: number;
  signups: AppointmentSignup[];
  waitlist: AppointmentSignup[];
  /** Instructor-authored notes for this meeting (agenda, Zoom, prep). */
  notesHtml?: string;
  messages?: AppointmentSlotMessage[];
  /** What each student wants to discuss. */
  prepByStudent?: Record<string, string>;
  attendanceByStudent?: Record<string, AppointmentAttendance>;
  /** Slot-specific room or meeting URL. Falls back to the group location. */
  location?: string;
};

export type AppointmentGroup = {
  id: string;
  /** Primary course; storage key. */
  courseId: string;
  /** Extra courses that can see and sign up for this group. */
  courseIds?: string[];
  title: string;
  /** HTML details from the rich text editor. */
  description?: string;
  location?: string;
  published: boolean;
  /** Students cannot cancel a booked slot after this many minutes before start. 0/undefined = until the slot starts. */
  cancelUntilMinutesBefore?: number;
  /** How many different times a student may hold in this group. 0 = unlimited, default 1. Does not change seats per slot. */
  maxSlotsPerStudent?: number;
  /** Empty / omitted = every section. */
  sectionIds?: string[];
  /** Empty / omitted = every student (still subject to sectionIds). */
  allowedStudentIds?: string[];
  /** Gap between generated slots, in minutes. */
  bufferMinutes?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  slots: AppointmentSlot[];
};

export const APPOINTMENT_GROUPS_CHANGED_EVENT = "canvasClone:appointmentGroupsChanged";

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function storageKey(courseId: string) {
  return `canvasClone:appointmentGroups:${courseId}`;
}

function normalizeSignup(raw: unknown): AppointmentSignup | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<AppointmentSignup>;
  if (typeof s.studentId !== "string" || typeof s.studentName !== "string") return null;
  return {
    studentId: s.studentId,
    studentName: s.studentName,
    signedUpAt: typeof s.signedUpAt === "number" ? s.signedUpAt : Date.now(),
  };
}

function normalizeMessage(raw: unknown): AppointmentSlotMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<AppointmentSlotMessage>;
  if (typeof m.id !== "string" || typeof m.authorId !== "string" || typeof m.body !== "string") {
    return null;
  }
  const body = m.body.trim();
  if (!body) return null;
  const audience: AppointmentChatAudience | undefined =
    m.audience === "waitlist" || m.audience === "personal" || m.audience === "confirmed"
      ? m.audience
      : undefined;
  const studentId = typeof m.studentId === "string" && m.studentId.trim() ? m.studentId : undefined;
  return {
    id: m.id,
    authorId: m.authorId,
    authorName: typeof m.authorName === "string" && m.authorName.trim() ? m.authorName : "Someone",
    body,
    createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
    audience,
    studentId: audience === "personal" || (!audience && studentId) ? studentId : undefined,
  };
}

export function appointmentMessageThread(
  message: AppointmentSlotMessage,
  slot: AppointmentSlot,
): { kind: "waitlist" } | { kind: "confirmed" } | { kind: "personal"; studentId: string } {
  if (message.audience === "waitlist") return { kind: "waitlist" };
  if (message.audience === "confirmed") return { kind: "confirmed" };
  if (message.audience === "personal" && message.studentId) {
    return { kind: "personal", studentId: message.studentId };
  }
  if (studentHoldsSlot(slot, message.authorId)) {
    return { kind: "personal", studentId: message.authorId };
  }
  return { kind: "personal", studentId: message.studentId ?? message.authorId };
}

export function studentCanSeeAppointmentMessage(
  message: AppointmentSlotMessage,
  studentId: string,
  slot: AppointmentSlot,
) {
  const thread = appointmentMessageThread(message, slot);
  if (thread.kind === "waitlist") {
    return (slot.waitlist ?? []).some((s) => s.studentId === studentId);
  }
  if (thread.kind === "confirmed") {
    return slot.signups.some((s) => s.studentId === studentId);
  }
  return thread.studentId === studentId;
}

export function visibleAppointmentSlotMessages(
  slot: AppointmentSlot,
  opts: { studentView: boolean; studentId: string },
) {
  const messages = slot.messages ?? [];
  if (!opts.studentView) return messages;
  return messages.filter((m) => studentCanSeeAppointmentMessage(m, opts.studentId, slot));
}

function normalizeStringRecord(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeAttendance(
  raw: unknown,
): Record<string, AppointmentAttendance> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, AppointmentAttendance> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "present" || value === "absent" || value === "late") out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeSlot(raw: unknown): AppointmentSlot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<AppointmentSlot>;
  if (typeof s.id !== "string" || typeof s.startAt !== "number" || typeof s.endAt !== "number") {
    return null;
  }
  const maxParticipants = Math.max(1, Math.floor(s.maxParticipants ?? 1));
  const allSignups = Array.isArray(s.signups)
    ? s.signups.map(normalizeSignup).filter((x): x is AppointmentSignup => Boolean(x))
    : [];
  const existingWaitlist = Array.isArray((s as { waitlist?: unknown }).waitlist)
    ? ((s as { waitlist: unknown[] }).waitlist)
        .map(normalizeSignup)
        .filter((x): x is AppointmentSignup => Boolean(x))
    : [];
  const signups = allSignups.slice(0, maxParticipants);
  const overflow = allSignups.slice(maxParticipants);
  const seen = new Set(signups.map((x) => x.studentId));
  const waitlist: AppointmentSignup[] = [];
  for (const entry of [...overflow, ...existingWaitlist]) {
    if (seen.has(entry.studentId)) continue;
    seen.add(entry.studentId);
    waitlist.push(entry);
  }
  const notesHtml = typeof s.notesHtml === "string" && s.notesHtml.trim() ? s.notesHtml : undefined;
  const messages = Array.isArray(s.messages)
    ? s.messages.map(normalizeMessage).filter((m): m is AppointmentSlotMessage => Boolean(m))
    : [];
  return {
    id: s.id,
    startAt: s.startAt,
    endAt: s.endAt,
    maxParticipants,
    signups,
    waitlist,
    notesHtml,
    messages: messages.length ? messages : undefined,
    prepByStudent: normalizeStringRecord(s.prepByStudent),
    attendanceByStudent: normalizeAttendance(s.attendanceByStudent),
    location: typeof s.location === "string" && s.location.trim() ? s.location.trim() : undefined,
  };
}

function normalizeGroup(raw: unknown, courseId: string): AppointmentGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<AppointmentGroup>;
  if (typeof g.id !== "string" || typeof g.title !== "string") return null;
  const extraIds = Array.isArray((g as { courseIds?: unknown }).courseIds)
    ? ((g as { courseIds: unknown[] }).courseIds).filter(
        (id): id is string => typeof id === "string" && Boolean(id) && id !== (g.courseId || courseId),
      )
    : undefined;
  const cancelUntil = (g as { cancelUntilMinutesBefore?: unknown }).cancelUntilMinutesBefore;
  const maxSlotsRaw = (g as { maxSlotsPerStudent?: unknown }).maxSlotsPerStudent;
  const sectionIds = Array.isArray((g as { sectionIds?: unknown }).sectionIds)
    ? ((g as { sectionIds: unknown[] }).sectionIds).filter(
        (id): id is string => typeof id === "string" && Boolean(id),
      )
    : undefined;
  const allowedStudentIds = Array.isArray((g as { allowedStudentIds?: unknown }).allowedStudentIds)
    ? ((g as { allowedStudentIds: unknown[] }).allowedStudentIds).filter(
        (id): id is string => typeof id === "string" && Boolean(id),
      )
    : undefined;
  const bufferRaw = (g as { bufferMinutes?: unknown }).bufferMinutes;
  return {
    id: g.id,
    courseId: g.courseId || courseId,
    courseIds: extraIds?.length ? extraIds : undefined,
    title: g.title,
    description: typeof g.description === "string" ? g.description : undefined,
    location: typeof g.location === "string" ? g.location : undefined,
    published: Boolean(g.published),
    cancelUntilMinutesBefore:
      typeof cancelUntil === "number" && cancelUntil >= 0 ? Math.floor(cancelUntil) : undefined,
    maxSlotsPerStudent:
      typeof maxSlotsRaw === "number" && Number.isFinite(maxSlotsRaw) && maxSlotsRaw >= 0
        ? Math.floor(maxSlotsRaw)
        : undefined,
    sectionIds: sectionIds?.length ? sectionIds : undefined,
    allowedStudentIds: allowedStudentIds?.length ? allowedStudentIds : undefined,
    bufferMinutes:
      typeof bufferRaw === "number" && Number.isFinite(bufferRaw) && bufferRaw > 0
        ? Math.floor(bufferRaw)
        : undefined,
    createdBy: typeof g.createdBy === "string" ? g.createdBy : "",
    createdAt: typeof g.createdAt === "number" ? g.createdAt : Date.now(),
    updatedAt: typeof g.updatedAt === "number" ? g.updatedAt : Date.now(),
    slots: Array.isArray(g.slots)
      ? g.slots
          .map(normalizeSlot)
          .filter((s): s is AppointmentSlot => Boolean(s))
          .sort((a, b) => a.startAt - b.startAt)
      : [],
  };
}

export function appointmentGroupCourseIds(group: AppointmentGroup): string[] {
  return [...new Set([group.courseId, ...(group.courseIds ?? [])].filter(Boolean))];
}

export function loadAppointmentGroupsForCourses(courseIds: string[]): AppointmentGroup[] {
  const wanted = new Set(courseIds);
  const seen = new Set<string>();
  const out: AppointmentGroup[] = [];
  const scan = new Set(courseIds);
  for (const c of loadCourses()) scan.add(c.id);
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      const prefix = "canvasClone:appointmentGroups:";
      if (key?.startsWith(prefix)) scan.add(key.slice(prefix.length));
    }
  } catch {}
  for (const cid of scan) {
    for (const g of loadAppointmentGroups(cid)) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      if (appointmentGroupCourseIds(g).some((id) => wanted.has(id))) out.push(g);
    }
  }
  return out;
}

function persist(courseId: string, groups: AppointmentGroup[]) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(groups));
    window.dispatchEvent(new Event(APPOINTMENT_GROUPS_CHANGED_EVENT));
  } catch {}
}

export function loadAppointmentGroups(courseId: string): AppointmentGroup[] {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((g) => normalizeGroup(g, courseId))
      .filter((g): g is AppointmentGroup => Boolean(g));
  } catch {
    return [];
  }
}

export function getAppointmentGroup(
  courseId: string,
  groupId: string,
): AppointmentGroup | undefined {
  return loadAppointmentGroups(courseId).find((g) => g.id === groupId);
}

export function findAppointmentGroup(
  groupId: string,
  courseIds: string[],
): AppointmentGroup | undefined {
  for (const courseId of courseIds) {
    const g = getAppointmentGroup(courseId, groupId);
    if (g) return g;
  }
  return undefined;
}

export function upsertAppointmentGroup(
  input: Omit<AppointmentGroup, "createdAt" | "updatedAt" | "createdBy"> & {
    createdBy?: string;
    createdAt?: number;
  },
): AppointmentGroup {
  const now = Date.now();
  const existing = loadAppointmentGroups(input.courseId);
  const prev = existing.find((g) => g.id === input.id);
  const group: AppointmentGroup = {
    ...input,
    title: input.title.trim() || "Appointment group",
    createdBy: prev?.createdBy ?? input.createdBy ?? loadUser().id,
    createdAt: prev?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
    slots: [...input.slots]
      .map((s) => normalizeSlot(s))
      .filter((s): s is AppointmentSlot => Boolean(s))
      .sort((a, b) => a.startAt - b.startAt),
  };
  const next = prev
    ? existing.map((g) => (g.id === group.id ? group : g))
    : [group, ...existing];
  persist(input.courseId, next);
  return group;
}

export function deleteAppointmentGroup(courseId: string, groupId: string) {
  persist(
    courseId,
    loadAppointmentGroups(courseId).filter((g) => g.id !== groupId),
  );
}

export function newAppointmentGroupId() {
  return uid("apg");
}

export function newAppointmentSlotId() {
  return uid("slot");
}

/** Build consecutive slots from a window. */
export function generateAppointmentSlots(opts: {
  windowStart: number;
  windowEnd: number;
  durationMinutes: number;
  maxParticipants?: number;
  repeatWeeks?: number;
  bufferMinutes?: number;
}): AppointmentSlot[] {
  const duration = Math.max(5, Math.floor(opts.durationMinutes)) * 60 * 1000;
  const buffer = Math.max(0, Math.floor(opts.bufferMinutes ?? 0)) * 60 * 1000;
  const maxParticipants = Math.max(1, Math.floor(opts.maxParticipants ?? 1));
  const weeks = Math.max(1, Math.min(12, Math.floor(opts.repeatWeeks ?? 1)));
  const slots: AppointmentSlot[] = [];
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  for (let w = 0; w < weeks; w++) {
    let t = opts.windowStart + w * weekMs;
    const end = opts.windowEnd + w * weekMs;
    while (t + duration <= end + 1000) {
      slots.push({
        id: newAppointmentSlotId(),
        startAt: t,
        endAt: t + duration,
        maxParticipants,
        signups: [],
        waitlist: [],
      });
      t += duration + buffer;
    }
  }
  return slots;
}

export function studentEligibleForAppointmentGroup(group: AppointmentGroup, studentId: string) {
  const allowed = group.allowedStudentIds?.filter(Boolean);
  if (allowed?.length && !allowed.includes(studentId)) return false;
  const sectionIds = group.sectionIds?.filter(Boolean);
  if (!sectionIds?.length) return true;
  for (const courseId of appointmentGroupCourseIds(group)) {
    const section = getSectionForStudent(courseId, studentId);
    if (section && sectionIds.includes(section.id)) return true;
  }
  return false;
}

export function duplicateAppointmentGroup(
  courseId: string,
  groupId: string,
  opts?: { shiftDays?: number },
) {
  const group = getAppointmentGroup(courseId, groupId);
  if (!group) return undefined;
  const shift = Math.max(1, Math.floor(opts?.shiftDays ?? 7)) * 24 * 60 * 60 * 1000;
  const copyTitle = /\(copy\)\s*$/i.test(group.title) ? group.title : `${group.title} (copy)`;
  return upsertAppointmentGroup({
    ...group,
    id: newAppointmentGroupId(),
    title: copyTitle,
    published: false,
    slots: group.slots.map((slot) => ({
      ...slot,
      id: newAppointmentSlotId(),
      startAt: slot.startAt + shift,
      endAt: slot.endAt + shift,
      signups: [],
      waitlist: [],
      messages: undefined,
      prepByStudent: undefined,
      attendanceByStudent: undefined,
    })),
  });
}

export function findOverlappingAppointmentSlots(
  startAt: number,
  endAt: number,
  opts?: { ignoreSlotId?: string; ignoreSlotIds?: string[]; courseIds?: string[] },
) {
  const courseIds = opts?.courseIds?.length
    ? opts.courseIds
    : loadCourses().map((c) => c.id);
  const ignore = new Set(
    [opts?.ignoreSlotId, ...(opts?.ignoreSlotIds ?? [])].filter(
      (id): id is string => Boolean(id),
    ),
  );
  const hits: { groupTitle: string; startAt: number; endAt: number; slotId: string }[] = [];
  for (const group of loadAppointmentGroupsForCourses(courseIds)) {
    for (const slot of group.slots) {
      if (ignore.has(slot.id)) continue;
      if (startAt < slot.endAt && slot.startAt < endAt) {
        hits.push({
          groupTitle: group.title,
          startAt: slot.startAt,
          endAt: slot.endAt,
          slotId: slot.id,
        });
      }
    }
  }
  return hits;
}

export function buildAppointmentAttendanceCsv(rows: AppointmentScheduleRow[]) {
  const header = ["Group", "Start", "End", "Location", "Student", "Status", "Attendance"];
  const lines = [header.join(",")];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  for (const row of rows) {
    const location = effectiveAppointmentLocation(row.group, row.slot) ?? "";
    const start = new Date(row.slot.startAt).toISOString();
    const end = new Date(row.slot.endAt).toISOString();
    const people = [
      ...row.slot.signups.map((s) => ({
        name: s.studentName,
        status: "confirmed",
        attendance: row.slot.attendanceByStudent?.[s.studentId] ?? "",
      })),
      ...(row.slot.waitlist ?? []).map((s) => ({
        name: s.studentName,
        status: "waitlist",
        attendance: "",
      })),
    ];
    if (people.length === 0) {
      lines.push(
        [row.group.title, start, end, location, "", "empty", ""]
          .map((v) => escape(String(v)))
          .join(","),
      );
      continue;
    }
    for (const person of people) {
      lines.push(
        [row.group.title, start, end, location, person.name, person.status, person.attendance]
          .map((v) => escape(String(v)))
          .join(","),
      );
    }
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function effectiveAppointmentLocation(
  group: Pick<AppointmentGroup, "location">,
  slot: Pick<AppointmentSlot, "location">,
) {
  const loc = slot.location?.trim() || group.location?.trim();
  return loc || undefined;
}

export function nextWaitlistedStudent(slot: AppointmentSlot) {
  return slot.waitlist?.[0];
}

export function formatAppointmentSlotRange(startAt: number, endAt: number) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${start.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function slotHasCapacity(slot: AppointmentSlot): boolean {
  return slot.signups.length < slot.maxParticipants;
}

export function slotOccupancy(slot: AppointmentSlot) {
  return {
    taken: slot.signups.length,
    max: slot.maxParticipants,
    remaining: Math.max(0, slot.maxParticipants - slot.signups.length),
    full: slot.signups.length >= slot.maxParticipants,
    waitlisted: slot.waitlist?.length ?? 0,
  };
}

export function unmarkedAttendanceCount(slot: AppointmentSlot) {
  return slot.signups.filter((s) => !slot.attendanceByStudent?.[s.studentId]).length;
}

export type AppointmentScheduleRow = {
  group: AppointmentGroup;
  slot: AppointmentSlot;
  unmarked: number;
};

export function listAppointmentSchedule(
  courseIds: string[],
  rangeStart: number,
  rangeEnd: number,
): AppointmentScheduleRow[] {
  const rows: AppointmentScheduleRow[] = [];
  for (const group of loadAppointmentGroupsForCourses(courseIds)) {
    for (const slot of group.slots) {
      if (slot.startAt >= rangeStart && slot.startAt < rangeEnd) {
        rows.push({ group, slot, unmarked: unmarkedAttendanceCount(slot) });
      }
    }
  }
  rows.sort((a, b) => a.slot.startAt - b.slot.startAt);
  return rows;
}

function studentHoldsSlot(slot: AppointmentSlot, studentId: string): boolean {
  return (
    slot.signups.some((s) => s.studentId === studentId) ||
    (slot.waitlist ?? []).some((s) => s.studentId === studentId)
  );
}

/** Calendar chip: dashed only when nobody is confirmed or waitlisted. */
export function appointmentSlotCalendarState(
  slot: AppointmentSlot,
  opts: { studentView: boolean; studentId: string },
) {
  const occ = slotOccupancy(slot);
  const mine = studentHoldsSlot(slot, opts.studentId);
  const hasPeople = occ.taken > 0 || (slot.waitlist?.length ?? 0) > 0;
  const appointmentBooked = hasPeople || (opts.studentView && mine);
  return {
    ...occ,
    mine,
    appointmentBooked,
    titleSuffix: appointmentBooked ? "" : " (open)",
  };
}

/** 0 means unlimited. */
export function studentSlotLimit(group: AppointmentGroup): number {
  const n = group.maxSlotsPerStudent;
  if (n === 0) return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.floor(n ?? 1));
}

export function studentHeldSlotsInGroup(
  group: AppointmentGroup,
  studentId: string,
): AppointmentSlot[] {
  return group.slots.filter((slot) => studentHoldsSlot(slot, studentId));
}

export function studentCanSeeAppointmentGroup(group: AppointmentGroup, studentId: string) {
  if (studentHeldSlotsInGroup(group, studentId).length > 0) return true;
  return studentEligibleForAppointmentGroup(group, studentId);
}

export function studentSignupInGroup(
  group: AppointmentGroup,
  studentId: string,
): { group: AppointmentGroup; slot: AppointmentSlot } | undefined {
  const slot =
    group.slots.find((s) => s.signups.some((x) => x.studentId === studentId)) ??
    group.slots.find((s) => (s.waitlist ?? []).some((x) => x.studentId === studentId));
  return slot ? { group, slot } : undefined;
}

export function signUpForSlot(
  courseId: string,
  groupId: string,
  slotId: string,
  student: { id: string; name: string },
  opts?: { bypassEligibility?: boolean },
): { ok: true; group: AppointmentGroup; waitlisted?: boolean } | { ok: false; reason: string } {
  const groups = loadAppointmentGroups(courseId);
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return { ok: false, reason: "Appointment group not found." };
  const group = groups[idx];
  if (!group.published) return { ok: false, reason: "This sign-up is not published." };
  if (!opts?.bypassEligibility && !studentEligibleForAppointmentGroup(group, student.id)) {
    return { ok: false, reason: "You are not eligible for this appointment group." };
  }

  const slot = group.slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: "Time slot not found." };
  if (studentHoldsSlot(slot, student.id)) {
    return {
      ok: true,
      group,
      waitlisted: (slot.waitlist ?? []).some((s) => s.studentId === student.id),
    };
  }
  const held = studentHeldSlotsInGroup(group, student.id);
  const limit = studentSlotLimit(group);
  if (held.length >= limit) {
    return {
      ok: false,
      reason:
        !Number.isFinite(limit)
          ? "You already hold the maximum number of slots in this group."
          : limit <= 1
            ? "You already signed up for another time in this group."
            : `You already hold ${limit} slots in this group.`,
    };
  }

  const entry: AppointmentSignup = {
    studentId: student.id,
    studentName: student.name,
    signedUpAt: Date.now(),
  };
  const nextSlot: AppointmentSlot = slotHasCapacity(slot)
    ? {
        ...slot,
        waitlist: slot.waitlist ?? [],
        signups: [...slot.signups, entry].slice(0, slot.maxParticipants),
      }
    : { ...slot, waitlist: [...(slot.waitlist ?? []), entry] };
  const nextGroup: AppointmentGroup = {
    ...group,
    updatedAt: Date.now(),
    slots: group.slots.map((s) => (s.id === slotId ? nextSlot : s)),
  };
  persist(
    courseId,
    groups.map((g) => (g.id === groupId ? nextGroup : g)),
  );
  return { ok: true, group: nextGroup, waitlisted: !slotHasCapacity(slot) };
}

export function admitWaitlistedStudent(
  courseId: string,
  groupId: string,
  slotId: string,
  studentId: string,
):
  | { ok: true; group: AppointmentGroup; extraSeat: boolean; studentName: string }
  | { ok: false; reason: string } {
  const groups = loadAppointmentGroups(courseId);
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return { ok: false, reason: "Appointment group not found." };
  const group = groups[idx];
  const slot = group.slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: "Time slot not found." };
  if (slot.signups.some((s) => s.studentId === studentId)) {
    const existing = slot.signups.find((s) => s.studentId === studentId)!;
    return { ok: true, group, extraSeat: false, studentName: existing.studentName };
  }
  const entry = (slot.waitlist ?? []).find((s) => s.studentId === studentId);
  if (!entry) return { ok: false, reason: "That student is not on the waitlist." };

  const signups = [...slot.signups, entry];
  const extraSeat = signups.length > slot.maxParticipants;
  const nextSlot: AppointmentSlot = {
    ...slot,
    signups,
    waitlist: (slot.waitlist ?? []).filter((s) => s.studentId !== studentId),
    maxParticipants: extraSeat ? signups.length : slot.maxParticipants,
  };
  const nextGroup: AppointmentGroup = {
    ...group,
    updatedAt: Date.now(),
    slots: group.slots.map((s) => (s.id === slotId ? nextSlot : s)),
  };
  persist(
    courseId,
    groups.map((g) => (g.id === groupId ? nextGroup : g)),
  );
  return { ok: true, group: nextGroup, extraSeat, studentName: entry.studentName };
}

export function moveConfirmedStudentToWaitlist(
  courseId: string,
  groupId: string,
  slotId: string,
  studentId: string,
): { ok: true; group: AppointmentGroup; studentName: string } | { ok: false; reason: string } {
  const groups = loadAppointmentGroups(courseId);
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return { ok: false, reason: "Appointment group not found." };
  const group = groups[idx];
  const slot = group.slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: "Time slot not found." };
  const entry = slot.signups.find((s) => s.studentId === studentId);
  if (!entry) return { ok: false, reason: "That student is not confirmed for this time." };

  const nextSlot: AppointmentSlot = {
    ...slot,
    signups: slot.signups.filter((s) => s.studentId !== studentId),
    waitlist: [
      ...(slot.waitlist ?? []).filter((s) => s.studentId !== studentId),
      { ...entry, signedUpAt: Date.now() },
    ],
  };
  const nextGroup: AppointmentGroup = {
    ...group,
    updatedAt: Date.now(),
    slots: group.slots.map((s) => (s.id === slotId ? nextSlot : s)),
  };
  persist(
    courseId,
    groups.map((g) => (g.id === groupId ? nextGroup : g)),
  );
  return { ok: true, group: nextGroup, studentName: entry.studentName };
}

export function addStudentToWaitlist(
  courseId: string,
  groupId: string,
  slotId: string,
  student: { id: string; name: string },
): { ok: true; group: AppointmentGroup; studentName: string } | { ok: false; reason: string } {
  const groups = loadAppointmentGroups(courseId);
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return { ok: false, reason: "Appointment group not found." };
  const group = groups[idx];
  const slot = group.slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: "Time slot not found." };
  if (slot.signups.some((s) => s.studentId === student.id)) {
    return { ok: false, reason: "They’re already confirmed for this time. Move them to the waitlist instead." };
  }
  if ((slot.waitlist ?? []).some((s) => s.studentId === student.id)) {
    return { ok: true, group, studentName: student.name };
  }
  const entry: AppointmentSignup = {
    studentId: student.id,
    studentName: student.name,
    signedUpAt: Date.now(),
  };
  const nextSlot: AppointmentSlot = {
    ...slot,
    waitlist: [...(slot.waitlist ?? []), entry],
  };
  const nextGroup: AppointmentGroup = {
    ...group,
    updatedAt: Date.now(),
    slots: group.slots.map((s) => (s.id === slotId ? nextSlot : s)),
  };
  persist(
    courseId,
    groups.map((g) => (g.id === groupId ? nextGroup : g)),
  );
  return { ok: true, group: nextGroup, studentName: student.name };
}

export function studentCancelCutoffAt(
  group: AppointmentGroup,
  slot: AppointmentSlot,
): number {
  const minutes = group.cancelUntilMinutesBefore;
  if (typeof minutes === "number" && minutes > 0) {
    return slot.startAt - minutes * 60 * 1000;
  }
  return slot.startAt;
}

export function studentCanCancelSignup(
  group: AppointmentGroup,
  studentId: string,
  now = Date.now(),
  slotId?: string,
): { ok: true; slot: AppointmentSlot } | { ok: false; reason: string } {
  const targets = slotId
    ? group.slots.filter((s) => s.id === slotId && studentHoldsSlot(s, studentId))
    : studentHeldSlotsInGroup(group, studentId);
  if (targets.length === 0) return { ok: false, reason: "You are not signed up." };

  const cutoffReason = (_slot: AppointmentSlot) => {
    const minutes = group.cancelUntilMinutesBefore;
    return typeof minutes === "number" && minutes > 0
      ? `You can only cancel until ${minutes} minutes before the appointment.`
      : "This appointment has already started.";
  };

  for (const slot of targets) {
    const onWaitlist = (slot.waitlist ?? []).some((s) => s.studentId === studentId);
    if (onWaitlist) continue;
    if (now >= studentCancelCutoffAt(group, slot)) {
      return { ok: false, reason: cutoffReason(slot) };
    }
  }
  return { ok: true, slot: targets[0] };
}

function releaseStudentFromSlot(
  slot: AppointmentSlot,
  studentId: string,
): { slot: AppointmentSlot; promoted?: AppointmentSignup } {
  const signups = slot.signups.filter((x) => x.studentId !== studentId);
  let waitlist = (slot.waitlist ?? []).filter((x) => x.studentId !== studentId);
  let promoted: AppointmentSignup | undefined;
  if (signups.length < slot.signups.length && waitlist.length > 0 && signups.length < slot.maxParticipants) {
    const [first, ...rest] = waitlist;
    promoted = first;
    waitlist = rest;
    return { slot: { ...slot, signups: [...signups, first], waitlist }, promoted };
  }
  return { slot: { ...slot, signups, waitlist }, promoted };
}

export function cancelAppointmentSignup(
  courseId: string,
  groupId: string,
  studentId: string,
  opts?: { ignoreCutoff?: boolean; slotId?: string },
): { group: AppointmentGroup; promoted?: AppointmentSignup } | undefined {
  const groups = loadAppointmentGroups(courseId);
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return undefined;
  const group = groups[idx];
  if (!opts?.ignoreCutoff) {
    const gate = studentCanCancelSignup(group, studentId, Date.now(), opts?.slotId);
    if (!gate.ok) return undefined;
  }
  let promoted: AppointmentSignup | undefined;
  const nextGroup: AppointmentGroup = {
    ...group,
    updatedAt: Date.now(),
    slots: group.slots.map((s) => {
      if (opts?.slotId && s.id !== opts.slotId) return s;
      if (!studentHoldsSlot(s, studentId)) return s;
      const released = releaseStudentFromSlot(s, studentId);
      if (released.promoted) promoted = released.promoted;
      return released.slot;
    }),
  };
  persist(
    courseId,
    groups.map((g) => (g.id === groupId ? nextGroup : g)),
  );
  return { group: nextGroup, promoted };
}

export function dropStudentFromSlot(
  courseId: string,
  groupId: string,
  slotId: string,
  studentId: string,
) {
  return cancelAppointmentSignup(courseId, groupId, studentId, {
    ignoreCutoff: true,
    slotId,
  });
}

export function getAppointmentSlot(
  courseId: string,
  groupId: string,
  slotId: string,
): { group: AppointmentGroup; slot: AppointmentSlot } | undefined {
  const group = getAppointmentGroup(courseId, groupId);
  const slot = group?.slots.find((s) => s.id === slotId);
  if (!group || !slot) return undefined;
  return { group, slot };
}

function mapAppointmentSlot(
  courseId: string,
  groupId: string,
  slotId: string,
  update: (slot: AppointmentSlot) => AppointmentSlot,
): AppointmentGroup | undefined {
  const groups = loadAppointmentGroups(courseId);
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return undefined;
  const group = groups[idx];
  if (!group.slots.some((s) => s.id === slotId)) return undefined;
  const nextGroup: AppointmentGroup = {
    ...group,
    updatedAt: Date.now(),
    slots: group.slots.map((s) => (s.id === slotId ? update(s) : s)),
  };
  persist(
    courseId,
    groups.map((g) => (g.id === groupId ? nextGroup : g)),
  );
  return nextGroup;
}

export function rescheduleAppointmentSlot(
  courseId: string,
  groupId: string,
  slotId: string,
  startAt: number,
) {
  if (!Number.isFinite(startAt)) return undefined;
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => {
    const duration = Math.max(5 * 60 * 1000, slot.endAt - slot.startAt);
    return { ...slot, startAt, endAt: startAt + duration };
  });
}

export function setAppointmentSlotDuration(
  courseId: string,
  groupId: string,
  slotId: string,
  durationMinutes: number,
) {
  const minutes = Math.max(5, Math.floor(durationMinutes));
  if (!Number.isFinite(minutes)) return undefined;
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => ({
    ...slot,
    endAt: slot.startAt + minutes * 60 * 1000,
  }));
}

export function reorderWaitlist(
  courseId: string,
  groupId: string,
  slotId: string,
  fromIndex: number,
  toIndex: number,
) {
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => {
    const list = [...(slot.waitlist ?? [])];
    if (fromIndex < 0 || fromIndex >= list.length) return slot;
    const to = Math.max(0, Math.min(list.length - 1, toIndex));
    if (to === fromIndex) return slot;
    const [item] = list.splice(fromIndex, 1);
    if (!item) return slot;
    list.splice(to, 0, item);
    return { ...slot, waitlist: list };
  });
}

export function moveWaitlist(
  courseId: string,
  groupId: string,
  slotId: string,
  studentId: string,
  direction: "up" | "down",
) {
  const loaded = getAppointmentSlot(courseId, groupId, slotId);
  if (!loaded) return undefined;
  const idx = (loaded.slot.waitlist ?? []).findIndex((s) => s.studentId === studentId);
  if (idx < 0) return loaded.group;
  const to = direction === "up" ? idx - 1 : idx + 1;
  if (to < 0 || to >= (loaded.slot.waitlist ?? []).length) return loaded.group;
  return reorderWaitlist(courseId, groupId, slotId, idx, to);
}

export function setAppointmentSlotLocation(
  courseId: string,
  groupId: string,
  slotId: string,
  location: string,
) {
  const trimmed = location.trim();
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => ({
    ...slot,
    location: trimmed || undefined,
  }));
}

export function setAppointmentSlotNotes(
  courseId: string,
  groupId: string,
  slotId: string,
  notesHtml: string,
) {
  const trimmed = notesHtml.trim();
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => ({
    ...slot,
    notesHtml: trimmed || undefined,
  }));
}

export function setAppointmentSlotPrep(
  courseId: string,
  groupId: string,
  slotId: string,
  studentId: string,
  prep: string,
) {
  const trimmed = prep.trim();
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => {
    const next = { ...(slot.prepByStudent ?? {}) };
    if (trimmed) next[studentId] = trimmed;
    else delete next[studentId];
    return {
      ...slot,
      prepByStudent: Object.keys(next).length ? next : undefined,
    };
  });
}

export function setAppointmentSlotAttendance(
  courseId: string,
  groupId: string,
  slotId: string,
  studentId: string,
  attendance: AppointmentAttendance | null,
) {
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => {
    const next = { ...(slot.attendanceByStudent ?? {}) };
    if (attendance) next[studentId] = attendance;
    else delete next[studentId];
    return {
      ...slot,
      attendanceByStudent: Object.keys(next).length ? next : undefined,
    };
  });
}

export function addAppointmentSlotMessage(
  courseId: string,
  groupId: string,
  slotId: string,
  author: { id: string; name: string },
  body: string,
  audience:
    | { kind: "waitlist" }
    | { kind: "confirmed" }
    | { kind: "personal"; studentId: string } = {
    kind: "personal",
    studentId: author.id,
  },
) {
  const text = body.trim();
  if (!text) return undefined;
  if (audience.kind === "personal" && !audience.studentId.trim()) return undefined;
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => ({
    ...slot,
    messages: [
      ...(slot.messages ?? []),
      {
        id: uid("msg"),
        authorId: author.id,
        authorName: author.name,
        body: text,
        createdAt: Date.now(),
        audience: audience.kind,
        studentId: audience.kind === "personal" ? audience.studentId : undefined,
      },
    ],
  }));
}

export function canDeleteAppointmentSlotMessage(
  message: AppointmentSlotMessage,
  opts: { studentView: boolean; userId: string },
) {
  if (!opts.studentView) return true;
  return message.authorId === opts.userId;
}

export function deleteAppointmentSlotMessage(
  courseId: string,
  groupId: string,
  slotId: string,
  messageId: string,
  actor?: { studentView: boolean; userId: string },
) {
  const loaded = getAppointmentSlot(courseId, groupId, slotId);
  if (!loaded) return undefined;
  const message = (loaded.slot.messages ?? []).find((m) => m.id === messageId);
  if (!message) return loaded.group;
  if (actor && !canDeleteAppointmentSlotMessage(message, actor)) return loaded.group;
  const nextMessages = (loaded.slot.messages ?? []).filter((m) => m.id !== messageId);
  return mapAppointmentSlot(courseId, groupId, slotId, (slot) => ({
    ...slot,
    messages: nextMessages.length ? nextMessages : undefined,
  }));
}

export function closeAppointmentGroup(courseId: string, groupId: string) {
  const groups = loadAppointmentGroups(courseId);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return undefined;
  const now = Date.now();
  const next: AppointmentGroup = {
    ...group,
    published: false,
    updatedAt: now,
    slots: group.slots.map((s) =>
      s.startAt > now && s.signups.length === 0 ? { ...s, waitlist: [] } : s,
    ),
  };
  persist(
    courseId,
    groups.map((g) => (g.id === groupId ? next : g)),
  );
  return next;
}

function startOfHourOnDay(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

/** Book the first seed office-hours slot once so calendars show booked vs open styles. */
function ensureDemoBookedOfficeHour(courseId: string) {
  const flag = `canvasClone:appointmentGroupsDemoBooked:${courseId}`;
  try {
    if (window.localStorage.getItem(flag)) return;
    const groups = loadAppointmentGroups(courseId);
    const seedId = `apg_seed_${courseId}`;
    const group = groups.find((g) => g.id === seedId);
    if (group?.slots[0] && group.slots[0].signups.length === 0) {
      persist(
        courseId,
        groups.map((g) =>
          g.id === seedId
            ? {
                ...g,
                slots: g.slots.map((s, i) =>
                  i === 0
                    ? {
                        ...s,
                        signups: [
                          {
                            studentId: "demo_alex",
                            studentName: "Alex Chen",
                            signedUpAt: Date.now(),
                          },
                        ],
                      }
                    : s,
                ),
              }
            : g,
        ),
      );
    }
    window.localStorage.setItem(flag, "1");
  } catch {}
}

/** Demo office-hours group for the sample course. */
export function ensureDemoAppointmentGroup(courseId: string) {
  const flag = `canvasClone:appointmentGroupsSeeded:${courseId}`;
  try {
    if (!window.localStorage.getItem(flag)) {
      const existing = loadAppointmentGroups(courseId);
      if (existing.length) {
        window.localStorage.setItem(flag, "1");
      } else {
        const windowStart = startOfHourOnDay(2, 13);
        const group: AppointmentGroup = {
          id: `apg_seed_${courseId}`,
          courseId,
          title: "Office hours",
          description:
            "<p>Sign up for a 20-minute slot. Bring questions about labs, quizzes, or upcoming assignments.</p><ul><li>In person: instructor office</li><li>Remote: use the course Zoom link</li></ul>",
          location: "Instructor office / Zoom",
          published: true,
          createdBy: "1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          slots: generateAppointmentSlots({
            windowStart,
            windowEnd: windowStart + 2 * 60 * 60 * 1000,
            durationMinutes: 20,
            maxParticipants: 1,
          }).map((slot, i) =>
            i === 0
              ? {
                  ...slot,
                  signups: [
                    { studentId: "demo_alex", studentName: "Alex Chen", signedUpAt: Date.now() },
                  ],
                }
              : slot,
          ),
        };
        persist(courseId, [group]);
        window.localStorage.setItem(flag, "1");
      }
    }
    ensureDemoBookedOfficeHour(courseId);
  } catch {}
}
