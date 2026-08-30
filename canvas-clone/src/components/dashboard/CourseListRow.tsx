import { Link } from "react-router-dom";
import Icon from "../../icons/Icon";
import { getNextDueForCourse } from "../../utils/deadlines";
import { getUpNextItem } from "../../utils/dashboard";
import { isPinned, togglePin } from "../../utils/pinnedCourses";
import { getCourseAlerts } from "../../utils/courseAlerts";
import StatusAlert from "../ui/StatusAlert";
import CourseActionsMenu from "../CourseActionsMenu";
import { displayCourseTitle } from "../../utils/courseNicknames";
import { CourseCoverImage } from "../../utils/courseCover";
import type { Course } from "../../utils/coursesStore";
import { useSettings } from "../../hooks/useSettings";
import { formatAppDate } from "../../utils/settingsStore";

type Props = {
  course: Course;
  studentView: boolean;
  progressPercent?: number;
  catalogIndex?: number;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  showCheckbox?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

function padIndex(n: number) {
  return String(n).padStart(2, "0");
}

export default function CourseListRow({
  course,
  studentView,
  progressPercent,
  catalogIndex,
  selected,
  onSelect,
  showCheckbox,
  onEdit,
  onDelete,
}: Props) {
  const settings = useSettings();
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
    <div className="group relative flex items-center gap-4 border-b border-arc-ink/10 py-4 transition-colors hover:bg-arc-ivory/70">
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect?.(course.id, e.target.checked)}
          className="h-4 w-4 rounded-sm border-arc-line text-arc-copper focus:ring-arc-copper/30"
          aria-label={`Select ${course.title}`}
        />
      )}

      <span
        className="font-display w-8 shrink-0 text-sm tabular-nums text-arc-mute"
        aria-hidden
      >
        {catalogIndex != null ? padIndex(catalogIndex) : "—"}
      </span>

      <span
        className="relative h-12 w-10 shrink-0 overflow-hidden bg-arc-cream ring-1 ring-arc-ink/10"
        aria-hidden="true"
      >
        <CourseCoverImage
          course={course}
          className="h-full w-full object-cover opacity-40"
        />
        <span
          className="absolute inset-0"
          style={{ backgroundColor: course.color, opacity: 0.35, mixBlendMode: "multiply" }}
        />
      </span>

      <Link to={`/courses/${course.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {settings.showCourseCodes !== false && (
              <span className="font-display text-sm italic text-arc-copper">{course.short_name}</span>
            )}
            <h3 className="truncate font-display text-lg font-medium text-arc-ink group-hover:text-arc-copper">
              {displayCourseTitle(course.id, course.title)}
            </h3>
            <span className="kicker">{course.term}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-arc-mute">
            <span className="flex items-center gap-1">
              <Icon name="clock" size={11} />
              {formatAppDate(course.updated_at, settings.dateFormat)}
            </span>
            {alerts.map((a) => (
              <StatusAlert key={a.label} tone={a.tone} title={a.detail}>
                {a.label}
              </StatusAlert>
            ))}
            {nextDue && (
              <StatusAlert tone={nextDue.overdue ? "negative" : "neutral"}>
                Due {formatAppDate(nextDue.date.toISOString(), settings.dateFormat)}
              </StatusAlert>
            )}
            {upNext && (
              <span className="font-display italic text-arc-copper">Next — {upNext.itemLabel}</span>
            )}
          </div>

          {studentView && progressPercent !== undefined && (
            <div className="mt-2 flex max-w-xs items-center gap-3">
              <div className="h-px flex-1 overflow-hidden bg-arc-ink/10">
                <div
                  className="h-full"
                  style={{ width: `${progressPercent}%`, backgroundColor: course.color }}
                />
              </div>
              <span className="font-display text-xs tabular-nums text-arc-ink">{progressPercent}%</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1 text-arc-mute">
        {!studentView && onEdit && onDelete && (
          <CourseActionsMenu
            course={course}
            onEdit={onEdit}
            onDelete={onDelete}
            onChanged={() => window.dispatchEvent(new Event("canvasClone:coursesChanged"))}
          />
        )}
        <button
          type="button"
          onClick={handlePin}
          className={`rounded-md p-2 hover:bg-arc-cream ${
            pinned ? "text-arc-copper" : "hover:text-arc-copper"
          }`}
          title={pinned ? "Unpin course" : "Pin course"}
        >
          <Icon name={pinned ? "unpin" : "pin"} size={14} />
        </button>
      </div>
    </div>
  );
}
