/**
 * Build similarity corpora for quiz GradePro + full originality report pages.
 */

import { graderDisplayName } from "./anonymousGrading";
import {
  findEssaySimilarityPairs,
  parseExcludeText,
  prepareSimilarityText,
  questionIdForAttempt,
  similarityCompareKey,
  summarizeAttemptSimilarity,
  tokenizeForSimilarity,
  type EssaySimilarityPair,
  type SimilarityMatchKind,
  type SimilarityTextRow,
} from "./quizEssaySimilarity";
import { codingAnswerSource, getAttemptsForQuiz, type QuizAttempt } from "./quizSubmissions";
import {
  flattenQuizQuestionItems,
  loadQuizzes,
  quizItemLabel,
  type Quiz,
  type QuizQuestion,
  type SoftOriginalitySettings,
} from "./quizzes";

export const TEXT_SIMILARITY_TYPES: QuizQuestion["type"][] = [
  "essay",
  "coding",
  "short_answer",
  "fill_in_blank",
  "inline_code",
];

export type SimilarityQuestionMeta = {
  id: string;
  label: string;
  type: QuizQuestion["type"];
  compareKey: string;
};

export type QuizSimilarityCorpus = {
  rows: SimilarityTextRow[];
  pairs: EssaySimilarityPair[];
  questionMeta: SimilarityQuestionMeta[];
  /** Display texts (original, not code-normalized) for the report document. */
  textsByAttemptQuestion: Record<string, Record<string, string>>;
  wordCountByAttempt: Record<string, number>;
  settings: ResolvedSoftOriginality;
  /** attemptId → quiz title when corpus spans quizzes */
  attemptQuizTitle: Record<string, string>;
};

export type ResolvedSoftOriginality = {
  enabled: boolean;
  includeSelfAttempts: boolean;
  includeOtherQuizzes: boolean;
  normalizeCode: boolean;
  excludePhrases: string[];
  excludeText: string;
  /** Threshold on combined score 0–1 */
  threshold: number;
  minMatchPercent: number;
};

export function resolveSoftOriginalitySettings(
  quiz?: Pick<Quiz, "softOriginality"> | null,
  overrides?: Partial<SoftOriginalitySettings>,
): ResolvedSoftOriginality {
  const s = { ...(quiz?.softOriginality ?? {}), ...(overrides ?? {}) };
  const minMatchPercent =
    typeof s.minMatchPercent === "number" && Number.isFinite(s.minMatchPercent)
      ? Math.max(0, Math.min(100, s.minMatchPercent))
      : 1;
  return {
    enabled: s.enabled !== false,
    includeSelfAttempts: s.includeSelfAttempts !== false,
    includeOtherQuizzes: Boolean(s.includeOtherQuizzes),
    normalizeCode: s.normalizeCode !== false,
    excludeText: s.excludeText ?? "",
    excludePhrases: parseExcludeText(s.excludeText),
    minMatchPercent,
    threshold: minMatchPercent / 100,
  };
}

export function isTextSimilarityQuestion(q: QuizQuestion): boolean {
  return TEXT_SIMILARITY_TYPES.includes(q.type);
}

function collectTextQuestions(quiz: Quiz): SimilarityQuestionMeta[] {
  const allFlat = flattenQuizQuestionItems(quiz.questions);
  return allFlat.filter(isTextSimilarityQuestion).map((q) => {
    const idx = allFlat.findIndex((x) => x.id === q.id);
    return {
      id: q.id,
      type: q.type,
      label: idx >= 0 ? quizItemLabel(allFlat, idx) : q.prompt.slice(0, 48) || q.id,
      compareKey: similarityCompareKey(q.prompt, q.id),
    };
  });
}

