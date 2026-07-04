import { loadUser } from "./userStore";

type ReadMap = Record<string, number>;

function key(courseId: string, userId: string) {
  return `canvasClone:discussionReads:${courseId}:${userId}`;
}

function readMap(courseId: string, userId?: string): ReadMap {
  const uid = userId ?? loadUser().id;
  try {
    const raw = window.localStorage.getItem(key(courseId, uid));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMap(courseId: string, map: ReadMap, userId?: string) {
  const uid = userId ?? loadUser().id;
  try {
    window.localStorage.setItem(key(courseId, uid), JSON.stringify(map));
    window.dispatchEvent(new Event("canvasClone:discussionReadsChanged"));
  } catch {}
}

export function markTopicRead(courseId: string, topicId: string, at = Date.now()) {
  const user = loadUser();
  const map = readMap(courseId, user.id);
  map[topicId] = at;
  saveMap(courseId, map, user.id);
}

export function getTopicLastRead(courseId: string, topicId: string): number {
  return readMap(courseId)[topicId] ?? 0;
}

export function isTopicUnread(
  courseId: string,
  topicId: string,
  lastActivityAt?: number,
): boolean {
  if (!lastActivityAt) return false;
  return lastActivityAt > getTopicLastRead(courseId, topicId);
}

export function countUnreadTopics(
  courseId: string,
  topics: { id: string; lastActivityAt?: number; published: boolean }[],
): number {
  return topics.filter(
    (t) => t.published && isTopicUnread(courseId, t.id, t.lastActivityAt),
  ).length;
}
