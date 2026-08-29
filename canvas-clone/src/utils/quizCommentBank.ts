/**
 * Course-scoped canned feedback / comment bank for quiz GradePro.
 */

import {
  DEMO_COMMENT_BANK_REVISION,
  buildDemoCommentBankEntries,
} from "../data/demoQuizCommentBank";

export type QuizCommentBankEntry = {
  id: string;
  body: string;
  updatedAt: number;
  /** Optional grouping label for GradePro filters. */
  category?: string;
};

const PREFIX = "canvasClone:quizCommentBank:";
const REV_PREFIX = "canvasClone:quizCommentBankRevision:";

function key(courseId: string) {
  return `${PREFIX}${courseId}`;
}

function revKey(courseId: string) {
  return `${REV_PREFIX}${courseId}`;
}

function load(courseId: string): QuizCommentBankEntry[] {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuizCommentBankEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(courseId: string, entries: QuizCommentBankEntry[]) {
  window.localStorage.setItem(key(courseId), JSON.stringify(entries));
}

function readRev(courseId: string): number {
  try {
    return Number(window.localStorage.getItem(revKey(courseId))) || 0;
  } catch {
    return 0;
  }
}

function writeRev(courseId: string) {
  window.localStorage.setItem(revKey(courseId), String(DEMO_COMMENT_BANK_REVISION));
}

/** Ensure demo comments exist; never delete instructor-added (non-seed) entries. */
function ensureDemoComments(courseId: string, existing: QuizCommentBankEntry[]): QuizCommentBankEntry[] {
  const seeds = buildDemoCommentBankEntries(courseId);
  const byId = new Map(existing.map((e) => [e.id, e]));
  let changed = false;
  for (const s of seeds) {
    if (!byId.has(s.id)) {
      byId.set(s.id, s);
      changed = true;
    } else if (readRev(courseId) !== DEMO_COMMENT_BANK_REVISION) {
      // Refresh seed body/category on revision bump only for seed ids.
      byId.set(s.id, { ...s, updatedAt: byId.get(s.id)!.updatedAt });
      changed = true;
    }
  }
  if (readRev(courseId) !== DEMO_COMMENT_BANK_REVISION) {
    writeRev(courseId);
    changed = true;
  }
  const next = [...byId.values()];
  if (changed) save(courseId, next);
  return next;
}

export function listQuizCommentBank(courseId: string): QuizCommentBankEntry[] {
  const existing = load(courseId);
  const merged = ensureDemoComments(courseId, existing);
  return merged.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function addQuizCommentBankEntry(
  courseId: string,
  body: string,
  category?: string,
): QuizCommentBankEntry | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  // Ensure seeds exist first.
  listQuizCommentBank(courseId);
  const entry: QuizCommentBankEntry = {
    id: `qcb_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    body: trimmed,
    updatedAt: Date.now(),
    ...(category?.trim() ? { category: category.trim() } : {}),
  };
  save(courseId, [entry, ...load(courseId)]);
  return entry;
}

export function deleteQuizCommentBankEntry(courseId: string, id: string): void {
  save(
    courseId,
    load(courseId).filter((e) => e.id !== id),
  );
}
