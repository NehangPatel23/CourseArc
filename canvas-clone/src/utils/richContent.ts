import katex from "katex";
import { CODE_LANGUAGE_OPTIONS, encodeCodeAttr, highlightCodeInContainer } from "./codeHighlight";

export function encodeLatexAttr(latex: string) {
  return latex
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function wrapPlainTextAsHtml(text: string | undefined): string {
  if (!text?.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
}

export type EquationDisplay = "inline" | "block";

type TinyMceEditorLike = {
  dom: {
    create: (tag: string, attrs?: Record<string, string>, html?: string) => HTMLElement;
    createRng: () => Range;
    getParent: (node: Node | null, selector: string) => HTMLElement | null;
    insertAfter: (node: Node, target: Node) => void;
  };
  selection: {
    getNode: () => Node;
    getRng: () => Range;
    setCursorLocation: (node: Node, offset: number) => void;
    setRng: (rng: Range) => void;
  };
  undoManager?: { transact: (fn: () => void) => void };
  on: (name: string, handler: (...args: unknown[]) => void) => void;
  getDoc: () => Document;
};

export function isBlockEquation(el: HTMLElement): boolean {
  return (
    el.getAttribute("data-display") === "block" || el.classList.contains("canvas-equation-block")
  );
}

export function decodeLatexAttr(encoded: string): string {
  return encoded
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function renderEquationsInContainer(root: HTMLElement | null) {
  if (!root) return;
  const nodes = root.querySelectorAll(
    "[data-latex].canvas-equation, [data-latex].canvas-equation-inline, [data-latex].canvas-equation-block, span[data-latex]",
  ) as NodeListOf<HTMLElement>;

  nodes.forEach((el) => {
    const attrLatex = el.getAttribute("data-latex");
    let latex = attrLatex ? decodeLatexAttr(attrLatex).trim() : "";
    if (!latex) {
      latex = (el.textContent || "").replace(/[\u200B\uFEFF]/g, "").trim();
    }
    if (!latex) return;

    el.setAttribute("data-latex", encodeLatexAttr(latex));
    el.setAttribute("contenteditable", "false");
    el.classList.add("canvas-equation");

    const displayBlock = isBlockEquation(el);
    if (displayBlock) {
      el.classList.add("canvas-equation-block");
      el.classList.remove("canvas-equation-inline");
    } else {
      el.classList.remove("canvas-equation-block");
      el.classList.add("canvas-equation-inline");
    }

    try {
      katex.render(latex, el, { throwOnError: false, displayMode: displayBlock });
    } catch {
      el.textContent = latex;
    }
  });
}

export function renderRichContentInContainer(root: HTMLElement | null) {
  if (!root) return;
  highlightCodeInContainer(root);
  renderEquationsInContainer(root);
}

export function renderRichContentInEditor(editor: { getBody?: () => HTMLElement }) {
  if (!editor?.getBody) return;
  const body = editor.getBody();
  renderRichContentInContainer(body);
  normalizeInlineHosts(body);
}

export function renderEquationsInEditor(editor: { getBody?: () => HTMLElement }) {
  renderRichContentInEditor(editor);
}

/** Invisible padding inside editable inline hosts so spaces/caret survive beside atoms. */
export const INLINE_HOST_CLASS = "canvas-inline-host";
const INLINE_HOST_PAD = "\uFEFF";

function wrapInlineAtomHtml(innerHtml: string): string {
  return `<span class="${INLINE_HOST_CLASS}">${INLINE_HOST_PAD}${innerHtml}${INLINE_HOST_PAD}</span>`;
}

export function buildEquationHtml(latex: string, display: EquationDisplay = "inline") {
  const encoded = encodeLatexAttr(latex);
  const isBlock = display === "block";
  if (isBlock) {
    return `<span class="canvas-equation canvas-equation-block" data-latex="${encoded}" data-display="block" contenteditable="false">&#8203;</span>`;
  }
  const inner = `<span class="canvas-equation canvas-equation-inline" data-latex="${encoded}" contenteditable="false">&#8203;</span>`;
  return wrapInlineAtomHtml(inner);
}

export const TINYMCE_BLOCK_FORMATS =
  "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Preformatted=pre";

/** Shared code styling for editor iframe */
export const RICH_CONTENT_CODE_CSS =
  "code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; } " +
  "span.canvas-inline-code { display:inline !important; padding:0.125rem 0.375rem; background:#f5f2f0; border-radius:0.25rem; vertical-align:baseline; white-space:normal; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:0.9em; line-height:1.4; float:none; clear:none; } " +
  "span.canvas-inline-code.mce-noneditable, span.canvas-equation-inline.mce-noneditable { display:inline !important; float:none; clear:none; } " +
  `span.${INLINE_HOST_CLASS} { display:inline !important; white-space:normal; line-height:inherit; vertical-align:baseline; float:none; clear:none; } ` +
  "span.canvas-inline-code .token { font-family:inherit; font-size:inherit; } " +
  "pre[class*='language-'] { display:block; width:max-content; max-width:100%; box-sizing:border-box; margin:0.75rem 0; padding:0.75rem; background:#f9fafb; border-radius:0.375rem; overflow-x:auto; white-space:pre; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:0.875rem; line-height:1.5; } " +
  "pre[class*='language-'] code { display:block; background:transparent; padding:0; border-radius:0; font-size:inherit; white-space:inherit; } " +
  "code.canvas-inline-code-block { display:inline-block; width:max-content; max-width:100%; box-sizing:border-box; margin:0.15rem 0; padding:0.625rem 0.75rem; background:#f9fafb; border-radius:0.375rem; overflow-x:auto; white-space:pre; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:0.875rem; vertical-align:top; } ";

/** Tailwind classes for read-only rich content viewers */
export const RICH_CONTENT_VIEWER_CODE_CLASSES = [
  "[&_span.canvas-inline-code]:inline [&_span.canvas-inline-code]:align-baseline [&_span.canvas-inline-code]:rounded [&_span.canvas-inline-code]:bg-[#f5f2f0] [&_span.canvas-inline-code]:px-1.5 [&_span.canvas-inline-code]:py-0.5 [&_span.canvas-inline-code]:font-mono [&_span.canvas-inline-code]:text-[0.9em] [&_span.canvas-inline-code]:leading-snug",
  "[&_code.canvas-inline-code]:inline [&_code.canvas-inline-code]:align-baseline [&_code.canvas-inline-code]:rounded [&_code.canvas-inline-code]:bg-[#f5f2f0] [&_code.canvas-inline-code]:px-1.5 [&_code.canvas-inline-code]:py-0.5 [&_code.canvas-inline-code]:font-mono [&_code.canvas-inline-code]:text-[0.9em]",
  "[&_pre[class*='language-']]:block [&_pre[class*='language-']]:w-max [&_pre[class*='language-']]:max-w-full [&_pre[class*='language-']]:my-3 [&_pre[class*='language-']]:overflow-x-auto [&_pre[class*='language-']]:rounded-md [&_pre[class*='language-']]:bg-gray-50 [&_pre[class*='language-']]:p-3 [&_pre[class*='language-']]:font-mono [&_pre[class*='language-']]:text-sm [&_pre[class*='language-']]:leading-relaxed",
  "[&_pre[class*='language-']_code]:block [&_pre[class*='language-']_code]:bg-transparent [&_pre[class*='language-']_code]:p-0",
  "[&_code.canvas-inline-code-block]:inline-block [&_code.canvas-inline-code-block]:w-max [&_code.canvas-inline-code-block]:max-w-full [&_code.canvas-inline-code-block]:align-top [&_code.canvas-inline-code-block]:my-1 [&_code.canvas-inline-code-block]:overflow-x-auto [&_code.canvas-inline-code-block]:rounded-md [&_code.canvas-inline-code-block]:bg-gray-50 [&_code.canvas-inline-code-block]:px-3 [&_code.canvas-inline-code-block]:py-2 [&_code.canvas-inline-code-block]:font-mono [&_code.canvas-inline-code-block]:text-sm [&_code.canvas-inline-code-block]:whitespace-pre",
].join(" ");

export const TINYMCE_PLUGINS =
  "preview searchreplace autolink directionality visualblocks visualchars fullscreen image link media template codesample table charmap hr pagebreak nonbreaking anchor lists wordcount help";

export const TINYMCE_TOOLBAR =
  "undo redo | blocks | bold italic underline strikethrough | inlineCode codeLanguagePicker codeBlock | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link courseLink image media | forecolor backcolor removeformat | codesample equationEditor | fullscreen preview | help";

export const TINYMCE_CONTENT_STYLE =
  "body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; color:#2D3B45; } " +
  "h1 { font-size:1.875rem; font-weight:600; margin:1rem 0; } " +
  "h2 { font-size:1.5rem; font-weight:600; margin:1rem 0; } " +
  "h3 { font-size:1.25rem; font-weight:600; margin:0.75rem 0; } " +
  "h4 { font-size:1.125rem; font-weight:600; margin:0.75rem 0; } " +
  RICH_CONTENT_CODE_CSS +
  ".canvas-equation-inline, .canvas-equation:not(.canvas-equation-block) { display:inline !important; margin:0; padding:0 1px; vertical-align:baseline; line-height:inherit; white-space:normal; cursor:pointer; border-radius:4px; float:none; clear:none; } " +
  ".canvas-equation-inline .katex, .canvas-equation:not(.canvas-equation-block) .katex { display:inline-block; vertical-align:baseline; font-size:1em; } " +
  ".canvas-equation-block { display:block; width:100%; text-align:center; margin:0.75rem 0; padding:0.5rem 0; cursor:pointer; border-radius:4px; } " +
  ".canvas-equation-block .katex { display:block; margin:0 auto; } " +
  ".canvas-equation:hover { background: rgba(0, 142, 226, 0.10); } " +
  ".canvas-equation.is-selected { outline: 2px solid rgba(0, 142, 226, 0.35); outline-offset: 1px; } " +
  ".canvas-equation * { pointer-events: none; }";

export const TINYMCE_API_KEY = "f4ktyvw5hm8w3xm00gwdjztgrl93k06t3vt9wng4uc08m87s";

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInlineCodeHtml(text: string, lang: string) {
  const encoded = encodeCodeAttr(text);
  const effective = lang || "plaintext";
  const inner = `<span class="canvas-inline-code" data-code="${encoded}" data-language="${effective}" contenteditable="false">&#8203;</span>`;
  return wrapInlineAtomHtml(inner);
}

function isBlockLikeSibling(node: Node | null): boolean {
  if (!node) return true;
  if (node.nodeName === "BR") return true;
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = (node as HTMLElement).tagName;
  return /^(P|DIV|H[1-6]|PRE|UL|OL|LI|TABLE|BLOCKQUOTE|HR)$/i.test(tag);
}

export function wrapAtomInHost(atom: HTMLElement): HTMLElement {
  const existing = atom.closest(`.${INLINE_HOST_CLASS}`);
  if (existing) return existing as HTMLElement;

  const doc = atom.ownerDocument;
  const host = doc.createElement("span");
  host.className = INLINE_HOST_CLASS;
  atom.parentNode!.insertBefore(host, atom);
  host.appendChild(doc.createTextNode(INLINE_HOST_PAD));
  host.appendChild(atom);
  host.appendChild(doc.createTextNode(INLINE_HOST_PAD));
  return host;
}

export function unwrapAtomFromHost(atom: HTMLElement) {
  const host = atom.closest(`.${INLINE_HOST_CLASS}`);
  if (!host?.parentNode) return;
  host.parentNode.insertBefore(atom, host);
  host.remove();
}

export function wrapLegacyInlineAtoms(root: HTMLElement | null) {
  if (!root) return;
  root.querySelectorAll(".canvas-equation-inline, span.canvas-inline-code[data-code]").forEach((node) => {
    const atom = node as HTMLElement;
    if (atom.closest(`.${INLINE_HOST_CLASS}`)) return;
    wrapAtomInHost(atom);
  });
}

function normalizeInlineHost(host: HTMLElement) {
  const atom = host.querySelector(":scope > .canvas-equation-inline, :scope > span.canvas-inline-code");
  if (!atom) return;
  if (!atom.previousSibling || atom.previousSibling.nodeType !== Node.TEXT_NODE) {
    atom.before(host.ownerDocument.createTextNode(INLINE_HOST_PAD));
  }
  if (!atom.nextSibling || atom.nextSibling.nodeType !== Node.TEXT_NODE) {
    atom.after(host.ownerDocument.createTextNode(INLINE_HOST_PAD));
  }
}

export function normalizeInlineHosts(root: HTMLElement | null) {
  if (!root) return;
  wrapLegacyInlineAtoms(root);
  root.querySelectorAll(`.${INLINE_HOST_CLASS}`).forEach((host) => normalizeInlineHost(host as HTMLElement));
}

function paragraphMeaningfulChildren(p: HTMLElement): ChildNode[] {
  return Array.from(p.childNodes).filter((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      return (n.textContent?.replace(/[\u200B\uFEFF]/g, "") ?? "").length > 0;
    }
    if (n.nodeType === Node.ELEMENT_NODE) {
      return !(n as HTMLElement).getAttribute("data-mce-bogus");
    }
    return true;
  });
}

/** Merge paragraphs that only contain a lone inline host back into adjacent text. */
function coalesceOrphanAtomParagraphs(body: HTMLElement | null) {
  if (!body) return;
  let changed = true;
  while (changed) {
    changed = false;
    body.querySelectorAll("p").forEach((p) => {
      const meaningful = paragraphMeaningfulChildren(p);
      const isOnlyHost =
        meaningful.length === 1 &&
        meaningful[0].nodeType === Node.ELEMENT_NODE &&
        (meaningful[0] as HTMLElement).classList.contains(INLINE_HOST_CLASS);
      if (!isOnlyHost) return;

      const prev = p.previousElementSibling as HTMLElement | null;
      if (prev?.tagName === "P") {
        while (p.firstChild) prev.appendChild(p.firstChild);
        p.remove();
        changed = true;
        return;
      }

      const next = p.nextElementSibling as HTMLElement | null;
      if (next?.tagName === "P") {
        while (next.firstChild) p.appendChild(next.firstChild);
        next.remove();
        changed = true;
      }
    });
  }
}

export function insertInlineHtmlAtCaret(
  editor: TinyMceEditorLike & { getBody?: () => HTMLElement; focus?: () => void },
  html: string,
) {
  const doc = editor.getDoc();
  const rng = editor.selection.getRng();
  if (!rng.collapsed) rng.deleteContents();

  const holder = doc.createElement("div");
  holder.innerHTML = html;
  const nodes = Array.from(holder.childNodes);
  if (!nodes.length) return;

  const { startContainer, startOffset } = rng;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer as Text;
    const parent = text.parentNode;
    if (!parent) return;
    const after = startOffset < text.length ? text.splitText(startOffset) : null;
    if (after) {
      nodes.forEach((n) => parent.insertBefore(n, after));
    } else {
      nodes.forEach((n) => parent.appendChild(n));
    }
  } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const el = startContainer as HTMLElement;
    const ref = el.childNodes[startOffset] ?? null;
    nodes.forEach((n) => el.insertBefore(n, ref));
  }
}

