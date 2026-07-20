import { QUIZ_QUESTION_TYPE_LABELS, type QuizQuestionType } from "../../utils/quizzes";

export default function TypeBadge({ type }: { type: QuizQuestionType }) {
  return (
    <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {QUIZ_QUESTION_TYPE_LABELS[type]}
    </span>
  );
}
