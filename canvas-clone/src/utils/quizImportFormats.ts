/**
 * Import quiz/bank questions from QTI 1.2 XML, Aiken, and Moodle XML (subset).
 * Best-effort — not a full IMS content package parser (zip → docs/TODO.md).
 */

import {
  createQuizQuestion,
  normalizeQuizQuestions,
  uid,
  type QuizQuestion,
} from "./quizzes";
import { parseBankImport } from "./questionBankImport";
import type { BankMeta } from "./bankMeta";

export type ImportConflictMode = "rename" | "replace" | "skip";

export type ParsedImportBundle = {
  title: string;
  questions: QuizQuestion[];
  notes?: string;
  format: "qti" | "aiken" | "moodle" | "unknown";
  warnings: string[];
} & Partial<BankMeta>;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(html: string): string {
  return decodeXmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function textBetween(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? stripTags(m[1]!) : "";
}

function attr(tagOpen: string, name: string): string | undefined {
  const m = tagOpen.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m?.[1];
}

/** Parse QTI 1.2 questestinterop / assessment items (MC, multi, TF, FIB text). */
export function parseQtiXml(xml: string): ParsedImportBundle {
  const warnings: string[] = [];
  const title =
    xml.match(/<assessment[^>]*\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ||
    xml.match(/<section[^>]*\btitle\s*=\s*["']([^"']+)["']/i)?.[1] ||
    "Imported QTI quiz";

  const itemBlocks = [...xml.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/gi)].map((m) => m[0]!);
  const questions: QuizQuestion[] = [];

  for (const block of itemBlocks) {
    const prompt =
      textBetween(block, "mattext") ||
      attr(block.slice(0, block.indexOf(">")), "title") ||
      "Imported question";

    const isMulti = /rcardinality\s*=\s*["']Multiple["']/i.test(block);
    const isFib = /<response_str\b/i.test(block) || /<render_fib\b/i.test(block);
    const labels = [...block.matchAll(/<response_label\b([^>]*)>([\s\S]*?)<\/response_label>/gi)];

    if (isFib || labels.length === 0) {
      const q = createQuizQuestion("short_answer");
      q.prompt = prompt;
      q.acceptedAnswers = [];
      const correctText = [...block.matchAll(/<varequal[^>]*>([\s\S]*?)<\/varequal>/gi)].map((m) =>
        stripTags(m[1]!),
      );
      if (correctText.length) q.acceptedAnswers = correctText;
      questions.push(q);
      continue;
    }

    const choices: string[] = [];
    const idents: string[] = [];
    for (const m of labels) {
      const ident = attr(m[1]!, "ident") ?? `A${choices.length}`;
      const text = stripTags(m[2]!).trim() || ident;
      idents.push(ident);
      choices.push(text);
    }

    // Dedupe: one <varequal> per correct choice, or the item looks multi-answer.
    const correctIdents = [
      ...new Set(
        [...block.matchAll(/<varequal[^>]*>([\s\S]*?)<\/varequal>/gi)].map((m) =>
          stripTags(m[1]!),
        ),
      ),
    ];

    const correctIndices = correctIdents
      .map((id) => idents.indexOf(id))
      .filter((i) => i >= 0);

    const looksTf =
      choices.length === 2 &&
      choices.every((c) => /^(true|false|t|f|yes|no)$/i.test(c.trim()));

    if (looksTf && !isMulti) {
      const q = createQuizQuestion("true_false");
      q.prompt = prompt;
      q.choices = ["True", "False"];
      const idx = correctIndices[0] ?? 0;
      q.correctChoiceIndex = /true|t|yes/i.test(choices[idx] ?? "") ? 0 : 1;
      questions.push(q);
      continue;
    }

    if (isMulti || correctIndices.length > 1) {
      const q = createQuizQuestion("multiple_answers");
      q.prompt = prompt;
      q.choices = choices;
      q.correctChoiceIndices = correctIndices.length ? correctIndices : [0];
      questions.push(q);
      continue;
    }

    const q = createQuizQuestion("multiple_choice");
    q.prompt = prompt;
    q.choices = choices;
    q.correctChoiceIndex = correctIndices[0] ?? 0;
    questions.push(q);
  }

  if (questions.length === 0) {
    warnings.push("No QTI <item> elements could be parsed.");
  }

  return {
    title: decodeXmlEntities(title),
    questions: normalizeQuizQuestions(questions),
    format: "qti",
    warnings,
  };
}

/**
 * Aiken format:
 * Question text
 * A. Choice
 * B. Choice
 * ANSWER: B
 */
export function parseAiken(text: string): ParsedImportBundle {
  const warnings: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const questions: QuizQuestion[] = [];
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && !lines[i]!.trim()) i += 1;
    if (i >= lines.length) break;
    const promptLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^[A-Z]\s*[.)]\s*/.test(lines[i]!.trim()) &&
      !/^ANSWER\s*:/i.test(lines[i]!.trim())
    ) {
      promptLines.push(lines[i]!.trim());
      i += 1;
    }
    const choices: { letter: string; text: string }[] = [];
    while (i < lines.length && /^[A-Z]\s*[.)]\s*/.test(lines[i]!.trim())) {
      const m = lines[i]!.trim().match(/^([A-Z])\s*[.)]\s*(.*)$/);
      if (m) choices.push({ letter: m[1]!, text: m[2]!.trim() });
      i += 1;
    }
    let answer = "";
    if (i < lines.length && /^ANSWER\s*:/i.test(lines[i]!.trim())) {
      answer = lines[i]!.trim().replace(/^ANSWER\s*:/i, "").trim().toUpperCase();
      i += 1;
    }
    if (!promptLines.length || choices.length === 0) {
      warnings.push("Skipped malformed Aiken block.");
      continue;
    }
    const q = createQuizQuestion("multiple_choice");
    q.prompt = promptLines.join("\n");
    q.choices = choices.map((c) => c.text);
    const idx = choices.findIndex((c) => c.letter === answer.charAt(0));
    q.correctChoiceIndex = idx >= 0 ? idx : 0;
    if (idx < 0 && answer) warnings.push(`Unknown ANSWER “${answer}” — defaulted to first choice.`);
    questions.push(q);
  }
  return {
    title: "Imported Aiken quiz",
    questions: normalizeQuizQuestions(questions),
    format: "aiken",
    warnings,
  };
}

