import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, MessageSquare } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import ScoreDial from "../components/ScoreDial";
import UnavailableScreen from "../components/UnavailableScreen";
import { useStudentView } from "../hooks/useStudentView";
import {
  formatQuizDateTime,
  getQuizById,
  getQuizScoringPolicy,
  QUIZ_SCORING_POLICY_LABELS,
} from "../utils/quizzes";
import {
  getAttemptEffectiveScore,
  getStudentAttemptsForQuiz,
  getStudentFinalScore,
} from "../utils/quizSubmissions";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-canvas-grayDark">{value}</dd>
    </div>
  );
}

export default function QuizSubmissionDetailsPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const effectiveCourseId = courseId ?? "default";
  const studentView = useStudentView(effectiveCourseId);
  const quiz = quizId ? getQuizById(effectiveCourseId, quizId) : undefined;
  const quizPath = `/courses/${effectiveCourseId}/quizzes/${quizId}`;

  // Instructors grade via GradePro, not this student-facing page.
  useEffect(() => {
    if (!studentView && quizId) {
      navigate(`/courses/${effectiveCourseId}/quizzes/${quizId}/grade`, {
        replace: true,
      });
    }
  }, [studentView, navigate, effectiveCourseId, quizId]);

  if (!quiz || !quizId) {
    return (
      <UnavailableScreen
        title="Quiz not found"
        message="This quiz is no longer available."
        backTo={`/courses/${effectiveCourseId}/quizzes`}
        backLabel="Back to Quizzes"
      />
    );
  }

  const attempts = getStudentAttemptsForQuiz(effectiveCourseId, quiz.id)
    .slice()
    .sort((a, b) => b.attemptNumber - a.attemptNumber);

  if (attempts.length === 0) {
    return (
      <UnavailableScreen
        title="No submissions yet"
        message="You haven't submitted this quiz yet. Once you do, your attempts will show up here."
        backTo={quizPath}
        backLabel="Back to quiz"
      />
    );
  }

  const finalScore = getStudentFinalScore(effectiveCourseId, quiz);
  const finalScorePct =
    finalScore && finalScore.maxScore > 0
      ? Math.round((finalScore.score / finalScore.maxScore) * 100)
      : 0;
  const formatScore = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  const policyLabel = QUIZ_SCORING_POLICY_LABELS[getQuizScoringPolicy(quiz)];
  const totalPoints = finalScore?.maxScore ?? quiz.points;

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="mx-auto w-full max-w-5xl">
          <Link
            to={quizPath}
            className="inline-flex items-center gap-1.5 text-sm text-canvas-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to quiz
          </Link>

          <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Left summary — fills the previously empty column */}
            <aside className="h-fit lg:sticky lg:top-4">
              <div className="overflow-hidden rounded-2xl border border-canvas-blue/20 bg-gradient-to-br from-canvas-blueTint via-white to-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-canvas-blueDark">
                  Submission Details
                </p>
                <h1 className="mt-1 break-words text-xl font-semibold text-canvas-grayDark">
                  {quiz.title}
                </h1>

                {finalScore && (
                  <div className="mt-5 flex items-center gap-4">
                    <ScoreDial percent={finalScorePct} />
                    <div className="min-w-0">
                      <p className="flex items-baseline gap-1 text-canvas-grayDark">
                        <span className="text-3xl font-bold leading-none">
                          {formatScore(finalScore.score)}
                        </span>
                        <span className="text-base font-medium text-gray-400">
                          / {finalScore.maxScore}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-gray-500">Final score</p>
                    </div>
                  </div>
                )}

                <dl className="mt-5 space-y-2.5 border-t border-canvas-blue/10 pt-4 text-sm">
                  <SummaryRow label="Attempts" value={String(attempts.length)} />
                  {quiz.allowMultipleAttempts && (
                    <SummaryRow label="Score kept" value={policyLabel} />
                  )}
                  {totalPoints != null && (
                    <SummaryRow label="Points" value={String(totalPoints)} />
                  )}
                  <SummaryRow
                    label="Due"
                    value={quiz.dueAt ? formatQuizDateTime(quiz.dueAt) : "No due date"}
                  />
                </dl>
              </div>
            </aside>

            {/* Right — the attempts list */}
            <div>
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-lg font-semibold text-canvas-grayDark">
                  All attempts
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {attempts.length} attempt{attempts.length === 1 ? "" : "s"} · newest
                  first
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {attempts.map((attempt) => {
                  const feedback = attempt.feedbackEntries ?? [];
                  const comments = attempt.comments ?? [];
                  return (
                    <div
                      key={attempt.id}
                      className="rounded-lg border border-canvas-border bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-canvas-grayDark">
                            Attempt #{attempt.attemptNumber}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Submitted {formatQuizDateTime(attempt.submittedAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-canvas-grayDark">
                            {getAttemptEffectiveScore(attempt)}
                            <span className="text-sm font-normal text-gray-400">
                              {" "}
                              / {attempt.maxScore}
                            </span>
                          </p>
                          {attempt.maxScore > 0 && (
                            <p className="text-xs text-gray-500">
                              {Math.round(
                                (getAttemptEffectiveScore(attempt) / attempt.maxScore) *
                                  100,
                              )}
                              %
                            </p>
                          )}
                        </div>
                      </div>

                      {(feedback.length > 0 || comments.length > 0) && (
                        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                          {feedback.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-md border border-green-200 bg-green-50 px-3 py-2"
                            >
                              <p className="text-xs font-semibold text-green-800">
                                Feedback · {entry.author}
                              </p>
                              <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">
                                {entry.body}
                              </p>
                            </div>
                          ))}
                          {comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                            >
                              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                              <div>
                                <p className="text-xs font-semibold text-canvas-grayDark">
                                  {comment.author}
                                </p>
                                <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">
                                  {comment.body}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-end">
                        <Link
                          to={`${quizPath}/take?review=1&attempt=${attempt.id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-canvas-blue hover:underline"
                        >
                          <Eye className="h-4 w-4" /> View responses
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
