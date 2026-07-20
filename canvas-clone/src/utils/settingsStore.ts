export type AppSettings = {
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
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Drop legacy theme key if present in stored settings.
    const { theme: _ignored, ...rest } = parsed;
    void _ignored;
    return { ...DEFAULTS, ...(rest as Partial<AppSettings>) };
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
  return next;
}

/** Ensure any previously applied dark class is cleared (legacy theme support). */
export function clearDarkMode() {
  document.documentElement.classList.remove("dark");
}
