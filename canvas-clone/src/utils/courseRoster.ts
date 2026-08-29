import { loadAssignments } from "./assignments";
import { loadSubmissionsForAssignment } from "./assignmentSubmissions";
import { loadParticipationsForTopic } from "./discussionParticipations";
import { isGradedDiscussion, loadTopics } from "./discussions";
import { ensureDemoRoster } from "./demoPersona";
import { loadQuizzes } from "./quizzes";
import { getAttemptsForQuiz } from "./quizSubmissions";
import { loadStoredUser, loadUser } from "./userStore";

export type RosterRole = "instructor" | "ta" | "student";

export type RosterMember = {
  id: string;
  name: string;
  email?: string;
  role: RosterRole;
};

export const ROSTER_ROLE_LABELS: Record<RosterRole, string> = {
  instructor: "Instructor",
  ta: "TA",
  student: "Student",
};

export const COURSE_ROSTER_CHANGED_EVENT = "canvasClone:courseRosterChanged";

const ROLE_SORT: Record<RosterRole, number> = {
  instructor: 0,
  ta: 1,
  student: 2,
};

function key(courseId: string) {
  return `canvasClone:courseRoster:${courseId}`;
}

function sortRoster(members: RosterMember[]): RosterMember[] {
  return [...members].sort((a, b) => {
    const roleCmp = ROLE_SORT[a.role] - ROLE_SORT[b.role];
    if (roleCmp !== 0) return roleCmp;
    return a.name.localeCompare(b.name);
  });
}

function normalizeRole(role: unknown): RosterRole {
  if (role === "instructor" || role === "ta" || role === "student") return role;
  return "student";
}

/** Course owner / primary instructor from the signed-in instructor profile. */
function primaryInstructorMember(): RosterMember {
  const user = loadStoredUser();
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "instructor",
  };
}

/**
 * Ensure instructors appear on the roster. Always includes the primary course
 * instructor; preserves any additional instructor rows already saved.
 */
function withInstructors(members: RosterMember[]): RosterMember[] {
  const byId = new Map(members.map((m) => [m.id, { ...m, role: normalizeRole(m.role) }]));
  const primary = primaryInstructorMember();
  const existing = byId.get(primary.id);
  if (!existing) {
    byId.set(primary.id, primary);
  } else if (existing.role !== "instructor") {
    // Fix older seeds that listed the course owner as a student.
    byId.set(primary.id, {
      ...existing,
      role: "instructor",
      name: existing.name || primary.name,
      email: existing.email ?? primary.email,
    });
  } else {
    byId.set(primary.id, {
      ...existing,
      name: existing.name || primary.name,
      email: existing.email ?? primary.email,
    });
  }
  return sortRoster([...byId.values()]);
}

function inferRosterFromActivity(courseId: string): RosterMember[] {
  const byId = new Map<string, RosterMember>();

  for (const a of loadAssignments(courseId)) {
    for (const s of loadSubmissionsForAssignment(courseId, a.id)) {
      byId.set(s.studentId, {
        id: s.studentId,
        name: s.studentName,
        role: "student",
      });
    }
  }

  for (const q of loadQuizzes(courseId)) {
    for (const attempt of getAttemptsForQuiz(courseId, q.id)) {
      byId.set(attempt.studentId, {
        id: attempt.studentId,
        name: attempt.studentName,
        role: "student",
      });
    }
  }

  for (const t of loadTopics(courseId)) {
    if (!isGradedDiscussion(t)) continue;
    for (const p of loadParticipationsForTopic(courseId, t.id)) {
      byId.set(p.studentId, {
        id: p.studentId,
        name: p.studentName,
        role: "student",
      });
    }
  }

  // If nothing has been submitted yet, keep a demo student so the roster isn't empty.
  if (byId.size === 0) {
    const user = loadUser();
    if (user.id !== loadStoredUser().id) {
      byId.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "student",
      });
    }
  }

  return withInstructors([...byId.values()]);
}

function saveRoster(courseId: string, members: RosterMember[]) {
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(sortRoster(members)));
    window.dispatchEvent(new Event(COURSE_ROSTER_CHANGED_EVENT));
  } catch {}
}

export function loadRoster(courseId: string): RosterMember[] {
  // Keep demo students (including instructor-as-student) on the roster.
  ensureDemoRoster(courseId);
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) {
      const seeded = inferRosterFromActivity(courseId);
      saveRoster(courseId, seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as RosterMember[];
    if (!Array.isArray(parsed)) {
      const seeded = inferRosterFromActivity(courseId);
      saveRoster(courseId, seeded);
      return seeded;
    }

    const normalized = parsed.map((m) => ({
      ...m,
      role: normalizeRole(m.role),
    }));

    // Merge any newly seen activity so roster stays in sync without wiping edits.
    const inferred = inferRosterFromActivity(courseId);
    const byId = new Map(normalized.map((m) => [m.id, m]));
    let changed = false;
    for (const m of inferred) {
      if (!byId.has(m.id)) {
        byId.set(m.id, m);
        changed = true;
      }
    }
    const merged = withInstructors([...byId.values()]);
    // Persist if instructors were missing / role was corrected.
    const before = JSON.stringify(sortRoster(normalized));
    const after = JSON.stringify(merged);
    if (changed || before !== after) saveRoster(courseId, merged);
    return merged;
  } catch {
    return inferRosterFromActivity(courseId);
  }
}

export function addRosterMember(
  courseId: string,
  input: { name: string; email?: string; role?: RosterRole; id?: string },
): RosterMember {
  const members = loadRoster(courseId);
  const member: RosterMember = {
    id: input.id ?? `roster_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: input.name.trim(),
    email: input.email?.trim() || undefined,
    role: input.role ?? "student",
  };
  if (members.some((m) => m.id === member.id)) {
    return updateRosterMember(courseId, member.id, member) ?? member;
  }
  saveRoster(courseId, [...members, member]);
  return member;
}

export function updateRosterMember(
  courseId: string,
  id: string,
  patch: Partial<Pick<RosterMember, "name" | "email" | "role">>,
): RosterMember | undefined {
  const members = loadRoster(courseId);
  let updated: RosterMember | undefined;
  const next = members.map((m) => {
    if (m.id !== id) return m;
    updated = {
      ...m,
      ...patch,
      name: patch.name?.trim() ?? m.name,
      email: patch.email !== undefined ? patch.email.trim() || undefined : m.email,
      role: patch.role ? normalizeRole(patch.role) : m.role,
    };
    return updated;
  });
  if (updated) saveRoster(courseId, next);
  return updated;
}

/** True when this member is the primary course instructor and cannot be removed. */
export function isPrimaryInstructor(member: Pick<RosterMember, "id" | "role">): boolean {
  return member.role === "instructor" && member.id === loadStoredUser().id;
}

export function removeRosterMember(courseId: string, id: string): void {
  const members = loadRoster(courseId);
  const target = members.find((m) => m.id === id);
  if (target && isPrimaryInstructor(target)) return;
  saveRoster(
    courseId,
    members.filter((m) => m.id !== id),
  );
}

export function getRosterMemberName(courseId: string, studentId: string): string {
  return loadRoster(courseId).find((m) => m.id === studentId)?.name ?? studentId;
}
