/**
 * Per-course quiz accommodations: extra time and/or extra attempts for a student.
 *
 * Scope:
 * - Per quiz: `quizId` set → applies only to that quiz
 * - Course-wide: `quizId` omitted → applies to every quiz
 *
 * Merge: for each numeric field, the more generous value wins (max).
 * Availability unlock is OR'd. Notes prefer per-quiz, else course-wide.
 *
 * Values persist until cleared by an instructor (not auto-consumed).
 */

export type QuizAccommodation = {
  studentId: string;
  /** When set, scoped to this quiz. When omitted, course-wide for all quizzes. */
  quizId?: string;
  /** Extra minutes added on top of (base × multiplier). */
  extraMinutes?: number;
  /** Extra attempts beyond the quiz's allowed attempt count. */
  extraAttempts?: number;
  /**
   * Multiplier on the quiz's base time limit (e.g. 1.5).
   * Values ≤ 1 are treated as no multiplier.
   */
  timeMultiplier?: number;
  /** Skip available-from / available-until gates for this student. */
  unlockAvailability?: boolean;
  /** Instructor note / reason for the grant. */
  note?: string;
  updatedAt: number;
};

export type EffectiveQuizAccommodation = {
  extraMinutes: number;
  extraAttempts: number;
  /** Always ≥ 1. */
  timeMultiplier: number;
  unlockAvailability: boolean;
  note?: string;
};

/** Course-wide vs per-quiz contributions. */
export type QuizAccommodationBreakdown = {
  courseWide: EffectiveQuizAccommodation;
  perQuiz: EffectiveQuizAccommodation;
  effective: EffectiveQuizAccommodation;
};

export type QuizAccommodationsChangedDetail = {
  courseId: string;
  studentIds: string[];
};

export const QUIZ_ACCOMMODATIONS_CHANGED_EVENT = "canvasClone:quizAccommodationsChanged";

const COURSE_WIDE_KEY = "*";
const STORAGE_KEY_PREFIX = "canvasClone:quizAccommodations:";

function storageKey(courseId: string) {
  return `${STORAGE_KEY_PREFIX}${courseId}`;
}

export function isQuizAccommodationsStorageKey(key: string | null): boolean {
  return typeof key === "string" && key.startsWith(STORAGE_KEY_PREFIX);
}

export function courseIdFromAccommodationsStorageKey(key: string): string | null {
  if (!isQuizAccommodationsStorageKey(key)) return null;
  return key.slice(STORAGE_KEY_PREFIX.length) || null;
}

function entryKey(studentId: string, quizId?: string | null) {
  return `${studentId}::${quizId && quizId.trim() ? quizId : COURSE_WIDE_KEY}`;
}

function loadAll(courseId: string): Record<string, QuizAccommodation> {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, QuizAccommodation>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveAll(
  courseId: string,
  map: Record<string, QuizAccommodation>,
  studentIds: string[] = [],
) {
  try {
    window.localStorage.setItem(storageKey(courseId), JSON.stringify(map));
    const detail: QuizAccommodationsChangedDetail = {
      courseId,
      studentIds: [...new Set(studentIds.filter(Boolean))],
    };
    window.dispatchEvent(
      new CustomEvent<QuizAccommodationsChangedDetail>(QUIZ_ACCOMMODATIONS_CHANGED_EVENT, {
        detail,
      }),
    );
  } catch {}
}

function normalizeMinutes(extraMinutes?: number): number {
  return typeof extraMinutes === "number" && Number.isFinite(extraMinutes)
    ? Math.max(0, Math.floor(extraMinutes))
    : 0;
}

function normalizeAttempts(extraAttempts?: number): number {
  return typeof extraAttempts === "number" && Number.isFinite(extraAttempts)
    ? Math.max(0, Math.floor(extraAttempts))
    : 0;
}

/** Normalize multiplier; returns 1 when unset or invalid. */
export function normalizeTimeMultiplier(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 1) return 1;
  return Math.min(5, Math.round(value * 100) / 100);
}

function fromRow(row?: QuizAccommodation): EffectiveQuizAccommodation {
  const note = row?.note?.trim() ? row.note.trim() : undefined;
  return {
    extraMinutes: normalizeMinutes(row?.extraMinutes),
    extraAttempts: normalizeAttempts(row?.extraAttempts),
    timeMultiplier: normalizeTimeMultiplier(row?.timeMultiplier),
    unlockAvailability: Boolean(row?.unlockAvailability),
    note,
  };
}

function rowIsEmpty(input: {
  extraMinutes: number;
  extraAttempts: number;
  timeMultiplier: number;
  unlockAvailability: boolean;
  note?: string;
}): boolean {
  return (
    input.extraMinutes <= 0 &&
    input.extraAttempts <= 0 &&
    input.timeMultiplier <= 1 &&
    !input.unlockAvailability &&
    !input.note?.trim()
  );
}

