// src/utils/studentView.ts
import { useEffect, useMemo, useState } from "react";

export const studentViewEventName = "canvasClone:studentViewChanged";

export function studentViewStorageKey(courseId: string) {
  return `canvasClone:studentView:${courseId}`;
}

export function readStudentView(courseId: string) {
  try {
    const raw = window.localStorage.getItem(studentViewStorageKey(courseId));
    // default ON if not set
    return raw == null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function writeStudentView(courseId: string, value: boolean) {
  try {
    window.localStorage.setItem(studentViewStorageKey(courseId), String(value));
  } catch {}
}

export function broadcastStudentViewChanged() {
  window.dispatchEvent(new Event(studentViewEventName));
}

/**
 * Global student view state (persisted + synced across tabs + same-tab broadcasts)
 */
export function useStudentView(courseId: string) {
  const effectiveCourseId = useMemo(() => courseId ?? "default", [courseId]);

  const [studentView, setStudentView] = useState<boolean>(() =>
    readStudentView(effectiveCourseId),
  );

  useEffect(() => {
    setStudentView(readStudentView(effectiveCourseId));
  }, [effectiveCourseId]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === studentViewStorageKey(effectiveCourseId)) {
        setStudentView(readStudentView(effectiveCourseId));
      }
    };

    const onCustom = () => {
      setStudentView(readStudentView(effectiveCourseId));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(studentViewEventName, onCustom as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(studentViewEventName, onCustom as any);
    };
  }, [effectiveCourseId]);

  const toggleStudentView = () => {
    const next = !studentView;
    setStudentView(next);
    writeStudentView(effectiveCourseId, next);
    broadcastStudentViewChanged();
  };

  return { studentView, toggleStudentView, courseKey: effectiveCourseId };
}
