import {
  formatAssignmentDueDate,
  isStudentVisibleAssignment,
  loadAssignments,
  saveAssignments,
} from "./assignments";
import {
  deleteAppointmentGroup,
  loadAppointmentGroups,
  newAppointmentGroupId,
  newAppointmentSlotId,
  upsertAppointmentGroup,
} from "./appointmentGroups";
import {
  addRosterMember,
  isPrimaryInstructor,
  loadRoster,
  removeRosterMember,
  ROSTER_ROLE_LABELS,
  updateRosterMember,
  type RosterMember,
} from "./courseRoster";
import {
  createAssignmentGroupId,
  getCourseAssignmentGroups,
  getCourseById,
  normalizeAssignmentGroups,
  updateCourse,
  type AssignmentGroup,
} from "./coursesStore";
import { isGradedDiscussion, isStudentVisibleTopic, loadTopics, saveTopics } from "./discussions";
import {
  getGradingScheme,
  normalizeGradingBands,
  type LetterGradeBand,
} from "./gradingScheme";
import { applyEffectiveDates } from "./dueDateOverrides";
import { matchesSearch } from "./listFilters";
import { isStudentViewableQuiz, loadQuizzes, saveQuizzes } from "./quizzes";

export type CourseSyllabus = {
  content: string;
  showCourseSummary: boolean;
  showTeachingTeam: boolean;
  showGrading: boolean;
  showOfficeHours: boolean;
  updatedAt: number;
};

export type SyllabusTeachingMember = {
  id: string;
  name: string;
  email?: string;
  role: "instructor" | "ta";
};

export type CourseSummaryKind = "assignment" | "quiz" | "discussion";

export type CourseSummaryItem = {
  id: string;
  kind: CourseSummaryKind;
  title: string;
  dueAt?: number;
  href: string;
  points?: number;
  published?: boolean;
};

export type CourseSummarySortKey = "title" | "kind" | "due" | "points";
export type CourseSummarySortDir = "asc" | "desc";
export type CourseSummaryWhenFilter = "all" | "upcoming" | "past";
export type CourseSummaryKindFilter = "all" | CourseSummaryKind;

export type SyllabusHeading = {
  id: string;
  text: string;
};

export type SyllabusOfficeHoursRow = {
  id: string;
  title: string;
  location?: string;
  nextStartAt?: number;
  nextEndAt?: number;
  href: string;
};

export const SYLLABUS_CHANGED_EVENT = "canvasClone:syllabusChanged";

const DEFAULT_CONTENT = `
<p>Welcome to this course. This syllabus is the course-level overview of expectations, policies, and graded work.</p>
<h2>How to succeed</h2>
<ul>
<li>Check Modules for the weekly sequence of readings and activities.</li>
<li>Submit assignments and quizzes before the due dates listed in the course summary.</li>
<li>Use Inbox or Discussions if you have a question about the work.</li>
</ul>
<p>Your instructor may update this page as the term progresses.</p>
`.trim();

function storageKey(courseId: string) {
  return `canvasClone:syllabus:${courseId}`;
}

function defaultSyllabus(): CourseSyllabus {
  return {
    content: DEFAULT_CONTENT,
    showCourseSummary: true,
    showTeachingTeam: true,
    showGrading: true,
    showOfficeHours: true,
    updatedAt: Date.now(),
  };
}

export function loadSyllabus(courseId: string): CourseSyllabus {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) {
      const seeded = defaultSyllabus();
      persist(courseId, seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<CourseSyllabus>;
    return {
      content: typeof parsed.content === "string" ? parsed.content : DEFAULT_CONTENT,
      showCourseSummary: parsed.showCourseSummary !== false,
      showTeachingTeam: parsed.showTeachingTeam !== false,
      showGrading: parsed.showGrading !== false,
      showOfficeHours: parsed.showOfficeHours !== false,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return defaultSyllabus();
  }
}

function persist(courseId: string, syllabus: CourseSyllabus) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(syllabus));
    window.dispatchEvent(new Event(SYLLABUS_CHANGED_EVENT));
  } catch {}
}

