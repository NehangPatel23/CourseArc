import { describe, expect, it } from "vitest";
import { createQuizQuestion, type Quiz } from "./quizzes";
import {
  gradeQuizAttempt,
  isAnswerCorrect,
  isEssayCommentMissing,
  questionRequiresEssayComment,
} from "./quizSubmissions";

describe("phase 7 question grading", () => {
  const baseQuiz: Quiz = {
    id: "q1",
    title: "Phase 7",
    points: 10,
    questions: [],
  };

  it("grades ordering with partial positions", () => {
    const q = {
      ...createQuizQuestion("ordering"),
      orderingItems: ["A", "B", "C"],
      correctOrder: [0, 1, 2],
      points: 3,
    };
    const correct = gradeQuizAttempt(baseQuiz, [{ questionId: q.id, ordering: [0, 1, 2] }], [q]);
    const partial = gradeQuizAttempt(
      { ...baseQuiz, partialCredit: true },
      [{ questionId: q.id, ordering: [0, 2, 1] }],
      [q],
    );
    expect(correct.perQuestion[0]?.correct).toBe(true);
    expect(partial.perQuestion[0]?.partial).toBe(true);
  });

  it("grades fill-in-multiple-blanks", () => {
    const q = {
      ...createQuizQuestion("fill_in_multiple_blanks"),
      fillBlanks: [
        { id: "a", label: "a", acceptedAnswers: ["foo"] },
        { id: "b", label: "b", acceptedAnswers: ["bar"] },
      ],
      points: 2,
    };
    expect(
      isAnswerCorrect(q, {
        questionId: q.id,
        blankAnswers: { a: "foo", b: "bar" },
      }),
    ).toBe(true);
    expect(
      isAnswerCorrect(q, {
        questionId: q.id,
        blankAnswers: { a: "foo", b: "wrong" },
      }),
    ).toBe(false);
  });

  it("grades likert against correct value", () => {
    const q = {
      ...createQuizQuestion("likert"),
      correctLikertValue: 4,
      points: 1,
    };
    expect(isAnswerCorrect(q, { questionId: q.id, likertValue: 4 })).toBe(true);
    expect(isAnswerCorrect(q, { questionId: q.id, likertValue: 2 })).toBe(false);
  });

  it("detects missing required essay comments", () => {
    const quiz: Quiz = { ...baseQuiz, requireEssayComment: true };
    const q = createQuizQuestion("essay");
    expect(questionRequiresEssayComment(quiz, q)).toBe(true);
    expect(
      isEssayCommentMissing(quiz, q, { questionId: q.id, shortAnswer: "Answer", essayComment: "" }),
    ).toBe(true);
    expect(
      isEssayCommentMissing(quiz, q, {
        questionId: q.id,
        shortAnswer: "Answer",
        essayComment: "My approach",
      }),
    ).toBe(false);
  });
});
