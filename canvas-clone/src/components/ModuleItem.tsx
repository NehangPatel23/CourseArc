import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Link as LinkIcon,
  MoreVertical,
  Plus,
  GripVertical,
  ExternalLink,
  CheckCircle2,
  Circle,
  Lock,
  Settings2,
} from "lucide-react";
import EditModuleModal from "./EditModuleModal";
import ConfirmDeletePageModal from "./ConfirmDeleteModal";
import CanvasDropdown from "./CanvasDropdown";
import ItemModal from "./ItemModal";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DropIndicator from "./DropIndicator";

type ModuleRequirementsMode = "none" | "all" | "sequential";
type ItemRequirementType = "must_view" | "must_mark_done";

interface CourseItem {
  type: string;
  label: string;
  indent?: number;
  collapsed?: boolean;
  url?: string;
  pageId?: string;
  fileId?: string;
  fileName?: string;
  requirementType?: ItemRequirementType;
}

interface ModuleItemProps {
  title: string;
  items: CourseItem[];
  fadeOut?: boolean;
  courseId?: string;

  requirementsMode: ModuleRequirementsMode;
  moduleLocked: boolean;
  moduleLockReason?: string; // ✅ NEW
  completedCount: number;
  totalCount: number;

  onOpenRequirements: () => void;

  isItemCompleted: (label: string) => boolean;
  isItemLocked: (label: string, type: string) => boolean;

  onToggleItemCompleted: (label: string) => void;
  onCompleteAllItems: () => void;

  onAddItem?: (moduleTitle: string, newItem: CourseItem) => void;
  onEditModule?: (oldTitle: string, newTitle: string) => void;
  onDeleteModule?: (title: string) => void;

  onEditItem?: (
    moduleTitle: string,
    oldLabel: string,
    newLabel: string,
  ) => void;
  onEditItemFull?: (
    moduleTitle: string,
    oldLabel: string,
    updatedItem: CourseItem,
  ) => void;
  onDeleteItem?: (moduleTitle: string, label: string) => void;

  onIndentItem?: (moduleTitle: string, label: string) => void;
  onOutdentItem?: (moduleTitle: string, label: string) => void;

  onToggleSectionCollapsed?: (
    moduleTitle: string,
    sectionLabel: string,
  ) => void;

  getItemId: (label: string) => `item:${string}:${string}`;
  getContainerId: () => `container:${string}`;

  dropIndex: number | null;
  moduleIsHighlighted: boolean;

  onOpenPageItem?: (label: string, pageId?: string) => void;
  onOpenFileItem?: (label: string, fileId?: string) => void;
  onOpenLinkItem?: (label: string, url?: string) => void;
}

const transitionStyle = {
  transition:
    "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease",
};

function clampIndent(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.floor(n)));
}

function placeholderId(moduleTitle: string, sectionLabel: string) {
  return `placeholder:${moduleTitle}:${sectionLabel}`;
}

type RenderEntry =
  | { kind: "item"; item: CourseItem; fullIndex: number }
  | {
      kind: "placeholder";
      sectionLabel: string;
      hiddenCount: number;
      insertIndex: number;
    };

function buildRenderEntries(items: CourseItem[]): RenderEntry[] {
  const entries: RenderEntry[] = [];

  let i = 0;
  while (i < items.length) {
    const it = items[i];

    if (it.type === "section" && it.collapsed) {
      const sectionIndent = clampIndent(it.indent ?? 0);

      let j = i + 1;
      let hiddenCount = 0;

      while (j < items.length) {
        const nxt = items[j];

        if (nxt.type === "section") break;

        const nxtIndent = clampIndent(nxt.indent ?? 0);
        if (nxtIndent <= sectionIndent) break;

        hiddenCount += 1;
        j += 1;
      }

      entries.push({ kind: "item", item: it, fullIndex: i });
      entries.push({
        kind: "placeholder",
        sectionLabel: it.label,
        hiddenCount,
        insertIndex: j,
      });

      i = j;
      continue;
    }

    entries.push({ kind: "item", item: it, fullIndex: i });
    i += 1;
  }

  return entries;
}

