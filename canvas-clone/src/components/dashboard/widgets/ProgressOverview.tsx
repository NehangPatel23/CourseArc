import { loadCourses } from "../../../utils/coursesStore";
import { getCourseProgressPercent } from "../../../utils/dashboard";

export default function ProgressOverview({ studentView }: { studentView: boolean }) {
  if (!studentView) return null;

  const courses = loadCourses().filter((c) => c.published);
  const percents = courses.map((c) => getCourseProgressPercent(c.id));
  const avg = percents.length
    ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
    : 0;
  const remaining = 100 - avg;
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (avg / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 96 96" className="-rotate-90" aria-hidden>
        <circle cx="48" cy="48" r="38" fill="none" stroke="#E4D9C8" strokeWidth="3" />
        <circle
          cx="48"
          cy="48"
          r="38"
          fill="none"
          stroke="#C45D26"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="butt"
        />
      </svg>
      <div>
        <p className="font-display text-3xl font-medium tabular-nums text-arc-ink">{avg}%</p>
        <p className="kicker mt-1">Average completion</p>
        <p className="mt-1 text-xs text-arc-mute">
          {avg}% complete · {remaining}% remaining
        </p>
      </div>
    </div>
  );
}
