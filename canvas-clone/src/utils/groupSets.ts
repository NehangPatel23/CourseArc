import { DEMO_PERSONAS } from "./demoPersona";
import { getSectionForStudent } from "./courseSections";

export type CourseGroup = {
  id: string;
  name: string;
  studentIds: string[];
  leaderId?: string;
};

export type GroupSet = {
  id: string;
  name: string;
  /** Students may join a group themselves (instructor still assigns by default). */
  selfSignup?: boolean;
  /** Cap on members per group. 0 / omitted = unlimited. */
  maxGroupSize?: number;
  /** Students may only join a group with classmates from the same section. */
  sameSectionOnly?: boolean;
  groups: CourseGroup[];
};

export type GroupJoinError = "full" | "section";

export const GROUP_SETS_CHANGED_EVENT = "canvasClone:groupSetsChanged";

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function storageKey(courseId: string) {
  return `canvasClone:groupSets:${courseId}`;
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

function seedGroupSets(courseId: string): GroupSet[] {
  const students = rosterStudentIds(courseId);
  const mid = Math.ceil(students.length / 2) || 0;
  return [
    {
      id: `gset_${courseId}_project`,
      name: "Project teams",
      selfSignup: false,
      groups: [
        {
          id: `grp_${courseId}_a`,
          name: "Team A",
          studentIds: students.slice(0, mid),
        },
        {
          id: `grp_${courseId}_b`,
          name: "Team B",
          studentIds: students.slice(mid),
        },
      ],
    },
  ];
}

function normalizeGroup(raw: unknown): CourseGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const g = raw as Partial<CourseGroup>;
  if (typeof g.id !== "string" || typeof g.name !== "string") return null;
  const studentIds = Array.isArray(g.studentIds)
    ? g.studentIds.filter((id): id is string => typeof id === "string")
    : [];
  const leaderId =
    typeof g.leaderId === "string" && studentIds.includes(g.leaderId) ? g.leaderId : undefined;
  return { id: g.id, name: g.name.trim() || "Group", studentIds, leaderId };
}

function normalizeSet(raw: unknown): GroupSet | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<GroupSet>;
  if (typeof s.id !== "string" || typeof s.name !== "string") return null;
  const groups = Array.isArray(s.groups)
    ? s.groups.map(normalizeGroup).filter((g): g is CourseGroup => Boolean(g))
    : [];
  const maxGroupSize =
    typeof s.maxGroupSize === "number" && s.maxGroupSize > 0
      ? Math.floor(s.maxGroupSize)
      : undefined;
  return {
    id: s.id,
    name: s.name.trim() || "Group set",
    selfSignup: Boolean(s.selfSignup),
    maxGroupSize,
    sameSectionOnly: Boolean(s.sameSectionOnly),
    groups,
  };
}

function persist(courseId: string, sets: GroupSet[]) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(sets));
    window.dispatchEvent(new Event(GROUP_SETS_CHANGED_EVENT));
  } catch {}
}