function SortableItemRow({
  item,
  getItemId,
  isItemCompleted,
  isItemLocked,
  onOpenItemMenu,
  onToggleSection,
  onOpenPageItem,
  onOpenFileItem,
  onOpenLinkItem,
  showCompletion,
}: {
  item: CourseItem;
  getItemId: (label: string) => string;
  isItemCompleted: (label: string) => boolean;
  isItemLocked: (label: string, type: string) => boolean;
  onOpenItemMenu: (e: React.MouseEvent, label: string) => void;
  onToggleSection?: (label: string) => void;
  onOpenPageItem?: (label: string, pageId?: string) => void;
  onOpenFileItem?: (label: string, fileId?: string) => void;
  onOpenLinkItem?: (label: string, url?: string) => void;
  showCompletion: boolean;
}) {
  const id = getItemId(item.label);
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } =
    useSortable({ id });

  const [tooltipPos, setTooltipPos] = useState<"left" | "center" | "right">(
    "center",
  );

  const isSection = item.type === "section";
  const indent = clampIndent(item.indent ?? 0);

  const baseLeft = 24;
  const indentStep = 24;
  const paddingLeft = baseLeft + indent * indentStep;

  const locked = isItemLocked(item.label, item.type);
  const completed = !isSection ? isItemCompleted(item.label) : false;

  const requirementType: ItemRequirementType = !isSection
    ? (item.requirementType ?? "must_view")
    : "must_view";

  const showViewRequiredChip =
    showCompletion &&
    !isSection &&
    requirementType === "must_view" &&
    !completed;

  const style = {
    transform: CSS.Transform.toString(transform),
    ...transitionStyle,
    zIndex: isDragging ? 40 : "auto",
    opacity: isDragging ? 0.85 : 1,
  } as React.CSSProperties;

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    if (rect.right + 100 > screenWidth) setTooltipPos("right");
    else if (rect.left < 100) setTooltipPos("left");
    else setTooltipPos("center");
  };

  const SectionChevron = item.collapsed ? ChevronRight : ChevronDown;

  const TextClass = locked
    ? "text-gray-400"
    : isSection
      ? "text-gray-500"
      : "text-gray-700";

  const openItem = () => {
    if (locked || isSection) return;

    if (item.type === "page") onOpenPageItem?.(item.label, item.pageId);
    else if (item.type === "file") onOpenFileItem?.(item.label, item.fileId);
    else if (item.type === "link") onOpenLinkItem?.(item.label, item.url);
  };

  return (
    <div
      ref={setNodeRef}
      data-id={id}
      style={style}
      className={`group flex items-center justify-between py-3 pr-6 relative transition-all duration-150 ${
        isDragging
          ? "bg-white/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] ring-1 ring-blue-200 rounded-md"
          : isSection
            ? "bg-slate-50 border-y border-gray-200 hover:bg-slate-50"
            : "hover:bg-gray-50"
      } ${
        isOver && !isDragging
          ? "outline outline-1 outline-blue-200 bg-blue-50/40"
          : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0" style={{ paddingLeft }}>
        <div
          title="Drag to reorder"
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-opacity duration-150"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {isSection ? (
          <button
            type="button"
            onClick={() => onToggleSection?.(item.label)}
            className="flex items-center gap-2 min-w-0 text-left bg-transparent border-none p-0 focus:outline-none"
            title={item.collapsed ? "Expand section" : "Collapse section"}
          >
            <SectionChevron className="w-4 h-4 text-gray-400" />
            <span
              className={`text-[12px] font-semibold tracking-wide uppercase truncate ${TextClass}`}
            >
              {item.label}
            </span>
          </button>
        ) : (
          <>
            {item.type === "page" && (
              <FileText className="w-4 h-4 text-gray-400" />
            )}
            {item.type === "file" && (
              <span className="text-gray-400 text-[13px] leading-none">📄</span>
            )}
            {item.type === "link" && (
              <LinkIcon className="w-4 h-4 text-gray-400" />
            )}

            <div className="min-w-0 flex items-center gap-2">
              {item.type === "link" && item.url ? (
                <button
                  type="button"
                  onClick={openItem}
                  className={`relative flex items-center gap-1 text-[15px] select-none transition-colors bg-transparent border-none p-0 text-left ${
                    locked ? "cursor-not-allowed" : "hover:text-gray-800"
                  } ${TextClass}`}
                  title={locked ? "Locked" : "Open link"}
                >
                  <span className="truncate">{item.label}</span>

                  <div
                    className="relative flex items-center"
                    onMouseEnter={handleMouseEnter}
                  >
                    <ExternalLink
                      className="w-3.5 h-3.5 text-gray-400 opacity-0 translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 ease-out"
                      strokeWidth={1.8}
                    />

                    <div
                      className={`absolute top-full mt-2 px-2.5 py-1.5 text-xs font-medium rounded-lg border backdrop-blur-sm shadow-[0_2px_6px_rgba(0,0,0,0.08)] z-50 opacity-0 translate-y-1.5 scale-95 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-150 ease-out whitespace-nowrap
                      bg-white/95 border-gray-300/70 text-gray-700
                      ${
                        tooltipPos === "left"
                          ? "left-0"
                          : tooltipPos === "right"
                            ? "right-0"
                            : "left-1/2 -translate-x-1/2"
                      }`}
                    >
                      Opens in new tab
                      <div
                        className={`absolute -top-[5px] left-1/2 -translate-x-1/2 w-2 h-2 rotate-45
                        bg-white/95 border-l border-t border-gray-300/70`}
                      />
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openItem}
                  className={`text-left text-[15px] bg-transparent border-none p-0 focus:outline-none truncate ${
                    locked ? "cursor-not-allowed" : "hover:underline"
                  } ${TextClass}`}
                  title={locked ? "Locked" : "Open"}
                >
                  {item.label}
                </button>
              )}

              {showViewRequiredChip && (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    locked
                      ? "border-gray-200 text-gray-400 bg-gray-50"
                      : "border-blue-200 text-blue-700 bg-blue-50"
                  }`}
                  title={
                    locked ? "Locked" : "Must view (auto-completes when opened)"
                  }
                >
                  View required
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {showCompletion && !isSection && (
          <div
            className={`select-none cursor-not-allowed ${locked ? "opacity-90" : ""}`}
            title={
              locked
                ? "Locked"
                : completed
                  ? "Completed (viewed)"
                  : "Incomplete (view required)"
            }
          >
            {locked ? (
              <Lock className="w-4 h-4 text-gray-300" />
            ) : completed ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <Circle className="w-5 h-5 text-gray-300" />
            )}
          </div>
        )}

        <MoreVertical
          className="w-4 h-4 text-gray-400 hover:text-gray-700 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => onOpenItemMenu(e, item.label)}
        />
      </div>
    </div>
  );
}

