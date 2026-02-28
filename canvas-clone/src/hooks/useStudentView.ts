// src/hooks/useStudentView.ts
import { useEffect, useState } from "react";

function studentViewStorageKey(courseId: string) {
  return `canvasClone:studentView:${courseId}`;
}

function readStudentView(courseId: string) {
  try {
    const raw = window.localStorage.getItem(studentViewStorageKey(courseId));
    return raw == null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function useStudentView(courseId: string) {
  const [studentView, setStudentView] = useState<boolean>(() =>
    readStudentView(courseId),
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === studentViewStorageKey(courseId)) {
        setStudentView(readStudentView(courseId));
      }
    };
    const onCustom = () => setStudentView(readStudentView(courseId));

    window.addEventListener("storage", onStorage);
    window.addEventListener("canvasClone:studentViewChanged", onCustom as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:studentViewChanged",
        onCustom as any,
      );
    };
  }, [courseId]);

  return studentView;
}