/** Moodle XML quiz export subset (question type multichoice / truefalse / shortanswer / essay). */
export function parseMoodleXml(xml: string): ParsedImportBundle {
  const warnings: string[] = [];
  const title =
    xml.match(/<quiz[^>]*>[\s\S]*?<question[^>]*type\s*=\s*["']category["'][\s\S]*?<text>([\s\S]*?)<\/text>/i)?.[1] ||
    "Imported Moodle quiz";
  const blocks = [...xml.matchAll(/<question\b([^>]*)>([\s\S]*?)<\/question>/gi)];
  const questions: QuizQuestion[] = [];

  for (const m of blocks) {
    const type = (attr(m[1]!, "type") || "").toLowerCase();
    if (type === "category" || type === "description") continue;
    const body = m[2]!;
    const prompt = textBetween(body, "text") || textBetween(body, "questiontext") || "Imported question";
    // Prefer questiontext mattext
    const qtext = body.match(/<questiontext[\s\S]*?<text>([\s\S]*?)<\/text>/i);
    const finalPrompt = qtext ? stripTags(qtext[1]!) : prompt;

    if (type === "truefalse") {
      const q = createQuizQuestion("true_false");
      q.prompt = finalPrompt;
      q.choices = ["True", "False"];
      const answers = [...body.matchAll(/<answer\b([^>]*)>([\s\S]*?)<\/answer>/gi)];
      let correct = 0;
      for (const a of answers) {
        const frac = Number(attr(a[1]!, "fraction") || 0);
        const t = stripTags(textBetween(a[2]!, "text") || a[2]!);
        if (frac > 0) correct = /true/i.test(t) ? 0 : 1;
      }
      q.correctChoiceIndex = correct;
      questions.push(q);
      continue;
    }

    if (type === "shortanswer") {
      const q = createQuizQuestion("short_answer");
      q.prompt = finalPrompt;
      q.acceptedAnswers = [...body.matchAll(/<answer\b([^>]*)>([\s\S]*?)<\/answer>/gi)]
        .filter((a) => Number(attr(a[1]!, "fraction") || 0) > 0)
        .map((a) => stripTags(textBetween(a[2]!, "text") || a[2]!))
        .filter(Boolean);
      questions.push(q);
      continue;
    }

    if (type === "essay") {
      const q = createQuizQuestion("essay");
      q.prompt = finalPrompt;
      questions.push(q);
      continue;
    }

    // multichoice (default) + unknown with answers
    const answers = [...body.matchAll(/<answer\b([^>]*)>([\s\S]*?)<\/answer>/gi)];
    if (answers.length === 0) {
      warnings.push(`Skipped Moodle question type “${type || "unknown"}” (no answers).`);
      continue;
    }
    const choices = answers.map((a) => stripTags(textBetween(a[2]!, "text") || a[2]!));
    const fractions = answers.map((a) => Number(attr(a[1]!, "fraction") || 0));
    const correctIndices = fractions
      .map((f, i) => (f > 0 ? i : -1))
      .filter((i) => i >= 0);
    const single = /single\s*>\s*true/i.test(body) || correctIndices.length <= 1;

    if (single) {
      const q = createQuizQuestion("multiple_choice");
      q.prompt = finalPrompt;
      q.choices = choices;
      q.correctChoiceIndex = correctIndices[0] ?? 0;
      questions.push(q);
    } else {
      const q = createQuizQuestion("multiple_answers");
      q.prompt = finalPrompt;
      q.choices = choices;
      q.correctChoiceIndices = correctIndices;
      questions.push(q);
    }
  }

  if (questions.length === 0) warnings.push("No Moodle questions could be parsed.");

  return {
    title: stripTags(String(title)).replace(/^\$course\$\/?/i, "") || "Imported Moodle quiz",
    questions: normalizeQuizQuestions(questions),
    format: "moodle",
    warnings,
  };
}

/** Detect format from filename + content and parse. */
export function parseQuizImportFile(filename: string, text: string): ParsedImportBundle {
  const lower = filename.toLowerCase();
  const trimmed = text.trim();
  if (
    lower.endsWith(".xml") ||
    trimmed.startsWith("<?xml") ||
    /<questestinterop\b/i.test(trimmed) ||
    /<quiz\b/i.test(trimmed)
  ) {
    if (/<questestinterop\b/i.test(trimmed) || /<assessment\b/i.test(trimmed)) {
      return parseQtiXml(trimmed);
    }
    if (/<quiz\b/i.test(trimmed) || /<question\b[^>]*type=/i.test(trimmed)) {
      return parseMoodleXml(trimmed);
    }
    // Try QTI then Moodle
    const qti = parseQtiXml(trimmed);
    if (qti.questions.length) return qti;
    return parseMoodleXml(trimmed);
  }
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".aiken") ||
    /^ANSWER\s*:/im.test(trimmed) ||
    /^[A-Z]\s*[.)]\s+/m.test(trimmed)
  ) {
    return parseAiken(trimmed);
  }
  throw new Error("Unrecognized import format. Use QTI XML, Moodle XML, or Aiken .txt.");
}

