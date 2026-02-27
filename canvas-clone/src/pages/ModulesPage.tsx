import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CourseHeader from "../components/CourseHeader";
import ModuleItem from "../components/ModuleItem";
import AddModuleModal from "../components/AddModuleModal";
import RequirementsModal from "../components/RequirementsModal";
import { Plus, GripVertical } from "lucide-react";

import {
  replaceModuleTitleInAllFiles,
  addModuleRefToFile,
  removeModuleRefFromFile,
  mergeModuleRefsIntoFilesMeta,
} from "../utils/files";

import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  DragOverlay,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  slugifyLabel,
  loadModulesFromStorage,
  saveModulesToStorage,
  type Item,
  type ModuleT,
  type ModuleRequirementsMode,
  type ModuleAccessRule,
} from "../utils/modules";

import {
  loadProgress,
  saveProgress,
  getItemCompleted,
  setItemCompleted,
  clearItem,
  clearModule,
  renameItem,
  renameModule,
  getModuleCompletion,
  isItemUnlocked,
  isModuleGated,
} from "../utils/progress";

type IdModule = `module:${string}`;
type IdItem = `item:${string}:${string}`;
type IdContainer = `container:${string}`;
type IdPlaceholder = `placeholder:${string}:${string}`;
type AnyId = IdModule | IdItem | IdContainer | IdPlaceholder;

const modId = (title: string): IdModule => `module:${title}`;
const itemId = (moduleTitle: string, label: string): IdItem =>
  `item:${moduleTitle}:${label}`;
const containerId = (moduleTitle: string): IdContainer =>
  `container:${moduleTitle}`;

function parseId(id: string) {
  if (id.startsWith("module:"))
    return { kind: "module" as const, title: id.slice(7) };

  if (id.startsWith("item:")) {
    const rest = id.slice(5);
    const i = rest.indexOf(":");
    return {
      kind: "item" as const,
      moduleTitle: rest.slice(0, i),
      label: rest.slice(i + 1),
    };
  }

  if (id.startsWith("container:"))
    return { kind: "container" as const, moduleTitle: id.slice(10) };

  if (id.startsWith("placeholder:")) {
    const rest = id.slice(12);
    const i = rest.indexOf(":");
    return {
      kind: "placeholder" as const,
      moduleTitle: rest.slice(0, i),
      sectionLabel: rest.slice(i + 1),
    };
  }

  return { kind: "unknown" as const };
}

const restrictToVertical: Modifier = ({ transform }: any) => ({
  ...transform,
  x: 0,
});

const transitionStyle = {
  transition:
    "transform 250ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease",
};

function clampIndent(n: unknown) {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
  return Math.max(0, Math.min(3, v));
}

// HYBRID collapse boundary:
// next section OR outdent (indent <= sectionIndent)
function findCollapsedInsertIndex(mod: ModuleT, sectionLabel: string) {
  const i = mod.items.findIndex((it) => it.label === sectionLabel);
  if (i < 0) return mod.items.length;

  const section = mod.items[i];
  const sectionIndent = clampIndent(section.indent ?? 0);

  let j = i + 1;
  while (j < mod.items.length) {
    const nxt = mod.items[j];

    if (nxt.type === "section") break;

    const nxtIndent = clampIndent(nxt.indent ?? 0);
    if (nxtIndent <= sectionIndent) break;

    j += 1;
  }

  return j;
}

/** ---------------------------
 * Global Student View helpers
 * --------------------------*/
function studentViewStorageKey(courseId: string) {
  return `canvasClone:studentView:${courseId}`;
}

function readStudentView(courseId: string) {
  try {
    const raw = window.localStorage.getItem(studentViewStorageKey(courseId));
    // default ON if not set
    return raw == null ? true : raw === "true";
  } catch {
    return true;
  }
}