export function saveSyllabus(
  courseId: string,
  patch: Partial<
    Pick<
      CourseSyllabus,
      "content" | "showCourseSummary" | "showTeachingTeam" | "showGrading" | "showOfficeHours"
    >
  >,
): CourseSyllabus {
  const current = loadSyllabus(courseId);
  const next: CourseSyllabus = {
    content: patch.content !== undefined ? patch.content : current.content,
    showCourseSummary:
      patch.showCourseSummary !== undefined ? patch.showCourseSummary : current.showCourseSummary,
    showTeachingTeam:
      patch.showTeachingTeam !== undefined ? patch.showTeachingTeam : current.showTeachingTeam,
    showGrading: patch.showGrading !== undefined ? patch.showGrading : current.showGrading,
    showOfficeHours:
      patch.showOfficeHours !== undefined ? patch.showOfficeHours : current.showOfficeHours,
    updatedAt: Date.now(),
  };
  persist(courseId, next);
  return next;
}

export function replaceSyllabus(courseId: string, syllabus: CourseSyllabus) {
  persist(courseId, {
    content: syllabus.content ?? DEFAULT_CONTENT,
    showCourseSummary: syllabus.showCourseSummary !== false,
    showTeachingTeam: syllabus.showTeachingTeam !== false,
    showGrading: syllabus.showGrading !== false,
    showOfficeHours: syllabus.showOfficeHours !== false,
    updatedAt: syllabus.updatedAt || Date.now(),
  });
}

function isPublishedFlag(status?: string, published?: boolean): boolean {
  if (status === "draft") return false;
  return published !== false;
}

export function getCourseSummaryItems(
  courseId: string,
  opts?: { studentView?: boolean; studentId?: string },
): CourseSummaryItem[] {
  const studentView = Boolean(opts?.studentView);
  const studentId = opts?.studentId;
  const items: CourseSummaryItem[] = [];

  for (const a of loadAssignments(courseId)) {
    if (studentView && !isStudentVisibleAssignment(a)) continue;
    const dated =
      studentView && studentId ? applyEffectiveDates(courseId, "assignment", a, studentId) : a;
    items.push({
      id: a.id,
      kind: "assignment",
      title: a.title,
      dueAt: dated.dueAt,
      href: `/courses/${courseId}/assignments/${a.id}`,
      points: typeof a.points === "number" ? a.points : undefined,
      published: isPublishedFlag(a.status, a.published),
    });
  }

  for (const q of loadQuizzes(courseId)) {
    if (studentView && !isStudentViewableQuiz(q)) continue;
    const dated =
      studentView && studentId ? applyEffectiveDates(courseId, "quiz", q, studentId) : q;
    items.push({
      id: q.id,
      kind: "quiz",
      title: q.title,
      dueAt: dated.dueAt,
      href: `/courses/${courseId}/quizzes/${q.id}`,
      points: typeof q.points === "number" ? q.points : undefined,
      published: isPublishedFlag(q.status, q.published),
    });
  }

  for (const t of loadTopics(courseId)) {
    if (!isGradedDiscussion(t)) continue;
    if (studentView && !isStudentVisibleTopic(t)) continue;
    const dated =
      studentView && studentId ? applyEffectiveDates(courseId, "discussion", t, studentId) : t;
    items.push({
      id: t.id,
      kind: "discussion",
      title: t.title,
      dueAt: dated.dueAt,
      href: `/courses/${courseId}/discussions/${t.id}`,
      points: typeof t.points === "number" ? t.points : undefined,
      published: isPublishedFlag(t.status, t.published),
    });
  }

  return sortCourseSummaryItems(items, "due", "asc");
}

export function filterCourseSummaryItems(
  items: CourseSummaryItem[],
  opts: {
    query?: string;
    kind?: CourseSummaryKindFilter;
    when?: CourseSummaryWhenFilter;
    now?: number;
  } = {},
): CourseSummaryItem[] {
  const now = opts.now ?? Date.now();
  const kind = opts.kind ?? "all";
  const when = opts.when ?? "all";
  return items.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (!matchesSearch(`${row.title} ${summaryKindLabel(row.kind)}`, opts.query ?? "")) return false;
    if (when === "upcoming") {
      if (typeof row.dueAt !== "number" || row.dueAt < now) return false;
    }
    if (when === "past") {
      if (typeof row.dueAt !== "number" || row.dueAt >= now) return false;
    }
    return true;
  });
}

