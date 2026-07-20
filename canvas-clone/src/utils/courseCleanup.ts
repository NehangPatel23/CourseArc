import { filesMetaKey } from "./files";
import { announcementsKey } from "./announcements";
import { getPinnedIds } from "./pinnedCourses";
import { loadUser, saveUser } from "./userStore";
import { loadModulesFromStorage, saveModulesToStorage } from "./modules";

const LAST_VISIT_KEY = "canvasClone:lastVisit";
const ACTIVITY_KEY = "canvasClone:activity";
const COURSE_VISIT_KEY = "canvasClone:courseVisits";
const READ_ANNOUNCEMENTS_KEY = "canvasClone:readAnnouncements";
const PINNED_KEY = "canvasClone:pinnedCourses";

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

/** Strip module items owned by the given course ids; drop empty modules. */
export function removeModulesForCourses(courseIds: string[]) {
  const deleted = new Set(courseIds);
  if (!deleted.size) return;
  const next = loadModulesFromStorage()
    .map((mod) => ({
      ...mod,
      items: mod.items.filter(
        (it) => !it.ownerCourseId || !deleted.has(it.ownerCourseId),
      ),
    }))
    .filter((mod) => mod.items.length > 0);
  saveModulesToStorage(next);
}

function cleanupCourseStorage(courseId: string) {
  removeLocalStorageKey(`canvasClone:progress:${courseId}`);
  removeLocalStorageKey(`canvasClone:assignments:${courseId}`);
  removeLocalStorageKey(`canvasClone:quizzes:${courseId}`);
  removeLocalStorageKey(`canvasClone:quizAttempts:${courseId}`);
  removeLocalStorageKey(`canvasClone:quizProgress:${courseId}`);
  removeLocalStorageKey(announcementsKey(courseId));
  removeLocalStorageKey(filesMetaKey(courseId));
  removeLocalStorageKey(`canvasClone:pagesIndex:${courseId}`);
  removeLocalStorageKey(`canvasClone:discussions:${courseId}`);
  removeLocalStorageKey(`canvasClone:courseRoster:${courseId}`);
  removeLocalStorageKey(`canvasClone:assignmentSubmissions:${courseId}`);
  removeLocalStorageKey(`canvasClone:discussionParticipations:${courseId}`);
  removeLocalStorageKey(`canvasClone:gradePublish:${courseId}`);
  removeLocalStorageKey(`canvasClone:courseTodos:${courseId}`);
  removeLocalStorageKey(`canvasClone:courseHomeLayout:${courseId}:student`);
  removeLocalStorageKey(`canvasClone:courseHomeLayout:${courseId}:instructor`);
  removeKeysMatchingPrefix(`canvasClone:page:${courseId}:`);
  removeKeysMatchingPrefix(`canvasClone:discussionReads:${courseId}:`);
}

/** Clear per-course localStorage keys without touching pins/enrollments. */
export function clearCourseStorage(courseId: string) {
  cleanupCourseStorage(courseId);
  removeModulesForCourses([courseId]);
}

export function cleanupCourseData(courseIds: string[]) {
  const deletedIds = new Set(courseIds);
  if (!deletedIds.size) return;

  for (const id of deletedIds) {
    cleanupCourseStorage(id);
  }

  removeModulesForCourses([...deletedIds]);
  cleanupPinnedCourses(deletedIds);
  cleanupActivity(deletedIds);
  cleanupCourseVisits(deletedIds);
  cleanupReadAnnouncements(deletedIds);
  cleanupLastVisit(deletedIds);
  cleanupEnrollments(deletedIds);
}
