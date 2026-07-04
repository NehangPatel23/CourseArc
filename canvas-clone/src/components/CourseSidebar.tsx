import { useEffect, useState } from "react";
import {
  Home,
  FileText,
  Layers,
  Folder,
  Megaphone,
  MessageSquare,
  ClipboardList,
  HelpCircle,
  GraduationCap,
  Settings,
  Eye,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useStudentView } from "../hooks/useStudentView";
import { useToast } from "./ui/Toast";
import { getCourseById, updateCourse, type Course } from "../utils/coursesStore";
import {
  computeStudentNavHiddenAfterToggle,
  getCourseNavPath,
  getStudentVisibleNavIds,
  isCourseNavItemVisibleToStudents,
  STUDENT_COURSE_NAV_ITEMS,
  type CourseNavItemId,
} from "../utils/courseNavigation";

type NavItem = {
  id: CourseNavItemId | "settings";
  label: string;
  icon: LucideIcon;
  path: string;
  match?: (pathname: string, base: string, path: string) => boolean;
};

const NAV_ICONS: Record<CourseNavItemId, LucideIcon> = {
  home: Home,
  announcements: Megaphone,
  discussions: MessageSquare,
  assignments: ClipboardList,
  quizzes: HelpCircle,
  modules: Layers,
  pages: FileText,
  files: Folder,
  grades: GraduationCap,
};

const NAV_LABELS: Record<CourseNavItemId, string> = {
  home: "Home",
  announcements: "Announcements",
  discussions: "Discussions",
  assignments: "Assignments",
  quizzes: "Quizzes",
  modules: "Modules",
  pages: "Pages",
  files: "Files",
  grades: "Grades",
};

function buildNavItem(courseId: string, id: CourseNavItemId): NavItem {
  const path = getCourseNavPath(courseId, id);
  return {
    id,
    label: NAV_LABELS[id],
    icon: NAV_ICONS[id],
    path,
    ...(id === "home"
      ? {
          match: (pathname: string, base: string) =>
            pathname === base || pathname === `${base}/home`,
        }
      : {}),
  };
}

export default function CourseSidebar() {
  const { courseId } = useParams();
  const location = useLocation();
  const studentView = useStudentView(courseId ?? "default");
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

  if (!courseId) return null;

  const base = `/courses/${courseId}`;
  const visibleNavIds = studentView ? getStudentVisibleNavIds(course) : null;

  const items: NavItem[] = (
    studentView ? visibleNavIds! : STUDENT_COURSE_NAV_ITEMS.map((item) => item.id)
  ).map((id) => buildNavItem(courseId, id));

  if (!studentView) {
    items.push({
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: `${base}/settings`,
    });
  }

  const toggleStudentVisibility = (id: CourseNavItemId) => {
    if (!course) return;
    const hidden = course.studentNavHidden ?? [];
    const visible = isCourseNavItemVisibleToStudents(id, course);
    const next = computeStudentNavHiddenAfterToggle(hidden, id, !visible);
    if (!next) {
      showToast("At least one navigation item must be visible to students", "negative");
      return;
    }
    updateCourse(course.id, { studentNavHidden: next });
    showToast(
      visible ? `${NAV_LABELS[id]} hidden from students` : `${NAV_LABELS[id]} visible to students`,
      "positive",
    );
  };

  return (
    <nav className="flex w-[220px] flex-col border-r border-canvas-border bg-white py-6">
      <h2 className="px-6 pb-6 text-sm font-semibold uppercase tracking-wide text-gray-600">
        Course Navigation
      </h2>

      {items.map(({ id, label, icon: Icon, path, match }) => {
        const isActive = match
          ? match(location.pathname, base, path)
          : location.pathname === path || location.pathname.startsWith(`${path}/`);

        const studentVisible =
          id === "settings" || isCourseNavItemVisibleToStudents(id as CourseNavItemId, course);
        const showVisibilityToggle = !studentView && id !== "settings";

        return (
          <div
            key={id}
            className={`group relative flex items-center ${
              isActive ? "bg-canvas-blueTint" : "hover:bg-gray-50"
            }`}
          >
            <Link
              to={path}
              className={`relative flex min-w-0 flex-1 items-center gap-3 py-3 pl-6 pr-1 text-[15px] font-medium transition-all ${
                isActive
                  ? "text-canvas-blue"
                  : studentVisible
                    ? "text-gray-600 group-hover:text-gray-800"
                    : "text-gray-400 group-hover:text-gray-600"
              }`}
            >
              <div
                className={`absolute left-0 top-0 h-full w-[3px] rounded-r-md transition-all ${
                  isActive
                    ? "bg-canvas-blue opacity-100"
                    : "opacity-0 group-hover:bg-canvas-blue group-hover:opacity-40"
                }`}
              />
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  isActive
                    ? "text-canvas-blue"
                    : studentVisible
                      ? "text-gray-400 group-hover:text-gray-600"
                      : "text-gray-300 group-hover:text-gray-500"
                }`}
              />
              <span className="truncate">{label}</span>
            </Link>
            {showVisibilityToggle && (
              <button
                type="button"
                onClick={() => toggleStudentVisibility(id as CourseNavItemId)}
                className={`mr-3 shrink-0 rounded p-1 ${
                  studentVisible
                    ? "text-emerald-600 hover:bg-emerald-50"
                    : "text-gray-400 hover:bg-white hover:text-canvas-blue"
                }`}
                title={studentVisible ? "Visible to students" : "Hidden from students"}
                aria-label={
                  studentVisible
                    ? `Hide ${label} from students`
                    : `Show ${label} to students`
                }
              >
                {studentVisible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