export function sortCourseSummaryItems(
  items: CourseSummaryItem[],
  sortKey: CourseSummarySortKey = "due",
  sortDir: CourseSummarySortDir = "asc",
): CourseSummaryItem[] {
  const dir = sortDir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "title") {
      cmp = a.title.localeCompare(b.title);
    } else if (sortKey === "kind") {
      cmp = summaryKindLabel(a.kind).localeCompare(summaryKindLabel(b.kind));
    } else if (sortKey === "points") {
      const ap = a.points ?? Number.NEGATIVE_INFINITY;
      const bp = b.points ?? Number.NEGATIVE_INFINITY;
      cmp = ap - bp;
    } else {
      const ad = a.dueAt ?? Number.POSITIVE_INFINITY;
      const bd = b.dueAt ?? Number.POSITIVE_INFINITY;
      cmp = ad - bd;
    }
    if (cmp === 0) cmp = a.title.localeCompare(b.title);
    return cmp * dir;
  });
}

export function filterAndSortCourseSummaryItems(
  items: CourseSummaryItem[],
  opts: {
    query?: string;
    kind?: CourseSummaryKindFilter;
    when?: CourseSummaryWhenFilter;
    sortKey?: CourseSummarySortKey;
    sortDir?: CourseSummarySortDir;
    now?: number;
  } = {},
): CourseSummaryItem[] {
  return sortCourseSummaryItems(
    filterCourseSummaryItems(items, opts),
    opts.sortKey ?? "due",
    opts.sortDir ?? "asc",
  );
}

export function formatSummaryDue(dueAt?: number): string {
  if (typeof dueAt !== "number") return "No due date";
  return formatAssignmentDueDate(dueAt);
}

export function formatSummaryPoints(points?: number): string {
  if (typeof points !== "number") return "—";
  return String(points);
}

export function summaryKindLabel(kind: CourseSummaryKind): string {
  if (kind === "quiz") return "Quiz";
  if (kind === "discussion") return "Discussion";
  return "Assignment";
}

export function syllabusContentEqual(a: string, b: string): boolean {
  return a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
}

export function formatSyllabusUpdatedAt(updatedAt: number): string {
  return new Date(updatedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function slugifyHeading(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `section-${index + 1}`;
}

export function withSyllabusHeadingIds(html: string): {
  html: string;
  headings: SyllabusHeading[];
} {
  if (!html.trim()) return { html, headings: [] };
  if (typeof DOMParser === "undefined") return { html, headings: [] };
  const doc = new DOMParser().parseFromString(`<div id="syllabus-root">${html}</div>`, "text/html");
  const root = doc.getElementById("syllabus-root") ?? doc.body;
  const headings: SyllabusHeading[] = [];
  const seen = new Set<string>();
  root.querySelectorAll("h2, h3").forEach((el, index) => {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const base = slugifyHeading(text, index);
    let id = `syllabus-${base}`;
    let n = 2;
    while (seen.has(id)) {
      id = `syllabus-${base}-${n++}`;
    }
    seen.add(id);
    el.setAttribute("id", id);
    headings.push({ id, text });
  });
  return { html: root.innerHTML, headings };
}

export function getSyllabusTeachingTeam(courseId: string): SyllabusTeachingMember[] {
  return loadRoster(courseId)
    .filter((m) => m.role === "instructor" || m.role === "ta")
    .map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role === "ta" ? "ta" : "instructor",
    }));
}

export function teachingRoleLabel(role: RosterMember["role"]): string {
  return ROSTER_ROLE_LABELS[role];
}

export function newSyllabusMemberId() {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `syl_tm_${id}`;
}

export function cloneTeachingTeam(members: SyllabusTeachingMember[]): SyllabusTeachingMember[] {
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role === "ta" ? "ta" : "instructor",
  }));
}

export function cloneGradingGroups(groups: AssignmentGroup[]): AssignmentGroup[] {
  return groups.map((g) => ({ ...g }));
}

export function cloneOfficeHours(rows: SyllabusOfficeHoursRow[]): SyllabusOfficeHoursRow[] {
  return rows.map((r) => ({ ...r }));
}

export function serializeTeachingTeam(members: SyllabusTeachingMember[]): string {
  return JSON.stringify(
    cloneTeachingTeam(members).map((m) => ({
      id: m.id,
      name: m.name.trim(),
      email: (m.email ?? "").trim(),
      role: m.role,
    })),
  );
}

