// src/pages/PageViewerPage.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import katex from "katex";
import "katex/dist/katex.min.css";
import CourseHeader from "../components/CourseHeader";
import { ArrowLeft, CheckCircle2, Circle, Lock } from "lucide-react";

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

import { useStudentView } from "../utils/studentView";

type ItemRequirementType = "must_view" | "must_mark_done";

// ✅ Reserved ID for course home page content
const HOME_PAGE_ID = "course-home";

function unslugPageId(pageId?: string) {
  if (!pageId) return "Untitled Page";
  const decoded = decodeURIComponent(pageId);
  return decoded
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PageViewerPage() {
  const { courseId, pageId } = useParams();
  const navigate = useNavigate();

  const { studentView, courseKey: effectiveCourseId } = useStudentView(
    courseId ?? "default",
  );

  // ✅ Avoid render-time <Navigate/> (prevents blank-screen crash on toggle)
  useEffect(() => {
    if (!studentView && courseId && pageId) {
      navigate(`/courses/${courseId}/pages/${pageId}`, { replace: true });
    }
  }, [studentView, courseId, pageId, navigate]);

  // While toggling away, keep a safe shell
  if (!studentView) {
    return (
      <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
        <CourseHeader />
      </div>
    );
  }

  // ✅ Must match PageEditorPage storage key exactly
  const storageKey =
    courseId && pageId ? `canvasClone:page:${courseId}:${pageId}` : undefined;

  const [title, setTitle] = useState(() => unslugPageId(pageId));
  const [content, setContent] = useState<string>("");

  const [modules, setModules] = useState<ModuleT[]>(() =>
    loadModulesFromStorage(),
  );
  const [progress, setProgress] = useState(() =>
    loadProgress(effectiveCourseId),
  );

  // keep modules synced
  useEffect(() => {
    setModules(loadModulesFromStorage());
  }, []);

  // keep progress synced to courseKey
  useEffect(() => {
    setProgress(loadProgress(effectiveCourseId));
  }, [effectiveCourseId]);

  // persist progress ONLY in student view
  useEffect(() => {
    if (!studentView) return;
    saveProgress(effectiveCourseId, progress);
  }, [effectiveCourseId, progress, studentView]);

  // ---- helper: load the page blob ----
  const loadFromStorage = () => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        // If no saved content exists, keep defaults
        setTitle(unslugPageId(pageId));
        setContent("");
        return;
      }

      const parsed = JSON.parse(raw) as { title?: string; content?: string };
      setTitle(parsed.title ? parsed.title : unslugPageId(pageId));
      setContent(typeof parsed.content === "string" ? parsed.content : "");
    } catch (err) {
      console.error("Failed to load page content from storage", err);
    }
  };

  // load page content from localStorage (initial)
  useEffect(() => {
    loadFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ✅ keep content synced in:
  // - other tabs/windows (storage)
  // - same tab (custom event fired by PageEditorPage)
  useEffect(() => {
    if (!storageKey) return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      loadFromStorage();
    };

    const onSameTab = () => {
      loadFromStorage();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("canvasClone:pageContentChanged", onSameTab as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:pageContentChanged",
        onSameTab as any,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Find occurrences of this page in modules
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
    const locked = new Map<string, boolean>();
    let gatedIncompleteSeen = false;

    for (const m of modules) {
      const mode = (m.requirementsMode ?? "none") as
        | "none"
        | "all"
        | "sequential";
      const gated = isModuleGated(mode);
      const comp = moduleCompletion.get(m.title);
      const complete = comp?.isComplete ?? true;

      locked.set(m.title, gatedIncompleteSeen);

      if (gated && !complete) gatedIncompleteSeen = true;
    }

    return locked;
  }, [modules, moduleCompletion]);

  function canInteractOccurrence(o: (typeof pageOccurrences)[number]) {
    if (o.mode === "none") return { ok: true, reason: "not_gated" as const };

    const mod = modules.find((m) => m.title === o.moduleTitle);
    if (!mod) return { ok: false, reason: "missing_module" as const };

    const moduleLocked = moduleLockedMap.get(o.moduleTitle) ?? false;
    if (moduleLocked) return { ok: false, reason: "module_locked" as const };

    const unlocked = isItemUnlocked(mod, o.mode, progress, o.itemLabel);
    if (!unlocked) return { ok: false, reason: "item_locked" as const };

    return { ok: true, reason: "ok" as const };
  }

  const mustMarkDoneOccurrences = useMemo(
    () => pageOccurrences.filter((o) => o.requirementType === "must_mark_done"),
    [pageOccurrences],
  );

  const mustViewOccurrences = useMemo(
    () => pageOccurrences.filter((o) => o.requirementType === "must_view"),
    [pageOccurrences],
  );

  const anyLocked = useMemo(() => {
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

  // lockedForStudent: exists gated occurrence AND all gated occurrences not interactable
  const lockedForStudent = useMemo(() => {
    const anyGated = pageOccurrences.some((o) => o.mode !== "none");
    if (!anyGated) return false;

    for (const o of pageOccurrences) {
      if (o.mode === "none") continue;
      if (canInteractOccurrence(o).ok) return false;
    }
    return anyLocked;
  }, [pageOccurrences, anyLocked, progress, modules, moduleLockedMap]);

  const completionSummary = useMemo(() => {
    if (pageOccurrences.length === 0) {
      return { show: false, text: "", icon: null as any };
    }

    const anyGated = pageOccurrences.some((o) => o.mode !== "none");
    if (!anyGated) return { show: true, text: "Not gated", icon: null as any };

    let totalRelevant = 0;
    let doneRelevant = 0;

    for (const o of pageOccurrences) {
      if (o.mode === "none") continue;
      const gate = canInteractOccurrence(o);
      if (!gate.ok) continue;
      totalRelevant++;
      if (getItemCompleted(progress, o.moduleTitle, o.itemLabel))
        doneRelevant++;
    }

    if (totalRelevant === 0 && lockedForStudent) {
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
  }, [pageOccurrences, progress, lockedForStudent, modules, moduleLockedMap]);

  // Auto-complete must_view occurrences on open (if unlocked)
  useEffect(() => {
    if (!pageId) return;
    if (pageOccurrences.length === 0) return;
    if (lockedForStudent) return;

    setProgress((prev) => {
      let next = prev;

      for (const o of pageOccurrences) {
        if (o.requirementType !== "must_view") continue;
        if (o.mode === "none") continue;

        const gate = canInteractOccurrence(o);
        if (!gate.ok) continue;

        if (!getItemCompleted(next, o.moduleTitle, o.itemLabel)) {
          next = setItemCompleted(next, o.moduleTitle, o.itemLabel, true);
        }
      }

      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, pageOccurrences.length, lockedForStudent]);

  const canManualMark = useMemo(() => {
    if (lockedForStudent) return false;

    for (const o of mustMarkDoneOccurrences) {
      if (o.mode === "none") continue;
      const gate = canInteractOccurrence(o);
      if (!gate.ok) continue;
      if (!getItemCompleted(progress, o.moduleTitle, o.itemLabel)) return true;
    }
    return false;
  }, [mustMarkDoneOccurrences, progress, lockedForStudent]);

  const manualMarkTitle = useMemo(() => {
    if (pageOccurrences.length === 0)
      return "This page is not referenced in Modules.";
    const anyGated = pageOccurrences.some((o) => o.mode !== "none");
    if (!anyGated) return "Enable requirements on a module to use completion.";
    if (lockedForStudent) return "Locked by module / sequential requirements.";
    if (
      mustMarkDoneOccurrences.length === 0 &&
      mustViewOccurrences.length > 0
    ) {
      return "This page is 'must view' and will auto-complete when opened.";
    }
    if (!canManualMark) return "Already completed.";
    return "Mark as completed";
  }, [
    pageOccurrences,
    canManualMark,
    lockedForStudent,
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

        if (!getItemCompleted(next, o.moduleTitle, o.itemLabel)) {
          next = setItemCompleted(next, o.moduleTitle, o.itemLabel, true);
        }
      }

      return next;
    });
  };

  // ✅ Render KaTeX after HTML is injected
  useEffect(() => {
    if (!content) return;
    if (lockedForStudent) return;

    const t = window.setTimeout(() => {
      const root = document.getElementById("canvasClonePageContent");
      if (!root) return;

      const nodes = root.querySelectorAll(
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

        try {
          katex.render(latex, el, {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          el.textContent = latex;
        }
      });
    }, 0);

    return () => window.clearTimeout(t);
  }, [content, lockedForStudent]);

  if (!courseId || !pageId) {
    return (
      <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
        <CourseHeader />
        <div className="px-16 py-10">
          <div className="max-w-4xl text-gray-700">
            Missing courseId/pageId.
          </div>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    // ✅ Canvas-like: if viewing Home content, go back to course home
    if (pageId === HOME_PAGE_ID) {
      navigate(`/courses/${courseId}/home`);
      return;
    }
    navigate(-1);
  };

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
      <CourseHeader />

      <div className="flex-1 px-16 py-8 overflow-y-auto bg-white">
        <div className="max-w-4xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <h1 className="mt-3 text-3xl font-semibold text-canvas-grayDark truncate">
                {title}
              </h1>

              {completionSummary.show && (
                <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600">
                  {completionSummary.icon}
                  <span>{completionSummary.text}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 items-center">
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
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {lockedForStudent ? (
              <div className="px-6 py-10 text-gray-700">
                <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <Lock className="w-4 h-4 text-gray-400" />
                  This page is locked. Complete prerequisites to access it.
                </div>
              </div>
            ) : (
              <div className="px-6 py-6">
                {/* ✅ IMPORTANT: no "prose" here (it can override list formatting).
                    Instead we mimic TinyMCE default-ish styling with safe utilities. */}
                <div
                  id="canvasClonePageContent"
                  className={[
                    "text-[#2D3B45] text-[15px] leading-7",
                    "[&_p]:my-3",
                    "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:my-4",
                    "[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:my-4",
                    "[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:my-3",
                    "[&_strong]:font-semibold",
                    "[&_em]:italic",
                    // ✅ lists preserved
                    "[&_ol]:list-decimal [&_ol]:pl-7 [&_ol]:my-3",
                    "[&_ul]:list-disc [&_ul]:pl-7 [&_ul]:my-3",
                    "[&_li]:my-1",
                    // tables/images
                    "[&_table]:border-collapse [&_table]:my-4",
                    "[&_td]:border [&_td]:border-gray-200 [&_td]:p-2",
                    "[&_th]:border [&_th]:border-gray-200 [&_th]:p-2 [&_th]:bg-gray-50",
                    "[&_img]:max-w-full [&_img]:h-auto",
                    // links
                    "[&_a]:text-[#008EE2] [&_a]:underline",
                    // code blocks
                    "[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-gray-100",
                    "[&_pre]:p-3 [&_pre]:rounded [&_pre]:bg-gray-50 [&_pre]:overflow-x-auto",
                  ].join(" ")}
                  dangerouslySetInnerHTML={{ __html: content || "<p></p>" }}
                />
              </div>
            )}
          </div>

          {!lockedForStudent && (
            <div className="mt-3 text-xs text-gray-500">
              This is the student view of the page (read-only).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
