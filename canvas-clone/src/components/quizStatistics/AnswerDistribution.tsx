import { Check } from "lucide-react";
import type { OptionStat } from "../../utils/quizSubmissions";

export default function AnswerDistribution({
  options,
  attemptCount,
}: {
  options: OptionStat[];
  attemptCount: number;
}) {
  if (options.length === 0) return null;

  const topDistractor = [...options]
    .filter((o) => !o.isCorrect && o.label !== "No answer" && o.count > 0)
    .sort((a, b) => b.count - a.count)[0];

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Answer distribution
        </p>
        {topDistractor && (
          <p className="text-xs text-gray-500">
            Top distractor:{" "}
            <span className="font-medium text-canvas-grayDark">{topDistractor.label}</span> (
            {topDistractor.count})
          </p>
        )}
      </div>
      <div className="space-y-2.5">
        {options.map((option) => {
          const widthPct = option.percent;
          return (
            <div key={option.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span
                  className={`flex min-w-0 items-center gap-1.5 ${
                    option.isCorrect ? "font-medium text-canvas-green" : "text-canvas-grayDark"
                  }`}
                >
                  {option.isCorrect && <Check className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{option.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-gray-500">
                  {option.count} ({option.percent}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${
                    option.isCorrect
                      ? "bg-canvas-green"
                      : option.label === "No answer"
                        ? "bg-gray-300"
                        : "bg-canvas-blue/60"
                  }`}
                  style={{ width: `${Math.max(widthPct, option.count > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Based on {attemptCount} response{attemptCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
