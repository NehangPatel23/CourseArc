import { loadAssignments } from "./assignments";
import { loadSubmissionsForAssignment } from "./assignmentSubmissions";
import { loadParticipationsForTopic } from "./discussionParticipations";
import { isGradedDiscussion, loadTopics } from "./discussions";
import { loadQuizzes } from "./quizzes";
import { getAttemptsForQuiz } from "./quizSubmissions";
import { loadUser } from "./userStore";

export type RosterMember = {
  id: string;
  name: string;
  email?: string;
  role: "student" | "ta";
};

export const COURSE_ROSTER_CHANGED_EVENT = "canvasClone:courseRosterChanged";

function key(courseId: string) {
  return `canvasClone:courseRoster:${courseId}`;
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

  if (byId.size === 0) {
    const user = loadUser();
    byId.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "student",
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function saveRoster(courseId: string, members: RosterMember[]) {
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(members));
    window.dispatchEvent(new Event(COURSE_ROSTER_CHANGED_EVENT));
  } catch {}
}

export function loadRoster(courseId: string): RosterMember[] {
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

    // Merge any newly seen activity so roster stays in sync without wiping edits.
    const inferred = inferRosterFromActivity(courseId);
    const byId = new Map(parsed.map((m) => [m.id, m]));
    let changed = false;
    for (const m of inferred) {
      if (!byId.has(m.id)) {
        byId.set(m.id, m);
        changed = true;
      }
    }
    const merged = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (changed) saveRoster(courseId, merged);
    return merged;
  } catch {
    return inferRosterFromActivity(courseId);
  }
}

export function addRosterMember(
  courseId: string,
  input: { name: string; email?: string; role?: "student" | "ta"; id?: string },
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
  saveRoster(courseId, [...members, member].sort((a, b) => a.name.localeCompare(b.name)));
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
    };
    return updated;
  });
  if (updated) saveRoster(courseId, next);
  return updated;
}

export function removeRosterMember(courseId: string, id: string): void {
  saveRoster(
    courseId,
    loadRoster(courseId).filter((m) => m.id !== id),
  );
}

export function getRosterMemberName(courseId: string, studentId: string): string {
  return loadRoster(courseId).find((m) => m.id === studentId)?.name ?? studentId;
}
