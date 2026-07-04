export type RubricRatingDef = {
  id: string;
  label: string;
  /** Points awarded when this rating is selected. */
  points: number;
};

export type RubricCriterionDef = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  points: number;
  ratings: RubricRatingDef[];
};

export type RubricAssessment = {
  criterionId: string;
  ratingId: string;
  earned: number;
};

export function buildAssignmentRubric(maxPoints: number): RubricCriterionDef[] {
  const weights = [
    { id: "1", title: "Task 1", desc: "Create a title and introduction", weight: 0.1 },
    { id: "2a", title: "Task 2A Calculations", desc: "Show calculations with correct methodology", weight: 0.2 },
    { id: "2b", title: "Task 2B", desc: "Complete secondary analysis", weight: 0.15 },
    { id: "3", title: "Task 3", desc: "Present results clearly", weight: 0.2 },
    { id: "5", title: "Task 5", desc: "Final presentation and formatting", weight: 0.2 },
  ];

  return weights.map((row) => {
    const points = Math.max(1, Math.round(maxPoints * row.weight));
    const partial = Math.round(points * 0.625);
    const minimal = Math.round(points * 0.25);
    return {
      id: row.id,
      title: row.title,
      description: `${row.title}: ${row.desc}`,
      longDescription: `${row.desc}. Review completeness, clarity, and accuracy for this criterion.`,
      points,
      ratings: [
        { id: `${row.id}-full`, label: "Full Marks", points },
        { id: `${row.id}-partial`, label: "Showed work made small error", points: partial },
        { id: `${row.id}-minor`, label: "Minor Calculation or Presentation Error", points: partial },
        { id: `${row.id}-none`, label: "No Marks", points: minimal },
      ],
    };
  });
}

export function sumRubricAssessments(assessments: RubricAssessment[]): number {
  return assessments.reduce((sum, row) => sum + row.earned, 0);
}

export function assessmentsFromScore(
  rubric: RubricCriterionDef[],
  score: number,
): RubricAssessment[] {
  let remaining = Math.max(0, score);
  return rubric.map((criterion, index) => {
    const isPartial = index === 1 || index === 4;
    const earned = isPartial
      ? Math.min(criterion.points, Math.round(criterion.points * 0.625))
      : Math.min(criterion.points, Math.max(0, remaining));
    remaining -= earned;
    const rating =
      earned >= criterion.points
        ? criterion.ratings[0]
        : earned === 0
          ? criterion.ratings[criterion.ratings.length - 1]
          : criterion.ratings[1] ?? criterion.ratings[0];
    return {
      criterionId: criterion.id,
      ratingId: rating!.id,
      earned,
    };
  });
}

export function defaultAssessments(
  rubric: RubricCriterionDef[],
  existing?: RubricAssessment[],
): RubricAssessment[] {
  if (existing?.length) {
    return rubric.map((criterion) => {
      const saved = existing.find((a) => a.criterionId === criterion.id);
      if (saved) return saved;
      return {
        criterionId: criterion.id,
        ratingId: criterion.ratings[0]!.id,
        earned: criterion.ratings[0]!.points,
      };
    });
  }
  return rubric.map((criterion) => ({
    criterionId: criterion.id,
    ratingId: criterion.ratings[0]!.id,
    earned: criterion.ratings[0]!.points,
  }));
}

export function getAssessmentForCriterion(
  assessments: RubricAssessment[],
  criterionId: string,
): RubricAssessment | undefined {
  return assessments.find((a) => a.criterionId === criterionId);
}

export function ratingLabelForAssessment(
  rubric: RubricCriterionDef[],
  assessment: RubricAssessment,
): string {
  const criterion = rubric.find((c) => c.id === assessment.criterionId);
  const rating = criterion?.ratings.find((r) => r.id === assessment.ratingId);
  if (rating) return rating.label;
  if (assessment.earned >= (criterion?.points ?? 0)) return "Full Marks";
  if (assessment.earned <= 0) return "No Marks";
  return "Partial credit";
}
