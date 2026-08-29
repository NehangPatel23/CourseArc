import { allDemoSeedBankIds } from "../data/demoBanks/catalog";
import { buildDemoQuestionBanks, DEMO_QUESTION_BANKS_REVISION } from "../data/demoQuestionBanks";
import {
  DEFAULT_BANK_META,
  hasExplicitBankMeta,
  inferBankMetaFromContent,
  mergeBankMeta,
  normalizeBankMeta,
  type BankAudience,
  type BankDifficulty,
  type BankExamUse,
  type BankStatus,
} from "./bankMeta";
import {
  createQuizQuestion,
  loadQuizzes,
  normalizeQuizBankPool,
  normalizeQuizQuestions,
  type QuizQuestion,
  type QuizQuestionType,
  uid,
} from "./quizzes";

export type QuestionBankSourceRef = {
  courseId: string;
  bankId: string;
  titleAtLink?: string;
};

export type QuestionBank = {
  id: string;
  courseId: string;
  title: string;
  /** Instructor notes about what this bank covers (not shown to students). */
  notes: string;
  audience: BankAudience;
  difficulty: BankDifficulty;
  examUse: BankExamUse;
  status: BankStatus;
  tags: string[];
  questions: QuizQuestion[];
  updatedAt: number;
  createdAt: number;
  /**
   * Read-only alias of a bank in another course. Edits call materializeLinkedBank
   * (copy-on-write) and clear this ref.
   */
  sourceBankRef?: QuestionBankSourceRef;
};

export const QUESTION_BANKS_CHANGED_EVENT = "canvasClone:questionBanksChanged";

/** In-memory assemble cache — seed packs are large and must not be written to localStorage. */
const assembledCache = new Map<string, QuestionBank[]>();

function key(courseId: string) {
  return `canvasClone:questionBanks:${courseId}`;
}

function revisionKey(courseId: string) {
  return `canvasClone:questionBanksRevision:${courseId}`;
}

function overrideKey(courseId: string) {
  return `canvasClone:questionBankSeedOverrides:${courseId}`;
}

function tombstoneKey(courseId: string) {
  return `canvasClone:questionBankRemovedSeeds:${courseId}`;
}

export function questionBankEditorPath(courseId: string, bankId: string): string {
  return `/courses/${encodeURIComponent(courseId)}/question-banks/${encodeURIComponent(bankId)}`;
}

function normalizeBank(courseId: string, b: Partial<QuestionBank>): QuestionBank {
  const meta = hasExplicitBankMeta(b)
    ? normalizeBankMeta(b)
    : inferBankMetaFromContent({
        title: b.title,
        notes: typeof b.notes === "string" ? b.notes : "",
        questions: normalizeQuizQuestions(b.questions),
      });
  return {
    id: b.id ?? uid("qb"),
    courseId,
    title: b.title ?? "Untitled bank",
    notes: typeof b.notes === "string" ? b.notes : "",
    ...meta,
    questions: normalizeQuizQuestions(b.questions),
    updatedAt: b.updatedAt ?? Date.now(),
    createdAt: b.createdAt ?? Date.now(),
    ...(b.sourceBankRef
      ? {
          sourceBankRef: {
            courseId: b.sourceBankRef.courseId,
            bankId: b.sourceBankRef.bankId,
            titleAtLink: b.sourceBankRef.titleAtLink,
          },
        }
      : {}),
  };
}

function readAll(courseId: string): QuestionBank[] {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((b: Partial<QuestionBank>) => normalizeBank(courseId, b));
  } catch {
    return [];
  }
}

