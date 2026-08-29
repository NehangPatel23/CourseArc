import { describe, expect, it, vi, afterEach } from "vitest";
import {
  WANDBOX_COMPILER_BY_LANGUAGE,
  runWandboxOnce,
  runWandboxTests,
} from "./codeRunnerWandbox";

describe("WANDBOX_COMPILER_BY_LANGUAGE", () => {
  it("maps C, C++, Java, and SQL", () => {
    expect(WANDBOX_COMPILER_BY_LANGUAGE.c).toBeTruthy();
    expect(WANDBOX_COMPILER_BY_LANGUAGE.cpp).toBeTruthy();
    expect(WANDBOX_COMPILER_BY_LANGUAGE.java).toBeTruthy();
    expect(WANDBOX_COMPILER_BY_LANGUAGE.sql).toBeTruthy();
  });
});

describe("runWandboxOnce", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a successful Wandbox response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: "0",
          program_output: "42\n",
          program_error: "",
          compiler_error: "",
        }),
      })),
    );
    const result = await runWandboxOnce({
      language: "c",
      code: "int main(){return 0;}",
      stdin: "",
    });
    expect(result.stdout).toBe("42\n");
    expect(result.error).toBeUndefined();
  });

  it("surfaces compile errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: "1",
          program_output: "",
          compiler_error: "error: expected ';' before '}' token",
        }),
      })),
    );
    const result = await runWandboxOnce({
      language: "cpp",
      code: "int main(){",
      stdin: "",
    });
    expect(result.error).toMatch(/expected/);
    expect(result.compileFailed).toBe(true);
  });
});

describe("runWandboxTests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fail-fasts on compile error without re-hitting Wandbox", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: "1",
        program_output: "",
        compiler_error: "error: 'pow' was not declared",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await runWandboxTests({
      language: "cpp",
      code: "bad",
      tests: [
        { id: "a", stdin: "1", expectedStdout: "1" },
        { id: "b", stdin: "2", expectedStdout: "2" },
        { id: "c", stdin: "3", expectedStdout: "3" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.compileFailed && !r.passed)).toBe(true);
  });

  it("runs remaining cases after a successful first test", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return {
          ok: true,
          json: async () => ({
            status: "0",
            program_output: `${calls}\n`,
            program_error: "",
            compiler_error: "",
          }),
        };
      }),
    );

    const results = await runWandboxTests({
      language: "c",
      code: "ok",
      tests: [
        { id: "a", stdin: "", expectedStdout: "1" },
        { id: "b", stdin: "", expectedStdout: "2" },
      ],
    });

    expect(calls).toBe(2);
    expect(results[0]?.passed).toBe(true);
    expect(results[1]?.passed).toBe(true);
  });
});
