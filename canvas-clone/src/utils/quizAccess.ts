/**
 * Session-scoped unlock for quiz access codes.
 * Survives refresh within the tab; clears when the tab/session ends.
 * Stores the code that unlocked so a changed code invalidates old unlocks.
 */

/** Ambiguous characters (0/O, 1/I/L) omitted for easier student entry. */
const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function storageKey(courseId: string, quizId: string) {
  return `canvasClone:quizAccess:${courseId}:${quizId}`;
}

/**
 * Generate a short random access code (default 6 chars).
 * Uses crypto.getRandomValues when available.
 */
export function generateQuizAccessCode(length = 6): string {
  const n = Math.max(4, Math.min(12, Math.floor(length)));
  const chars: string[] = [];
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    for (let i = 0; i < n; i++) {
      chars.push(ACCESS_CODE_ALPHABET[buf[i] % ACCESS_CODE_ALPHABET.length]);
    }
  } else {
    for (let i = 0; i < n; i++) {
      chars.push(
        ACCESS_CODE_ALPHABET[Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length)],
      );
    }
  }
  return chars.join("");
}

export function quizRequiresAccessCode(accessCode: string | undefined | null): boolean {
  return Boolean(accessCode && accessCode.trim());
}

/**
 * Whether this quiz is unlocked in the current session for the given code.
 * Pass the quiz's current `accessCode` so a changed code invalidates prior unlocks
 * (including legacy `"1"` session flags from older builds).
 */
export function isQuizAccessUnlocked(
  courseId: string,
  quizId: string,
  expectedCode?: string | null,
): boolean {
  try {
    const stored = window.sessionStorage.getItem(storageKey(courseId, quizId));
    if (!stored) return false;
    if (!quizRequiresAccessCode(expectedCode)) return true;
    return stored === (expectedCode ?? "").trim();
  } catch {
    return false;
  }
}

/** Persist unlock for the code the student entered (must match the quiz code). */
export function unlockQuizAccess(courseId: string, quizId: string, code: string) {
  try {
    window.sessionStorage.setItem(storageKey(courseId, quizId), code.trim());
  } catch {}
}

export function clearQuizAccess(courseId: string, quizId: string) {
  try {
    window.sessionStorage.removeItem(storageKey(courseId, quizId));
  } catch {}
}

/** Case-sensitive trim match against the quiz access code. */
export function verifyQuizAccessCode(
  expected: string | undefined | null,
  entered: string,
): boolean {
  if (!quizRequiresAccessCode(expected)) return true;
  return entered.trim() === (expected ?? "").trim();
}

function oneTimeKey(courseId: string, quizId: string) {
  return `canvasClone:quizOneTime:${courseId}:${quizId}`;
}

/** Whether a one-time access token is still valid (not yet consumed). */
export function isOneTimeTokenValid(
  courseId: string,
  quizId: string,
  token: string | undefined | null,
  expected?: string | null,
): boolean {
  if (!expected || !token) return false;
  if (token.trim() !== expected.trim()) return false;
  try {
    return window.sessionStorage.getItem(oneTimeKey(courseId, quizId)) !== "used";
  } catch {
    return false;
  }
}

/** Mark one-time token consumed for this session. */
export function consumeOneTimeToken(courseId: string, quizId: string) {
  try {
    window.sessionStorage.setItem(oneTimeKey(courseId, quizId), "used");
  } catch {}
}

/** Clear all session unlocks for a quiz (instructor action #93). */
export function clearAllQuizSessionAccess(courseId: string, quizId: string) {
  clearQuizAccess(courseId, quizId);
  try {
    window.sessionStorage.removeItem(oneTimeKey(courseId, quizId));
  } catch {}
}

export function isAccessCodeExpired(expiresAt: number | undefined, now = Date.now()): boolean {
  return typeof expiresAt === "number" && expiresAt > 0 && now > expiresAt;
}

export function generateOneTimeAccessToken(length = 16): string {
  return generateQuizAccessCode(length);
}
