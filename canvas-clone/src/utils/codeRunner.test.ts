import { describe, expect, it } from "vitest";
import {
  normalizeStdout,
  runJsTestsLocally,
} from "./codeRunnerShared";
import { scoreFromCodeTestResults, runCodeTests } from "./codeRunner";
import { transpileStudentCode } from "./codeRunnerTranspile";
import { isCodeRunnerLanguage } from "./quizzes";

describe("normalizeStdout", () => {
  it("trims trailing whitespace per line", () => {
    expect(normalizeStdout("a  \nb\t\n")).toBe("a\nb");
  });
});

describe("isCodeRunnerLanguage", () => {
  it("includes local, Wandbox remote, and HTML/CSS languages", () => {
    expect(isCodeRunnerLanguage("javascript")).toBe(true);
    expect(isCodeRunnerLanguage("typescript")).toBe(true);
    expect(isCodeRunnerLanguage("python")).toBe(true);
    expect(isCodeRunnerLanguage("c")).toBe(true);
    expect(isCodeRunnerLanguage("cpp")).toBe(true);
    expect(isCodeRunnerLanguage("java")).toBe(true);
    expect(isCodeRunnerLanguage("sql")).toBe(true);
    expect(isCodeRunnerLanguage("html")).toBe(true);
    expect(isCodeRunnerLanguage("css")).toBe(true);
    expect(isCodeRunnerLanguage("other")).toBe(false);
  });
});

describe("transpileStudentCode", () => {
  it("strips TypeScript types", () => {
    const { code, error } = transpileStudentCode(
      "typescript",
      `const n: number = Number(stdin.trim());\nconsole.log(n * 2);`,
    );
    expect(error).toBeUndefined();
    expect(code).toContain("const n");
    expect(code).not.toContain(": number");
  });
});

describe("runJsTestsLocally", () => {
  it("passes when console.log matches expected stdout", () => {
    const results = runJsTestsLocally(
      `const n = Number(stdin.trim());\nconsole.log(n * 2);`,
      [{ id: "t1", stdin: "21", expectedStdout: "42" }],
      2000,
    );
    expect(results[0]?.passed).toBe(true);
  });

  it("fails on wrong output", () => {
    const results = runJsTestsLocally(
      `console.log("nope");`,
      [{ id: "t1", stdin: "", expectedStdout: "yes" }],
      2000,
    );
    expect(results[0]?.passed).toBe(false);
  });
});

describe("runCodeTests typescript", () => {
  it("transpiles and grades TypeScript in the local fallback", async () => {
    const results = await runCodeTests({
      language: "typescript",
      code: `const n: number = Number(stdin.trim());\nconsole.log(n * 2);`,
      tests: [{ id: "t1", stdin: "21", expectedStdout: "42" }],
    });
    expect(results[0]?.passed).toBe(true);
  });
});

describe("runCodeTests html/css", () => {
  it("grades HTML by body text when expected is plain text", async () => {
    const results = await runCodeTests({
      language: "html",
      code: "<h1>Hello</h1><p>World</p>",
      tests: [{ id: "t1", stdin: "", expectedStdout: "Hello World" }],
    });
    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.stdout).toBe("Hello World");
  });

  it("grades HTML by normalized markup when expected looks like HTML", async () => {
    const results = await runCodeTests({
      language: "html",
      code: "<p>Hi</p>",
      tests: [{ id: "t1", stdin: "", expectedStdout: "<p>Hi</p>" }],
    });
    expect(results[0]?.passed).toBe(true);
  });

  it("grades CSS by property checklist without exact source match", async () => {
    const results = await runCodeTests({
      language: "css",
      code: ".target {\n  color: red;\n  font-size: 24px;\n}",
      tests: [
        {
          id: "t1",
          stdin: '<div class="target">x</div>',
          expectedStdout: "color: red\nfont-size: 24px",
        },
      ],
    });
    expect(results[0]?.passed).toBe(true);
  });

  it("grades HTML via expectedHash when plaintext expected is stripped", async () => {
    const { hashNormalizedSource } = await import("./codeRunnerHtml");
    const code = "<p>Hi</p>";
    const results = await runCodeTests({
      language: "html",
      code,
      tests: [
        {
          id: "t1",
          stdin: "",
          expectedStdout: "",
          expectedHash: hashNormalizedSource(code),
        },
      ],
    });
    expect(results[0]?.passed).toBe(true);
  });
});

describe("scoreFromCodeTestResults", () => {
  it("awards partial credit by pass fraction", () => {
    const score = scoreFromCodeTestResults(
      [
        { testId: "a", passed: true, stdout: "", stderr: "" },
        { testId: "b", passed: false, stdout: "", stderr: "" },
      ],
      10,
    );
    expect(score.earned).toBe(5);
    expect(score.partial).toBe(true);
    expect(score.correct).toBe(false);
  });
});
