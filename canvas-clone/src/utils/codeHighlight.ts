import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-csharp";

export const CODE_LANGUAGE_OPTIONS = [
  { text: "JavaScript", value: "javascript" },
  { text: "TypeScript", value: "typescript" },
  { text: "Python", value: "python" },
  { text: "Java", value: "java" },
  { text: "HTML", value: "markup" },
  { text: "CSS", value: "css" },
  { text: "JSON", value: "json" },
  { text: "Bash", value: "bash" },
  { text: "SQL", value: "sql" },
  { text: "C#", value: "csharp" },
  { text: "Plain text", value: "plaintext" },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGE_OPTIONS)[number]["value"];

export const CODESAMPLE_LANGUAGES: Array<{ text: string; value: string }> = [
  ...CODE_LANGUAGE_OPTIONS.filter((opt) => opt.value !== "plaintext").map((opt) => ({
    text: opt.text,
    value: opt.value,
  })),
  { text: "Plain text", value: "text" },
];

const LANGUAGE_CLASS_NAMES = CODE_LANGUAGE_OPTIONS.filter((opt) => opt.value !== "plaintext")
  .map((opt) => `language-${opt.value}`)
  .concat(["language-text"]);

/** TinyMCE strips unknown classes — whitelist code/pre/span classes. */
export function getTinyMceCodeValidClasses(): Record<string, string> {
  return {
    code: ["canvas-inline-code", "canvas-inline-code-block", ...LANGUAGE_CLASS_NAMES].join(" "),
    pre: LANGUAGE_CLASS_NAMES.join(" "),
    span: [
      "canvas-inline-code",
      "canvas-inline-host",
      "canvas-equation",
      "canvas-equation-inline",
      "canvas-equation-block",
      ...LANGUAGE_CLASS_NAMES,
    ].join(" "),
  };
}

export function decodeCodeAttr(encoded: string): string {
  return encoded
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function encodeCodeAttr(code: string): string {
  return code
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function languageFromElement(el: HTMLElement): string | null {
  const dataLang = el.getAttribute("data-language")?.trim();
  if (dataLang) return dataLang === "text" ? "plaintext" : dataLang;
  const fromClass = el.className.match(/language-([\w-]+)/)?.[1];
  if (fromClass) return fromClass === "text" ? "plaintext" : fromClass;
  return null;
}

function highlightCodeElement(target: HTMLElement, lang: string, sourceText?: string) {
  if (!lang || lang === "plaintext" || lang === "text") return;

  const grammar = Prism.languages[lang];
  if (!grammar) return;

  const text = sourceText ?? target.textContent ?? "";
  target.innerHTML = Prism.highlight(text, grammar, lang);
  if (!target.classList.contains(`language-${lang}`)) {
    target.classList.add(`language-${lang}`);
  }
}

/** Render inline code stored in data-code attributes (survives TinyMCE save/load). */
function renderInlineCodeSnippets(root: HTMLElement) {
  root.querySelectorAll("span.canvas-inline-code[data-code]").forEach((node) => {
    const el = node as HTMLElement;
    const raw = decodeCodeAttr(el.getAttribute("data-code") || "");
    const lang = languageFromElement(el);

    if (!lang || lang === "plaintext") {
      el.textContent = raw;
      el.classList.remove(...LANGUAGE_CLASS_NAMES);
      return;
    }

    highlightCodeElement(el, lang, raw);
  });
}

/** Apply Prism syntax highlighting to code blocks inside a rendered HTML container. */
export function highlightCodeInContainer(root: HTMLElement | null) {
  if (!root) return;

  renderInlineCodeSnippets(root);

  root.querySelectorAll('pre[class*="language-"]').forEach((pre) => {
    const lang = languageFromElement(pre as HTMLElement);
    if (!lang) return;
    const code = pre.querySelector("code");
    highlightCodeElement((code ?? pre) as HTMLElement, lang);
  });

  // Legacy: inline code saved as <code> elements before span migration
  root.querySelectorAll("code:not(pre code)").forEach((codeEl) => {
    const el = codeEl as HTMLElement;
    const isLegacyInline =
      el.classList.contains("canvas-inline-code") ||
      el.classList.contains("canvas-inline-code-block") ||
      el.hasAttribute("data-language") ||
      el.className.includes("language-");
    if (!isLegacyInline) return;
    const lang = languageFromElement(el);
    if (!lang) return;
    highlightCodeElement(el, lang);
  });
}