export function serializeGradingGroups(groups: AssignmentGroup[]): string {
  return JSON.stringify(
    groups.map((g) => ({
      id: g.id,
      name: g.name.trim(),
      weight: Number.isFinite(g.weight) ? g.weight : 0,
      extraCredit: Boolean(g.extraCredit),
    })),
  );
}

export function serializeOfficeHours(rows: SyllabusOfficeHoursRow[]): string {
  return JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      title: r.title.trim(),
      location: (r.location ?? "").trim(),
      nextStartAt: r.nextStartAt ?? null,
      nextEndAt: r.nextEndAt ?? null,
    })),
  );
}

export function applySyllabusTeachingTeam(
  courseId: string,
  team: SyllabusTeachingMember[],
): SyllabusTeachingMember[] {
  const cleaned = cloneTeachingTeam(team)
    .map((m) => ({
      ...m,
      name: m.name.trim(),
      email: m.email?.trim() || undefined,
    }))
    .filter((m) => m.name.length > 0);
  const roster = loadRoster(courseId);
  const nextIds = new Set(cleaned.map((m) => m.id));
  const previousTeam = roster.filter((m) => m.role === "instructor" || m.role === "ta");

  for (const member of cleaned) {
    if (roster.some((m) => m.id === member.id)) {
      updateRosterMember(courseId, member.id, {
        name: member.name,
        email: member.email,
        role: member.role,
      });
    } else {
      addRosterMember(courseId, {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
      });
    }
  }

  for (const prev of previousTeam) {
    if (!nextIds.has(prev.id) && !isPrimaryInstructor(prev)) {
      removeRosterMember(courseId, prev.id);
    }
  }

  return getSyllabusTeachingTeam(courseId);
}

export function applySyllabusGrading(
  courseId: string,
  groups: AssignmentGroup[],
  weightedGrading: boolean,
): AssignmentGroup[] {
  const existing = getCourseAssignmentGroups(getCourseById(courseId));
  const byId = new Map(existing.map((g) => [g.id, g]));
  const merged = normalizeAssignmentGroups(
    groups.map((g) => {
      const prev = byId.get(g.id);
      return {
        ...prev,
        id: g.id || createAssignmentGroupId(),
        name: g.name,
        weight: g.weight,
        extraCredit: g.extraCredit,
      };
    }),
  );
  updateCourse(courseId, { assignmentGroups: merged, weightedGrading });
  return getCourseAssignmentGroups(getCourseById(courseId));
}

export function cloneLetterBands(bands: LetterGradeBand[]): LetterGradeBand[] {
  return bands.map((b) => ({ letter: b.letter, minPercent: b.minPercent }));
}

export function serializeLetterBands(bands: LetterGradeBand[]): string {
  return JSON.stringify(
    cloneLetterBands(bands).map((b) => ({
      letter: b.letter.trim(),
      minPercent: Number.isFinite(b.minPercent) ? b.minPercent : 0,
    })),
  );
}

export function applySyllabusLetterScheme(
  courseId: string,
  bands: LetterGradeBand[],
): LetterGradeBand[] {
  const current = getGradingScheme(courseId);
  updateCourse(courseId, {
    gradingScheme: {
      ...current,
      bands: normalizeGradingBands(bands),
    },
  });
  return getGradingScheme(courseId).bands;
}

export function serializeSummaryItems(items: CourseSummaryItem[]): string {
  return JSON.stringify(
    items.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title.trim(),
      points: typeof row.points === "number" ? row.points : null,
      dueAt: typeof row.dueAt === "number" ? row.dueAt : null,
    })),
  );
}

export function cloneSummaryItems(items: CourseSummaryItem[]): CourseSummaryItem[] {
  return items.map((row) => ({ ...row }));
}

export function applySyllabusSummaryItems(
  courseId: string,
  items: CourseSummaryItem[],
): CourseSummaryItem[] {
  const byKey = new Map(items.map((row) => [`${row.kind}:${row.id}`, row]));

  saveAssignments(
    courseId,
    loadAssignments(courseId).map((a) => {
      const patch = byKey.get(`assignment:${a.id}`);
      if (!patch) return a;
      return {
        ...a,
        title: patch.title.trim() || a.title,
        points: typeof patch.points === "number" ? patch.points : a.points,
        dueAt: patch.dueAt,
      };
    }),
  );

  saveQuizzes(
    courseId,
    loadQuizzes(courseId).map((q) => {
      const patch = byKey.get(`quiz:${q.id}`);
      if (!patch) return q;
      return {
        ...q,
        title: patch.title.trim() || q.title,
        points: typeof patch.points === "number" ? patch.points : q.points,
        dueAt: patch.dueAt,
      };
    }),
  );

  saveTopics(
    courseId,
    loadTopics(courseId).map((t) => {
      const patch = byKey.get(`discussion:${t.id}`);
      if (!patch) return t;
      return {
        ...t,
        title: patch.title.trim() || t.title,
        points: typeof patch.points === "number" ? patch.points : t.points,
        dueAt: patch.dueAt,
      };
    }),
  );

  return getCourseSummaryItems(courseId);
}

