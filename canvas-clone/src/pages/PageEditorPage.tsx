import {
  useState,
  useEffect,
  useRef,
  type ComponentType,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import EquationModal from "../components/EquationModal";
import { Editor as TinyMCEEditorRaw } from "@tinymce/tinymce-react";
import katex from "katex";
import { CheckCircle2, Circle, Lock } from "lucide-react";

import {
  loadModulesFromStorage,
  slugifyLabel,
  type ModuleT,
} from "../utils/modules";
import {
  loadProgress,
  saveProgress,
  getItemCompleted,
  setItemCompleted,
  getModuleCompletion,
  isItemUnlocked,
  isModuleGated,
} from "../utils/progress";

const Editor = TinyMCEEditorRaw as unknown as ComponentType<any>;

type ItemRequirementType = "must_view" | "must_mark_done";

function unslugPageId(pageId?: string) {
  if (!pageId) return "Untitled Page";
  const decoded = decodeURIComponent(pageId);
  return decoded
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PageEditorPage() {
  const { courseId, pageId } = useParams();
  const navigate = useNavigate();

  const effectiveCourseId = courseId ?? "default";

  const storageKey =
    courseId && pageId ? `canvasClone:page:${courseId}:${pageId}` : undefined;

  const [title, setTitle] = useState(() => unslugPageId(pageId));
  const [content, setContent] = useState<string>("");

  const [showEquationModal, setShowEquationModal] = useState(false);
  const [pendingInitialLatex, setPendingInitialLatex] = useState<string>("");

  // If set, the modal is editing an existing equation node; if null, we’re inserting a new one.
  const editingEquationElRef = useRef<HTMLElement | null>(null);

  const editorRef = useRef<any | null>(null);

  // NEW: store selection/caret position before modal steals focus
  const selectionBookmarkRef = useRef<any | null>(null);

  // -------------------------------
  // ✅ Requirements / Progress state
  // -------------------------------
  const [modules, setModules] = useState<ModuleT[]>(() =>
    loadModulesFromStorage(),
  );
  const [progress, setProgress] = useState(() =>
    loadProgress(effectiveCourseId),
  );

  useEffect(() => {
    setModules(loadModulesFromStorage());
  }, []);

  useEffect(() => {
    setProgress(loadProgress(effectiveCourseId));
  }, [effectiveCourseId]);

  useEffect(() => {
    saveProgress(effectiveCourseId, progress);
  }, [effectiveCourseId, progress]);

  const pageOccurrences = useMemo(() => {
    if (!pageId) return [];

    const occ: Array<{
      moduleTitle: string;
      mode: "none" | "all" | "sequential";
      requirementType: ItemRequirementType;
      itemLabel: string;
    }> = [];

    for (const m of modules) {
      const mode = (m.requirementsMode ?? "none") as
        | "none"
        | "all"
        | "sequential";

      for (const it of m.items as any[]) {
        if (it?.type !== "page") continue;

        const pid = it.pageId ?? slugifyLabel(it.label);
        if (pid !== pageId) continue;

        const requirementType: ItemRequirementType =
          (it.requirementType as ItemRequirementType | undefined) ??
          "must_mark_done";

        occ.push({
          moduleTitle: m.title,
          mode,
          requirementType,
          itemLabel: it.label,
        });
      }
    }

    return occ;
  }, [modules, pageId]);

  const moduleCompletion = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getModuleCompletion>>();
    for (const m of modules) map.set(m.title, getModuleCompletion(m, progress));
    return map;
  }, [modules, progress]);

  const moduleLockedMap = useMemo(() => {
    // module is locked if ANY earlier module is gated and incomplete
    const locked = new Map<string, boolean>();
    let gatedIncompleteSeen = false;

    for (const m of modules) {
      const mode = (m.requirementsMode ?? "none") as
        | "none"
        | "all"
        | "sequential";
      const isGated = isModuleGated(mode);
      const comp = moduleCompletion.get(m.title);
      const complete = comp?.isComplete ?? true;

      locked.set(m.title, gatedIncompleteSeen);

      if (isGated && !complete) gatedIncompleteSeen = true;
    }

    return locked;
  }, [modules, moduleCompletion]);

  function canInteractOccurrence(o: (typeof pageOccurrences)[number]) {
    if (o.mode === "none") return { ok: false, reason: "not_gated" as const };

    const mod = modules.find((m) => m.title === o.moduleTitle);
    if (!mod) return { ok: false, reason: "missing_module" as const };

    const moduleLocked = moduleLockedMap.get(o.moduleTitle) ?? false;
    if (moduleLocked) return { ok: false, reason: "module_locked" as const };

    const unlocked = isItemUnlocked(mod, o.mode, progress, o.itemLabel);
    if (!unlocked) return { ok: false, reason: "item_locked" as const };

    return { ok: true, reason: "ok" as const };
  }

  // ✅ Auto-complete this page ON OPEN if requirementType === must_view (and allowed)
  useEffect(() => {
    if (!pageId) return;
    if (pageOccurrences.length === 0) return;


    setProgress((prev) => {
      let next = prev;

      for (const o of pageOccurrences) {
        if (o.requirementType !== "must_view") continue;

        const gate = canInteractOccurrence(o);
        if (!gate.ok) continue;

        const already = getItemCompleted(next, o.moduleTitle, o.itemLabel);
        if (already) continue;

        next = setItemCompleted(next, o.moduleTitle, o.itemLabel, true);
      }

      return next;
    });

    // (changed is only informational; no need to do anything with it)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, pageOccurrences.length]);

  const mustMarkDoneOccurrences = useMemo(
    () => pageOccurrences.filter((o) => o.requirementType === "must_mark_done"),
    [pageOccurrences],
  );

  const mustViewOccurrences = useMemo(
    () => pageOccurrences.filter((o) => o.requirementType === "must_view"),
    [pageOccurrences],
  );

  const anyLocked = useMemo(() => {
    // "locked" meaning gated but cannot interact (module locked or sequential lock)
    for (const o of pageOccurrences) {
      if (o.mode === "none") continue;
      const gate = canInteractOccurrence(o);
      if (
        !gate.ok &&
        (gate.reason === "module_locked" || gate.reason === "item_locked")
      ) {
        return true;
      }
    }
    return false;
  }, [pageOccurrences, progress, modules, moduleLockedMap]);

  const completionSummary = useMemo(() => {
    if (pageOccurrences.length === 0) {
      return {
        show: false,
        text: "Not in Modules",
        icon: null as any,
      };
    }

    // If all occurrences are mode=none, there is nothing to complete
    const anyGated = pageOccurrences.some((o) => o.mode !== "none");
    if (!anyGated) {
      return { show: true, text: "Not gated", icon: null as any };
    }

    // For status we treat: "completed" if ALL gated occurrences that are interactable are completed.
    let totalRelevant = 0;
    let doneRelevant = 0;

    for (const o of pageOccurrences) {
      if (o.mode === "none") continue;
      const gate = canInteractOccurrence(o);
      if (!gate.ok) continue; // don’t count locked ones as required “now”
      totalRelevant++;
      if (getItemCompleted(progress, o.moduleTitle, o.itemLabel))
        doneRelevant++;
    }

    if (totalRelevant === 0 && anyLocked) {
      return {
        show: true,
        text: "Locked",
        icon: <Lock className="w-4 h-4 text-gray-400" />,
      };
    }

    if (totalRelevant > 0 && doneRelevant === totalRelevant) {
      return {
        show: true,
        text: "Completed",
        icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
      };
    }

    return {
      show: true,
      text: "Not completed",
      icon: <Circle className="w-4 h-4 text-gray-300" />,
    };
  }, [pageOccurrences, progress, anyLocked, modules, moduleLockedMap]);

  const canManualMark = useMemo(() => {
    // Enable button if there exists at least one must_mark_done occurrence that:
    // - mode != none
    // - is interactable
    // - is not already complete
    for (const o of mustMarkDoneOccurrences) {
      if (o.mode === "none") continue;
      const gate = canInteractOccurrence(o);
      if (!gate.ok) continue;
      if (!getItemCompleted(progress, o.moduleTitle, o.itemLabel)) return true;
    }
    return false;
  }, [mustMarkDoneOccurrences, progress, modules, moduleLockedMap]);

  const manualMarkTitle = useMemo(() => {
    if (pageOccurrences.length === 0)
      return "This page is not referenced in Modules.";
    const anyGated = pageOccurrences.some((o) => o.mode !== "none");
    if (!anyGated) return "Enable requirements on a module to use completion.";
    if (
      mustMarkDoneOccurrences.length === 0 &&
      mustViewOccurrences.length > 0
    ) {
      return "This page is 'must view' and will auto-complete when opened.";
    }
    if (!canManualMark) {
      if (anyLocked) return "Locked by module / sequential requirements.";
      return "Already completed.";
    }
    return "Mark as completed";
  }, [
    pageOccurrences,
    canManualMark,
    anyLocked,
    mustMarkDoneOccurrences.length,
    mustViewOccurrences.length,
  ]);

  const markAsCompleted = () => {
    if (!canManualMark) return;

    setProgress((prev) => {
      let next = prev;

      for (const o of mustMarkDoneOccurrences) {
        if (o.mode === "none") continue;

        const gate = canInteractOccurrence(o);
        if (!gate.ok) continue;

        const already = getItemCompleted(next, o.moduleTitle, o.itemLabel);
        if (already) continue;

        next = setItemCompleted(next, o.moduleTitle, o.itemLabel, true);
      }

      return next;
    });
  };

  // ---- Load saved page content ----
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { title?: string; content?: string };

      if (parsed.title) setTitle(parsed.title);
      if (typeof parsed.content === "string") setContent(parsed.content);
    } catch (err) {
      console.error("Failed to load page content from storage", err);
    }
  }, [storageKey]);

  const handleCancel = () => {
    if (courseId) navigate(`/courses/${courseId}/modules`);
    else navigate(-1);
  };

  const handleSave = () => {
    if (!storageKey || !courseId) {
      if (courseId) navigate(`/courses/${courseId}/modules`);
      else navigate(-1);
      return;
    }

    const payload = JSON.stringify({ title, content });

    try {
      window.localStorage.setItem(storageKey, payload);
    } catch (err) {
      console.error("Failed to save page content to storage", err);
    }

    navigate(`/courses/${courseId}/modules`);
  };

  // ---- KaTeX render helper for all equations inside TinyMCE ----
  const renderAllEquations = (editor: any) => {
    if (!editor || !editor.getBody) return;
    const body = editor.getBody();
    if (!body) return;

    const nodes = body.querySelectorAll(
      ".canvas-equation",
    ) as NodeListOf<HTMLElement>;

    nodes.forEach((el) => {
      let latex = el.getAttribute("data-latex") || el.textContent || "";
      latex = latex.trim();
      if (!latex) return;

      // Normalize legacy $$...$$ content
      if (!el.getAttribute("data-latex")) {
        latex = latex.replace(/^\$\$/, "").replace(/\$\$$/, "").trim();
        el.setAttribute("data-latex", latex);
      }

      // Prevent caret from living inside the KaTeX DOM
      el.setAttribute("contenteditable", "false");

      // Make it feel selectable/clickable like Canvas
      el.classList.add("canvas-equation");
      el.setAttribute("data-mce-selected", "0");

      try {
        katex.render(latex, el, {
          throwOnError: false,
          displayMode: false, // inline math
        });
      } catch {
        el.textContent = latex;
      }
    });
  };

  // ---- Selection bookmark helpers (critical for insert working reliably) ----
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
    } catch {
      // ignore
    }
  };

  // ---- Open modal to insert new equation ----
  const openEquationInsert = () => {
    editingEquationElRef.current = null;
    saveSelectionBookmark();

    const selectedText =
      editorRef.current?.selection?.getContent?.({ format: "text" }) ?? "";

    setPendingInitialLatex(selectedText || "");
    setShowEquationModal(true);
  };

  // ---- Open modal to edit existing equation ----
  const openEquationEdit = (equationEl: HTMLElement) => {
    editingEquationElRef.current = equationEl;
    saveSelectionBookmark();

    const latex = (equationEl.getAttribute("data-latex") || "").trim();
    setPendingInitialLatex(latex);
    setShowEquationModal(true);
  };

  const insertNewEquation = (latex: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelectionBookmark();

    const encoded = latex
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const html = `<span class="canvas-equation" data-latex="${encoded}" contenteditable="false">&#8203;</span>&nbsp;`;

    if (editor.undoManager?.transact) {
      editor.undoManager.transact(() => {
        editor.insertContent(html);
      });
    } else {
      editor.insertContent(html);
    }

    renderAllEquations(editor);
    setContent(editor.getContent());

    selectionBookmarkRef.current = null;
  };

  const updateExistingEquation = (equationEl: HTMLElement, latex: string) => {
    const encoded = latex
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    equationEl.setAttribute("data-latex", encoded);

    try {
      katex.render(latex, equationEl, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      equationEl.textContent = latex;
    }

    equationEl.setAttribute("contenteditable", "false");

    if (editorRef.current) {
      setContent(editorRef.current.getContent());
    }
  };

  // ---- Modal submission handles insert OR edit ----
  const handleEquationModalInsert = (latex: string) => {
    const editingEl = editingEquationElRef.current;

    if (editingEl) {
      updateExistingEquation(editingEl, latex);
    } else {
      insertNewEquation(latex);
    }

    editingEquationElRef.current = null;
    selectionBookmarkRef.current = null;
    setShowEquationModal(false);
  };

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
      <CourseHeader />

      <div className="flex-1 px-16 py-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Page header / actions */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-3xl font-semibold text-canvas-grayDark bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none pb-1"
              />

              {completionSummary.show && (
                <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600">
                  {completionSummary.icon}
                  <span>{completionSummary.text}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 items-center">
              {/* ✅ Mark as completed button */}
              <button
                type="button"
                onClick={markAsCompleted}
                disabled={!canManualMark}
                title={manualMarkTitle}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Mark as completed
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 text-sm font-medium rounded-md bg-[#008EE2] text-white hover:bg-[#0079C2]"
              >
                Save
              </button>
            </div>
          </div>

          {/* Editor body */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200 px-4 py-2 text-sm text-gray-500">
              Rich Content Editor
            </div>

            <div className="px-4 py-4">
              <Editor
                apiKey="f4ktyvw5hm8w3xm00gwdjztgrl93k06t3vt9wng4uc08m87s"
                value={content}
                onInit={(_evt: any, editor: any) => {
                  editorRef.current = editor;
                  renderAllEquations(editor);
                }}
                onEditorChange={(value: string) => setContent(value)}
                init={{
                  height: 500,
                  menubar: true,
                  extended_valid_elements:
                    "span[class|data-latex|contenteditable]",
                  custom_elements: "span",
                  plugins:
                    "preview searchreplace autolink directionality visualblocks visualchars fullscreen image link media template codesample table charmap hr pagebreak nonbreaking anchor lists wordcount help",
                  toolbar:
                    "undo redo | styleselect | " +
                    "bold italic underline strikethrough | " +
                    "alignleft aligncenter alignright alignjustify | " +
                    "bullist numlist outdent indent | " +
                    "link image media | " +
                    "forecolor backcolor removeformat | " +
                    "codesample equationEditor | " +
                    "fullscreen preview | help",
                  content_css: [
                    "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css",
                  ],
                  content_style:
                    "body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; } " +
                    ".canvas-equation { display:inline-block; margin:0 2px; vertical-align:middle; cursor:pointer; padding:2px 3px; border-radius:4px; } " +
                    ".canvas-equation:hover { background: rgba(0, 142, 226, 0.10); } " +
                    ".canvas-equation.is-selected { outline: 2px solid rgba(0, 142, 226, 0.35); outline-offset: 1px; }" +
                    ".canvas-equation * { pointer-events: none; }",
                  branding: false,
                  statusbar: true,
                  setup: (editor: any) => {
                    const render = () => renderAllEquations(editor);
                    editor.on("SetContent", render);
                    editor.on("NodeChange", () => renderAllEquations(editor));
                    editor.on("Change", () => renderAllEquations(editor));

                    editor.ui.registry.addButton("equationEditor", {
                      text: "Equation",
                      tooltip: "Insert math equation",
                      onAction: () => openEquationInsert(),
                    });

                    editor.on("dblclick", (e: any) => {
                      const target = e?.target as HTMLElement | null;
                      if (!target) return;

                      const eq = target.closest?.(
                        ".canvas-equation",
                      ) as HTMLElement | null;
                      if (!eq) return;

                      e.preventDefault?.();
                      e.stopPropagation?.();

                      openEquationEdit(eq);
                    });

                    editor.on("click", (e: any) => {
                      const body = editor.getBody();
                      if (!body) return;

                      body
                        .querySelectorAll(".canvas-equation.is-selected")
                        .forEach((n: any) => n.classList.remove("is-selected"));

                      const target = e?.target as HTMLElement | null;
                      if (!target) return;

                      const eq = target.closest?.(
                        ".canvas-equation",
                      ) as HTMLElement | null;
                      if (eq) eq.classList.add("is-selected");
                    });

                    editor.ui.registry.addContextMenu("equationMenu", {
                      update: (element: HTMLElement) => {
                        const eq = element.closest?.(".canvas-equation");
                        if (!eq) return "";
                        return "editEquation";
                      },
                    });

                    editor.ui.registry.addMenuItem("editEquation", {
                      text: "Edit equation",
                      onAction: () => {
                        const node = editor.selection.getNode() as HTMLElement;
                        const eq = node?.closest?.(
                          ".canvas-equation",
                        ) as HTMLElement | null;
                        if (eq) openEquationEdit(eq);
                      },
                    });
                  },
                }}
              />

              <p className="mt-2 text-xs text-gray-500">
                Double-click an equation to edit it. Right-click also provides
                an <strong>Edit equation</strong> option.
              </p>
            </div>
          </div>
        </div>
      </div>

      <EquationModal
        isOpen={showEquationModal}
        initialLatex={pendingInitialLatex}
        onInsert={handleEquationModalInsert}
        onClose={() => {
          editingEquationElRef.current = null;
          selectionBookmarkRef.current = null;
          setShowEquationModal(false);

          try {
            editorRef.current?.focus?.();
          } catch {
            // ignore
          }
        }}
      />
    </div>
  );
}
