import type { ModuleT, ModuleRequirementsMode } from "./modules";

export type ProgressState = {
  modules: Record<string, { items: Record<string, boolean> }>;
};

function keyForCourse(courseId: string) {
  return `canvasClone:progress:${courseId}`;
}

export function loadProgress(courseId: string): ProgressState {
  try {
    const raw = window.localStorage.getItem(keyForCourse(courseId));
    if (!raw) return { modules: {} };
    const parsed = JSON.parse(raw) as ProgressState;
    return parsed && typeof parsed === "object" && parsed.modules
      ? parsed
      : { modules: {} };
  } catch {
    return { modules: {} };
  }
}

export function saveProgress(courseId: string, state: ProgressState) {
  try {
    window.localStorage.setItem(keyForCourse(courseId), JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save progress", err);
  }
}

export function getItemCompleted(
  progress: ProgressState,
  moduleTitle: string,
  itemLabel: string,
) {
  return !!progress.modules?.[moduleTitle]?.items?.[itemLabel];
}

export function setItemCompleted(
  progress: ProgressState,
  moduleTitle: string,
  itemLabel: string,
  completed: boolean,
): ProgressState {
  const next: ProgressState = { modules: { ...progress.modules } };
  const mod = next.modules[moduleTitle] ?? { items: {} };
  next.modules[moduleTitle] = {
    items: { ...mod.items, [itemLabel]: completed },
  };
  return next;
}

export function clearItem(
  progress: ProgressState,
  moduleTitle: string,
  itemLabel: string,
) {
  const cur = progress.modules[moduleTitle];
  if (!cur) return progress;
  const items = { ...cur.items };
  delete items[itemLabel];
  return { modules: { ...progress.modules, [moduleTitle]: { items } } };
}

export function clearModule(progress: ProgressState, moduleTitle: string) {
  if (!progress.modules[moduleTitle]) return progress;
  const next = { ...progress.modules };
  delete next[moduleTitle];
  return { modules: next };
}

export function renameModule(
  progress: ProgressState,
  oldTitle: string,
  newTitle: string,
) {
  if (!progress.modules[oldTitle]) return progress;
  const next = { ...progress.modules };
  next[newTitle] = next[oldTitle];
  delete next[oldTitle];
  return { modules: next };
}

export function renameItem(
  progress: ProgressState,
  moduleTitle: string,
  oldLabel: string,
  newLabel: string,
) {
  const mod = progress.modules[moduleTitle];
  if (!mod?.items) return clearItem(progress, moduleTitle, oldLabel);

  // ✅ FIX: check key existence, not truthiness
  if (!(oldLabel in mod.items))
    return clearItem(progress, moduleTitle, oldLabel);

  const items = { ...mod.items };
  items[newLabel] = items[oldLabel];
  delete items[oldLabel];
  return { modules: { ...progress.modules, [moduleTitle]: { items } } };
}

export function getRequiredItemLabels(module: ModuleT): string[] {
  // Requirement type doesn't change "required-ness" yet; only completion method.
  return module.items
    .filter((it) => it.type !== "section")
    .map((it) => it.label);
}

export function getModuleCompletion(module: ModuleT, progress: ProgressState) {
  const req = getRequiredItemLabels(module);
  const total = req.length;
  const done = req.reduce(
    (acc, label) =>
      acc + (getItemCompleted(progress, module.title, label) ? 1 : 0),
    0,
  );
  return {
    completedCount: done,
    totalCount: total,
    isComplete: total === 0 ? true : done === total,
  };
}

export function isItemUnlocked(
  module: ModuleT,
  mode: ModuleRequirementsMode,
  progress: ProgressState,
  itemLabel: string,
): boolean {
  if (mode !== "sequential") return true;

  const ordered = module.items
    .filter((it) => it.type !== "section")
    .map((it) => it.label);

  const idx = ordered.indexOf(itemLabel);
  if (idx < 0) return true;

  const firstIncompleteIdx = ordered.findIndex(
    (label) => !getItemCompleted(progress, module.title, label),
  );

  if (firstIncompleteIdx < 0) return true;

  return idx <= firstIncompleteIdx;
}

export function isModuleGated(mode: ModuleRequirementsMode) {
  return mode !== "none";
}