function readIdSet(storageKey: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeIdSet(storageKey: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch {}
}

function readOverrideIds(courseId: string): Set<string> {
  return readIdSet(overrideKey(courseId));
}

function readTombstones(courseId: string): Set<string> {
  return readIdSet(tombstoneKey(courseId));
}

/**
 * Persist instructor banks only. Bundled seed packs (~6MB) exceed typical
 * localStorage quotas; writing them makes new banks appear in the list (from
 * memory) but vanish when the editor reads storage — clicks look like no-ops.
 */
function writeAll(courseId: string, banks: QuestionBank[]) {
  const seedIds = allDemoSeedBankIds(courseId);
  const overrides = readOverrideIds(courseId);
  const payload = banks.filter((b) => !seedIds.has(b.id) || overrides.has(b.id));
  assembledCache.delete(courseId);
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(payload));
  } catch (err) {
    console.warn("Question banks could not be saved (storage full).", err);
  }
  try {
    window.dispatchEvent(new Event(QUESTION_BANKS_CHANGED_EVENT));
  } catch {}
}

function markSeedOverride(courseId: string, bankId: string) {
  if (!allDemoSeedBankIds(courseId).has(bankId)) return;
  const next = readOverrideIds(courseId);
  next.add(bankId);
  writeIdSet(overrideKey(courseId), next);
}

function readRevision(courseId: string): number {
  try {
    return Number(window.localStorage.getItem(revisionKey(courseId))) || 0;
  } catch {
    return 0;
  }
}

function writeRevision(courseId: string) {
  try {
    window.localStorage.setItem(revisionKey(courseId), String(DEMO_QUESTION_BANKS_REVISION));
  } catch {}
}

function assembleQuestionBanks(courseId: string): QuestionBank[] {
  const seedIds = allDemoSeedBankIds(courseId);
  const stored = readAll(courseId);
  const storedById = new Map(stored.map((b) => [b.id, b]));
  const overrides = readOverrideIds(courseId);
  const tombstones = readTombstones(courseId);

  const seeds = buildDemoQuestionBanks(courseId)
    .filter((s) => !tombstones.has(s.id))
    .map((s) => {
      if (overrides.has(s.id) && storedById.has(s.id)) return storedById.get(s.id)!;
      return s;
    });

  const custom = stored.filter((b) => !seedIds.has(b.id));
  return [...seeds, ...custom];
}

function migrateSeedStorageIfNeeded(courseId: string) {
  if (readRevision(courseId) === DEMO_QUESTION_BANKS_REVISION) return;
  writeIdSet(overrideKey(courseId), new Set());
  writeIdSet(tombstoneKey(courseId), new Set());
  const customOnly = readAll(courseId).filter((b) => !allDemoSeedBankIds(courseId).has(b.id));
  assembledCache.delete(courseId);
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(customOnly));
  } catch (err) {
    console.warn("Question banks could not be saved (storage full).", err);
  }
  writeRevision(courseId);
}

export function loadQuestionBanks(courseId: string): QuestionBank[] {
  const cached = assembledCache.get(courseId);
  if (cached) return cached;

  let banks: QuestionBank[];
  try {
    migrateSeedStorageIfNeeded(courseId);
    banks = assembleQuestionBanks(courseId);
  } catch {
    banks = buildDemoQuestionBanks(courseId);
  }

  const sorted = banks.sort((a, b) => b.updatedAt - a.updatedAt);
  assembledCache.set(courseId, sorted);
  return sorted;
}

export function getQuestionBank(
  courseId: string,
  bankId: string,
): QuestionBank | undefined {
  return loadQuestionBanks(courseId).find((b) => b.id === bankId);
}

export function createQuestionBank(courseId: string, title: string): QuestionBank {
  const now = Date.now();
  const bank: QuestionBank = {
    id: uid("qb"),
    courseId,
    title: title.trim() || "Untitled bank",
    notes: "",
    ...DEFAULT_BANK_META,
    tags: [],
    questions: [],
    createdAt: now,
    updatedAt: now,
  };
  writeAll(courseId, [...loadQuestionBanks(courseId), bank]);
  return bank;
}

