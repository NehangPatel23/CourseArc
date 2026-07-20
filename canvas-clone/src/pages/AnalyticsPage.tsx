import { Link } from "react-router-dom";
import { loadCourses } from "../utils/coursesStore";
import { getCourseProgressPercent } from "../utils/dashboard";
import { getPendingSubmissions } from "../utils/submissions";
import { useStudentView } from "../utils/studentView";
import {
  getAssignmentAverages,
  getCourseAveragePercent,
  getCourseGradeDistribution,
  getCourseSubmissionStats,
} from "../utils/analytics";

export default function AnalyticsPage() {
  const { studentView } = useStudentView();
  const courses = loadCourses().filter((c) => c.published && !c.archived);
  const pending = getPendingSubmissions().length;
  const avgProgress =
    courses.length > 0
      ? Math.round(
          courses.reduce((s, c) => s + getCourseProgressPercent(c.id), 0) / courses.length,
        )
      : 0;

  const barData = courses.map((c) => ({
    name: c.short_name,
    value: getCourseProgressPercent(c.id),
    color: c.color,
  }));

  return (
    <div className="w-full px-8 py-10 lg:px-12">
      <h1 className="mb-8 text-3xl font-semibold text-canvas-grayDark">
        Analytics
      </h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active courses" value={courses.length} />
        <StatCard label="Avg completion" value={`${avgProgress}%`} />
        <StatCard
          label={studentView ? "Pending work" : "Pending submissions"}
          value={pending}
        />
      </div>

      <div className="mb-8 rounded-2xl bg-white p-6 ring-1 ring-canvas-border/80">
        <h2 className="mb-6 text-lg font-semibold text-canvas-grayDark">
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

      {!studentView &&
        courses.map((course) => {
          const distribution = getCourseGradeDistribution(course.id);
          const maxBucket = Math.max(1, ...distribution.map((b) => b.count));
          const stats = getCourseSubmissionStats(course.id);
          const averages = getAssignmentAverages(course.id);
          const avgCourseGrade = getCourseAveragePercent(course.id);

          return (
            <details
              key={course.id}
              className="mb-4 overflow-hidden rounded-2xl bg-white ring-1 ring-canvas-border/80 open:shadow-sm"
            >
              <summary className="cursor-pointer list-none px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-canvas-grayDark">
                      {course.title}
                    </h2>
                    <p className="text-sm text-gray-500">{course.short_name}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="rounded-full bg-canvas-blueTint px-3 py-1 font-medium text-canvas-blue">
                      Avg course grade {avgCourseGrade}%
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
                      {stats.submitted} submitted · {stats.late} late · {stats.missing} missing
                    </span>
                  </div>
                </div>
              </summary>

              <div className="space-y-6 border-t border-gray-100 px-6 py-5">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-canvas-grayDark">
                    Grade distribution
                  </h3>
                  <div className="flex items-end gap-3">
                    {distribution.map((bucket) => (
                      <div key={bucket.letter} className="flex flex-1 flex-col items-center gap-2">
                        <span className="text-xs tabular-nums text-gray-500">{bucket.count}</span>
                        <div className="flex h-28 w-full items-end rounded bg-gray-50 px-1">
                          <div
                            className="w-full rounded-t bg-canvas-blue/80"
                            style={{
                              height: `${Math.max(4, (bucket.count / maxBucket) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-canvas-grayDark">
                          {bucket.letter}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-canvas-grayDark">
                    Item averages
                  </h3>
                  {averages.length === 0 ? (
                    <p className="text-sm text-gray-500">No graded items yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-2 font-semibold">Item</th>
                            <th className="px-4 py-2 font-semibold">Average</th>
                            <th className="px-4 py-2 font-semibold">Scored</th>
                            <th className="px-4 py-2 font-semibold" />
                          </tr>
                        </thead>
                        <tbody>
                          {averages.map((item) => (
                            <tr key={item.columnId} className="border-b border-gray-100 last:border-0">
                              <td className="px-4 py-2">
                                <span className="font-medium text-canvas-grayDark">{item.title}</span>
                                <span className="ml-2 text-[10px] uppercase text-gray-400">
                                  {item.kind}
                                </span>
                              </td>
                              <td className="px-4 py-2 tabular-nums text-gray-700">
                                {item.average != null
                                  ? `${item.average} / ${item.points}`
                                  : "—"}
                              </td>
                              <td className="px-4 py-2 tabular-nums text-gray-700">
                                {item.submissionCount}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <Link
                                  to={item.gradePath}
                                  className="text-canvas-blue hover:underline"
                                >
                                  GradePro
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </details>
          );
        })}

      {studentView && (
        <p className="text-sm text-gray-500">
          Detailed grade distribution and submission analytics are available to instructors.
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-canvas-border/80">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-canvas-grayDark">
        {value}
      </p>
    </div>
  );
}
