import { Link } from "react-router-dom";
import { getRecentActivity } from "../../../utils/activity";
import { loadCourses } from "../../../utils/coursesStore";

export default function RecentActivity() {
  const activity = getRecentActivity(8);
  const courses = loadCourses();

  if (!activity.length) {
    return <p className="text-sm text-arc-mute">No recent activity yet.</p>;
  }

  return (
    <ul>
      {activity.map((entry, i) => {
        const course = courses.find((c) => c.id === entry.courseId);
        return (
          <li key={`${entry.timestamp}-${i}`}>
            <Link to={entry.path} className="desk-link">
              <span className="block truncate text-arc-ink">{entry.label}</span>
              <span className="mt-0.5 block text-[11px] text-arc-mute">
                {course?.short_name ?? "Course"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
