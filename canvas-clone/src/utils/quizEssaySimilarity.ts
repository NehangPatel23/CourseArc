/**
 * Client-side text similarity for quiz GradePro / originality reports
 * (not an external plagiarism service).
 * Combines stemmed token Jaccard with bigram/trigram phrase overlap.
 * Supports code normalization, boilerplate exclusion, and self-attempt matches.
 */

/** Light English stem so finds≈find, checking≈check, discarding≈discard. */
export function stemToken(raw: string): string {
  let w = raw.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("ing") && w.length > 5) {
    const base = w.slice(0, -3);
    if (base.length >= 2 && base.at(-1) === base.at(-2)) return base.slice(0, -1);
    if (/[^aeiou][aeiou][^aeiou]$/.test(base)) return `${base}e`;
    return base;
  }
  if (w.endsWith("ed") && w.length > 4) {
    const base = w.slice(0, -2);
    if (base.length >= 2 && base.at(-1) === base.at(-2)) return base.slice(0, -1);
    return base;
  }
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

export function tokenizeForSimilarity(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9_\s]+/g, " ")
    .split(/\s+/)
    .map(stemToken)
    .filter((t) => t.length > 1);
}

export function tokenSet(text: string): Set<string> {
  return new Set(tokenizeForSimilarity(text));
}

/**
 * Normalize source code for soft originality: strip comments, collapse whitespace,
 * and replace identifier-like tokens with placeholders so renamed copies still match.
 */
export function normalizeCodeForSimilarity(source: string): string {
  let s = source || "";
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  s = s.replace(/#[^\n]*/g, " ");
  s = s.replace(/('''[\s\S]*?'''|"""[\s\S]*?""")/g, " ");
  s = s.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, " STR ");
  s = s.replace(/\b0x[0-9a-fA-F]+\b|\b\d+\.?\d*\b/g, " NUM ");
  const reserved = new Set([
    "if", "else", "elif", "for", "while", "do", "return", "def", "class",
    "function", "var", "let", "const", "import", "from", "export", "true",
    "false", "null", "none", "nil", "public", "private", "static", "void",
    "int", "float", "double", "string", "bool", "boolean", "new", "this",
    "self", "in", "of", "try", "catch", "except", "finally", "throw", "raise",
    "break", "continue", "switch", "case", "default", "struct", "enum",
    "package", "type", "interface", "extends", "implements", "print",
    "console", "log", "len", "range", "and", "or", "not", "is", "as", "with",
    "async", "await", "yield", "pass",
  ]);
  let id = 0;
  const map = new Map<string, string>();
  s = s.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (tok) => {
    const lower = tok.toLowerCase();
    if (reserved.has(lower)) return lower;
    if (!map.has(lower)) {
      map.set(lower, `id${id}`);
      id += 1;
    }
    return map.get(lower)!;
  });
  return s.replace(/\s+/g, " ").trim();
}