function mergeEffective(
  courseWide: EffectiveQuizAccommodation,
  perQuiz: EffectiveQuizAccommodation,
): EffectiveQuizAccommodation {
  return {
    extraMinutes: Math.max(courseWide.extraMinutes, perQuiz.extraMinutes),
    extraAttempts: Math.max(courseWide.extraAttempts, perQuiz.extraAttempts),
    timeMultiplier: Math.max(courseWide.timeMultiplier, perQuiz.timeMultiplier),
    unlockAvailability: courseWide.unlockAvailability || perQuiz.unlockAvailability,
    note: perQuiz.note || courseWide.note,
  };
}

/** List all accommodation rows for a course (course-wide + per-quiz). */
export function listQuizAccommodations(courseId: string): QuizAccommodation[] {
  return Object.values(loadAll(courseId)).sort((a, b) => {
    const quizCmp = (a.quizId ?? "").localeCompare(b.quizId ?? "");
    if (quizCmp !== 0) return quizCmp;
    return a.studentId.localeCompare(b.studentId);
  });
}

/** Accommodations that apply to a specific quiz (includes course-wide rows). */
export function listAccommodationsForQuiz(
  courseId: string,
  quizId: string,
): QuizAccommodation[] {
  return listQuizAccommodations(courseId).filter(
    (a) => !a.quizId || a.quizId === quizId,
  );
}

/** Course-wide rows only (no quizId). */
export function listCourseWideAccommodations(courseId: string): QuizAccommodation[] {
  return listQuizAccommodations(courseId).filter((a) => !a.quizId);
}

export function getQuizAccommodation(
  courseId: string,
  studentId: string,
  quizId?: string | null,
): QuizAccommodation | undefined {
  return loadAll(courseId)[entryKey(studentId, quizId)];
}

export function getQuizAccommodationBreakdown(
  courseId: string,
  studentId: string,
  quizId: string,
): QuizAccommodationBreakdown {
  const all = loadAll(courseId);
  const courseWide = fromRow(all[entryKey(studentId, null)]);
  const perQuiz = fromRow(all[entryKey(studentId, quizId)]);
  return {
    courseWide,
    perQuiz,
    effective: mergeEffective(courseWide, perQuiz),
  };
}

export function getEffectiveQuizAccommodation(
  courseId: string,
  studentId: string,
  quizId: string,
): EffectiveQuizAccommodation {
  return getQuizAccommodationBreakdown(courseId, studentId, quizId).effective;
}

/** True when availability windows are waived for this student on this quiz. */
export function isQuizAvailabilityUnlocked(
  courseId: string,
  studentId: string,
  quizId: string,
): boolean {
  return getEffectiveQuizAccommodation(courseId, studentId, quizId).unlockAvailability;
}

/**
 * Upsert an accommodation. Pass 0 / omit to clear numeric fields.
 * When the row would be empty, it is removed.
 */
export function setQuizAccommodation(
  courseId: string,
  input: {
    studentId: string;
    quizId?: string | null;
    extraMinutes?: number;
    extraAttempts?: number;
    timeMultiplier?: number;
    unlockAvailability?: boolean;
    note?: string;
  },
): void {
  const extraMinutes = normalizeMinutes(input.extraMinutes);
  const extraAttempts = normalizeAttempts(input.extraAttempts);
  const timeMultiplier = normalizeTimeMultiplier(input.timeMultiplier);
  const unlockAvailability = Boolean(input.unlockAvailability);
  const note = input.note?.trim() ? input.note.trim() : undefined;
  const all = loadAll(courseId);
  const key = entryKey(input.studentId, input.quizId);

  if (
    rowIsEmpty({
      extraMinutes,
      extraAttempts,
      timeMultiplier,
      unlockAvailability,
      note,
    })
  ) {
    if (key in all) {
      delete all[key];
      saveAll(courseId, all, [input.studentId]);
    }
    return;
  }

  all[key] = {
    studentId: input.studentId,
    quizId: input.quizId && input.quizId.trim() ? input.quizId.trim() : undefined,
    extraMinutes: extraMinutes > 0 ? extraMinutes : undefined,
    extraAttempts: extraAttempts > 0 ? extraAttempts : undefined,
    timeMultiplier: timeMultiplier > 1 ? timeMultiplier : undefined,
    unlockAvailability: unlockAvailability || undefined,
    note,
    updatedAt: Date.now(),
  };
  saveAll(courseId, all, [input.studentId]);
}

export function clearQuizAccommodation(
  courseId: string,
  studentId: string,
  quizId?: string | null,
): void {
  const all = loadAll(courseId);
  const key = entryKey(studentId, quizId);
  if (key in all) {
    delete all[key];
    saveAll(courseId, all, [studentId]);
  }
}

