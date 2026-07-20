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
import { Eye, EyeOff, GripVertical, Settings2, X } from "lucide-react";
import {
  COURSE_HOME_WIDGET_LABELS,
  getAvailableCourseHomeWidgets,
  reorderCourseHomeWidgets,
  resetCourseHomeLayout,
  toggleCourseHomeWidgetVisibility,
  type CourseHomeWidgetId,
} from "../../utils/courseHomeLayout";

function SortableItem({
  id,
  hidden,
  onToggle,
}: {
  id: CourseHomeWidgetId;
  hidden: boolean;
  onToggle: (id: CourseHomeWidgetId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
    >
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm text-canvas-grayDark">
        {COURSE_HOME_WIDGET_LABELS[id]}
      </span>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="rounded p-1 text-gray-500 hover:bg-gray-100"
        title={hidden ? "Show widget" : "Hide widget"}
      >
        {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function CourseHomeCustomizer({
  courseId,
  studentView,
  widgets,
  hidden,
  onClose,
  onChange,
}: {
  courseId: string;
  studentView: boolean;
  widgets: CourseHomeWidgetId[];
  hidden: CourseHomeWidgetId[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [localWidgets, setLocalWidgets] = useState(widgets);
  const [localHidden, setLocalHidden] = useState(hidden);
  const available = getAvailableCourseHomeWidgets(studentView);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localWidgets.indexOf(active.id as CourseHomeWidgetId);
    const newIndex = localWidgets.indexOf(over.id as CourseHomeWidgetId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(localWidgets, oldIndex, newIndex);
    setLocalWidgets(next);
    reorderCourseHomeWidgets(courseId, studentView, next);
    onChange();
  };

  const handleToggle = (id: CourseHomeWidgetId) => {
    toggleCourseHomeWidgetVisibility(courseId, studentView, id);
    setLocalHidden((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    onChange();
  };

  const handleReset = () => {
    resetCourseHomeLayout(courseId, studentView);
    onChange();
    onClose();
  };

  const ordered = [
    ...localWidgets.filter((id) => available.includes(id)),
    ...available.filter((id) => !localWidgets.includes(id)),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-canvas-grayDark">Customize sidebar</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="mb-4 text-sm text-gray-600">
            Drag to reorder. Use the eye icon to show or hide widgets.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {ordered.map((id) => (
                  <SortableItem
                    key={id}
                    id={id}
                    hidden={localHidden.includes(id)}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="flex justify-between border-t border-gray-200 px-5 py-4">
          <button type="button" onClick={handleReset} className="btn-canvas-secondary text-sm">
            Reset defaults
          </button>
          <button type="button" onClick={onClose} className="btn-canvas-primary text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