/** Remove instructor-supplied boilerplate phrases (case-insensitive). */
export function stripExcludedPhrases(text: string, phrases: string[]): string {
  let out = text || "";
  const cleaned = phrases
    .map((p) => p.trim())
    .filter((p) => p.length >= 3)
    .sort((a, b) => b.length - a.length);
  for (const phrase of cleaned) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function parseExcludeText(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
}

/** Stable compare key so similar prompts can match across quizzes. */
export function similarityCompareKey(prompt: string, questionId: string): string {
  const fp = tokenizeForSimilarity(prompt || "")
    .slice(0, 20)
    .join("-");
  return fp.length >= 6 ? `fp:${fp}` : `id:${questionId}`;
}

export function prepareSimilarityText(
  text: string,
  opts?: {
    questionType?: string;
    normalizeCode?: boolean;
    excludePhrases?: string[];
  },
): string {
  let t = text || "";
  if (opts?.excludePhrases?.length) {
    t = stripExcludedPhrases(t, opts.excludePhrases);
  }
  const type = opts?.questionType;
  if (
    opts?.normalizeCode !== false &&
    (type === "coding" || type === "inline_code")
  ) {
    t = normalizeCodeForSimilarity(t);
  }
  return t;
}

/** Jaccard similarity of token sets in [0, 1]. */
export function jaccardSimilarity(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union > 0 ? inter / union : 0;
}

/** Sliding word n-grams over stemmed tokens. */
export function wordNgrams(text: string, n = 3): Set<string> {
  const tokens = tokenizeForSimilarity(text);
  const out = new Set<string>();
  if (tokens.length < n) {
    if (tokens.length > 0) out.add(tokens.join(" "));
    return out;
  }
  for (let i = 0; i <= tokens.length - n; i++) {
    out.add(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

export function ngramJaccard(a: string, b: string, n = 3): number {
  const sa = wordNgrams(a, n);
  const sb = wordNgrams(b, n);
  if (sa.size === 0 && sb.size === 0) return 1;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union > 0 ? inter / union : 0;
}

/** Phrase score: prefer trigrams, fall back to bigrams for short paraphrases. */
export function phraseSimilarityScore(a: string, b: string): number {
  const tri = ngramJaccard(a, b, 3);
  const bi = ngramJaccard(a, b, 2);
  return Math.min(1, tri * 0.65 + bi * 0.35);
}

/**
 * Combined similarity used for ranking / overall %.
 * Token overlap carries more weight so paraphrases still register.
 */
export function combinedSimilarity(a: string, b: string): {
  similarity: number;
  phraseSimilarity: number;
  combined: number;
} {
  const similarity = jaccardSimilarity(a, b);
  const phraseSimilarity = phraseSimilarityScore(a, b);
  const combined = Math.min(1, similarity * 0.55 + phraseSimilarity * 0.45);
  return { similarity, phraseSimilarity, combined };
}

/** Longest shared phrases (2–6 grams), capped. */
export function extractSharedPhrases(a: string, b: string, limit = 8): string[] {
  const found = new Map<string, number>();
  for (let n = 6; n >= 2; n--) {
    const sa = wordNgrams(a, n);
    const sb = wordNgrams(b, n);
    for (const phrase of sa) {
      if (!sb.has(phrase)) continue;
      let covered = false;
      for (const existing of found.keys()) {
        if (existing.includes(phrase) || phrase.includes(existing)) {
          if (existing.length >= phrase.length) covered = true;
        }
      }
      if (!covered) found.set(phrase, n);
    }
  }
  return [...found.keys()]
    .sort((x, y) => y.length - x.length || x.localeCompare(y))
    .slice(0, limit);
}

export type SimilarityMatchKind = "peer" | "self";

export type EssaySimilarityPair = {
  attemptIdA: string;
  attemptIdB: string;
  studentIdA: string;
  studentIdB: string;
  studentNameA: string;
  studentNameB: string;
  /** Question id on attempt A (for highlights / labels). */
  questionIdA: string;
  /** Question id on attempt B. */
  questionIdB: string;
  /**
   * Legacy alias = questionIdA (same-quiz pairs historically shared one id).
   * Prefer questionIdForAttempt().
   */
  questionId: string;
  compareKey: string;
  matchKind: SimilarityMatchKind;
  crossQuiz: boolean;
  quizIdA?: string;
  quizIdB?: string;
  quizTitleA?: string;
  quizTitleB?: string;
  /** Token Jaccard 0–1 */
  similarity: number;
  /** Phrase (bi/tri-gram) Jaccard blend 0–1 */
  phraseSimilarity: number;
  /** Weighted blend used for ranking / overall score */
  combined: number;
  sharedTokenCount: number;
  sharedPhrases: string[];
  wordCountA: number;
  wordCountB: number;
  codeNormalized?: boolean;
};

export function questionIdForAttempt(
  pair: EssaySimilarityPair,
  attemptId: string,
): string {
  return pair.attemptIdA === attemptId ? pair.questionIdA : pair.questionIdB;
}

export type SimilarityTextRow = {
  attemptId: string;
  studentName: string;
  studentId: string;
  questionId: string;
  compareKey: string;
  text: string;
  /** Original (display) text before normalize — optional */
  displayText?: string;
  questionType?: string;
  quizId?: string;
  quizTitle?: string;
  codeNormalized?: boolean;
};

export type FindEssaySimilarityOptions = {
  threshold?: number;
  /** Include same-student different attempts (default true). */
  includeSelfAttempts?: boolean;
};

/**
 * Exhaustive pairwise compare for free-text answers.
 * Returns all pairs at or above `threshold` on combined score, sorted high → low.
 * Rows should already be prepared (exclude phrases / code normalize applied).
 */
export function findEssaySimilarityPairs(
  rows: SimilarityTextRow[],
  thresholdOrOpts: number | FindEssaySimilarityOptions = 0.05,
): EssaySimilarityPair[] {
  const opts: FindEssaySimilarityOptions =
    typeof thresholdOrOpts === "number"
      ? { threshold: thresholdOrOpts }
      : thresholdOrOpts;
  const threshold = opts.threshold ?? 0.05;
  const includeSelf = opts.includeSelfAttempts !== false;

  const out: EssaySimilarityPair[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      if (a.compareKey !== b.compareKey) continue;
      if (a.attemptId === b.attemptId) continue;
      if (a.studentId === b.studentId && !includeSelf) continue;
      if (!a.text.trim() || !b.text.trim()) continue;

      const { similarity, phraseSimilarity, combined } = combinedSimilarity(
        a.text,
        b.text,
      );
      if (combined < threshold) continue;

      const sa = tokenSet(a.text);
      const sb = tokenSet(b.text);
      let sharedTokenCount = 0;
      for (const t of sa) if (sb.has(t)) sharedTokenCount += 1;

      const matchKind: SimilarityMatchKind =
        a.studentId === b.studentId ? "self" : "peer";
      const crossQuiz = Boolean(
        a.quizId && b.quizId && a.quizId !== b.quizId,
      );

      out.push({
        attemptIdA: a.attemptId,
        attemptIdB: b.attemptId,
        studentIdA: a.studentId,
        studentIdB: b.studentId,
        studentNameA: a.studentName,
        studentNameB: b.studentName,
        questionIdA: a.questionId,
        questionIdB: b.questionId,
        questionId: a.questionId,
        compareKey: a.compareKey,
        matchKind,
        crossQuiz,
        quizIdA: a.quizId,
        quizIdB: b.quizId,
        quizTitleA: a.quizTitle,
        quizTitleB: b.quizTitle,
        similarity,
        phraseSimilarity,
        combined,
        sharedTokenCount,
        sharedPhrases: extractSharedPhrases(a.text, b.text),
        wordCountA: tokenizeForSimilarity(a.text).length,
        wordCountB: tokenizeForSimilarity(b.text).length,
        codeNormalized: Boolean(a.codeNormalized || b.codeNormalized),
      });
    }
  }
  return out.sort((x, y) => y.combined - x.combined);
}

/** Turnitin-style similarity color bands. */
export type SimilarityBand = "blue" | "green" | "yellow" | "orange" | "red";

export function similarityBand(pct: number): SimilarityBand {
  if (pct < 1) return "blue";
  if (pct < 25) return "green";
  if (pct < 50) return "yellow";
  if (pct < 75) return "orange";
  return "red";
}

export function similarityBandClasses(band: SimilarityBand): {
  ring: string;
  fill: string;
  text: string;
  bar: string;
  badge: string;
} {
  switch (band) {
    case "blue":
      return {
        ring: "stroke-sky-500",
        fill: "text-sky-600",
        text: "text-sky-800",
        bar: "bg-sky-500",
        badge: "bg-sky-100 text-sky-800 border-sky-200",
      };
    case "green":
      return {
        ring: "stroke-emerald-500",
        fill: "text-emerald-600",
        text: "text-emerald-800",
        bar: "bg-emerald-500",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    case "yellow":
      return {
        ring: "stroke-amber-400",
        fill: "text-amber-600",
        text: "text-amber-900",
        bar: "bg-amber-400",
        badge: "bg-amber-100 text-amber-900 border-amber-200",
      };
    case "orange":
      return {
        ring: "stroke-orange-500",
        fill: "text-orange-600",
        text: "text-orange-900",
        bar: "bg-orange-500",
        badge: "bg-orange-100 text-orange-900 border-orange-200",
      };
    case "red":
      return {
        ring: "stroke-red-600",
        fill: "text-red-600",
        text: "text-red-800",
        bar: "bg-red-600",
        badge: "bg-red-100 text-red-800 border-red-200",
      };
  }
}

export type AttemptSimilaritySummary = {
  attemptId: string;
  /** 0–100 overall (max combined match across questions). */
  overallPct: number;
  peerPct: number;
  selfPct: number;
  matchCount: number;
  peerMatchCount: number;
  selfMatchCount: number;
  byQuestion: { questionId: string; pct: number; matchCount: number }[];
  matches: EssaySimilarityPair[];
};

/** Summarize matches involving a specific attempt. */
export function summarizeAttemptSimilarity(
  attemptId: string,
  pairs: EssaySimilarityPair[],
): AttemptSimilaritySummary {
  const matches = pairs.filter(
    (p) => p.attemptIdA === attemptId || p.attemptIdB === attemptId,
  );
  const peer = matches.filter((m) => m.matchKind === "peer");
  const self = matches.filter((m) => m.matchKind === "self");
  const byQ = new Map<string, number[]>();
  for (const m of matches) {
    const qid = questionIdForAttempt(m, attemptId);
    const list = byQ.get(qid) ?? [];
    list.push(m.combined);
    byQ.set(qid, list);
  }
  const byQuestion = [...byQ.entries()].map(([questionId, vals]) => ({
    questionId,
    pct: Math.round(Math.max(...vals) * 100),
    matchCount: vals.length,
  }));
  const maxPct = (list: EssaySimilarityPair[]) =>
    list.length === 0
      ? 0
      : Math.round(Math.max(...list.map((m) => m.combined)) * 100);
  return {
    attemptId,
    overallPct: maxPct(matches),
    peerPct: maxPct(peer),
    selfPct: maxPct(self),
    matchCount: matches.length,
    peerMatchCount: peer.length,
    selfMatchCount: self.length,
    byQuestion: byQuestion.sort((a, b) => b.pct - a.pct),
    matches: matches.sort((a, b) => b.combined - a.combined),
  };
}

/** Highlight shared phrases inside text (case-insensitive), returns segments. */
export function highlightSharedPhrases(
  text: string,
  phrases: string[],
): { text: string; hit: boolean }[] {
  if (!text || phrases.length === 0) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number }[] = [];

  for (const phrase of phrases) {
    const needle = phrase.toLowerCase();
    if (!needle) continue;
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx < 0) break;
      ranges.push({ start: idx, end: idx + needle.length });
      from = idx + needle.length;
    }
  }

  const wordRe = /[a-z0-9_]+/gi;
  const words: { start: number; end: number; stem: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text)) !== null) {
    words.push({
      start: m.index,
      end: m.index + m[0].length,
      stem: stemToken(m[0]),
    });
  }
  const phraseStemLists = phrases.map((p) => p.split(/\s+/).filter(Boolean));
  for (const stems of phraseStemLists) {
    if (stems.length === 0) continue;
    for (let i = 0; i <= words.length - stems.length; i++) {
      let ok = true;
      for (let k = 0; k < stems.length; k++) {
        if (words[i + k]!.stem !== stems[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        ranges.push({
          start: words[i]!.start,
          end: words[i + stems.length - 1]!.end,
        });
      }
    }
  }

  if (ranges.length === 0) return [{ text, hit: false }];
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  const parts: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) parts.push({ text: text.slice(cursor, r.start), hit: false });
    parts.push({ text: text.slice(r.start, r.end), hit: true });
    cursor = r.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}

