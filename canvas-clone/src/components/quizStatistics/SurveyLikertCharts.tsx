import type { QuizQuestion } from "../../utils/quizzes";
import type { DetailedQuizStatistics, QuizAttempt } from "../../utils/quizSubmissions";
import AnswerDistribution from "./AnswerDistribution";

function likertMean(question: QuizQuestion, attempts: QuizAttempt[]): number | null {
  const values: number[] = [];
  for (const attempt of attempts) {
    const answer = attempt.answers.find((a) => a.questionId === question.id);
    if (typeof answer?.likertValue === "number") values.push(answer.likertValue);
  }
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export default function SurveyLikertCharts({
  questions,
  stats,
  attempts,
}: {
  questions: QuizQuestion[];
  stats: DetailedQuizStatistics;
  attempts: QuizAttempt[];
}) {
  const likertQuestions = questions.filter((q) => q.type === "likert");
  if (likertQuestions.length === 0) return null;

  return (
    <section className="mb-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-canvas-grayDark">Likert scale responses</h2>
        <p className="mt-1 text-sm text-gray-500">
          Distribution of agreement ratings across survey submissions.
        </p>
      </div>
      {likertQuestions.map((question, index) => {
        const detail = stats.questionDetails.find((q) => q.questionId === question.id);
        if (!detail) return null;
        const mean = likertMean(question, attempts);
        return (
          <div
            key={question.id}
            className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Q{index + 1}
                </p>
                <p className="mt-1 text-sm text-canvas-grayDark">
                  {question.prompt || (
                    <span className="italic text-gray-400">Untitled question</span>
                  )}
                </p>
              </div>
              {mean != null && (
                <p className="shrink-0 text-sm text-gray-600">
                  Mean:{" "}
                  <span className="font-semibold tabular-nums text-canvas-grayDark">
                    {mean.toFixed(2)}
                  </span>
                </p>
              )}
            </div>
            <AnswerDistribution options={detail.options} attemptCount={stats.attemptCount} />
          </div>
        );
      })}
    </section>
  );
}
