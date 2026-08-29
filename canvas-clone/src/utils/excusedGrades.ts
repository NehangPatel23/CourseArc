const PREFIX = "canvasClone:excused:";
export const EXCUSED_CHANGED_EVENT = "canvasClone:excusedChanged";

function key(courseId: string) {
  return `${PREFIX}${courseId}`;
}

function loadMap(courseId: string): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(key(courseId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMap(courseId: string, map: Record<string, string[]>) {
  try {
    window.localStorage.setItem(key(courseId), JSON.stringify(map));
    window.dispatchEvent(new Event(EXCUSED_CHANGED_EVENT));
  } catch {}
}

export function isGradeExcused(courseId: string, columnKey: string, studentId: string): boolean {
  return (loadMap(courseId)[columnKey] ?? []).includes(studentId);
}

export function setGradeExcused(
  courseId: string,
  columnKey: string,
  studentId: string,
  excused: boolean,
) {
  const map = loadMap(courseId);
  const set = new Set(map[columnKey] ?? []);
  if (excused) set.add(studentId);
  else set.delete(studentId);
  map[columnKey] = [...set];
  saveMap(courseId, map);
}
