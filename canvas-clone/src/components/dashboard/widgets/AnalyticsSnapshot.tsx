import { Link } from "react-router-dom";
import { loadCourses } from "../../../utils/coursesStore";
import { getCourseProgressPercent } from "../../../utils/dashboard";
import { getPendingSubmissions } from "../../../utils/submissions";

export default function AnalyticsSnapshot({ studentView }: { studentView: boolean }) {
  if (studentView) return null;

  const courses = loadCourses().filter((c) => c.published && !c.archived);
  const pending = getPendingSubmissions().length;
  const avg =
    courses.length > 0
      ? Math.round(
          courses.reduce((s, c) => s + getCourseProgressPercent(c.id), 0) / courses.length,
        )
      : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-canvas-grayLight px-2 py-3 dark:bg-gray-800">
          <p className="text-lg font-semibold tabular-nums text-canvas-grayDark dark:text-white">{avg}%</p>
          <p className="text-[10px] text-gray-500">Avg completion</p>
        </div>
        <div className="rounded-lg bg-canvas-grayLight px-2 py-3 dark:bg-gray-800">
          <p className="text-lg font-semibold tabular-nums text-canvas-grayDark dark:text-white">{pending}</p>
          <p className="text-[10px] text-gray-500">Pending grades</p>
        </div>
      </div>
      <Link
        to="/analytics"
        className="block text-center text-xs font-medium text-canvas-blue hover:underline"
      >
        View full analytics →
      </Link>
    </div>
  );
}
