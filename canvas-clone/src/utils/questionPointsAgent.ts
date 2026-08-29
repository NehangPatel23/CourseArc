import type { QuizQuestion, QuizQuestionType } from "./quizzes";
import { isGradedQuizQuestion } from "./quizzes";

/**
 * Points agent: assigns whole-number points from question type + content
 * (recall / concept / application / synthesis).
 */

export type QuestionPointsTier = "recall" | "concept" | "application" | "synthesis";

export type QuestionPointsAssignment = {
  points: number;
  tier: QuestionPointsTier;
  rationale: string;
};

/** Integer bases by type (notes / groups are always 0). */
const TYPE_BASE: Record<QuizQuestionType, number> = {
  note: 0,
  group: 0,
  true_false: 1,
  fill_in_blank: 1,
  fill_in_multiple_blanks: 2,
  short_answer: 1,
  multiple_choice: 2,
  numerical: 2,
  multiple_answers: 3,
  matching: 3,
  ordering: 3,
  calculated: 3,
  likert: 1,
  hotspot: 3,
  inline_code: 3,
  coding: 5,
  essay: 5,
};

const RECALL_PATTERNS =
  /\b(what does .+ stand for|what is the acronym|define|definition|which keyword|name the|true or false|stands for)\b/i;

const CONCEPT_PATTERNS =
  /\b(time complexity|big-?o|complexity of|which .+ (is|are)|best (describes|describes)|primarily|characteristic|requires|guarantees|preferred when|difference between|compared to|why (can|does|do)|explain why|np-complete|optimal substructure|amortized)\b/i;

const APPLICATION_PATTERNS =
  /\b(implement|complete the|write (a |the )?|return the|evaluate|compute|how many|decimal value|use (set|math|hash)|fix|sketch|counterexample|solve|given|algorithm (to|that)|function that)\b/i;

const SYNTHESIS_PATTERNS =
  /\b(design|compare and contrast|trade-?offs?|when would you|pros and cons|critique|analyze|justify|strategy to|in your own words|discuss)\b/i;

function clampPoints(n: number, type: QuizQuestionType): number {
  if (type === "note" || type === "group") return 0;
  return Math.min(8, Math.max(1, Math.round(n)));
}

function promptText(q: Pick<QuizQuestion, "prompt" | "starterCode" | "correctCode">): string {
  return `${q.prompt ?? ""}\n${q.starterCode ?? ""}\n${q.correctCode ?? ""}`;
}

function detectTier(text: string, type: QuizQuestionType): QuestionPointsTier {
  if (type === "note" || type === "group") return "recall";
  if (type === "essay" || SYNTHESIS_PATTERNS.test(text)) return "synthesis";
  if (type === "coding" || type === "inline_code" || APPLICATION_PATTERNS.test(text)) {
    return "application";
  }
  if (RECALL_PATTERNS.test(text) && !CONCEPT_PATTERNS.test(text)) return "recall";
  if (CONCEPT_PATTERNS.test(text) || type === "matching" || type === "multiple_answers") {
    return "concept";
  }
  if (type === "true_false" || type === "fill_in_blank") return "recall";
  return "concept";
}

function tierBonus(tier: QuestionPointsTier): number {
  switch (tier) {
    case "recall":
      return 0;
    case "concept":
      return 1;
    case "application":
      return 2;
    case "synthesis":
      return 3;
  }
}

function structureBonus(q: QuizQuestion): number {
  if (q.type === "note" || q.type === "group") return 0;
  let bonus = 0;
  const text = promptText(q);
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  if (words > 40) bonus += 1;
  if (words > 80) bonus += 1;

  if (q.type === "multiple_answers") {
    bonus += Math.min(2, q.correctChoiceIndices?.length ?? 1);
  }
  if (q.type === "matching") {
    bonus += Math.min(2, Math.floor((q.matchingPairs?.length ?? 0) / 2));
  }
  if (q.type === "coding") {
    const lines = (q.correctCode ?? q.starterCode ?? "").split("\n").length;
    if (lines >= 6) bonus += 1;
    if (lines >= 10) bonus += 1;
  }
  if (q.type === "essay" && /\b(why|explain|compare|counterexample|trade-?off)\b/i.test(text)) {
    bonus += 1;
  }
  return bonus;
}

/**
 * Assign whole-number points for a single question from type + content signals.
 */
export function assignQuestionPoints(question: QuizQuestion): QuestionPointsAssignment {
  if (!isGradedQuizQuestion(question)) {
    return {
      points: 0,
      tier: "recall",
      rationale: question.type === "group" ? "question group · not scored" : "note · not scored",
    };
  }
  const text = promptText(question);
  const tier = detectTier(text, question.type);
  const base = TYPE_BASE[question.type] ?? 1;
  const points = clampPoints(base + tierBonus(tier) + structureBonus(question), question.type);
  const rationale = `${tier} · ${question.type.replace(/_/g, " ")} (base ${base} → ${points} pts)`;
  return { points, tier, rationale };
}

/**
 * Apply assigned points across a list (always whole numbers; notes/groups stay 0).
 * Recurses into question-group members.
 */
export function applyAssignedQuestionPoints(
  questions: QuizQuestion[],
  opts?: { overwrite?: boolean },
): QuizQuestion[] {
  const overwrite = opts?.overwrite ?? true;
  return questions.map((q) => {
    if (q.type === "note") return { ...q, points: 0 };
    if (q.type === "group") {
      return {
        ...q,
        points: 0,
        groupQuestions: applyAssignedQuestionPoints(q.groupQuestions ?? [], opts),
      };
    }
    if (!overwrite && q.points > 0) return { ...q, points: Math.max(1, Math.round(q.points)) };
    const { points } = assignQuestionPoints(q);
    return { ...q, points };
  });
}

/** Human-readable summary for toasts / UI. */
export function summarizePointAssignments(questions: QuizQuestion[]): string {
  const graded = flattenForPointsSummary(questions);
  const assigned = graded.map((q) => assignQuestionPoints(q));
  const total = assigned.reduce((s, a) => s + a.points, 0);
  const byTier = assigned.reduce(
    (acc, a) => {
      acc[a.tier] = (acc[a.tier] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const tierBits = (["recall", "concept", "application", "synthesis"] as const)
    .filter((t) => byTier[t])
    .map((t) => `${byTier[t]} ${t}`)
    .join(", ");
  return `${graded.length} questions → ${total} pts (${tierBits || "mixed"})`;
}

function flattenForPointsSummary(questions: QuizQuestion[]): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const q of questions) {
    if (q.type === "group") {
      out.push(...(q.groupQuestions ?? []).filter(isGradedQuizQuestion));
    } else if (isGradedQuizQuestion(q)) {
      out.push(q);
    }
  }
  return out;
}
