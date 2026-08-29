import { Link, useLocation, useParams } from "react-router-dom";
import { BookOpen, Pencil, Settings } from "lucide-react";
import CoursePublishControl from "./CoursePublishControl";
import { useLiveCourse } from "../hooks/useLiveCourse";
import { useStudentView } from "../utils/studentView";
import { usePermissions } from "../utils/permissions";
import StudentSectionBadge from "./StudentSectionBadge";
import Tooltip from "./ui/Tooltip";

export default function CourseHeader() {
  const { courseId } = useParams();
  const location = useLocation();
  const { studentView } = useStudentView(courseId);
  const { canManageCourse, canPublishCourse, canEditPages } = usePermissions();
  const course = useLiveCourse(courseId);

  if (!courseId || !course) return null;

  const onSettingsPage = location.pathname.endsWith("/settings");

  return (
    <div className="flex items-center justify-between border-b border-canvas-border bg-white px-10 py-6 shadow-sm">
      <div className="flex min-w-0 items-start gap-3.5">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-white"
          style={{ backgroundColor: course.color }}
          aria-hidden
        >
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-canvas-blue">
            <span className="text-xs font-semibold uppercase tracking-wide">
              {course.short_name || "Course"}
            </span>
          </div>
          <h1 className="truncate text-2xl font-semibold text-canvas-grayDark">
            {course.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {course.term} • {course.code}
          </p>
          <div className="mt-2">
            <StudentSectionBadge courseId={courseId} studentView={studentView} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canPublishCourse && (
          <CoursePublishControl courseId={courseId} variant="icon" />
        )}
        {canManageCourse && !onSettingsPage && (
          <>
            {canPublishCourse && <div className="mx-1 h-5 w-px bg-gray-300" />}
            <Tooltip label="Course settings">
              <Link
                to={`/courses/${courseId}/settings`}
                aria-label="Course settings"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-all hover:bg-gray-100"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </Tooltip>
          </>
        )}
        {canEditPages && (
          <Tooltip label="Edit home page">
            <Link
              to={`/courses/${courseId}/pages/course-home`}
              aria-label="Edit home page"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-all hover:bg-gray-100"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