export function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

/**
 * Bank formats (JSON / CSV / Markdown) plus QTI, Moodle, and Aiken in one call —
 * `.txt` is ambiguous between Markdown/CSV and Aiken, so try both.
 */
export function parseAnyQuestionImport(
  filename: string,
  text: string,
): ParsedImportBundle {
  const lower = filename.toLowerCase();
  const trimmed = text.trim();
  const looksXml =
    lower.endsWith(".xml") || trimmed.startsWith("<?xml") || trimmed.startsWith("<");
  const looksAiken = /^ANSWER\s*:/im.test(trimmed);
  if (looksXml || looksAiken) return parseQuizImportFile(filename, text);

  try {
    const bank = parseBankImport(filename, text);
    if (bank.questions.length > 0) {
      return {
        title: bank.title?.trim() || titleFromFilename(filename) || "Imported questions",
        questions: normalizeQuizQuestions(bank.questions),
        notes: bank.notes?.trim() || undefined,
        audience: bank.audience,
        difficulty: bank.difficulty,
        examUse: bank.examUse,
        status: bank.status,
        tags: bank.tags,
        format: "unknown",
        warnings: [],
      };
    }
  } catch {
    // Fall through to QTI / Moodle / Aiken detection.
  }
  return parseQuizImportFile(filename, text);
}

export function remapImportedQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return normalizeQuizQuestions(questions).map((q) => ({
    ...q,
    id: uid("qq"),
    codeTests: q.codeTests?.map((t) => ({ ...t, id: uid("ct") })),
    matchingPairs: q.matchingPairs?.map((p) => ({ ...p, id: uid("mp") })),
    groupQuestions: q.groupQuestions?.map((gq) => ({
      ...gq,
      id: uid("qq"),
    })),
  }));
}

/** Resolve title conflict: rename appends (imported), replace/skip handled by caller. */
export function resolveImportTitle(
  desired: string,
  existingTitles: string[],
  mode: ImportConflictMode,
): string | null {
  const base = desired.trim() || "Imported";
  if (mode === "skip") {
    return existingTitles.some((t) => t.toLowerCase() === base.toLowerCase()) ? null : base;
  }
  if (mode === "replace") return base;
  if (!existingTitles.some((t) => t.toLowerCase() === base.toLowerCase())) return base;
  let n = 2;
  let candidate = `${base} (imported)`;
  while (existingTitles.some((t) => t.toLowerCase() === candidate.toLowerCase())) {
    candidate = `${base} (imported ${n})`;
    n += 1;
  }
  return candidate;
}
