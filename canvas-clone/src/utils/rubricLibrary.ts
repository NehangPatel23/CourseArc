import {
  buildAssignmentRubric,
  createDefaultEssayRubric,
  normalizeEssayRubric,
  type RubricCriterionDef,
} from "./assignmentRubric";

export type LibraryRubric = {
  id: string;
  title: string;
  criteria: RubricCriterionDef[];
  updatedAt: number;
};

export const RUBRIC_LIBRARY_CHANGED_EVENT = "canvasClone:rubricLibraryChanged";

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function storageKey(courseId: string) {
  return `canvasClone:rubricLibrary:${courseId}`;
}

function seedLibrary(courseId: string): LibraryRubric[] {
  return [
    {
      id: `rub_${courseId}_written`,
      title: "Written work",
      criteria: createDefaultEssayRubric(100),
      updatedAt: Date.now(),
    },
  ];
}

function normalizeRubric(raw: unknown): LibraryRubric | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<LibraryRubric>;
  if (typeof r.id !== "string" || typeof r.title !== "string") return null;
  const criteria = normalizeEssayRubric(r.criteria) ?? [];
  return {
    id: r.id,
    title: r.title.trim() || "Untitled rubric",
    criteria,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
  };
}

function persist(courseId: string, rows: LibraryRubric[]) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(rows));
    window.dispatchEvent(new Event(RUBRIC_LIBRARY_CHANGED_EVENT));
  } catch {}
}

export function loadRubricLibrary(courseId: string): LibraryRubric[] {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) {
      const seeded = seedLibrary(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = seedLibrary(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    const rows = parsed.map(normalizeRubric).filter((r): r is LibraryRubric => Boolean(r));
    if (rows.length === 0) {
      const seeded = seedLibrary(courseId);
      persist(courseId, seeded);
      return seeded;
    }
    const sorted = rows.sort((a, b) => b.updatedAt - a.updatedAt);
    if (raw.includes('"outcomeIds"')) persist(courseId, sorted);
    return sorted;
  } catch {
    return seedLibrary(courseId);
  }
}

export function saveRubricLibrary(courseId: string, rows: LibraryRubric[]) {
  persist(courseId, rows);
}

export function getLibraryRubric(courseId: string, rubricId: string): LibraryRubric | undefined {
  return loadRubricLibrary(courseId).find((r) => r.id === rubricId);
}

export function saveLibraryRubric(
  courseId: string,
  input: {
    title: string;
    criteria: RubricCriterionDef[];
    id?: string;
  },
): LibraryRubric {
  const title = input.title.trim() || "Untitled rubric";
  const criteria = normalizeEssayRubric(input.criteria) ?? createDefaultEssayRubric(100);
  const all = loadRubricLibrary(courseId);
  if (input.id) {
    const next = all.map((row) =>
      row.id === input.id
        ? {
            ...row,
            title,
            criteria,
            updatedAt: Date.now(),
          }
        : row,
    );
    const found = next.find((r) => r.id === input.id);
    if (found) {
      persist(courseId, next);
      return found;
    }
  }
  const created: LibraryRubric = {
    id: uid("rub"),
    title,
    criteria,
    updatedAt: Date.now(),
  };
  persist(courseId, [created, ...all]);
  return created;
}

export function deleteLibraryRubric(courseId: string, id: string) {
  persist(
    courseId,
    loadRubricLibrary(courseId).filter((r) => r.id !== id),
  );
}

export function replaceRubricLibrary(courseId: string, rows: LibraryRubric[]) {
  persist(
    courseId,
    (Array.isArray(rows) ? rows : [])
      .map(normalizeRubric)
      .filter((r): r is LibraryRubric => Boolean(r)),
  );
}

export function copyLibraryRubric(
  fromCourseId: string,
  rubricId: string,
  toCourseId: string,
): LibraryRubric | undefined {
  const source = getLibraryRubric(fromCourseId, rubricId);
  if (!source) return undefined;
  return saveLibraryRubric(toCourseId, {
    title: source.title,
    criteria: source.criteria.map((c) => ({
      ...c,
      ratings: c.ratings.map((r) => ({ ...r })),
    })),
  });
}

/** GradePro: library rubric when attached, otherwise the generated assignment rubric. */
export function resolveAssignmentRubric(
  courseId: string,
  assignment: { rubricId?: string; points?: number } | undefined,
  maxPoints: number,
): RubricCriterionDef[] {
  if (assignment?.rubricId) {
    const lib = getLibraryRubric(courseId, assignment.rubricId);
    if (lib?.criteria.length) return lib.criteria;
  }
  return buildAssignmentRubric(maxPoints);
}
