import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import { Megaphone, Pin, PinOff } from "lucide-react";
import { useStudentView } from "../hooks/useStudentView";

import EquationModal from "../components/EquationModal";
import { Editor as TinyMCEEditorRaw } from "@tinymce/tinymce-react";
import katex from "katex";
import "katex/dist/katex.min.css";

const Editor = TinyMCEEditorRaw as unknown as ComponentType<any>;

type AnnouncementStatus = "draft" | "published";

type Announcement = {
  id: string;
  title: string;
  body?: string; // HTML
  postedAt: number; // createdAt
  publishedAt?: number; // set when published
  status: AnnouncementStatus;
  pinned?: boolean;
};

function safeUUID(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return `${prefix}_${id}`;
}

function announcementsKey(courseId: string) {
  return `canvasClone:announcements:${courseId}`;
}

function normalizeAnnouncement(raw: any): Announcement | null {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const postedAt =
    typeof raw.postedAt === "number" && Number.isFinite(raw.postedAt)
      ? raw.postedAt
      : Date.now();

  if (!id || !title) return null;

  const status: AnnouncementStatus =
    raw.status === "draft" || raw.status === "published"
      ? raw.status
      : raw.published === false
        ? "draft"
        : "published";

  const publishedAt =
    typeof raw.publishedAt === "number" && Number.isFinite(raw.publishedAt)
      ? raw.publishedAt
      : status === "published"
        ? postedAt
        : undefined;

  return {
    id,
    title,
    body:
      typeof raw.body === "string" && raw.body.trim() ? raw.body : undefined,
    postedAt,
    publishedAt,
    status,
    pinned: typeof raw.pinned === "boolean" ? raw.pinned : undefined,
  };
}

