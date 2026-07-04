import { loadAnnouncements } from "./announcements";
import { loadFilesMeta } from "./files";
import { recordLastVisit, getLastVisit } from "./dashboard";

const ACTIVITY_KEY = "canvasClone:activity";
const COURSE_VISIT_KEY = "canvasClone:courseVisits";
const READ_ANNOUNCEMENTS_KEY = "canvasClone:readAnnouncements";
const MAX_ACTIVITY = 20;

export type ActivityEntry = {
  courseId: string;
  path: string;
  label: string;
  type: string;
  timestamp: number;
};

export function recordActivity(entry: Omit<ActivityEntry, "timestamp">) {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    const list: ActivityEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({ ...entry, timestamp: Date.now() });
    window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(0, MAX_ACTIVITY)));
    recordCourseVisit(entry.courseId);
    recordLastVisit(entry.courseId, entry.path);
  } catch {}
}

function recordCourseVisit(courseId: string) {
  try {
    const raw = window.localStorage.getItem(COURSE_VISIT_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[courseId] = Date.now();
    window.localStorage.setItem(COURSE_VISIT_KEY, JSON.stringify(map));
  } catch {}
}

export function getLastCourseVisit(courseId: string): number | null {
  try {
    const raw = window.localStorage.getItem(COURSE_VISIT_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, number>;
    return map[courseId] ?? null;
  } catch {
    return null;
  }
}

export function getRecentActivity(limit = 5): ActivityEntry[] {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ActivityEntry[];
    return list.slice(0, limit);
  } catch {
    return [];
  }
}

function getReadAnnouncementIds(courseId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(READ_ANNOUNCEMENTS_KEY);
    const map: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    return new Set(map[courseId] ?? []);
  } catch {
    return new Set();
  }
}

export function markAnnouncementRead(courseId: string, announcementId: string) {
  try {
    const raw = window.localStorage.getItem(READ_ANNOUNCEMENTS_KEY);
    const map: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    const set = new Set(map[courseId] ?? []);
    set.add(announcementId);
    map[courseId] = [...set];
    window.localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(map));
  } catch {}
}

export function getUnreadAnnouncementCount(courseId: string): number {
  const read = getReadAnnouncementIds(courseId);
  return loadAnnouncements(courseId).filter(
    (a) => a.status === "published" && !read.has(a.id),
  ).length;
}

export function getNewContentCount(courseId: string): number {
  const since = getLastCourseVisit(courseId);
  if (!since) return 0;
  let count = 0;
  for (const a of loadAnnouncements(courseId)) {
    if ((a.postedAt ?? 0) > since) count++;
  }
  for (const f of loadFilesMeta(courseId)) {
    if (f.uploadedAt > since) count++;
  }
  return count;
}

export function getCourseBadgeCount(courseId: string) {
  return {
    unreadAnnouncements: getUnreadAnnouncementCount(courseId),
    newContent: getNewContentCount(courseId),
    total: getUnreadAnnouncementCount(courseId) + getNewContentCount(courseId),
  };
}

export function getMostRecentlyEditedCourse(): string | null {
  const activity = getRecentActivity(20);
  if (activity.length) return activity[0].courseId;
  const last = getLastVisit();
  return last?.courseId ?? null;
}
