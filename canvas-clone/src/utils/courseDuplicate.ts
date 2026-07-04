import { addCourse, getCourseById } from "./coursesStore";
import { loadAnnouncements, saveAnnouncements } from "./announcements";
import { loadAssignments, saveAssignments } from "./assignments";
import { loadQuizzes, saveQuizzes } from "./quizzes";

function pageKey(courseId: string, pageId: string) {
  return `canvasClone:page:${courseId}:${pageId}`;
}

function pagesIndexKey(courseId: string) {
  return `canvasClone:pagesIndex:${courseId}`;
}

export function duplicateCourseWithContent(sourceId: string): string | null {
  const source = getCourseById(sourceId);
  if (!source) return null;

  const newId = addCourse({
    title: `${source.title} (Copy)`,
    code: `${source.code}-COPY`,
    short_name: source.short_name,
    term: source.term,
    color: source.color,
    published: false,
  });

  try {
    const pagesIndex = window.localStorage.getItem(pagesIndexKey(sourceId));
    if (pagesIndex) {
      window.localStorage.setItem(pagesIndexKey(newId), pagesIndex);
      const ids = JSON.parse(pagesIndex) as string[];
      if (Array.isArray(ids)) {
        for (const pageId of ids) {
          const content = window.localStorage.getItem(pageKey(sourceId, pageId));
          if (content) window.localStorage.setItem(pageKey(newId, pageId), content);
        }
      }
    }
    const announcements = loadAnnouncements(sourceId);
    if (announcements.length) {
      saveAnnouncements(
        newId,
        announcements.map((a) => ({ ...a, id: `${a.id}-copy-${Date.now()}` })),
      );
    }
    const assignments = loadAssignments(sourceId);
    if (assignments.length) {
      saveAssignments(
        newId,
        assignments.map((a) => ({ ...a, id: `${a.id}-copy-${Date.now()}` })),
      );
    }
    const quizzes = loadQuizzes(sourceId);
    if (quizzes.length) {
      saveQuizzes(
        newId,
        quizzes.map((q) => ({ ...q, id: `${q.id}-copy-${Date.now()}` })),
      );
    }
  } catch {}

  return newId;
}
