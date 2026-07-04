// src/pages/PagesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  FileText,
  Folder,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Lock,
} from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import AddPageFromPagesModal from "../components/AddPageFromPagesModal";
import RenamePageModal from "../components/RenamePageModal";
import ConfirmDeletePageModal from "../components/ConfirmDeleteModal";

import {
  extractPageItems,
  loadModulesFromStorage,
  saveModulesToStorage,
  slugifyLabel,
  MODULES_STORAGE_KEY,
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
import { isPageLockedInStudentView } from "../utils/access";

type PageRow = ReturnType<typeof extractPageItems>[number];
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
    window.dispatchEvent(new Event("canvasClone:pagesIndexChanged"));
  } catch {
    // no-op
  }
}

function pageStorageKey(courseId: string, pageId: string) {
  return `canvasClone:page:${courseId}:${pageId}`;
}

function uniquePageId(desiredTitle: string, existingPageIds: Set<string>) {
  const base = slugifyLabel(desiredTitle);
  if (!existingPageIds.has(base)) return base;

  let i = 2;
  while (existingPageIds.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

type AnyPageRow =
  | (PageRow & { source: "modules" })
  | {
      source: "index";
      moduleTitle: string; // display
      label: string;
      pageId: string;
    };

export default function PagesPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { studentView, courseKey: effectiveCourseId } = useStudentView(
    courseId ?? "default",
  );

  const [modules, setModules] = useState<ModuleT[]>(() =>
    loadModulesFromStorage(),
  );

  const [progress, setProgress] = useState(() =>
    loadProgress(effectiveCourseId),
  );

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<AnyPageRow | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AnyPageRow | null>(null);

  // ✅ Pages index
  const [pagesIndex, setPagesIndex] = useState<PageIndexEntry[]>(() => {
    if (!courseId) return [];
    return loadPagesIndex(courseId);
  });

  // Keep Pages in sync if Modules updates localStorage in another tab/window.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MODULES_STORAGE_KEY) return;
      setModules(loadModulesFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ✅ Keep pages index in sync (same-tab + other tabs)
  useEffect(() => {
    if (!courseId) return;

    const refresh = () => setPagesIndex(loadPagesIndex(courseId));

    const onStorage = (e: StorageEvent) => {
      if (e.key === pagesIndexKey(courseId)) refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("canvasClone:pagesIndexChanged", refresh as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:pagesIndexChanged",
        refresh as any,
      );
    };
  }, [courseId]);

  // Reload progress if courseId changes
  useEffect(() => {
    setProgress(loadProgress(effectiveCourseId));
  }, [effectiveCourseId]);

  // Persist progress ONLY in student view
  useEffect(() => {
    if (!studentView) return;
    saveProgress(effectiveCourseId, progress);
  }, [effectiveCourseId, progress, studentView]);

  const modulePages = useMemo(
    () =>
      extractPageItems(modules).map((p) => ({
        ...p,
        source: "modules" as const,
      })),
    [modules],
  );

  // ✅ Merge: index pages (home/standalone) + module pages
  const pages = useMemo<AnyPageRow[]>(() => {
    const map = new Map<string, AnyPageRow>();

    for (const p of pagesIndex) {
      map.set(p.id, {
        source: "index",
        moduleTitle: p.id === HOME_PAGE_ID ? "Home Page" : "—",
        label: p.title,
        pageId: p.id,
      });
    }

    for (const p of modulePages) {
      if (!map.has(p.pageId)) map.set(p.pageId, p);
    }

    return Array.from(map.values());
  }, [pagesIndex, modulePages]);

  const existingPageIds = useMemo(
    () => new Set(pages.map((p) => p.pageId)),
    [pages],
  );

  // Completion per module (used for module lock gating)
  const moduleCompletion = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getModuleCompletion>>();
    for (const m of modules) map.set(m.title, getModuleCompletion(m, progress));
    return map;
  }, [modules, progress]);

  // module is locked if ANY earlier module is gated and incomplete
  const moduleLockedMap = useMemo(() => {
    const locked = new Map<string, boolean>();
    let gatedIncompleteSeen = false;

    for (const m of modules) {
      const mode = m.requirementsMode ?? "none";
      const isGated = isModuleGated(mode);
      const comp = moduleCompletion.get(m.title);
      const complete = comp?.isComplete ?? true;

      locked.set(m.title, gatedIncompleteSeen);

      if (isGated && !complete) gatedIncompleteSeen = true;
    }

    return locked;
  }, [modules, moduleCompletion]);

  function findPageItemMeta(p: AnyPageRow) {
    if (p.source !== "modules") return null;

    const mod = modules.find((m) => m.title === p.moduleTitle);
    if (!mod) return null;

    const it = (mod.items as any[]).find((x) => {
      if (x?.type !== "page") return false;
      const pid = x.pageId ?? slugifyLabel(x.label);
      return pid === p.pageId || x.label === p.label;
    });

    if (!it) return null;

    const req =
      (it.requirementType as ItemRequirementType | undefined) ??
      "must_mark_done";

    return { module: mod, item: it, requirementType: req };
  }

  function canInteractWithPageRow(p: AnyPageRow) {
    const meta = findPageItemMeta(p);
    if (!meta) return { ok: true, reason: "standalone" as const, meta: null };

    const mode = meta.module.requirementsMode ?? "none";
    if (mode === "none") {
      return { ok: true, reason: "free" as const, meta };
    }

    const locked = moduleLockedMap.get(meta.module.title) ?? false;
    if (locked) return { ok: false, reason: "module_locked" as const, meta };

    const unlocked = isItemUnlocked(
      meta.module,
      mode,
      progress,
      meta.item.label,
    );

    if (!unlocked) return { ok: false, reason: "item_locked" as const, meta };

    return { ok: true, reason: "ok" as const, meta };
  }

  const openPage = (p: AnyPageRow) => {
    if (!courseId) return;

    if (studentView) {
      const locked = isPageLockedInStudentView(modules, progress, p.pageId);
      if (locked) return;
    }

    navigate(
      studentView
        ? `/courses/${courseId}/pages/${p.pageId}/view`
        : `/courses/${courseId}/pages/${p.pageId}`,
    );
  };

  const markPageCompleted = (p: AnyPageRow) => {
    if (!studentView) return; // instructor preview doesn't write progress
    const res = canInteractWithPageRow(p);
    if (!res.ok || !res.meta) return;

    const mode = res.meta.module.requirementsMode ?? "none";
    if (mode === "none") return;

    if (res.meta.requirementType !== "must_mark_done") return;

    setProgress((prev) =>
      setItemCompleted(
        prev,
        res.meta!.module.title,
        res.meta!.item.label,
        true,
      ),
    );
  };

  const handleCreatePage = (args: {
    title: string;
    targetModuleTitle: string;
  }) => {
    if (studentView) return;

    const newId = uniquePageId(args.title, existingPageIds);

    setModules((prev) => {
      const next = prev.map((m) => {
        if (m.title !== args.targetModuleTitle) return m;
        return {
          ...m,
          items: [
            ...m.items,
            {
              type: "page",
              label: args.title,
              pageId: newId,
              requirementType: "must_mark_done",
            } as any,
          ],
        };
      });

      saveModulesToStorage(next);
      return next;
    });

    if (courseId) navigate(`/courses/${courseId}/pages/${newId}`);
  };

  const renamePage = (target: AnyPageRow, newTitle: string) => {
    if (studentView) return;
    if (!courseId) return;

    // ✅ Index-only page: keep ID stable, update index + stored title
    if (target.source === "index") {
      const pid = target.pageId;

      const nextIndex = loadPagesIndex(courseId).map((p) =>
        p.id === pid ? { ...p, title: newTitle, updatedAt: Date.now() } : p,
      );
      savePagesIndex(courseId, nextIndex);

      try {
        const key = pageStorageKey(courseId, pid);
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          window.localStorage.setItem(
            key,
            JSON.stringify({ ...parsed, title: newTitle }),
          );
          window.dispatchEvent(new Event("canvasClone:pageContentChanged"));
        }
      } catch {
        // ignore
      }

      return;
    }

    // ✅ Module page rename (existing behavior)
    const oldId = target.pageId;
    const newId = uniquePageId(
      newTitle,
      new Set([...existingPageIds].filter((id) => id !== oldId)),
    );

    setModules((prev) => {
      const next = prev.map((m) => ({
        ...m,
        items: m.items.map((it: any) => {
          if (it.type !== "page") return it;

          const pid = it.pageId ?? slugifyLabel(it.label);
          if (pid !== oldId) return it;

          return {
            ...it,
            label: newTitle,
            pageId: newId,
          };
        }),
      }));

      saveModulesToStorage(next);
      return next;
    });

    try {
      const oldKey = pageStorageKey(courseId, oldId);
      const newKey = pageStorageKey(courseId, newId);

      const existing = window.localStorage.getItem(oldKey);
      if (existing != null) {
        window.localStorage.setItem(newKey, existing);
        window.localStorage.removeItem(oldKey);
      }
    } catch (err) {
      console.error("Failed to migrate page content storage on rename", err);
    }

    const currentPath = window.location.pathname;
    if (currentPath.includes(`/pages/${oldId}`)) {
      navigate(`/courses/${courseId}/pages/${newId}`);
    }
  };

  const deletePage = (target: AnyPageRow) => {
    if (studentView) return;
    if (!courseId) return;

    // ✅ Index-only page delete
    if (target.source === "index") {
      const pid = target.pageId;

      const nextIndex = loadPagesIndex(courseId).filter((p) => p.id !== pid);
      savePagesIndex(courseId, nextIndex);

      try {
        window.localStorage.removeItem(pageStorageKey(courseId, pid));
        window.dispatchEvent(new Event("canvasClone:pageContentChanged"));
      } catch {
        // ignore
      }

      const currentPath = window.location.pathname;
      if (currentPath.includes(`/pages/${pid}`)) {
        navigate(`/courses/${courseId}/pages`);
      }
      return;
    }

    // ✅ Module page delete (existing behavior)
    const idToDelete = target.pageId;

    setModules((prev) => {
      const next = prev.map((m) => ({
        ...m,
        items: m.items.filter((it: any) => {
          if (it.type !== "page") return true;
          const pid = it.pageId ?? slugifyLabel(it.label);
          return pid !== idToDelete;
        }),
      }));

      saveModulesToStorage(next);
      return next;
    });

    try {
      window.localStorage.removeItem(pageStorageKey(courseId, idToDelete));
    } catch (err) {
      console.error("Failed to delete page content storage", err);
    }

    const currentPath = window.location.pathname;
    if (currentPath.includes(`/pages/${idToDelete}`)) {
      navigate(`/courses/${courseId}/pages`);
    }
  };

  return (
    <div className="flex flex-col w-full bg-canvas-grayLight h-full">
      <CourseHeader />

      <div className="flex-1 px-8 py-8 overflow-y-auto bg-white">
        <div className="w-full">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-canvas-grayDark">
                <FileText className="h-6 w-6 text-gray-500" />
                Pages
              </h2>
              <p className="text-gray-600 leading-relaxed mt-1">
                Pages in this course (including Home Page and module pages).
                {studentView
                  ? " (Student view: read-only)"
                  : " You can create, rename, and delete pages here."}
              </p>
            </div>

            {!studentView && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-canvas-blue text-white text-sm font-medium hover:bg-canvas-blueDark shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Page
              </button>
            )}
          </div>

          <div className="h-px bg-gray-200 my-6"></div>

          {pages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8">
              <p className="text-gray-700 font-medium">No pages yet</p>
              <p className="text-gray-600 text-sm mt-1">
                Add a page from here, or add a Page item inside Modules.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div
                className={[
                  "bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-600 grid items-center gap-4",
                  studentView
                    ? "grid-cols-[minmax(0,1fr)_minmax(0,320px)_minmax(0,220px)]"
                    : "grid-cols-[minmax(0,1fr)_minmax(0,320px)_minmax(0,220px)_100px]",
                ].join(" ")}
              >
                <span className="min-w-0">Page</span>
                <span className="min-w-0">Module</span>
                <span className="min-w-0">Status</span>
                {!studentView && <span className="text-right">Actions</span>}
              </div>

              <div className="divide-y divide-gray-200">
                {pages.map((p) => {
                  const meta = findPageItemMeta(p);
                  const isStandalone = p.source === "index" && !meta;

                  const mode = meta?.module.requirementsMode ?? "none";
                  const lockedModule = meta
                    ? (moduleLockedMap.get(meta.module.title) ?? false)
                    : false;

                  const unlockedItem =
                    meta && mode !== "none"
                      ? isItemUnlocked(
                          meta.module,
                          mode,
                          progress,
                          meta.item.label,
                        )
                      : true;

                  const completed =
                    meta?.module && meta?.item
                      ? getItemCompleted(
                          progress,
                          meta.module.title,
                          meta.item.label,
                        )
                      : false;

                  const lockedInStudent = studentView
                    ? isPageLockedInStudentView(modules, progress, p.pageId)
                    : false;

                  const canOpen = studentView ? !lockedInStudent : true;

                  const statusIcon = isStandalone ? (
                    <span className="text-xs text-gray-500">Standalone</span>
                  ) : studentView && lockedInStudent ? (
                    <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                      <Lock className="w-4 h-4 text-gray-400" />
                      <span className="text-xs">Locked</span>
                    </div>
                  ) : mode === "none" ? (
                    <span className="text-xs text-gray-500">Not gated</span>
                  ) : lockedModule || !unlockedItem ? (
                    <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                      <Lock className="w-4 h-4 text-gray-400" />
                      <span className="text-xs">Locked</span>
                    </div>
                  ) : completed ? (
                    <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs">Completed</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <Circle className="w-4 h-4 text-gray-300" />
                      <span className="text-xs">Not completed</span>
                    </div>
                  );

                  const showInstructorMarkCompleted =
                    !studentView && meta && mode !== "none";

                  return (
                    <div
                      key={`${p.pageId}:${p.source}`}
                      className={[
                        "px-5 py-4 hover:bg-gray-50 transition-colors grid items-center gap-4",
                        studentView
                          ? "grid-cols-[minmax(0,1fr)_minmax(0,320px)_minmax(0,220px)]"
                          : "grid-cols-[minmax(0,1fr)_minmax(0,320px)_minmax(0,220px)_100px]",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => openPage(p)}
                        disabled={!canOpen}
                        className={[
                          "w-full text-left flex items-center gap-3 min-w-0",
                          // ✅ hard reset to avoid inherited dark backgrounds
                          "bg-transparent text-inherit",
                          // ✅ Canvas-ish hit area + hover
                          "px-2 py-1 rounded-md hover:bg-gray-50 transition-colors",
                          // ✅ ensure text colors are correct even if a parent forces dark theme
                          "[&_*]:text-inherit",
                          canOpen
                            ? ""
                            : "cursor-not-allowed opacity-60 hover:bg-transparent",
                        ].join(" ")}
                        title={
                          canOpen
                            ? "Open page"
                            : "Locked in Student View (complete prerequisites)"
                        }
                      >
                        <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-canvas-grayDark truncate">
                            {p.label}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {p.pageId}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                        <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{p.moduleTitle}</span>
                      </div>

                      <div className="min-w-0">{statusIcon}</div>

                      {!studentView && (
                        <div className="flex justify-end gap-2">
                          {showInstructorMarkCompleted ? (
                            <button
                              type="button"
                              onClick={() => markPageCompleted(p)}
                              disabled
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-canvas-grayDark opacity-40 cursor-not-allowed"
                              title="Instructor preview: progress is disabled"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-[44px]" />
                          )}

                          <button
                            type="button"
                            onClick={() => setRenameTarget(p)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-sm text-canvas-grayDark"
                            title="Rename"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-red-50 text-sm text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {!studentView && showCreateModal && (
        <AddPageFromPagesModal
          modules={modules}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePage}
        />
      )}

      {!studentView && (
        <RenamePageModal
          isOpen={!!renameTarget}
          initialTitle={renameTarget?.label ?? ""}
          initialModuleTitle={
            renameTarget?.source === "modules"
              ? (renameTarget as any).moduleTitle
              : "—"
          }
          onClose={() => setRenameTarget(null)}
          onRename={(newTitle) => {
            if (!renameTarget) return;
            renamePage(renameTarget, newTitle);
            setRenameTarget(null);
          }}
        />
      )}

      {!studentView && (
        <ConfirmDeletePageModal
          isOpen={!!deleteTarget}
          title="Delete page?"
          description={
            deleteTarget
              ? `This will delete "${deleteTarget.label}" and its saved content. This cannot be undone.`
              : ""
          }
          confirmText="Delete"
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;
            deletePage(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
