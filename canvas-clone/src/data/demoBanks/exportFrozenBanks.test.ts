/**
 * Smoke tests for CS demo question banks.
 */
import { describe, expect, it } from "vitest";
import { buildDemoQuestionBanks, demoQuestionBankIds } from "../demoQuestionBanks";
import { CORE_DEMO_BANK_CATALOG, NEW_DEMO_BANK_CATALOG } from "./catalog";

const GRADED_TYPES = [
  "multiple_choice",
  "multiple_answers",
  "true_false",
  "short_answer",
  "fill_in_blank",
  "fill_in_multiple_blanks",
  "numerical",
  "matching",
  "ordering",
  "calculated",
  "likert",
  "hotspot",
  "essay",
  "inline_code",
  "coding",
] as const;

describe("CS demo banks", () => {
  it("keeps stable ids for the original five banks", () => {
    const courseId = "smoke";
    const banks = buildDemoQuestionBanks(courseId);
    const ids = demoQuestionBankIds(courseId);
    for (const meta of CORE_DEMO_BANK_CATALOG) {
      const bank = banks.find((b) => b.id === ids[meta.idKey]);
      expect(bank, meta.title).toBeTruthy();
      expect(bank!.title).toBe(meta.title);
    }
  });

  it("seeds 46 full-size banks with all graded types and feedback", () => {
    const banks = buildDemoQuestionBanks("smoke");
    expect(banks.length).toBe(CORE_DEMO_BANK_CATALOG.length + NEW_DEMO_BANK_CATALOG.length);
    expect(banks.length).toBe(46);

    for (const b of banks) {
      expect(b.questions.length, b.title).toBeGreaterThanOrEqual(75);
      const types = new Set(b.questions.map((q) => q.type));
      for (const t of GRADED_TYPES) {
        expect(types.has(t), `${b.title} missing ${t}`).toBe(true);
      }
      for (const q of b.questions) {
        expect(q.feedback?.trim().length, q.id).toBeGreaterThan(0);
      }
    }
  });
});