export function insertInlineAtomAtCaret(
  editor: TinyMceEditorLike & { getBody?: () => HTMLElement; focus?: () => void },
  html: string,
  atomSelector: string,
) {
  const run = () => {
    insertInlineHtmlAtCaret(editor, html);
    coalesceOrphanAtomParagraphs(editor.getBody?.() ?? null);
  };

  if (editor.undoManager?.transact) editor.undoManager.transact(run);
  else run();

  placeCursorAfterInlineAtom(editor, atomSelector);
}

/** @deprecated Use normalizeInlineHosts — kept for callers that only need a trailing text node. */
export function ensureCursorTailAfter(atom: Element) {
  const host = atom.closest(`.${INLINE_HOST_CLASS}`);
  if (host) {
    normalizeInlineHost(host as HTMLElement);
    return;
  }
  const next = atom.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE) return;
  if (!next || isBlockLikeSibling(next)) {
    atom.after(atom.ownerDocument.createTextNode(INLINE_HOST_PAD));
  }
}

export function placeCursorAfterInlineAtom(
  editor: TinyMceEditorLike & { getBody?: () => HTMLElement; focus?: () => void },
  atomSelector: string,
) {
  const body = editor.getBody?.();
  if (!body) return;

  const node = editor.selection.getNode();
  let atom = editor.dom.getParent(node, atomSelector) as HTMLElement | null;
  if (!atom) {
    const matches = body.querySelectorAll(atomSelector);
    atom = matches[matches.length - 1] as HTMLElement | null;
  }
  if (!atom) return;

  const host = atom.closest(`.${INLINE_HOST_CLASS}`) as HTMLElement | null;
  if (host) {
    normalizeInlineHost(host);
    const tail = atom.nextSibling;
    if (tail?.nodeType === Node.TEXT_NODE) {
      editor.selection.setCursorLocation(tail, tail.textContent?.length ?? 0);
      editor.focus?.();
      return;
    }
  }

  ensureCursorTailAfter(atom);
  const tail = atom.nextSibling;
  if (tail?.nodeType === Node.TEXT_NODE) {
    editor.selection.setCursorLocation(tail, tail.textContent?.length ?? 0);
  } else {
    const text = editor.getDoc().createTextNode(INLINE_HOST_PAD);
    editor.dom.insertAfter(text, atom);
    editor.selection.setCursorLocation(text, 1);
  }
  editor.focus?.();
}

