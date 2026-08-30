import { useState } from "react";
import { Link } from "react-router-dom";
import { CourseCoverImage } from "../utils/courseCover";
import { displayCourseTitle, getCourseNickname } from "../utils/courseNicknames";
import Icon from "../icons/Icon";
import { getUpNextItem } from "../utils/dashboard";
import { isPinned, togglePin } from "../utils/pinnedCourses";
import { getCourseAlerts } from "../utils/courseAlerts";
import StatusAlert from "./ui/StatusAlert";
import CourseActionsMenu from "./CourseActionsMenu";
import type { Course } from "../utils/coursesStore";
import { formatAppDate } from "../utils/settingsStore";
import { useSettings } from "../hooks/useSettings";
import CourseNicknameModal from "./CourseNicknameModal";
import { useToast } from "./ui/Toast";

function codeParts(shortName: string) {
  const bits = shortName.trim().split(/\s+/);
  if (bits.length >= 2) {
    return { prefix: bits.slice(0, -1).join(" "), number: bits[bits.length - 1] };
  }
  return { prefix: shortName, number: "" };
}

function padIndex(n: number) {
  return String(n).padStart(2, "0");
}

export default function CourseCard({
  course,
  progressPercent,
  studentView = false,
  catalogIndex,
  selected,
  onSelect,
  showCheckbox,
  onPinChange,
  onEdit,
  onDelete,
}: {
  course: Course;
  progressPercent?: number;
  studentView?: boolean;
  catalogIndex?: number;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  showCheckbox?: boolean;
  onPinChange?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const settings = useSettings();
  const { showToast } = useToast();
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const showProgress = progressPercent !== undefined && progressPercent !== null;
  const upNext = studentView ? getUpNextItem(course.id) : null;
  const pinned = isPinned(course.id);
  const nicknamed = Boolean(getCourseNickname(course.id));
  const alerts = getCourseAlerts(course.id, studentView);
  const { prefix, number } = codeParts(course.short_name);

  const handlePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePin(course.id);
    const nowPinned = !pinned;
    showToast(nowPinned ? "Pinned to catalog" : "Unpinned", "neutral");
    onPinChange?.();
  };

  return (
    <article className="group relative flex h-full flex-col overflow-hidden bg-arc-ivory ring-1 ring-arc-ink/10 transition-[box-shadow,ring-color] duration-300 hover:shadow-lift hover:ring-arc-ink/25">
      <div className="relative flex h-[176px] flex-col px-5 pt-4 pb-4" style={{ backgroundColor: course.color }}>
        <div className="absolute inset-0 overflow-hidden">
          <CourseCoverImage
            course={course}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: course.color, opacity: 0.12, mixBlendMode: "multiply" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
            aria-hidden
          />
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3">
          {showCheckbox ? (
            <label className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-black/35 ring-1 ring-white/40">
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelect?.(course.id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="h-3 w-3 cursor-pointer accent-arc-copper"
                aria-label={`Select ${course.title}`}
              />
            </label>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-0.5 text-white">
            {!studentView && onEdit && onDelete && (
              <CourseActionsMenu
                course={course}
                onEdit={onEdit}
                onDelete={onDelete}
                onChanged={onPinChange}
                onNickname={() => setNicknameOpen(true)}
              />
            )}
            <button
              type="button"
              onClick={handlePin}
              className={`rounded-md p-1.5 transition hover:bg-black/20 ${
                pinned
                  ? "text-arc-gold opacity-100"
                  : "text-white/90 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              }`}
              title={pinned ? "Unpin" : "Pin to catalog"}
            >
              <Icon name={pinned ? "unpin" : "pin"} size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setNicknameOpen(true);
              }}
              className={`rounded-md p-1.5 transition hover:bg-black/20 ${
                nicknamed
                  ? "text-arc-gold opacity-100"
                  : "text-white/90 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              }`}
              title="Set nickname"
            >
              <Icon name="tag" size={14} />
            </button>
          </div>
        </div>

        {settings.showCourseCodes !== false ? (
          <div className="relative z-10 mt-auto flex items-end justify-between gap-3">
            <p className="font-display max-w-[80%] text-[2.7rem] font-medium leading-[0.82] tracking-tight text-white drop-shadow-sm">
              {prefix}
              {number ? (
                <span className="mt-1 block text-[1.65rem] italic text-white/80">{number}</span>
              ) : null}
            </p>
            {catalogIndex != null && (
              <p className="font-display mb-0.5 shrink-0 text-[13px] tabular-nums tracking-[0.18em] text-white/75">
                {padIndex(catalogIndex)}
              </p>
            )}
          </div>
        ) : (
          catalogIndex != null && (
            <p className="font-display relative z-10 mt-auto self-end text-[13px] tabular-nums tracking-[0.18em] text-white/75">
              {padIndex(catalogIndex)}
            </p>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <div className="flex-1">
          <p className="kicker mb-1.5">{course.term}</p>
          <Link to={`/courses/${course.id}`}>
            <h3 className="font-display text-[1.4rem] font-medium leading-snug text-arc-ink transition-colors group-hover:text-arc-copper">
              {displayCourseTitle(course.id, course.title)}
            </h3>
          </Link>
          {displayCourseTitle(course.id, course.title) !== course.title && (
            <p className="mt-0.5 text-xs text-arc-mute">{course.title}</p>
          )}
          {alerts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {alerts.map((a) => (
                <StatusAlert key={a.label} tone={a.tone} title={a.detail}>
                  {a.label}
                </StatusAlert>
              ))}
            </div>
          )}

          {upNext && (
            <Link
              to={upNext.path}
              className="mt-3 block font-display text-[15px] italic text-arc-copper hover:underline"
            >
              Next — {upNext.itemLabel}
            </Link>
          )}

          {showProgress && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="kicker">Progress</span>
                <span className="font-display text-sm tabular-nums text-arc-ink">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-px overflow-hidden bg-arc-ink/10">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: course.color,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <Link
          to={`/courses/${course.id}`}
          className="mt-5 flex items-center justify-between border-t border-arc-ink/10 pt-3"
        >
          <span className="flex items-center gap-1.5 text-[11px] text-arc-mute">
            <Icon name="clock" size={12} className="opacity-70" />
            {formatAppDate(course.updated_at, settings.dateFormat)}
          </span>
          <span className="flex h-7 w-7 items-center justify-center text-arc-ink/35 transition-colors group-hover:text-arc-copper">
            <Icon name="arrowUpRight" size={14} />
          </span>
        </Link>
      </div>
      {nicknameOpen && (
        <CourseNicknameModal
          course={course}
          onClose={() => setNicknameOpen(false)}
          onSaved={onPinChange}
        />
      )}
    </article>
  );
}
