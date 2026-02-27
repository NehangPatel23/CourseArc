import { useEffect, useMemo, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import CourseSidebar from "../components/CourseSidebar";
import { Eye } from "lucide-react";

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

export default function CourseLayout() {
  const { courseId } = useParams();
  const effectiveCourseId = useMemo(() => courseId ?? "default", [courseId]);

  const [studentView, setStudentView] = useState<boolean>(() =>
    readStudentView(effectiveCourseId),
  );

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
    window.addEventListener("canvasClone:studentViewChanged", onCustom as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "canvasClone:studentViewChanged",
        onCustom as any,
      );
    };
  }, [effectiveCourseId]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas-grayLight">
      {/* Left: Course sidebar */}
      <CourseSidebar />

      {/* Right: bounded content area */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        <div
          className={[
            "relative flex-1 flex flex-col overflow-hidden rounded-xl bg-canvas-grayLight",
            studentView
              ? "ring-4 ring-canvas-blue/25 shadow-[0_0_0_1px_rgba(0,142,226,0.25)]"
              : "",
          ].join(" ")}
        >
          {/* ✅ Translucent banner inside the bordered area */}
          {studentView && (
            <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2">
              <div
                className="
                  flex items-center gap-2
                  rounded-full
                  bg-canvas-blue/25
                  backdrop-blur-md
                  px-4 py-1.5
                  text-xs font-semibold
                  text-canvas-blue
                  border border-canvas-blue/25
                  shadow-sm
                "
              >
                <Eye className="h-4 w-4 opacity-80" />
                Student View
                <span className="ml-2 text-[10px] font-medium text-canvas-blue/80">
                  gating enforced
                </span>
              </div>
            </div>
          )}

          {/* Actual course pages */}
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