function buildPreCodeHtml(text: string, lang: string) {
  const effectiveLang = !lang || lang === "plaintext" ? "text" : lang;
  const body = escapeHtmlText(text);
  return `<pre class="language-${effectiveLang}" data-language="${effectiveLang}"><code class="language-${effectiveLang}">${body}</code></pre>`;
}

export function registerInlineCodeFormats(editor: {
  dom: {
    getParent: (node: Node | null, selector: string) => HTMLElement | null;
    remove: (node: Node, keepChildren?: boolean) => HTMLElement;
  };
  ui: {
    registry: {
      addToggleButton: (name: string, spec: Record<string, unknown>) => void;
      addButton: (name: string, spec: Record<string, unknown>) => void;
      addMenuButton: (name: string, spec: Record<string, unknown>) => void;
    };
  };
  selection: {
    getContent: (opts?: { format: string }) => string;
    getNode: () => Node;
  };
  insertContent: (html: string, args?: Record<string, unknown>) => void;
  getBody?: () => HTMLElement;
  on: (name: string, handler: (...args: unknown[]) => void) => void;
  off: (name: string, handler: (...args: unknown[]) => void) => void;
}) {
  let selectedLanguage = "javascript";

  editor.ui.registry.addMenuButton("codeLanguagePicker", {
    text: "Lang",
    tooltip: "Code language for syntax highlighting",
    fetch: (callback: (items: Array<Record<string, unknown>>) => void) => {
      callback(
        CODE_LANGUAGE_OPTIONS.map((opt) => ({
          type: "menuitem",
          text: opt.text,
          onAction: () => {
            selectedLanguage = opt.value;
          },
        })),
      );
    },
  });

  const isInInlineCode = () => {
    const node = editor.selection.getNode();
    return !!editor.dom.getParent(node, "span.canvas-inline-code");
  };

  const toggleInlineCode = () => {
    const node = editor.selection.getNode();
    const existing = editor.dom.getParent(node, "span.canvas-inline-code");
    if (existing) {
      editor.dom.remove(existing, true);
      return;
    }
    const selected = editor.selection.getContent({ format: "text" });
    if (!selected) return;
    insertInlineAtomAtCaret(
      editor as unknown as TinyMceEditorLike & { getBody?: () => HTMLElement; focus?: () => void },
      buildInlineCodeHtml(selected, selectedLanguage),
      "span.canvas-inline-code",
    );
    highlightCodeInContainer(editor.getBody?.() ?? null);
  };

  editor.ui.registry.addToggleButton("inlineCode", {
    icon: "sourcecode",
    tooltip: "Inline code snippet",
    onAction: toggleInlineCode,
    onSetup: (api: { setActive: (active: boolean) => void }) => {
      const sync = () => api.setActive(isInInlineCode());
      editor.on("NodeChange", sync);
      sync();
      return () => editor.off("NodeChange", sync);
    },
  });

  editor.ui.registry.addButton("codeBlock", {
    icon: "codesample",
    tooltip: "Insert code block (uses Lang menu)",
    onAction: () => {
      const selected = editor.selection.getContent({ format: "text" }).trim() || "code";
      editor.insertContent(buildPreCodeHtml(selected, selectedLanguage));
      highlightCodeInContainer(editor.getBody?.() ?? null);
    },
  });
}

