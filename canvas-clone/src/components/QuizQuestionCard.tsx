import { CheckCircle2, Flag, XCircle } from "lucide-react";
import type { QuizQuestion } from "../utils/quizzes";
import type { QuizAnswer } from "../utils/quizSubmissions";

/**
 * Renders a single quiz question. Used both when taking a quiz (interactive) and
 * in review/grading contexts (disabled, with correct/incorrect highlighting).
 *
 * - `review` present => show correct/incorrect badge and mark the student's picks.
 * - `revealKey` => additionally reveal the answer key (correct option/values).
 */
export default function QuizQuestionCard({
  question,
  index,
  answer,
  onChange,
  disabled,
  review,
  revealKey = true,
  markedForReview = false,
  onToggleMarkForReview,
}: {
  question: QuizQuestion;
  index: number;
  answer?: QuizAnswer;
  onChange: (next: QuizAnswer) => void;
  disabled: boolean;
  review?: { correct: boolean };
  revealKey?: boolean;
  markedForReview?: boolean;
  onToggleMarkForReview?: () => void;
}) {
  const choices = question.choices ?? [];
  const borderClass = review
    ? review.correct
      ? "border-green-300"
      : "border-red-300"
    : markedForReview
      ? "border-amber-300"
      : "border-gray-200";
  const showMarkToggle = Boolean(onToggleMarkForReview) && !disabled && !review;

  return (
    <div className={`rounded-lg border bg-white shadow-sm ${borderClass}`}>
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <span className="text-sm font-semibold text-canvas-grayDark">Question {index + 1}</span>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          {showMarkToggle && (
            <button
              type="button"
              onClick={onToggleMarkForReview}
              aria-pressed={markedForReview}
              title={
                markedForReview
                  ? "Marked for review — click to unmark"
                  : "Mark this question for review"
              }
              className={`inline-flex items-center justify-center rounded-md border p-1.5 transition-colors ${
                markedForReview
                  ? "border-amber-300 bg-amber-50 text-amber-600"
                  : "border-gray-300 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              }`}
            >
              <Flag className={`h-4 w-4 ${markedForReview ? "fill-amber-400" : ""}`} />
              <span className="sr-only">
                {markedForReview ? "Marked for review" : "Mark for review"}
              </span>
            </button>
          )}
          {review &&
            (review.correct ? (
              <span className="flex items-center gap-1 font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Correct
              </span>
            ) : (
              <span className="flex items-center gap-1 font-medium text-red-600">
                <XCircle className="h-4 w-4" /> Incorrect
              </span>
            ))}
          <span>
            {question.points} {question.points === 1 ? "pt" : "pts"}
          </span>
        </span>
      </div>
      <div className="px-4 py-4">
        <p className="whitespace-pre-wrap text-sm text-canvas-grayDark">
          {question.prompt || <span className="italic text-gray-400">Untitled question</span>}
        </p>

        {question.type === "multiple_choice" && (
          <div className="mt-4 space-y-2">
            {choices.map((choice, choiceIndex) => {
              const selected = answer?.choiceIndex === choiceIndex;
              const isKey = review && revealKey && question.correctChoiceIndex === choiceIndex;
              const wrongPick =
                review && selected && question.correctChoiceIndex !== choiceIndex;
              return (
                <label
                  key={choiceIndex}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                    disabled ? "cursor-default" : "cursor-pointer hover:bg-gray-50"
                  } ${
                    isKey
                      ? "border-green-300 bg-green-50"
                      : wrongPick
                        ? "border-red-300 bg-red-50"
                        : selected
                          ? "border-canvas-blue bg-canvas-blueTint"
                          : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange({ questionId: question.id, choiceIndex })}
                    className="accent-canvas-blue"
                  />
                  <span className="text-canvas-grayDark">
                    {choice || <span className="italic text-gray-400">Empty choice</span>}
                  </span>
                  {isKey && <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />}
                  {wrongPick && <XCircle className="ml-auto h-4 w-4 text-red-600" />}
                </label>
              );
            })}
          </div>
        )}

        {question.type === "true_false" && (
          <div className="mt-4 space-y-2">
            {[true, false].map((val) => {
              const selected = answer?.trueFalse === val;
              const isKey = review && revealKey && question.correctTrueFalse === val;
              const wrongPick = review && selected && question.correctTrueFalse !== val;
              return (
                <label
                  key={String(val)}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                    disabled ? "cursor-default" : "cursor-pointer hover:bg-gray-50"
                  } ${
                    isKey
                      ? "border-green-300 bg-green-50"
                      : wrongPick
                        ? "border-red-300 bg-red-50"
                        : selected
                          ? "border-canvas-blue bg-canvas-blueTint"
                          : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange({ questionId: question.id, trueFalse: val })}
                    className="accent-canvas-blue"
                  />
                  <span className="text-canvas-grayDark">{val ? "True" : "False"}</span>
                  {isKey && <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />}
                  {wrongPick && <XCircle className="ml-auto h-4 w-4 text-red-600" />}
                </label>
              );
            })}
          </div>
        )}

        {question.type === "multiple_answers" && (
          <div className="mt-4 space-y-2">
            {!review && (
              <p className="mb-1 text-xs text-gray-500">Select all that apply.</p>
            )}
            {choices.map((choice, choiceIndex) => {
              const picked = (answer?.choiceIndices ?? []).includes(choiceIndex);
              const inKey = (question.correctChoiceIndices ?? []).includes(choiceIndex);
              const isKey = review && revealKey && inKey;
              const wrongPick = review && picked && !inKey;
              return (
                <label
                  key={choiceIndex}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                    disabled ? "cursor-default" : "cursor-pointer hover:bg-gray-50"
                  } ${
                    isKey
                      ? "border-green-300 bg-green-50"
                      : wrongPick
                        ? "border-red-300 bg-red-50"
                        : picked
                          ? "border-canvas-blue bg-canvas-blueTint"
                          : "border-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={picked}
                    disabled={disabled}
                    onChange={() => {
                      const set = new Set(answer?.choiceIndices ?? []);
                      if (set.has(choiceIndex)) set.delete(choiceIndex);
                      else set.add(choiceIndex);
                      onChange({
                        questionId: question.id,
                        choiceIndices: [...set].sort((a, b) => a - b),
                      });
                    }}
                    className="accent-canvas-blue"
                  />
                  <span className="text-canvas-grayDark">
                    {choice || <span className="italic text-gray-400">Empty choice</span>}
                  </span>
                  {isKey && <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />}
                  {wrongPick && <XCircle className="ml-auto h-4 w-4 text-red-600" />}
                </label>
              );
            })}
          </div>
        )}

        {question.type === "short_answer" && (
          <div className="mt-4">
            <input
              value={answer?.shortAnswer ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ questionId: question.id, shortAnswer: e.target.value })}
              placeholder="Type your answer"
              className="form-input disabled:bg-gray-50"
            />
            {review && revealKey && question.correctShortAnswer && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">Expected answer:</span> {question.correctShortAnswer}
              </p>
            )}
          </div>
        )}

        {question.type === "fill_in_blank" && (
          <div className="mt-4">
            <input
              value={answer?.shortAnswer ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ questionId: question.id, shortAnswer: e.target.value })}
              placeholder="Type your answer"
              className="form-input disabled:bg-gray-50"
            />
            {review && revealKey && (question.acceptedAnswers ?? []).some((a) => a.trim()) && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">Accepted:</span>{" "}
                {(question.acceptedAnswers ?? []).filter((a) => a.trim()).join(", ")}
              </p>
            )}
          </div>
        )}

        {question.type === "numerical" && (
          <div className="mt-4">
            <input
              type="number"
              value={answer?.number ?? ""}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  questionId: question.id,
                  number: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="Enter a number"
              className="form-input max-w-xs disabled:bg-gray-50"
            />
            {review && revealKey && typeof question.correctNumber === "number" && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">Correct value:</span> {question.correctNumber}
                {question.tolerance ? ` (± ${question.tolerance})` : ""}
              </p>
            )}
          </div>
        )}

        {question.type === "matching" && (
          <div className="mt-4 space-y-2">
            {(() => {
              const rightOptions = [
                ...new Set(
                  (question.matchingPairs ?? []).map((p) => p.right).filter(Boolean),
                ),
              ].sort();
              return (question.matchingPairs ?? []).map((pair) => {
                const chosen = answer?.matches?.[pair.id] ?? "";
                const correct = review
                  ? chosen.trim().toLowerCase() === pair.right.trim().toLowerCase()
                  : undefined;
                return (
                  <div key={pair.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm text-canvas-grayDark">
                      {pair.left}
                    </span>
                    <span className="text-gray-400">→</span>
                    <select
                      value={chosen}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange({
                          questionId: question.id,
                          matches: { ...(answer?.matches ?? {}), [pair.id]: e.target.value },
                        })
                      }
                      className={`form-input max-w-[45%] ${
                        review
                          ? correct
                            ? "border-green-300 bg-green-50"
                            : "border-red-300 bg-red-50"
                          : ""
                      }`}
                    >
                      <option value="">Select…</option>
                      {rightOptions.map((r, i) => (
                        <option key={i} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {review &&
                      (correct ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                      ))}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {question.type === "essay" && (
          <div className="mt-4">
            <textarea
              value={answer?.shortAnswer ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ questionId: question.id, shortAnswer: e.target.value })}
              rows={5}
              placeholder="Write your response"
              className="form-input min-h-[120px] resize-y disabled:bg-gray-50"
            />
            {review && (
              <p className="mt-2 text-xs text-amber-600">
                This response will be graded manually.
              </p>
            )}
          </div>
        )}

        {review && question.feedback?.trim() && (
          <div className="mt-4 rounded-md border border-canvas-blue/30 bg-canvas-blueTint px-3 py-2">
            <p className="text-xs font-semibold text-canvas-blueDark">Feedback</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-canvas-grayDark">
              {question.feedback}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
