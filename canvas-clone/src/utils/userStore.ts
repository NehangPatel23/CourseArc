import { applyDemoPersonaOverlay, DEMO_SELF_PERSONA_ID, setActiveStudentId } from "./demoPersona";
import { AVATAR_COLORS, initialsFromName } from "./avatar";
import type { DoodleAvatarId } from "./avatarDoodles";
import { setViewAs } from "./studentView";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  /** Hex background for initials avatar. */
  avatarColor?: string;
  /** Optional uploaded image as a data URL. */
  avatarImage?: string | null;
  /** Built-in doodle face (used when no photo). */
  avatarDoodle?: DoodleAvatarId | null;
  role: "student" | "instructor" | "ta";
  enrolledCourseIds: string[];
  pronouns?: string;
};

const USER_KEY = "canvasClone:user";
const SESSION_KEY = "canvasClone:session";

export const AUTH_CHANGED_EVENT = "canvasClone:authChanged";

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  window.dispatchEvent(new Event("canvasClone:userChanged"));
}

const DEFAULT_USER: UserProfile = {
  id: "1",
  name: "Nehang Patel",
  email: "nehang@example.edu",
  avatarInitials: "NP",
  avatarColor: AVATAR_COLORS[0],
  avatarImage: null,
  avatarDoodle: null,
  role: "instructor",
  enrolledCourseIds: ["1", "2"],
  pronouns: "He/Him/His",
};

/** Raw profile from localStorage (instructor identity), without demo persona overlay. */
export function loadStoredUser(): UserProfile {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return { ...DEFAULT_USER };
    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed?.name) return { ...DEFAULT_USER };
    return {
      ...DEFAULT_USER,
      ...parsed,
      avatarInitials: parsed.avatarInitials || initialsFromName(parsed.name),
      avatarColor: parsed.avatarColor || DEFAULT_USER.avatarColor,
      avatarImage: parsed.avatarImage ?? null,
      avatarDoodle: parsed.avatarDoodle ?? null,
    };
  } catch {
    return { ...DEFAULT_USER };
  }
}

/** Effective user — remaps to the active demo student while student view is on. */
export function loadUser(): UserProfile {
  return applyDemoPersonaOverlay(loadStoredUser());
}

export function saveUser(user: UserProfile) {
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("canvasClone:userChanged"));
  } catch {}
}

/** True when a demo session is active (independent of the saved profile). */
export function isAuthenticated(): boolean {
  try {
    return window.localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function startSession() {
  try {
    window.localStorage.setItem(SESSION_KEY, "1");
  } catch {}
  notifyAuthChanged();
}

export function loginAs(
  persona: "student" | "instructor" | "ta",
  studentPersonaId?: string,
) {
  const stored = loadStoredUser();
  const user: UserProfile = {
    ...stored,
    id: DEFAULT_USER.id,
    role: persona === "ta" ? "instructor" : persona,
    enrolledCourseIds: persona === "student" ? ["1"] : ["1", "2"],
  };
  saveUser(user);
  startSession();
  if (persona === "ta") {
    setViewAs("ta");
  } else if (persona === "student") {
    setViewAs("student");
    setActiveStudentId(studentPersonaId ?? DEMO_SELF_PERSONA_ID);
  } else {
    setViewAs("instructor");
  }
  return user;
}

export function logout() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {}
  notifyAuthChanged();
}

export function getFirstName(): string {
  return loadUser().name.split(" ")[0] ?? loadUser().name;
}

export function updateProfile(
  patch: Partial<
    Pick<
      UserProfile,
      "name" | "email" | "avatarInitials" | "avatarColor" | "avatarImage" | "avatarDoodle"
    >
  >,
) {
  const user = loadStoredUser();
  const next = { ...user, ...patch };
  if (patch.name && patch.avatarInitials === undefined) {
    next.avatarInitials = initialsFromName(patch.name);
  }
  if (next.avatarInitials) {
    next.avatarInitials = next.avatarInitials.slice(0, 2).toUpperCase();
  }
  saveUser(next);
  return next;
}
