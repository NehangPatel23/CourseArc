import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import ListFiltersBar from "../ListFiltersBar";
import { formatQuizDateTime } from "../../utils/quizzes";
import {
  ATTEMPT_SORT_OPTIONS,
  filterQuizAttempts,
  SCORE_BAND_OPTIONS,
  type AttemptSortKey,
  type ScoreBandKey,
} from "../../utils/listFilters";
import {
  getAttemptEffectiveScore,
  type QuizAttempt,
} from "../../utils/quizSubmissions";

export function quizStatsAttemptsPath(courseId: string, quizId: string): string {
  return `/courses/${courseId}/quizzes/${quizId}/statistics?view=attempts`;
}

export function quizGradePath(
  courseId: string,
  quizId: string,
  attemptId: string,
  returnTo?: string,
): string {
  const params = new URLSearchParams({ attempt: attemptId });
  if (returnTo) params.set("returnTo", returnTo);
  return `/courses/${courseId}/quizzes/${quizId}/grade?${params.toString()}`;
}

export default function QuizStatsAttempts({
  courseId,
  quizId,
  attempts,
}: {
  courseId: string;
  quizId: string;
  attempts: QuizAttempt[];
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AttemptSortKey>("newest");
  const [scoreBand, setScoreBand] = useState<ScoreBandKey>("all");
  const [latestOnly, setLatestOnly] = useState(false);

  const returnTo = quizStatsAttemptsPath(courseId, quizId);

  const filtered = useMemo(
    () =>
      filterQuizAttempts(attempts, {
        search,
        sort,
        scoreBand,
        latestOnly,
      }),
    [attempts, search, sort, scoreBand, latestOnly],
  );

  return (
    <div className="space-y-4">
      <ListFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by student name…"
        sort={sort}
        onSortChange={(value) => setSort(value as AttemptSortKey)}
        sortOptions={ATTEMPT_SORT_OPTIONS}
        scoreBand={scoreBand}
        onScoreBandChange={(value) => setScoreBand(value as ScoreBandKey)}
        scoreBandOptions={SCORE_BAND_OPTIONS}
        latestOnly={latestOnly}
        onLatestOnlyChange={setLatestOnly}
        resultCount={filtered.length}
        totalCount={attempts.length}
      />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            No attempts match the current filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Student</th>
                <th className="px-4 py-2.5 font-medium">Attempt</th>
                <th className="px-4 py-2.5 font-medium">Score</th>
                <th className="px-4 py-2.5 font-medium">%</th>
                <th className="px-4 py-2.5 font-medium">Submitted</th>
                <th className="px-4 py-2.5 font-medium">
                  <span className="sr-only">Open in GradePro</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((attempt) => {
                const effective = getAttemptEffectiveScore(attempt);
                const pct =
                  attempt.maxScore > 0
                    ? Math.round((effective / attempt.maxScore) * 100)
                    : 0;
                const gradeHref = quizGradePath(courseId, quizId, attempt.id, returnTo);

                return (
                  <tr
                    key={attempt.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to={gradeHref}
                        className="font-medium text-canvas-blue hover:underline"
                      >
                        {attempt.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">#{attempt.attemptNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-canvas-grayDark">
                      {effective} / {attempt.maxScore}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-600">{pct}%</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {formatQuizDateTime(attempt.submittedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={gradeHref}
                        className="inline-flex items-center gap-1 text-xs font-medium text-canvas-blue hover:underline"
                      >
                        GradePro
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
