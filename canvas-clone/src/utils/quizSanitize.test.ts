// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  createQuizQuestion,
  sanitizeQuestionForStudent,
  withCodeTestHashes,
} from "./quizzes";
import { hashNormalizedSource } from "./codeRunnerHtml";

describe("sanitize / hash (#163)", () => {
  it("withCodeTestHashes attaches expectedHash for runnable languages", () => {
    const tests = withCodeTestHashes("javascript", [
      { id: "t1", stdin: "1", expectedStdout: "2\n", hidden: false, weight: 1 },
    ]);
    expect(tests?.[0]?.expectedHash).toBeTruthy();
    expect(tests?.[0]?.expectedHash).toBe(hashNormalizedSource("2\n"));
  });

  it("sanitizeQuestionForStudent strips plaintext expectedStdout but keeps hash", () => {
    const q = createQuizQuestion("coding");
    q.language = "javascript";
    q.correctCode = "console.log(2)";
    q.codeTests = [
      { id: "t1", stdin: "", expectedStdout: "hello world", hidden: false, weight: 1 },
      {
        id: "t2",
        stdin: "secret-in",
        expectedStdout: "secret-out",
        hidden: true,
        weight: 1,
      },
    ];

    const sanitized = sanitizeQuestionForStudent(q);
    expect(sanitized.correctCode).toBeUndefined();
    expect(sanitized.codeTests?.[0]?.expectedStdout).toBe("");
    expect(sanitized.codeTests?.[0]?.expectedHash).toBe(
      hashNormalizedSource("hello world"),
    );
    expect(sanitized.codeTests?.[1]?.stdin).toBe("");
    expect(sanitized.codeTests?.[1]?.expectedStdout).toBe("");
    expect(sanitized.codeTests?.[1]?.expectedHash).toBeTruthy();
  });

  it("keeps CSS property checklist expectedStdout plaintext", () => {
    const q = createQuizQuestion("coding");
    q.language = "css";
    q.codeTests = [
      {
        id: "t1",
        stdin: "",
        expectedStdout: "color: red",
        hidden: false,
        weight: 1,
      },
    ];
    const sanitized = sanitizeQuestionForStudent(q);
    expect(sanitized.codeTests?.[0]?.expectedStdout).toBe("color: red");
  });
});
