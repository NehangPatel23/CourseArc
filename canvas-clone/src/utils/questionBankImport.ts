import {
  createQuizQuestion,
  normalizeQuizQuestions,
  uid,
  type CodeLanguage,
  type QuizQuestion,
  type QuizQuestionType,
  QUIZ_QUESTION_TYPE_LABELS,
} from "./quizzes";
import type { QuestionBank } from "./questionBanks";
import {
  normalizeBankMeta,
  type BankMeta,
} from "./bankMeta";

export type BankExportPayload = {
  version: 1;
  title: string;
  notes?: string;
  audience?: BankMeta["audience"];
  difficulty?: BankMeta["difficulty"];
  examUse?: BankMeta["examUse"];
  status?: BankMeta["status"];
  tags?: string[];
  questions: QuizQuestion[];
  exportedAt: number;
};

const TYPE_ALIASES: Record<string, QuizQuestionType> = {
  mc: "multiple_choice",
  "multiple choice": "multiple_choice",
  multiple_choice: "multiple_choice",
  ma: "multiple_answers",
  "multiple answers": "multiple_answers",
  multiple_answers: "multiple_answers",
  tf: "true_false",
  "true/false": "true_false",
  true_false: "true_false",
  sa: "short_answer",
  "short answer": "short_answer",
  short_answer: "short_answer",
  fib: "fill_in_blank",
  "fill in the blank": "fill_in_blank",
  fill_in_blank: "fill_in_blank",
  numerical: "numerical",
  number: "numerical",
  matching: "matching",
  essay: "essay",
  note: "note",
  instruction: "note",
  instructions: "note",
  separator: "note",
  inline_code: "inline_code",
  "inline code": "inline_code",
  code: "inline_code",
  coding: "coding",
  programming: "coding",
};

function parseType(raw: string): QuizQuestionType {
  const key = raw.trim().toLowerCase();
  return TYPE_ALIASES[key] ?? "short_answer";
}

function parseLanguage(raw?: string): CodeLanguage {
  const key = (raw ?? "").trim().toLowerCase();
  const allowed: CodeLanguage[] = [
    "javascript",
    "typescript",
    "python",
    "java",
    "cpp",
    "c",
    "sql",
    "html",
    "css",
    "other",
  ];
  return (allowed.includes(key as CodeLanguage) ? key : "other") as CodeLanguage;
}

function hydrateQuestion(partial: Partial<QuizQuestion> & { type?: string; prompt?: string }): QuizQuestion {
  const type = parseType(String(partial.type ?? "short_answer"));
  const base = createQuizQuestion(type);
  const rawPoints =
    typeof partial.points === "number" && Number.isFinite(partial.points)
      ? partial.points
      : base.points;
  const points = type === "note" ? 0 : Math.max(1, Math.round(rawPoints));
  const feedback =
    typeof partial.feedback === "string" && partial.feedback.trim()
      ? partial.feedback.trim()
      : undefined;
  const correctFeedback = pickFeedbackField(partial, [
    "correctFeedback",
    "correct_feedback",
    "feedbackCorrect",
  ]);
  const incorrectFeedback = pickFeedbackField(partial, [
    "incorrectFeedback",
    "incorrect_feedback",
    "feedbackIncorrect",
  ]);
  return {
    ...base,
    ...partial,
    id: partial.id && String(partial.id).trim() ? String(partial.id) : uid("qq"),
    type,
    prompt: partial.prompt ?? "",
    points,
    feedback,
    correctFeedback,
    incorrectFeedback,
    language: partial.language ? parseLanguage(String(partial.language)) : base.language,
    choices: Array.isArray(partial.choices) ? partial.choices.map(String) : base.choices,
    acceptedAnswers: Array.isArray(partial.acceptedAnswers)
      ? partial.acceptedAnswers.map(String)
      : base.acceptedAnswers,
    tolerance: parseOptionalNumber(partial, ["tolerance"]),
    partialTolerance: parseOptionalNumber(partial, [
      "partialTolerance",
      "partial_tolerance",
    ]),
    partialCredit: parseOptionalBool(partial, ["partialCredit", "partial_credit"]),
    partialCreditPenalty: parseOptionalBool(partial, [
      "partialCreditPenalty",
      "partial_credit_penalty",
    ]),
    nearMatchThreshold: (() => {
      const n = parseOptionalNumber(partial, [
        "nearMatchThreshold",
        "near_match_threshold",
      ]);
      if (n == null) return undefined;
      // Accept either 0–1 or 0–100 percent.
      return n > 1 ? Math.min(1, n / 100) : n;
    })(),
  };
}

