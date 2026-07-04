import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Users } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import { useStudentView } from "../hooks/useStudentView";
import {
  getQuizById,
  normalizeQuizQuestions,
  type Quiz,
} from "../utils/quizzes";
import { formatQuizDateTime } from "../utils/quizzes";
import {
  computeQuizStatistics,
  getAttemptsForQuiz,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
  type QuizAttempt,
} from "../utils/quizSubmissions";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-canvas-grayDark">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export default function QuizStatisticsPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);

  const [quiz, setQuiz] = useState<Quiz | undefined>(() =>
    quizId ? getQuizById(effectiveCourseId, quizId) : undefined,
  );
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() =>
    quizId ? getAttemptsForQuiz(effectiveCourseId, quizId) : [],
  );

  const quizPath = `/courses/${effectiveCourseId}/quizzes/${quizId}`;

  useEffect(() => {
    if (studentView) navigate(quizPath, { replace: true });
  }, [studentView, navigate, quizPath]);

  useEffect(() => {
    const refresh = () => {
      if (!quizId) return;
      setQuiz(getQuizById(effectiveCourseId, quizId));
      setAttempts(getAttemptsForQuiz(effectiveCourseId, quizId));
    };
    refresh();
    window.addEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refresh);
    window.addEventListener("canvasClone:quizzesChanged", refresh);
    return () => {
      window.removeEventListener(QUIZ_ATTEMPTS_CHANGED_EVENT, refresh);
      window.removeEventListener("canvasClone:quizzesChanged", refresh);
    };
  }, [effectiveCourseId, quizId]);

  const stats = useMemo(
    () => (quiz ? computeQuizStatistics(quiz, attempts) : null),
    [quiz, attempts],
  );
  const questions = useMemo(() => normalizeQuizQuestions(quiz?.questions), [quiz]);

  if (!quiz || !quizId || !stats) {
    return (
      <div className="flex h-full w-full flex-col bg-canvas-grayLight">
        <CourseHeader />
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          Quiz not found.
        </div>
      </div>
    );
  }

  const avgPercent =
    stats.maxScore > 0 ? Math.round((stats.averageScore / stats.maxScore) * 100) : 0;

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <Link
            to={quizPath}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-canvas-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to quiz
          </Link>

          <div className="mb-6 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-canvas-blue" />
            <h1 className="text-2xl font-normal text-canvas-grayDark">Quiz Statistics</h1>
          </div>
          <p className="-mt-4 mb-6 text-sm text-gray-500">{quiz.title}</p>

          {stats.attemptCount === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-600">
              No attempts yet. Statistics will appear once students submit this quiz.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Attempts" value={String(stats.attemptCount)} />
                <StatCard label="Students" value={String(stats.uniqueStudents)} />
                <StatCard
                  label="Average"
                  value={`${stats.averageScore.toFixed(1)}`}
                  sub={`${avgPercent}% of ${stats.maxScore}`}
                />
                <StatCard
                  label="High / Low"
                  value={`${stats.highScore} / ${stats.lowScore}`}
                  sub={`out of ${stats.maxScore}`}
                />
              </div>

              <h2 className="mt-8 text-lg font-semibold text-canvas-grayDark">
                Question breakdown
              </h2>
              <div className="mt-3 space-y-3">
                {questions.map((question, index) => {
                  const q = stats.perQuestion.find((p) => p.questionId === question.id);
                  const percent = q?.correctPercent ?? 0;
                  return (
                    <div
                      key={question.id}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm text-canvas-grayDark">
                          <span className="font-semibold">Q{index + 1}.</span>{" "}
                          {question.prompt || (
                            <span className="italic text-gray-400">Untitled question</span>
                          )}
                        </p>
                        <span className="shrink-0 text-sm font-semibold text-canvas-grayDark">
                          {percent}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${
                            percent >= 70
                              ? "bg-canvas-green"
                              : percent >= 40
                                ? "bg-amber-400"
                                : "bg-canvas-red"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">
                        {q?.correctCount ?? 0} of {stats.attemptCount} correct
                      </p>
                    </div>
                  );
                })}
              </div>

              <h2 className="mt-8 flex items-center gap-2 text-lg font-semibold text-canvas-grayDark">
                <Users className="h-5 w-5 text-gray-500" /> Attempts
              </h2>
              <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2.5 font-medium">Student</th>
                      <th className="px-4 py-2.5 font-medium">Attempt</th>
                      <th className="px-4 py-2.5 font-medium">Score</th>
                      <th className="px-4 py-2.5 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...attempts]
                      .sort((a, b) => b.submittedAt - a.submittedAt)
                      .map((attempt) => (
                        <tr key={attempt.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-2.5 text-canvas-grayDark">
                            {attempt.studentName}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">#{attempt.attemptNumber}</td>
                          <td className="px-4 py-2.5 font-medium text-canvas-grayDark">
                            {attempt.score} / {attempt.maxScore}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">
                            {formatQuizDateTime(attempt.submittedAt)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
