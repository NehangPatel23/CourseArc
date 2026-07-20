import type { QuestionDetailStat } from "../../utils/quizSubmissions";
import AnswerDistribution from "./AnswerDistribution";
import TypeBadge from "./TypeBadge";

function difficultyColor(percent: number): string {
  if (percent >= 70) return "bg-canvas-green";
  if (percent >= 40) return "bg-amber-400";
  return "bg-canvas-red";
}

export default function QuestionStatCard({
  index,
  detail,
  attemptCount,
}: {
  index: number;
  detail: QuestionDetailStat;
  attemptCount: number;
}) {
  const correctCount = Math.round((detail.correctPercent / 100) * attemptCount);

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-canvas-grayDark">Q{index + 1}</span>
            <TypeBadge type={detail.type} />
            {detail.points > 0 && (
              <span className="text-xs text-gray-500">
                {detail.points} pt{detail.points === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-canvas-grayDark">
            {detail.prompt || <span className="italic text-gray-400">Untitled question</span>}
          </p>
        </div>
        <span className="shrink-0 text-lg font-semibold text-canvas-grayDark">
          {detail.correctPercent}%
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${difficultyColor(detail.correctPercent)}`}
          style={{ width: `${detail.correctPercent}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>
          {correctCount} of {attemptCount} correct
        </span>
        <span>{detail.answeredCount} answered</span>
        <span>{detail.skippedCount} skipped</span>
        <span>Avg earned: {detail.averageEarned.toFixed(2)}</span>
        {detail.discrimination != null && (
          <span>
            Discrimination:{" "}
            <span
              className={
                detail.discrimination >= 0.3
                  ? "font-medium text-canvas-green"
                  : detail.discrimination >= 0.15
                    ? "font-medium text-amber-600"
                    : "font-medium text-canvas-red"
              }
            >
              {detail.discrimination.toFixed(2)}
            </span>
          </span>
        )}
      </div>

      {detail.type === "essay" ? (
        <p className="mt-4 border-t border-gray-100 pt-4 text-xs italic text-gray-500">
          Essay questions are manually graded — no answer distribution available.
        </p>
      ) : (
        <AnswerDistribution options={detail.options} attemptCount={attemptCount} />
      )}
    </div>
  );
}
