// src/utils/studentView.ts
import { useEffect, useMemo, useState } from "react";

export type ViewAs = "student" | "ta" | "instructor";

export const GLOBAL_STUDENT_VIEW_KEY = "canvasClone:studentView:global";
export const VIEW_AS_KEY = "canvasClone:viewAs";
export const studentViewEventName = "canvasClone:studentViewChanged";

const ACTIVE_STUDENT_KEY = "canvasClone:activeStudentId";
const DEMO_PERSONA_CHANGED_EVENT = "canvasClone:demoPersonaChanged";
const DEMO_TA_PERSONA_ID = "demo_ta";
const DEMO_SELF_PERSONA_ID = "demo_self";

/** @deprecated Per-course keys are no longer used; kept for API compatibility. */
export function studentViewStorageKey(_courseId?: string) {
  return GLOBAL_STUDENT_VIEW_KEY;
}

function parseViewAs(raw: string | null): ViewAs | null {
  if (raw === "student" || raw === "ta" || raw === "instructor") return raw;
  return null;
}

/**
 * App-wide viewing-as mode. Migrates from the legacy boolean student-view key
 * when `viewAs` has not been written yet.
 */
export function readViewAs(_courseId?: string): ViewAs {
  try {
    const stored = parseViewAs(window.localStorage.getItem(VIEW_AS_KEY));
    if (stored) return stored;
    const studentRaw = window.localStorage.getItem(GLOBAL_STUDENT_VIEW_KEY);
    return studentRaw == null || studentRaw === "true" ? "student" : "instructor";
  } catch {
    return "student";
  }
}

export function readStudentView(_courseId?: string): boolean {
  return readViewAs() === "student";
}

/** Keep the demo persona id in sync so Student view never resumes as Taylor. */
function syncPersonaForViewAs(view: ViewAs) {
  try {
    if (view === "ta") {
      window.localStorage.setItem(ACTIVE_STUDENT_KEY, DEMO_TA_PERSONA_ID);
    } else if (view === "student") {
      const current = window.localStorage.getItem(ACTIVE_STUDENT_KEY);
      if (!current || current === DEMO_TA_PERSONA_ID || current === "1") {
        window.localStorage.setItem(ACTIVE_STUDENT_KEY, DEMO_SELF_PERSONA_ID);
      }
    }
  } catch {}
  window.dispatchEvent(new Event(DEMO_PERSONA_CHANGED_EVENT));
}

function persistViewAs(view: ViewAs) {
  try {
    window.localStorage.setItem(VIEW_AS_KEY, view);
    window.localStorage.setItem(GLOBAL_STUDENT_VIEW_KEY, String(view === "student"));
  } catch {}
  syncPersonaForViewAs(view);
  broadcastStudentViewChanged();
  window.dispatchEvent(new Event("canvasClone:userChanged"));
}

export function setViewAs(view: ViewAs) {
  persistViewAs(view);
}

export function writeGlobalStudentView(value: boolean) {
  persistViewAs(value ? "student" : "instructor");
}

export function writeStudentView(_courseId: string, value: boolean) {
  writeGlobalStudentView(value);
}

export function setStudentView(value: boolean) {
  writeGlobalStudentView(value);
}

export function broadcastStudentViewChanged() {
  window.dispatchEvent(new Event(studentViewEventName));
}

/**
 * App-wide viewing-as mode (persisted + synced across tabs).
 * studentView === true  → student experience (gating, read-only editors)
 * studentView === false → TA or instructor (staff; unpublished + grading)
 */
export function useStudentView(courseId?: string) {
  const courseKey = useMemo(() => courseId ?? "global", [courseId]);

  const [viewAs, setViewAsState] = useState<ViewAs>(() => readViewAs());

  useEffect(() => {
    setViewAsState(readViewAs());
  }, [courseKey]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GLOBAL_STUDENT_VIEW_KEY || e.key === VIEW_AS_KEY) {
        setViewAsState(readViewAs());
      }
    };

    const onCustom = () => setViewAsState(readViewAs());

    window.addEventListener("storage", onStorage);
    window.addEventListener(studentViewEventName, onCustom as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(studentViewEventName, onCustom as EventListener);
    };
  }, []);

  const setViewAsMode = (value: ViewAs) => {
    persistViewAs(value);
    setViewAsState(value);
  };

  const setStudentViewMode = (value: boolean) => {
    setViewAsMode(value ? "student" : "instructor");
  };

  const toggleStudentView = () => setStudentViewMode(viewAs !== "student");

  return {
    studentView: viewAs === "student",
    viewAs,
    setViewAs: setViewAsMode,
    toggleStudentView,
    setStudentView: setStudentViewMode,
    courseKey,
  };
}

export function useViewAs(courseId?: string): ViewAs {
  return useStudentView(courseId).viewAs;
}
