import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Icon from "../../icons/Icon";
import { notify } from "../ui/Toast";
import { WIDGET_LABELS } from "./widgetRegistry";
import {
  getAvailableWidgets,
  type WidgetId,
} from "../../utils/dashboardLayout";

type Props = {
  widgets: WidgetId[];
  hidden: WidgetId[];
  onReorder: (widgets: WidgetId[]) => void;
  onToggleVisibility: (id: WidgetId) => void;
  onReset: () => void;
  studentView: boolean;
};

function SortableItem({
  id,
  onToggleVisibility,
}: {
  id: WidgetId;
  onToggleVisibility: (id: WidgetId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border-b border-arc-ink/10 py-2.5 text-sm"
    >
      <button
        type="button"
        className="cursor-grab text-arc-mute hover:text-arc-ink"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={14} />
      </button>
      <span className="min-w-0 flex-1 truncate text-arc-ink">{WIDGET_LABELS[id]}</span>
      <button
        type="button"
        onClick={() => onToggleVisibility(id)}
        className="rounded-md p-1 text-arc-sage hover:bg-arc-cream"
        title="Hide panel"
        aria-label={`Hide ${WIDGET_LABELS[id]}`}
      >
        <Icon name="eye" size={14} />
      </button>
    </div>
  );
}

function HiddenItem({
  id,
  onToggleVisibility,
}: {
  id: WidgetId;
  onToggleVisibility: (id: WidgetId) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-dashed border-arc-ink/10 py-2.5 text-sm opacity-60">
      <span className="w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-arc-mute">{WIDGET_LABELS[id]}</span>
      <button
        type="button"
        onClick={() => onToggleVisibility(id)}
        className="rounded-md p-1 text-arc-mute hover:bg-arc-cream hover:text-arc-copper"
        title="Show panel"
        aria-label={`Show ${WIDGET_LABELS[id]}`}
      >
        <Icon name="eyeOff" size={14} />
      </button>
    </div>
  );
}

export default function DashboardCustomizer({
  widgets,
  hidden,
  onReorder,
  onToggleVisibility,
  onReset,
  studentView,
}: Props) {
  const [open, setOpen] = useState(false);
  const available = getAvailableWidgets(studentView);
  const hiddenOrdered = available.filter((id) => hidden.includes(id));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = widgets.indexOf(active.id as WidgetId);
    const newIndex = widgets.indexOf(over.id as WidgetId);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(widgets, oldIndex, newIndex));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-arc-mute transition-colors hover:text-arc-copper"
      >
        <Icon name="customize" size={12} />
        Arrange
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-arc-moss/50 p-4">
          <div className="paper-grain max-h-[85vh] w-full max-w-sm overflow-y-auto bg-arc-paper p-7 shadow-lift ring-1 ring-arc-ink/10">
            <p className="kicker">Desk</p>
            <h2 className="font-display mt-1 text-2xl font-medium text-arc-ink">Arrange panels</h2>
            <p className="mt-1 mb-5 text-sm leading-relaxed text-arc-mute">
              Show or hide sidebar panels. Drag to reorder the ones on the desk.
            </p>

            {widgets.length > 0 && (
              <>
                <p className="kicker mb-1">Visible</p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={widgets} strategy={verticalListSortingStrategy}>
                    <div>
                      {widgets.map((id) => (
                        <SortableItem
                          key={id}
                          id={id}
                          onToggleVisibility={onToggleVisibility}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            )}

            {hiddenOrdered.length > 0 && (
              <>
                <p className="kicker mb-1 mt-6">Hidden</p>
                <div>
                  {hiddenOrdered.map((id) => (
                    <HiddenItem
                      key={id}
                      id={id}
                      onToggleVisibility={onToggleVisibility}
                    />
                  ))}
                </div>
              </>
            )}

            {widgets.length === 0 && (
              <p className="border-l border-arc-gold py-1.5 pl-3 text-sm text-arc-ink">
                All panels are hidden. Show at least one from the list below.
              </p>
            )}

            <div className="mt-6 flex justify-between border-t border-arc-ink/10 pt-4">
              <button
                type="button"
                onClick={() => {
                  onReset();
                  notify("Dashboard layout reset", "layout");
                }}
                className="text-sm text-arc-mute hover:text-arc-ink"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-canvas-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
