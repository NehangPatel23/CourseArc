import { loadCourses } from "../utils/coursesStore";
import { getCourseProgressPercent } from "../utils/dashboard";
import { getPendingSubmissions } from "../utils/submissions";

export default function AnalyticsPage() {
  const courses = loadCourses().filter((c) => c.published);
  const pending = getPendingSubmissions().length;
  const avgProgress =
    courses.length > 0
      ? Math.round(
          courses.reduce((s, c) => s + getCourseProgressPercent(c.id), 0) /
            courses.length,
        )
      : 0;

  const barData = courses.map((c) => ({
    name: c.short_name,
    value: getCourseProgressPercent(c.id),
    color: c.color,
  }));

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="mb-8 text-3xl font-semibold text-canvas-grayDark dark:text-white">Analytics</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active courses" value={courses.length} />
        <StatCard label="Avg completion" value={`${avgProgress}%`} />
        <StatCard label="Pending submissions" value={pending} />
      </div>

      <div className="rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80 dark:bg-gray-800 dark:ring-gray-700">
        <h2 className="mb-6 text-lg font-semibold text-canvas-grayDark dark:text-white">
          Completion by course
        </h2>
        <div className="space-y-4">
          {barData.map((bar) => (
            <div key={bar.name}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{bar.name}</span>
                <span className="tabular-nums text-gray-500">{bar.value}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${bar.value}%`, backgroundColor: bar.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-canvas-border/80 dark:bg-gray-800 dark:ring-gray-700">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-canvas-grayDark dark:text-white">{value}</p>
    </div>
  );
}