export function updateQuestionBank(
  courseId: string,
  bankId: string,
  patch: Partial<
    Pick<
      QuestionBank,
      | "title"
      | "notes"
      | "questions"
      | "sourceBankRef"
      | "audience"
      | "difficulty"
      | "examUse"
      | "status"
      | "tags"
    >
  >,
): QuestionBank | undefined {
  const all = [...loadQuestionBanks(courseId)];
  const idx = all.findIndex((b) => b.id === bankId);
  if (idx < 0) return undefined;
  const prev = all[idx]!;
  const metaTouched =
    patch.audience != null ||
    patch.difficulty != null ||
    patch.examUse != null ||
    patch.status != null ||
    patch.tags != null;
  // Editing a linked bank materializes a local copy (copy-on-write).
  const clearingLink =
    prev.sourceBankRef &&
    (patch.questions != null ||
      patch.title != null ||
      patch.notes != null ||
      metaTouched ||
      patch.sourceBankRef === undefined);

  const mergedMeta = normalizeBankMeta({
    ...prev,
    ...patch,
  });

  const next: QuestionBank = {
    ...prev,
    ...patch,
    ...mergedMeta,
    questions: patch.questions
      ? normalizeQuizQuestions(patch.questions)
      : prev.questions,
    title: patch.title != null ? patch.title.trim() || prev.title : prev.title,
    notes: patch.notes != null ? patch.notes : prev.notes,
    updatedAt: Date.now(),
  };
  if (clearingLink && patch.sourceBankRef === undefined) {
    delete next.sourceBankRef;
  }
  if (patch.sourceBankRef === null as unknown as undefined) {
    delete next.sourceBankRef;
  }
  all[idx] = next;
  markSeedOverride(courseId, bankId);
  writeAll(courseId, all);
  return next;
}

/** Force copy-on-write: drop sourceBankRef after cloning source questions if still linked. */
export function materializeLinkedBank(
  courseId: string,
  bankId: string,
): QuestionBank | undefined {
  const bank = getQuestionBank(courseId, bankId);
  if (!bank?.sourceBankRef) return bank;
  const source = getQuestionBank(bank.sourceBankRef.courseId, bank.sourceBankRef.bankId);
  const questions = source
    ? normalizeQuizQuestions(source.questions).map(remapQuestion)
    : bank.questions;
  return updateQuestionBank(courseId, bankId, {
    questions,
    sourceBankRef: undefined,
  });
}

function remapQuestion(q: QuizQuestion): QuizQuestion {
  return {
    ...q,
    id: uid("qq"),
    codeTests: q.codeTests?.map((t) => ({ ...t, id: uid("ct") })),
    groupQuestions: q.groupQuestions?.map(remapQuestion),
    matchingPairs: q.matchingPairs?.map((p) => ({ ...p, id: uid("mp") })),
  };
}

/** Merge multiple banks into a new bank (questions remapped). */
export function mergeQuestionBanks(
  courseId: string,
  bankIds: string[],
  title: string,
): QuestionBank | undefined {
  const unique = [...new Set(bankIds)];
  if (unique.length < 2) return undefined;
  const sources = unique
    .map((id) => getQuestionBank(courseId, id))
    .filter(Boolean) as QuestionBank[];
  if (sources.length < 2) return undefined;
  const questions = sources.flatMap((b) =>
    normalizeQuizQuestions(b.questions).map(remapQuestion),
  );
  const now = Date.now();
  const bank: QuestionBank = {
    id: uid("qb"),
    courseId,
    title: title.trim() || `Merged: ${sources.map((s) => s.title).join(" + ")}`,
    notes: sources
      .map((s) => s.notes.trim())
      .filter(Boolean)
      .join("\n\n"),
    ...mergeBankMeta(sources),
    questions,
    createdAt: now,
    updatedAt: now,
  };
  writeAll(courseId, [bank, ...readAll(courseId)]);
  return bank;
}

/**
 * Create a linked alias in another course (read-only until edited).
 * Does not deep-copy questions until materializeLinkedBank / edit.
 */
