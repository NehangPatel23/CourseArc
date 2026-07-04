// src/utils/studentView.ts
import { useEffect, useMemo, useState } from "react";

export const GLOBAL_STUDENT_VIEW_KEY = "canvasClone:studentView:global";
export const studentViewEventName = "canvasClone:studentViewChanged";

/** @deprecated Per-course keys are no longer used; kept for API compatibility. */
export function studentViewStorageKey(_courseId?: string) {
  return GLOBAL_STUDENT_VIEW_KEY;
}

export function readStudentView(_courseId?: string): boolean {
  try {
    const raw = window.localStorage.getItem(GLOBAL_STUDENT_VIEW_KEY);
    return raw == null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function writeGlobalStudentView(value: boolean) {
  try {
    window.localStorage.setItem(GLOBAL_STUDENT_VIEW_KEY, String(value));
  } catch {}
  broadcastStudentViewChanged();
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
 * App-wide student / instructor mode (persisted + synced across tabs).
 * studentView === true  → student experience (gating, read-only editors)
 * studentView === false → instructor experience (full editing, drafts visible)
 */
export function useStudentView(courseId?: string) {
  const courseKey = useMemo(() => courseId ?? "global", [courseId]);

  const [studentView, setStudentViewState] = useState<boolean>(() =>
    readStudentView(),
  );

  useEffect(() => {
    setStudentViewState(readStudentView());
  }, [courseKey]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GLOBAL_STUDENT_VIEW_KEY) {
        setStudentViewState(readStudentView());
      }
    };

    const onCustom = () => setStudentViewState(readStudentView());

    window.addEventListener("storage", onStorage);
    window.addEventListener(studentViewEventName, onCustom as EventListener);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(studentViewEventName, onCustom as EventListener);
    };
  }, []);

  const setStudentView = (value: boolean) => {
    setStudentViewState(value);
    writeGlobalStudentView(value);
  };

  const toggleStudentView = () => setStudentView(!studentView);

  return { studentView, toggleStudentView, setStudentView, courseKey };
}
