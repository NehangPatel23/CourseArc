export type WeekStartsOn = "sunday" | "monday";
export type DateFormatPref = "locale" | "numeric";

export type AppSettings = {
  requireLogin: boolean;
  defaultViewMode: "grid" | "list";
  notifyAssignments: boolean;
  notifyAnnouncements: boolean;
  notifyInbox: boolean;
  notifyGrades: boolean;
  notifyDiscussions: boolean;
  notifyAppointments: boolean;
  activeTerm: string | null;
  showArchivedCourses: boolean;
  weekStartsOn: WeekStartsOn;
  compactNav: boolean;
  reduceMotion: boolean;
  showCourseCodes: boolean;
  dateFormat: DateFormatPref;
  /** @deprecated Monaco is course-scoped (#31). Kept for older localStorage only. */
  monacoCodeEditor?: boolean;
  /** Quiz UI locale (#156). */
  quizLocale?: "en" | "es";
};

const SETTINGS_KEY = "canvasClone:settings";

const DEFAULTS: AppSettings = {
  requireLogin: false,
  defaultViewMode: "grid",
  notifyAssignments: true,
  notifyAnnouncements: true,
  notifyInbox: true,
  notifyGrades: true,
  notifyDiscussions: true,
  notifyAppointments: true,
  activeTerm: null,
  showArchivedCourses: false,
  weekStartsOn: "monday",
  compactNav: false,
  reduceMotion: false,
  showCourseCodes: true,
  dateFormat: "locale",
};

export function formatAppDate(isoOrDate: string | Date, format: DateFormatPref = "locale") {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  if (format === "numeric") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function applyAppAppearance(settings = loadSettings()) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
}

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
  applyAppAppearance(next);
  return next;
}

/** Ensure any previously applied dark class is cleared (legacy theme support). */
export function clearDarkMode() {
  document.documentElement.classList.remove("dark");
}
