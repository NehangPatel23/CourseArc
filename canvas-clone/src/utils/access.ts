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

function isModuleTimeLocked(m: ModuleT, now = Date.now()) {
  const unlockAt = (m as any).unlockAt as string | undefined;
  if (!unlockAt) return false;

  const t = Date.parse(unlockAt);
  if (Number.isNaN(t)) return false; // if bad date, fail-open
  return now < t;
}

/**
 * Computes "prereq-style" locking between modules.
 * NOTE: This does NOT include time locks; time locks are enforced separately at access time.
 */
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
 * Finds ALL module items that correspond to a pageId, and determines if locked in student view.
 * Rule: if the page exists in multiple modules, it is accessible if ANY occurrence is accessible.
 */
export function isPageLockedInStudentView(
  modules: ModuleT[],
  progress: any,
  pageId: string,
) {
  const modLocked = buildModuleLockedMap(modules, progress);
  const now = Date.now();

  let found = false;
  let lockedEverywhere = true;

  for (const m of modules) {
    const matches = (m.items as any[]).filter(
      (x) => x?.type === "page" && x?.pageId === pageId,
    );

    if (matches.length === 0) continue;

    found = true;

    // module-level locks (prereq chain) OR time lock => this occurrence is not accessible
    const moduleLocked =
      (modLocked.get(m.title) ?? false) || isModuleTimeLocked(m, now);
    if (moduleLocked) {
      continue;
    }

    const mode = (m.requirementsMode ?? "none") as ModuleRequirementsMode;
    if (mode === "none") {
      // module is unlocked and not gated => accessible
      return false;
    }

    // Any matching item unlocked => accessible
    for (const it of matches) {
      if (isItemUnlocked(m, mode, progress, it.label)) {
        return false;
      }
    }

    // module unlocked but items still locked => this module does not grant access
    // keep scanning other modules
  }

  // if not in any module, treat as accessible
  if (!found) return false;

  // found occurrences, and none granted access
  return lockedEverywhere;
}

/**
 * Same logic, but for fileId.
 * Rule: accessible if ANY occurrence is accessible.
 */
export function isFileLockedInStudentView(
  modules: ModuleT[],
  progress: any,
  fileId: string,
) {
  const modLocked = buildModuleLockedMap(modules, progress);
  const now = Date.now();

  let found = false;
  let lockedEverywhere = true;

  for (const m of modules) {
    const matches = (m.items as any[]).filter(
      (x) => x?.type === "file" && x?.fileId === fileId,
    );

    if (matches.length === 0) continue;

    found = true;

    const moduleLocked =
      (modLocked.get(m.title) ?? false) || isModuleTimeLocked(m, now);
    if (moduleLocked) {
      continue;
    }

    const mode = (m.requirementsMode ?? "none") as ModuleRequirementsMode;
    if (mode === "none") {
      return false;
    }

    for (const it of matches) {
      if (isItemUnlocked(m, mode, progress, it.label)) {
        return false;
      }
    }
  }

  if (!found) return false;
  return lockedEverywhere;
}