export function linkQuestionBankToCourse(
  bank: QuestionBank,
  targetCourseId: string,
): QuestionBank {
  const now = Date.now();
  const link: QuestionBank = {
    id: uid("qb"),
    courseId: targetCourseId,
    title: bank.title,
    notes: bank.notes ?? "",
    audience: bank.audience,
    difficulty: bank.difficulty,
    examUse: bank.examUse,
    status: bank.status,
    tags: [...(bank.tags ?? [])],
    questions: [],
    createdAt: now,
    updatedAt: now,
    sourceBankRef: {
      courseId: bank.courseId,
      bankId: bank.id,
      titleAtLink: bank.title,
    },
  };
  const existing = loadQuestionBanks(targetCourseId);
  writeAll(targetCourseId, [link, ...existing]);
  return link;
}

/** Resolve questions for a bank, following sourceBankRef when linked. */
export function resolveBankQuestions(bank: QuestionBank): QuizQuestion[] {
  if (!bank.sourceBankRef) return bank.questions;
  const source = getQuestionBank(bank.sourceBankRef.courseId, bank.sourceBankRef.bankId);
  return source?.questions ?? bank.questions;
}

export type BankUsageRow = {
  bankId: string;
  bankTitle: string;
  quizId: string;
  quizTitle: string;
  pickCount: number;
};