/** Grant +N attempts on top of whatever is already set for this quiz scope. */
export function grantExtraAttempts(
  courseId: string,
  studentId: string,
  quizId: string,
  amount = 1,
): void {
  const current = getQuizAccommodation(courseId, studentId, quizId);
  const n = Math.max(1, Math.floor(amount));
  setQuizAccommodation(courseId, {
    studentId,
    quizId,
    extraMinutes: current?.extraMinutes ?? 0,
    extraAttempts: (current?.extraAttempts ?? 0) + n,
    timeMultiplier: current?.timeMultiplier,
    unlockAvailability: current?.unlockAvailability,
    note: current?.note,
  });
}

/** Add +N minutes on top of whatever is already set for this quiz scope. */
export function grantExtraMinutes(
  courseId: string,
  studentId: string,
  quizId: string,
  amount: number,
): void {
  const current = getQuizAccommodation(courseId, studentId, quizId);
  const n = Math.max(0, Math.floor(amount));
  if (n <= 0) return;
  setQuizAccommodation(courseId, {
    studentId,
    quizId,
    extraMinutes: (current?.extraMinutes ?? 0) + n,
    extraAttempts: current?.extraAttempts ?? 0,
    timeMultiplier: current?.timeMultiplier,
    unlockAvailability: current?.unlockAvailability,
    note: current?.note,
  });
}

/**
 * Effective time-limit minutes for a student: floor(base × multiplier) + extras.
 * Returns undefined when the quiz has no time limit.
 */
export function getEffectiveTimeLimitMinutes(
  quiz: { id: string; timeLimitMinutes?: number },
  courseId: string,
  studentId: string,
): number | undefined {
  const base = quiz.timeLimitMinutes;
  if (typeof base !== "number" || base <= 0) return undefined;
  const { extraMinutes, timeMultiplier } = getEffectiveQuizAccommodation(
    courseId,
    studentId,
    quiz.id,
  );
  return Math.floor(base * timeMultiplier) + extraMinutes;
}

/** Format a short grant summary for UI. */
export function formatAccommodationGrantParts(acc: EffectiveQuizAccommodation): string {
  const parts: string[] = [];
  if (acc.timeMultiplier > 1) parts.push(`${acc.timeMultiplier}× time`);
  if (acc.extraMinutes > 0) parts.push(`+${acc.extraMinutes} min`);
  if (acc.extraAttempts > 0) {
    parts.push(`+${acc.extraAttempts} attempt${acc.extraAttempts === 1 ? "" : "s"}`);
  }
  if (acc.unlockAvailability) parts.push("availability unlocked");
  return parts.join(" · ") || "none";
}

/** Shared copy for time multiplier vs extra minutes. */
export const ACCOMMODATION_TIME_EXPLAINER =
  "Effective time = floor(quiz limit × multiplier) + extra minutes. Multiplier scales the base limit; extra minutes are added after.";

export type AccommodationsExportPayload = {
  version: 1;
  courseId: string;
  exportedAt: number;
  accommodations: QuizAccommodation[];
};

/** Export all course accommodations as a JSON-serializable payload. */
export function exportAccommodationsPayload(
  courseId: string,
): AccommodationsExportPayload {
  return {
    version: 1,
    courseId,
    exportedAt: Date.now(),
    accommodations: listQuizAccommodations(courseId),
  };
}

/**
 * Import accommodations JSON into a course. Replaces matching student/quiz
 * rows; does not clear unrelated rows unless `replaceAll` is true.
 */
export function importAccommodationsPayload(
  courseId: string,
  raw: unknown,
  opts?: { replaceAll?: boolean },
): { imported: number; error?: string } {
  if (!raw || typeof raw !== "object") {
    return { imported: 0, error: "Invalid JSON: expected an object" };
  }
  const obj = raw as Record<string, unknown>;
  let rows: unknown[] = [];
  if (Array.isArray(obj.accommodations)) rows = obj.accommodations;
  else if (Array.isArray(raw)) rows = raw as unknown[];
  else {
    return {
      imported: 0,
      error: "Expected { accommodations: [...] } or an array of rows",
    };
  }

  if (opts?.replaceAll) {
    const existing = listQuizAccommodations(courseId);
    for (const row of existing) {
      clearQuizAccommodation(courseId, row.studentId, row.quizId);
    }
  }

  let imported = 0;
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<QuizAccommodation>;
    if (!r.studentId || typeof r.studentId !== "string") continue;
    setQuizAccommodation(courseId, {
      studentId: r.studentId,
      quizId: r.quizId,
      extraMinutes: r.extraMinutes ?? 0,
      extraAttempts: r.extraAttempts ?? 0,
      timeMultiplier: r.timeMultiplier ?? 1,
      unlockAvailability: Boolean(r.unlockAvailability),
      note: r.note,
    });
    imported += 1;
  }
  return { imported };
}
