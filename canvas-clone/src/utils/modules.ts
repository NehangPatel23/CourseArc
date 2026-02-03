// Shared module/page utilities used by Modules and Pages sections.

export type ItemRequirementType = "must_view" | "must_mark_done";

export type Item = {
  type: string; // "page" | "file" | "link" | "section" (and any legacy values)
  label: string;

  indent?: number;
  collapsed?: boolean;

  url?: string;
  pageId?: string;
  fileId?: string;
  fileName?: string;

  requirementType?: ItemRequirementType;
};

// Module requirements / progression modes
export type ModuleRequirementsMode = "none" | "all" | "sequential";

/**
 * NEW: module access prerequisite policy.
 * - "default": keep current behavior (gate on earlier required modules)
 * - "ignore": this module ignores prereq gating (always accessible)
 * - "module_number": gate on completion of a specific module number (1-based)
 */
export type ModuleAccessRule = "default" | "ignore" | "module_number";

export type ModuleT = {
  title: string;
  items: Item[];

  // When absent (legacy localStorage), treat as "none".
  requirementsMode?: ModuleRequirementsMode;

  // NEW (optional for backward compat)
  accessRule?: ModuleAccessRule;
  prereqModuleNumber?: number; // only meaningful for accessRule === "module_number"
};

export const MODULES_STORAGE_KEY = "canvasClone:modules";

export const slugifyLabel = (label: string) =>
  encodeURIComponent(label.toLowerCase().trim().replace(/\s+/g, "-"));

// Default modules (used on very first load)
export const DEFAULT_MODULES: ModuleT[] = [
  {
    title: "Week 1 – Introduction",
    requirementsMode: "none",
    accessRule: "default",
    items: [
      { type: "section", label: "Start Here", indent: 0, collapsed: false },
      {
        type: "page",
        label: "Course Overview",
        pageId: "course-overview",
        indent: 1,
      },
      { type: "file", label: "Syllabus.pdf", indent: 1 },
    ],
  },
  {
    title: "Week 2 – Algorithms and Complexity",
    requirementsMode: "none",
    accessRule: "default",
    items: [
      {
        type: "section",
        label: "Learning Materials",
        indent: 0,
        collapsed: false,
      },
      {
        type: "page",
        label: "Lecture Slides",
        pageId: "lecture-slides",
        indent: 1,
      },
      { type: "file", label: "ExampleProblems.docx", indent: 1 },
      {
        type: "link",
        label: "Supplementary Reading",
        url: "https://example.com",
        indent: 1,
      },
    ],
  },
];

function clampIndent(n: unknown) {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
  return Math.max(0, Math.min(3, v));
}

function normalizeRequirementsMode(v: unknown): ModuleRequirementsMode {
  if (v === "none" || v === "all" || v === "sequential") return v;
  return "none";
}

function normalizeAccessRule(v: unknown): ModuleAccessRule {
  if (v === "default" || v === "ignore" || v === "module_number") return v;
  return "default";
}

function normalizePrereqModuleNumber(v: unknown) {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(1, n);
}

export function normalizeModules(modules: ModuleT[]): ModuleT[] {
  return modules.map((m) => {
    const requirementsMode = normalizeRequirementsMode(
      (m as any).requirementsMode,
    );
    const accessRule = normalizeAccessRule((m as any).accessRule);

    return {
      ...m,
      requirementsMode,
      accessRule,
      prereqModuleNumber:
        accessRule === "module_number"
          ? normalizePrereqModuleNumber((m as any).prereqModuleNumber ?? 1)
          : undefined,
      items: m.items.map((it) => {
        const indent = clampIndent((it as any).indent);
        const collapsed =
          it.type === "section" ? !!(it as any).collapsed : undefined;

        if (it.type === "page") {
          return {
            ...it,
            indent,
            pageId: it.pageId ?? slugifyLabel(it.label),
          };
        }

        if (it.type === "section") {
          return {
            ...it,
            indent,
            collapsed,
          };
        }

        return { ...it, indent };
      }),
    };
  });
}

export function loadModulesFromStorage(): ModuleT[] {
  try {
    const raw = window.localStorage.getItem(MODULES_STORAGE_KEY);
    if (!raw) return DEFAULT_MODULES;
    const parsed = JSON.parse(raw) as ModuleT[];
    return normalizeModules(parsed);
  } catch {
    return DEFAULT_MODULES;
  }
}

export function saveModulesToStorage(modules: ModuleT[]) {
  try {
    window.localStorage.setItem(MODULES_STORAGE_KEY, JSON.stringify(modules));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to save modules to localStorage", err);
  }
}

export function extractPageItems(modules: ModuleT[]) {
  return modules
    .flatMap((m) =>
      m.items
        .filter((it) => it.type === "page")
        .map((it) => ({
          moduleTitle: m.title,
          label: it.label,
          pageId: it.pageId ?? slugifyLabel(it.label),
        })),
    )
    .filter((p) => !!p.pageId);
}
