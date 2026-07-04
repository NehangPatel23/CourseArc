import { useMemo, useRef, useState, type ComponentType } from "react";
import { useParams } from "react-router-dom";
import { Editor as TinyMCEEditorRaw } from "@tinymce/tinymce-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import EquationModal from "./EquationModal";
import CourseLinkModal from "./CourseLinkModal";
import { buildLinkHtml } from "../utils/courseLinks";
import {
  buildEquationHtml,
  decodeLatexAttr,
  encodeLatexAttr,
  insertInlineAtomAtCaret,
  isBlockEquation,
  registerInlineAtomCursorHandlers,
  unwrapAtomFromHost,
  wrapAtomInHost,
  registerRichContentEditorButtons,
  registerRichContentEditorKeyHandlers,
  registerInlineCodeFormats,
  renderEquationsInEditor,
  renderRichContentInEditor,
  TINYMCE_API_KEY,
  TINYMCE_BLOCK_FORMATS,
  TINYMCE_CONTENT_STYLE,
  TINYMCE_PLUGINS,
  TINYMCE_TOOLBAR,
} from "../utils/richContent";
import { CODESAMPLE_LANGUAGES, getTinyMceCodeValidClasses } from "../utils/codeHighlight";

const Editor = TinyMCEEditorRaw as unknown as ComponentType<any>;

type Props = {
  /** Initial HTML when the editor mounts (or when mountKey changes). Not synced after that. */
  value: string;
  onChange: (html: string) => void;
  height?: number;
  disabled?: boolean;
  label?: string;
  courseId?: string;
  /** Remount editor when switching pages or reloading saved content */
  mountKey?: string;
};

