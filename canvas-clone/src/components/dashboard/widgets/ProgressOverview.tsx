import { loadCourses } from "../../../utils/coursesStore";
import { getCourseProgressPercent } from "../../../utils/dashboard";

export default function ProgressOverview({ studentView }: { studentView: boolean }) {
  if (!studentView) return null;

  const courses = loadCourses().filter((c) => c.published);
  let totalComplete = 0;

  const percents = courses.map((c) => getCourseProgressPercent(c.id));
  const avg = percents.length
    ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
    : 0;
  totalComplete = avg;

  const remaining = 100 - totalComplete;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (totalComplete / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r="40" fill="none" stroke="#E5E7EB" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r="40"
          fill="none"
          stroke="canvas-blue"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="text-2xl font-semibold tabular-nums text-canvas-grayDark">{avg}%</p>
        <p className="text-sm text-gray-500">Average completion</p>
        <p className="mt-1 text-xs text-gray-400">
          {totalComplete}% complete · {remaining}% remaining
        </p>
      </div>
    </div>
  );
}
