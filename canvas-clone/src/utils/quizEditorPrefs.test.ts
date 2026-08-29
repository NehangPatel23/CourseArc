// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getCourseMonacoDefault,
  monacoEditorFieldFromOverride,
  monacoOverrideFromQuiz,
  shouldUseMonacoEditor,
} from "./quizEditorPrefs";
import type { Quiz } from "./quizzes";

beforeEach(() => {
  window.localStorage.clear();
});

describe("shouldUseMonacoEditor", () => {
  it("returns false by default", () => {
    expect(shouldUseMonacoEditor("c1")).toBe(false);
  });

  it("follows course setting when quiz has no override", () => {
    window.localStorage.setItem(
      "canvasClone:courses",
      JSON.stringify([{ id: "c1", monacoCodeEditor: true, title: "C", code: "C", short_name: "C", term: "T", color: "#000", published: true, updated_at: "" }]),
    );
    expect(getCourseMonacoDefault("c1")).toBe(true);
    expect(shouldUseMonacoEditor("c1")).toBe(true);
    expect(shouldUseMonacoEditor("c1", {} as Quiz)).toBe(true);
  });

  it("respects quiz-level on override", () => {
    const quiz = { monacoEditor: true } as Quiz;
    expect(shouldUseMonacoEditor("c1", quiz)).toBe(true);
  });

  it("respects quiz-level off override even when course is on", () => {
    window.localStorage.setItem(
      "canvasClone:courses",
      JSON.stringify([{ id: "c1", monacoCodeEditor: true, title: "C", code: "C", short_name: "C", term: "T", color: "#000", published: true, updated_at: "" }]),
    );
    const quiz = { monacoEditor: false } as Quiz;
    expect(shouldUseMonacoEditor("c1", quiz)).toBe(false);
  });

  it("ignores global settings — course is the universal default", () => {
    window.localStorage.setItem(
      "canvasClone:settings",
      JSON.stringify({ monacoCodeEditor: true }),
    );
    expect(shouldUseMonacoEditor("c1")).toBe(false);
  });
});

describe("monaco override helpers", () => {
  it("round-trips inherit/on/off", () => {
    expect(monacoOverrideFromQuiz(undefined)).toBe("inherit");
    expect(monacoOverrideFromQuiz({} as Quiz)).toBe("inherit");
    expect(monacoOverrideFromQuiz({ monacoEditor: true } as Quiz)).toBe("on");
    expect(monacoOverrideFromQuiz({ monacoEditor: false } as Quiz)).toBe("off");
    expect(monacoEditorFieldFromOverride("inherit")).toBeUndefined();
    expect(monacoEditorFieldFromOverride("on")).toBe(true);
    expect(monacoEditorFieldFromOverride("off")).toBe(false);
  });
});
