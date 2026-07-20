import type { QuizQuestion } from "../../utils/quizzes";
import type { DetailedQuizStatistics } from "../../utils/quizSubmissions";
import QuestionStatCard from "./QuestionStatCard";

export default function QuizStatsQuestions({
  questions,
  stats,
}: {
  questions: QuizQuestion[];
  stats: DetailedQuizStatistics;
}) {
  return (
    <div className="space-y-3">
      {questions.map((question, index) => {
        const detail = stats.questionDetails.find((q) => q.questionId === question.id);
        if (!detail) return null;
        return (
          <QuestionStatCard
            key={question.id}
            index={index}
            detail={detail}
            attemptCount={stats.attemptCount}
          />
        );
      })}
    </div>
  );
}
