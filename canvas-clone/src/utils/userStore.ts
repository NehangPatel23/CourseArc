export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  role: "student" | "instructor";
  enrolledCourseIds: string[];
  pronouns?: string;
};

const USER_KEY = "canvasClone:user";

const DEFAULT_USER: UserProfile = {
  id: "1",
  name: "Nehang Patel",
  email: "nehang@example.edu",
  avatarInitials: "NP",
  role: "instructor",
  enrolledCourseIds: ["1", "2"],
  pronouns: "He/Him/His",
};

export function loadUser(): UserProfile {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return { ...DEFAULT_USER };
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed?.name ? parsed : { ...DEFAULT_USER };
  } catch {
    return { ...DEFAULT_USER };
  }
}

export function saveUser(user: UserProfile) {
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("canvasClone:userChanged"));
  } catch {}
}

export function isAuthenticated(): boolean {
  try {
    return window.localStorage.getItem(USER_KEY) !== null;
  } catch {
    return false;
  }
}

export function loginAs(persona: "student" | "instructor") {
  const user: UserProfile = {
    ...DEFAULT_USER,
    role: persona,
    enrolledCourseIds: persona === "student" ? ["1"] : ["1", "2"],
  };
  saveUser(user);
  return user;
}

export function logout() {
  try {
    window.localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event("canvasClone:userChanged"));
  } catch {}
}

export function getFirstName(): string {
  return loadUser().name.split(" ")[0] ?? loadUser().name;
}

export function updateProfile(patch: Partial<Pick<UserProfile, "name" | "email" | "avatarInitials">>) {
  const user = loadUser();
  const next = { ...user, ...patch };
  if (patch.name && !patch.avatarInitials) {
    const parts = patch.name.trim().split(/\s+/);
    next.avatarInitials = parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : patch.name.slice(0, 2).toUpperCase();
  }
  saveUser(next);
  return next;
}
