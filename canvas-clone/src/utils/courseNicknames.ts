const KEY = "canvasClone:courseNicknames";
export const COURSE_NICKNAMES_CHANGED_EVENT = "canvasClone:courseNicknamesChanged";

function loadMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, string>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(COURSE_NICKNAMES_CHANGED_EVENT));
  } catch {}
}

export function getCourseNickname(courseId: string): string | undefined {
  const n = loadMap()[courseId]?.trim();
  return n || undefined;
}

export function setCourseNickname(courseId: string, nickname: string) {
  const map = loadMap();
  const next = nickname.trim();
  if (!next) delete map[courseId];
  else map[courseId] = next;
  saveMap(map);
}

export function displayCourseTitle(courseId: string, fallback: string): string {
  return getCourseNickname(courseId) ?? fallback;
}
