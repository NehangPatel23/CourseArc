import {
  getSectionForStudent,
  getSectionName,
  loadSections,
} from "./courseSections";
import { getRosterMemberName, loadRoster } from "./courseRoster";

export type DueDateItemKind = "assignment" | "quiz" | "discussion";
export type DueDateTargetKind = "section" | "student";

export type DueDateOverride = {
  id: string;
  itemKind: DueDateItemKind;
  itemId: string;
  targetKind: DueDateTargetKind;
  targetId: string;
  dueAt?: number;
  availableFrom?: number;
  availableUntil?: number;
};

export type EffectiveDates = {
  dueAt?: number;
  availableFrom?: number;
  availableUntil?: number;
  /** Section or student label when an override applied. */
  overrideLabel?: string;
};

export const DUE_DATE_OVERRIDES_CHANGED_EVENT = "canvasClone:dueDateOverridesChanged";

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function storageKey(courseId: string) {
  return `canvasClone:dueDateOverrides:${courseId}`;
}

function normalizeOverride(raw: unknown): DueDateOverride | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<DueDateOverride>;
  if (typeof o.id !== "string" || typeof o.itemId !== "string") return null;
  if (o.itemKind !== "assignment" && o.itemKind !== "quiz" && o.itemKind !== "discussion") {
    return null;
  }
  if (o.targetKind !== "section" && o.targetKind !== "student") return null;
  if (typeof o.targetId !== "string" || !o.targetId) return null;
  return {
    id: o.id,
    itemKind: o.itemKind,
    itemId: o.itemId,
    targetKind: o.targetKind,
    targetId: o.targetId,
    dueAt: typeof o.dueAt === "number" ? o.dueAt : undefined,
    availableFrom: typeof o.availableFrom === "number" ? o.availableFrom : undefined,
    availableUntil: typeof o.availableUntil === "number" ? o.availableUntil : undefined,
  };
}

function persist(courseId: string, items: DueDateOverride[]) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(items));
    window.dispatchEvent(new Event(DUE_DATE_OVERRIDES_CHANGED_EVENT));
  } catch {}
}

export function loadDueDateOverrides(courseId: string): DueDateOverride[] {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeOverride).filter((o): o is DueDateOverride => Boolean(o));
  } catch {
    return [];
  }
}

export function saveDueDateOverrides(courseId: string, items: DueDateOverride[]) {
  persist(courseId, items);
}

export function listOverridesForItem(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
): DueDateOverride[] {
  return loadDueDateOverrides(courseId).filter(
    (o) => o.itemKind === itemKind && o.itemId === itemId,
  );
}

export function replaceItemOverrides(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
  nextForItem: Array<Omit<DueDateOverride, "itemKind" | "itemId"> & Partial<Pick<DueDateOverride, "itemKind" | "itemId">>>,
) {
  const rest = loadDueDateOverrides(courseId).filter(
    (o) => !(o.itemKind === itemKind && o.itemId === itemId),
  );
  const stamped: DueDateOverride[] = nextForItem.map((o) => ({
    id: o.id || uid("ddo"),
    itemKind,
    itemId,
    targetKind: o.targetKind,
    targetId: o.targetId,
    dueAt: o.dueAt,
    availableFrom: o.availableFrom,
    availableUntil: o.availableUntil,
  }));
  persist(courseId, [...rest, ...stamped]);
}

export function newDueDateOverrideDraft(
  targetKind: DueDateTargetKind,
  targetId: string,
): Omit<DueDateOverride, "itemKind" | "itemId"> & { itemKind?: DueDateItemKind; itemId?: string } {
  return {
    id: uid("ddo"),
    targetKind,
    targetId,
  };
}

function pickOverride(
  courseId: string,
  overrides: DueDateOverride[],
  studentId: string,
): DueDateOverride | undefined {
  const studentHit = overrides.find(
    (o) => o.targetKind === "student" && o.targetId === studentId,
  );
  if (studentHit) return studentHit;
  const section = getSectionForStudent(courseId, studentId);
  if (!section) return undefined;
  return overrides.find((o) => o.targetKind === "section" && o.targetId === section.id);
}

