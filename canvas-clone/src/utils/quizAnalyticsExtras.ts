/**
 * Extra quiz analytics for Phase 5: Cronbach α, attention list, leave chronology,
 * time histograms, distractor depth, week cohorts, bank-source breakdown.
 */

import { getQuestionBank, loadQuestionBanks } from "./questionBanks";
import {
  formatDurationMs,
  getAttemptEffectiveScore,
  hasAnswer,
  isAnswerCorrect,
  type DetailedQuizStatistics,
  type QuizAttempt,
} from "./quizSubmissions";
import type { Quiz, QuizQuestion } from "./quizzes";
import { flattenQuizQuestionItems, normalizeQuizQuestions } from "./quizzes";

function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Cronbach’s alpha on dichotomous item scores (correct = 1) across attempts.
 * Returns null when fewer than 2 items or 2 attempts.
 */
export function cronbachAlpha(
  quiz: Quiz,
  attempts: QuizAttempt[],
): number | null {
  const questions = flattenQuizQuestionItems(normalizeQuizQuestions(quiz.questions)).filter(
    (q) => q.type !== "note" && q.type !== "group" && q.type !== "essay",
  );
  if (attempts.length < 2 || questions.length < 2) return null;

  const itemScores: number[][] = questions.map((question) =>
    attempts.map((attempt) => {
      const answer = attempt.answers.find((a) => a.questionId === question.id);
      return isAnswerCorrect(question, answer) ? 1 : 0;
    }),
  );

  const k = itemScores.length;
  const itemVars = itemScores.map((col) => populationStdDev(col) ** 2);
  const totals = attempts.map((_, i) =>
    itemScores.reduce((s, col) => s + (col[i] ?? 0), 0),
  );
  const totalVar = populationStdDev(totals) ** 2;
  if (totalVar === 0) return null;
  const sumItemVar = itemVars.reduce((s, v) => s + v, 0);
  const alpha = (k / (k - 1)) * (1 - sumItemVar / totalVar);
  if (!Number.isFinite(alpha)) return null;
  return Math.round(alpha * 1000) / 1000;
}

export type AttentionItem = {
  questionId: string;
  prompt: string;
  medianTimeMs: number;
  correctPercent: number;
  score: number;
};

/** Questions that are both relatively slow and low-correct (attention queue). */
export function buildAttentionList(
  stats: DetailedQuizStatistics,
  limit = 8,
): AttentionItem[] {
  const withTime = stats.questionDetails.filter(
    (q) =>
      q.type !== "note" &&
      q.type !== "group" &&
      typeof q.medianTimeMs === "number" &&
      q.medianTimeMs > 0,
  );
  if (withTime.length === 0) return [];
  const maxTime = Math.max(...withTime.map((q) => q.medianTimeMs!));
  const scored = withTime.map((q) => {
    const slow = maxTime > 0 ? q.medianTimeMs! / maxTime : 0;
    const hard = 1 - q.correctPercent / 100;
    return {
      questionId: q.questionId,
      prompt: q.prompt,
      medianTimeMs: q.medianTimeMs!,
      correctPercent: q.correctPercent,
      score: slow * 0.5 + hard * 0.5,
    };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export type LeaveChronologyBucket = {
  label: string;
  count: number;
  startMs: number;
};

/** Bucket leave events into time-of-day or relative-to-start hour slots. */
export function buildLeaveChronology(
  attempts: QuizAttempt[],
  mode: "hourOfDay" | "minutesIntoAttempt" = "minutesIntoAttempt",
): LeaveChronologyBucket[] {
  if (mode === "hourOfDay") {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      label: `${h}:00`,
      count: 0,
      startMs: h,
    }));
    for (const a of attempts) {
      for (const ts of a.leaveEvents ?? []) {
        const h = new Date(ts).getHours();
        buckets[h]!.count += 1;
      }
    }
    return buckets;
  }

  const edges = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
  const buckets: LeaveChronologyBucket[] = edges.map((start, i) => {
    const end = edges[i + 1];
    return {
      label: end != null ? `${start}–${end}m` : `${start}m+`,
      count: 0,
      startMs: start * 60_000,
    };
  });
  for (const a of attempts) {
    const start = a.startedAt ?? a.submittedAt;
    for (const ts of a.leaveEvents ?? []) {
      const mins = Math.max(0, (ts - start) / 60_000);
      let idx = buckets.length - 1;
      for (let i = 0; i < edges.length - 1; i++) {
        if (mins < edges[i + 1]!) {
          idx = i;
          break;
        }
      }
      buckets[idx]!.count += 1;
    }
  }
  return buckets;
}

