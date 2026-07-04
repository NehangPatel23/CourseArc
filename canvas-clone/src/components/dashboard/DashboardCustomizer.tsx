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
import { Eye, EyeOff, GripVertical, Settings2 } from "lucide-react";
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
      className="flex items-center gap-2 rounded-lg border border-canvas-border bg-white px-3 py-2 text-sm"
    >
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-canvas-grayDark">{WIDGET_LABELS[id]}</span>
      <button
        type="button"
        onClick={() => onToggleVisibility(id)}
        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
        title="Hide panel"
        aria-label={`Hide ${WIDGET_LABELS[id]}`}
      >
        <Eye className="h-4 w-4" />
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
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-canvas-border bg-gray-50 px-3 py-2 text-sm opacity-70">
      <span className="w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-gray-500">{WIDGET_LABELS[id]}</span>
      <button
        type="button"
        onClick={() => onToggleVisibility(id)}
        className="rounded p-1 text-gray-400 hover:bg-white hover:text-canvas-blue"
        title="Show panel"
        aria-label={`Show ${WIDGET_LABELS[id]}`}
      >
        <EyeOff className="h-4 w-4" />
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
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-canvas-grayLight hover:text-canvas-blue"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Customize panels
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-canvas-grayDark">Customize panels</h2>
            <p className="mt-1 mb-4 text-sm text-gray-500">
              Show or hide sidebar panels and drag to reorder visible ones.
            </p>

            {widgets.length > 0 && (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Visible
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={widgets} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
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
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Hidden
                </p>
                <div className="space-y-2">
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
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
                All panels are hidden. Show at least one from the list below.
              </p>
            )}

            <div className="mt-4 flex justify-between border-t border-canvas-border pt-4">
              <button
                type="button"
                onClick={onReset}
                className="text-sm text-gray-500 hover:text-canvas-grayDark"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-canvas-blue px-4 py-2 text-sm font-medium text-white hover:bg-canvas-blue/90"
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