function pickFeedbackField(
  partial: object,
  keys: string[],
): string | undefined {
  const record = partial as Record<string, unknown>;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function parseOptionalNumber(
  partial: object,
  keys: string[],
): number | undefined {
  const record = partial as Record<string, unknown>;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "number" && Number.isFinite(v)) return Math.abs(v);
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      return Math.abs(Number(v));
    }
  }
  return undefined;
}

function parseOptionalBool(
  partial: object,
  keys: string[],
): boolean | undefined {
  const record = partial as Record<string, unknown>;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(s)) return true;
      if (["false", "0", "no", "off"].includes(s)) return false;
    }
  }
  return undefined;
}

export function exportBankToJson(bank: QuestionBank): string {
  const notes = bank.notes?.trim();
  const meta = normalizeBankMeta(bank);
  const payload: BankExportPayload = {
    version: 1,
    title: bank.title,
    ...(notes ? { notes } : {}),
    audience: meta.audience,
    difficulty: meta.difficulty,
    examUse: meta.examUse,
    status: meta.status,
    ...(meta.tags.length ? { tags: meta.tags } : {}),
    questions: bank.questions,
    exportedAt: Date.now(),
  };
  return JSON.stringify(payload, null, 2);
}

export type ParsedBankJson = {
  title?: string;
  notes?: string;
  questions: QuizQuestion[];
} & Partial<BankMeta>;

export function parseBankJson(text: string): ParsedBankJson {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    return { questions: normalizeQuizQuestions(parsed.map((q) => hydrateQuestion(q))) };
  }
  if (parsed && typeof parsed === "object") {
    const questionsRaw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const meta = normalizeBankMeta(parsed);
    return {
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
      ...meta,
      questions: normalizeQuizQuestions(
        questionsRaw.map((q: Partial<QuizQuestion>) => hydrateQuestion(q)),
      ),
    };
  }
  throw new Error("JSON must be a question array or { title, questions }");
}

/** Simple CSV: type,prompt,points,answer,choices,language,starterCode,feedback */
export function parseBankCsv(text: string): QuizQuestion[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const splitCsv = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };

  let start = 0;
  const header = splitCsv(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.includes("type") || header.includes("prompt");
  if (hasHeader) start = 1;

  const col = (name: string) => header.indexOf(name);

  const questions: QuizQuestion[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitCsv(lines[i]);
    const get = (name: string, fallbackIndex: number) => {
      if (hasHeader) {
        const idx = col(name);
        return idx >= 0 ? cells[idx] ?? "" : "";
      }
      return cells[fallbackIndex] ?? "";
    };

    const type = parseType(get("type", 0) || "short_answer");
    const prompt = get("prompt", 1);
    const points = Number(get("points", 2)) || 1;
    const answer = get("answer", 3);
    const choicesRaw = get("choices", 4);
    const language = get("language", 5);
    const starterCode = get("startercode", 6) || get("starter_code", 6);
    const feedback = get("feedback", 7);
    const correctFeedback =
      get("correctfeedback", 8) ||
      get("correct_feedback", 8) ||
      get("feedbackcorrect", 8);
    const incorrectFeedback =
      get("incorrectfeedback", 9) ||
      get("incorrect_feedback", 9) ||
      get("feedbackincorrect", 9);
    const partialTolerance =
      get("partialtolerance", 10) || get("partial_tolerance", 10);
    const partialCreditRaw =
      get("partialcredit", 11) || get("partial_credit", 11);
    const partialCreditPenaltyRaw =
      get("partialcreditpenalty", 12) || get("partial_credit_penalty", 12);
    const toleranceRaw = get("tolerance", 13);
    const nearMatchRaw =
      get("nearmatchthreshold", 14) || get("near_match_threshold", 14);

    const q = createQuizQuestion(type);
    q.prompt = prompt;
    q.points = points;
    if (language) q.language = parseLanguage(language);
    if (starterCode) q.starterCode = starterCode.replace(/\|/g, "\n");
    if (feedback.trim()) q.feedback = feedback.trim();
    if (correctFeedback.trim()) q.correctFeedback = correctFeedback.trim();
    if (incorrectFeedback.trim()) q.incorrectFeedback = incorrectFeedback.trim();
    const tolNum = Number(toleranceRaw);
    if (toleranceRaw.trim() && Number.isFinite(tolNum)) q.tolerance = Math.abs(tolNum);
    const ptNum = Number(partialTolerance);
    if (partialTolerance.trim() && Number.isFinite(ptNum)) {
      q.partialTolerance = Math.abs(ptNum);
    }
    const pc = parseOptionalBool({ partialCredit: partialCreditRaw }, ["partialCredit"]);
    if (pc !== undefined) q.partialCredit = pc;
    const pcp = parseOptionalBool(
      { partialCreditPenalty: partialCreditPenaltyRaw },
      ["partialCreditPenalty"],
    );
    if (pcp !== undefined) q.partialCreditPenalty = pcp;
    const nm = Number(nearMatchRaw);
    if (nearMatchRaw.trim() && Number.isFinite(nm)) {
      q.nearMatchThreshold = nm > 1 ? Math.min(1, nm / 100) : Math.min(1, Math.max(0, nm));
    }

    if (type === "multiple_choice" || type === "multiple_answers") {
      const choices = choicesRaw
        ? choicesRaw.split("|").map((c) => c.trim())
        : answer
          ? [answer]
          : q.choices;
      q.choices = choices ?? [];
      if (type === "multiple_choice") {
        const idx = (choices ?? []).findIndex((c) => c === answer);
        q.correctChoiceIndex = idx >= 0 ? idx : 0;
      }
    } else if (type === "true_false") {
      q.correctTrueFalse = /^(t|true|1|yes)$/i.test(answer);
    } else if (type === "short_answer") {
      q.correctShortAnswer = answer;
    } else if (type === "fill_in_blank" || type === "inline_code") {
      q.acceptedAnswers = answer
        ? answer.split("|").map((a) => a.trim()).filter(Boolean)
        : [""];
    } else if (type === "numerical") {
      q.correctNumber = Number(answer) || 0;
    } else if (type === "coding") {
      q.correctCode = answer.replace(/\|/g, "\n");
    }

    if (prompt.trim()) questions.push(q);
  }
  return questions;
}

