import { filesMetaKey } from "./files";
import { announcementsKey } from "./announcements";
import { getPinnedIds } from "./pinnedCourses";
import { loadUser, saveUser } from "./userStore";

const LAST_VISIT_KEY = "canvasClone:lastVisit";
const ACTIVITY_KEY = "canvasClone:activity";
const COURSE_VISIT_KEY = "canvasClone:courseVisits";
const READ_ANNOUNCEMENTS_KEY = "canvasClone:readAnnouncements";
const PINNED_KEY = "canvasClone:pinnedCourses";

function progressKey(courseId: string) {
  return `canvasClone:progress:${courseId}`;
}

function assignmentsKey(courseId: string) {
  return `canvasClone:assignments:${courseId}`;
}

function quizzesKey(courseId: string) {
  return `canvasClone:quizzes:${courseId}`;
}

function quizAttemptsKey(courseId: string) {
  return `canvasClone:quizAttempts:${courseId}`;
}

function pagesIndexKey(courseId: string) {
  return `canvasClone:pagesIndex:${courseId}`;
}

function removeLocalStorageKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function removeKeysMatchingPrefix(prefix: string) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(prefix)) keysToRemove.push(key);
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

function cleanupPinnedCourses(deletedIds: Set<string>) {
  try {
    const pinned = getPinnedIds().filter((id) => !deletedIds.has(id));
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
  } catch {}
}

function cleanupActivity(deletedIds: Set<string>) {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as { courseId: string }[];
    if (!Array.isArray(list)) return;
    window.localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify(list.filter((e) => !deletedIds.has(e.courseId))),
    );
  } catch {}
}

function cleanupCourseVisits(deletedIds: Set<string>) {
  try {
    const raw = window.localStorage.getItem(COURSE_VISIT_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, number>;
    if (!map || typeof map !== "object") return;
    for (const id of deletedIds) delete map[id];
    window.localStorage.setItem(COURSE_VISIT_KEY, JSON.stringify(map));
  } catch {}
}

function cleanupReadAnnouncements(deletedIds: Set<string>) {
  try {
    const raw = window.localStorage.getItem(READ_ANNOUNCEMENTS_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, string[]>;
    if (!map || typeof map !== "object") return;
    for (const id of deletedIds) delete map[id];
    window.localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(map));
  } catch {}
}

function cleanupLastVisit(deletedIds: Set<string>) {
  try {
    const raw = window.localStorage.getItem(LAST_VISIT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { courseId?: string };
    if (parsed?.courseId && deletedIds.has(parsed.courseId)) {
      window.localStorage.removeItem(LAST_VISIT_KEY);
    }
  } catch {}
}

function cleanupEnrollments(deletedIds: Set<string>) {
  const user = loadUser();
  const next = user.enrolledCourseIds.filter((id) => !deletedIds.has(id));
  if (next.length !== user.enrolledCourseIds.length) {
    saveUser({ ...user, enrolledCourseIds: next });
  }
}

function cleanupCourseStorage(courseId: string) {
  removeLocalStorageKey(progressKey(courseId));
  removeLocalStorageKey(assignmentsKey(courseId));
  removeLocalStorageKey(quizzesKey(courseId));
  removeLocalStorageKey(quizAttemptsKey(courseId));
  removeLocalStorageKey(announcementsKey(courseId));
  removeLocalStorageKey(filesMetaKey(courseId));
  removeLocalStorageKey(pagesIndexKey(courseId));
  removeKeysMatchingPrefix(`canvasClone:page:${courseId}:`);
}

export function cleanupCourseData(courseIds: string[]) {
  const deletedIds = new Set(courseIds);
  if (!deletedIds.size) return;

  for (const id of deletedIds) {
    cleanupCourseStorage(id);
  }

  cleanupPinnedCourses(deletedIds);
  cleanupActivity(deletedIds);
  cleanupCourseVisits(deletedIds);
  cleanupReadAnnouncements(deletedIds);
  cleanupLastVisit(deletedIds);
  cleanupEnrollments(deletedIds);
}
