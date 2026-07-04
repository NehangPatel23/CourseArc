import { Link } from "react-router-dom";
import { Clock, Pin, PinOff } from "lucide-react";
import { getNextDueForCourse } from "../../utils/deadlines";
import { getUpNextItem } from "../../utils/dashboard";
import { isPinned, togglePin } from "../../utils/pinnedCourses";
import { getCourseAlerts } from "../../utils/courseAlerts";
import StatusAlert from "../ui/StatusAlert";
import CourseActionsMenu from "../CourseActionsMenu";
import type { Course } from "../../utils/coursesStore";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  course: Course;
  studentView: boolean;
  progressPercent?: number;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  showCheckbox?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function CourseListRow({
  course,
  studentView,
  progressPercent,
  selected,
  onSelect,
  showCheckbox,
  onEdit,
  onDelete,
}: Props) {
  const nextDue = getNextDueForCourse(course.id);
  const upNext = studentView ? getUpNextItem(course.id) : null;
  const pinned = isPinned(course.id);
  const alerts = getCourseAlerts(course.id, studentView);

  const handlePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePin(course.id);
    window.dispatchEvent(new Event("canvasClone:coursesChanged"));
  };

  return (
    <div className="group relative flex items-center gap-4 rounded-xl bg-white p-4 ring-1 ring-canvas-border/80 transition-all hover:shadow-canvas-hover hover:ring-canvas-blue/20 dark:bg-canvas-surfaceRaised dark:ring-white/[0.06] dark:shadow-canvas-dark dark:hover:shadow-canvas-dark-hover">
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect?.(course.id, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-canvas-blue focus:ring-canvas-blue"
          aria-label={`Select ${course.title}`}
        />
      )}

      <div
        className="h-10 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: course.color }}
        aria-hidden="true"
      />

      <Link to={`/courses/${course.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-canvas-grayDark group-hover:text-canvas-blue dark:text-gray-100 dark:group-hover:text-canvas-blueLight">
              {course.title}
            </h3>
            <span className="text-xs text-gray-400">{course.code}</span>
            <span className="text-xs text-gray-400">· {course.term}</span>
            {alerts.map((a) => (
              <StatusAlert key={a.label} tone={a.tone} title={a.detail}>
                {a.label}
              </StatusAlert>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Updated {formatDate(course.updated_at)}
            </span>
            {nextDue && (
              <StatusAlert tone={nextDue.overdue ? "negative" : "neutral"}>
                Due {formatDate(nextDue.date.toISOString())}
              </StatusAlert>
            )}
            {upNext && (
              <span className="text-canvas-blue">Up next: {upNext.itemLabel}</span>
            )}
          </div>

          {studentView && progressPercent !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 max-w-[200px] flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progressPercent}%`, backgroundColor: course.color }}
                />
              </div>
              <span className="text-xs tabular-nums text-gray-500">{progressPercent}%</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        {!studentView && onEdit && onDelete && (
          <CourseActionsMenu course={course} onEdit={onEdit} onDelete={onDelete} />
        )}
        <button
          type="button"
          onClick={handlePin}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-canvas-blue dark:hover:bg-white/10"
          title={pinned ? "Unpin course" : "Pin course"}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
