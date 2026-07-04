export type AppSettings = {
  theme: "light" | "dark" | "system";
  requireLogin: boolean;
  defaultViewMode: "grid" | "list";
  notifyAssignments: boolean;
  notifyAnnouncements: boolean;
  notifyInbox: boolean;
  activeTerm: string | null;
  showArchivedCourses: boolean;
};

const SETTINGS_KEY = "canvasClone:settings";

const DEFAULTS: AppSettings = {
  theme: "light",
  requireLogin: false,
  defaultViewMode: "grid",
  notifyAssignments: true,
  notifyAnnouncements: true,
  notifyInbox: true,
  activeTerm: null,
  showArchivedCourses: false,
};

export function loadSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<AppSettings>) {
  const next = { ...loadSettings(), ...patch };
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("canvasClone:settingsChanged"));
  } catch {}
  applyTheme(next.theme);
  return next;
}

export function applyTheme(theme: AppSettings["theme"]) {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function initTheme() {
  applyTheme(loadSettings().theme);
}