function appendAttemptRows(args: {
  quiz: Quiz;
  attempts: QuizAttempt[];
  questionMeta: SimilarityQuestionMeta[];
  settings: ResolvedSoftOriginality;
  courseId?: string;
  columnKey?: string;
  anonymousEnabled?: boolean;
  rows: SimilarityTextRow[];
  textsByAttemptQuestion: Record<string, Record<string, string>>;
  wordCountByAttempt: Record<string, number>;
  attemptQuizTitle: Record<string, string>;
}) {
  const qById = new Map(
    flattenQuizQuestionItems(args.quiz.questions)
      .filter(isTextSimilarityQuestion)
      .map((q) => [q.id, q]),
  );

  for (const a of args.attempts) {
    args.attemptQuizTitle[a.id] = args.quiz.title;
    args.textsByAttemptQuestion[a.id] = args.textsByAttemptQuestion[a.id] ?? {};
    let words = args.wordCountByAttempt[a.id] ?? 0;
    for (const meta of args.questionMeta) {
      const q = qById.get(meta.id);
      if (!q) continue;
      const ans = a.answers.find((x) => x.questionId === q.id);
      const display =
        q.type === "coding" ? codingAnswerSource(ans) : (ans?.shortAnswer ?? "");
      if (!display.trim()) continue;
      args.textsByAttemptQuestion[a.id]![q.id] = display;
      const prepared = prepareSimilarityText(display, {
        questionType: q.type,
        normalizeCode: args.settings.normalizeCode,
        excludePhrases: args.settings.excludePhrases,
      });
      if (!prepared.trim()) continue;
      words += tokenizeForSimilarity(prepared).length;
      const studentName =
        args.courseId && args.columnKey
          ? graderDisplayName({
              courseId: args.courseId,
              columnKey: args.columnKey,
              studentId: a.studentId,
              realName: a.studentName,
              anonymousEnabled: Boolean(args.anonymousEnabled),
            })
          : a.studentName;
      args.rows.push({
        attemptId: a.id,
        studentName,
        studentId: a.studentId,
        questionId: q.id,
        compareKey: meta.compareKey,
        text: prepared,
        displayText: display,
        questionType: q.type,
        quizId: args.quiz.id,
        quizTitle: args.quiz.title,
        codeNormalized:
          args.settings.normalizeCode &&
          (q.type === "coding" || q.type === "inline_code"),
      });
    }
    args.wordCountByAttempt[a.id] = words;
  }
}

export function buildQuizSimilarityCorpus(
  quiz: Quiz,
  attempts: QuizAttempt[],
  opts?: {
    courseId?: string;
    columnKey?: string;
    anonymousEnabled?: boolean;
    threshold?: number;
    settingsOverride?: Partial<SoftOriginalitySettings>;
  },
): QuizSimilarityCorpus {
  const settings = resolveSoftOriginalitySettings(quiz, {
    ...(opts?.settingsOverride ?? {}),
    ...(typeof opts?.threshold === "number"
      ? { minMatchPercent: Math.round(opts.threshold * 100) }
      : {}),
  });

  const questionMeta = collectTextQuestions(quiz);
  const rows: SimilarityTextRow[] = [];
  const textsByAttemptQuestion: Record<string, Record<string, string>> = {};
  const wordCountByAttempt: Record<string, number> = {};
  const attemptQuizTitle: Record<string, string> = {};

  appendAttemptRows({
    quiz,
    attempts,
    questionMeta,
    settings,
    courseId: opts?.courseId,
    columnKey: opts?.columnKey,
    anonymousEnabled: opts?.anonymousEnabled,
    rows,
    textsByAttemptQuestion,
    wordCountByAttempt,
    attemptQuizTitle,
  });

  if (settings.includeOtherQuizzes && opts?.courseId) {
    for (const other of loadQuizzes(opts.courseId)) {
      if (other.id === quiz.id) continue;
      const otherMeta = collectTextQuestions(other);
      if (otherMeta.length === 0) continue;
      const otherAttempts = getAttemptsForQuiz(opts.courseId, other.id);
      if (otherAttempts.length === 0) continue;
      appendAttemptRows({
        quiz: other,
        attempts: otherAttempts,
        questionMeta: otherMeta,
        settings,
        courseId: opts.courseId,
        columnKey: opts.columnKey,
        anonymousEnabled: opts.anonymousEnabled,
        rows,
        textsByAttemptQuestion,
        wordCountByAttempt,
        attemptQuizTitle,
      });
    }
  }

  const pairs = settings.enabled
    ? findEssaySimilarityPairs(rows, {
        threshold: settings.threshold,
        includeSelfAttempts: settings.includeSelfAttempts,
      })
    : [];

  return {
    rows,
    pairs,
    questionMeta,
    textsByAttemptQuestion,
    wordCountByAttempt,
    settings,
    attemptQuizTitle,
  };
}

