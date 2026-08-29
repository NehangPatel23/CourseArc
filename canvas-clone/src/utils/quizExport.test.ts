import { describe, expect, it } from "vitest";
import { exportBankToJson, parseBankJson } from "./questionBankImport";
import {
  exportQuizQuestionsToJson,
  exportQuizToJson,
  quizExportFilename,
} from "./quizExport";
import { createQuizQuestion, type Quiz } from "./quizzes";
import type { QuestionBank } from "./questionBanks";

describe("quiz JSON export", () => {
  it("exports questions that round-trip through parseBankJson", () => {
    const questions = [
      { ...createQuizQuestion("multiple_choice"), prompt: "2+2?", correctChoiceIndex: 0 },
      { ...createQuizQuestion("essay"), prompt: "Explain", points: 5 },
    ];
    const json = exportQuizQuestionsToJson("Unit quiz", questions);
    const parsed = parseBankJson(json);
    expect(parsed.title).toBe("Unit quiz");
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0]?.prompt).toBe("2+2?");
    expect(parsed.questions[1]?.type).toBe("essay");
  });

  it("includes quiz settings on full export", () => {
    const quiz: Quiz = {
      id: "q1",
      title: "Midterm",
      points: 20,
      quizType: "graded",
      timeLimitMinutes: 45,
      shuffleAnswers: true,
      partialCredit: true,
      questions: [createQuizQuestion("true_false")],
    };
    const payload = JSON.parse(exportQuizToJson(quiz));
    expect(payload.kind).toBe("quiz");
    expect(payload.settings.timeLimitMinutes).toBe(45);
    expect(payload.settings.shuffleAnswers).toBe(true);
    expect(payload.settings.partialCredit).toBe(true);
    expect(payload.questions).toHaveLength(1);
  });

  it("builds a safe download filename", () => {
    expect(quizExportFilename("CS 101 Midterm!")).toBe("cs-101-midterm.json");
    expect(quizExportFilename("   ")).toBe("quiz.json");
  });

  it("round-trips bank notes through JSON export", () => {
    const bank: QuestionBank = {
      id: "qb1",
      courseId: "c1",
      title: "Algorithms",
      notes: "Midterm pool — graph algorithms only.",
      audience: "sophomore",
      difficulty: "intermediate",
      examUse: "midterm",
      status: "ready",
      tags: ["graphs", "CS2"],
      questions: [{ ...createQuizQuestion("true_false"), prompt: "BFS is complete?" }],
      createdAt: 1,
      updatedAt: 1,
    };
    const parsed = parseBankJson(exportBankToJson(bank));
    expect(parsed.title).toBe("Algorithms");
    expect(parsed.notes).toBe("Midterm pool — graph algorithms only.");
    expect(parsed.audience).toBe("sophomore");
    expect(parsed.tags).toEqual(["graphs", "CS2"]);
    expect(parsed.questions).toHaveLength(1);
  });
});
