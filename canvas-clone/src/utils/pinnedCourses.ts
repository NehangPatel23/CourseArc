import type { Course } from "./coursesStore";

const PINNED_KEY = "canvasClone:pinnedCourses";

export function getPinnedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function togglePin(courseId: string): string[] {
  const pinned = getPinnedIds();
  const next = pinned.includes(courseId)
    ? pinned.filter((id) => id !== courseId)
    : [...pinned, courseId];
  try {
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function isPinned(courseId: string) {
  return getPinnedIds().includes(courseId);
}

export function sortWithPinsFirst(courses: Course[]): Course[] {
  const pinned = new Set(getPinnedIds());
  const pinnedList = courses.filter((c) => pinned.has(c.id));
  const rest = courses.filter((c) => !pinned.has(c.id));
  return [...pinnedList, ...rest];
}
