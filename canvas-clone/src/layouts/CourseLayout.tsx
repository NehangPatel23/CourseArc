import { useEffect } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import CourseSidebar from "../components/CourseSidebar";
import { Eye } from "lucide-react";
import { useStudentView } from "../utils/studentView";
import { recordLastVisit } from "../utils/dashboard";
import { recordActivity } from "../utils/activity";
import { getCourseById, loadCourses } from "../utils/coursesStore";
import {
  getCourseNavIdFromListPath,
  getStudentNavFallbackPath,
  isCourseNavItemVisibleToStudents,
} from "../utils/courseNavigation";

function activityLabel(pathname: string): string {
  if (pathname.includes("/modules")) return "Viewed Modules";
  if (pathname.includes("/pages")) return "Viewed Page";
  if (pathname.includes("/files")) return "Viewed Files";
  if (pathname.includes("/announcements")) return "Viewed Announcements";
  if (pathname.includes("/assignments")) return "Viewed Assignments";
  if (pathname.includes("/quizzes")) return "Viewed Quizzes";
  if (pathname.includes("/discussions")) return "Viewed Discussions";
  if (pathname.includes("/grades")) return "Viewed Grades";
  if (pathname.includes("/settings")) return "Viewed Course Settings";
  return "Visited course";
}

export default function CourseLayout() {
  const { studentView } = useStudentView();
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Students must not land on the page editor route.
  useEffect(() => {
    if (!courseId) return;
    const path = location.pathname;
    const pageEditorRe = new RegExp(`^/courses/${courseId}/pages/([^/]+)$`);
    const editorMatch = path.match(pageEditorRe);

    if (studentView && editorMatch) {
      navigate(`/courses/${courseId}/pages/${editorMatch[1]}/view`, {
        replace: true,
        state: location.state,
      });
    }
  }, [studentView, courseId, location.pathname, location.state, navigate]);

  // Students must not access hidden nav list pages (individual items remain reachable).
  useEffect(() => {
    if (!courseId || !studentView) return;
    const course = getCourseById(courseId);
    const navId = getCourseNavIdFromListPath(location.pathname, courseId);
    if (!navId || isCourseNavItemVisibleToStudents(navId, course)) return;
    navigate(getStudentNavFallbackPath(courseId, course), { replace: true });
  }, [studentView, courseId, location.pathname, navigate]);

  useEffect(() => {
    if (courseId) {
      recordLastVisit(courseId, location.pathname);
      const course = loadCourses().find((c) => c.id === courseId);
      recordActivity({
        courseId,
        path: location.pathname,
        label: course ? `${activityLabel(location.pathname)} — ${course.short_name}` : activityLabel(location.pathname),
        type: "visit",
      });
    }
  }, [courseId, location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas-grayLight">
      {/* Left: Course sidebar */}
      <CourseSidebar />

      {/* Right: bounded content area */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        <div
          className={[
            "relative flex-1 flex flex-col overflow-hidden rounded-xl bg-canvas-grayLight",
            studentView ? "ring-4 ring-canvas-blue/25" : "",
          ].join(" ")}
        >
          {/* ✅ Translucent banner inside the bordered area */}
          {studentView && (
            <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2">
              <div
                className="
                  flex items-center gap-2
                  rounded-full
                  bg-canvas-blue/25
                  backdrop-blur-md
                  px-4 py-1.5
                  text-xs font-semibold
                  text-canvas-blue
                  border border-canvas-blue/25
                  shadow-sm
                "
              >
                <Eye className="h-4 w-4 opacity-80" />
                Student View
              </div>
            </div>
          )}

          {/* Actual course pages */}
          <div className="course-surface flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
