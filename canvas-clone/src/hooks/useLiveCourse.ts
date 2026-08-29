import { useEffect, useState } from "react";
import { getCourseById, type Course } from "../utils/coursesStore";

export function useLiveCourse(courseId: string | undefined): Course | undefined {
  const [course, setCourse] = useState<Course | undefined>(() =>
    courseId ? getCourseById(courseId) : undefined,
  );

  useEffect(() => {
    if (!courseId) {
      setCourse(undefined);
      return;
    }
    const refresh = () => setCourse(getCourseById(courseId));
    refresh();
    window.addEventListener("canvasClone:coursesChanged", refresh);
    return () => window.removeEventListener("canvasClone:coursesChanged", refresh);
  }, [courseId]);

  return course;
}