/** Lightweight Markdown: ## prompt then type line and answer */
export function parseBankMarkdown(text: string): QuizQuestion[] {
  const blocks = text.split(/\n(?=##\s)/);
  const questions: QuizQuestion[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed.startsWith("##")) continue;
    const lines = trimmed.split("\n");
    const prompt = lines[0].replace(/^##\s*/, "").trim();
    let type: QuizQuestionType = "short_answer";
    let answer = "";
    let language = "";
    let feedback = "";
    let correctFeedback = "";
    let incorrectFeedback = "";
    let points = 1;
    let tolerance: number | undefined;
    let partialTolerance: number | undefined;
    let partialCredit: boolean | undefined;
    let partialCreditPenalty: boolean | undefined;
    let nearMatchThreshold: number | undefined;
    let inFeedback: "general" | "correct" | "incorrect" | null = null;
    for (const line of lines.slice(1)) {
      const mType = line.match(/^type:\s*(.+)$/i);
      const mAns = line.match(/^answer:\s*(.+)$/i);
      const mLang = line.match(/^language:\s*(.+)$/i);
      const mFb = line.match(/^feedback:\s*(.*)$/i);
      const mCorrectFb = line.match(/^correct[_ ]?feedback:\s*(.*)$/i);
      const mIncorrectFb = line.match(/^incorrect[_ ]?feedback:\s*(.*)$/i);
      const mPts = line.match(/^points:\s*(.+)$/i);
      const mTol = line.match(/^tolerance:\s*(.+)$/i);
      const mPartialTol = line.match(/^partial[_ ]?tolerance:\s*(.+)$/i);
      const mPartial = line.match(/^partial[_ ]?credit:\s*(.+)$/i);
      const mPartialPenalty = line.match(/^partial[_ ]?credit[_ ]?penalty:\s*(.+)$/i);
      const mNear = line.match(/^near[_ ]?match[_ ]?threshold:\s*(.+)$/i);
      if (
        mType ||
        mAns ||
        mLang ||
        mPts ||
        mTol ||
        mPartialTol ||
        mPartial ||
        mPartialPenalty ||
        mNear
      ) {
        inFeedback = null;
      }
      if (mType) type = parseType(mType[1]);
      else if (mAns) answer = mAns[1].trim();
      else if (mLang) language = mLang[1].trim();
      else if (mPts) points = Number(mPts[1]) || 1;
      else if (mTol && Number.isFinite(Number(mTol[1]))) {
        tolerance = Math.abs(Number(mTol[1]));
      } else if (mPartialTol && Number.isFinite(Number(mPartialTol[1]))) {
        partialTolerance = Math.abs(Number(mPartialTol[1]));
      } else if (mPartial) {
        partialCredit = parseOptionalBool({ v: mPartial[1] }, ["v"]);
      } else if (mPartialPenalty) {
        partialCreditPenalty = parseOptionalBool({ v: mPartialPenalty[1] }, ["v"]);
      } else if (mNear && Number.isFinite(Number(mNear[1]))) {
        const nm = Number(mNear[1]);
        nearMatchThreshold = nm > 1 ? Math.min(1, nm / 100) : Math.min(1, Math.max(0, nm));
      } else if (mCorrectFb) {
        inFeedback = "correct";
        correctFeedback = (mCorrectFb[1] ?? "").trim();
      } else if (mIncorrectFb) {
        inFeedback = "incorrect";
        incorrectFeedback = (mIncorrectFb[1] ?? "").trim();
      } else if (mFb) {
        inFeedback = "general";
        feedback = (mFb[1] ?? "").trim();
      } else if (inFeedback === "correct") {
        correctFeedback = correctFeedback ? `${correctFeedback}\n${line}` : line;
      } else if (inFeedback === "incorrect") {
        incorrectFeedback = incorrectFeedback
          ? `${incorrectFeedback}\n${line}`
          : line;
      } else if (inFeedback === "general") {
        feedback = feedback ? `${feedback}\n${line}` : line;
      }
    }
    feedback = feedback.trim();
    correctFeedback = correctFeedback.trim();
    incorrectFeedback = incorrectFeedback.trim();
    const q = createQuizQuestion(type);
    q.prompt = prompt;
    q.points = points;
    if (language) q.language = parseLanguage(language);
    if (feedback) q.feedback = feedback;
    if (correctFeedback) q.correctFeedback = correctFeedback;
    if (incorrectFeedback) q.incorrectFeedback = incorrectFeedback;
    if (tolerance != null) q.tolerance = tolerance;
    if (partialTolerance != null) q.partialTolerance = partialTolerance;
    if (partialCredit !== undefined) q.partialCredit = partialCredit;
    if (partialCreditPenalty !== undefined) q.partialCreditPenalty = partialCreditPenalty;
    if (nearMatchThreshold != null) q.nearMatchThreshold = nearMatchThreshold;
    if (type === "short_answer") q.correctShortAnswer = answer;
    else if (type === "fill_in_blank" || type === "inline_code") {
      q.acceptedAnswers = answer ? [answer] : [""];
    } else if (type === "true_false") {
      q.correctTrueFalse = /true/i.test(answer);
    } else if (type === "coding") {
      q.correctCode = answer;
    } else if (type === "numerical") {
      q.correctNumber = Number(answer) || 0;
    }
    if (prompt) questions.push(q);
  }
  return questions;
}

export function detectBankImportFormat(
  filename: string,
  text: string,
): "json" | "csv" | "markdown" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    if (text.trim().startsWith("{") || text.trim().startsWith("[")) return "json";
    if (text.includes("## ")) return "markdown";
    return "csv";
  }
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.includes("## ")) return "markdown";
  return "csv";
}

