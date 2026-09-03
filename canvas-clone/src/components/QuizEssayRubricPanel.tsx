import { useState } from "react";
import {
  emptyRubricAssessments,
  getAssessmentForCriterion,
  ratingLabelForAssessment,
  sumRubricAssessments,
  type RubricAssessment,
  type RubricCriterionDef,
} from "../utils/assignmentRubric";
import {
  deleteQuizRubricTemplate,
  listQuizRubricTemplates,
  saveQuizRubricTemplate,
} from "../utils/quizRubricTemplates";
import { notify } from "./ui/Toast";

type Props = {
  rubric: RubricCriterionDef[];
  assessments: RubricAssessment[];
  onChange: (assessments: RubricAssessment[]) => void;
  /** When true, ratings are display-only. */
  readOnly?: boolean;
  questionPoints?: number;
  /** Course id enables Load / Save rubric template library buttons. */
  courseId?: string;
  /** Called when a library template is applied (replaces criteria for grading). */
  onApplyTemplate?: (criteria: RubricCriterionDef[]) => void;
};

/**
 * Compact essay rubric grader for quiz GradePro (reuses assignment rubric types).
 */
export default function QuizEssayRubricPanel({
  rubric,
  assessments,
  onChange,
  readOnly = false,
  questionPoints,
  courseId,
  onApplyTemplate,
}: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [templatesTick, setTemplatesTick] = useState(0);
  const templates = courseId
    ? listQuizRubricTemplates(courseId)
    : [];
  void templatesTick;

  const total = sumRubricAssessments(assessments);
  const max = rubric.reduce((s, c) => s + (c.points > 0 ? c.points : 0), 0);

  const selectRating = (criterionId: string, ratingId: string, points: number) => {
    if (readOnly) return;
    const next = assessments.filter((a) => a.criterionId !== criterionId);
    next.push({ criterionId, ratingId, earned: points });
    onChange(next);
  };

  const updateEarned = (criterionId: string, earned: number) => {
    if (readOnly) return;
    const criterion = rubric.find((c) => c.id === criterionId);
    if (!criterion) return;
    const clamped = Math.max(0, Math.min(criterion.points, Math.round(earned * 100) / 100));
    const rating =
      criterion.ratings.find((r) => r.points === clamped) ??
      criterion.ratings.find((r) => r.points <= clamped) ??
      criterion.ratings[criterion.ratings.length - 1];
    const next = assessments.filter((a) => a.criterionId !== criterionId);
    next.push({
      criterionId,
      ratingId: rating?.id ?? `${criterionId}-custom`,
      earned: clamped,
    });
    onChange(next);
  };

  const handleSaveTemplate = () => {
    if (!courseId || rubric.length === 0) return;
    const title = window.prompt("Template name", "Essay rubric")?.trim();
    if (!title) return;
    saveQuizRubricTemplate(courseId, { title, criteria: rubric });
    setTemplatesTick((n) => n + 1);
    notify("Rubric template saved", "grading");
  };

  const handleLoadTemplate = (id: string) => {
    if (!courseId || !onApplyTemplate) return;
    const row = listQuizRubricTemplates(courseId).find((t) => t.id === id);
    if (!row) return;
    onApplyTemplate(row.criteria);
    onChange(emptyRubricAssessments(row.criteria));
    setLibraryOpen(false);
    notify("Rubric template loaded", "grading");
  };

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-canvas-border bg-arc-paper text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-canvas-border bg-gray-50 px-3 py-2">
        <span className="font-semibold text-canvas-grayDark">Essay rubric</span>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && courseId && onApplyTemplate && (
            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLibraryOpen((o) => !o)}
                className="text-[11px] font-medium text-canvas-blue hover:underline"
              >
                Load from library
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="text-[11px] font-medium text-canvas-blue hover:underline"
              >
                Save as template
              </button>
              {libraryOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-gray-200 bg-arc-paper py-1 shadow-md">
                  {templates.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-gray-500">No saved templates.</p>
                  ) : (
                    templates.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50"
                      >
                        <button
                          type="button"
                          onClick={() => handleLoadTemplate(t.id)}
                          className="min-w-0 flex-1 truncate text-left text-[11px] text-canvas-grayDark"
                        >
                          {t.title}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete template ${t.title}`}
                          onClick={() => {
                            deleteQuizRubricTemplate(courseId, t.id);
                            setTemplatesTick((n) => n + 1);
                            notify("Rubric template deleted", "grading");
                          }}
                          className="shrink-0 px-1 text-[10px] text-gray-400 hover:text-canvas-red"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          <span className="tabular-nums text-gray-600">
            {total} / {max} pts
            {typeof questionPoints === "number" && questionPoints > 0 && max !== questionPoints ? (
              <span className="ml-1 text-amber-700">(question max {questionPoints})</span>
            ) : null}
          </span>
        </div>
      </div>
      <div className="divide-y divide-canvas-border">
        {rubric.map((criterion) => {
          const assessment = getAssessmentForCriterion(assessments, criterion.id) ?? {
            criterionId: criterion.id,
            ratingId: criterion.ratings[0]?.id ?? "",
            earned: 0,
          };
          const ratingLabel = ratingLabelForAssessment(rubric, assessment);
          return (
            <div key={criterion.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_1.1fr_72px]">
              <div>
                <p className="font-semibold text-canvas-grayDark">{criterion.title}</p>
                {criterion.description && criterion.description !== criterion.title ? (
                  <p className="mt-0.5 text-gray-500">{criterion.description}</p>
                ) : null}
              </div>
              <div>
                <p className="font-medium text-canvas-grayDark">{ratingLabel}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {criterion.ratings.map((rating) => (
                    <button
                      key={rating.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => selectRating(criterion.id, rating.id, rating.points)}
                      className={`rounded border px-1.5 py-0.5 text-[10px] disabled:cursor-default ${
                        assessment.ratingId === rating.id
                          ? "border-canvas-blue bg-canvas-blueTint text-canvas-blue"
                          : "border-gray-300 bg-arc-paper hover:bg-gray-50 disabled:hover:bg-arc-ivory"
                      }`}
                    >
                      {rating.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-right sm:pt-0.5">
                {readOnly ? (
                  <p className="font-medium tabular-nums text-canvas-grayDark">
                    {assessment.earned} / {criterion.points}
                  </p>
                ) : (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={criterion.points}
                      step={0.5}
                      value={assessment.earned}
                      onChange={(e) => updateEarned(criterion.id, Number(e.target.value))}
                      className="mb-0.5 w-14 rounded border border-gray-300 px-1 py-0.5 text-right text-xs"
                    />
                    <p className="text-gray-500">/ {criterion.points}</p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
