import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3 } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import QuizStatsAttempts from "../components/quizStatistics/QuizStatsAttempts";
import QuizStatsOverview from "../components/quizStatistics/QuizStatsOverview";
import QuizStatsQuestions from "../components/quizStatistics/QuizStatsQuestions";
import QuizStatsTabBar, {
  isQuizStatsView,
  type QuizStatsView,
} from "../components/quizStatistics/QuizStatsTabBar";
import { useStudentView } from "../hooks/useStudentView";
import { getQuizById, normalizeQuizQuestions, type Quiz } from "../utils/quizzes";
import {
  computeDetailedQuizStatistics,
  getAttemptsForQuiz,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
  type QuizAttempt,
} from "../utils/quizSubmissions";

const VIEW_DESCRIPTIONS: Record<QuizStatsView, string> = {
  overview: "Summary metrics and score distribution for this quiz.",
  questions: "Per-question difficulty, discrimination, and answer breakdowns.",
  attempts: "All student submissions — open any attempt in GradePro to review or grade.",
};

export default function QuizStatisticsPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);

  const viewParam = searchParams.get("view");
  const activeView: QuizStatsView = isQuizStatsView(viewParam) ? viewParam : "overview";

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
    () => (quiz ? computeDetailedQuizStatistics(quiz, attempts) : null),
    [quiz, attempts],
  );
  const questions = useMemo(() => normalizeQuizQuestions(quiz?.questions), [quiz]);

  const setActiveView = (view: QuizStatsView) => {
    setSearchParams(view === "overview" ? {} : { view }, { replace: true });
  };

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
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <QuizStatsTabBar
                active={activeView}
                onChange={setActiveView}
                questionCount={questions.length}
                attemptCount={stats.attemptCount}
              />

              <div className="px-5 py-5">
                <p className="mb-5 text-sm text-gray-500">{VIEW_DESCRIPTIONS[activeView]}</p>

                {activeView === "overview" && <QuizStatsOverview stats={stats} />}
                {activeView === "questions" && (
                  <QuizStatsQuestions questions={questions} stats={stats} />
                )}
                {activeView === "attempts" && (
                  <QuizStatsAttempts
                    courseId={effectiveCourseId}
                    quizId={quizId}
                    attempts={attempts}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
