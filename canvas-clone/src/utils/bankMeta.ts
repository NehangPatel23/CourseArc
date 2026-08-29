import type { QuizQuestion } from "./quizzes";

/** Instructor-facing metadata for organizing question banks. */

export const BANK_AUDIENCES = [
  "any",
  "freshman",
  "sophomore",
  "junior",
  "senior",
  "graduate",
] as const;
export type BankAudience = (typeof BANK_AUDIENCES)[number];

export const BANK_AUDIENCE_LABELS: Record<BankAudience, string> = {
  any: "All years",
  freshman: "Freshman",
  sophomore: "Sophomore",
  junior: "Junior",
  senior: "Senior",
  graduate: "Graduate",
};

export const BANK_DIFFICULTIES = ["mixed", "intro", "intermediate", "advanced"] as const;
export type BankDifficulty = (typeof BANK_DIFFICULTIES)[number];

export const BANK_DIFFICULTY_LABELS: Record<BankDifficulty, string> = {
  mixed: "Mixed difficulty",
  intro: "Introductory",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const BANK_EXAM_USES = [
  "any",
  "practice",
  "homework",
  "quiz",
  "midterm",
  "final",
] as const;
export type BankExamUse = (typeof BANK_EXAM_USES)[number];

export const BANK_EXAM_USE_LABELS: Record<BankExamUse, string> = {
  any: "Any use",
  practice: "Practice",
  homework: "Homework",
  quiz: "Quiz",
  midterm: "Midterm",
  final: "Final",
};

export const BANK_STATUSES = ["draft", "ready"] as const;
export type BankStatus = (typeof BANK_STATUSES)[number];

export const BANK_STATUS_LABELS: Record<BankStatus, string> = {
  draft: "Draft",
  ready: "Ready for quizzes",
};

export type BankMeta = {
  audience: BankAudience;
  difficulty: BankDifficulty;
  examUse: BankExamUse;
  status: BankStatus;
  tags: string[];
};

export const DEFAULT_BANK_META: BankMeta = {
  audience: "any",
  difficulty: "mixed",
  examUse: "any",
  status: "draft",
  tags: [],
};

const AUDIENCE_SET = new Set<string>(BANK_AUDIENCES);
const DIFFICULTY_SET = new Set<string>(BANK_DIFFICULTIES);
const EXAM_USE_SET = new Set<string>(BANK_EXAM_USES);
const STATUS_SET = new Set<string>(BANK_STATUSES);

export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 16) break;
  }
  return out;
}

export function normalizeBankMeta(partial?: Partial<BankMeta> | Record<string, unknown>): BankMeta {
  const p = partial ?? {};
  const audience = typeof p.audience === "string" && AUDIENCE_SET.has(p.audience) ? p.audience : "any";
  const difficulty =
    typeof p.difficulty === "string" && DIFFICULTY_SET.has(p.difficulty) ? p.difficulty : "mixed";
  const examUse = typeof p.examUse === "string" && EXAM_USE_SET.has(p.examUse) ? p.examUse : "any";
  const status = typeof p.status === "string" && STATUS_SET.has(p.status) ? p.status : "draft";
  return {
    audience: audience as BankAudience,
    difficulty: difficulty as BankDifficulty,
    examUse: examUse as BankExamUse,
    status: status as BankStatus,
    tags: normalizeTags(p.tags),
  };
}

export function mergeBankMeta(sources: BankMeta[]): BankMeta {
  if (sources.length === 0) return { ...DEFAULT_BANK_META, tags: [] };
  const first = sources[0]!;
  const same = <K extends keyof BankMeta>(key: K) => sources.every((s) => s[key] === first[key]);
  return {
    audience: same("audience") ? first.audience : "any",
    difficulty: same("difficulty") ? first.difficulty : "mixed",
    examUse: same("examUse") ? first.examUse : "any",
    status: sources.every((s) => s.status === "ready") ? "ready" : "draft",
    tags: normalizeTags(sources.flatMap((s) => s.tags)),
  };
}

export function bankMetaChipLabel(meta: BankMeta): string[] {
  const chips: string[] = [];
  if (meta.audience !== "any") chips.push(BANK_AUDIENCE_LABELS[meta.audience]);
  if (meta.difficulty !== "mixed") chips.push(BANK_DIFFICULTY_LABELS[meta.difficulty]);
  if (meta.examUse !== "any") chips.push(BANK_EXAM_USE_LABELS[meta.examUse]);
  return chips;
}