export type TimeHistogramBucket = { label: string; count: number };

export function buildQuestionTimeHistogram(
  attempts: QuizAttempt[],
  questionId: string,
): TimeHistogramBucket[] {
  const samples: number[] = [];
  for (const a of attempts) {
    const t = a.questionTimeMs?.[questionId];
    if (typeof t === "number" && t > 0) samples.push(t);
  }
  if (samples.length === 0) return [];
  const edgesSec = [0, 15, 30, 60, 120, 300, 600, 1200];
  const buckets: TimeHistogramBucket[] = edgesSec.map((start, i) => {
    const end = edgesSec[i + 1];
    return {
      label:
        end != null
          ? `${formatDurationMs(start * 1000)}–${formatDurationMs(end * 1000)}`
          : `${formatDurationMs(start * 1000)}+`,
      count: 0,
    };
  });
  for (const ms of samples) {
    const sec = ms / 1000;
    let idx = buckets.length - 1;
    for (let i = 0; i < edgesSec.length - 1; i++) {
      if (sec < edgesSec[i + 1]!) {
        idx = i;
        break;
      }
    }
    buckets[idx]!.count += 1;
  }
  return buckets;
}

export type DistractorDepthStat = {
  label: string;
  count: number;
  percent: number;
  isCorrect: boolean;
  /** Point-biserial of choosing this option vs total score. */
  discrimination: number | null;
  highGroupPct: number;
  lowGroupPct: number;
};

function pointBiserial(binary: number[], continuous: number[]): number | null {
  if (binary.length < 3 || binary.length !== continuous.length) return null;
  const n1 = binary.filter((v) => v === 1).length;
  const n0 = binary.length - n1;
  if (n1 === 0 || n0 === 0) return null;
  const mean1 =
    continuous.filter((_, i) => binary[i] === 1).reduce((s, v) => s + v, 0) / n1;
  const mean0 =
    continuous.filter((_, i) => binary[i] === 0).reduce((s, v) => s + v, 0) / n0;
  const std = populationStdDev(continuous);
  if (std === 0) return null;
  return ((mean1 - mean0) / std) * Math.sqrt((n1 * n0) / binary.length ** 2);
}

/** Deeper MC distractor analysis for one multiple-choice question. */
export function analyzeMcDistractors(
  question: QuizQuestion,
  attempts: QuizAttempt[],
): DistractorDepthStat[] {
  if (question.type !== "multiple_choice") return [];
  const choices = question.choices ?? [];
  if (choices.length === 0 || attempts.length === 0) return [];

  const scores = attempts.map((a) => getAttemptEffectiveScore(a));
  const order = scores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s);
  const topN = Math.max(1, Math.ceil(attempts.length * 0.27));
  const highIdx = new Set(order.slice(0, topN).map((x) => x.i));
  const lowIdx = new Set(order.slice(-topN).map((x) => x.i));

  return choices.map((choice, index) => {
    const binary = attempts.map((attempt) => {
      const answer = attempt.answers.find((a) => a.questionId === question.id);
      return answer?.choiceIndex === index ? 1 : 0;
    });
    const count = binary.reduce<number>((s, v) => s + v, 0);
    const highPick = [...highIdx].filter((i) => binary[i] === 1).length;
    const lowPick = [...lowIdx].filter((i) => binary[i] === 1).length;
    return {
      label: choice,
      count,
      percent: Math.round((count / attempts.length) * 100),
      isCorrect: question.correctChoiceIndex === index,
      discrimination: pointBiserial(binary, scores),
      highGroupPct: Math.round((highPick / topN) * 100),
      lowGroupPct: Math.round((lowPick / topN) * 100),
    };
  });
}

