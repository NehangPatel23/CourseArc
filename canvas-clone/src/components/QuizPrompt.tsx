import { useMemo } from "react";
import katex from "katex";

type Props = {
  text: string;
  className?: string;
};

/** Render quiz prompt text with inline `$…$` and block `$$…$$` LaTeX (KaTeX). */
export default function QuizPrompt({ text, className = "" }: Props) {
  const html = useMemo(() => renderQuizPromptHtml(text), [text]);

  if (!html) {
    return <span className={`italic text-gray-400 ${className}`}>Untitled question</span>;
  }

  return (
    <div
      className={`quiz-prompt whitespace-pre-wrap text-sm leading-relaxed text-canvas-grayDark [&_.katex-display]:my-2 [&_.katex]:text-[1em] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderQuizPromptHtml(raw: string): string {
  if (!raw?.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return escapeAndPreserveHtml(raw);
  }

  const parts: string[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw.startsWith("$$", i)) {
      const end = raw.indexOf("$$", i + 2);
      if (end > i) {
        parts.push(renderLatex(raw.slice(i + 2, end), true));
        i = end + 2;
        continue;
      }
    }
    if (raw[i] === "$") {
      const end = raw.indexOf("$", i + 1);
      if (end > i) {
        parts.push(renderLatex(raw.slice(i + 1, end), false));
        i = end + 1;
        continue;
      }
    }
    const nextBlock = raw.indexOf("$$", i);
    const nextInline = raw.indexOf("$", i);
    let next = raw.length;
    if (nextBlock >= 0) next = Math.min(next, nextBlock);
    if (nextInline >= 0) next = Math.min(next, nextInline);
    parts.push(escapeText(raw.slice(i, next)));
    i = next;
  }
  return parts.join("");
}

function renderLatex(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      throwOnError: false,
      displayMode: display,
    });
  } catch {
    return escapeText(latex);
  }
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAndPreserveHtml(html: string): string {
  return html;
}
