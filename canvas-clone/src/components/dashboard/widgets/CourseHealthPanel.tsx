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
    showToast(n ? `Published ${n} course(s)` : "No drafts to publish", n ? "positive" : "neutral", "published");
  };

  const handlePublishAnnouncements = () => {
    const n = publishAllDraftAnnouncements();
    showToast(n ? `Published ${n} announcement(s)` : "No draft announcements", n ? "positive" : "neutral", "published");
  };

  if (!issues.length) {
    return (
      <StatusAlertBanner tone="positive">
        <p className="text-sm">All courses healthy</p>
      </StatusAlertBanner>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={handlePublishCourses}
          className="text-sm text-arc-sage hover:underline"
        >
          Publish all drafts
        </button>
        <button
          type="button"
          onClick={handlePublishAnnouncements}
          className="text-sm text-arc-mute hover:text-arc-ink hover:underline"
        >
          Publish announcements
        </button>
      </div>
      <ul className="space-y-3">
        {issues.map(({ course, issues: courseIssues }) => (
          <li key={course.id}>
            <StatusAlertBanner tone="negative">
              <p className="text-sm font-medium text-arc-ink">{course.title}</p>
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
