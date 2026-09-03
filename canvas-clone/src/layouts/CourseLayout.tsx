import { useEffect } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import AppErrorBoundary from "../components/AppErrorBoundary";
import PageHelpLink from "../components/PageHelpLink";
import CourseSidebar from "../components/CourseSidebar";
import StudentViewBanner from "../components/StudentViewBanner";
import { useStudentView } from "../utils/studentView";
import { canEditPages } from "../utils/permissions";
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
  if (pathname.includes("/syllabus")) return "Viewed Syllabus";
  if (pathname.includes("/rubrics")) return "Viewed Rubrics";
  if (pathname.includes("/audit")) return "Viewed Audit log";
  if (pathname.includes("/settings")) return "Viewed Course Settings";
  return "Visited course";
}

export default function CourseLayout() {
  const { studentView, viewAs } = useStudentView();
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const canEditPage = canEditPages(viewAs);

  // Students must not land on the page editor route. TAs may edit pages.
  useEffect(() => {
    if (!courseId) return;
    const path = location.pathname;
    const pageEditorRe = new RegExp(`^/courses/${courseId}/pages/([^/]+)$`);
    const editorMatch = path.match(pageEditorRe);

    if (!canEditPage && editorMatch) {
      navigate(`/courses/${courseId}/pages/${editorMatch[1]}/view`, {
        replace: true,
        state: location.state,
      });
    }
  }, [canEditPage, courseId, location.pathname, location.state, navigate]);

  // Students must not access hidden nav list pages (individual items remain reachable).
  useEffect(() => {
    if (!courseId || !studentView) return;
    const course = getCourseById(courseId);
    const navId = getCourseNavIdFromListPath(location.pathname, courseId);
    if (!navId || isCourseNavItemVisibleToStudents(navId, course)) return;
    navigate(getStudentNavFallbackPath(courseId, course), {
      replace: true,
      state: location.state,
    });
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
    <div className="course-layout-shell flex h-screen overflow-hidden bg-arc-paper">
      <div className="print-hide flex h-full shrink-0">
        <CourseSidebar />
      </div>

      <div className="course-layout-main relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {studentView && <StudentViewBanner className="print-hide" />}
        {viewAs === "ta" && <StudentViewBanner tone="ta" className="print-hide" />}

        <div className="course-layout-scroll course-surface flex min-h-0 flex-1 flex-col overflow-hidden bg-arc-paper">
          <AppErrorBoundary fallbackTitle="This course page hit an error">
            {!location.pathname.includes("/grade") && (
              <div className="flex justify-end px-4 pt-2 print-hide">
                <PageHelpLink />
              </div>
            )}
            <Outlet />
          </AppErrorBoundary>
        </div>
      </div>
    </div>
  );
}
