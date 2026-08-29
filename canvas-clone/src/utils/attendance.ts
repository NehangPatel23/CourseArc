import { loadRoster } from "./courseRoster";

export const ATTENDANCE_CHANGED_EVENT = "canvasClone:attendanceChanged";

export type RollCallStatus = "present" | "absent" | "late" | "excused";

export type AttendanceSession = {
  id: string;
  date: string;
  title?: string;
  records: Record<string, RollCallStatus>;
  createdAt: number;
};

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function storageKey(courseId: string) {
  return `canvasClone:attendance:${courseId}`;
}

function persist(courseId: string, sessions: AttendanceSession[]) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(sessions));
    window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT));
  } catch {}
}

function normalize(raw: unknown): AttendanceSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<AttendanceSession>;
  if (typeof s.id !== "string" || typeof s.date !== "string") return null;
  const records: Record<string, RollCallStatus> = {};
  if (s.records && typeof s.records === "object") {
    for (const [id, status] of Object.entries(s.records)) {
      if (status === "present" || status === "absent" || status === "late" || status === "excused") {
        records[id] = status;
      }
    }
  }
  return {
    id: s.id,
    date: s.date,
    title: typeof s.title === "string" ? s.title : undefined,
    records,
    createdAt: typeof s.createdAt === "number" ? s.createdAt : Date.now(),
  };
}

export function loadAttendanceSessions(courseId: string): AttendanceSession[] {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalize)
      .filter((s): s is AttendanceSession => Boolean(s))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  } catch {
    return [];
  }
}

export function saveAttendanceSessions(courseId: string, sessions: AttendanceSession[]) {
  persist(courseId, sessions);
}

export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function upsertAttendanceSession(
  courseId: string,
  input: { id?: string; date: string; title?: string; records: Record<string, RollCallStatus> },
): AttendanceSession {
  const sessions = loadAttendanceSessions(courseId);
  if (input.id) {
    const next = sessions.map((s) =>
      s.id === input.id
        ? {
            ...s,
            date: input.date,
            title: input.title?.trim() || undefined,
            records: input.records,
          }
        : s,
    );
    const found = next.find((s) => s.id === input.id);
    if (found) {
      persist(courseId, next);
      return found;
    }
  }
  const created: AttendanceSession = {
    id: uid("att"),
    date: input.date,
    title: input.title?.trim() || undefined,
    records: input.records,
    createdAt: Date.now(),
  };
  persist(courseId, [created, ...sessions]);
  return created;
}

export function deleteAttendanceSession(courseId: string, id: string) {
  persist(
    courseId,
    loadAttendanceSessions(courseId).filter((s) => s.id !== id),
  );
}

export function studentAttendanceSummary(courseId: string, studentId: string) {
  const sessions = loadAttendanceSessions(courseId);
  const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
  for (const session of sessions) {
    const status = session.records[studentId];
    if (!status) counts.unmarked += 1;
    else counts[status] += 1;
  }
  return { sessions, counts };
}

export function markAllPresent(courseId: string, session: AttendanceSession): AttendanceSession {
  const students = loadRoster(courseId).filter((m) => m.role === "student");
  const records: Record<string, RollCallStatus> = { ...session.records };
  for (const s of students) records[s.id] = "present";
  return upsertAttendanceSession(courseId, { ...session, records });
}

export const ROLL_CALL_LABELS: Record<RollCallStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};