function CollapsedPlaceholderRow({
  moduleTitle,
  sectionLabel,
  hiddenCount,
}: {
  moduleTitle: string;
  sectionLabel: string;
  hiddenCount: number;
}) {
  const pid = placeholderId(moduleTitle, sectionLabel);
  const { isOver, setNodeRef } = useDroppable({ id: pid });

  return (
    <div
      ref={setNodeRef}
      data-id={pid}
      className={`mx-6 my-2 rounded-md border border-dashed px-4 py-2 text-sm transition-colors ${
        isOver
          ? "border-blue-300 bg-blue-50/60 text-blue-700"
          : "border-gray-300 bg-gray-50 text-gray-600"
      }`}
    >
      <span className="font-medium">
        {hiddenCount} item{hiddenCount === 1 ? "" : "s"}
      </span>{" "}
      hidden — drop here to move into this section
    </div>
  );
}

export default function ModuleItem(props: ModuleItemProps) {
  const {
    title,
    items,
    fadeOut,
    courseId,
    requirementsMode,
    moduleLocked,
    moduleLockReason,
    completedCount,
    totalCount,
    onOpenRequirements,
    isItemCompleted,
    isItemLocked,
    onCompleteAllItems,
    onAddItem,
    onEditModule,
    onDeleteModule,
    onEditItem,
    onEditItemFull,
    onDeleteItem,
    onIndentItem,
    onOutdentItem,
    onToggleSectionCollapsed,
    getItemId,
    getContainerId,
    dropIndex,
    moduleIsHighlighted,
    onOpenPageItem,
    onOpenFileItem,
    onOpenLinkItem,
  } = props;

  const [open, setOpen] = useState(true);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showEditModuleModal, setShowEditModuleModal] = useState(false);

  const [deleteModuleOpen, setDeleteModuleOpen] = useState(false);
  const [deleteItemLabel, setDeleteItemLabel] = useState<string | null>(null);

  const [showModuleMenu, setShowModuleMenu] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);

  const [editItemOriginalLabel, setEditItemOriginalLabel] = useState("");
  const [currentEditingItem, setCurrentEditingItem] =
    useState<CourseItem | null>(null);

  const moduleMenuButtonRef = useRef<HTMLDivElement | null>(null);

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: getContainerId(),
  });

  const entries = useMemo(() => buildRenderEntries(items), [items]);

  const sortableIds = useMemo(
    () =>
      entries
        .filter((e) => e.kind === "item")
        .map((e) => getItemId((e as any).item.label)),
    [entries, getItemId],
  );

  const currentIndent = clampIndent(currentEditingItem?.indent ?? 0);
  const isEditingSection = currentEditingItem?.type === "section";
  const isEditingSectionCollapsed = !!currentEditingItem?.collapsed;

  const showRequirementsUI = requirementsMode !== "none" && !moduleLocked;
  const showCompletion = requirementsMode !== "none";

  const lockTooltip =
    moduleLockReason ?? "Complete earlier required modules to unlock.";

  return (
    <div
      className={`border border-gray-200 rounded-lg bg-white shadow-sm transition-all duration-200 ease-in-out relative ${
        fadeOut ? "animate-[shrinkFade_0.2s_ease-in-out_forwards]" : ""
      } ${moduleIsHighlighted ? "ring-2 ring-blue-400/50 bg-blue-50/50" : ""}`}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 ${
          moduleLocked
            ? "bg-[#F5F8FA] opacity-80"
            : "bg-[#F5F8FA] hover:bg-[#EEF3F6]"
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-2 text-[15px] font-semibold text-[#2D3B45] cursor-pointer select-none min-w-0"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
        >
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}

          <span className="truncate">{title}</span>

          {requirementsMode !== "none" && (
            <span className="ml-2 text-xs font-medium text-gray-500 flex-shrink-0">
              {completedCount}/{totalCount}
            </span>
          )}

          {/* ✅ NEW: header "Locked" pill */}
          {moduleLocked && (
            <span
              title={lockTooltip}
              className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-gray-300 bg-white text-gray-700 flex-shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-gray-500" />
              Locked
            </span>
          )}
        </div>

        <div
          className="flex items-center gap-3 relative"
          ref={moduleMenuButtonRef}
        >
          {showRequirementsUI && (
            <button
              type="button"
              onClick={onCompleteAllItems}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              title="Mark all items complete"
            >
              Complete All Items
            </button>
          )}

          <div
            title="Add item"
            onClick={() => setShowAddItemModal(true)}
            className="cursor-pointer text-[#008EE2] hover:text-[#0079C2]"
          >
            <Plus className="w-4 h-4" />
          </div>

          <MoreVertical
            className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setShowModuleMenu((prev) => !prev);
            }}
          />
        </div>
      </div>

      {requirementsMode === "sequential" && (
        <div className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 bg-white">
          You must move through the module sequentially in order to access
          contents.
        </div>
      )}

      {moduleLocked && (
        <div className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 bg-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-400" />
          <span>
            {moduleLockReason ??
              "This module is locked until you complete earlier required modules."}
          </span>
        </div>
      )}

      <div
        ref={setDropRef}
        className={`transition-all duration-300 ease-in-out overflow-visible ${
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        } ${isOver ? "bg-blue-50/40" : ""}`}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {dropIndex === 0 && <DropIndicator />}

          {entries.map((entry, renderIdx) => {
            if (entry.kind === "item") {
              const item = entry.item;
              const fullIndex = entry.fullIndex;

              return (
                <div key={item.label} className="relative">
                  {dropIndex === fullIndex && <DropIndicator />}

                  <SortableItemRow
                    item={item}
                    getItemId={getItemId}
                    isItemCompleted={isItemCompleted}
                    isItemLocked={isItemLocked}
                    showCompletion={showCompletion}
                    onToggleSection={(label) =>
                      onToggleSectionCollapsed?.(title, label)
                    }
                    onOpenItemMenu={(e, label) => {
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setShowItemMenu({
                        label,
                        x: rect.right,
                        y: rect.bottom + window.scrollY,
                      });
                      setEditItemOriginalLabel(label);
                      setCurrentEditingItem(item);
                    }}
                    onOpenPageItem={onOpenPageItem}
                    onOpenFileItem={onOpenFileItem}
                    onOpenLinkItem={onOpenLinkItem}
                  />

                  {renderIdx === entries.length - 1 &&
                    dropIndex === items.length && <DropIndicator />}
                </div>
              );
            }

            const placeholderKey = `ph:${entry.sectionLabel}:${entry.insertIndex}`;
            return (
              <div key={placeholderKey} className="relative">
                {dropIndex === entry.insertIndex && <DropIndicator />}
                <CollapsedPlaceholderRow
                  moduleTitle={title}
                  sectionLabel={entry.sectionLabel}
                  hiddenCount={entry.hiddenCount}
                />
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="px-6 py-3 text-sm text-gray-400 border-t border-gray-100">
              Drop items here…
            </div>
          )}
        </SortableContext>
      </div>

      {/* menus & modals unchanged */}
      {showModuleMenu && (
        <CanvasDropdown
          anchorRef={moduleMenuButtonRef}
          items={[
            {
              label: "Requirements",
              icon: <Settings2 className="w-4 h-4" />,
              onClick: () => {
                setShowModuleMenu(false);
                onOpenRequirements();
              },
            },
            { type: "separator" },
            {
              label: "Edit",
              onClick: () => {
                setShowModuleMenu(false);
                setShowEditModuleModal(true);
              },
            },
            {
              label: "Delete",
              variant: "danger",
              onClick: () => {
                setShowModuleMenu(false);
                setDeleteModuleOpen(true);
              },
            },
          ]}
          onClose={() => setShowModuleMenu(false)}
        />
      )}

      {showItemMenu && (
        <CanvasDropdown
          position={{ x: showItemMenu.x, y: showItemMenu.y }}
          items={[
            {
              label: "Indent",
              disabled: currentIndent >= 3,
              onClick: () => {
                const label = showItemMenu.label;
                setShowItemMenu(null);
                onIndentItem?.(title, label);
              },
            },
            {
              label: "Outdent",
              disabled: currentIndent <= 0,
              onClick: () => {
                const label = showItemMenu.label;
                setShowItemMenu(null);
                onOutdentItem?.(title, label);
              },
            },
            ...(isEditingSection
              ? ([
                  { type: "separator" as const },
                  {
                    label: isEditingSectionCollapsed
                      ? "Expand section"
                      : "Collapse section",
                    onClick: () => {
                      const label = showItemMenu.label;
                      setShowItemMenu(null);
                      onToggleSectionCollapsed?.(title, label);
                    },
                  },
                ] as const)
              : ([] as const)),
            { type: "separator" },
            {
              label: "Edit",
              onClick: () => {
                setShowItemMenu(null);
                setShowEditItemModal(true);
              },
            },
            {
              label: "Delete",
              variant: "danger",
              onClick: () => {
                const label = showItemMenu.label;
                setShowItemMenu(null);
                setDeleteItemLabel(label);
              },
            },
          ]}
          onClose={() => setShowItemMenu(null)}
        />
      )}

      {showAddItemModal && (
        <ItemModal
          mode="add"
          courseId={courseId}
          moduleTitle={title}
          onClose={() => setShowAddItemModal(false)}
          onSubmit={(ni) => {
            const rt =
              (ni as any).requirementType ??
              ("must_view" as ItemRequirementType);

            onAddItem?.(title, {
              ...(ni as any),
              indent: 0,
              requirementType: (ni as any).type === "section" ? undefined : rt,
            });
            setShowAddItemModal(false);
          }}
        />
      )}

      {showEditItemModal && currentEditingItem && (
        <ItemModal
          mode="edit"
          courseId={courseId}
          moduleTitle={title}
          initialValues={{
            label: currentEditingItem.label,
            type: currentEditingItem.type as any,
            url: currentEditingItem.url,
            fileId: currentEditingItem.fileId,
            fileName: currentEditingItem.fileName,
            requirementType: currentEditingItem.requirementType,
          }}
          onClose={() => {
            setShowEditItemModal(false);
            setEditItemOriginalLabel("");
            setCurrentEditingItem(null);
          }}
          onSubmit={(updated) => {
            const rt =
              (updated as any).requirementType ??
              currentEditingItem.requirementType ??
              "must_view";

            const merged: CourseItem = {
              ...(updated as any),
              indent: currentEditingItem.indent ?? 0,
              collapsed:
                currentEditingItem.type === "section"
                  ? (currentEditingItem.collapsed ?? false)
                  : undefined,
              requirementType:
                (updated as any).type === "section" ? undefined : rt,
            };

            if (onEditItemFull) {
              onEditItemFull(title, editItemOriginalLabel, merged);
            } else if (merged.label !== editItemOriginalLabel) {
              onEditItem?.(title, editItemOriginalLabel, merged.label);
            }

            setShowEditItemModal(false);
            setEditItemOriginalLabel("");
            setCurrentEditingItem(null);
          }}
        />
      )}

      {showEditModuleModal && (
        <EditModuleModal
          initialTitle={title}
          onClose={() => setShowEditModuleModal(false)}
          onSave={(newTitle) => {
            setShowEditModuleModal(false);
            onEditModule?.(title, newTitle);
          }}
        />
      )}

      <ConfirmDeletePageModal
        isOpen={deleteModuleOpen}
        title="Delete module?"
        description={`This will permanently delete the module "${title}" and all items inside it. This cannot be undone.`}
        confirmText="Delete"
        onClose={() => setDeleteModuleOpen(false)}
        onConfirm={() => {
          onDeleteModule?.(title);
          setDeleteModuleOpen(false);
        }}
      />

      <ConfirmDeletePageModal
        isOpen={!!deleteItemLabel}
        title="Delete item?"
        description={
          deleteItemLabel
            ? `This will remove "${deleteItemLabel}" from the module "${title}". This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        onClose={() => setDeleteItemLabel(null)}
        onConfirm={() => {
          if (!deleteItemLabel) return;
          onDeleteItem?.(title, deleteItemLabel);
          setDeleteItemLabel(null);
        }}
      />
    </div>
  );
}
