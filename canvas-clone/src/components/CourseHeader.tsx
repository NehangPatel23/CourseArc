import { Link, useLocation, useParams } from "react-router-dom";
import Icon from "../icons/Icon";
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
    <div className="flex items-center justify-between border-b border-arc-ink/15 px-10 py-6">
      <div className="flex min-w-0 items-start gap-3.5">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center text-white ring-1 ring-arc-ink/10"
          style={{ backgroundColor: course.color }}
          aria-hidden
        >
          <Icon name="book" size={20} />
        </div>
        <div className="min-w-0">
          <p className="kicker text-arc-copper">{course.short_name || "Course"}</p>
          <h1 className="mt-1 truncate font-display text-2xl font-medium text-arc-ink">
            {course.title}
          </h1>
          <p className="mt-1 text-sm text-arc-mute">
            {course.term} • {course.code}
          </p>
          <div className="mt-2">
            <StudentSectionBadge courseId={courseId} studentView={studentView} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canPublishCourse && <CoursePublishControl courseId={courseId} variant="icon" />}
        {canManageCourse && !onSettingsPage && (
          <>
            {canPublishCourse && <div className="mx-1 h-5 w-px bg-arc-line" />}
            <Tooltip label="Course settings">
              <Link
                to={`/courses/${courseId}/settings`}
                aria-label="Course settings"
                className="inline-flex h-9 w-9 items-center justify-center border border-arc-line bg-arc-ivory text-arc-ink transition hover:bg-arc-paper"
              >
                <Icon name="settings" size={16} />
              </Link>
            </Tooltip>
          </>
        )}
        {canEditPages && (
          <Tooltip label="Edit home page">
            <Link
              to={`/courses/${courseId}/pages/course-home`}
              aria-label="Edit home page"
              className="inline-flex h-9 w-9 items-center justify-center border border-arc-line bg-arc-ivory text-arc-ink transition hover:bg-arc-paper"
            >
              <Icon name="pencil" size={16} />
            </Link>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
