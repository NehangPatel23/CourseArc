// src/utils/access.ts
import type { ModuleT, ModuleRequirementsMode } from "./modules";
import { getModuleCompletion, isItemUnlocked, isModuleGated } from "./progress";

function isModuleConsideredComplete(
  _modules: ModuleT[],
  progress: any,
  m: ModuleT,
) {
  const mode = (m.requirementsMode ?? "none") as ModuleRequirementsMode;
  if (!isModuleGated(mode)) return true;
  return getModuleCompletion(m, progress)?.isComplete ?? true;
}

export function buildModuleLockedMap(modules: ModuleT[], progress: any) {
  const locked = new Map<string, boolean>();
  let gatedIncompleteSeen = false;

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    const accessRule = (m as any).accessRule ?? "default";

    let isLocked = false;

    if (accessRule === "ignore") {
      isLocked = false;
    } else if (accessRule === "module_number") {
      const n = Math.max(1, Math.floor((m as any).prereqModuleNumber ?? 1));
      const prereqIdx = n - 1;
      const prereq = modules[prereqIdx];
      if (prereq)
        isLocked = !isModuleConsideredComplete(modules, progress, prereq);
      else isLocked = false;
    } else {
      isLocked = gatedIncompleteSeen;
    }

    locked.set(m.title, isLocked);

    const mode = (m.requirementsMode ?? "none") as ModuleRequirementsMode;
    const gated = isModuleGated(mode);
    const complete = isModuleConsideredComplete(modules, progress, m);
    if (gated && !complete) gatedIncompleteSeen = true;
  }

  return locked;
}

/**
 * Finds the module item that corresponds to a pageId, and determines if locked in student view.
 */
export function isPageLockedInStudentView(
  modules: ModuleT[],
  progress: any,
  pageId: string,
) {
  const modLocked = buildModuleLockedMap(modules, progress);

  for (const m of modules) {
    const it = (m.items as any[]).find(
      (x) => x?.type === "page" && x?.pageId === pageId,
    );
    if (!it) continue;

    const mode = (m.requirementsMode ?? "none") as ModuleRequirementsMode;
    const moduleLocked = modLocked.get(m.title) ?? false;
    if (moduleLocked) return true;
    if (mode === "none") return false;

    return !isItemUnlocked(m, mode, progress, it.label);
  }

  // if not in any module, treat as accessible
  return false;
}

/**
 * Same, but for fileId.
 */
export function isFileLockedInStudentView(
  modules: ModuleT[],
  progress: any,
  fileId: string,
) {
  const modLocked = buildModuleLockedMap(modules, progress);

  for (const m of modules) {
    const it = (m.items as any[]).find(
      (x) => x?.type === "file" && x?.fileId === fileId,
    );
    if (!it) continue;

    const mode = (m.requirementsMode ?? "none") as ModuleRequirementsMode;
    const moduleLocked = modLocked.get(m.title) ?? false;
    if (moduleLocked) return true;
    if (mode === "none") return false;

    return !isItemUnlocked(m, mode, progress, it.label);
  }

  return false;
}