function dedupeById(items: Announcement[]) {
  const seen = new Set<string>();
  const out: Announcement[] = [];
  for (const a of items) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

function loadAnnouncements(courseId: string): Announcement[] {
  try {
    const raw = window.localStorage.getItem(announcementsKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];

    const normalized = arr
      .map(normalizeAnnouncement)
      .filter((x): x is Announcement => !!x);

    return dedupeById(normalized);
  } catch {
    return [];
  }
}

function saveAnnouncements(courseId: string, items: Announcement[]) {
  try {
    const deduped = dedupeById(items);
    window.localStorage.setItem(
      announcementsKey(courseId),
      JSON.stringify(deduped),
    );
    window.dispatchEvent(new Event("canvasClone:announcementsChanged"));
  } catch {
    // no-op
  }
}

export default function AnnouncementEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId, announcementId } = useParams();
  const effectiveCourseId = courseId ?? "default";

  const studentView = useStudentView(effectiveCourseId);

  const backTo =
    (location.state as any)?.from ??
    `/courses/${effectiveCourseId}/announcements`;

  // Hard block: students cannot access editor routes
  useEffect(() => {
    if (studentView) navigate(backTo, { replace: true });
  }, [studentView, navigate, backTo]);

  const all = useMemo(
    () => loadAnnouncements(effectiveCourseId),
    [effectiveCourseId],
  );

  const isNew = announcementId === undefined || announcementId === "new";

  const existing = useMemo(() => {
    if (isNew) return undefined;
    return all.find((a) => a.id === announcementId);
  }, [all, announcementId, isNew]);

  // If someone tries to edit a non-existent id, bounce back
  useEffect(() => {
    if (!studentView && !isNew && !existing)
      navigate(backTo, { replace: true });
  }, [studentView, isNew, existing, navigate, backTo]);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.body ?? "");
  const [pinned, setPinned] = useState<boolean>(!!existing?.pinned);

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setContent(existing?.body ?? "");
    setPinned(!!existing?.pinned);
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = title.trim().length > 0;

  const upsert = (patch: Partial<Announcement> & Pick<Announcement, "id">) => {
    const nextAll = [...all];
    const idx = nextAll.findIndex((x) => x.id === patch.id);

    if (idx >= 0) {
      nextAll[idx] = { ...nextAll[idx], ...patch };
    } else {
      const created: Announcement = {
        id: patch.id,
        title: patch.title ?? "",
        body: patch.body,
        postedAt: patch.postedAt ?? Date.now(),
        publishedAt: patch.publishedAt,
        status: (patch.status as AnnouncementStatus) ?? "draft",
        pinned: patch.pinned,
      };
      nextAll.unshift(created);
    }

    saveAnnouncements(effectiveCourseId, nextAll);
  };

  const htmlBody = content.trim().length > 0 ? content : undefined;

  const onSaveDraft = () => {
    const t = title.trim();
    if (!t) return;

    if (isNew) {
      const id = safeUUID("n");
      upsert({
        id,
        title: t,
        body: htmlBody,
        postedAt: Date.now(),
        status: "draft",
        publishedAt: undefined,
        pinned, // allow pin flag to exist (only affects published ordering)
      });
      navigate(backTo);
      return;
    }

    if (!existing) return navigate(backTo);

    upsert({
      id: existing.id,
      title: t,
      body: htmlBody,
      status: "draft",
      publishedAt: undefined,
      pinned,
    });

    navigate(backTo);
  };

  const onPublish = () => {
    const t = title.trim();
    if (!t) return;

    if (isNew) {
      const id = safeUUID("n");
      const now = Date.now();
      upsert({
        id,
        title: t,
        body: htmlBody,
        postedAt: now,
        status: "published",
        publishedAt: now,
        pinned,
      });
      navigate(backTo);
      return;
    }

    if (!existing) return navigate(backTo);

    const publishTime = existing.publishedAt ?? Date.now();

    upsert({
      id: existing.id,
      title: t,
      body: htmlBody,
      status: "published",
      publishedAt: publishTime,
      pinned,
    });

    navigate(backTo);
  };

  const currentStatus: AnnouncementStatus = existing?.status ?? "draft";
  const isPublished = currentStatus === "published";

  // --------------------------
  // Rich editor (same as PageEditorPage)
  // --------------------------
  const [showEquationModal, setShowEquationModal] = useState(false);
  const [pendingInitialLatex, setPendingInitialLatex] = useState<string>("");
  const editorRef = useRef<any | null>(null);
  const selectionBookmarkRef = useRef<any | null>(null);
  const editingEquationElRef = useRef<HTMLElement | null>(null);

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

      if (!el.getAttribute("data-latex")) {
        latex = latex.replace(/^\$\$/, "").replace(/\$\$$/, "").trim();
        el.setAttribute("data-latex", latex);
      }

      el.setAttribute("contenteditable", "false");
      el.classList.add("canvas-equation");
      el.setAttribute("data-mce-selected", "0");

      try {
        katex.render(latex, el, {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        el.textContent = latex;
      }
    });
  };

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

  const openEquationInsert = () => {
    editingEquationElRef.current = null;
    saveSelectionBookmark();

    const selectedText =
      editorRef.current?.selection?.getContent?.({ format: "text" }) ?? "";

    setPendingInitialLatex(selectedText || "");
    setShowEquationModal(true);
  };

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

  const handleEquationModalInsert = (latex: string) => {
    const editingEl = editingEquationElRef.current;

    if (editingEl) updateExistingEquation(editingEl, latex);
    else insertNewEquation(latex);

    editingEquationElRef.current = null;
    selectionBookmarkRef.current = null;
    setShowEquationModal(false);
  };

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight h-full">
      <CourseHeader />

      <div className="flex-1 px-16 py-10 overflow-y-auto bg-white">
        <div className="max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-gray-500" />
                <h1 className="text-2xl font-semibold text-[#2D3B45]">
                  {isNew ? "New Announcement" : "Edit Announcement"}
                </h1>

                <span
                  className={[
                    "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
                    isPublished
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200",
                  ].join(" ")}
                >
                  {isPublished ? "Published" : "Draft"}
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-1">
                Save as draft, or publish when ready.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 space-y-4">
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">
                  Title
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-[#2D3B45] focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* ✅ Pin toggle (instructors only; affects Published ordering + Home) */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-sm text-gray-700">
                  Pin this announcement (stays on top + shows on Home)
                </div>
                <button
                  type="button"
                  onClick={() => setPinned((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700"
                >
                  {pinned ? (
                    <>
                      <PinOff className="h-4 w-4" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4" />
                      Pin
                    </>
                  )}
                </button>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">
                  Body
                </div>

                {/* ✅ Rich text editor (same as PageEditorPage) */}
                <div className="rounded-md border border-gray-300 overflow-hidden">
                  <Editor
                    apiKey="f4ktyvw5hm8w3xm00gwdjztgrl93k06t3vt9wng4uc08m87s"
                    value={content}
                    onInit={(_evt: any, editor: any) => {
                      editorRef.current = editor;
                      renderAllEquations(editor);
                    }}
                    onEditorChange={(value: string) => setContent(value)}
                    init={{
                      height: 360,
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
                        editor.on("NodeChange", () =>
                          renderAllEquations(editor),
                        );
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
                            .forEach((n: any) =>
                              n.classList.remove("is-selected"),
                            );

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
                            const node =
                              editor.selection.getNode() as HTMLElement;
                            const eq = node?.closest?.(
                              ".canvas-equation",
                            ) as HTMLElement | null;
                            if (eq) openEquationEdit(eq);
                          },
                        });
                      },
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Double-click an equation to edit it. Right-click also provides{" "}
                  <strong>Edit equation</strong>.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!canSave}
                onClick={onSaveDraft}
                className={[
                  "px-3 py-2 text-sm font-medium rounded-md border",
                  canSave
                    ? "border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                    : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed",
                ].join(" ")}
              >
                Save Draft
              </button>

              <button
                type="button"
                disabled={!canSave}
                onClick={onPublish}
                className={[
                  "px-3 py-2 text-sm font-medium rounded-md text-white",
                  canSave
                    ? "bg-[#008EE2] hover:bg-[#0079C2]"
                    : "bg-gray-300 cursor-not-allowed",
                ].join(" ")}
              >
                {isPublished ? "Update" : "Publish"}
              </button>
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
