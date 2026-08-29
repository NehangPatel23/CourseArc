export const COLLABORATIONS_CHANGED_EVENT = "canvasClone:collaborationsChanged";

export type CollaborationKind = "document" | "conference";

export type Collaboration = {
  id: string;
  kind: CollaborationKind;
  title: string;
  url: string;
  notes?: string;
  startsAt?: number;
  createdBy: string;
  createdById: string;
  createdAt: number;
};

function uid(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function storageKey(courseId: string) {
  return `canvasClone:collaborations:${courseId}`;
}

function persist(courseId: string, rows: Collaboration[]) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(rows));
    window.dispatchEvent(new Event(COLLABORATIONS_CHANGED_EVENT));
  } catch {}
}

function normalize(raw: unknown): Collaboration | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<Collaboration>;
  if (typeof c.id !== "string" || typeof c.title !== "string" || typeof c.url !== "string") {
    return null;
  }
  return {
    id: c.id,
    kind: c.kind === "conference" ? "conference" : "document",
    title: c.title.trim() || "Untitled",
    url: c.url.trim(),
    notes: typeof c.notes === "string" ? c.notes : undefined,
    startsAt: typeof c.startsAt === "number" ? c.startsAt : undefined,
    createdBy: typeof c.createdBy === "string" ? c.createdBy : "Instructor",
    createdById: typeof c.createdById === "string" ? c.createdById : "",
    createdAt: typeof c.createdAt === "number" ? c.createdAt : Date.now(),
  };
}

export function loadCollaborations(courseId: string): Collaboration[] {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalize)
      .filter((c): c is Collaboration => Boolean(c))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveCollaborations(courseId: string, rows: Collaboration[]) {
  persist(courseId, rows);
}

export function addCollaboration(
  courseId: string,
  input: {
    kind: CollaborationKind;
    title: string;
    url: string;
    notes?: string;
    startsAt?: number;
    createdBy: string;
    createdById: string;
  },
): Collaboration {
  const row: Collaboration = {
    id: uid("collab"),
    kind: input.kind,
    title: input.title.trim() || (input.kind === "conference" ? "Conference" : "Document"),
    url: input.url.trim(),
    notes: input.notes?.trim() || undefined,
    startsAt: input.startsAt,
    createdBy: input.createdBy,
    createdById: input.createdById,
    createdAt: Date.now(),
  };
  persist(courseId, [row, ...loadCollaborations(courseId)]);
  return row;
}

export function deleteCollaboration(courseId: string, id: string) {
  persist(
    courseId,
    loadCollaborations(courseId).filter((c) => c.id !== id),
  );
}