/** Match colors cycle (Turnitin-style numbered sources). */
export const MATCH_SOURCE_COLORS = [
  { bg: "bg-red-500", text: "text-red-800", mark: "bg-red-200/90", border: "border-red-300", hex: "#ef4444" },
  { bg: "bg-orange-500", text: "text-orange-800", mark: "bg-orange-200/90", border: "border-orange-300", hex: "#f97316" },
  { bg: "bg-amber-500", text: "text-amber-900", mark: "bg-amber-200/90", border: "border-amber-300", hex: "#f59e0b" },
  { bg: "bg-lime-500", text: "text-lime-900", mark: "bg-lime-200/90", border: "border-lime-300", hex: "#84cc16" },
  { bg: "bg-emerald-500", text: "text-emerald-800", mark: "bg-emerald-200/90", border: "border-emerald-300", hex: "#10b981" },
  { bg: "bg-cyan-500", text: "text-cyan-800", mark: "bg-cyan-200/90", border: "border-cyan-300", hex: "#06b6d4" },
  { bg: "bg-sky-500", text: "text-sky-800", mark: "bg-sky-200/90", border: "border-sky-300", hex: "#0ea5e9" },
  { bg: "bg-indigo-500", text: "text-indigo-800", mark: "bg-indigo-200/90", border: "border-indigo-300", hex: "#6366f1" },
  { bg: "bg-violet-500", text: "text-violet-800", mark: "bg-violet-200/90", border: "border-violet-300", hex: "#8b5cf6" },
  { bg: "bg-fuchsia-500", text: "text-fuchsia-800", mark: "bg-fuchsia-200/90", border: "border-fuchsia-300", hex: "#d946ef" },
] as const;

export type SimilaritySourceCard = {
  sourceIndex: number;
  otherAttemptId: string;
  otherStudentId: string;
  otherStudentName: string;
  matchKind: SimilarityMatchKind;
  crossQuiz: boolean;
  otherQuizTitle?: string;
  /** Max combined similarity across questions (0–1). */
  maxCombined: number;
  pct: number;
  matchCount: number;
  matchingWordEstimate: number;
  pairs: EssaySimilarityPair[];
  questionIds: string[];
};

/** Aggregate pairs for one submission into numbered sources (other students / self). */
export function buildSourcesForAttempt(
  attemptId: string,
  pairs: EssaySimilarityPair[],
): SimilaritySourceCard[] {
  const byOther = new Map<string, EssaySimilarityPair[]>();
  for (const p of pairs) {
    if (p.attemptIdA !== attemptId && p.attemptIdB !== attemptId) continue;
    const otherId = p.attemptIdA === attemptId ? p.attemptIdB : p.attemptIdA;
    const list = byOther.get(otherId) ?? [];
    list.push(p);
    byOther.set(otherId, list);
  }

  const cards: SimilaritySourceCard[] = [];
  let idx = 1;
  for (const [otherAttemptId, list] of byOther) {
    const sample = list[0]!;
    const otherIsA = sample.attemptIdA === otherAttemptId;
    const maxCombined = Math.max(...list.map((x) => x.combined));
    const matchingWordEstimate = list.reduce((s, x) => {
      const phraseWords = x.sharedPhrases.reduce(
        (n, ph) => n + ph.split(/\s+/).filter(Boolean).length,
        0,
      );
      return s + Math.max(x.sharedTokenCount, phraseWords);
    }, 0);
    cards.push({
      sourceIndex: idx,
      otherAttemptId,
      otherStudentId: otherIsA ? sample.studentIdA : sample.studentIdB,
      otherStudentName: otherIsA ? sample.studentNameA : sample.studentNameB,
      matchKind: sample.matchKind,
      crossQuiz: list.some((x) => x.crossQuiz),
      otherQuizTitle: otherIsA ? sample.quizTitleA : sample.quizTitleB,
      maxCombined,
      pct: Math.round(maxCombined * 100),
      matchCount: list.length,
      matchingWordEstimate,
      pairs: list.sort((a, b) => b.combined - a.combined),
      questionIds: [
        ...new Set(list.map((x) => questionIdForAttempt(x, attemptId))),
      ],
    });
    idx += 1;
  }
  return cards.sort((a, b) => b.maxCombined - a.maxCombined);
}

export type ClassSimilarityRow = {
  attempt: QuizAttempt;
  overallPct: number;
  peerPct: number;
  selfPct: number;
  matchCount: number;
  peerMatchCount: number;
  selfMatchCount: number;
  wordCount: number;
  topSourceName?: string;
  topSourcePct?: number;
  topMatchKind?: SimilarityMatchKind;
  snapshotPct?: number;
};

