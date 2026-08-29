// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { summarizeQuizSettingsDiff } from "./quizSettingsDiff";
import type { Quiz } from "./quizzes";

describe("summarizeQuizSettingsDiff", () => {
  const base = {
    id: "quiz_1",
    title: "Quiz",
    createdAt: 1,
    updatedAt: 2,
    questions: [],
  } as Quiz;

  it("ignores id and other noise when missing from the patch", () => {
    const lines = summarizeQuizSettingsDiff(base, {
      title: "Quiz",
      shuffleAnswers: true,
    });
    expect(lines.find((l) => l.key === "id")).toBeUndefined();
    expect(lines.find((l) => l.key === "createdAt")).toBeUndefined();
  });

  it("labels Monaco overrides in plain language", () => {
    const lines = summarizeQuizSettingsDiff(base, { monacoEditor: true });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.label).toBe("Monaco code editor");
    expect(lines[0]!.before).toBe("Course default");
    expect(lines[0]!.after).toBe("Always Monaco");
  });

  it("summarizes soft originality without JSON", () => {
    const lines = summarizeQuizSettingsDiff(base, {
      softOriginality: {
        enabled: true,
        includeSelfAttempts: true,
        includeOtherQuizzes: false,
        normalizeCode: true,
        minMatchPercent: 5,
      },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.label).toBe("Soft originality");
    expect(lines[0]!.after).toContain("On");
    expect(lines[0]!.after).toContain("own attempts");
    expect(lines[0]!.after).not.toContain("{");
  });

  it("formats booleans as On/Off", () => {
    const lines = summarizeQuizSettingsDiff(
      { ...base, lockOnLeave: false },
      { lockOnLeave: true },
    );
    expect(lines[0]!.before).toBe("Off");
    expect(lines[0]!.after).toBe("On");
  });
});