function DraggableModuleShell(props: {
  id: IdModule;
  title: string;
  items: Item[];
  fadeOut: boolean;
  courseId?: string;

  requirementsMode: ModuleRequirementsMode;
  moduleLocked: boolean;
  completedCount: number;
  totalCount: number;

  isItemCompleted: (label: string) => boolean;
  isItemLocked: (label: string, type: string) => boolean;
  onToggleItemCompleted: (label: string) => void;
  onCompleteAllItems: () => void;

  onAddItem: (moduleTitle: string, newItem: Item) => void;
  onEditItem: (moduleTitle: string, oldLabel: string, newLabel: string) => void;
  onEditItemFull: (
    moduleTitle: string,
    oldLabel: string,
    updatedItem: Item,
  ) => void;
  onDeleteItem: (moduleTitle: string, labelToRemove: string) => void;

  onIndentItem: (moduleTitle: string, label: string) => void;
  onOutdentItem: (moduleTitle: string, label: string) => void;
  onToggleSectionCollapsed: (moduleTitle: string, sectionLabel: string) => void;

  onOpenRequirements: () => void;

  onEditModule: (oldTitle: string, newTitle: string) => void;
  onDeleteModule: (titleToDelete: string) => void;

  getItemId: (label: string) => IdItem;
  getContainerId: () => IdContainer;

  dropIndex: number | null;
  moduleIsHighlighted: boolean;

  onOpenPageItem: (label: string, pageId?: string) => void;
  onOpenFileItem: (label: string, fileId?: string) => void;
  onOpenLinkItem: (label: string, url?: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    ...transitionStyle,
    zIndex: isDragging ? 60 : "auto",
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-start group rounded-xl transition-all ${
        isDragging
          ? "translate-y-2 shadow-[0_8px_20px_rgba(0,0,0,0.25)] ring-2 ring-blue-300/40 bg-white/95 backdrop-blur-sm duration-200"
          : "shadow-sm hover:shadow-md hover:shadow-gray-300/40 duration-100"
      } ${
        props.moduleIsHighlighted ? "ring-2 ring-blue-400/60 bg-blue-50/60" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing transition-opacity duration-150"
      >
        <GripVertical className="w-5 h-5" />
      </div>

      <div className="flex-1">
        <ModuleItem
          title={props.title}
          items={props.items}
          fadeOut={props.fadeOut}
          courseId={props.courseId}
          requirementsMode={props.requirementsMode}
          moduleLocked={props.moduleLocked}
          completedCount={props.completedCount}
          totalCount={props.totalCount}
          onOpenRequirements={props.onOpenRequirements}
          isItemCompleted={props.isItemCompleted}
          isItemLocked={props.isItemLocked}
          onToggleItemCompleted={props.onToggleItemCompleted}
          onCompleteAllItems={props.onCompleteAllItems}
          onAddItem={props.onAddItem}
          onEditItem={props.onEditItem}
          onEditItemFull={props.onEditItemFull}
          onDeleteItem={props.onDeleteItem}
          onIndentItem={props.onIndentItem}
          onOutdentItem={props.onOutdentItem}
          onToggleSectionCollapsed={props.onToggleSectionCollapsed}
          onEditModule={props.onEditModule}
          onDeleteModule={props.onDeleteModule}
          getItemId={props.getItemId}
          getContainerId={props.getContainerId}
          dropIndex={props.dropIndex}
          moduleIsHighlighted={props.moduleIsHighlighted}
          onOpenPageItem={props.onOpenPageItem}
          onOpenFileItem={props.onOpenFileItem}
          onOpenLinkItem={props.onOpenLinkItem}
        />
      </div>
    </div>
  );
}

export default function ModulesPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const effectiveCourseId = courseId ?? "default";

  const [modules, setModules] = useState<ModuleT[]>(() =>
    loadModulesFromStorage(),
  );
  const [progress, setProgress] = useState(() =>
    loadProgress(effectiveCourseId),
  );

  // ✅ Student view is GLOBAL now (CourseHeader controls it).
  const [studentView, setStudentView] = useState<boolean>(() =>
    readStudentView(effectiveCourseId),
  );

  // ✅ Keep page in sync when header toggles student view (same tab) or other tabs change it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === studentViewStorageKey(effectiveCourseId)) {
        setStudentView(readStudentView(effectiveCourseId));
      }
    };

    const onCustom = () => {
      setStudentView(readStudentView(effectiveCourseId));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("canvasClone:studentViewChanged", onCustom as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:studentViewChanged",
        onCustom as any,
      );
    };
  }, [effectiveCourseId]);

  const [fadingModules, setFadingModules] = useState<Set<string>>(new Set());
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);

  const [activeId, setActiveId] = useState<AnyId | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    moduleTitle: string | null;
    index: number | null; // FULL items index
  }>({ moduleTitle: null, index: null });
  const [highlightModuleTitle, setHighlightModuleTitle] = useState<
    string | null
  >(null);

  const [requirementsModalFor, setRequirementsModalFor] = useState<
    string | null
  >(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    saveModulesToStorage(modules);
  }, [modules]);

  useEffect(() => {
    setProgress(loadProgress(effectiveCourseId));
  }, [effectiveCourseId]);

  useEffect(() => {
    saveProgress(effectiveCourseId, progress);
  }, [effectiveCourseId, progress]);

  // Keep file refs synced
  useEffect(() => {
    const cid = courseId;
    if (!cid) return;

    const refMap = new Map<string, Set<string>>();
    for (const m of modules) {
      for (const it of m.items as any[]) {
        if (it?.type === "file" && it.fileId) {
          if (!refMap.has(it.fileId)) refMap.set(it.fileId, new Set());
          refMap.get(it.fileId)!.add(m.title);
        }
      }
    }
    mergeModuleRefsIntoFilesMeta(cid, refMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, courseId]);

  const moduleCompletion = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getModuleCompletion>>();
    for (const m of modules) map.set(m.title, getModuleCompletion(m, progress));
    return map;
  }, [modules, progress]);

  // Helper: a module is "considered complete" only if it is gated AND its required items are done.
  // If requirementsMode === "none", it does NOT gate others, so treat as complete for prerequisite purposes.
  const isModuleConsideredComplete = useMemo(() => {
    const fn = (m: ModuleT) => {
      const mode = m.requirementsMode ?? "none";
      if (!isModuleGated(mode)) return true; // not gating => considered complete
      return moduleCompletion.get(m.title)?.isComplete ?? true;
    };
    return fn;
  }, [moduleCompletion]);

  const moduleLockedMap = useMemo(() => {
    /**
     * - default: earlier gated modules incomplete => lock
     * - ignore: never locked by prerequisites
     * - module_number: lock until that module number is complete
     */
    const locked = new Map<string, boolean>();

    let gatedIncompleteSeen = false;

    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      const accessRule: ModuleAccessRule = (m.accessRule ?? "default") as any;

      let isLocked = false;

      if (accessRule === "ignore") {
        isLocked = false;
      } else if (accessRule === "module_number") {
        const n = Math.max(1, Math.floor(m.prereqModuleNumber ?? 1));
        const prereqIdx = n - 1;
        const prereq = modules[prereqIdx];
        if (prereq) isLocked = !isModuleConsideredComplete(prereq);
        else isLocked = false;
      } else {
        isLocked = gatedIncompleteSeen;
      }

      locked.set(m.title, isLocked);

      const mode = m.requirementsMode ?? "none";
      const gated = isModuleGated(mode);
      const complete = isModuleConsideredComplete(m);

      if (gated && !complete) gatedIncompleteSeen = true;
    }

    return locked;
  }, [modules, isModuleConsideredComplete]);

  const handleAddModule = (newModuleTitle: string) => {
    setModules((prev) => [
      ...prev,
      {
        title: newModuleTitle,
        items: [],
        requirementsMode: "none",
        accessRule: "default",
      },
    ]);
    setShowAddModuleModal(false);
  };

  /**
   * Completion rule:
   * - files/links complete by access (student mode only)
   * - pages manual (no auto complete)
   * - instructor preview (studentView OFF): DO NOT write progress
   */
  function markCompletedOnAccess(moduleTitle: string, label: string) {
    if (!studentView) return;

    const mod = modules.find((m) => m.title === moduleTitle);
    if (!mod) return;

    const mode = mod.requirementsMode ?? "none";
    if (mode === "none") return;

    const locked = moduleLockedMap.get(moduleTitle) ?? false;
    if (locked) return;

    const unlocked = isItemUnlocked(mod, mode, progress, label);
    if (!unlocked) return;

    setProgress((p) => setItemCompleted(p, moduleTitle, label, true));
  }

  const handleOpenPageItem = (
    moduleTitle: string,
    label: string,
    pageId?: string,
  ) => {
    const mod = modules.find((m) => m.title === moduleTitle);
    if (!mod) return;

    if (studentView) {
      const locked = moduleLockedMap.get(moduleTitle) ?? false;
      if (locked) return;

      const mode = mod.requirementsMode ?? "none";
      if (mode !== "none") {
        const unlocked = isItemUnlocked(mod, mode, progress, label);
        if (!unlocked) return;
      }
    }

    const cid = courseId;
    if (!cid) return;

    const finalPageId = pageId ?? slugifyLabel(label);

    navigate(
      studentView
        ? `/courses/${cid}/pages/${finalPageId}/view`
        : `/courses/${cid}/pages/${finalPageId}`,
    );

    // ✅ pages are NOT auto-completed here (viewer handles must_view auto-complete)
  };

  const handleOpenFileItem = (
    moduleTitle: string,
    label: string,
    fileId?: string,
  ) => {
    const mod = modules.find((m) => m.title === moduleTitle);
    if (!mod) return;

    if (studentView) {
      const locked = moduleLockedMap.get(moduleTitle) ?? false;
      if (locked) return;

      const mode = mod.requirementsMode ?? "none";
      if (mode !== "none") {
        const unlocked = isItemUnlocked(mod, mode, progress, label);
        if (!unlocked) return;
      }
    }

    const cid = courseId;
    if (!cid || !fileId) return;
    navigate(`/courses/${cid}/files/${fileId}`);

    markCompletedOnAccess(moduleTitle, label);
  };

  const handleOpenLinkItem = (
    moduleTitle: string,
    label: string,
    url?: string,
  ) => {
    const mod = modules.find((m) => m.title === moduleTitle);
    if (!mod) return;

    if (studentView) {
      const locked = moduleLockedMap.get(moduleTitle) ?? false;
      if (locked) return;

      const mode = mod.requirementsMode ?? "none";
      if (mode !== "none") {
        const unlocked = isItemUnlocked(mod, mode, progress, label);
        if (!unlocked) return;
      }
    }

    if (url) {
      const final = url.startsWith("http") ? url : `https://${url}`;
      window.open(final, "_blank", "noopener,noreferrer");
      markCompletedOnAccess(moduleTitle, label);
    }
  };

  // NOTE: you said you are not implementing "Complete All Items" right now.
  const handleCompleteAllItems = (_moduleTitle: string) => {
    // intentionally no-op for now
  };

  const handleEditModule = (oldTitle: string, newTitle: string) => {
    setModules((prev) =>
      prev.map((m) => (m.title === oldTitle ? { ...m, title: newTitle } : m)),
    );

    setProgress((p) => renameModule(p, oldTitle, newTitle));

    const cid = courseId;
    if (cid) replaceModuleTitleInAllFiles(cid, oldTitle, newTitle);
  };

  const handleDeleteModule = (title: string) => {
    setFadingModules((prev) => new Set([...prev, title]));
    setTimeout(() => {
      const cid = courseId;
      if (cid) {
        const mod = modules.find((m) => m.title === title);
        for (const it of (mod?.items ?? []) as any[]) {
          if (it?.type === "file" && it.fileId) {
            removeModuleRefFromFile(cid, it.fileId, title);
          }
        }
      }

      setModules((prev) => prev.filter((m) => m.title !== title));
      setProgress((p) => clearModule(p, title));

      setFadingModules((prev) => {
        const next = new Set(prev);
        next.delete(title);
        return next;
      });
    }, 250);
  };

  const handleAddItemToModule = (moduleTitle: string, newItem: Item) => {
    const makeUniqueLabel = (raw: string) => {
      const base = raw.trim();
      const mod = modules.find((m) => m.title === moduleTitle);
      const existing = new Set((mod?.items ?? []).map((it) => it.label));
      if (!existing.has(base)) return base;
      let n = 2;
      while (existing.has(`${base} (${n})`)) n += 1;
      return `${base} (${n})`;
    };

    const label = makeUniqueLabel((newItem as any).label);

    const normalizedIncoming: any = {
      ...newItem,
      label,
      indent: clampIndent((newItem as any).indent ?? 0),
      collapsed:
        (newItem as any).type === "section"
          ? !!(newItem as any).collapsed
          : undefined,
      requirementType:
        (newItem as any).type === "section"
          ? undefined
          : ((newItem as any).requirementType ?? "must_view"),
    };

    const itemToAdd: any =
      normalizedIncoming.type === "page"
        ? {
            ...normalizedIncoming,
            pageId: slugifyLabel(normalizedIncoming.label),
          }
        : normalizedIncoming;

    const cid = courseId;
    if (cid && itemToAdd.type === "file" && (itemToAdd as any).fileId) {
      addModuleRefToFile(cid, (itemToAdd as any).fileId, moduleTitle);
    }

    setModules((prev) =>
      prev.map((m) =>
        m.title === moduleTitle ? { ...m, items: [...m.items, itemToAdd] } : m,
      ),
    );
  };

  const handleEditItemInModule = (
    moduleTitle: string,
    oldLabel: string,
    newLabel: string,
  ) => {
    setModules((prev) =>
      prev.map((m) =>
        m.title === moduleTitle
          ? {
              ...m,
              items: m.items.map((it) =>
                it.label === oldLabel ? { ...it, label: newLabel } : it,
              ),
            }
          : m,
      ),
    );

    setProgress((p) => renameItem(p, moduleTitle, oldLabel, newLabel));
  };

  const handleEditItemInModuleFull = (
    moduleTitle: string,
    oldLabel: string,
    updatedItem: Item,
  ) => {
    const cid = courseId;

    const makeUniqueLabelForEdit = (raw: string) => {
      const base = raw.trim();
      const mod = modules.find((m) => m.title === moduleTitle);
      const existing = new Set(
        (mod?.items ?? [])
          .filter((it) => it.label !== oldLabel)
          .map((it) => it.label),
      );
      if (!existing.has(base)) return base;
      let n = 2;
      while (existing.has(`${base} (${n})`)) n += 1;
      return `${base} (${n})`;
    };

    const nextLabel = makeUniqueLabelForEdit((updatedItem as any).label);

    setModules((prev) =>
      prev.map((m) => {
        if (m.title !== moduleTitle) return m;

        return {
          ...m,
          items: m.items.map((it) => {
            if (it.label !== oldLabel) return it;

            const prevFileId =
              it.type === "file" ? (it as any).fileId : undefined;
            const nextFileId =
              (updatedItem as any).type === "file"
                ? (updatedItem as any).fileId
                : undefined;

            let next: any = {
              ...it,
              label: nextLabel,
              type: (updatedItem as any).type,
              url: (updatedItem as any).url,
              fileId: (updatedItem as any).fileId,
              fileName: (updatedItem as any).fileName,
              indent: clampIndent(
                (updatedItem as any).indent ?? (it as any).indent ?? 0,
              ),
              collapsed:
                (updatedItem as any).type === "section"
                  ? !!(updatedItem as any).collapsed
                  : undefined,
              requirementType:
                (updatedItem as any).type === "section"
                  ? undefined
                  : ((updatedItem as any).requirementType ??
                    (it as any).requirementType ??
                    "must_view"),
            };

            if (it.type === "page" && (updatedItem as any).type === "page") {
              next.pageId = (it as any).pageId ?? slugifyLabel(it.label);
            } else if (
              it.type !== "page" &&
              (updatedItem as any).type === "page"
            ) {
              next.pageId = slugifyLabel(nextLabel);
            } else if ((updatedItem as any).type !== "page") {
              delete (next as any).pageId;
            }

            if (cid) {
              if (prevFileId && prevFileId !== nextFileId) {
                removeModuleRefFromFile(cid, prevFileId, moduleTitle);
              }
              if (nextFileId) {
                addModuleRefToFile(cid, nextFileId, moduleTitle);
              }
            }

            return next;
          }),
        };
      }),
    );

    setProgress((p) => renameItem(p, moduleTitle, oldLabel, nextLabel));
  };

  const handleDeleteItemInModule = (moduleTitle: string, label: string) => {
    const cid = courseId;

    setModules((prev) => {
      const module = prev.find((m) => m.title === moduleTitle);
      const itemToRemove = module?.items.find((it) => it.label === label);

      const next = prev.map((m) =>
        m.title === moduleTitle
          ? { ...m, items: m.items.filter((it) => it.label !== label) }
          : m,
      );

      if (
        cid &&
        itemToRemove &&
        itemToRemove.type === "file" &&
        (itemToRemove as any).fileId
      ) {
        removeModuleRefFromFile(cid, (itemToRemove as any).fileId, moduleTitle);
      }

      return next;
    });

    setProgress((p) => clearItem(p, moduleTitle, label));
  };

  const handleIndentItem = (moduleTitle: string, label: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.title !== moduleTitle
          ? m
          : {
              ...m,
              items: m.items.map((it) =>
                it.label === label
                  ? { ...it, indent: clampIndent((it.indent ?? 0) + 1) }
                  : it,
              ),
            },
      ),
    );
  };

  const handleOutdentItem = (moduleTitle: string, label: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.title !== moduleTitle
          ? m
          : {
              ...m,
              items: m.items.map((it) =>
                it.label === label
                  ? { ...it, indent: clampIndent((it.indent ?? 0) - 1) }
                  : it,
              ),
            },
      ),
    );
  };

  const handleToggleSectionCollapsed = (
    moduleTitle: string,
    sectionLabel: string,
  ) => {
    setModules((prev) =>
      prev.map((m) =>
        m.title !== moduleTitle
          ? m
          : {
              ...m,
              items: m.items.map((it) =>
                it.label === sectionLabel && it.type === "section"
                  ? { ...it, collapsed: !(it as any).collapsed }
                  : it,
              ),
            },
      ),
    );
  };

  const activeMeta = useMemo(() => {
    if (!activeId) return null;
    const p = parseId(String(activeId));
    if (p.kind === "module") {
      const mod = modules.find((m) => m.title === p.title);
      return mod
        ? { type: "module" as const, title: mod.title, count: mod.items.length }
        : null;
    }
    if (p.kind === "item") {
      const it = modules
        .find((m) => m.title === p.moduleTitle)
        ?.items.find((i) => i.label === p.label);
      return it ? { type: "item" as const, label: it.label } : null;
    }
    return null;
  }, [activeId, modules]);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as AnyId);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const a = parseId(String(active.id));
    const b = parseId(String(over.id));

    setHighlightModuleTitle(null);
    setDropIndicator({ moduleTitle: null, index: null });

    if (a.kind === "module" && b.kind === "module") {
      setHighlightModuleTitle(b.title);
      return;
    }

    if (a.kind === "item") {
      if (b.kind === "placeholder") {
        const mod = modules.find((m) => m.title === b.moduleTitle);
        if (!mod) return;

        const insertIndex = findCollapsedInsertIndex(mod, b.sectionLabel);
        setDropIndicator({ moduleTitle: b.moduleTitle, index: insertIndex });
        return;
      }

      if (b.kind === "item") {
        const overElem = document.querySelector(`[data-id='${over.id}']`);
        if (!overElem) return;

        const rect = (overElem as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const clientY = (event.activatorEvent as MouseEvent)?.clientY ?? midY;
        const insertBefore = clientY < midY;

        const modTitle = b.moduleTitle;
        const overModule = modules.find((m) => m.title === modTitle);
        if (!overModule) return;

        const targetIndex = overModule.items.findIndex(
          (it) => it.label === b.label,
        );
        const finalIndex = insertBefore ? targetIndex : targetIndex + 1;

        setDropIndicator({ moduleTitle: modTitle, index: finalIndex });
        return;
      }

      if (b.kind === "container") {
        setDropIndicator({
          moduleTitle: b.moduleTitle,
          index:
            modules.find((m) => m.title === b.moduleTitle)?.items.length ?? 0,
        });
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setDropIndicator({ moduleTitle: null, index: null });
    setHighlightModuleTitle(null);
    if (!over) return;

    const a = parseId(String(active.id));
    const b = parseId(String(over.id));

    if (a.kind === "module" && b.kind === "module") {
      setModules((prev) => {
        const from = prev.findIndex((m) => m.title === a.title);
        const to = prev.findIndex((m) => m.title === b.title);
        if (from < 0 || to < 0 || from === to) return prev;
        return arrayMove(prev, from, to);
      });
      return;
    }

    if (a.kind === "item" && b.kind === "placeholder") {
      const cid = courseId;

      setModules((prev) => {
        const fromIdx = prev.findIndex((m) => m.title === a.moduleTitle);
        const toIdx = prev.findIndex((m) => m.title === b.moduleTitle);
        if (fromIdx < 0 || toIdx < 0) return prev;

        const toMod = prev[toIdx];
        const insertIndex = findCollapsedInsertIndex(toMod, b.sectionLabel);

        if (fromIdx === toIdx) {
          const list = [...prev[toIdx].items];
          const oldIdx = list.findIndex((it) => it.label === a.label);
          if (oldIdx < 0) return prev;
          const [moving] = list.splice(oldIdx, 1);

          const tempMod: ModuleT = { ...toMod, items: list };
          const insert2 = findCollapsedInsertIndex(tempMod, b.sectionLabel);
          const safe2 = Math.max(0, Math.min(list.length, insert2));
          list.splice(safe2, 0, moving);

          const next = [...prev];
          next[toIdx] = { ...next[toIdx], items: list };
          return next;
        }

        const source = [...prev[fromIdx].items];
        const oldIndex = source.findIndex((it) => it.label === a.label);
        if (oldIndex < 0) return prev;
        const [moving] = source.splice(oldIndex, 1);

        if (cid && moving?.type === "file" && (moving as any).fileId) {
          const fileId = (moving as any).fileId as string;
          removeModuleRefFromFile(cid, fileId, a.moduleTitle);
          addModuleRefToFile(cid, fileId, b.moduleTitle);
        }

        const target = [...prev[toIdx].items];
        const safeIndex = Math.max(0, Math.min(target.length, insertIndex));
        target.splice(safeIndex, 0, moving);

        const next = [...prev];
        next[fromIdx] = { ...next[fromIdx], items: source };
        next[toIdx] = { ...next[toIdx], items: target };
        return next;
      });

      return;
    }

    if (a.kind === "item" && (b.kind === "item" || b.kind === "container")) {
      const cid = courseId;

      setModules((prev) => {
        const fromIdx = prev.findIndex((m) => m.title === a.moduleTitle);
        const toIdx = prev.findIndex((m) => m.title === b.moduleTitle);
        if (fromIdx < 0 || toIdx < 0) return prev;

        if (fromIdx === toIdx) {
          const list = [...prev[fromIdx].items];
          const oldIndex = list.findIndex((it) => it.label === a.label);
          if (oldIndex < 0) return prev;

          const newIndex =
            b.kind === "item"
              ? list.findIndex((it) => it.label === b.label)
              : list.length;

          const reordered = arrayMove(list, oldIndex, newIndex);
          const next = [...prev];
          next[fromIdx] = { ...next[fromIdx], items: reordered };
          return next;
        }

        const source = [...prev[fromIdx].items];
        const oldIndex = source.findIndex((it) => it.label === a.label);
        if (oldIndex < 0) return prev;

        const [moving] = source.splice(oldIndex, 1);
        const target = [...prev[toIdx].items];

        if (cid && moving?.type === "file" && (moving as any).fileId) {
          const fileId = (moving as any).fileId as string;
          removeModuleRefFromFile(cid, fileId, a.moduleTitle);
          addModuleRefToFile(cid, fileId, b.moduleTitle);
        }

        const insertAt =
          b.kind === "item"
            ? target.findIndex((it) => it.label === b.label)
            : target.length;

        const insertIndex = insertAt >= 0 ? insertAt : target.length;
        target.splice(insertIndex, 0, moving);

        const next = [...prev];
        next[fromIdx] = { ...next[fromIdx], items: source };
        next[toIdx] = { ...next[toIdx], items: target };
        return next;
      });
    }
  }

  // ✅ Canvas-like “student view” highlight around the whole page
  const studentViewFrameClass = studentView
    ? "ring-4 ring-canvas-blue/25 ring-inset"
    : "";

  return (
    <div
      className={`flex flex-col w-full bg-canvas-grayLight h-full ${studentViewFrameClass}`}
    >
      <CourseHeader />

      <div className="flex-1 px-20 py-10 overflow-y-auto bg-white relative">
        <div className="max-w-5xl space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-canvas-grayDark">
                Modules
              </h2>
              <p className="text-gray-600">
                Organize your course content into modules.
              </p>
            </div>

            {/* Removed the weird toggle from here (CourseHeader owns the global button now) */}
          </div>

          {!studentView && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <span className="font-semibold">Instructor Preview mode.</span>{" "}
              Student gating is ignored, and accessing items will not change
              completion/progress.
            </div>
          )}

          <div className="h-px bg-gray-200 my-6" />

          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {modules.length} module{modules.length !== 1 ? "s" : ""}
            </p>

            <button
              onClick={() => setShowAddModuleModal(true)}
              className="flex items-center gap-2 bg-[#008EE2] hover:bg-[#0079C2] text-white px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Module
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVertical]}
          >
            <SortableContext
              items={modules.map((m) => modId(m.title))}
              strategy={verticalListSortingStrategy}
            >
              {modules.map((mod) => {
                const mode = mod.requirementsMode ?? "none";

                // ✅ Instructor preview ignores all module gating/locking
                const locked = studentView
                  ? (moduleLockedMap.get(mod.title) ?? false)
                  : false;

                const comp = moduleCompletion.get(mod.title) ?? {
                  completedCount: 0,
                  totalCount: 0,
                  isComplete: true,
                };

                return (
                  <DraggableModuleShell
                    key={mod.title}
                    id={modId(mod.title)}
                    title={mod.title}
                    items={mod.items}
                    fadeOut={fadingModules.has(mod.title)}
                    courseId={courseId}
                    requirementsMode={mode}
                    moduleLocked={locked}
                    completedCount={comp.completedCount}
                    totalCount={comp.totalCount}
                    onOpenRequirements={() =>
                      setRequirementsModalFor(mod.title)
                    }
                    isItemCompleted={(label) =>
                      getItemCompleted(progress, mod.title, label)
                    }
                    isItemLocked={(label, type) => {
                      if (type === "section") return false;

                      // ✅ Instructor preview: ignore all item gating
                      if (!studentView) return false; // <-- fixes your TS error path

                      // lock takes precedence even when mode === "none"
                      if (locked) return true;

                      if (mode === "none") return false;

                      return !isItemUnlocked(mod, mode, progress, label);
                    }}
                    onToggleItemCompleted={() => {}}
                    onCompleteAllItems={() => handleCompleteAllItems(mod.title)}
                    onAddItem={handleAddItemToModule}
                    onEditItem={handleEditItemInModule}
                    onEditItemFull={handleEditItemInModuleFull}
                    onDeleteItem={handleDeleteItemInModule}
                    onIndentItem={handleIndentItem}
                    onOutdentItem={handleOutdentItem}
                    onToggleSectionCollapsed={handleToggleSectionCollapsed}
                    onEditModule={handleEditModule}
                    onDeleteModule={handleDeleteModule}
                    getItemId={(label) => itemId(mod.title, label)}
                    getContainerId={() => containerId(mod.title)}
                    dropIndex={
                      dropIndicator.moduleTitle === mod.title
                        ? dropIndicator.index
                        : null
                    }
                    moduleIsHighlighted={highlightModuleTitle === mod.title}
                    onOpenPageItem={(label, pageId) =>
                      handleOpenPageItem(mod.title, label, pageId)
                    }
                    onOpenFileItem={(label, fileId) =>
                      handleOpenFileItem(mod.title, label, fileId)
                    }
                    onOpenLinkItem={(label, url) =>
                      handleOpenLinkItem(mod.title, label, url)
                    }
                  />
                );
              })}
            </SortableContext>

            <DragOverlay dropAnimation={null} adjustScale={false}>
              {activeMeta?.type === "module" && (
                <div className="rounded-xl bg-white/95 backdrop-blur-sm shadow-[0_10px_28px_rgba(0,0,0,0.28)] ring-2 ring-blue-300/40 p-4 w-[680px]">
                  <div className="text-sm font-semibold text-[#2D3B45] mb-1">
                    {activeMeta.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {activeMeta.count} item{activeMeta.count === 1 ? "" : "s"}
                  </div>
                </div>
              )}

              {activeMeta?.type === "item" && (
                <div className="px-6 py-3 rounded-md bg-white/95 backdrop-blur-sm shadow-[0_8px_20px_rgba(0,0,0,0.25)] ring-1 ring-blue-200">
                  <span className="text-gray-700 text-[15px] select-none">
                    {activeMeta.label}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {showAddModuleModal && (
          <AddModuleModal
            onClose={() => setShowAddModuleModal(false)}
            onAdd={handleAddModule}
          />
        )}

        {requirementsModalFor && (
          <RequirementsModal
            moduleTitle={requirementsModalFor}
            initialMode={
              modules.find((m) => m.title === requirementsModalFor)
                ?.requirementsMode ?? "none"
            }
            initialAccessRule={
              modules.find((m) => m.title === requirementsModalFor)
                ?.accessRule ?? "default"
            }
            initialPrereqModuleNumber={
              modules.find((m) => m.title === requirementsModalFor)
                ?.prereqModuleNumber ?? 1
            }
            onClose={() => setRequirementsModalFor(null)}
            onSave={(payload: {
              mode: ModuleRequirementsMode;
              accessRule: ModuleAccessRule;
              prereqModuleNumber?: number;
            }) => {
              const { mode, accessRule, prereqModuleNumber } = payload;

              setModules((prev) =>
                prev.map((m) =>
                  m.title === requirementsModalFor
                    ? {
                        ...m,
                        requirementsMode: mode,
                        accessRule,
                        prereqModuleNumber:
                          accessRule === "module_number"
                            ? (prereqModuleNumber ?? 1)
                            : undefined,
                      }
                    : m,
                ),
              );

              if (mode === "none") {
                setProgress((p) => clearModule(p, requirementsModalFor));
              }

              setRequirementsModalFor(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