/** Inbox rows: every attempt with a text answer, ranked by similarity. */
export function buildClassSimilarityInbox(
  attempts: QuizAttempt[],
  corpus: QuizSimilarityCorpus,
): ClassSimilarityRow[] {
  const rows: ClassSimilarityRow[] = [];
  for (const attempt of attempts) {
    const hasText = Object.keys(corpus.textsByAttemptQuestion[attempt.id] ?? {}).length > 0;
    if (!hasText) continue;
    const summary = summarizeAttemptSimilarity(attempt.id, corpus.pairs);
    const sources = buildSourcesForAttempt(attempt.id, corpus.pairs);
    const top = sources[0];
    rows.push({
      attempt,
      overallPct: summary.overallPct,
      peerPct: summary.peerPct,
      selfPct: summary.selfPct,
      matchCount: summary.matchCount,
      peerMatchCount: summary.peerMatchCount,
      selfMatchCount: summary.selfMatchCount,
      wordCount: corpus.wordCountByAttempt[attempt.id] ?? 0,
      topSourceName: top?.otherStudentName,
      topSourcePct: top?.pct,
      topMatchKind: top?.matchKind,
      snapshotPct: attempt.softOriginalitySnapshot?.overallPct,
    });
  }
  return rows.sort((a, b) => b.overallPct - a.overallPct || b.attempt.submittedAt - a.attempt.submittedAt);
}

export function estimateSubmissionCoveragePct(
  attemptId: string,
  pairs: EssaySimilarityPair[],
  wordCount: number,
): number {
  if (wordCount <= 0) return 0;
  const sources = buildSourcesForAttempt(attemptId, pairs);
  const matched = sources.reduce((s, c) => s + c.matchingWordEstimate, 0);
  return Math.min(100, Math.round((matched / wordCount) * 100));
}

export type SoftOriginalitySnapshot = {
  overallPct: number;
  peerPct: number;
  selfPct: number;
  matchCount: number;
  peerMatchCount: number;
  selfMatchCount: number;
  computedAt: number;
};

/** Compute a snapshot for an attempt about to be saved (peer corpus = existing attempts). */
export function computeSoftOriginalitySnapshot(
  courseId: string,
  quiz: Quiz,
  draft: {
    studentId: string;
    studentName: string;
    answers: QuizAttempt["answers"];
    questionIds?: string[];
  },
): SoftOriginalitySnapshot | undefined {
  const settings = resolveSoftOriginalitySettings(quiz);
  if (!settings.enabled) return undefined;

  const existing = getAttemptsForQuiz(courseId, quiz.id);
  const tempId = `__draft_${draft.studentId}_${Date.now()}`;
  const fakeAttempt: QuizAttempt = {
    id: tempId,
    quizId: quiz.id,
    studentId: draft.studentId,
    studentName: draft.studentName,
    attemptNumber: existing.length + 1,
    answers: draft.answers,
    score: 0,
    maxScore: 0,
    autoGraded: true,
    submittedAt: Date.now(),
    questionIds: draft.questionIds,
  };
  const corpus = buildQuizSimilarityCorpus(quiz, [...existing, fakeAttempt], {
    courseId,
    columnKey: `quiz:${quiz.id}`,
    anonymousEnabled: Boolean(quiz.anonymousGrading),
  });
  const summary = summarizeAttemptSimilarity(tempId, corpus.pairs);
  return {
    overallPct: summary.overallPct,
    peerPct: summary.peerPct,
    selfPct: summary.selfPct,
    matchCount: summary.matchCount,
    peerMatchCount: summary.peerMatchCount,
    selfMatchCount: summary.selfMatchCount,
    computedAt: Date.now(),
  };
}

export function exportSimilarityInboxCsv(rows: ClassSimilarityRow[]): string {
  const header = [
    "student",
    "attempt",
    "overall_pct",
    "peer_pct",
    "self_pct",
    "matches",
    "peer_matches",
    "self_matches",
    "words",
    "top_match",
    "top_pct",
    "top_kind",
    "submitted_at",
    "snapshot_pct",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.attempt.studentName),
        String(r.attempt.attemptNumber),
        String(r.overallPct),
        String(r.peerPct),
        String(r.selfPct),
        String(r.matchCount),
        String(r.peerMatchCount),
        String(r.selfMatchCount),
        String(r.wordCount),
        csvEscape(r.topSourceName ?? ""),
        String(r.topSourcePct ?? ""),
        r.topMatchKind ?? "",
        new Date(r.attempt.submittedAt).toISOString(),
        r.snapshotPct != null ? String(r.snapshotPct) : "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function exportSimilarityReportJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
