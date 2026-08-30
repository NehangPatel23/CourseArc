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
    <div>
      <div className="grid grid-cols-2 gap-6 border-y border-arc-ink/10 py-3">
        <div>
          <p className="font-display text-2xl font-medium tabular-nums text-arc-ink">{avg}%</p>
          <p className="kicker mt-1">Avg completion</p>
        </div>
        <div>
          <p className="font-display text-2xl font-medium tabular-nums text-arc-ink">{pending}</p>
          <p className="kicker mt-1">Pending grades</p>
        </div>
      </div>
      <Link
        to="/analytics"
        className="mt-3 inline-block text-sm text-arc-copper hover:underline"
      >
        Full analytics
      </Link>
    </div>
  );
}
