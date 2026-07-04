import { Check, ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import {
  createMatchingPair,
  createQuizQuestion,
  QUIZ_QUESTION_TYPE_LABELS,
  totalQuizQuestionPoints,
  type MatchingPair,
  type QuizQuestion,
  type QuizQuestionType,
} from "../utils/quizzes";

type Props = {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
};

const QUESTION_TYPES = Object.keys(QUIZ_QUESTION_TYPE_LABELS) as QuizQuestionType[];

export default function QuizQuestionsEditor({ questions, onChange }: Props) {
  const addQuestion = () => {
    onChange([...questions, createQuizQuestion("multiple_choice")]);
  };

  const addQuestionBelow = (index: number) => {
    const next = [...questions];
    next.splice(index + 1, 0, createQuizQuestion("multiple_choice"));
    onChange(next);
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const updateQuestion = (id: string, patch: Partial<QuizQuestion>) => {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
  };

  const changeType = (question: QuizQuestion, type: QuizQuestionType) => {
    const replacement = createQuizQuestion(type);
    onChange(
      questions.map((q) =>
        q.id === question.id
          ? { ...replacement, id: q.id, prompt: q.prompt, points: q.points }
          : q,
      ),
    );
  };

  const updateChoice = (question: QuizQuestion, index: number, value: string) => {
    const choices = [...(question.choices ?? [])];
    choices[index] = value;
    updateQuestion(question.id, { choices });
  };

  const addChoice = (question: QuizQuestion) => {
    updateQuestion(question.id, { choices: [...(question.choices ?? []), ""] });
  };

  const removeChoice = (question: QuizQuestion, index: number) => {
    const choices = (question.choices ?? []).filter((_, i) => i !== index);
    const patch: Partial<QuizQuestion> = { choices };
    if (question.type === "multiple_choice") {
      const cur = question.correctChoiceIndex ?? 0;
      patch.correctChoiceIndex = cur === index ? 0 : cur > index ? cur - 1 : cur;
    } else if (question.type === "multiple_answers") {
      patch.correctChoiceIndices = (question.correctChoiceIndices ?? [])
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i));
    }
    updateQuestion(question.id, patch);
  };

  const toggleCorrectIndex = (question: QuizQuestion, index: number) => {
    const set = new Set(question.correctChoiceIndices ?? []);
    if (set.has(index)) set.delete(index);
    else set.add(index);
    updateQuestion(question.id, {
      correctChoiceIndices: [...set].sort((a, b) => a - b),
    });
  };

  const updateAccepted = (question: QuizQuestion, index: number, value: string) => {
    const acceptedAnswers = [...(question.acceptedAnswers ?? [])];
    acceptedAnswers[index] = value;
    updateQuestion(question.id, { acceptedAnswers });
  };

  const addAccepted = (question: QuizQuestion) => {
    updateQuestion(question.id, {
      acceptedAnswers: [...(question.acceptedAnswers ?? []), ""],
    });
  };

  const removeAccepted = (question: QuizQuestion, index: number) => {
    updateQuestion(question.id, {
      acceptedAnswers: (question.acceptedAnswers ?? []).filter((_, i) => i !== index),
    });
  };

  const updatePair = (question: QuizQuestion, pairId: string, patch: Partial<MatchingPair>) => {
    updateQuestion(question.id, {
      matchingPairs: (question.matchingPairs ?? []).map((p) =>
        p.id === pairId ? { ...p, ...patch } : p,
      ),
    });
  };

  const addPair = (question: QuizQuestion) => {
    updateQuestion(question.id, {
      matchingPairs: [...(question.matchingPairs ?? []), createMatchingPair()],
    });
  };

  const removePair = (question: QuizQuestion, pairId: string) => {
    updateQuestion(question.id, {
      matchingPairs: (question.matchingPairs ?? []).filter((p) => p.id !== pairId),
    });
  };

  const pointsTotal = totalQuizQuestionPoints(questions);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="form-section-title">Questions</div>
          <p className="mt-1 text-sm text-gray-600">
            {questions.length} question{questions.length === 1 ? "" : "s"}
            {pointsTotal > 0 ? ` · ${pointsTotal} pts total` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="btn-canvas-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          Question
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
          No questions yet. Click "Question" to add one.
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-canvas-grayDark">
                  Question {index + 1}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, -1)}
                    disabled={index === 0}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === questions.length - 1}
                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => addQuestionBelow(index)}
                    className="rounded-md p-1.5 text-canvas-blue hover:bg-canvas-blueTint"
                    title="Add question below"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(question.id)}
                    className="rounded-md p-1.5 text-canvas-red hover:bg-red-50"
                    title="Remove question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                <div>
                  <div className="form-label">Type</div>
                  <select
                    value={question.type}
                    onChange={(e) => changeType(question, e.target.value as QuizQuestionType)}
                    className="form-input"
                  >
                    {QUESTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {QUIZ_QUESTION_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="form-label">Points</div>
                  <input
                    type="number"
                    min={0}
                    value={question.points}
                    onChange={(e) =>
                      updateQuestion(question.id, { points: Number(e.target.value) || 0 })
                    }
                    className="form-input h-10"
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="form-label">Question</div>
                <textarea
                  value={question.prompt}
                  onChange={(e) => updateQuestion(question.id, { prompt: e.target.value })}
                  placeholder="Enter the question prompt"
                  rows={3}
                  className="form-input min-h-[88px] resize-y"
                />
              </div>

              {(question.type === "multiple_choice" ||
                question.type === "multiple_answers") && (
                <div className="mt-3 space-y-2">
                  <div className="form-label">
                    Answer choices
                    <span className="ml-1 font-normal text-gray-400">
                      (
                      {question.type === "multiple_choice"
                        ? "select the one correct answer"
                        : "check all correct answers"}
                      )
                    </span>
                  </div>
                  {(question.choices ?? []).map((choice, choiceIndex) => {
                    const isCorrect =
                      question.type === "multiple_choice"
                        ? question.correctChoiceIndex === choiceIndex
                        : (question.correctChoiceIndices ?? []).includes(choiceIndex);
                    return (
                      <div key={choiceIndex} className="flex items-center gap-2">
                        <input
                          type={question.type === "multiple_choice" ? "radio" : "checkbox"}
                          name={`correct-${question.id}`}
                          checked={isCorrect}
                          onChange={() =>
                            question.type === "multiple_choice"
                              ? updateQuestion(question.id, {
                                  correctChoiceIndex: choiceIndex,
                                })
                              : toggleCorrectIndex(question, choiceIndex)
                          }
                          title="Mark correct"
                          className="accent-canvas-green"
                        />
                        <input
                          value={choice}
                          onChange={(e) => updateChoice(question, choiceIndex, e.target.value)}
                          placeholder={`Choice ${choiceIndex + 1}`}
                          className={`form-input ${
                            isCorrect ? "border-green-300 bg-green-50" : ""
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => removeChoice(question, choiceIndex)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                          title="Remove choice"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addChoice(question)}
                    className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add choice
                  </button>
                </div>
              )}

              {question.type === "true_false" && (
                <div className="mt-3">
                  <div className="form-label">Correct answer</div>
                  <div className="flex gap-4 text-sm">
                    <label className="form-checkbox-label">
                      <input
                        type="radio"
                        name={`tf-${question.id}`}
                        checked={question.correctTrueFalse === true}
                        onChange={() => updateQuestion(question.id, { correctTrueFalse: true })}
                        className="accent-canvas-green"
                      />
                      True
                    </label>
                    <label className="form-checkbox-label">
                      <input
                        type="radio"
                        name={`tf-${question.id}`}
                        checked={question.correctTrueFalse === false}
                        onChange={() => updateQuestion(question.id, { correctTrueFalse: false })}
                        className="accent-canvas-green"
                      />
                      False
                    </label>
                  </div>
                </div>
              )}

              {question.type === "short_answer" && (
                <div className="mt-3">
                  <div className="form-label">Expected answer</div>
                  <input
                    value={question.correctShortAnswer ?? ""}
                    onChange={(e) =>
                      updateQuestion(question.id, { correctShortAnswer: e.target.value })
                    }
                    placeholder="Correct answer (case-insensitive)"
                    className="form-input"
                  />
                </div>
              )}

              {question.type === "fill_in_blank" && (
                <div className="mt-3 space-y-2">
                  <div className="form-label">
                    Accepted answers
                    <span className="ml-1 font-normal text-gray-400">
                      (any match counts as correct)
                    </span>
                  </div>
                  {(question.acceptedAnswers ?? []).map((value, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-canvas-green" />
                      <input
                        value={value}
                        onChange={(e) => updateAccepted(question, i, e.target.value)}
                        placeholder={`Accepted answer ${i + 1}`}
                        className="form-input"
                      />
                      <button
                        type="button"
                        onClick={() => removeAccepted(question, i)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addAccepted(question)}
                    className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add accepted answer
                  </button>
                </div>
              )}

              {question.type === "numerical" && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="form-label">Correct value</div>
                    <input
                      type="number"
                      value={question.correctNumber ?? 0}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          correctNumber: Number(e.target.value),
                        })
                      }
                      className="form-input h-10"
                    />
                  </div>
                  <div>
                    <div className="form-label">Margin of error (±)</div>
                    <input
                      type="number"
                      min={0}
                      value={question.tolerance ?? 0}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          tolerance: Math.abs(Number(e.target.value)) || 0,
                        })
                      }
                      className="form-input h-10"
                    />
                  </div>
                </div>
              )}

              {question.type === "matching" && (
                <div className="mt-3 space-y-2">
                  <div className="form-label">
                    Matching pairs
                    <span className="ml-1 font-normal text-gray-400">
                      (students match left to right)
                    </span>
                  </div>
                  {(question.matchingPairs ?? []).map((pair) => (
                    <div key={pair.id} className="flex items-center gap-2">
                      <input
                        value={pair.left}
                        onChange={(e) => updatePair(question, pair.id, { left: e.target.value })}
                        placeholder="Left"
                        className="form-input"
                      />
                      <span className="text-gray-400">→</span>
                      <input
                        value={pair.right}
                        onChange={(e) => updatePair(question, pair.id, { right: e.target.value })}
                        placeholder="Right (match)"
                        className="form-input"
                      />
                      <button
                        type="button"
                        onClick={() => removePair(question, pair.id)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-canvas-red"
                        title="Remove pair"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addPair(question)}
                    className="inline-flex items-center gap-1 text-sm text-canvas-blue hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add pair
                  </button>
                </div>
              )}

              {question.type === "essay" && (
                <div className="mt-3 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
                  Essay questions are graded manually in GradePro. There is no answer key.
                </div>
              )}

              <div className="mt-3">
                <label className="form-label">Feedback (shown after grading)</label>
                <textarea
                  value={question.feedback ?? ""}
                  onChange={(e) => updateQuestion(question.id, { feedback: e.target.value })}
                  rows={2}
                  placeholder="Optional note shown to students once the quiz is graded"
                  className="form-input resize-y"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