export function registerRichContentEditorButtons(
  editor: {
    ui: {
      registry: {
        addButton: (name: string, spec: Record<string, unknown>) => void;
        addMenuItem: (name: string, spec: Record<string, unknown>) => void;
        addContextMenu: (name: string, spec: Record<string, unknown>) => void;
      };
    };
    on: (name: string, handler: (...args: unknown[]) => void) => void;
    selection: { getNode: () => HTMLElement };
  },
  handlers: {
    openEquationInsert: () => void;
    openEquationEdit: (el: HTMLElement) => void;
    openCourseLinkInsert?: () => void;
  },
) {
  editor.ui.registry.addButton("equationEditor", {
    text: "Σ",
    tooltip: "Insert math equation",
    onAction: handlers.openEquationInsert,
  });

  if (handlers.openCourseLinkInsert) {
    editor.ui.registry.addButton("courseLink", {
      text: "Internal link",
      tooltip: "Link to course pages, files, modules, and more",
      onAction: handlers.openCourseLinkInsert,
    });
  }

  editor.ui.registry.addContextMenu("equationMenu", {
    update: (element: HTMLElement) =>
      element.closest?.(".canvas-equation") ? "editEquation" : "",
  });
  editor.ui.registry.addMenuItem("editEquation", {
    text: "Edit equation",
    onAction: () => {
      const eq = editor.selection.getNode()?.closest?.(".canvas-equation") as HTMLElement | null;
      if (eq) handlers.openEquationEdit(eq);
    },
  });
}

