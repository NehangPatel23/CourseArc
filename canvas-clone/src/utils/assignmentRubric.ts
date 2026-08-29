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

/** Start every criterion at No Marks (0) — preferred for ungraded quiz essays. */
export function emptyRubricAssessments(rubric: RubricCriterionDef[]): RubricAssessment[] {
  return rubric.map((criterion) => {
    const none = criterion.ratings[criterion.ratings.length - 1] ?? {
      id: `${criterion.id}-none`,
      label: "No Marks",
      points: 0,
    };
    return {
      criterionId: criterion.id,
      ratingId: none.id,
      earned: 0,
    };
  });
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

/** Graduated ratings for an essay criterion (Excellent → Missing). */
export function essayRubricRatings(criterionId: string, points: number): RubricRatingDef[] {
  const pts = Math.max(0, Math.round(points));
  if (pts <= 0) {
    return [{ id: `${criterionId}-none`, label: "Missing", points: 0 }];
  }
  if (pts === 1) {
    return [
      { id: `${criterionId}-full`, label: "Meets", points: 1 },
      { id: `${criterionId}-none`, label: "Missing", points: 0 },
    ];
  }
  const proficient = Math.max(1, Math.round(pts * 0.75));
  const developing = Math.max(1, Math.round(pts * 0.5));
  const beginning = Math.max(0, Math.round(pts * 0.25));
  const ratings: RubricRatingDef[] = [
    { id: `${criterionId}-excellent`, label: "Excellent", points: pts },
    { id: `${criterionId}-proficient`, label: "Proficient", points: proficient },
    { id: `${criterionId}-developing`, label: "Developing", points: developing },
  ];
  if (beginning > 0 && beginning < developing) {
    ratings.push({
      id: `${criterionId}-beginning`,
      label: "Beginning",
      points: beginning,
    });
  }
  ratings.push({ id: `${criterionId}-none`, label: "Missing", points: 0 });
  const seen = new Set<number>();
  return ratings.filter((r) => {
    if (seen.has(r.points)) return false;
    seen.add(r.points);
    return true;
  });
}

export function createEssayRubricCriterion(
  title = "Criterion",
  points = 1,
  opts?: { description?: string; longDescription?: string },
): RubricCriterionDef {
  const id = `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const pts = Math.max(0, Math.round(points));
  const description = (opts?.description ?? title).trim() || title;
  return {
    id,
    title,
    description,
    longDescription: (opts?.longDescription ?? "").trim(),
    points: pts,
    ratings: essayRubricRatings(id, pts),
  };
}

type EssayRubricTemplateRow = {
  title: string;
  description: string;
  longDescription: string;
  weight: number;
};

/** Suggested academic essay criteria (weights sum to 1). */
const DEFAULT_ESSAY_RUBRIC_TEMPLATE: EssayRubricTemplateRow[] = [
  {
    title: "Addresses the prompt",
    description: "Directly answers the question and covers required parts",
    longDescription:
      "Fully responds to every part of the prompt. Stays on topic, interprets the question correctly, and does not substitute an unrelated essay for the assigned task.",
    weight: 0.2,
  },
  {
    title: "Thesis & claim",
    description: "Clear controlling idea or position",
    longDescription:
      "States a focused thesis or claim early and maintains it. The reader can tell what the writer is arguing or explaining without guessing.",
    weight: 0.15,
  },
  {
    title: "Evidence & examples",
    description: "Relevant support from course material or reasoning",
    longDescription:
      "Uses specific, accurate evidence (examples, data, quotes, or worked cases). Support is relevant to the claim and sufficient to persuade a knowledgeable reader.",
    weight: 0.2,
  },
  {
    title: "Analysis & reasoning",
    description: "Explains how evidence supports the claim",
    longDescription:
      "Goes beyond listing facts: interprets evidence, connects ideas, weighs alternatives, and shows why the conclusion follows. Demonstrates depth appropriate to the course level.",
    weight: 0.2,
  },
  {
    title: "Organization & structure",
    description: "Logical flow with coherent paragraphs",
    longDescription:
      "Introduction, body, and conclusion (or equivalent structure) are easy to follow. Paragraphs have clear focus; transitions guide the reader between ideas.",
    weight: 0.15,
  },
  {
    title: "Clarity & conventions",
    description: "Readable prose, terminology, and mechanics",
    longDescription:
      "Writing is clear and mostly free of distracting grammar, spelling, or punctuation errors. Uses course vocabulary accurately; tone fits an academic response.",
    weight: 0.1,
  },
];

/** Allocate whole-number points across weights so the sum equals `total`. */
function allocateWeightedPoints(weights: number[], total: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeTotal = Math.max(1, Math.round(total) || 1);
  const weightSum = weights.reduce((s, w) => s + w, 0) || 1;
  const exact = weights.map((w) => (w / weightSum) * safeTotal);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = safeTotal - floors.reduce((a, b) => a + b, 0);
  const byFrac = exact
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const pts = [...floors];
  for (let k = 0; k < remainder && k < byFrac.length; k++) {
    pts[byFrac[k].i] += 1;
  }
  if (safeTotal >= n) {
    for (let i = 0; i < n; i++) {
      if (pts[i] === 0) {
        const donor = pts.indexOf(Math.max(...pts));
        if (donor >= 0 && pts[donor] > 1) {
          pts[donor] -= 1;
          pts[i] = 1;
        }
      }
    }
  }
  return pts;
}

/**
 * Suggested multi-criterion essay rubric scaled to the question's points.
 * Always includes the full academic template. When the question is worth fewer
 * points than there are criteria, scales to one point per criterion so every
 * row is usable (editor warns if rubric total ≠ question points).
 */
export function createDefaultEssayRubric(totalPoints: number): RubricCriterionDef[] {
  const template = DEFAULT_ESSAY_RUBRIC_TEMPLATE;
  const requested = Math.max(1, Math.round(totalPoints) || 1);
  const total = Math.max(requested, template.length);

  const points = allocateWeightedPoints(
    template.map((r) => r.weight),
    total,
  );

  return template.map((row, i) =>
    createEssayRubricCriterion(row.title, points[i] ?? 1, {
      description: row.description,
      longDescription: row.longDescription,
    }),
  );
}

export function sumRubricMaxPoints(rubric: RubricCriterionDef[]): number {
  return rubric.reduce((sum, c) => sum + (c.points > 0 ? c.points : 0), 0);
}

/** Normalize instructor-authored essay rubrics; empty → undefined. */
export function normalizeEssayRubric(
  rubric?: RubricCriterionDef[] | null,
): RubricCriterionDef[] | undefined {
  if (!Array.isArray(rubric) || rubric.length === 0) return undefined;
  const cleaned = rubric
    .filter((c) => c && typeof c.title === "string" && c.title.trim() !== "")
    .map((c) => {
      const id =
        typeof c.id === "string" && c.id.trim()
          ? c.id
          : createEssayRubricCriterion().id;
      const points = Math.max(0, Math.round(Number(c.points) || 0));
      const ratings =
        Array.isArray(c.ratings) && c.ratings.length > 0
          ? c.ratings.map((r, i) => ({
              id:
                typeof r?.id === "string" && r.id.trim()
                  ? r.id
                  : `${id}-r${i}`,
              label: (r?.label ?? `Rating ${i + 1}`).trim() || `Rating ${i + 1}`,
              points: Math.max(0, Math.round(Number(r?.points) || 0)),
            }))
          : essayRubricRatings(id, points);
      return {
        id,
        title: c.title.trim(),
        description: (c.description || c.title).trim(),
        longDescription: (c.longDescription || "").trim(),
        points,
        ratings,
      };
    });
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Keep Full/Partial/None ratings in sync when criterion points change. */
export function withEssayCriterionPoints(
  criterion: RubricCriterionDef,
  points: number,
): RubricCriterionDef {
  const pts = Math.max(0, Math.round(points));
  return {
    ...criterion,
    points: pts,
    ratings: essayRubricRatings(criterion.id, pts),
  };
}
