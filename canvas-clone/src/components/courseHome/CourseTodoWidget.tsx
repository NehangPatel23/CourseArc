import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import DateTimeField from "../DateTimeField";
import {
  addCourseTodo,
  canEditCourseTodo,
  COURSE_TODOS_CHANGED_EVENT,
  deleteCourseTodo,
  loadVisibleCourseTodos,
  toggleCourseTodoComplete,
  updateCourseTodo,
  type CourseTodo,
  type CourseTodoScope,
} from "../../utils/courseTodos";
import { loadUser } from "../../utils/userStore";

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-sm font-semibold text-canvas-grayDark">{title}</div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function formatDue(ts?: number) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(todo: CourseTodo) {
  return !!todo.dueAt && !todo.completed && todo.dueAt < Date.now();
}

/** Normalize DateTimeField value to end-of-day for todo due dates. */
function toDueAtEndOfDay(ms?: number): number | undefined {
  if (ms == null) return undefined;
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export default function CourseTodoWidget({
  courseId,
  studentView,
}: {
  courseId: string;
  studentView: boolean;
}) {
  const user = loadUser();
  const [todos, setTodos] = useState<CourseTodo[]>(() =>
    loadVisibleCourseTodos(courseId, user.id),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDueAt, setDraftDueAt] = useState<number | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueAt, setNewDueAt] = useState<number | undefined>(undefined);
  const [newScope, setNewScope] = useState<CourseTodoScope>("personal");

  useEffect(() => {
    const refresh = () => setTodos(loadVisibleCourseTodos(courseId, loadUser().id));
    refresh();
    window.addEventListener(COURSE_TODOS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(COURSE_TODOS_CHANGED_EVENT, refresh);
  }, [courseId]);

  const startEdit = (todo: CourseTodo) => {
    setEditingId(todo.id);
    setDraftTitle(todo.title);
    setDraftDueAt(todo.dueAt);
  };

  const saveEdit = () => {
    if (!editingId || !draftTitle.trim()) return;
    const dueAt = toDueAtEndOfDay(draftDueAt);
    updateCourseTodo(courseId, editingId, {
      title: draftTitle.trim(),
      ...(dueAt != null ? { dueAt } : { clearDueAt: true }),
    });
    setEditingId(null);
    setDraftTitle("");
    setDraftDueAt(undefined);
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const scope: CourseTodoScope = studentView ? "personal" : newScope;
    addCourseTodo(
      courseId,
      {
        title: newTitle.trim(),
        dueAt: toDueAtEndOfDay(newDueAt),
      },
      { ownerId: user.id, scope },
    );
    setNewTitle("");
    setNewDueAt(undefined);
    setNewScope("personal");
    setShowAdd(false);
  };

  const canManage = (todo: CourseTodo) =>
    canEditCourseTodo(todo, user.id, !studentView);

  return (
    <WidgetCard title="To Do">
      {todos.length === 0 && !showAdd ? (
        <p className="text-sm text-gray-600">No to-do items yet.</p>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => {
            const overdue = isOverdue(todo);
            const editable = canManage(todo);
            return (
              <li key={todo.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!todo.completed}
                  onChange={() => toggleCourseTodoComplete(courseId, todo.id)}
                  className="mt-1 rounded border-gray-300"
                />
                {editingId === todo.id ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="form-input text-sm"
                      autoFocus
                    />
                    <DateTimeField
                      label="Due date"
                      value={draftDueAt}
                      onChange={setDraftDueAt}
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={saveEdit} className="btn-canvas-primary text-xs">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setDraftTitle("");
                          setDraftDueAt(undefined);
                        }}
                        className="btn-canvas-secondary text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-sm ${
                          todo.completed
                            ? "text-gray-400 line-through"
                            : overdue
                              ? "font-medium text-canvas-red"
                              : "text-canvas-grayDark"
                        }`}
                      >
                        {todo.title}
                      </span>
                      {todo.scope === "course" && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          <Users className="h-3 w-3" />
                          Class
                        </span>
                      )}
                    </span>
                    {todo.dueAt && (
                      <span
                        className={`mt-0.5 block text-xs ${
                          overdue ? "text-canvas-red" : "text-gray-500"
                        }`}
                      >
                        {overdue ? "Overdue · " : "Due "}
                        {formatDue(todo.dueAt)}
                      </span>
                    )}
                  </span>
                )}
                {editable && editingId !== todo.id && (
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => startEdit(todo)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Edit to-do"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCourseTodo(courseId, todo.id)}
                      className="rounded p-1 text-canvas-red hover:bg-red-50"
                      aria-label="Delete to-do"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3">
        {showAdd ? (
          <div className="space-y-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="To-do title"
              className="form-input w-full text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            {!studentView && (
              <div className="flex gap-3 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="todo-scope"
                    checked={newScope === "personal"}
                    onChange={() => setNewScope("personal")}
                    className="text-canvas-blue"
                  />
                  Personal
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="todo-scope"
                    checked={newScope === "course"}
                    onChange={() => setNewScope("course")}
                    className="text-canvas-blue"
                  />
                  For all students
                </label>
              </div>
            )}
            <DateTimeField label="Due date" value={newDueAt} onChange={setNewDueAt} />
            <div className="flex gap-2">
              <button type="button" onClick={handleAdd} className="btn-canvas-primary text-sm">
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setNewTitle("");
                  setNewDueAt(undefined);
                  setNewScope("personal");
                }}
                className="btn-canvas-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add to-do
          </button>
        )}
      </div>
    </WidgetCard>
  );
}