function findCodeBlockContainer(editor: TinyMceEditorLike, node: Node | null): HTMLElement | null {
  if (!node) return null;
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  return editor.dom.getParent(element, "pre");
}

function isCaretAtEndOfCodeBlock(editor: TinyMceEditorLike, block: HTMLElement): boolean {
  const rng = editor.selection.getRng();
  if (!rng.collapsed) return false;

  const tail = editor.dom.createRng();
  tail.setStart(rng.endContainer, rng.endOffset);
  tail.setEndAfter(block.lastChild ?? block);
  return tail.toString().replace(/[\u00a0\u200B]/g, "").length === 0;
}

function insertParagraphAfterCodeBlock(editor: TinyMceEditorLike, block: HTMLElement) {
  const run = () => {
    const next = block.nextElementSibling;
    if (next?.tagName === "P") {
      editor.selection.setCursorLocation(next, 0);
      return;
    }

    const paragraph = editor.dom.create("p", {}, '<br data-mce-bogus="1">');
    editor.dom.insertAfter(paragraph, block);
    editor.selection.setCursorLocation(paragraph, 0);
  };

  if (editor.undoManager?.transact) editor.undoManager.transact(run);
  else run();
}

function insertNewlineInCodeBlock(editor: TinyMceEditorLike) {
  const doc = editor.getDoc();
  const text = doc.createTextNode("\n");
  const rng = editor.selection.getRng();
  rng.deleteContents();
  rng.insertNode(text);
  rng.setStart(text, text.length);
  rng.setEnd(text, text.length);
  editor.selection.setRng(rng);
}