export function parseBankImport(
  filename: string,
  text: string,
): { title?: string; notes?: string; questions: QuizQuestion[] } & Partial<BankMeta> {
  const format = detectBankImportFormat(filename, text);
  if (format === "json") return parseBankJson(text);
  if (format === "markdown") return { questions: parseBankMarkdown(text) };
  return { questions: parseBankCsv(text) };
}

export function bankImportTemplateCsv(): string {
  return [
    "type,prompt,points,answer,choices,language,starterCode,feedback,correct_feedback,incorrect_feedback",
    'multiple_choice,"What is 2+2?",1,4,"1|2|3|4",,,"Four is 2+2."',
    'inline_code,"Return the larger of a and b",2,"return a > b ? a : b",,javascript,"function max(a, b) {\n  \n}","Use a comparison or Math.max."',
    'coding,"Write factorial(n)",5,"def factorial(n):\n  return 1 if n < 2 else n * factorial(n-1)",,python,"def factorial(n):\n  pass","Handle the n < 2 base case."',
  ].join("\n");
}

export function describeSupportedImportFormats(): string {
  const types = Object.values(QUIZ_QUESTION_TYPE_LABELS).join(", ");
  return `JSON ({ title, questions }), CSV (type,prompt,points,answer,choices|…,language,starterCode), or Markdown (## prompt + type:/answer:). Types: ${types}.`;
}
