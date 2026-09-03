import type { Item, ModuleT } from "./modules";
import { slugifyLabel } from "./modules";
import { normalizePageId } from "./pageStorage";

export type ModuleNavKind = "page" | "file" | "assignment" | "quiz" | "discussion";

export type ModuleNavStop = {
  kind: ModuleNavKind;
  id: string;
  label: string;
  moduleTitle: string;
  path: string;
};

const NAV_KINDS = new Set<string>(["page", "file", "assignment", "quiz", "discussion"]);

function itemId(item: Item, kind: ModuleNavKind): string | undefined {
  if (kind === "page") return item.pageId ?? slugifyLabel(item.label);
  if (kind === "file") return item.fileId;
  if (kind === "assignment") return item.assignmentId;
  if (kind === "quiz") return item.quizId;
  return item.discussionId;
}

function idsMatch(kind: ModuleNavKind, a: string, b: string): boolean {
  if (kind === "page") {
    return normalizePageId(a) === normalizePageId(b);
  }
  return a === b;
}

export function moduleItemPath(
  item: Item,
  courseId: string,
  studentView: boolean,
): string | null {
  const kind = item.type;
  if (!NAV_KINDS.has(kind)) return null;
  const owner = item.ownerCourseId || courseId;

  if (kind === "page") {
    const pageId = item.pageId ?? slugifyLabel(item.label);
    if (!pageId) return null;
    return studentView
      ? `/courses/${courseId}/pages/${pageId}/view`
      : `/courses/${courseId}/pages/${pageId}`;
  }
  if (kind === "file") {
    if (!item.fileId) return null;
    return `/courses/${courseId}/files/${item.fileId}`;
  }
  if (kind === "assignment") {
    if (!item.assignmentId) return null;
    return `/courses/${owner}/assignments/${item.assignmentId}`;
  }
  if (kind === "quiz") {
    if (!item.quizId) return null;
    return `/courses/${owner}/quizzes/${item.quizId}`;
  }
  if (!item.discussionId) return null;
  return `/courses/${owner}/discussions/${item.discussionId}`;
}

function stopsInModule(
  mod: ModuleT,
  courseId: string,
  studentView: boolean,
): ModuleNavStop[] {
  const stops: ModuleNavStop[] = [];
  for (const item of mod.items) {
    const kind = item.type as ModuleNavKind;
    if (!NAV_KINDS.has(kind)) continue;
    const id = itemId(item, kind);
    const path = moduleItemPath(item, courseId, studentView);
    if (!id || !path) continue;
    stops.push({
      kind,
      id,
      label: item.label,
      moduleTitle: mod.title,
      path,
    });
  }
  return stops;
}

function indexOfCurrent(
  stops: ModuleNavStop[],
  current: { kind: ModuleNavKind; id: string },
): number {
  return stops.findIndex(
    (s) => s.kind === current.kind && idsMatch(current.kind, s.id, current.id),
  );
}

/** Previous/next in-app module items across the course (skips headers and external links). */
export function findModuleNeighbors(opts: {
  modules: ModuleT[];
  courseId: string;
  studentView: boolean;
  moduleTitle?: string;
  current: { kind: ModuleNavKind; id: string };
}): { prev: ModuleNavStop | null; next: ModuleNavStop | null } {
  const { modules, courseId, studentView, current } = opts;

  const stops = modules.flatMap((mod) => stopsInModule(mod, courseId, studentView));
  if (stops.length === 0) return { prev: null, next: null };

  let idx = -1;
  if (opts.moduleTitle) {
    idx = stops.findIndex(
      (s) =>
        s.moduleTitle === opts.moduleTitle &&
        s.kind === current.kind &&
        idsMatch(current.kind, s.id, current.id),
    );
  }
  if (idx < 0) idx = indexOfCurrent(stops, current);
  if (idx < 0) return { prev: null, next: null };

  return {
    prev: idx > 0 ? stops[idx - 1] : null,
    next: idx < stops.length - 1 ? stops[idx + 1] : null,
  };
}