/** Which quizzes in this course reference each bank via bankPool. */
export function buildBankUsageReport(courseId: string): BankUsageRow[] {
  const banks = loadQuestionBanks(courseId);
  const byId = new Map(banks.map((b) => [b.id, b]));
  const rows: BankUsageRow[] = [];
  for (const quiz of loadQuizzes(courseId)) {
    const pool = normalizeQuizBankPool(quiz.bankPool);
    if (!pool) continue;
    for (const src of pool.sources) {
      const bank = byId.get(src.bankId);
      rows.push({
        bankId: src.bankId,
        bankTitle: bank?.title ?? "(missing bank)",
        quizId: quiz.id,
        quizTitle: quiz.title,
        pickCount: src.pickCount,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.bankTitle.localeCompare(b.bankTitle) || a.quizTitle.localeCompare(b.quizTitle),
  );
}

export function deleteQuestionBank(courseId: string, bankId: string) {
  if (allDemoSeedBankIds(courseId).has(bankId)) {
    const removed = readTombstones(courseId);
    removed.add(bankId);
    writeIdSet(tombstoneKey(courseId), removed);
    const overrides = readOverrideIds(courseId);
    if (overrides.delete(bankId)) writeIdSet(overrideKey(courseId), overrides);
  }
  writeAll(
    courseId,
    loadQuestionBanks(courseId).filter((b) => b.id !== bankId),
  );
}

export function addBlankQuestionToBank(
  courseId: string,
  bankId: string,
  type: QuizQuestionType = "multiple_choice",
): QuestionBank | undefined {
  const bank = getQuestionBank(courseId, bankId);
  if (!bank) return undefined;
  return updateQuestionBank(courseId, bankId, {
    questions: [...bank.questions, createQuizQuestion(type)],
  });
}

/** Deterministic full-array shuffle (Fisher–Yates) for stable per-attempt order. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  if (items.length <= 1) return [...items];
  const arr = [...items];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Deterministic shuffle for stable per-attempt bank picks. */
export function seededPickIds(ids: string[], count: number, seed: string): string[] {
  if (ids.length === 0 || count <= 0) return [];
  return seededShuffle(ids, seed).slice(0, Math.min(count, ids.length));
}

export function getBankQuestionsByIds(
  courseId: string,
  bankId: string,
  questionIds: string[],
): QuizQuestion[] {
  const bank = getQuestionBank(courseId, bankId);
  if (!bank) return [];
  const map = new Map(bank.questions.map((q) => [q.id, q]));
  return questionIds.map((id) => map.get(id)).filter(Boolean) as QuizQuestion[];
}

/** Resolve question ids from any of the given banks (first match wins). */
export function getQuestionsAcrossBanks(
  courseId: string,
  bankIds: string[],
  questionIds: string[],
): QuizQuestion[] {
  const lookup = new Map<string, QuizQuestion>();
  for (const bankId of bankIds) {
    const bank = getQuestionBank(courseId, bankId);
    if (!bank) continue;
    for (const q of bank.questions) {
      if (!lookup.has(q.id)) lookup.set(q.id, q);
    }
  }
  return questionIds.map((id) => lookup.get(id)).filter(Boolean) as QuizQuestion[];
}

/** Deep-copy a bank with new ids into another course. */
export function copyQuestionBankToCourse(
  bank: QuestionBank,
  targetCourseId: string,
): QuestionBank {
  const now = Date.now();
  const remap = (q: QuizQuestion): QuizQuestion => ({
    ...q,
    id: uid("qq"),
    codeTests: q.codeTests?.map((t) => ({ ...t, id: uid("ct") })),
    groupQuestions: q.groupQuestions?.map(remap),
    matchingPairs: q.matchingPairs?.map((p) => ({ ...p, id: uid("mp") })),
  });
  const copy: QuestionBank = {
    id: uid("qb"),
    courseId: targetCourseId,
    title: `${bank.title} (copy)`,
    notes: bank.notes ?? "",
    audience: bank.audience,
    difficulty: bank.difficulty,
    examUse: bank.examUse,
    status: "draft",
    tags: [...(bank.tags ?? [])],
    questions: normalizeQuizQuestions(resolveBankQuestions(bank)).map(remap),
    createdAt: now,
    updatedAt: now,
  };
  const existing = loadQuestionBanks(targetCourseId);
  writeAll(targetCourseId, [copy, ...existing]);
  return copy;
}

export type BankQuestionHit = {
  bankId: string;
  bankTitle: string;
  question: QuizQuestion;
};

export function searchQuestionsInBanks(
  courseId: string,
  query: string,
): BankQuestionHit[] {
  const q = query.trim().toLowerCase();
  const hits: BankQuestionHit[] = [];
  for (const bank of loadQuestionBanks(courseId)) {
    for (const question of resolveBankQuestions(bank)) {
      const hay = `${question.prompt ?? ""} ${question.tags?.join(" ") ?? ""}`.toLowerCase();
      if (!q || hay.includes(q)) {
        hits.push({ bankId: bank.id, bankTitle: bank.title, question });
      }
    }
  }
  return hits.slice(0, 80);
}

export function moveQuestionToBank(
  courseId: string,
  fromBankId: string,
  toBankId: string,
  questionId: string,
): boolean {
  if (fromBankId === toBankId) return false;
  const from = getQuestionBank(courseId, fromBankId);
  const to = getQuestionBank(courseId, toBankId);
  if (!from || !to) return false;
  const q = from.questions.find((item) => item.id === questionId);
  if (!q) return false;
  updateQuestionBank(courseId, fromBankId, {
    questions: from.questions.filter((item) => item.id !== questionId),
  });
  updateQuestionBank(courseId, toBankId, {
    questions: [...to.questions, { ...q, id: uid("qq") }],
  });
  return true;
}

export function copyQuestionToBank(
  courseId: string,
  fromBankId: string,
  toBankId: string,
  questionId: string,
): boolean {
  const from = getQuestionBank(courseId, fromBankId);
  const to = getQuestionBank(courseId, toBankId);
  if (!from || !to) return false;
  const q = resolveBankQuestions(from).find((item) => item.id === questionId);
  if (!q) return false;
  updateQuestionBank(courseId, toBankId, {
    questions: [...to.questions, { ...q, id: uid("qq") }],
  });
  return true;
}

/**
 * Instructor-authored / overridden banks only (seed packs stay in memory).
 * Used by course packages so exports stay within localStorage quotas.
 */
export function exportStoredQuestionBanks(courseId: string): QuestionBank[] {
  migrateSeedStorageIfNeeded(courseId);
  return readAll(courseId);
}

/** Replace stored banks from a course package (marks seed overrides as needed). */
export function importQuestionBanksFromPackage(
  courseId: string,
  banks: QuestionBank[],
): void {
  const normalized = banks.map((b) =>
    normalizeBank(courseId, { ...b, courseId }),
  );
  for (const bank of normalized) {
    markSeedOverride(courseId, bank.id);
  }
  writeAll(courseId, normalized);
}
