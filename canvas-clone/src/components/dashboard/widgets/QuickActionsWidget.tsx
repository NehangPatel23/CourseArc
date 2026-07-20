import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  ChevronRight,
  ClipboardList,
  Inbox,
  Megaphone,
  TrendingUp,
} from "lucide-react";
import { getMostRecentlyEditedCourse } from "../../../utils/activity";
import { getPrimaryCourseId } from "../../../utils/dashboard";
import { loadCourses } from "../../../utils/coursesStore";
import CoursePickerModal, { pickCourseOrRun } from "../../CoursePickerModal";

const actionIcons: Record<string, typeof Calendar> = {
  "View calendar": Calendar,
  "Check inbox": Inbox,
  "View grades": TrendingUp,
  "Grade submissions": ClipboardList,
  "Course analytics": BarChart3,
  "New announcement": Megaphone,
  "This week": Calendar,
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
      <ul className="space-y-0.5">
        {actions.map((action) => {
          const Icon = actionIcons[action.label] ?? ChevronRight;
          const rowClass =
            "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors";

          if (action.href && !action.disabled) {
            return (
              <li key={action.label}>
                <Link
                  to={action.href}
                  className={`${rowClass} text-gray-600 hover:bg-canvas-grayLight hover:text-canvas-blue `}
                >
                  <Icon className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-canvas-blue" />
                  <span className="flex-1 text-left">{action.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
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
                    ? "cursor-not-allowed text-gray-400 opacity-60"
                    : "text-gray-600 hover:bg-canvas-grayLight hover:text-canvas-blue   "
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="flex-1 text-left">{action.label}</span>
                {!action.disabled && (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                )}
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
