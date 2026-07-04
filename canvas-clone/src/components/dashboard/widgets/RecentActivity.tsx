import { Link } from "react-router-dom";
import { getRecentActivity } from "../../../utils/activity";
import { loadCourses } from "../../../utils/coursesStore";

export default function RecentActivity() {
  const activity = getRecentActivity(8);
  const courses = loadCourses();

  if (!activity.length) {
    return <p className="text-sm text-gray-500">No recent activity yet.</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {activity.map((entry, i) => {
        const course = courses.find((c) => c.id === entry.courseId);
        return (
          <Link
            key={`${entry.timestamp}-${i}`}
            to={entry.path}
            className="min-w-[180px] shrink-0 rounded-lg bg-canvas-grayLight px-3 py-2 text-sm hover:ring-1 hover:ring-canvas-blue/30"
          >
            <p className="truncate font-medium text-canvas-grayDark">{entry.label}</p>
            <p className="truncate text-xs text-gray-500">
              {course?.short_name ?? "Course"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