export function applySyllabusOfficeHours(
  courseId: string,
  rows: SyllabusOfficeHoursRow[],
  now = Date.now(),
): SyllabusOfficeHoursRow[] {
  const existing = loadAppointmentGroups(courseId);
  const byId = new Map(existing.map((g) => [g.id, g]));
  const keepIds = new Set(rows.map((r) => r.id));

  for (const row of rows) {
    const title = row.title.trim() || "Office hours";
    const location = row.location?.trim() || undefined;
    const prev = byId.get(row.id);
    const startAt = row.nextStartAt;
    const endAt =
      typeof row.nextEndAt === "number"
        ? row.nextEndAt
        : typeof startAt === "number"
          ? startAt + 30 * 60 * 1000
          : undefined;

    if (prev) {
      const slots = [...prev.slots];
      const upcomingIdx = slots.findIndex((s) => s.endAt >= now);
      if (typeof startAt === "number" && typeof endAt === "number") {
        if (upcomingIdx >= 0) {
          slots[upcomingIdx] = { ...slots[upcomingIdx], startAt, endAt };
        } else {
          slots.push({
            id: newAppointmentSlotId(),
            startAt,
            endAt,
            maxParticipants: 1,
            signups: [],
            waitlist: [],
          });
        }
      }
      upsertAppointmentGroup({
        ...prev,
        title,
        location,
        published: prev.published,
        slots,
      });
    } else {
      const slots =
        typeof startAt === "number" && typeof endAt === "number"
          ? [
              {
                id: newAppointmentSlotId(),
                startAt,
                endAt,
                maxParticipants: 1,
                signups: [],
                waitlist: [],
              },
            ]
          : [];
      upsertAppointmentGroup({
        id: row.id || newAppointmentGroupId(),
        courseId,
        title,
        location,
        published: true,
        slots,
      });
    }
  }

  for (const group of existing) {
    if (keepIds.has(group.id)) continue;
    const hasSignups = group.slots.some(
      (s) => s.signups.length > 0 || s.waitlist.length > 0,
    );
    if (hasSignups) {
      upsertAppointmentGroup({ ...group, published: false });
    } else {
      deleteAppointmentGroup(courseId, group.id);
    }
  }

  return getSyllabusOfficeHours(courseId, { studentView: false, now });
}

export function getSyllabusOfficeHours(
  courseId: string,
  opts?: { studentView?: boolean; now?: number },
): SyllabusOfficeHoursRow[] {
  const now = opts?.now ?? Date.now();
  const studentView = Boolean(opts?.studentView);
  const rows: SyllabusOfficeHoursRow[] = [];
  for (const group of loadAppointmentGroups(courseId)) {
    if (studentView && !group.published) continue;
    const upcoming = [...group.slots]
      .filter((slot) => slot.endAt >= now)
      .sort((a, b) => a.startAt - b.startAt);
    const next = upcoming[0];
    rows.push({
      id: group.id,
      title: group.title,
      location: group.location?.trim() || undefined,
      nextStartAt: next?.startAt,
      nextEndAt: next?.endAt,
      href: `/calendar`,
    });
  }
  return rows.sort((a, b) => {
    const at = a.nextStartAt ?? Number.POSITIVE_INFINITY;
    const bt = b.nextStartAt ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.title.localeCompare(b.title);
  });
}

export { newAppointmentGroupId };

export function formatOfficeHoursWhen(startAt?: number, endAt?: number): string {
  if (typeof startAt !== "number") return "No upcoming times";
  const start = new Date(startAt);
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (typeof endAt !== "number") return `${date} at ${startTime}`;
  const endTime = new Date(endAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date}, ${startTime}–${endTime}`;
}
