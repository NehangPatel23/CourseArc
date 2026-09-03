// Shared module/page utilities used by Modules and Pages sections.

export type ItemRequirementType = "must_view" | "must_mark_done";

export type Item = {
  type: string; // "page" | "file" | "link" | "section" | "assignment" | "quiz" | "discussion"
  label: string;

  indent?: number;
  collapsed?: boolean;

  url?: string;
  pageId?: string;
  fileId?: string;
  fileName?: string;
  assignmentId?: string;
  quizId?: string;
  discussionId?: string;
  /** Course that owns the linked assignment/quiz (modules are stored globally). */
  ownerCourseId?: string;

  requirementType?: ItemRequirementType;
  /** Empty/undefined = every section. */
  assignedSectionIds?: string[];
  /** ISO unlock; hidden/locked for students until this time. */
  unlockAt?: string;
};

// Module requirements / progression modes
export type ModuleRequirementsMode = "none" | "all" | "sequential";

/**
 * module access prerequisite policy.
 * - "default": gate on earlier required modules
 * - "ignore": this module ignores prereq gating (always accessible)
 * - "module_number": gate on completion of a specific module number (1-based)
 */
export type ModuleAccessRule = "default" | "ignore" | "module_number";

export type ModuleT = {
  title: string;
  items: Item[];

  // When absent (legacy localStorage), treat as "none".
  requirementsMode?: ModuleRequirementsMode;

  // Access prereqs (optional for backward compat)
  accessRule?: ModuleAccessRule;
  prereqModuleNumber?: number;

  // ✅ NEW: timed unlock ISO string (UTC)
  unlockAt?: string;

  /** Empty/undefined = every section. Section ids are course-scoped. */
  assignedSectionIds?: string[];
  /** Per-section unlock times; omitted section uses `unlockAt`. */
  sectionUnlocks?: { sectionId: string; unlockAt?: string }[];
};

export const MODULES_STORAGE_KEY = "canvasClone:modules";
export const MODULES_CHANGED_EVENT = "canvasClone:modulesChanged";

export const slugifyLabel = (label: string) =>
  encodeURIComponent(label.toLowerCase().trim().replace(/\s+/g, "-"));

/** Drop fields that don't belong to this item type; keep the link ids that do. */
export function sanitizeModuleItem(raw: Item): Item {
  const type = raw.type;
  const label = (raw.label ?? "").trim();
  const indent = clampIndent(raw.indent);
  const assignedSectionIds = Array.isArray(raw.assignedSectionIds)
    ? raw.assignedSectionIds.filter((id): id is string => typeof id === "string" && Boolean(id))
    : undefined;
  const unlockAt = typeof raw.unlockAt === "string" && raw.unlockAt.trim() ? raw.unlockAt : undefined;
  const shared: Item = {
    type,
    label,
    indent,
    ...(assignedSectionIds?.length ? { assignedSectionIds } : {}),
    ...(unlockAt ? { unlockAt } : {}),
  };

  if (type === "section") {
    return { ...shared, collapsed: !!raw.collapsed };
  }

  const requirementType: ItemRequirementType =
    raw.requirementType === "must_mark_done" || raw.requirementType === "must_view"
      ? raw.requirementType
      : type === "file"
        ? "must_mark_done"
        : "must_view";

  if (type === "page") {
    return {
      ...shared,
      pageId: raw.pageId || slugifyLabel(label),
      requirementType,
    };
  }
  if (type === "file") {
    return {
      ...shared,
      fileId: raw.fileId,
      fileName: raw.fileName,
      requirementType,
    };
  }
  if (type === "link") {
    return { ...shared, url: raw.url, requirementType };
  }
  if (type === "assignment") {
    return {
      ...shared,
      assignmentId: raw.assignmentId,
      ownerCourseId: raw.ownerCourseId,
    };
  }
  if (type === "quiz") {
    return {
      ...shared,
      quizId: raw.quizId,
      ownerCourseId: raw.ownerCourseId,
    };
  }
  if (type === "discussion") {
    return {
      ...shared,
      discussionId: raw.discussionId,
      ownerCourseId: raw.ownerCourseId,
      requirementType,
    };
  }
  return { ...shared, requirementType };
}

