import { describe, expect, it } from "vitest";
import { createQuizQuestion, type Quiz } from "./quizzes";
import {
  describePartialCredit,
  editDistance,
  resolveNearMatchThreshold,
  scoreQuestionAnswer,
} from "./quizSubmissions";

function baseQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: "quiz_test",
    title: "Partial credit test",
    partialCredit: true,
    ...overrides,
  };
}

describe("editDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(editDistance("stack", "stack")).toBe(0);
  });

  it("counts single substitutions/insertions", () => {
    expect(editDistance("stack", "stuck")).toBe(1);
    expect(editDistance("cat", "cats")).toBe(1);
  });
});

describe("resolveNearMatchThreshold", () => {
  it("defaults to 0.5", () => {
    expect(resolveNearMatchThreshold(baseQuiz({ nearMatchThreshold: undefined }))).toBe(0.5);
  });

  it("uses quiz then question override", () => {
    const quiz = baseQuiz({ nearMatchThreshold: 0.7 });
    expect(resolveNearMatchThreshold(quiz)).toBe(0.7);
    const q = createQuizQuestion("short_answer");
    q.nearMatchThreshold = 0.8;
    expect(resolveNearMatchThreshold(quiz, q)).toBe(0.8);
  });

  it("clamps to [0, 1]", () => {
    expect(resolveNearMatchThreshold(baseQuiz({ nearMatchThreshold: 2 }))).toBe(1);
    expect(resolveNearMatchThreshold(baseQuiz({ nearMatchThreshold: -1 }))).toBe(0);
  });
});

describe("scoreQuestionAnswer — numerical bands", () => {
  it("awards full credit inside tolerance", () => {
    const quiz = baseQuiz();
    const q = createQuizQuestion("numerical");
    q.points = 4;
    q.correctNumber = 10;
    q.tolerance = 0.5;
    q.partialTolerance = 2;
    const credit = scoreQuestionAnswer(quiz, q, { questionId: q.id, number: 10.4 });
    expect(credit).toMatchObject({ correct: true, partial: false, earned: 4 });
  });

  it("awards linear partial between tolerance and partialTolerance", () => {
    const quiz = baseQuiz();
    const q = createQuizQuestion("numerical");
    q.points = 4;
    q.correctNumber = 10;
    q.tolerance = 0;
    q.partialTolerance = 2;
    // dist 1 → halfway → 50% of 4 = 2
    const credit = scoreQuestionAnswer(quiz, q, { questionId: q.id, number: 11 });
    expect(credit.correct).toBe(false);
    expect(credit.partial).toBe(true);
    expect(credit.earned).toBe(2);
  });

  it("awards zero outside partial band", () => {
    const quiz = baseQuiz();
    const q = createQuizQuestion("numerical");
    q.points = 4;
    q.correctNumber = 10;
    q.tolerance = 0.5;
    q.partialTolerance = 2;
    const credit = scoreQuestionAnswer(quiz, q, { questionId: q.id, number: 13 });
    expect(credit).toMatchObject({ correct: false, partial: false, earned: 0 });
  });
});

describe("scoreQuestionAnswer — text near-match", () => {
  it("awards full credit for exact fill-in answers", () => {
    const quiz = baseQuiz();
    const q = createQuizQuestion("fill_in_blank");
    q.points = 2;
    q.acceptedAnswers = ["O(log n)", "log n"];
    const credit = scoreQuestionAnswer(quiz, q, {
      questionId: q.id,
      shortAnswer: "O(log n)",
    });
    expect(credit).toMatchObject({ correct: true, partial: false, earned: 2 });
  });

  it("awards partial for near matches at/above threshold", () => {
    const quiz = baseQuiz({ nearMatchThreshold: 0.5 });
    const q = createQuizQuestion("short_answer");
    q.points = 10;
    q.correctShortAnswer = "stack";
    // "stuck" is 1/5 = 0.8 similar
    const credit = scoreQuestionAnswer(quiz, q, {
      questionId: q.id,
      shortAnswer: "stuck",
    });
    expect(credit.correct).toBe(false);
    expect(credit.partial).toBe(true);
    expect(credit.earned).toBe(8);
  });

  it("awards zero below the configured threshold", () => {
    const quiz = baseQuiz({ nearMatchThreshold: 0.9 });
    const q = createQuizQuestion("short_answer");
    q.points = 10;
    q.correctShortAnswer = "stack";
    const credit = scoreQuestionAnswer(quiz, q, {
      questionId: q.id,
      shortAnswer: "stuck",
    });
    expect(credit).toMatchObject({ correct: false, partial: false, earned: 0 });
  });
});

describe("scoreQuestionAnswer — multiple answers + penalty", () => {
  it("awards proportional credit without penalty", () => {
    const quiz = baseQuiz({ partialCreditPenalty: false });
    const q = createQuizQuestion("multiple_answers");
    q.points = 4;
    q.choices = ["A", "B", "C", "D"];
    q.correctChoiceIndices = [0, 1];
    const credit = scoreQuestionAnswer(quiz, q, {
      questionId: q.id,
      choiceIndices: [0],
    });
    expect(credit).toMatchObject({ correct: false, partial: true, earned: 2 });
  });

  it("subtracts wrong picks when penalty is on", () => {
    const quiz = baseQuiz({ partialCreditPenalty: true });
    const q = createQuizQuestion("multiple_answers");
    q.points = 4;
    q.choices = ["A", "B", "C", "D"];
    q.correctChoiceIndices = [0, 1];
    // 1 right, 1 wrong → (1-1)/2 = 0
    const credit = scoreQuestionAnswer(quiz, q, {
      questionId: q.id,
      choiceIndices: [0, 2],
    });
    expect(credit).toMatchObject({ correct: false, partial: false, earned: 0 });
  });
});

describe("describePartialCredit", () => {
  it("mentions shuffle fairness for matching when answers are shuffled", () => {
    const quiz = baseQuiz({ shuffleAnswers: true });
    const q = createQuizQuestion("matching");
    q.points = 2;
    q.matchingPairs = [
      { id: "p1", left: "LIFO", right: "Stack" },
      { id: "p2", left: "FIFO", right: "Queue" },
    ];
    const note = describePartialCredit(quiz, q, {
      questionId: q.id,
      matches: { p1: "Stack", p2: "Heap" },
    });
    expect(note).toMatch(/1 of 2 pairs matched/i);
    expect(note).toMatch(/shuffled/i);
    expect(note).toMatch(/pair content/i);
  });
});
