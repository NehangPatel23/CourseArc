import { loadUser } from "./userStore";

export type CourseTodoScope = "personal" | "course";

export type CourseTodo = {
  id: string;
  courseId: string;
  ownerId: string;
  scope: CourseTodoScope;
  title: string;
  body?: string;
  dueAt?: number;
  completed?: boolean;
  createdAt: number;
};

export const COURSE_TODOS_CHANGED_EVENT = "canvasClone:courseTodosChanged";

function key(courseId: string) {
  return `canvasClone:courseTodos:${courseId}`;
}

function normalizeTodo(raw: Partial<CourseTodo> & { id: string; courseId: string; title: string; createdAt: number }): CourseTodo {
  const user = loadUser();
  return {
    id: raw.id,
    courseId: raw.courseId,
    ownerId: raw.ownerId ?? user.id,
    scope: raw.scope ?? "course",
    title: raw.title,
    body: raw.body,
    dueAt: raw.dueAt,
    completed: raw.completed,
    createdAt: raw.createdAt,
  };
}

function readAll(courseId: string): CourseTodo[] {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeTodo(item));
  } catch {
    return [];
  }
}

function saveAll(courseId: string, items: CourseTodo[]) {
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(items));
    window.dispatchEvent(new Event(COURSE_TODOS_CHANGED_EVENT));
  } catch {}
}

function uid() {
  return `todo_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Todos visible to the given user: their personal items plus course-wide items. */
export function loadVisibleCourseTodos(
  courseId: string,
  userId = loadUser().id,
): CourseTodo[] {
  return readAll(courseId)
    .filter((t) => t.scope === "course" || (t.scope === "personal" && t.ownerId === userId))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** @deprecated Use loadVisibleCourseTodos — kept for backward compatibility in tests. */
export function loadCourseTodos(courseId: string): CourseTodo[] {
  return loadVisibleCourseTodos(courseId);
}

export function addCourseTodo(
  courseId: string,
  input: { title: string; body?: string; dueAt?: number },
  options?: { ownerId?: string; scope?: CourseTodoScope },
): CourseTodo {
  const user = loadUser();
  const ownerId = options?.ownerId ?? user.id;
  const scope = options?.scope ?? "personal";

  const item: CourseTodo = {
    id: uid(),
    courseId,
    ownerId,
    scope,
    title: input.title.trim(),
    body: input.body?.trim() || undefined,
    dueAt: input.dueAt,
    completed: false,
    createdAt: Date.now(),
  };
  saveAll(courseId, [...readAll(courseId), item]);
  return item;
}

export function updateCourseTodo(
  courseId: string,
  id: string,
  patch: Partial<Pick<CourseTodo, "title" | "body" | "dueAt" | "completed">> & {
    clearDueAt?: boolean;
  },
): void {
  saveAll(
    courseId,
    readAll(courseId).map((t) => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch };
      if (patch.clearDueAt) delete next.dueAt;
      delete (next as { clearDueAt?: boolean }).clearDueAt;
      return next;
    }),
  );
}

export function deleteCourseTodo(courseId: string, id: string): void {
  saveAll(courseId, readAll(courseId).filter((t) => t.id !== id));
}

export function toggleCourseTodoComplete(courseId: string, id: string): void {
  saveAll(
    courseId,
    readAll(courseId).map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t,
    ),
  );
}

export function canEditCourseTodo(
  todo: CourseTodo,
  userId = loadUser().id,
  isInstructor: boolean,
): boolean {
  if (todo.scope === "personal") return todo.ownerId === userId;
  return isInstructor;
}
