import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Settings } from "lucide-react";
import { getCourseById, updateCourse, type Course } from "../utils/coursesStore";
import { useStudentView } from "../utils/studentView";
import { useToast } from "./ui/Toast";
import Tooltip from "./ui/Tooltip";

export default function CourseHeader() {
  const { courseId } = useParams();
  const location = useLocation();
  const { studentView } = useStudentView(courseId);
  const { showToast } = useToast();
  const [course, setCourse] = useState<Course | null>(() =>
    courseId ? getCourseById(courseId) ?? null : null,
  );

  useEffect(() => {
    if (!courseId) return;
    const refresh = () => setCourse(getCourseById(courseId) ?? null);
    refresh();
    window.addEventListener("canvasClone:coursesChanged", refresh);
    return () => window.removeEventListener("canvasClone:coursesChanged", refresh);
  }, [courseId]);

  if (!courseId || !course) return null;

  const onSettingsPage = location.pathname.endsWith("/settings");

  const togglePublished = () => {
    const next = !course.published;
    updateCourse(course.id, { published: next });
    showToast(next ? "Course published" : "Course unpublished", "positive");
  };

  return (
    <div className="flex items-center justify-between border-b border-canvas-border bg-white px-10 py-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-canvas-grayDark">{course.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {course.term} • {course.code}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {!studentView && (
          <>
            <Tooltip
              label={
                course.published
                  ? "Published — click to unpublish"
                  : "Unpublished — click to publish"
              }
            >
              <button
                type="button"
                onClick={togglePublished}
                aria-label={course.published ? "Unpublish course" : "Publish course"}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-all ${
                  course.published
                    ? "border-canvas-green bg-white text-canvas-green hover:bg-canvas-green hover:text-white"
                    : "border-gray-300 bg-white text-gray-500 hover:bg-gray-100"
                }`}
              >
                {course.published ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </Tooltip>

            <div className="mx-1 h-5 w-px bg-gray-300" />

            {!onSettingsPage && (
              <Tooltip label="Course settings">
                <Link
                  to={`/courses/${courseId}/settings`}
                  aria-label="Course settings"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-all hover:bg-gray-100"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </Tooltip>
            )}

            <Tooltip label="Edit home page">
              <Link
                to={`/courses/${courseId}/pages/course-home`}
                aria-label="Edit home page"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-all hover:bg-gray-100"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