export function moduleItemIdentity(it: Item): string {
  if (it.type === "page" && it.pageId) return `page:${it.pageId}`;
  if (it.type === "file" && it.fileId) return `file:${it.fileId}`;
  if (it.type === "assignment" && it.assignmentId) return `assignment:${it.assignmentId}`;
  if (it.type === "quiz" && it.quizId) return `quiz:${it.quizId}`;
  if (it.type === "discussion" && it.discussionId) return `discussion:${it.discussionId}`;
  if (it.type === "link" && it.url) return `link:${it.url}`;
  return `label:${it.type}:${it.label}`;
}

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

function normalizeUnlockAt(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString(); // normalize to ISO UTC
}

function normalizeSectionUnlock(
  row: unknown,
): { sectionId: string; unlockAt?: string } | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as { sectionId?: unknown; unlockAt?: unknown };
  if (typeof r.sectionId !== "string" || !r.sectionId) return undefined;
  return {
    sectionId: r.sectionId,
    unlockAt: normalizeUnlockAt(r.unlockAt),
  };
}

export function normalizeModules(modules: ModuleT[]): ModuleT[] {
  return modules.map((m) => {
    const requirementsMode = normalizeRequirementsMode(
      (m as any).requirementsMode,
    );
    const accessRule = normalizeAccessRule((m as any).accessRule);
    const unlockAt = normalizeUnlockAt((m as any).unlockAt);

    const assignedSectionIds = Array.isArray((m as any).assignedSectionIds)
      ? ((m as any).assignedSectionIds as unknown[]).filter(
          (id): id is string => typeof id === "string" && Boolean(id),
        )
      : undefined;
    const parsedUnlocks = Array.isArray((m as any).sectionUnlocks)
      ? ((m as any).sectionUnlocks as unknown[])
          .map(normalizeSectionUnlock)
          .filter((x): x is { sectionId: string; unlockAt?: string } => Boolean(x))
      : undefined;

    return {
      ...m,
      requirementsMode,
      accessRule,
      unlockAt,
      assignedSectionIds: assignedSectionIds?.length ? assignedSectionIds : undefined,
      sectionUnlocks: parsedUnlocks?.length ? parsedUnlocks : undefined,
      prereqModuleNumber:
        accessRule === "module_number"
          ? normalizePrereqModuleNumber((m as any).prereqModuleNumber ?? 1)
          : undefined,
      items: m.items.map((it) => {
        const indent = clampIndent((it as any).indent);
        const collapsed =
          it.type === "section" ? !!(it as any).collapsed : undefined;

        const assignedSectionIds = Array.isArray((it as { assignedSectionIds?: unknown }).assignedSectionIds)
          ? ((it as { assignedSectionIds: unknown[] }).assignedSectionIds).filter(
              (id): id is string => typeof id === "string" && Boolean(id),
            )
          : undefined;
        const itemUnlockAt = normalizeUnlockAt((it as { unlockAt?: unknown }).unlockAt);
        const extra = {
          ...(assignedSectionIds?.length ? { assignedSectionIds } : {}),
          ...(itemUnlockAt ? { unlockAt: itemUnlockAt } : {}),
        };

        if (it.type === "page") {
          return {
            ...it,
            ...extra,
            indent,
            pageId: it.pageId ?? slugifyLabel(it.label),
          };
        }

        if (it.type === "section") {
          return {
            ...it,
            ...extra,
            indent,
            collapsed,
          };
        }

        return { ...it, ...extra, indent };
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
    window.dispatchEvent(new Event(MODULES_CHANGED_EVENT));
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
