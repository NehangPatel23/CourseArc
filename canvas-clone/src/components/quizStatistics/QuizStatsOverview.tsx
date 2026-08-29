import { useMemo } from "react";
import ScoreDial from "../ScoreDial";
import type { Quiz } from "../../utils/quizzes";
import type { DetailedQuizStatistics, QuizAttempt } from "../../utils/quizSubmissions";
import { formatDurationMs } from "../../utils/quizSubmissions";
import {
  buildAttentionList,
  buildLeaveChronology,
  compareAttemptWeekCohorts,
  compareSeatCohorts,
  cronbachAlpha,
  statsByBankSource,
  type CohortStat,
} from "../../utils/quizAnalyticsExtras";
import ScoreHistogram from "./ScoreHistogram";
import StatCard from "./StatCard";

function CohortTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: CohortStat[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <h3 className="text-sm font-semibold text-canvas-grayDark">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pr-3 font-medium">Cohort</th>
              <th className="pb-2 pr-3 font-medium">Attempts</th>
              <th className="pb-2 pr-3 font-medium">Avg score</th>
              <th className="pb-2 font-medium">Avg %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 font-medium text-canvas-grayDark">{row.label}</td>
                <td className="py-2 pr-3 tabular-nums text-gray-600">{row.attemptCount}</td>
                <td className="py-2 pr-3 tabular-nums text-gray-600">{row.averageScore}</td>
                <td className="py-2 tabular-nums text-gray-600">{row.averagePercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaveChronologyChart({
  buckets,
}: {
  buckets: { label: string; count: number }[];
}) {
  const total = buckets.reduce((n, b) => n + b.count, 0);
  if (total === 0) return null;
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <h2 className="text-lg font-semibold text-canvas-grayDark">Leave chronology</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        When leave events occurred relative to attempt start ({total} event
        {total === 1 ? "" : "s"})
      </p>
      <div className="mt-6 flex items-end gap-2" style={{ height: 160 }}>
        {buckets.map((bucket) => {
          const barAreaHeight = 120;
          const barHeight =
            bucket.count > 0
              ? Math.max(4, (bucket.count / maxCount) * barAreaHeight)
              : 0;
          return (
            <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium tabular-nums text-canvas-grayDark">
                {bucket.count}
              </span>
              <div
                className="flex w-full items-end justify-center"
                style={{ height: barAreaHeight }}
              >
                <div
                  className="w-full rounded-t bg-amber-500 transition-all"
                  style={{ height: barHeight }}
                  title={`${bucket.label}: ${bucket.count}`}
                />
              </div>
              <span className="w-full truncate text-center text-[10px] text-gray-500">
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function QuizStatsOverview({
  courseId,
  quiz,
  stats,
  attempts = [],
  onOpenQuestions,
}: {
  courseId: string;
  quiz: Quiz;
  stats: DetailedQuizStatistics;
  attempts?: QuizAttempt[];
  onOpenQuestions?: () => void;
}) {
  const withLeaves = attempts.filter((a) => (a.leaveCount ?? 0) > 0);
  const totalLeaves = attempts.reduce((n, a) => n + (a.leaveCount ?? 0), 0);
  const avgLeaves =
    attempts.length > 0 ? Math.round((totalLeaves / attempts.length) * 10) / 10 : 0;

  const alpha = useMemo(() => cronbachAlpha(quiz, attempts), [quiz, attempts]);
  const attention = useMemo(() => buildAttentionList(stats), [stats]);
  const leaveChronology = useMemo(
    () => buildLeaveChronology(attempts, "minutesIntoAttempt"),
    [attempts],
  );
  const weekCohorts = useMemo(() => compareAttemptWeekCohorts(attempts), [attempts]);
  const seatCohorts = useMemo(() => compareSeatCohorts(attempts), [attempts]);
  const bankStats = useMemo(
    () => statsByBankSource(courseId, stats),
    [courseId, stats],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          <StatCard label="Attempts" value={String(stats.attemptCount)} />
          <StatCard label="Students" value={String(stats.uniqueStudents)} />
          <StatCard
            label="Average"
            value={stats.averageScore.toFixed(1)}
            sub={`${stats.averagePercent}% of ${stats.maxScore}`}
          />
          <StatCard
            label="Median"
            value={stats.medianScore.toFixed(1)}
            sub={`out of ${stats.maxScore}`}
          />
          <StatCard label="Std Dev" value={stats.stdDev.toFixed(2)} sub="score spread" />
          <StatCard
            label="High / Low"
            value={`${stats.highScore} / ${stats.lowScore}`}
            sub={`out of ${stats.maxScore}`}
          />
          {alpha != null && (
            <StatCard
              label="Cronbach α"
              value={alpha.toFixed(3)}
              sub="internal consistency"
            />
          )}
        </div>
        <div className="flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div className="text-center">
            <ScoreDial percent={stats.averagePercent} size={96} stroke={10} />
            <p className="mt-2 text-xs font-medium text-gray-500">Class average</p>
          </div>
        </div>
      </div>

      {attempts.length > 0 && (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-4">
          <h3 className="text-sm font-semibold text-canvas-grayDark">Leave lock summary</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Attempts with leaves"
              value={String(withLeaves.length)}
              sub={`of ${attempts.length}`}
            />
            <StatCard label="Total leaves" value={String(totalLeaves)} />
            <StatCard label="Avg leaves / attempt" value={String(avgLeaves)} />
          </div>
        </div>
      )}

      <ScoreHistogram buckets={stats.scoreDistribution} total={stats.attemptCount} />

      <LeaveChronologyChart buckets={leaveChronology} />

      {stats.slowestQuestions.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-canvas-grayDark">Slowest questions</h3>
            <p className="text-xs text-gray-500">By median focus time</p>
          </div>
          <ol className="mt-3 space-y-2">
            {stats.slowestQuestions.map((item) => {
              const index = stats.questionDetails.findIndex(
                (q) => q.questionId === item.questionId,
              );
              const label = index >= 0 ? `Q${index + 1}` : "Q?";
              const prompt =
                item.prompt.trim().length > 80
                  ? `${item.prompt.trim().slice(0, 80)}…`
                  : item.prompt.trim() || "Untitled question";
              return (
                <li
                  key={item.questionId}
                  className="flex flex-wrap items-start justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-canvas-grayDark">{label}</span>
                    <span className="text-gray-500"> — {prompt}</span>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums text-canvas-grayDark">
                    {formatDurationMs(item.medianTimeMs)}
                  </span>
                </li>
              );
            })}
          </ol>
          {onOpenQuestions && (
            <button
              type="button"
              onClick={onOpenQuestions}
              className="mt-3 text-xs font-medium text-canvas-blue hover:underline"
            >
              View question details
            </button>
          )}
        </div>
      )}

      {attention.length > 0 && (
        <div className="rounded-lg border border-orange-200/80 bg-orange-50/40 px-4 py-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-canvas-grayDark">Needs attention</h3>
            <p className="text-xs text-gray-500">Slow + low correct %</p>
          </div>
          <ol className="mt-3 space-y-2">
            {attention.map((item) => {
              const index = stats.questionDetails.findIndex(
                (q) => q.questionId === item.questionId,
              );
              const label = index >= 0 ? `Q${index + 1}` : "Q?";
              const prompt =
                item.prompt.trim().length > 80
                  ? `${item.prompt.trim().slice(0, 80)}…`
                  : item.prompt.trim() || "Untitled question";
              return (
                <li
                  key={item.questionId}
                  className="flex flex-wrap items-start justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-canvas-grayDark">{label}</span>
                    <span className="text-gray-500"> — {prompt}</span>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums text-gray-600">
                    <div className="font-medium text-canvas-grayDark">
                      {formatDurationMs(item.medianTimeMs)}
                    </div>
                    <div>{item.correctPercent}% correct</div>
                  </div>
                </li>
              );
            })}
          </ol>
          {onOpenQuestions && (
            <button
              type="button"
              onClick={onOpenQuestions}
              className="mt-3 text-xs font-medium text-canvas-blue hover:underline"
            >
              Review in question details
            </button>
          )}
        </div>
      )}

      {(weekCohorts.length > 0 || seatCohorts.length > 1) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <CohortTable
            title="Week cohorts"
            subtitle="Average performance by ISO submit week"
            rows={weekCohorts}
          />
          <CohortTable
            title="Seat cohorts"
            subtitle="With vs without seat number"
            rows={seatCohorts}
          />
        </div>
      )}

      {bankStats.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
          <h3 className="text-sm font-semibold text-canvas-grayDark">By question bank</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Average correct % for questions sourced from course banks
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 pr-3 font-medium">Bank</th>
                  <th className="pb-2 pr-3 font-medium">Questions</th>
                  <th className="pb-2 font-medium">Avg correct %</th>
                </tr>
              </thead>
              <tbody>
                {bankStats.map((row) => (
                  <tr key={row.bankId} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-canvas-grayDark">
                      {row.bankTitle}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-600">
                      {row.questionCount}
                    </td>
                    <td className="py-2 tabular-nums text-gray-600">
                      {row.averageCorrectPercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
