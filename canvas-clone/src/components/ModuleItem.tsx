import { useMemo, useRef, useState } from "react";
import Icon from "../icons/Icon";
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
  assignmentId?: string;
  quizId?: string;
  discussionId?: string;
  ownerCourseId?: string;
  requirementType?: ItemRequirementType;
  assignedSectionIds?: string[];
  unlockAt?: string;
}

interface ModuleItemProps {
  title: string;
  items: CourseItem[];
  fadeOut?: boolean;
  courseId?: string;

  requirementsMode: ModuleRequirementsMode;
  moduleLocked: boolean;
  moduleLockReason?: string;
  completedCount: number;
  totalCount: number;

  // ✅ NEW: timed unlock rendering
  moduleTimeLocked?: boolean;
  moduleUnlockAtLabel?: string;

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
  onOpenAssignmentItem?: (
    label: string,
    assignmentId?: string,
    ownerCourseId?: string,
  ) => void;
  onOpenQuizItem?: (label: string, quizId?: string, ownerCourseId?: string) => void;
  onOpenDiscussionItem?: (
    label: string,
    discussionId?: string,
    ownerCourseId?: string,
  ) => void;

  studentView?: boolean;
  readOnly?: boolean;
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
  onOpenAssignmentItem,
  onOpenQuizItem,
  onOpenDiscussionItem,
  showCompletion,
  readOnly,
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
  onOpenAssignmentItem?: (
    label: string,
    assignmentId?: string,
    ownerCourseId?: string,
  ) => void;
  onOpenQuizItem?: (label: string, quizId?: string, ownerCourseId?: string) => void;
  onOpenDiscussionItem?: (
    label: string,
    discussionId?: string,
    ownerCourseId?: string,
  ) => void;
  showCompletion: boolean;
  readOnly: boolean;
}) {
  const id = getItemId(item.label);

  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } =
    useSortable({
      id,
      disabled: readOnly,
    });

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

  const TextClass = locked
    ? "text-arc-mute"
    : isSection
      ? "text-arc-mute"
      : "text-arc-ink";

  const openItem = () => {
    if (isSection) return;

    // Assignments/quizzes always reach their handler (even when the module gates
    // them) so the handler can route to the Item Unavailable info page with a
    // reason. Pages/files/links stay inert while locked.
    if (item.type === "assignment") {
      onOpenAssignmentItem?.(item.label, item.assignmentId, item.ownerCourseId);
      return;
    }
    if (item.type === "quiz") {
      onOpenQuizItem?.(item.label, item.quizId, item.ownerCourseId);
      return;
    }
    if (item.type === "discussion") {
      onOpenDiscussionItem?.(item.label, item.discussionId, item.ownerCourseId);
      return;
    }

    if (locked) return;

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
          ? "bg-arc-ivory shadow-lift ring-1 ring-arc-copper/30"
          : isSection
            ? "border-y border-arc-ink/10 bg-arc-paper/80 hover:bg-arc-paper"
            : "hover:bg-arc-paper/70"
      } ${
        isOver && !isDragging
          ? "outline outline-1 outline-arc-copper/35 bg-arc-copper/5"
          : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0" style={{ paddingLeft }}>
        {!readOnly && (
          <div
            title="Drag to reorder"
            {...attributes}
            {...listeners}
            className="cursor-grab text-arc-mute opacity-0 transition-opacity duration-150 hover:text-arc-ink group-hover:opacity-100 active:cursor-grabbing"
          >
            <Icon name="grip" size={16} />
          </div>
        )}

        {isSection ? (
          <button
            type="button"
            onClick={() => onToggleSection?.(item.label)}
            className="flex items-center gap-2 min-w-0 text-left bg-transparent border-none p-0 focus:outline-none"
            title={item.collapsed ? "Expand section" : "Collapse section"}
          >
            <Icon
              name={item.collapsed ? "chevronRight" : "chevronDown"}
              size={16}
              className="text-arc-mute"
            />
            <span
              className={`text-[12px] font-semibold tracking-wide uppercase truncate ${TextClass}`}
            >
              {item.label}
            </span>
          </button>
        ) : (
          <>
            {item.type === "page" && (
              <Icon name="file" size={16} className="text-arc-mute" />
            )}
            {item.type === "file" && (
              <Icon name="paperclip" size={16} className="text-arc-mute" />
            )}
            {item.type === "link" && (
              <Icon name="link" size={16} className="text-arc-mute" />
            )}
            {item.type === "assignment" && (
              <Icon name="clipboard" size={16} className="text-arc-mute" />
            )}
            {item.type === "quiz" && (
              <Icon name="help" size={16} className="text-arc-mute" />
            )}
            {item.type === "discussion" && (
              <Icon name="chat" size={16} className="text-arc-mute" />
            )}

            <div className="min-w-0 flex items-center gap-2">
              {item.type === "link" && item.url ? (
                <button
                  type="button"
                  onClick={openItem}
                  className={`relative flex items-center gap-1 text-[15px] select-none transition-colors bg-transparent border-none p-0 text-left ${
                    locked ? "cursor-not-allowed" : "hover:text-arc-ink"
                  } ${TextClass}`}
                  title={locked ? "Locked" : "Open link"}
                >
                  <span className="truncate">{item.label}</span>

                  <div
                    className="relative flex items-center"
                    onMouseEnter={handleMouseEnter}
                  >
                    <Icon
                      name="arrowUpRight"
                      size={14}
                      className="translate-x-1 text-arc-mute opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100"
                    />

                    <div
                      className={`absolute top-full mt-2 px-2.5 py-1.5 text-xs font-medium z-50 opacity-0 translate-y-1.5 scale-95 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-150 ease-out whitespace-nowrap
                      bg-arc-ivory ring-1 ring-arc-ink/10 text-arc-ink shadow-lift
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
                        className="absolute -top-[5px] left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-arc-ivory ring-1 ring-arc-ink/10"
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
                      ? "border-arc-ink/10 text-arc-mute bg-arc-paper"
                      : "border-arc-copper/25 text-arc-copper bg-arc-copper/10"
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
              <Icon name="lock" size={16} className="text-arc-mute" />
            ) : completed ? (
              <Icon name="checkCircle" size={20} className="text-arc-sage" />
            ) : (
              <Icon name="circle" size={20} className="text-arc-mute" />
            )}
          </div>
        )}

        {!readOnly && (
          <button
            type="button"
            className="text-arc-mute opacity-0 transition-opacity hover:text-arc-ink group-hover:opacity-100"
            onClick={(e) => onOpenItemMenu(e, item.label)}
            aria-label="Item actions"
          >
            <Icon name="more" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function CollapsedPlaceholderRow({
  moduleTitle,
  sectionLabel,
  hiddenCount,
  readOnly,
}: {
  moduleTitle: string;
  sectionLabel: string;
  hiddenCount: number;
  readOnly: boolean;
}) {
  if (readOnly) return null;

  const pid = placeholderId(moduleTitle, sectionLabel);
  const { isOver, setNodeRef } = useDroppable({ id: pid });

  return (
    <div
      ref={setNodeRef}
      data-id={pid}
      className={`mx-6 my-2 rounded-md border border-dashed px-4 py-2 text-sm transition-colors ${
        isOver
          ? "border-arc-copper/40 bg-arc-copper/10 text-arc-copper"
          : "border-arc-ink/20 bg-arc-paper text-arc-mute"
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
    onOpenAssignmentItem,
    onOpenQuizItem,
    onOpenDiscussionItem,
    studentView,
    readOnly: readOnlyProp,
    moduleTimeLocked,
    moduleUnlockAtLabel,
  } = props;

  const readOnly = readOnlyProp ?? !!studentView;

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
    disabled: readOnly,
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

  const showRequirementsUI =
    requirementsMode !== "none" && !moduleLocked && !readOnly;
  const showCompletion = requirementsMode !== "none";

  const lockTooltip =
    moduleLockReason ?? "Complete earlier required modules to unlock.";

  const isStudentView = !!studentView;
  const moduleIsComplete = totalCount > 0 && completedCount >= totalCount;

  const showSequentialBanner =
    requirementsMode === "sequential" &&
    (!isStudentView || (!moduleLocked && !moduleIsComplete));


  return (
    <div
      className={`relative bg-arc-ivory ring-1 ring-arc-ink/10 transition-all duration-200 ease-in-out ${
        fadeOut ? "animate-[shrinkFade_0.2s_ease-in-out_forwards]" : ""
      } ${moduleIsHighlighted ? "ring-1 ring-arc-copper/40 bg-arc-copper/5" : ""}`}
    >
      <div
        className={`flex items-center justify-between border-b border-arc-ink/10 px-4 py-3 ${
          moduleLocked
            ? "bg-arc-paper opacity-80"
            : "bg-arc-paper hover:bg-arc-paper/80"
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          className="flex min-w-0 cursor-pointer select-none items-center gap-2 font-display text-[15px] font-medium text-arc-ink"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
        >
          <Icon
            name={open ? "chevronDown" : "chevronRight"}
            size={16}
            className="text-arc-mute"
          />

          <span className="truncate">{title}</span>

          {requirementsMode !== "none" && (
            <span className="ml-2 flex-shrink-0 text-xs font-medium text-arc-mute">
              {completedCount}/{totalCount}
            </span>
          )}

          {/* Unlock-at pill (shows ONLY while time-locked; disappears once unlocked) */}
          {moduleTimeLocked && moduleUnlockAtLabel ? (
            <span
              title={`Unlocks at ${moduleUnlockAtLabel}`}
              className="ml-2 inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-arc-copper/25 bg-arc-copper/10 px-2 py-0.5 text-[11px] font-semibold text-arc-copper"
            >
              <Icon name="clock" size={14} />
              Unlocks at {moduleUnlockAtLabel}
            </span>
          ) : moduleLocked ? (
            <span
              title={lockTooltip}
              className="ml-2 inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-arc-ink/15 bg-arc-ivory px-2 py-0.5 text-[11px] font-semibold text-arc-mute"
            >
              <Icon name="lock" size={14} className="text-arc-mute" />
              Locked
            </span>
          ) : null}
        </div>

        <div
          className="flex items-center gap-3 relative"
          ref={moduleMenuButtonRef}
        >
          {showRequirementsUI && (
            <button
              type="button"
              onClick={onCompleteAllItems}
              className="btn-canvas-secondary px-3 py-1.5 text-xs"
              title="Mark all items complete"
            >
              Complete All Items
            </button>
          )}

          {!readOnly && (
            <div
              title="Add item"
              onClick={() => setShowAddItemModal(true)}
              className="cursor-pointer text-arc-copper hover:text-arc-copper/80"
            >
              <Icon name="plus" size={16} />
            </div>
          )}

          {!readOnly && (
            <button
              type="button"
              className="cursor-pointer text-arc-mute hover:text-arc-ink"
              onClick={(e) => {
                e.stopPropagation();
                setShowModuleMenu((prev) => !prev);
              }}
              aria-label="Module actions"
            >
              <Icon name="more" size={16} />
            </button>
          )}
        </div>
      </div>

      {showSequentialBanner && (
        <div className="border-b border-arc-ink/10 bg-arc-ivory px-4 py-3 text-sm text-arc-mute">
          You must move through the module sequentially in order to access
          contents.
        </div>
      )}

      {/* ✅ Locked banner body: time-locked gets special Canvas-like copy */}
      {moduleLocked && (
        <div className="flex items-center gap-2 border-b border-arc-ink/10 bg-arc-ivory px-4 py-3 text-sm text-arc-mute">
          <Icon name="lock" size={16} className="text-arc-mute" />
          <span>
            {moduleTimeLocked && moduleUnlockAtLabel
              ? `Not available until ${moduleUnlockAtLabel}.`
              : (moduleLockReason ??
                "This module is locked until you complete earlier required modules.")}
          </span>
        </div>
      )}

      <div
        ref={setDropRef}
        className={`transition-all duration-300 ease-in-out overflow-visible ${
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        } ${isOver ? "bg-arc-copper/5" : ""}`}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {!readOnly && dropIndex === 0 && <DropIndicator />}

          {entries.map((entry, renderIdx) => {
            if (entry.kind === "item") {
              const item = entry.item;
              const fullIndex = entry.fullIndex;

              return (
                <div key={item.label} className="relative">
                  {!readOnly && dropIndex === fullIndex && <DropIndicator />}

                  <SortableItemRow
                    item={item}
                    getItemId={getItemId}
                    isItemCompleted={isItemCompleted}
                    isItemLocked={isItemLocked}
                    showCompletion={showCompletion}
                    readOnly={readOnly}
                    onToggleSection={(label) =>
                      onToggleSectionCollapsed?.(title, label)
                    }
                    onOpenItemMenu={(e, label) => {
                      if (readOnly) return;
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
                    onOpenAssignmentItem={onOpenAssignmentItem}
                    onOpenQuizItem={onOpenQuizItem}
                    onOpenDiscussionItem={onOpenDiscussionItem}
                  />

                  {!readOnly &&
                    renderIdx === entries.length - 1 &&
                    dropIndex === items.length && <DropIndicator />}
                </div>
              );
            }

            const placeholderKey = `ph:${entry.sectionLabel}:${entry.insertIndex}`;
            return (
              <div key={placeholderKey} className="relative">
                {!readOnly && dropIndex === entry.insertIndex && (
                  <DropIndicator />
                )}
                <CollapsedPlaceholderRow
                  moduleTitle={title}
                  sectionLabel={entry.sectionLabel}
                  hiddenCount={entry.hiddenCount}
                  readOnly={readOnly}
                />
              </div>
            );
          })}

          {items.length === 0 && !readOnly && (
            <div className="border-t border-arc-ink/10 px-6 py-3 text-sm text-arc-mute">
              Drop items here…
            </div>
          )}
        </SortableContext>
      </div>

      {!readOnly && showModuleMenu && (
        <CanvasDropdown
          anchorRef={moduleMenuButtonRef}
          items={[
            {
              label: "Requirements",
              icon: <Icon name="settings" size={16} />,
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

      {!readOnly && showItemMenu && (
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

      {!readOnly && showAddItemModal && (
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

      {!readOnly && showEditItemModal && currentEditingItem && (
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
            assignmentId: currentEditingItem.assignmentId,
            quizId: currentEditingItem.quizId,
            discussionId: currentEditingItem.discussionId,
            pageId: currentEditingItem.pageId,
            requirementType: currentEditingItem.requirementType,
            assignedSectionIds: currentEditingItem.assignedSectionIds,
            unlockAt: currentEditingItem.unlockAt,
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

      {!readOnly && showEditModuleModal && (
        <EditModuleModal
          initialTitle={title}
          onClose={() => setShowEditModuleModal(false)}
          onSave={(newTitle) => {
            setShowEditModuleModal(false);
            onEditModule?.(title, newTitle);
          }}
        />
      )}

      {!readOnly && (
        <>
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
        </>
      )}
    </div>
  );
}
