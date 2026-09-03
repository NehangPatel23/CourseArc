import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, ChevronDown, Download } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import QuizStatsAttempts from "../components/quizStatistics/QuizStatsAttempts";
import QuizStatsOverview from "../components/quizStatistics/QuizStatsOverview";
import QuizStatsQuestions from "../components/quizStatistics/QuizStatsQuestions";
import SurveyLikertCharts from "../components/quizStatistics/SurveyLikertCharts";
import QuizStatsTabBar, {
  isQuizStatsView,
  type QuizStatsView,
} from "../components/quizStatistics/QuizStatsTabBar";
import { useToast } from "../components/ui/Toast";
import { useStudentView } from "../hooks/useStudentView";
import { getQuizById, getQuizType, normalizeQuizQuestions, type Quiz } from "../utils/quizzes";
import {
  computeDetailedQuizStatistics,
  getAttemptsForQuiz,
  QUIZ_ATTEMPTS_CHANGED_EVENT,
  type QuizAttempt,
} from "../utils/quizSubmissions";
import {
  exportCanvasStyleQuizScoresCsv,
  exportQuizGradesCsv,
  exportQuizStatisticsCsv,
} from "../utils/quizStatisticsExport";
import { downloadTextFile } from "../utils/quizQtiExport";
import QuizPageSkeleton from "../components/QuizPageSkeleton";

const VIEW_DESCRIPTIONS: Record<QuizStatsView, string> = {
  overview: "Summary metrics, score distribution, and slowest questions by median focus time.",
  questions: "Per-question difficulty, discrimination, median time, and answer breakdowns.",
  attempts: "All student submissions — open any attempt in GradePro to review or grade.",
};

function slugTitle(title: string): string {
  return title.replace(/[^\w.-]+/g, "_").slice(0, 40) || "quiz";
}

export default function QuizStatisticsPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const { showToast } = useToast();
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!exportOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [exportOpen]);

  const stats = useMemo(
    () => (quiz ? computeDetailedQuizStatistics(quiz, attempts) : null),
    [quiz, attempts],
  );
  const questions = useMemo(() => normalizeQuizQuestions(quiz?.questions), [quiz]);

  const setActiveView = (view: QuizStatsView) => {
    setSearchParams(view === "overview" ? {} : { view }, { replace: true });
  };

  const runExport = (
    kind: "stats" | "grades" | "canvas",
  ) => {
    if (!quiz) return;
    const base = slugTitle(quiz.title);
    if (kind === "stats") {
      downloadTextFile(
        `${base}-stats.csv`,
        exportQuizStatisticsCsv(quiz, attempts),
        "text/csv;charset=utf-8",
      );
      showToast("Statistics exported as CSV", "positive", "files");
    } else if (kind === "grades") {
      downloadTextFile(
        `${base}-grades.csv`,
        exportQuizGradesCsv(quiz, attempts),
        "text/csv;charset=utf-8",
      );
      showToast("Grades exported as CSV", "positive", "grading");
    } else {
      downloadTextFile(
        `${base}-canvas-scores.csv`,
        exportCanvasStyleQuizScoresCsv(quiz, attempts),
        "text/csv;charset=utf-8",
      );
      showToast("Canvas-style scores exported", "positive", "grading");
    }
    setExportOpen(false);
  };

  if (!quiz || !quizId || !stats) {
    return (
      <div className="flex h-full w-full flex-col bg-transparent">
        <CourseHeader />
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {quiz && !stats ? <QuizPageSkeleton /> : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
              Quiz not found.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-transparent px-8 py-8">
        <div className="w-full">
          <Link
            to={quizPath}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-canvas-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to quiz
          </Link>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-canvas-blue" />
              <h1 className="text-2xl font-normal text-canvas-grayDark">Quiz Statistics</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/courses/${effectiveCourseId}/quizzes/${quizId}/similarity`}
                className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
              >
                Similarity Inbox
              </Link>
            {attempts.length > 0 && (
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setExportOpen((o) => !o)}
                  className="btn-canvas-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                  aria-expanded={exportOpen}
                  aria-hasPopup="menu"
                >
                  <Download className="h-4 w-4" />
                  Export
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
                {exportOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-arc-paper py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runExport("stats")}
                      className="block w-full px-3 py-2 text-left text-sm text-canvas-grayDark hover:bg-gray-50"
                    >
                      Export statistics CSV
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runExport("grades")}
                      className="block w-full px-3 py-2 text-left text-sm text-canvas-grayDark hover:bg-gray-50"
                    >
                      Export grades CSV
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => runExport("canvas")}
                      className="block w-full px-3 py-2 text-left text-sm text-canvas-grayDark hover:bg-gray-50"
                    >
                      Export Canvas-style scores CSV
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
          <p className="-mt-2 mb-6 text-sm text-gray-500">{quiz.title}</p>

          {stats.attemptCount === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-arc-paper px-5 py-10 text-center text-sm text-gray-600">
              No attempts yet. Statistics will appear once students submit this quiz.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-arc-paper shadow-sm">
              <QuizStatsTabBar
                active={activeView}
                onChange={setActiveView}
                questionCount={questions.length}
                attemptCount={stats.attemptCount}
              />

              <div className="px-5 py-5">
                <p className="mb-5 text-sm text-gray-500">{VIEW_DESCRIPTIONS[activeView]}</p>

                {activeView === "overview" && (
                  <>
                    {getQuizType(quiz) === "survey" && (
                      <SurveyLikertCharts
                        questions={questions}
                        stats={stats}
                        attempts={attempts}
                      />
                    )}
                    <QuizStatsOverview
                      courseId={effectiveCourseId}
                      quiz={quiz}
                      stats={stats}
                      attempts={attempts}
                      onOpenQuestions={() => setActiveView("questions")}
                    />
                  </>
                )}
                {activeView === "questions" && (
                  <QuizStatsQuestions
                    questions={questions}
                    stats={stats}
                    attempts={attempts}
                  />
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