type BankContentSeed = {
  title?: string;
  notes?: string;
  questions?: QuizQuestion[];
};

const TOPIC_HINTS: Array<{
  test: RegExp;
  meta: Partial<BankMeta>;
  tags?: string[];
}> = [
  { test: /\bbioinformatics?\b/i, meta: { audience: "graduate", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["bioinformatics", "genomics"] },
  { test: /\bquantum\b/i, meta: { audience: "graduate", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["quantum", "qubits"] },
  { test: /\bformal methods?|verification\b/i, meta: { audience: "graduate", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["verification", "formal-methods"] },
  { test: /\bcapstone|research\b/i, meta: { audience: "senior", difficulty: "advanced", examUse: "homework", status: "ready" }, tags: ["capstone", "research"] },
  { test: /\bmachine learning|\bml\b/i, meta: { audience: "senior", difficulty: "advanced", examUse: "midterm", status: "ready" }, tags: ["ML", "models", "training"] },
  { test: /\bcomputer vision|vision\b/i, meta: { audience: "senior", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["vision", "images"] },
  { test: /\bnlp|language models?|transformers?\b/i, meta: { audience: "senior", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["NLP", "transformers", "AI"] },
  { test: /\bartificial intelligence|\bai\b/i, meta: { audience: "senior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["AI", "search", "knowledge"] },
  { test: /\btheory of computation|automata|complexity\b/i, meta: { audience: "senior", difficulty: "advanced", examUse: "midterm", status: "ready" }, tags: ["TOC", "automata", "complexity"] },
  { test: /\bcryptography|crypto\b/i, meta: { audience: "senior", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["crypto", "security"] },
  { test: /\bcompilers?|parsing\b/i, meta: { audience: "senior", difficulty: "advanced", examUse: "midterm", status: "ready" }, tags: ["compilers", "parsing", "languages"] },
  { test: /\bgraphics|rendering\b/i, meta: { audience: "senior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["graphics", "rendering"] },
  { test: /\binformation retrieval|\bsearch\b/i, meta: { audience: "senior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["IR", "search"] },
  { test: /\brobotics?\b/i, meta: { audience: "senior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["robotics", "control"] },
  { test: /\bblockchain|decentralized|consensus\b/i, meta: { audience: "senior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["blockchain", "consensus"] },
  { test: /\bgame development|\bgames?\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["games", "engines"] },
  { test: /\bnumerical|scientific computing\b/i, meta: { audience: "junior", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["numerics", "scientific-computing"] },
  { test: /\bhci|human[-– ]computer interaction|ux\b/i, meta: { audience: "junior", difficulty: "intro", examUse: "homework", status: "ready" }, tags: ["HCI", "UX"] },
  { test: /\bdata science|\beda\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "homework", status: "ready" }, tags: ["data", "EDA", "stats"] },
  { test: /\bfunctional programming|\blambda\b/i, meta: { audience: "junior", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["FP", "lambda", "types"] },
  { test: /\bconcurrent|threads?\b/i, meta: { audience: "junior", difficulty: "advanced", examUse: "quiz", status: "ready" }, tags: ["concurrency", "threads"] },
  { test: /\bdevops|\bsre\b|\bci\b/i, meta: { audience: "senior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["DevOps", "SRE", "CI"] },
  { test: /\bmobile|cloud\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["mobile", "cloud"] },
  { test: /\bsoftware engineering|testing|design\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "homework", status: "ready" }, tags: ["process", "testing", "design"] },
  { test: /\bembedded|iot\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["embedded", "IoT"] },
  { test: /\boperating systems?\b|\bos\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "midterm", status: "ready" }, tags: ["OS", "concurrency", "memory"] },
  { test: /\bnetworks?|routing|tcp|http\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["networking", "protocols"] },
  { test: /\bdatabases?|sql|relational\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["SQL", "relational", "indexing"] },
  { test: /\bcybersecurity|security|threats?\b/i, meta: { audience: "junior", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["security", "threats"] },
  { test: /\bcomputer organization|digital logic|architecture\b/i, meta: { audience: "sophomore", difficulty: "intermediate", examUse: "midterm", status: "ready" }, tags: ["architecture", "digital-logic"] },
  { test: /\bdiscrete\b|proofs?|logic\b/i, meta: { audience: "freshman", difficulty: "intermediate", examUse: "midterm", status: "ready" }, tags: ["proofs", "logic", "sets"] },
  { test: /\bprobability|statistics\b/i, meta: { audience: "sophomore", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["probability", "statistics"] },
  { test: /\blinear algebra|matrices?\b/i, meta: { audience: "sophomore", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["linear-algebra", "matrices"] },
  { test: /\bdata structures?|trees?|graphs?\b/i, meta: { audience: "sophomore", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["DSA", "CS2", "trees", "graphs"] },
  { test: /\balgorithms?|sorting\b/i, meta: { audience: "sophomore", difficulty: "intermediate", examUse: "midterm", status: "ready" }, tags: ["algorithms", "complexity", "sorting"] },
  { test: /\bc\+\+\b/i, meta: { audience: "sophomore", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["C++", "OOP", "STL"] },
  { test: /\b(^|[^a-z])c([^a-z]|$)|pointers?|memory\b/i, meta: { audience: "sophomore", difficulty: "intermediate", examUse: "quiz", status: "ready" }, tags: ["C", "pointers", "memory"] },
  { test: /\bweb technologies|javascript|typescript|html|css\b/i, meta: { audience: "freshman", difficulty: "intro", examUse: "homework", status: "ready" }, tags: ["web"] },
  { test: /\bjava\b/i, meta: { audience: "freshman", difficulty: "intro", examUse: "quiz", status: "ready" }, tags: ["Java", "OOP", "syntax"] },
  { test: /\bpython\b/i, meta: { audience: "freshman", difficulty: "intro", examUse: "homework", status: "ready" }, tags: ["Python", "syntax", "stdlib"] },
  { test: /\bprogramming fundamentals|control[- ]flow|functions?\b/i, meta: { audience: "freshman", difficulty: "intro", examUse: "quiz", status: "ready" }, tags: ["CS1", "control-flow", "functions"] },
];

export function inferBankMetaFromContent(seed: BankContentSeed): BankMeta {
  const questions = seed.questions ?? [];
  const introText = questions
    .slice(0, 8)
    .map((q) => q.prompt)
    .join("\n");
  const corpus = `${seed.title ?? ""}\n${seed.notes ?? ""}\n${introText}`;
  const lowered = corpus.toLowerCase();

  let meta: BankMeta = {
    ...DEFAULT_BANK_META,
    tags: [],
    status: questions.length >= 25 ? "ready" : "draft",
  };

  for (const hint of TOPIC_HINTS) {
    if (!hint.test.test(corpus)) continue;
    meta = {
      ...meta,
      ...hint.meta,
      tags: normalizeTags([...meta.tags, ...(hint.tags ?? [])]),
    };
    break;
  }

  if (meta.audience === "any") {
    if (/\bgraduate|research|seminar\b/i.test(corpus)) meta.audience = "graduate";
    else if (/\badvanced\b/i.test(corpus)) meta.audience = "senior";
    else if (/\bintroductory\b|\bbeginner\b/i.test(corpus)) meta.audience = "freshman";
  }
  if (meta.difficulty === "mixed") {
    if (/\badvanced\b/i.test(corpus)) meta.difficulty = "advanced";
    else if (/\bintroductory\b|\bbeginner\b/i.test(corpus)) meta.difficulty = "intro";
  }
  if (meta.examUse === "any") {
    if (/\bmidterm|unit exam\b/i.test(lowered)) meta.examUse = "midterm";
    else if (/\bfinal\b/i.test(lowered)) meta.examUse = "final";
    else if (/\bpractice\b/i.test(lowered)) meta.examUse = "practice";
    else if (questions.length >= 40) meta.examUse = "quiz";
  }

  const titleTag = (seed.title ?? "")
    .replace(/^[0-9]+\s*/g, "")
    .replace(/[()]/g, "")
    .trim();
  if (titleTag) meta.tags = normalizeTags([titleTag, ...meta.tags]);

  return meta;
}

export function hasExplicitBankMeta(partial?: Partial<BankMeta> | Record<string, unknown>): boolean {
  const p = partial ?? {};
  return (
    typeof p.audience === "string" ||
    typeof p.difficulty === "string" ||
    typeof p.examUse === "string" ||
    typeof p.status === "string" ||
    (Array.isArray(p.tags) && p.tags.length > 0)
  );
}
