import { loadUser } from "./userStore";

export const AUDIT_LOG_KEY = "canvasClone:auditLog";
export const AUDIT_LOG_CHANGED_EVENT = "canvasClone:auditLogChanged";

export type AuditAction =
  | "quiz_key_changed"
  | "quiz_regrade"
  | "quiz_score_override"
  | "quiz_question_score"
  | "assignment_regrade"
  | "sync_import"
  | "sync_conflict_resolved";

export type AuditEntry = {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  action: AuditAction;
  courseId?: string;
  summary: string;
  detail?: string;
  href?: string;
};

const MAX_ENTRIES = 400;

function uid() {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadAuditLog(): AuditEntry[] {
  try {
    const raw = window.localStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(entries: AuditEntry[]) {
  try {
    window.localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new Event(AUDIT_LOG_CHANGED_EVENT));
  } catch {}
}

export function recordAudit(input: {
  action: AuditAction;
  summary: string;
  detail?: string;
  courseId?: string;
  href?: string;
}): AuditEntry {
  const user = loadUser();
  const entry: AuditEntry = {
    id: uid(),
    at: Date.now(),
    actorId: user.id,
    actorName: user.name,
    action: input.action,
    courseId: input.courseId,
    summary: input.summary,
    detail: input.detail,
    href: input.href,
  };
  persist([entry, ...loadAuditLog()]);
  return entry;
}

/** Prepend seed / demo rows that are not already present (by id). */
export function mergeAuditEntries(incoming: AuditEntry[]) {
  const existing = loadAuditLog();
  const seen = new Set(existing.map((e) => e.id));
  const extra = incoming.filter((e) => !seen.has(e.id));
  if (extra.length === 0) return;
  persist([...extra, ...existing]);
}

export function auditEntriesForCourse(courseId: string): AuditEntry[] {
  return loadAuditLog().filter((e) => !e.courseId || e.courseId === courseId);
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  quiz_key_changed: "Answer key",
  quiz_regrade: "Regrade",
  quiz_score_override: "Score override",
  quiz_question_score: "Question score",
  assignment_regrade: "Assignment grade",
  sync_import: "Device sync",
  sync_conflict_resolved: "Sync conflict",
};
