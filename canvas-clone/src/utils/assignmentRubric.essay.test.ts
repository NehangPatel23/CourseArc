import { describe, expect, it } from "vitest";
import {
  createDefaultEssayRubric,
  createEssayRubricCriterion,
  emptyRubricAssessments,
  normalizeEssayRubric,
  sumRubricAssessments,
  sumRubricMaxPoints,
  withEssayCriterionPoints,
} from "./assignmentRubric";

describe("essay quiz rubrics", () => {
  it("builds a suggested rubric that sums to the question points", () => {
    const rubric = createDefaultEssayRubric(10);
    expect(sumRubricMaxPoints(rubric)).toBe(10);
    expect(rubric.length).toBe(6);
    expect(rubric.map((c) => c.title)).toEqual([
      "Addresses the prompt",
      "Thesis & claim",
      "Evidence & examples",
      "Analysis & reasoning",
      "Organization & structure",
      "Clarity & conventions",
    ]);
    for (const c of rubric) {
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.longDescription.length).toBeGreaterThan(0);
      expect(c.ratings[0]?.points).toBe(c.points);
      expect(c.ratings[c.ratings.length - 1]?.points).toBe(0);
      expect(c.ratings.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("shrinks the template when the question is worth few points", () => {
    const rubric = createDefaultEssayRubric(3);
    expect(rubric.length).toBe(6);
    expect(sumRubricMaxPoints(rubric)).toBe(6);
  });

  it("resyncs ratings when criterion points change", () => {
    const c = createEssayRubricCriterion("Clarity", 4);
    const next = withEssayCriterionPoints(c, 8);
    expect(next.points).toBe(8);
    expect(next.ratings[0]?.label).toBe("Excellent");
    expect(next.ratings[0]?.points).toBe(8);
    expect(next.ratings[1]?.points).toBe(6); // proficient ~75%
  });

  it("normalizes empty or blank rubrics away", () => {
    expect(normalizeEssayRubric([])).toBeUndefined();
    expect(normalizeEssayRubric([{ ...createEssayRubricCriterion(" ", 2), title: "  " }])).toBeUndefined();
    const ok = normalizeEssayRubric([createEssayRubricCriterion("Content", 3)]);
    expect(ok?.[0]?.title).toBe("Content");
    expect(ok?.[0]?.points).toBe(3);
  });

  it("starts ungraded assessments at zero", () => {
    const rubric = createDefaultEssayRubric(5);
    const empty = emptyRubricAssessments(rubric);
    expect(sumRubricAssessments(empty)).toBe(0);
    expect(empty).toHaveLength(rubric.length);
  });
});