export default function RichContentEditor({
  value,
  onChange,
  height = 420,
  disabled = false,
  label,
  courseId: courseIdProp,
  mountKey,
}: Props) {
  const { courseId: routeCourseId } = useParams();
  const courseId = courseIdProp ?? routeCourseId ?? "default";

  const editorRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editingEquationElRef = useRef<HTMLElement | null>(null);
  const selectionBookmarkRef = useRef<any>(null);
  const [showEquationModal, setShowEquationModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [pendingInitialLatex, setPendingInitialLatex] = useState("");
  const [pendingEquationDisplay, setPendingEquationDisplay] = useState<"inline" | "block">("inline");
  const [pendingLinkText, setPendingLinkText] = useState("");

  const editorInstanceKey = mountKey ?? "default-editor";

  // TinyMCE React resets the iframe when `initialValue` changes — freeze it per mount.
  const initialHtmlRef = useRef(value);
  const prevInstanceKeyRef = useRef(editorInstanceKey);
  if (prevInstanceKeyRef.current !== editorInstanceKey) {
    prevInstanceKeyRef.current = editorInstanceKey;
    initialHtmlRef.current = value;
  }

  const handlersRef = useRef({
    openEquationInsert: () => {},
    openEquationEdit: (_el: HTMLElement) => {},
    openCourseLinkInsert: () => {},
  });

  const saveSelectionBookmark = () => {
    const editor = editorRef.current;
    if (!editor?.selection?.getBookmark) {
      selectionBookmarkRef.current = null;
      return;
    }
    try {
      selectionBookmarkRef.current = editor.selection.getBookmark(2, true);
    } catch {
      selectionBookmarkRef.current = null;
    }
  };

  const restoreSelectionBookmark = () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      editor.focus();
      if (selectionBookmarkRef.current && editor.selection?.moveToBookmark) {
        editor.selection.moveToBookmark(selectionBookmarkRef.current);
      }
    } catch {}
  };

  handlersRef.current.openEquationInsert = () => {
    editingEquationElRef.current = null;
    saveSelectionBookmark();
    const selectedText = editorRef.current?.selection?.getContent?.({ format: "text" }) ?? "";
    setPendingInitialLatex(selectedText || "");
    setPendingEquationDisplay("inline");
    setShowEquationModal(true);
  };

  handlersRef.current.openCourseLinkInsert = () => {
    saveSelectionBookmark();
    const selectedText = editorRef.current?.selection?.getContent?.({ format: "text" }) ?? "";
    setPendingLinkText(selectedText.trim());
    setShowLinkModal(true);
  };

  handlersRef.current.openEquationEdit = (equationEl: HTMLElement) => {
    editingEquationElRef.current = equationEl;
    saveSelectionBookmark();
    setPendingInitialLatex(decodeLatexAttr(equationEl.getAttribute("data-latex") || "").trim());
    setPendingEquationDisplay(isBlockEquation(equationEl) ? "block" : "inline");
    setShowEquationModal(true);
  };

  const insertLink = (href: string, text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelectionBookmark();
    const html = buildLinkHtml(href, text);
    if (editor.undoManager?.transact) {
      editor.undoManager.transact(() => editor.insertContent(html));
    } else {
      editor.insertContent(html);
    }
    onChangeRef.current(editor.getContent());
    selectionBookmarkRef.current = null;
  };

  const insertNewEquation = (latex: string, display: "inline" | "block") => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelectionBookmark();
    const html = buildEquationHtml(latex, display);
    if (display === "inline") {
      const insert = () => insertInlineAtomAtCaret(editor, html, ".canvas-equation-inline");
      if (editor.undoManager?.transact) {
        editor.undoManager.transact(insert);
      } else {
        insert();
      }
    } else {
      const insert = () => editor.insertContent(html);
      if (editor.undoManager?.transact) {
        editor.undoManager.transact(insert);
      } else {
        insert();
      }
    }
    renderEquationsInEditor(editor);
    onChangeRef.current(editor.getContent());
    selectionBookmarkRef.current = null;
  };

  const updateExistingEquation = (
    equationEl: HTMLElement,
    latex: string,
    display: "inline" | "block",
  ) => {
    equationEl.setAttribute("data-latex", encodeLatexAttr(latex));
    if (display === "block") {
      equationEl.setAttribute("data-display", "block");
      equationEl.classList.add("canvas-equation-block");
      equationEl.classList.remove("canvas-equation-inline");
    } else {
      equationEl.removeAttribute("data-display");
      equationEl.classList.remove("canvas-equation-block");
      equationEl.classList.add("canvas-equation-inline");
    }
    try {
      katex.render(latex, equationEl, {
        throwOnError: false,
        displayMode: display === "block",
      });
    } catch {
      equationEl.textContent = latex;
    }
    equationEl.setAttribute("contenteditable", "false");
    if (display === "inline") {
      wrapAtomInHost(equationEl);
    } else {
      unwrapAtomFromHost(equationEl);
    }
    if (editorRef.current) onChangeRef.current(editorRef.current.getContent());
  };

  const handleEquationModalInsert = (latex: string, display: "inline" | "block") => {
    const editingEl = editingEquationElRef.current;
    if (editingEl) updateExistingEquation(editingEl, latex, display);
    else insertNewEquation(latex, display);
    editingEquationElRef.current = null;
    selectionBookmarkRef.current = null;
    setShowEquationModal(false);
  };

  const toolbar = courseId
    ? TINYMCE_TOOLBAR
    : TINYMCE_TOOLBAR.replace(" courseLink", "");

  const editorInit = useMemo(
    () => ({
      height,
      menubar: height >= 300,
      block_formats: TINYMCE_BLOCK_FORMATS,
      extended_valid_elements:
        "span[class|data-latex|data-display|data-code|data-language|contenteditable],a[href|target|rel],pre[class|data-language|contenteditable],code[class|data-language|contenteditable]",
      custom_elements: "span",
      noneditable_class: "canvas-equation canvas-inline-code",
      codesample_languages: CODESAMPLE_LANGUAGES,
      valid_classes: getTinyMceCodeValidClasses(),
      plugins: TINYMCE_PLUGINS,
      toolbar,
      content_css: [
        "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css",
        "https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css",
      ],
      content_style:
        TINYMCE_CONTENT_STYLE + " a { color: #008EE2; text-decoration: underline; }",
      branding: false,
      statusbar: height >= 300,
      setup: (editor: any) => {
        editor.on("init", () => renderRichContentInEditor(editor));
        registerRichContentEditorButtons(editor, {
          openEquationInsert: () => handlersRef.current.openEquationInsert(),
          openEquationEdit: (el) => handlersRef.current.openEquationEdit(el),
          openCourseLinkInsert: courseId
            ? () => handlersRef.current.openCourseLinkInsert()
            : undefined,
        });
        registerInlineCodeFormats(editor);
        registerRichContentEditorKeyHandlers(editor);
        registerInlineAtomCursorHandlers(editor);
        editor.on("dblclick", (e: any) => {
          const eq = (e?.target as HTMLElement)?.closest?.(".canvas-equation") as HTMLElement | null;
          if (eq) {
            e.preventDefault?.();
            handlersRef.current.openEquationEdit(eq);
          }
        });
        editor.on("click", (e: any) => {
          const body = editor.getBody();
          body?.querySelectorAll(".canvas-equation.is-selected").forEach((n: Element) =>
            n.classList.remove("is-selected"),
          );
          const eq = (e?.target as HTMLElement)?.closest?.(".canvas-equation") as HTMLElement | null;
          if (eq) eq.classList.add("is-selected");
        });
      },
    }),
    [height, toolbar, courseId],
  );

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : ""}>
      {label && <div className="form-label mb-2 !text-sm !font-medium">{label}</div>}
      <div className="overflow-hidden rounded-lg border border-canvas-border bg-white">
        <Editor
          key={editorInstanceKey}
          apiKey={TINYMCE_API_KEY}
          initialValue={initialHtmlRef.current}
          disabled={disabled}
          onInit={(_evt: unknown, editor: any) => {
            editorRef.current = editor;
          }}
          onEditorChange={(html: string) => {
            onChangeRef.current(html);
          }}
          init={editorInit}
        />
      </div>
      <EquationModal
        isOpen={showEquationModal}
        initialLatex={pendingInitialLatex}
        initialDisplay={pendingEquationDisplay}
        onInsert={handleEquationModalInsert}
        onClose={() => {
          editingEquationElRef.current = null;
          selectionBookmarkRef.current = null;
          setShowEquationModal(false);
          try {
            editorRef.current?.focus?.();
          } catch {}
        }}
      />
      {courseId && (
        <CourseLinkModal
          isOpen={showLinkModal}
          courseId={courseId}
          initialText={pendingLinkText}
          onInsert={insertLink}
          onClose={() => {
            selectionBookmarkRef.current = null;
            setShowLinkModal(false);
            try {
              editorRef.current?.focus?.();
            } catch {}
          }}
        />
      )}
    </div>
  );
}