/** Click beside an inline atom to place the caret on the same line for typing. */
export function registerInlineAtomCursorHandlers(
  editor: TinyMceEditorLike & { getBody?: () => HTMLElement; focus?: () => void },
) {
  editor.on("click", (event: unknown) => {
    const mouseEvent = event as MouseEvent;
    const body = editor.getBody?.();
    if (!body) return;

    const target = (mouseEvent.target as HTMLElement | null)?.closest?.(
      ".canvas-equation-inline, span.canvas-inline-code",
    ) as HTMLElement | null;
    if (!target || !body.contains(target)) return;

    const host = target.closest(`.${INLINE_HOST_CLASS}`) as HTMLElement | null;
    const rect = target.getBoundingClientRect();
    const clickRight = mouseEvent.clientX >= rect.right - 4;
    const clickLeft = mouseEvent.clientX <= rect.left + 4;
    if (!clickRight && !clickLeft) return;

    if (host) {
      normalizeInlineHost(host);
      if (clickRight) {
        const tail = target.nextSibling;
        if (tail?.nodeType === Node.TEXT_NODE) {
          editor.selection.setCursorLocation(tail, tail.textContent?.length ?? 0);
          editor.focus?.();
        }
      } else {
        const head = target.previousSibling;
        if (head?.nodeType === Node.TEXT_NODE) {
          editor.selection.setCursorLocation(head, head.textContent?.length ?? 0);
          editor.focus?.();
        }
      }
      return;
    }

    if (clickRight) {
      ensureCursorTailAfter(target);
      const tail = target.nextSibling;
      if (tail?.nodeType === Node.TEXT_NODE) {
        editor.selection.setCursorLocation(tail, tail.textContent?.length ?? 0);
        editor.focus?.();
      }
      return;
    }

    const prev = target.previousSibling;
    if (!prev || prev.nodeType !== Node.TEXT_NODE) {
      target.before(target.ownerDocument.createTextNode(INLINE_HOST_PAD));
    }
    const head = target.previousSibling;
    if (head?.nodeType === Node.TEXT_NODE) {
      editor.selection.setCursorLocation(head, head.textContent?.length ?? 0);
      editor.focus?.();
    }
  });
}

