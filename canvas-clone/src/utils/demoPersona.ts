import { avatarColorForId, initialsFromName } from "./avatar";
import { isDoodleAvatarId, type DoodleAvatarId } from "./avatarDoodles";
import { readStudentView } from "./studentView";

export const ACTIVE_STUDENT_KEY = "canvasClone:activeStudentId";
export const DEMO_PERSONA_CHANGED_EVENT = "canvasClone:demoPersonaChanged";

export type DemoPersona = {
  id: string;
  name: string;
  email: string;
  /** Fixed color for non-customizable demo students. */
  color?: string;
};

/** Stable demo students for gradebook / submission demos. */
export const DEMO_PERSONAS: DemoPersona[] = [
  { id: "1", name: "Nehang Patel", email: "nehang@example.edu", color: "#008EE2" },
  { id: "demo_alex", name: "Alex Chen", email: "alex.chen@example.edu", color: "#27AE60" },
  { id: "demo_jordan", name: "Jordan Lee", email: "jordan.lee@example.edu", color: "#9B59B6" },
  { id: "demo_sam", name: "Sam Rivera", email: "sam.rivera@example.edu", color: "#E67E22" },
];

type RosterMemberLite = {
  id: string;
  name: string;
  email?: string;
  role: "student" | "ta";
};

export type StoredAvatarSource = {
  id: string;
  name: string;
  avatarInitials?: string;
  avatarColor?: string;
  avatarImage?: string | null;
  avatarDoodle?: DoodleAvatarId | null;
};

export type PersonaAvatar = {
  initials: string;
  color: string;
  imageUrl: string | null;
  doodleId: DoodleAvatarId | null;
};

function rosterKey(courseId: string) {
  return `canvasClone:courseRoster:${courseId}`;
}

export function getActiveStudentId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_STUDENT_KEY);
  } catch {
    return null;
  }
}

export function setActiveStudentId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_STUDENT_KEY, id);
    else window.localStorage.removeItem(ACTIVE_STUDENT_KEY);
  } catch {}
  window.dispatchEvent(new Event(DEMO_PERSONA_CHANGED_EVENT));
  window.dispatchEvent(new Event("canvasClone:userChanged"));
}

export function getDemoPersona(id: string): DemoPersona | undefined {
  return DEMO_PERSONAS.find((p) => p.id === id);
}

/**
 * Resolve avatar for a demo persona. The primary user (id "1") uses Settings
 * customizations; other demos use fixed colors + initials.
 */
export function getPersonaAvatar(
  personaId: string,
  storedUser?: StoredAvatarSource | null,
): PersonaAvatar {
  const persona = getDemoPersona(personaId);
  const name = persona?.name ?? storedUser?.name ?? "?";

  if (personaId === "1" && storedUser) {
    const doodle =
      storedUser.avatarDoodle && isDoodleAvatarId(storedUser.avatarDoodle)
        ? storedUser.avatarDoodle
        : null;
    return {
      initials: (storedUser.avatarInitials || initialsFromName(storedUser.name)).slice(0, 2),
      color: storedUser.avatarColor || persona?.color || avatarColorForId(personaId),
      imageUrl: storedUser.avatarImage ?? null,
      doodleId: doodle,
    };
  }

  return {
    initials: initialsFromName(name),
    color: persona?.color || avatarColorForId(personaId),
    imageUrl: null,
    doodleId: null,
  };
}

export type PersonaOverlayUser = {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  avatarColor?: string;
  avatarImage?: string | null;
  avatarDoodle?: DoodleAvatarId | null;
  role: "student" | "instructor";
  enrolledCourseIds: string[];
  pronouns?: string;
};

/** Overlay student persona onto the stored profile while student view is active. */
export function applyDemoPersonaOverlay(stored: PersonaOverlayUser): PersonaOverlayUser {
  if (!readStudentView()) return stored;
  const activeId = getActiveStudentId() ?? "1";
  const persona = getDemoPersona(activeId);
  if (!persona) return { ...stored, role: "student" };
  const av = getPersonaAvatar(activeId, stored);
  return {
    ...stored,
    id: persona.id,
    name: persona.name,
    email: persona.email,
    avatarInitials: av.initials,
    avatarColor: av.color,
    avatarImage: av.imageUrl,
    avatarDoodle: av.doodleId,
    role: "student",
  };
}

/** Ensure demo students exist on a course roster (idempotent; avoids userStore cycles). */
export function ensureDemoRoster(courseId: string): RosterMemberLite[] {
  let members: RosterMemberLite[] = [];
  try {
    const raw = window.localStorage.getItem(rosterKey(courseId));
    if (raw) {
      const parsed = JSON.parse(raw) as RosterMemberLite[];
      if (Array.isArray(parsed)) members = parsed;
    }
  } catch {}

  const byId = new Map(members.map((m) => [m.id, m]));
  let changed = false;
  for (const persona of DEMO_PERSONAS) {
    if (byId.has(persona.id)) continue;
    byId.set(persona.id, {
      id: persona.id,
      name: persona.name,
      email: persona.email,
      role: "student",
    });
    changed = true;
  }
  const next = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (changed || members.length === 0) {
    try {
      window.localStorage.setItem(rosterKey(courseId), JSON.stringify(next));
      window.dispatchEvent(new Event("canvasClone:courseRosterChanged"));
    } catch {}
  }
  return next;
}

export function listDemoPersonasForPicker(): DemoPersona[] {
  return DEMO_PERSONAS;
}
