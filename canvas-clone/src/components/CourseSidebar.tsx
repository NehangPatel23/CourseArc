import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Icon, { type IconName } from "../icons/Icon";
import { useStudentView } from "../hooks/useStudentView";
import { usePermissions } from "../utils/permissions";
import { useToast } from "./ui/Toast";
import { getCourseById, updateCourse, type Course } from "../utils/coursesStore";
import {
  computeStudentNavHiddenAfterToggle,
  getCourseNavPath,
  getStudentHiddenNavItems,
  getStudentVisibleNavIds,
  isCourseNavItemVisibleToStudents,
  STUDENT_COURSE_NAV_ITEMS,
  type CourseNavItemId,
} from "../utils/courseNavigation";

type NavItem = {
  id: CourseNavItemId | "settings" | "rubrics" | "audit";
  label: string;
  icon: IconName;
  path: string;
  match?: (pathname: string, base: string, path: string) => boolean;
};

const NAV_ICONS: Record<CourseNavItemId, IconName> = {
  home: "home",
  announcements: "megaphone",
  syllabus: "file",
  discussions: "chat",
  assignments: "clipboard",
  quizzes: "help",
  modules: "courses",
  pages: "file",
  files: "folder",
  grades: "cap",
  people: "users",
  attendance: "calendarCheck",
  collaborations: "video",
};

const NAV_LABELS: Record<CourseNavItemId, string> = {
  home: "Home",
  announcements: "Announcements",
  syllabus: "Syllabus",
  discussions: "Discussions",
  assignments: "Assignments",
  quizzes: "Quizzes",
  modules: "Modules",
  pages: "Pages",
  files: "Files",
  grades: "Grades",
  people: "People",
  attendance: "Attendance",
  collaborations: "Collaborations",
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
  const { canManageCourse } = usePermissions();
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
      id: "rubrics",
      label: "Rubrics",
      icon: "table",
      path: `${base}/rubrics`,
    });
    items.push({
      id: "audit",
      label: "Audit log",
      icon: "list",
      path: `${base}/audit`,
    });
    if (canManageCourse) {
      items.push({
        id: "settings",
        label: "Settings",
        icon: "settings",
        path: `${base}/settings`,
      });
    }
  }

  const toggleStudentVisibility = (id: CourseNavItemId) => {
    if (!course) return;
    const hidden = getStudentHiddenNavItems(course);
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
      "layout",
    );
  };

  return (
    <nav className="flex h-full w-[220px] flex-col border-r border-arc-line bg-arc-ivory py-6">
      <p className="kicker px-6 pb-5">Course index</p>

      {items.map(({ id, label, icon, path, match }) => {
        const isActive = match
          ? match(location.pathname, base, path)
          : location.pathname === path || location.pathname.startsWith(`${path}/`);

        const studentVisible =
          id === "settings" ||
          id === "rubrics" ||
          id === "audit" ||
          isCourseNavItemVisibleToStudents(id as CourseNavItemId, course);
        const showVisibilityToggle =
          canManageCourse && id !== "settings" && id !== "rubrics" && id !== "audit";

        return (
          <div
            key={id}
            className={`group relative flex items-center ${
              isActive ? "bg-arc-copper/10" : "hover:bg-arc-paper"
            }`}
          >
            <Link
              to={path}
              className={`relative flex min-w-0 flex-1 items-center gap-3 py-3 pl-6 pr-1 text-[14px] font-medium transition-all ${
                isActive
                  ? "text-arc-copper"
                  : studentVisible
                    ? "text-arc-ink/70 group-hover:text-arc-ink"
                    : "text-arc-mute group-hover:text-arc-ink/70"
              }`}
            >
              <div
                className={`absolute left-0 top-0 h-full w-[3px] transition-all ${
                  isActive
                    ? "bg-arc-copper opacity-100"
                    : "opacity-0 group-hover:bg-arc-copper group-hover:opacity-40"
                }`}
              />
              <Icon
                name={icon}
                size={16}
                className={
                  isActive
                    ? "text-arc-copper"
                    : studentVisible
                      ? "text-arc-mute group-hover:text-arc-ink/70"
                      : "text-arc-line group-hover:text-arc-mute"
                }
              />
              <span className="truncate">{label}</span>
            </Link>
            {showVisibilityToggle && (
              <button
                type="button"
                onClick={() => toggleStudentVisibility(id as CourseNavItemId)}
                className={`mr-3 shrink-0 rounded p-1 ${
                  studentVisible
                    ? "text-arc-sage hover:bg-arc-sage/10"
                    : "text-arc-mute hover:bg-arc-paper hover:text-arc-copper"
                }`}
                title={studentVisible ? "Visible to students" : "Hidden from students"}
                aria-label={
                  studentVisible
                    ? `Hide ${label} from students`
                    : `Show ${label} to students`
                }
              >
                <Icon name={studentVisible ? "eye" : "eyeOff"} size={14} />
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
