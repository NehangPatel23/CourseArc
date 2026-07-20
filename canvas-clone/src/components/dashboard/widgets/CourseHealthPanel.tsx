import { Link } from "react-router-dom";
import { publishAllDraftAnnouncements, publishAllDraftCourses, getAllCourseHealthIssues } from "../../../utils/courseHealth";
import { StatusAlertBanner } from "../../ui/StatusAlert";
import { useToast } from "../../ui/Toast";

export default function CourseHealthPanel({ studentView }: { studentView: boolean }) {
  const { showToast } = useToast();
  if (studentView) return null;

  const issues = getAllCourseHealthIssues();

  const handlePublishCourses = () => {
    const n = publishAllDraftCourses();
    showToast(n ? `Published ${n} course(s)` : "No drafts to publish", n ? "positive" : "neutral");
  };

  const handlePublishAnnouncements = () => {
    const n = publishAllDraftAnnouncements();
    showToast(n ? `Published ${n} announcement(s)` : "No draft announcements", n ? "positive" : "neutral");
  };

  if (!issues.length) {
    return (
      <StatusAlertBanner tone="positive">
        <p className="text-sm font-medium">All courses healthy</p>
      </StatusAlertBanner>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePublishCourses}
          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
        >
          Publish all drafts
        </button>
        <button
          type="button"
          onClick={handlePublishAnnouncements}
          className="rounded-lg border border-canvas-border px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-canvas-grayLight"
        >
          Publish announcements
        </button>
      </div>
      <ul className="space-y-3">
        {issues.map(({ course, issues: courseIssues }) => (
          <li key={course.id}>
            <StatusAlertBanner tone="negative">
              <p className="text-sm font-medium">{course.title}</p>
              <ul className="mt-1 space-y-1">
                {courseIssues.map((issue) => (
                  <li key={issue.id}>
                    <Link to={issue.href} className="text-xs underline opacity-90">
                      {issue.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </StatusAlertBanner>
          </li>
        ))}
      </ul>
    </div>
  );
}
