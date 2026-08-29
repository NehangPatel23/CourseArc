import { normalizeStdout, type WorkerTestResult } from "./codeRunnerShared";
import type { CodeLanguage } from "./quizzes";

/** Collapse whitespace for source / DOM text compares. */
export function normalizeMarkupSource(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fast non-crypto hash so student payloads need not include plaintext expected CSS/HTML. */
export function hashNormalizedSource(s: string): string {
  const n = normalizeMarkupSource(s);
  let h = 2166136261;
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Build a sandboxed srcdoc document for HTML or CSS preview / text extraction.
 * For CSS, `scaffoldHtml` (often from test stdin) is the body markup.
 */
export function buildHtmlCssSrcdoc(
  language: "html" | "css",
  code: string,
  scaffoldHtml = "",
): string {
  if (language === "css") {
    const body =
      scaffoldHtml.trim() ||
      '<div class="target" id="target">Preview</div>';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${code}</style></head><body>${body}</body></html>`;
  }
  const trimmed = code.trim();
  if (/<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${code}</body></html>`;
}

function bodyTextFromHtml(srcdoc: string): string {
  const collapse = (s: string) => normalizeStdout(s.replace(/\s+/g, " ").trim());
  if (typeof DOMParser === "undefined") {
    return collapse(
      srcdoc
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    );
  }
  try {
    const doc = new DOMParser().parseFromString(srcdoc, "text/html");
    return collapse(doc.body?.textContent ?? "");
  } catch {
    return collapse(
      srcdoc
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    );
  }
}

function looksLikeMarkup(s: string): boolean {
  return /<[a-zA-Z!/?]/.test(s.trim());
}

/** True when expected is a property checklist (not a full CSS rule block). */
export function isCssPropertyChecklist(expected: string): boolean {
  const t = expected.trim();
  if (!t || t.includes("{")) return false;
  if (/^computed:/im.test(t)) return false;
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  return lines.every((l) => /^[a-zA-Z-]+\s*:/.test(l) || l.startsWith("@css"));
}

/** `computed:#id prop:value` lines for iframe getComputedStyle checks. */
export function parseComputedStyleExpectations(
  expected: string,
): { selector: string; prop: string; value: string }[] {
  const out: { selector: string; prop: string; value: string }[] = [];
  for (const raw of expected.split("\n")) {
    const line = raw.trim();
    const m = line.match(
      /^computed:\s*([^\s]+)\s+([a-zA-Z-]+)\s*:\s*(.+?);?\s*$/i,
    );
    if (m) {
      out.push({
        selector: m[1]!,
        prop: m[2]!.toLowerCase(),
        value: m[3]!.trim().toLowerCase(),
      });
    }
  }
  return out;
}

function gradeComputedStyles(
  language: "html" | "css",
  code: string,
  scaffoldHtml: string,
  expected: string,
): { passed: boolean; actual: string } {
  const wants = parseComputedStyleExpectations(expected);
  if (wants.length === 0) {
    return { passed: false, actual: "no computed: lines" };
  }
  if (typeof document === "undefined") {
    return { passed: false, actual: "computed checks require DOM" };
  }
  const srcdoc = buildHtmlCssSrcdoc(language, code, scaffoldHtml);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:400px;height:300px;opacity:0";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) return { passed: false, actual: "no iframe document" };
    doc.open();
    doc.write(srcdoc);
    doc.close();
    const missing: string[] = [];
    const gotLines: string[] = [];
    for (const w of wants) {
      const el = doc.querySelector(w.selector);
      if (!el) {
        missing.push(`${w.selector} (not found)`);
        continue;
      }
      const cs = iframe.contentWindow?.getComputedStyle(el);
      const raw = cs ? cs.getPropertyValue(w.prop) || (cs as unknown as Record<string, string>)[w.prop] : "";
      const got = String(raw ?? "").trim().toLowerCase();
      gotLines.push(`${w.selector} ${w.prop}:${got}`);
      if (got !== w.value && !got.includes(w.value)) {
        missing.push(`${w.selector} ${w.prop}: want ${w.value}, got ${got || "(empty)"}`);
      }
    }
    return {
      passed: missing.length === 0,
      actual: missing.length === 0 ? gotLines.join("; ") : missing.join("; "),
    };
  } catch (e) {
    return {
      passed: false,
      actual: e instanceof Error ? e.message : "computed grade failed",
    };
  } finally {
    iframe.remove();
  }
}

/** Parse `color: red` style lines (ignores `@css` / `@css-props` headers). */
export function parseCssPropertyExpectations(
  expected: string,
): { prop: string; value: string }[] {
  const out: { prop: string; value: string }[] = [];
  for (const raw of expected.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("@")) continue;
    const m = line.match(/^([a-zA-Z-]+)\s*:\s*(.+?);?\s*$/);
    if (m) out.push({ prop: m[1].toLowerCase(), value: m[2].trim().toLowerCase() });
  }
  return out;
}

function cssDeclarationsMap(code: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /([a-zA-Z-]+)\s*:\s*([^;{}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    map.set(m[1].toLowerCase(), m[2].trim().toLowerCase());
  }
  return map;
}

function gradeCssProperties(
  code: string,
  expected: string,
): { passed: boolean; actual: string } {
  const wants = parseCssPropertyExpectations(expected);
  const decls = cssDeclarationsMap(code);
  const missing: string[] = [];
  for (const w of wants) {
    const got = decls.get(w.prop);
    if (!got || got !== w.value) missing.push(`${w.prop}: ${w.value}`);
  }
  const actual =
    missing.length === 0
      ? wants.map((w) => `${w.prop}: ${w.value}`).join("; ")
      : `missing: ${missing.join("; ")}`;
  return { passed: missing.length === 0, actual };
}

export type HtmlCssTestInput = {
  id: string;
  stdin: string;
  expectedStdout: string;
  /** When plaintext expected is stripped, grade via this hash of normalized source. */
  expectedHash?: string;
};

/**
 * Grade HTML/CSS submissions against test cases.
 *
 * CSS:
 * - If expected contains `{` → normalized full-source match (or expectedHash).
 * - Else if lines look like `prop: value` → property checklist (flexible formatting).
 * HTML:
 * - Markup expected → source match / hash.
 * - Plain text → body textContent.
 */
export function runHtmlCssTests(options: {
  language: CodeLanguage | string;
  code: string;
  tests: HtmlCssTestInput[];
}): WorkerTestResult[] {
  const language = options.language === "css" ? "css" : "html";
  const code = options.code ?? "";

  return options.tests.map((t) => {
    const expected = t.expectedStdout ?? "";
    let actual = "";
    let passed = false;

    try {
      if (language === "css") {
        if (parseComputedStyleExpectations(expected).length > 0) {
          const r = gradeComputedStyles("css", code, t.stdin, expected);
          actual = r.actual;
          passed = r.passed;
        } else if (isCssPropertyChecklist(expected)) {
          const r = gradeCssProperties(code, expected);
          actual = r.actual;
          passed = r.passed;
        } else if (expected.trim()) {
          actual = normalizeMarkupSource(code);
          passed = actual === normalizeMarkupSource(expected);
        } else if (t.expectedHash) {
          actual = normalizeMarkupSource(code);
          passed = hashNormalizedSource(actual) === t.expectedHash;
        } else {
          actual = normalizeMarkupSource(code);
          passed = false;
        }
      } else if (parseComputedStyleExpectations(expected).length > 0) {
        const r = gradeComputedStyles("html", code, t.stdin, expected);
        actual = r.actual;
        passed = r.passed;
      } else if (expected.trim() && looksLikeMarkup(expected)) {
        actual = normalizeMarkupSource(code);
        passed = actual === normalizeMarkupSource(expected);
      } else if (!expected.trim() && t.expectedHash) {
        actual = normalizeMarkupSource(code);
        passed = hashNormalizedSource(actual) === t.expectedHash;
      } else if (expected.trim()) {
        const srcdoc = buildHtmlCssSrcdoc("html", code, t.stdin);
        actual = bodyTextFromHtml(srcdoc);
        passed = actual === normalizeStdout(expected);
      } else {
        actual = "";
        passed = false;
      }
    } catch (e) {
      return {
        testId: t.id,
        passed: false,
        stdout: actual,
        stderr: "",
        error: e instanceof Error ? e.message : "HTML/CSS grade failed",
      };
    }

    return {
      testId: t.id,
      passed,
      stdout: actual,
      stderr: "",
    };
  });
}