export function resolveEffectiveDates(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
  defaults: EffectiveDates,
  studentId: string,
): EffectiveDates {
  const match = pickOverride(
    courseId,
    listOverridesForItem(courseId, itemKind, itemId),
    studentId,
  );
  if (!match) return { ...defaults };
  const label =
    match.targetKind === "section"
      ? getSectionName(courseId, match.targetId)
      : getRosterMemberName(courseId, match.targetId);
  return {
    dueAt: match.dueAt ?? defaults.dueAt,
    availableFrom: match.availableFrom ?? defaults.availableFrom,
    availableUntil: match.availableUntil ?? defaults.availableUntil,
    overrideLabel: label,
  };
}

export function getEffectiveDueAt(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
  defaultDueAt: number | undefined,
  studentId: string,
): number | undefined {
  return resolveEffectiveDates(
    courseId,
    itemKind,
    itemId,
    { dueAt: defaultDueAt },
    studentId,
  ).dueAt;
}

export function hasDueDateOverrides(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
): boolean {
  return listOverridesForItem(courseId, itemKind, itemId).length > 0;
}

export type DatedItem = {
  id: string;
  dueAt?: number;
  availableFrom?: number;
  availableUntil?: number;
};

/** Merge section/student overrides onto an item (student-facing dates). */
export function applyEffectiveDates<T extends DatedItem>(
  courseId: string,
  itemKind: DueDateItemKind,
  item: T,
  studentId: string,
): T {
  const dates = resolveEffectiveDates(
    courseId,
    itemKind,
    item.id,
    {
      dueAt: item.dueAt,
      availableFrom: item.availableFrom,
      availableUntil: item.availableUntil,
    },
    studentId,
  );
  return {
    ...item,
    dueAt: dates.dueAt,
    availableFrom: dates.availableFrom,
    availableUntil: dates.availableUntil,
  };
}

export type CalendarDueVariant = {
  dueAt: number;
  label: string;
  /** Distinct key for calendar event ids. */
  variantId: string;
};

/**
 * Instructor calendar: everyone-else due date plus each override that sets a due date.
 * Students should use resolveEffectiveDates instead.
 */
export function listCalendarDueVariants(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
  defaultDueAt: number | undefined,
): CalendarDueVariant[] {
  const overrides = listOverridesForItem(courseId, itemKind, itemId).filter(
    (o) => typeof o.dueAt === "number",
  );
  const variants: CalendarDueVariant[] = [];
  if (typeof defaultDueAt === "number") {
    variants.push({
      dueAt: defaultDueAt,
      label: overrides.length ? "Everyone else" : "",
      variantId: "everyone",
    });
  }
  for (const o of overrides) {
    const label =
      o.targetKind === "section"
        ? getSectionName(courseId, o.targetId)
        : getRosterMemberName(courseId, o.targetId);
    variants.push({
      dueAt: o.dueAt as number,
      label,
      variantId: o.id,
    });
  }
  return variants;
}

/** Whether this student's effective due date has passed (missing-work checks). */
export function isPastDueForStudent(
  courseId: string,
  itemKind: DueDateItemKind,
  itemId: string,
  defaultDueAt: number | undefined,
  studentId: string,
  now = Date.now(),
): boolean {
  const dueAt = getEffectiveDueAt(courseId, itemKind, itemId, defaultDueAt, studentId);
  return typeof dueAt === "number" && dueAt < now;
}

export function overrideTargetLabel(
  courseId: string,
  override: Pick<DueDateOverride, "targetKind" | "targetId">,
): string {
  if (override.targetKind === "section") {
    return getSectionName(courseId, override.targetId);
  }
  return getRosterMemberName(courseId, override.targetId);
}

export function listOverrideTargetOptions(courseId: string): {
  sections: { id: string; name: string }[];
  students: { id: string; name: string }[];
} {
  return {
    sections: loadSections(courseId).map((s) => ({ id: s.id, name: s.name })),
    students: loadRoster(courseId)
      .filter((m) => m.role === "student")
      .map((m) => ({ id: m.id, name: m.name })),
  };
}
