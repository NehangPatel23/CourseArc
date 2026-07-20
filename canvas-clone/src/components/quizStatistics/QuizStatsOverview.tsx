import ScoreDial from "../ScoreDial";
import type { DetailedQuizStatistics } from "../../utils/quizSubmissions";
import ScoreHistogram from "./ScoreHistogram";
import StatCard from "./StatCard";

export default function QuizStatsOverview({ stats }: { stats: DetailedQuizStatistics }) {
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
        </div>
        <div className="flex shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div className="text-center">
            <ScoreDial percent={stats.averagePercent} size={96} stroke={10} />
            <p className="mt-2 text-xs font-medium text-gray-500">Class average</p>
          </div>
        </div>
      </div>

      <ScoreHistogram buckets={stats.scoreDistribution} total={stats.attemptCount} />
    </div>
  );
}