/** Improve Enter behavior inside pre/inline code blocks so users can exit or add new lines. */
export function registerRichContentEditorKeyHandlers(editor: TinyMceEditorLike) {
  editor.on("keydown", (event: unknown) => {
    const keyEvent = event as KeyboardEvent;

    if (keyEvent.key === " ") {
      const rng = editor.selection.getRng();
      if (!rng.collapsed || rng.startContainer.nodeType !== Node.TEXT_NODE) return;
      const text = rng.startContainer as Text;
      if (rng.startOffset !== text.length) return;
      const next = text.nextSibling as HTMLElement | null;
      const isBeforeAtom =
        next?.classList?.contains(INLINE_HOST_CLASS) ||
        next?.classList?.contains("canvas-equation-inline") ||
        next?.classList?.contains("canvas-inline-code");
      if (!isBeforeAtom) return;
      keyEvent.preventDefault();
      text.insertData(text.length, "\u00a0");
      editor.selection.setCursorLocation(text, text.length);
      return;
    }

    if (keyEvent.key !== "Enter") return;

    const block = findCodeBlockContainer(editor, editor.selection.getNode());
    if (!block) return;

    if (keyEvent.shiftKey) {
      keyEvent.preventDefault();
      insertNewlineInCodeBlock(editor);
      return;
    }

    keyEvent.preventDefault();
    keyEvent.stopPropagation();

    if (isCaretAtEndOfCodeBlock(editor, block)) {
      insertParagraphAfterCodeBlock(editor, block);
      return;
    }

    insertNewlineInCodeBlock(editor);
  });
}