/** Multi-source highlight colors (Turnitin-style numbered sources). */
export const SIMILARITY_SOURCE_COLORS = [
  { bg: "bg-red-200/90", text: "text-red-950", border: "border-red-300", swatch: "bg-red-500", mark: "bg-red-200" },
  { bg: "bg-orange-200/90", text: "text-orange-950", border: "border-orange-300", swatch: "bg-orange-500", mark: "bg-orange-200" },
  { bg: "bg-amber-200/90", text: "text-amber-950", border: "border-amber-300", swatch: "bg-amber-400", mark: "bg-amber-200" },
  { bg: "bg-lime-200/90", text: "text-lime-950", border: "border-lime-300", swatch: "bg-lime-500", mark: "bg-lime-200" },
  { bg: "bg-emerald-200/90", text: "text-emerald-950", border: "border-emerald-300", swatch: "bg-emerald-500", mark: "bg-emerald-200" },
  { bg: "bg-cyan-200/90", text: "text-cyan-950", border: "border-cyan-300", swatch: "bg-cyan-500", mark: "bg-cyan-200" },
  { bg: "bg-sky-200/90", text: "text-sky-950", border: "border-sky-300", swatch: "bg-sky-500", mark: "bg-sky-200" },
  { bg: "bg-violet-200/90", text: "text-violet-950", border: "border-violet-300", swatch: "bg-violet-500", mark: "bg-violet-200" },
] as const;

export function similaritySourceColor(index: number) {
  return SIMILARITY_SOURCE_COLORS[index % SIMILARITY_SOURCE_COLORS.length]!;
}

export function isTextSimilarityQuestionType(type: string): boolean {
  return (
    type === "essay" ||
    type === "coding" ||
    type === "short_answer" ||
    type === "fill_in_blank" ||
    type === "inline_code"
  );
}
