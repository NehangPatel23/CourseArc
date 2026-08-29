import { avatarColorForId, initialsFromName } from "./avatar";
import { isDoodleAvatarId, type DoodleAvatarId } from "./avatarDoodles";
import { readViewAs } from "./studentView";

export const ACTIVE_STUDENT_KEY = "canvasClone:activeStudentId";
export const DEMO_PERSONA_CHANGED_EVENT = "canvasClone:demoPersonaChanged";

/** Student-view identity for the signed-in instructor (“you as a student”). */
export const DEMO_SELF_PERSONA_ID = "demo_self";

export type DemoPersona = {
  id: string;
  name: string;
  email: string;
  /** Fixed color for non-customizable demo students. */
  color?: string;
  role?: "student" | "ta";
};

export const DEMO_TA_PERSONA_ID = "demo_ta";

/** Stable demo students for gradebook / submission demos. */
export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: DEMO_SELF_PERSONA_ID,
    name: "Nehang Patel",
    email: "nehang@example.edu",
    color: "#008EE2",
  },
  { id: "demo_alex", name: "Alex Chen", email: "alex.chen@example.edu", color: "#27AE60" },
  { id: "demo_jordan", name: "Jordan Lee", email: "jordan.lee@example.edu", color: "#9B59B6" },
  { id: "demo_sam", name: "Sam Rivera", email: "sam.rivera@example.edu", color: "#E67E22" },
  {
    id: DEMO_TA_PERSONA_ID,
    name: "Taylor Kim",
    email: "taylor.kim@example.edu",
    color: "#1ABC9C",
    role: "ta",
  },
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
  email?: string;
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

/** Read instructor profile without importing userStore (avoids cycles). */
function readStoredUserLite(): StoredAvatarSource {
  try {
    const raw = window.localStorage.getItem("canvasClone:user");
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAvatarSource;
      if (parsed?.name) return parsed;
    }
  } catch {}
  return {
    id: "1",
    name: "Nehang Patel",
    email: "nehang@example.edu",
    avatarColor: "#008EE2",
  };
}

/** Map legacy active id `"1"` (instructor) onto the student self persona. */
export function normalizeDemoPersonaId(id: string | null | undefined): string {
  if (!id || id === "1") return DEMO_SELF_PERSONA_ID;
  return id;
}

export function getActiveStudentId(): string | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_STUDENT_KEY);
    if (!raw) return null;
    return normalizeDemoPersonaId(raw);
  } catch {
    return null;
  }
}

export function setActiveStudentId(id: string | null) {
  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_STUDENT_KEY, normalizeDemoPersonaId(id));
    } else {
      window.localStorage.removeItem(ACTIVE_STUDENT_KEY);
    }
  } catch {}
  window.dispatchEvent(new Event(DEMO_PERSONA_CHANGED_EVENT));
  window.dispatchEvent(new Event("canvasClone:userChanged"));
}

export function getDemoPersona(id: string): DemoPersona | undefined {
  const normalized = normalizeDemoPersonaId(id);
  const base = DEMO_PERSONAS.find((p) => p.id === normalized);
  if (!base) return undefined;
  if (base.id !== DEMO_SELF_PERSONA_ID) return base;
  const stored = readStoredUserLite();
  return {
    ...base,
    name: stored.name || base.name,
    email: stored.email || base.email,
    color: stored.avatarColor || base.color,
  };
}

/**
 * Resolve avatar for a demo persona. The instructor-as-student persona uses
 * Settings customizations; other demos use fixed colors + initials.
 */
export function getPersonaAvatar(
  personaId: string,
  storedUser?: StoredAvatarSource | null,
): PersonaAvatar {
  const normalized = normalizeDemoPersonaId(personaId);
  const persona = getDemoPersona(normalized);
  const stored = storedUser ?? readStoredUserLite();
  const name = persona?.name ?? stored.name ?? "?";

  if (normalized === DEMO_SELF_PERSONA_ID) {
    const doodle =
      stored.avatarDoodle && isDoodleAvatarId(stored.avatarDoodle)
        ? stored.avatarDoodle
        : null;
    return {
      initials: (stored.avatarInitials || initialsFromName(stored.name)).slice(0, 2),
      color: stored.avatarColor || persona?.color || avatarColorForId(normalized),
      imageUrl: stored.avatarImage ?? null,
      doodleId: doodle,
    };
  }

  return {
    initials: initialsFromName(name),
    color: persona?.color || avatarColorForId(normalized),
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
  role: "student" | "instructor" | "ta";
  enrolledCourseIds: string[];
  pronouns?: string;
};

function overlayPersona(
  stored: PersonaOverlayUser,
  personaId: string,
  role: PersonaOverlayUser["role"],
): PersonaOverlayUser {
  const persona = getDemoPersona(personaId);
  if (!persona) return { ...stored, role };
  const av = getPersonaAvatar(personaId, stored);
  return {
    ...stored,
    id: persona.id,
    name: persona.name,
    email: persona.email,
    avatarInitials: av.initials,
    avatarColor: av.color,
    avatarImage: av.imageUrl,
    avatarDoodle: av.doodleId,
    role,
  };
}

/** Overlay demo identity: Taylor in TA view, a student persona in student view. */
export function applyDemoPersonaOverlay(stored: PersonaOverlayUser): PersonaOverlayUser {
  const viewAs = readViewAs();
  if (viewAs === "instructor") return stored;
  if (viewAs === "ta") {
    return overlayPersona(stored, DEMO_TA_PERSONA_ID, "ta");
  }
  let activeId = normalizeDemoPersonaId(getActiveStudentId() ?? DEMO_SELF_PERSONA_ID);
  if (activeId === DEMO_TA_PERSONA_ID) activeId = DEMO_SELF_PERSONA_ID;
  return overlayPersona(stored, activeId, "student");
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
  const self = readStoredUserLite();

  for (const persona of DEMO_PERSONAS) {
    if (byId.has(persona.id)) {
      // Keep the self student row’s display name in sync with Settings.
      if (persona.id === DEMO_SELF_PERSONA_ID) {
        const existing = byId.get(persona.id)!;
        if (existing.name !== self.name || existing.email !== (self.email || persona.email)) {
          byId.set(persona.id, {
            ...existing,
            name: self.name || persona.name,
            email: self.email || persona.email,
            role: "student",
          });
          changed = true;
        }
      }
      continue;
    }
    byId.set(persona.id, {
      id: persona.id,
      name: persona.id === DEMO_SELF_PERSONA_ID ? self.name || persona.name : persona.name,
      email: persona.id === DEMO_SELF_PERSONA_ID ? self.email || persona.email : persona.email,
      role: persona.role === "ta" ? "ta" : "student",
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

/** Student-view picker only — Taylor is selected via Viewing as TA. */
export function listDemoPersonasForPicker(): DemoPersona[] {
  return DEMO_PERSONAS.filter((p) => p.id !== DEMO_TA_PERSONA_ID)
    .map((p) => getDemoPersona(p.id)!)
    .filter(Boolean);
}

export function isDemoSelfPersona(id: string): boolean {
  return normalizeDemoPersonaId(id) === DEMO_SELF_PERSONA_ID;
}

/** Short work-status label for demo student personas. */
export function demoStudentWorkHint(id: string): string {
  const normalized = normalizeDemoPersonaId(id);
  if (normalized === DEMO_SELF_PERSONA_ID) return "Your student profile";
  if (normalized === "demo_alex") return "Complete, on-time work";
  if (normalized === "demo_jordan") return "Missing work";
  if (normalized === "demo_sam") return "Late work";
  return "Student";
}
