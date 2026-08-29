// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildQuizOnboardingSteps,
  dismissQuizOnboarding,
  isQuizOnboardingDismissed,
} from "./quizOnboarding";

beforeEach(() => {
  window.localStorage.clear();
});

describe("quizOnboarding", () => {
  it("builds steps with nothing done", () => {
    const steps = buildQuizOnboardingSteps("c1", {});
    expect(steps.every((s) => !s.done || s.id === "preview")).toBe(true);
  });

  it("marks title done when a non-default title is set", () => {
    const steps = buildQuizOnboardingSteps("c1", { title: "My Quiz" });
    expect(steps.find((s) => s.id === "title")!.done).toBe(true);
  });

  it("marks questions done when a scored question exists", () => {
    const steps = buildQuizOnboardingSteps("c1", {
      questions: [{ type: "multiple_choice" }],
    });
    expect(steps.find((s) => s.id === "questions")!.done).toBe(true);
  });

  it("dismiss persists", () => {
    expect(isQuizOnboardingDismissed("c1")).toBe(false);
    dismissQuizOnboarding("c1");
    expect(isQuizOnboardingDismissed("c1")).toBe(true);
  });
});