export function loadGroupSets(courseId: string): GroupSet[] {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) {
      const seeded = seedGroupSets(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = seedGroupSets(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    const sets = parsed.map(normalizeSet).filter((s): s is GroupSet => Boolean(s));
    if (sets.length === 0) {
      const seeded = seedGroupSets(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    return sets;
  } catch {
    return seedGroupSets(courseId);
  }
}

export function saveGroupSets(courseId: string, sets: GroupSet[]) {
  persist(courseId, sets);
}

export function getGroupSetById(courseId: string, setId: string): GroupSet | undefined {
  return loadGroupSets(courseId).find((s) => s.id === setId);
}

export function getGroupForStudent(
  courseId: string,
  groupSetId: string,
  studentId: string,
): CourseGroup | undefined {
  const set = getGroupSetById(courseId, groupSetId);
  return set?.groups.find((g) => g.studentIds.includes(studentId));
}

export function getGroupmateIds(
  courseId: string,
  groupSetId: string,
  studentId: string,
): string[] {
  const group = getGroupForStudent(courseId, groupSetId, studentId);
  return group?.studentIds ?? [];
}

export function addGroupSet(
  courseId: string,
  input: {
    name: string;
    selfSignup?: boolean;
    maxGroupSize?: number;
    sameSectionOnly?: boolean;
  },
): GroupSet {
  const sets = loadGroupSets(courseId);
  const set: GroupSet = {
    id: uid("gset"),
    name: input.name.trim() || "New group set",
    selfSignup: Boolean(input.selfSignup),
    maxGroupSize:
      typeof input.maxGroupSize === "number" && input.maxGroupSize > 0
        ? Math.floor(input.maxGroupSize)
        : undefined,
    sameSectionOnly: Boolean(input.sameSectionOnly),
    groups: [],
  };
  persist(courseId, [...sets, set]);
  return set;
}

export function updateGroupSet(
  courseId: string,
  setId: string,
  patch: Partial<Pick<GroupSet, "name" | "selfSignup" | "groups" | "maxGroupSize" | "sameSectionOnly">>,
): GroupSet | undefined {
  const sets = loadGroupSets(courseId);
  let updated: GroupSet | undefined;
  const next = sets.map((s) => {
    if (s.id !== setId) return s;
    const maxGroupSize =
      patch.maxGroupSize === undefined
        ? s.maxGroupSize
        : patch.maxGroupSize && patch.maxGroupSize > 0
          ? Math.floor(patch.maxGroupSize)
          : undefined;
    updated = {
      ...s,
      name: patch.name !== undefined ? patch.name.trim() || s.name : s.name,
      selfSignup: patch.selfSignup !== undefined ? patch.selfSignup : s.selfSignup,
      sameSectionOnly:
        patch.sameSectionOnly !== undefined ? patch.sameSectionOnly : s.sameSectionOnly,
      maxGroupSize,
      groups: patch.groups ?? s.groups,
    };
    return updated;
  });
  if (updated) persist(courseId, next);
  return updated;
}

export function deleteGroupSet(courseId: string, setId: string) {
  persist(
    courseId,
    loadGroupSets(courseId).filter((s) => s.id !== setId),
  );
}

export function addGroupToSet(
  courseId: string,
  setId: string,
  input: { name: string; studentIds?: string[] },
): CourseGroup | undefined {
  const sets = loadGroupSets(courseId);
  const idx = sets.findIndex((s) => s.id === setId);
  if (idx < 0) return undefined;
  const group: CourseGroup = {
    id: uid("grp"),
    name: input.name.trim() || `Group ${sets[idx].groups.length + 1}`,
    studentIds: input.studentIds ?? [],
  };
  const next = [...sets];
  next[idx] = { ...next[idx], groups: [...next[idx].groups, group] };
  persist(courseId, next);
  return group;
}

export function updateGroup(
  courseId: string,
  setId: string,
  groupId: string,
  patch: Partial<Pick<CourseGroup, "name" | "studentIds" | "leaderId">>,
): CourseGroup | undefined {
  const sets = loadGroupSets(courseId);
  let updated: CourseGroup | undefined;
  const next = sets.map((s) => {
    if (s.id !== setId) return s;
    return {
      ...s,
      groups: s.groups.map((g) => {
        if (g.id !== groupId) return g;
        const studentIds = patch.studentIds ?? g.studentIds;
        const leaderId =
          patch.leaderId === undefined
            ? g.leaderId && studentIds.includes(g.leaderId)
              ? g.leaderId
              : undefined
            : patch.leaderId && studentIds.includes(patch.leaderId)
              ? patch.leaderId
              : undefined;
        updated = {
          ...g,
          name: patch.name !== undefined ? patch.name.trim() || g.name : g.name,
          studentIds,
          leaderId,
        };
        return updated;
      }),
    };
  });
  if (updated) persist(courseId, next);
  return updated;
}

export function deleteGroup(courseId: string, setId: string, groupId: string) {
  const sets = loadGroupSets(courseId).map((s) =>
    s.id === setId ? { ...s, groups: s.groups.filter((g) => g.id !== groupId) } : s,
  );
  persist(courseId, sets);
}

export function reasonCannotJoinGroup(
  courseId: string,
  set: GroupSet,
  group: CourseGroup,
  studentId: string,
): GroupJoinError | null {
  const already = group.studentIds.includes(studentId);
  if (
    !already &&
    set.maxGroupSize &&
    set.maxGroupSize > 0 &&
    group.studentIds.length >= set.maxGroupSize
  ) {
    return "full";
  }
  if (set.sameSectionOnly && group.studentIds.length > 0) {
    const studentSection = getSectionForStudent(courseId, studentId)?.id;
    const peerSection = getSectionForStudent(courseId, group.studentIds[0]!)?.id;
    if (studentSection && peerSection && studentSection !== peerSection) {
      return "section";
    }
  }
  return null;
}

/**
 * Move a student into `groupId` within a set. Pass null groupId to remove them
 * from every group in the set. A student can only belong to one group per set.
 */
export function setStudentGroup(
  courseId: string,
  setId: string,
  studentId: string,
  groupId: string | null,
): boolean {
  const set = getGroupSetById(courseId, setId);
  if (!set) return false;
  if (groupId) {
    const group = set.groups.find((g) => g.id === groupId);
    if (!group) return false;
    const blocked = reasonCannotJoinGroup(courseId, set, group, studentId);
    if (blocked) return false;
  }
  const sets = loadGroupSets(courseId).map((s) => {
    if (s.id !== setId) return s;
    const groups = s.groups.map((g) => {
      const studentIds = g.studentIds.filter((id) => id !== studentId);
      const leaderId = g.leaderId === studentId ? undefined : g.leaderId;
      return { ...g, studentIds, leaderId };
    });
    if (groupId) {
      const idx = groups.findIndex((g) => g.id === groupId);
      if (idx >= 0 && !groups[idx].studentIds.includes(studentId)) {
        groups[idx] = {
          ...groups[idx],
          studentIds: [...groups[idx].studentIds, studentId],
        };
      }
    }
    return { ...s, groups };
  });
  persist(courseId, sets);
  return true;
}

export function studentSelfSignup(
  courseId: string,
  setId: string,
  studentId: string,
  groupId: string | null,
): boolean {
  const set = getGroupSetById(courseId, setId);
  if (!set?.selfSignup) return false;
  return setStudentGroup(courseId, setId, studentId, groupId);
}

export function findGroupInCourse(
  courseId: string,
  groupId: string,
): { set: GroupSet; group: CourseGroup } | undefined {
  for (const set of loadGroupSets(courseId)) {
    const group = set.groups.find((g) => g.id === groupId);
    if (group) return { set, group };
  }
  return undefined;
}

export function canAccessGroupHomepage(
  courseId: string,
  groupId: string,
  userId: string,
  isStaff: boolean,
): boolean {
  if (isStaff) return true;
  const found = findGroupInCourse(courseId, groupId);
  return Boolean(found?.group.studentIds.includes(userId));
}

export function groupsForStudent(courseId: string, studentId: string): { set: GroupSet; group: CourseGroup }[] {
  const out: { set: GroupSet; group: CourseGroup }[] = [];
  for (const set of loadGroupSets(courseId)) {
    const group = set.groups.find((g) => g.studentIds.includes(studentId));
    if (group) out.push({ set, group });
  }
  return out;
}

export function isAuthorInStudentGroup(
  courseId: string,
  groupSetId: string,
  studentId: string,
  author: { authorId?: string; author?: string; authorRole?: string },
): boolean {
  if (author.authorRole === "instructor" || author.authorRole === "ta") return true;
  const group = getGroupForStudent(courseId, groupSetId, studentId);
  if (!group) return false;
  if (author.authorId && group.studentIds.includes(author.authorId)) return true;
  if (!author.author) return false;
  try {
    const raw = window.localStorage.getItem(`canvasClone:courseRoster:${courseId}`);
    const roster = raw ? (JSON.parse(raw) as { id?: string; name?: string }[]) : [];
    const match = Array.isArray(roster)
      ? roster.find((m) => m?.name === author.author)
      : undefined;
    return Boolean(match?.id && group.studentIds.includes(match.id));
  } catch {
    return false;
  }
}
