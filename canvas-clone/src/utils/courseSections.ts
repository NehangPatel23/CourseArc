import { DEMO_PERSONAS } from "./demoPersona";
import type { Item, ModuleT } from "./modules";

export type CourseSection = {
  id: string;
  name: string;
  studentIds: string[];
};

export const COURSE_SECTIONS_CHANGED_EVENT = "canvasClone:courseSectionsChanged";

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function storageKey(courseId: string) {
  return `canvasClone:courseSections:${courseId}`;
}

function rosterStudentIds(courseId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`canvasClone:courseRoster:${courseId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; role?: string }[];
      if (Array.isArray(parsed)) {
        const ids = parsed
          .filter((m) => m && m.role === "student" && typeof m.id === "string")
          .map((m) => m.id as string);
        if (ids.length) return ids;
      }
    }
  } catch {}
  return DEMO_PERSONAS.filter((p) => p.role !== "ta").map((p) => p.id);
}

function seedSections(courseId: string): CourseSection[] {
  const students = rosterStudentIds(courseId);
  if (students.length === 0) {
    return [{ id: uid("sec"), name: "Section 001", studentIds: [] }];
  }
  if (students.length === 1) {
    return [{ id: `sec_${courseId}_001`, name: "Section 001", studentIds: students }];
  }
  const mid = Math.ceil(students.length / 2);
  return [
    {
      id: `sec_${courseId}_001`,
      name: "Section 001",
      studentIds: students.slice(0, mid),
    },
    {
      id: `sec_${courseId}_002`,
      name: "Section 002",
      studentIds: students.slice(mid),
    },
  ];
}

function normalizeSection(raw: unknown): CourseSection | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<CourseSection>;
  if (typeof s.id !== "string" || typeof s.name !== "string") return null;
  const studentIds = Array.isArray(s.studentIds)
    ? s.studentIds.filter((id): id is string => typeof id === "string")
    : [];
  return { id: s.id, name: s.name.trim() || "Section", studentIds };
}

function persist(courseId: string, sections: CourseSection[]) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(sections));
    window.dispatchEvent(new Event(COURSE_SECTIONS_CHANGED_EVENT));
  } catch {}
}

export function loadSections(courseId: string): CourseSection[] {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) {
      const seeded = seedSections(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = seedSections(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    const sections = parsed
      .map(normalizeSection)
      .filter((s): s is CourseSection => Boolean(s));
    if (sections.length === 0) {
      const seeded = seedSections(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    return sections;
  } catch {
    return seedSections(courseId);
  }
}

export function saveSections(courseId: string, sections: CourseSection[]) {
  persist(courseId, sections);
}

export function getSectionById(
  courseId: string,
  sectionId: string,
): CourseSection | undefined {
  return loadSections(courseId).find((s) => s.id === sectionId);
}

/** First section that lists this student (a student belongs to at most one section). */
export function getSectionForStudent(
  courseId: string,
  studentId: string,
): CourseSection | undefined {
  return loadSections(courseId).find((s) => s.studentIds.includes(studentId));
}

export function addSection(
  courseId: string,
  input: { name: string; studentIds?: string[] },
): CourseSection {
  const sections = loadSections(courseId);
  const section: CourseSection = {
    id: uid("sec"),
    name: input.name.trim() || "New section",
    studentIds: input.studentIds ?? [],
  };
  persist(courseId, [...sections, section]);
  return section;
}

export function updateSection(
  courseId: string,
  sectionId: string,
  patch: Partial<Pick<CourseSection, "name" | "studentIds">>,
): CourseSection | undefined {
  const sections = loadSections(courseId);
  let updated: CourseSection | undefined;
  const next = sections.map((s) => {
    if (s.id !== sectionId) return s;
    updated = {
      ...s,
      name: patch.name !== undefined ? patch.name.trim() || s.name : s.name,
      studentIds: patch.studentIds ?? s.studentIds,
    };
    return updated;
  });
  if (updated) persist(courseId, next);
  return updated;
}

/**
 * Move a student into `sectionId`. Pass null to remove them from every section.
 * A student can only belong to one section at a time.
 */
export function setStudentSection(
  courseId: string,
  studentId: string,
  sectionId: string | null,
) {
  const sections = loadSections(courseId).map((s) => ({
    ...s,
    studentIds: s.studentIds.filter((id) => id !== studentId),
  }));
  if (sectionId) {
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx >= 0 && !sections[idx].studentIds.includes(studentId)) {
      sections[idx] = {
        ...sections[idx],
        studentIds: [...sections[idx].studentIds, studentId],
      };
    }
  }
  persist(courseId, sections);
}

export function deleteSection(courseId: string, sectionId: string) {
  persist(
    courseId,
    loadSections(courseId).filter((s) => s.id !== sectionId),
  );
}

export function getSectionName(courseId: string, sectionId: string): string {
  return getSectionById(courseId, sectionId)?.name ?? "Section";
}

/** Section display name used by quiz allowedSections matching. */
export function getStudentSectionName(courseId: string, studentId: string): string {
  return getSectionForStudent(courseId, studentId)?.name ?? "All";
}

export type ModuleSectionUnlock = {
  sectionId: string;
  unlockAt?: string;
};

export function getEffectiveModuleUnlockAt(
  mod: ModuleT,
  courseId?: string,
  studentId?: string,
): string | undefined {
  if (courseId && studentId) {
    const section = getSectionForStudent(courseId, studentId);
    const overrides = (mod as ModuleT & { sectionUnlocks?: ModuleSectionUnlock[] })
      .sectionUnlocks;
    if (section && overrides?.length) {
      const match = overrides.find((o) => o.sectionId === section.id);
      if (match) return match.unlockAt;
    }
  }
  return mod.unlockAt;
}

/**
 * When a module is assigned to specific sections of this course, hide it from
 * students who are not in those sections. Assignments that only reference
 * other courses' section ids are ignored (module stays visible).
 */
export function isModuleVisibleToStudent(
  mod: ModuleT,
  courseId: string,
  studentId: string,
): boolean {
  const assigned = (mod as ModuleT & { assignedSectionIds?: string[] }).assignedSectionIds;
  if (!assigned?.length) return true;
  const courseSectionIds = new Set(loadSections(courseId).map((s) => s.id));
  const relevant = assigned.filter((id) => courseSectionIds.has(id));
  if (relevant.length === 0) return true;
  const section = getSectionForStudent(courseId, studentId);
  return Boolean(section && relevant.includes(section.id));
}

export function isItemVisibleToStudent(
  item: Item,
  courseId: string,
  studentId: string,
): boolean {
  const assigned = item.assignedSectionIds;
  if (!assigned?.length) return true;
  const courseSectionIds = new Set(loadSections(courseId).map((s) => s.id));
  const relevant = assigned.filter((id) => courseSectionIds.has(id));
  if (relevant.length === 0) return true;
  const section = getSectionForStudent(courseId, studentId);
  return Boolean(section && relevant.includes(section.id));
}

export function isItemTimeLocked(item: Item, now = Date.now()): boolean {
  if (!item.unlockAt) return false;
  const t = Date.parse(item.unlockAt);
  return !Number.isNaN(t) && now < t;
}
