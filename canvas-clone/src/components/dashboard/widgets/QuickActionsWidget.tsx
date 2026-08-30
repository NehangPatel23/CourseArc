import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon, { type IconName } from "../../../icons/Icon";
import { getMostRecentlyEditedCourse } from "../../../utils/activity";
import { getPrimaryCourseId } from "../../../utils/dashboard";
import { loadCourses } from "../../../utils/coursesStore";
import CoursePickerModal, { pickCourseOrRun } from "../../CoursePickerModal";

const actionIcons: Record<string, IconName> = {
  "View calendar": "calendar",
  "Check inbox": "inbox",
  "View grades": "trend",
  "Grade submissions": "clipboard",
  "Course analytics": "graph",
  "New announcement": "megaphone",
  "This week": "calendar",
};

type QuickAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
};

export default function QuickActionsWidget({ studentView }: { studentView: boolean }) {
  const navigate = useNavigate();
  const primaryCourseId = getPrimaryCourseId(studentView);
  const recentCourseId = getMostRecentlyEditedCourse() ?? primaryCourseId;
  const courses = loadCourses().filter((c) => !c.archived);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTitle, setPickerTitle] = useState("");
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const scrollToThisWeek = () => {
    document.getElementById("this-week")?.scrollIntoView({ behavior: "smooth" });
  };

  const navigateToCoursePath = (pathSuffix: string) => {
    pickCourseOrRun(
      courses,
      recentCourseId ?? undefined,
      (id) => navigate(`/courses/${id}${pathSuffix}`),
      () => {
        setPickerTitle("Choose a course");
        setPendingHref(pathSuffix);
        setPickerOpen(true);
      },
    );
  };

  const actions: QuickAction[] = studentView
    ? [
        { label: "View calendar", href: "/calendar" },
        { label: "Check inbox", href: "/inbox" },
        {
          label: "View grades",
          href: primaryCourseId ? `/courses/${primaryCourseId}/grades` : undefined,
          disabled: !primaryCourseId,
        },
      ]
    : [
        { label: "Grade submissions", onClick: () => navigateToCoursePath("/assignments") },
        { label: "Course analytics", href: "/analytics" },
        { label: "New announcement", onClick: () => navigateToCoursePath("/announcements/new") },
        { label: "This week", onClick: scrollToThisWeek },
      ];

  return (
    <div>
      <ul>
        {actions.map((action, i) => {
          const icon = actionIcons[action.label] ?? "chevronRight";
          const rowClass =
            "group flex w-full items-center gap-3 py-2 text-sm transition-colors";

          const inner = (
            <>
              <span className="font-display w-5 text-[11px] tabular-nums text-arc-mute">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Icon name={icon} size={13} className="text-arc-mute group-hover:text-arc-copper" />
              <span className="flex-1 text-left">{action.label}</span>
              {!action.disabled && (
                <Icon
                  name="chevronRight"
                  size={11}
                  className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              )}
            </>
          );

          if (action.href && !action.disabled) {
            return (
              <li key={action.label}>
                <Link
                  to={action.href}
                  className={`${rowClass} text-arc-ink/75 hover:text-arc-copper`}
                >
                  {inner}
                </Link>
              </li>
            );
          }

          return (
            <li key={action.label}>
              <button
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.title}
                className={`${rowClass} ${
                  action.disabled
                    ? "cursor-not-allowed text-arc-mute/50"
                    : "text-arc-ink/75 hover:text-arc-copper"
                }`}
              >
                {inner}
              </button>
            </li>
          );
        })}
      </ul>

      <CoursePickerModal
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPendingHref(null);
        }}
        title={pickerTitle}
        courses={courses}
        defaultCourseId={recentCourseId ?? undefined}
        onSelect={(id) => {
          if (pendingHref) navigate(`/courses/${id}${pendingHref}`);
        }}
      />
    </div>
  );
}
