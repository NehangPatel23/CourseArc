// src/pages/PageEditorPage.tsx

import {
  useState,
  useEffect,
  useMemo,
} from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import RichContentEditor from "../components/RichContentEditor";
import { CheckCircle2, Circle, Lock } from "lucide-react";

import {
  loadModulesFromStorage,
  slugifyLabel,
  type ModuleT,
} from "../utils/modules";
import {
  loadProgress,
  getItemCompleted,
  getModuleCompletion,
  isItemUnlocked,
  isModuleGated,
} from "../utils/progress";

import { useStudentView } from "../utils/studentView";
import { normalizePageId, readPageContent } from "../utils/pageStorage";

type ItemRequirementType = "must_view" | "must_mark_done";

// ✅ Reserved ID for course home page content
const HOME_PAGE_ID = "course-home";

/** ---------------------------
 * Pages Index (global registry)
 * --------------------------*/
type PageIndexEntry = { id: string; title: string; updatedAt: number };

function pagesIndexKey(courseId: string) {
  return `canvasClone:pagesIndex:${courseId}`;
}

function loadPagesIndex(courseId: string): PageIndexEntry[] {
  try {
    const raw = window.localStorage.getItem(pagesIndexKey(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePagesIndex(courseId: string, entries: PageIndexEntry[]) {
  try {
    window.localStorage.setItem(
      pagesIndexKey(courseId),
      JSON.stringify(entries),
    );
    // ✅ same-tab listeners
    window.dispatchEvent(new Event("canvasClone:pagesIndexChanged"));
  } catch {
    // no-op
  }
}

function upsertPagesIndex(courseId: string, pageId: string, title: string) {
  const now = Date.now();
  const prev = loadPagesIndex(courseId);
  const idx = prev.findIndex((p) => p.id === pageId);

  const nextEntry: PageIndexEntry = {
    id: pageId,
    title,
    updatedAt: now,
  };

  const next =
    idx >= 0
      ? prev.map((p, i) => (i === idx ? nextEntry : p))
      : [nextEntry, ...prev];

  savePagesIndex(courseId, next);
}

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
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from;

  // ✅ Always key student view by the course route param
  const { studentView, courseKey: effectiveCourseId } = useStudentView(
    courseId ?? "default",
  );

  const normalizedPageId = pageId ? normalizePageId(pageId) : undefined;

  const storageKey =
    courseId && normalizedPageId
      ? `canvasClone:page:${courseId}:${normalizedPageId}`
      : undefined;

  const loadedPage = useMemo(() => {
    if (!courseId || !normalizedPageId) {
      return { title: unslugPageId(pageId), content: "" };
    }
    const parsed = readPageContent(courseId, normalizedPageId);
    return {
      title: parsed?.title ?? unslugPageId(pageId),
      content: typeof parsed?.content === "string" ? parsed.content : "",
    };
  }, [courseId, normalizedPageId, pageId]);

  const [title, setTitle] = useState(loadedPage.title);
  const [content, setContent] = useState(loadedPage.content);

  // -------------------------------
  // Requirements / Progress state
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

  // ✅ Ensure Home Page exists in index even before first save (Canvas-like)
  useEffect(() => {
    if (!courseId || !pageId) return;
    if (pageId !== HOME_PAGE_ID) return;
    upsertPagesIndex(courseId, HOME_PAGE_ID, title || "Home Page");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, pageId]);

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
      const gated = isModuleGated(mode);
      const comp = moduleCompletion.get(m.title);
      const complete = comp?.isComplete ?? true;

      locked.set(m.title, gatedIncompleteSeen);

      if (gated && !complete) gatedIncompleteSeen = true;
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

  const completionSummary = useMemo(() => {
    if (pageOccurrences.length === 0) {
      return { show: false, text: "Not in Modules", icon: null as any };
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
  }, [pageOccurrences, progress, anyLocked]);

  // ✅ Instructor/editor view: disable manual marking (no progress writes here)
  const canManualMark = false;
  const manualMarkTitle = useMemo(
    () => "Instructor preview: progress is disabled",
    [],
  );

  const markAsCompleted = () => {
    // no-op in editor
  };

  useEffect(() => {
    setTitle(loadedPage.title);
    setContent(loadedPage.content);
  }, [loadedPage.title, loadedPage.content]);

  const handleCancel = () => {
    if (fromPath) return navigate(fromPath);
    if (!courseId) return navigate(-1);

    // ✅ Canvas-like: return to Home when editing Home
    if (pageId === HOME_PAGE_ID) navigate(`/courses/${courseId}/home`);
    else navigate(`/courses/${courseId}/pages`);
  };

  const handleSave = () => {
    if (!storageKey || !courseId || !pageId) {
      if (fromPath) navigate(fromPath);
      else if (courseId) navigate(`/courses/${courseId}/pages`);
      else navigate(-1);
      return;
    }

    const payload = JSON.stringify({ title, content });

    try {
      window.localStorage.setItem(storageKey, payload);

      // ✅ Register page globally so it shows up in PagesPage even if not in Modules
      upsertPagesIndex(courseId, pageId, title || unslugPageId(pageId));

      // ✅ same-tab refresh (Home page, pages list, etc.)
      window.dispatchEvent(new Event("canvasClone:pageContentChanged"));
    } catch (err) {
      console.error("Failed to save page content to storage", err);
    }

    if (fromPath) {
      navigate(fromPath);
    } else if (pageId === HOME_PAGE_ID) {
      // ✅ Canvas-like: return to Home when editing Home
      navigate(`/courses/${courseId}/home`);
    } else {
      // Return to the page's viewer rather than the full pages list.
      navigate(`/courses/${courseId}/pages/${encodeURIComponent(normalizePageId(pageId))}/view`);
    }
  };

  if (studentView && courseId && pageId) {
    return (
      <Navigate
        to={`/courses/${courseId}/pages/${encodeURIComponent(normalizePageId(pageId))}/view`}
        replace
      />
    );
  }

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight min-h-screen">
      <CourseHeader />

      <div className="flex-1 px-16 py-8 overflow-y-auto">
        <div className="mr-auto w-full">
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
                className="px-4 py-1.5 text-sm font-medium rounded-md bg-canvas-blue text-white hover:bg-canvas-blueDark"
              >
                Save
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200 px-4 py-2 text-sm text-gray-500">
              Rich Content Editor
            </div>

            <div className="px-4 py-4">
              <RichContentEditor
                value={loadedPage.content}
                onChange={setContent}
                height={500}
                courseId={courseId}
                mountKey={storageKey}
              />
              <p className="mt-2 text-xs text-gray-500">
                Double-click an equation to edit it. Use <strong>Σ</strong> for math and{" "}
                <strong>Internal link</strong> for course links.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
