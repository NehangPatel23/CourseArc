import { describe, expect, it } from "vitest";
import { seededPickIds } from "./questionBanks";
import {
  collectQuizQuestionLookup,
  countInlineAttemptItems,
  createQuizQuestion,
  expandQuizQuestionGroups,
  flattenQuizQuestionItems,
  groupExpectedPoints,
  normalizeQuizQuestions,
  totalQuizQuestionPoints,
  type QuizQuestion,
} from "./quizzes";

function mc(id: string, points = 2): QuizQuestion {
  return {
    ...createQuizQuestion("multiple_choice"),
    id,
    prompt: id,
    points,
    choices: ["A", "B"],
    correctChoiceIndex: 0,
  };
}

describe("local question groups", () => {
  it("normalizes pickCount to the member pool size", () => {
    const group: QuizQuestion = {
      ...createQuizQuestion("group"),
      id: "g1",
      pickCount: 99,
      groupQuestions: [mc("a"), mc("b"), mc("c")],
    };
    const [normalized] = normalizeQuizQuestions([group]);
    expect(normalized.pickCount).toBe(3);
    expect(normalized.points).toBe(0);
  });

  it("expands a group with a seeded pick-N", () => {
    const group: QuizQuestion = {
      ...createQuizQuestion("group"),
      id: "g1",
      prompt: "Pool",
      pickCount: 2,
      groupQuestions: [mc("a"), mc("b"), mc("c"), mc("d")],
    };
    const fixed = mc("fixed", 1);
    const expanded = expandQuizQuestionGroups([fixed, group], "seed-1", seededPickIds);
    expect(expanded).toHaveLength(3);
    expect(expanded[0].id).toBe("fixed");
    expect(expanded.slice(1).every((q) => ["a", "b", "c", "d"].includes(q.id))).toBe(true);
    expect(new Set(expanded.slice(1).map((q) => q.id)).size).toBe(2);

    const again = expandQuizQuestionGroups([fixed, group], "seed-1", seededPickIds);
    expect(again.map((q) => q.id)).toEqual(expanded.map((q) => q.id));
  });

  it("counts attempt items and expected points from pickCount", () => {
    const group: QuizQuestion = {
      ...createQuizQuestion("group"),
      id: "g1",
      pickCount: 2,
      groupQuestions: [mc("a", 2), mc("b", 4), mc("c", 6)],
    };
    expect(countInlineAttemptItems([group])).toBe(2);
    // avg points = 4, pick 2 → 8
    expect(groupExpectedPoints(group)).toBe(8);
    expect(totalQuizQuestionPoints([group])).toBe(8);
  });

  it("flattens members for lookup / stats", () => {
    const group: QuizQuestion = {
      ...createQuizQuestion("group"),
      id: "g1",
      pickCount: 1,
      groupQuestions: [mc("a"), mc("b")],
    };
    const flat = flattenQuizQuestionItems([mc("top"), group]);
    expect(flat.map((q) => q.id)).toEqual(["top", "a", "b"]);
    const lookup = collectQuizQuestionLookup([group]);
    expect(lookup.has("g1")).toBe(true);
    expect(lookup.get("a")?.id).toBe("a");
  });
});
