import { describe, expect, it } from "vitest";
import {
  evaluateFormula,
  generateCalculatedVariables,
  substituteCalculatedPrompt,
} from "./quizFormula";

describe("quizFormula", () => {
  it("evaluates basic arithmetic with variables", () => {
    expect(evaluateFormula("a + b", { a: 2, b: 3 })).toBe(5);
    expect(evaluateFormula("(a * b) / 2", { a: 4, b: 5 })).toBe(10);
    expect(evaluateFormula("a ^ 2", { a: 3 })).toBe(9);
  });

  it("returns NaN for unsafe expressions", () => {
    expect(Number.isNaN(evaluateFormula("alert(1)", {}))).toBe(true);
    expect(Number.isNaN(evaluateFormula("", {}))).toBe(true);
  });

  it("generates deterministic variables from seed", () => {
    const defs = [{ name: "x", min: 1, max: 10, decimals: 0 }];
    const a = generateCalculatedVariables(defs, "seed-a");
    const b = generateCalculatedVariables(defs, "seed-a");
    const c = generateCalculatedVariables(defs, "seed-b");
    expect(a.x).toBe(b.x);
    expect(a.x).not.toBe(c.x);
  });

  it("substitutes bracketed variables in prompts", () => {
    const prompt = "Solve for [x] + [y].";
    expect(substituteCalculatedPrompt(prompt, { x: 2, y: 5 })).toBe("Solve for 2 + 5.");
  });
});
