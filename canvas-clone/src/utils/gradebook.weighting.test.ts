import { describe, expect, it } from "vitest";
import {
  computeCourseOverallPercent,
  computeGroupPercents,
  computeUnweightedOverallPercent,
  computeWeightedOverallPercent,
  type WeightedScoreItem,
} from "./gradebook";
import type { AssignmentGroup } from "./coursesStore";

const homework: AssignmentGroup = { id: "ag_hw", name: "Homework", weight: 40 };
const exams: AssignmentGroup = { id: "ag_exams", name: "Exams", weight: 60 };

function item(
  patch: Partial<WeightedScoreItem> & Pick<WeightedScoreItem, "points" | "score">,
): WeightedScoreItem {
  return patch;
}

describe("assignment group weightage", () => {
  it("weights group percentages, not raw points", () => {
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 80 }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 50 }),
    ];
    // 0.8 * 40 + 0.5 * 60 = 62
    expect(computeWeightedOverallPercent(items, [homework, exams])).toBe(62);
    expect(
      computeCourseOverallPercent(items, [homework, exams], { weighted: true }),
    ).toBe(62);
  });

  it("uses total points when weighted grading is off", () => {
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 80 }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 50 }),
    ];
    // (80 + 50) / 200 = 65
    expect(computeUnweightedOverallPercent(items, [homework, exams])).toBe(65);
    expect(
      computeCourseOverallPercent(items, [homework, exams], { weighted: false }),
    ).toBe(65);
  });

  it("puts mixed item kinds in the same custom group", () => {
    const items: WeightedScoreItem[] = [
      item({ id: "assignment:1", groupId: "ag_hw", points: 50, score: 50 }),
      item({ id: "quiz:1", groupId: "ag_hw", points: 50, score: 0 }),
      item({ id: "discussion:1", groupId: "ag_exams", points: 100, score: 100 }),
    ];
    // Homework 50% * 40 + Exams 100% * 60 = 80
    expect(computeWeightedOverallPercent(items, [homework, exams])).toBe(80);
    expect(computeGroupPercents(items, [homework, exams])).toEqual({
      ag_hw: 50,
      ag_exams: 100,
    });
  });

  it("excludes unweighted items from weighted overall", () => {
    const items: WeightedScoreItem[] = [
      item({ id: "a", points: 100, score: 100 }),
      item({ id: "b", groupId: "ag_exams", points: 100, score: 0 }),
    ];
    // Only exams (0%) count → 0; unweighted 100% is ignored
    expect(computeWeightedOverallPercent(items, [homework, exams])).toBe(0);
    // Total points still includes unweighted items: 100/200 = 50
    expect(computeUnweightedOverallPercent(items, [homework, exams])).toBe(50);
  });

  it("drops the lowest item in a group before averaging", () => {
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 100 }),
      item({ id: "hw2", groupId: "ag_hw", points: 100, score: 0 }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 100 }),
    ];
    const groups: AssignmentGroup[] = [
      { ...homework, dropLowest: 1 },
      exams,
    ];
    // Homework keeps 100%, exams 100% → 100
    expect(computeWeightedOverallPercent(items, groups)).toBe(100);
  });

  it("drops the highest item in a group before averaging", () => {
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 100 }),
      item({ id: "hw2", groupId: "ag_hw", points: 100, score: 40 }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 100 }),
    ];
    const groups: AssignmentGroup[] = [
      { ...homework, dropHighest: 1 },
      exams,
    ];
    // Homework keeps 40%, exams 100% → 16 + 60 = 76
    expect(computeWeightedOverallPercent(items, groups)).toBe(76);
  });

  it("never drops a protected item even when it is the lowest", () => {
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 100 }),
      item({ id: "hw2", groupId: "ag_hw", points: 100, score: 0 }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 100 }),
    ];
    const groups: AssignmentGroup[] = [
      { ...homework, dropLowest: 1, neverDropIds: ["hw2"] },
      exams,
    ];
    // Drops hw1 instead, homework 0%, exams 100% → 60
    expect(computeWeightedOverallPercent(items, groups)).toBe(60);
  });

  it("adds extra-credit items to earned points without increasing possible", () => {
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 80 }),
      item({
        id: "hw_ec",
        groupId: "ag_hw",
        points: 10,
        score: 10,
        extraCredit: true,
      }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 50 }),
    ];
    // Homework (90/100)=90% * 40 + 50% * 60 = 66
    expect(computeWeightedOverallPercent(items, [homework, exams])).toBe(66);
  });

  it("adds extra-credit groups on top of the weighted total", () => {
    const bonus: AssignmentGroup = {
      id: "ag_bonus",
      name: "Bonus",
      weight: 10,
      extraCredit: true,
    };
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 100 }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 100 }),
      item({ id: "bonus1", groupId: "ag_bonus", points: 100, score: 100 }),
    ];
    // 100 + 10 = 110
    expect(computeWeightedOverallPercent(items, [homework, exams, bonus])).toBe(110);
  });

  it("does not normalize regular weights when extra credit pushes the displayed total over 100", () => {
    const assignments: AssignmentGroup = {
      id: "ag_assignments",
      name: "Assignments",
      weight: 100,
    };
    const bonus: AssignmentGroup = {
      id: "ag_bonus",
      name: "Test",
      weight: 1,
      extraCredit: true,
    };
    const items: WeightedScoreItem[] = [
      item({ id: "a1", groupId: "ag_assignments", points: 100, score: 100 }),
      item({ id: "b1", groupId: "ag_bonus", points: 100, score: 100 }),
    ];
    // Must stay 101 — not divide by 101 (≈100)
    expect(computeWeightedOverallPercent(items, [assignments, bonus])).toBe(101);
  });

  it("excludes 0-weight groups from weighted overall but includes them when unweighted", () => {
    const practice: AssignmentGroup = { id: "ag_practice", name: "Practice", weight: 0 };
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 100 }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 100 }),
      item({ id: "p1", groupId: "ag_practice", points: 100, score: 0 }),
    ];
    const groups = [homework, exams, practice];
    expect(computeWeightedOverallPercent(items, groups)).toBe(100);
    expect(computeUnweightedOverallPercent(items, groups)).toBe(67);
  });

  it("normalizes weights that do not sum to 100", () => {
    const groups: AssignmentGroup[] = [
      { id: "ag_hw", name: "Homework", weight: 1 },
      { id: "ag_exams", name: "Exams", weight: 1 },
    ];
    const items: WeightedScoreItem[] = [
      item({ id: "hw1", groupId: "ag_hw", points: 100, score: 100 }),
      item({ id: "exam1", groupId: "ag_exams", points: 100, score: 0 }),
    ];
    // Equal weights → 50
    expect(computeWeightedOverallPercent(items, groups)).toBe(50);
  });
});
