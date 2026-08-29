export type PlannerOverlayEntry = {
  eventId: string;
  done?: boolean;
  note?: string;
};

const KEY = "canvasClone:plannerOverlay";
export const PLANNER_OVERLAY_CHANGED_EVENT = "canvasClone:plannerOverlayChanged";

function loadAll(): Record<string, PlannerOverlayEntry> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, PlannerOverlayEntry>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(PLANNER_OVERLAY_CHANGED_EVENT));
  } catch {}
}

export function getPlannerOverlay(eventId: string): PlannerOverlayEntry | undefined {
  return loadAll()[eventId];
}

export function setPlannerOverlayDone(eventId: string, done: boolean) {
  const all = loadAll();
  const prev = all[eventId] ?? { eventId };
  all[eventId] = { ...prev, eventId, done };
  saveAll(all);
}

export function setPlannerOverlayNote(eventId: string, note: string) {
  const all = loadAll();
  const prev = all[eventId] ?? { eventId };
  all[eventId] = { ...prev, eventId, note: note.trim() || undefined };
  saveAll(all);
}
