// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { quizT, readQuizLocale, writeQuizLocale } from "./quizI18n";

beforeEach(() => {
  window.localStorage.clear();
});

describe("quizI18n", () => {
  it("defaults to English", () => {
    expect(readQuizLocale()).toBe("en");
    expect(quizT("take.submit")).toBe("Submit Quiz");
  });

  it("returns Spanish when locale is es", () => {
    expect(quizT("take.submit", "es")).toBe("Entregar examen");
  });

  it("writeQuizLocale persists and readQuizLocale returns it", () => {
    writeQuizLocale("es");
    expect(readQuizLocale()).toBe("es");
  });

  it("falls back to key when key is unknown", () => {
    expect(quizT("unknown.key")).toBe("unknown.key");
  });
});
