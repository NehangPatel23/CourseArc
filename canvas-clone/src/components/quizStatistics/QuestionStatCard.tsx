import { useMemo, useState } from "react";
import type { QuizQuestion } from "../../utils/quizzes";
import type { QuestionDetailStat, QuizAttempt } from "../../utils/quizSubmissions";
import { formatDurationMs } from "../../utils/quizSubmissions";
import {
  analyzeMcDistractors,
  buildQuestionTimeHistogram,
} from "../../utils/quizAnalyticsExtras";
import AnswerDistribution from "./AnswerDistribution";
import TypeBadge from "./TypeBadge";

function difficultyColor(percent: number): string {
  if (percent >= 70) return "bg-canvas-green";
  if (percent >= 40) return "bg-amber-400";
  return "bg-canvas-red";
}

function MiniTimeHistogram({
  buckets,
}: {
  buckets: { label: string; count: number }[];
}) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="mt-2 flex items-end gap-1" style={{ height: 72 }}>
      {buckets.map((bucket) => {
        const barAreaHeight = 48;
        const barHeight =
          bucket.count > 0
            ? Math.max(3, (bucket.count / maxCount) * barAreaHeight)
            : 0;
        return (
          <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            <span className="text-[9px] tabular-nums text-gray-500">{bucket.count || ""}</span>
            <div
              className="flex w-full items-end justify-center"
              style={{ height: barAreaHeight }}
            >
              <div
                className="w-full rounded-t bg-canvas-blue/70"
                style={{ height: barHeight }}
                title={`${bucket.label}: ${bucket.count}`}
              />
            </div>
            <span className="w-full truncate text-center text-[8px] leading-tight text-gray-400">
              {bucket.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function QuestionStatCard({
  index,
  detail,
  question,
  attempts,
  attemptCount,
}: {
  index: number;
  detail: QuestionDetailStat;
  question: QuizQuestion;
  attempts: QuizAttempt[];
  attemptCount: number;
}) {
  const [timeOpen, setTimeOpen] = useState(false);
  const correctCount = Math.round((detail.correctPercent / 100) * attemptCount);

  const timeHistogram = useMemo(
    () => buildQuestionTimeHistogram(attempts, detail.questionId),
    [attempts, detail.questionId],
  );

  const distractors = useMemo(
    () =>
      question.type === "multiple_choice"
        ? analyzeMcDistractors(question, attempts)
        : [],
    [question, attempts],
  );

  return (
    <div
      id={`quiz-stat-q-${detail.questionId}`}
      className="rounded-lg border border-gray-200 bg-arc-paper px-4 py-4 shadow-sm"
    >
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
        <span>
          Median time:{" "}
          {detail.medianTimeMs != null ? (
            <span className="font-medium text-canvas-grayDark">
              {formatDurationMs(detail.medianTimeMs)}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
          {detail.timeSampleCount > 0 && (
            <span className="text-gray-400">
              {" "}
              ({detail.timeSampleCount} attempt
              {detail.timeSampleCount === 1 ? "" : "s"})
            </span>
          )}
        </span>
      </div>

      {timeHistogram.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setTimeOpen((o) => !o)}
            className="text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-canvas-grayDark"
          >
            Time spent {timeOpen ? "▾" : "▸"}
          </button>
          {timeOpen && <MiniTimeHistogram buckets={timeHistogram} />}
        </div>
      )}

      {detail.type === "essay" ? (
        <p className="mt-4 border-t border-gray-100 pt-4 text-xs italic text-gray-500">
          Essay questions are manually graded — no answer distribution available.
        </p>
      ) : (
        <AnswerDistribution options={detail.options} attemptCount={attemptCount} />
      )}

      {distractors.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Distractor analysis
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left uppercase tracking-wide text-gray-500">
                  <th className="pb-1.5 pr-2 font-medium">Option</th>
                  <th className="pb-1.5 pr-2 font-medium">n</th>
                  <th className="pb-1.5 pr-2 font-medium">%</th>
                  <th className="pb-1.5 pr-2 font-medium">Discrim</th>
                  <th className="pb-1.5 pr-2 font-medium">High %</th>
                  <th className="pb-1.5 font-medium">Low %</th>
                </tr>
              </thead>
              <tbody>
                {distractors.map((row) => (
                  <tr
                    key={row.label}
                    className={`border-b border-gray-50 last:border-0 ${
                      row.isCorrect ? "bg-green-50/50" : ""
                    }`}
                  >
                    <td
                      className={`max-w-[14rem] truncate py-1.5 pr-2 ${
                        row.isCorrect
                          ? "font-medium text-canvas-green"
                          : "text-canvas-grayDark"
                      }`}
                      title={row.label}
                    >
                      {row.isCorrect ? "✓ " : ""}
                      {row.label}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums text-gray-600">{row.count}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-gray-600">{row.percent}%</td>
                    <td className="py-1.5 pr-2 tabular-nums text-gray-600">
                      {row.discrimination != null ? row.discrimination.toFixed(2) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums text-gray-600">
                      {row.highGroupPct}%
                    </td>
                    <td className="py-1.5 tabular-nums text-gray-600">{row.lowGroupPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[10px] text-gray-400">
            High/low = top/bottom ~27% by total score
          </p>
        </div>
      )}
    </div>
  );
}
