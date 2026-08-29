import type { SoftOriginalitySettings, Quiz } from "./quizzes";
import { QUIZ_SCORING_POLICY_LABELS, QUIZ_TYPE_LABELS } from "./quizzes";

const NOISE_KEYS = new Set<keyof Quiz | string>([
  "id",
  "createdAt",
  "updatedAt",
  "questions",
  "questionCount",
  "bankPool",
  "status",
  "published",
]);

const LABELS: Partial<Record<keyof Quiz, string>> = {
  title: "Title",
  quizType: "Quiz type",
  description: "Description",
  dueAt: "Due date",
  points: "Points",
  timeLimitMinutes: "Time limit",
  shuffleAnswers: "Shuffle answers",
  shuffleQuestions: "Shuffle questions",
  accessCode: "Access code",
  accessCodeExpiresAt: "Access code expires",
  oneTimeAccessToken: "One-time access link",
  previewShareKey: "TA preview link key",
  lockOnLeave: "Lock on leave",
  maxLeaveCount: "Auto-submit after leaves",
  warnOnLeave: "Warn on first leave",
  lockOnBlur: "Also count window blur",
  requireFullscreen: "Require fullscreen",
  idleTimeoutMinutes: "Idle timeout",
  softDisablePaste: "Soft-disable paste",
  monacoEditor: "Monaco code editor",
  softOriginality: "Soft originality",
  requireViewAllQuestions: "Require viewing all questions",
  collectSeatNumber: "Collect seat number",
  requireSeatNumber: "Require seat number",
  allowMultipleAttempts: "Multiple attempts",
  allowedAttempts: "Allowed attempts",
  scoringPolicy: "Scoring policy",
  partialCredit: "Partial credit",
  partialCreditPenalty: "Partial-credit penalty",
  nearMatchThreshold: "Near-match threshold",
  guessingPenalty: "Guessing penalty",
  requireEssayComment: "Require essay reflection",
  anonymousGrading: "Anonymous grading",
  hideScoreUntilGraded: "Hide score until graded",
  oneQuestionAtATime: "One question at a time",
  lockPreviousQuestions: "Lock previous questions",
  letStudentsSeeResponses: "Show responses to students",
  showResponsesOnlyOnce: "Show responses only once",
  showCorrectAnswers: "Show correct answers",
  showCorrectAnswersAt: "Show correct answers at",
  hideCorrectAnswersAt: "Hide correct answers at",
  publishAt: "Scheduled publish",
  unpublishAt: "Scheduled unpublish",
  availableFrom: "Available from",
  availableUntil: "Available until",
  practiceInstantFeedback: "Practice instant feedback",
  practiceRetakeWrongOnly: "Retake wrong only",
  practiceScorePreview: "Score preview before submit",
  requiredModuleItem: "Module prerequisite",
  allowedSections: "Section restrictions",
  groupId: "Assignment group",
};

function truncate(s: string, max = 120): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function formatSoftOriginality(v: SoftOriginalitySettings | undefined | null): string {
  if (v == null) return "—";
  if (v.enabled === false) return "Off";
  const parts = ["On"];
  if (v.includeSelfAttempts !== false) parts.push("own attempts");
  if (v.includeOtherQuizzes) parts.push("other quizzes");
  if (v.normalizeCode !== false) parts.push("normalize code");
  if (typeof v.minMatchPercent === "number") parts.push(`min ${v.minMatchPercent}%`);
  return parts.join(" · ");
}

function formatMonaco(v: unknown): string {
  if (v === true) return "Always Monaco";
  if (v === false) return "Always plain editor";
  // undefined / null → course default (quiz inherits)
  return "Course default";
}

function fmtVal(key: keyof Quiz, v: unknown): string {
  if (key === "monacoEditor") return formatMonaco(v);
  if (v == null || v === "") return "—";
  if (key === "softOriginality") {
    return formatSoftOriginality(v as SoftOriginalitySettings);
  }
  if (key === "quizType" && typeof v === "string") {
    return QUIZ_TYPE_LABELS[v as keyof typeof QUIZ_TYPE_LABELS] ?? v;
  }
  if (key === "scoringPolicy" && typeof v === "string") {
    return QUIZ_SCORING_POLICY_LABELS[v as keyof typeof QUIZ_SCORING_POLICY_LABELS] ?? v;
  }
  if (typeof v === "boolean") return v ? "On" : "Off";
  if (typeof v === "number") {
    if (String(key).toLowerCase().includes("at") || key === "dueAt") {
      return new Date(v).toLocaleString();
    }
    if (key === "guessingPenalty" || key === "nearMatchThreshold") {
      const pct = key === "nearMatchThreshold" && v <= 1 ? Math.round(v * 100) : v;
      return `${pct}%`;
    }
    if (key === "timeLimitMinutes" || key === "idleTimeoutMinutes") return `${v} min`;
    return String(v);
  }
  if (Array.isArray(v)) return v.length ? truncate(v.join(", ")) : "—";
  if (typeof v === "object") return truncate(JSON.stringify(v));
  return truncate(String(v));
}

export type SettingsDiffLine = {
  key: string;
  label: string;
  before: string;
  after: string;
};

/** Human-readable settings diff for save confirmation (#159). */
export function summarizeQuizSettingsDiff(
  before: Quiz | undefined,
  after: Partial<Quiz>,
): SettingsDiffLine[] {
  if (!before) return [];
  // Only keys on the save patch — missing identity fields are not “cleared”.
  const keys = Object.keys(after) as (keyof Quiz)[];
  const lines: SettingsDiffLine[] = [];
  for (const key of keys) {
    if (NOISE_KEYS.has(key)) continue;
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b ?? null) === JSON.stringify(a ?? null)) continue;
    lines.push({
      key: String(key),
      label: LABELS[key] ?? String(key).replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      before: fmtVal(key, b),
      after: fmtVal(key, a),
    });
  }
  return lines.sort((x, y) => x.label.localeCompare(y.label));
}
