import { Link } from "react-router-dom";
import { ArrowUpRight, Calendar, Clock, Pin, PinOff } from "lucide-react";
import { getUpNextItem } from "../utils/dashboard";
import { isPinned, togglePin } from "../utils/pinnedCourses";
import { getCourseAlerts } from "../utils/courseAlerts";
import StatusAlert from "./ui/StatusAlert";
import CourseActionsMenu from "./CourseActionsMenu";
import type { Course } from "../utils/coursesStore";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function CourseCard({
  course,
  progressPercent,
  studentView = false,
  onPinChange,
  onEdit,
  onDelete,
}: {
  course: Course;
  progressPercent?: number;
  studentView?: boolean;
  onPinChange?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const showProgress = progressPercent !== undefined && progressPercent !== null;
  const upNext = studentView ? getUpNextItem(course.id) : null;
  const pinned = isPinned(course.id);
  const alerts = getCourseAlerts(course.id, studentView);

  const handlePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePin(course.id);
    onPinChange?.();
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-canvas-border/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-canvas-hover hover:ring-canvas-blue/20 dark:bg-canvas-surfaceRaised dark:ring-white/[0.06] dark:shadow-canvas-dark dark:hover:shadow-canvas-dark-hover dark:hover:ring-canvas-blue/30">
      <div
        className="absolute left-0 top-0 h-full w-1.5 transition-all duration-300 group-hover:w-2"
        style={{ backgroundColor: course.color }}
        aria-hidden="true"
      />

      <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
        {!studentView && onEdit && onDelete && (
          <CourseActionsMenu course={course} onEdit={onEdit} onDelete={onDelete} />
        )}
        <button
          type="button"
          onClick={handlePin}
          className="rounded-lg p-1.5 text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-canvas-blue dark:hover:bg-white/10 sm:opacity-0 sm:group-hover:opacity-100"
          title={pinned ? "Unpin" : "Pin"}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
      </div>

      <Link to={`/courses/${course.id}`} className="flex flex-1 flex-col p-6 pl-7">
        <div className="mb-4 flex items-start justify-between gap-3 pr-14">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: course.color }}
          >
            {course.short_name.split(" ").pop()?.slice(0, 3)}
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {alerts.map((a) => (
              <StatusAlert key={a.label} tone={a.tone} title={a.detail}>
                {a.label}
              </StatusAlert>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {course.code}
          </p>
          <h3 className="mt-1 text-lg font-semibold leading-snug text-canvas-grayDark transition-colors group-hover:text-canvas-blue dark:text-gray-100 dark:group-hover:text-canvas-blueLight">
            {course.title}
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="h-3.5 w-3.5 opacity-60" />
            {course.term}
          </p>

          {upNext && (
            <p className="mt-2 text-xs text-canvas-blue dark:text-canvas-blueLight">
              Next: {upNext.itemLabel}
            </p>
          )}

          {showProgress && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Progress</span>
                <span className="font-medium tabular-nums text-canvas-grayDark dark:text-gray-200">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: course.color,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-canvas-border/60 pt-4 dark:border-white/[0.06]">
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            Updated {formatDate(course.updated_at)}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas-grayLight text-canvas-grayDark opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:bg-canvas-blue group-hover:text-white dark:bg-white/10 dark:text-gray-300 dark:group-hover:bg-canvas-blue">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </div>
  );
}