export type CohortStat = {
  id: string;
  label: string;
  attemptCount: number;
  averagePercent: number;
  averageScore: number;
};

/** Compare attempt week buckets (Mon–Sun ISO week of submit). */
export function compareAttemptWeekCohorts(attempts: QuizAttempt[]): CohortStat[] {
  const map = new Map<string, QuizAttempt[]>();
  for (const a of attempts) {
    const d = new Date(a.submittedAt);
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const id = `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    const list = map.get(id) ?? [];
    list.push(a);
    map.set(id, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, rows]) => {
      const avg =
        rows.reduce((s, r) => s + getAttemptEffectiveScore(r), 0) / rows.length;
      const max = rows[0]?.maxScore || 1;
      return {
        id,
        label: id,
        attemptCount: rows.length,
        averageScore: Math.round(avg * 100) / 100,
        averagePercent: Math.round((avg / max) * 100),
      };
    });
}

/** Split by whether a seat number was collected. */
export function compareSeatCohorts(attempts: QuizAttempt[]): CohortStat[] {
  const withSeat = attempts.filter((a) => Boolean(a.seatNumber?.trim()));
  const without = attempts.filter((a) => !a.seatNumber?.trim());
  const mk = (id: string, label: string, rows: QuizAttempt[]): CohortStat | null => {
    if (rows.length === 0) return null;
    const avg =
      rows.reduce((s, r) => s + getAttemptEffectiveScore(r), 0) / rows.length;
    const max = rows[0]?.maxScore || 1;
    return {
      id,
      label,
      attemptCount: rows.length,
      averageScore: Math.round(avg * 100) / 100,
      averagePercent: Math.round((avg / max) * 100),
    };
  };
  return [mk("seat", "With seat #", withSeat), mk("noseat", "No seat #", without)].filter(
    Boolean,
  ) as CohortStat[];
}

export type BankSourceStat = {
  bankId: string;
  bankTitle: string;
  questionCount: number;
  averageCorrectPercent: number;
};

/**
 * Aggregate stats by which bank originally owns each question id
 * (when questionIds appear in course banks).
 */
export function statsByBankSource(
  courseId: string,
  stats: DetailedQuizStatistics,
): BankSourceStat[] {
  const banks = loadQuestionBanks(courseId);
  const qToBank = new Map<string, { bankId: string; title: string }>();
  for (const bank of banks) {
    for (const q of bank.questions ?? []) {
      qToBank.set(q.id, { bankId: bank.id, title: bank.title });
    }
  }
  const groups = new Map<
    string,
    { bankId: string; title: string; percents: number[] }
  >();
  for (const detail of stats.questionDetails) {
    const src = qToBank.get(detail.questionId);
    if (!src) continue;
    const g = groups.get(src.bankId) ?? {
      bankId: src.bankId,
      title: src.title,
      percents: [],
    };
    g.percents.push(detail.correctPercent);
    groups.set(src.bankId, g);
  }
  return [...groups.values()].map((g) => ({
    bankId: g.bankId,
    bankTitle: g.title || getQuestionBank(courseId, g.bankId)?.title || g.bankId,
    questionCount: g.percents.length,
    averageCorrectPercent:
      g.percents.length > 0
        ? Math.round(g.percents.reduce((s, p) => s + p, 0) / g.percents.length)
        : 0,
  }));
}

export { hasAnswer };
