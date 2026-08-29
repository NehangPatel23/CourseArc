import type { CodeLanguage } from "./quizzes";
import { normalizeStdout } from "./codeRunnerShared";

const WANDBOX_COMPILE_URL = "https://wandbox.org/api/compile.json";

/** Per-request wall timeout (ms). Shorter = snappier UI; Wandbox is usually well under this. */
const DEFAULT_TIMEOUT_MS = 8_000;

/** Max concurrent Wandbox compiles for one Run/grade. */
const MAX_CONCURRENCY = 3;

export const WANDBOX_COMPILER_BY_LANGUAGE: Partial<
  Record<CodeLanguage, string>
> = {
  c: "gcc-13.2.0-c",
  cpp: "gcc-13.2.0",
  java: "openjdk-jdk-21+35",
  sql: "sqlite-3.46.1",
};

export type WandboxRunResult = {
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
  /** True when the compiler rejected the program (safe to skip other cases). */
  compileFailed?: boolean;
};

type WandboxCompileResponse = {
  status?: string;
  signal?: string;
  compiler_error?: string;
  compiler_message?: string;
  program_output?: string;
  program_error?: string;
  program_message?: string;
};

export type WandboxTestResult = {
  testId: string;
  passed: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
  compileFailed?: boolean;
};

function summarizeRunnerError(raw: string, fallback: string): string {
  const text = raw.trim();
  if (!text) return fallback;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const interesting = lines.filter(
    (l) =>
      /error:/i.test(l) ||
      /undefined/i.test(l) ||
      /was not declared/i.test(l) ||
      /exception/i.test(l),
  );
  const pick = interesting.length > 0 ? interesting.slice(0, 3) : lines.slice(0, 3);
  const joined = pick.join(" · ");
  return joined.length > 280 ? `${joined.slice(0, 277)}…` : joined;
}

/** Run async work over items with a fixed concurrency limit. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Execute one stdin/stdout case via Wandbox (free public online compiler).
 */
export async function runWandboxOnce(options: {
  language: CodeLanguage;
  code: string;
  stdin: string;
  timeoutMs?: number;
}): Promise<WandboxRunResult> {
  const compiler = WANDBOX_COMPILER_BY_LANGUAGE[options.language];
  if (!compiler) {
    return {
      stdout: "",
      stderr: "",
      error: `No Wandbox compiler mapped for ${options.language}`,
    };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(WANDBOX_COMPILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        compiler,
        code: options.code,
        stdin: options.stdin ?? "",
        save: false,
      }),
    });

    if (!res.ok) {
      return {
        stdout: "",
        stderr: "",
        error: `Wandbox HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as WandboxCompileResponse;
    const compileErr = (data.compiler_error || "").trim();
    const programErr = (data.program_error || "").trim();
    const stdout = data.program_output ?? "";
    const status = data.status ?? "";

    if (compileErr) {
      return {
        stdout,
        stderr: compileErr,
        compileFailed: true,
        error: summarizeRunnerError(compileErr, "Compile error"),
      };
    }

    // Non-zero status usually means runtime failure.
    if (status && status !== "0") {
      const detail = programErr || data.program_message || "";
      return {
        stdout,
        stderr: detail,
        error: summarizeRunnerError(detail, `Exit status ${status}`),
      };
    }

    if (programErr && !stdout) {
      return {
        stdout: "",
        stderr: programErr,
        error: summarizeRunnerError(programErr, "Runtime error"),
      };
    }

    return {
      stdout,
      stderr: programErr,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg.includes("AbortError")) {
      return {
        stdout: "",
        stderr: "",
        timedOut: true,
        error: `Timed out after ${timeoutMs}ms (Wandbox)`,
      };
    }
    return {
      stdout: "",
      stderr: "",
      error: `Wandbox request failed: ${msg}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function toTestResult(
  testId: string,
  result: WandboxRunResult,
  expectedStdout: string,
  expectedRegex?: string,
): WandboxTestResult {
  const actual = normalizeStdout(result.stdout);
  let matched = false;
  const reSrc = (expectedRegex ?? "").trim();
  if (reSrc) {
    try {
      matched = new RegExp(reSrc, "s").test(actual);
    } catch {
      matched = false;
    }
  } else {
    matched = actual === normalizeStdout(expectedStdout);
  }
  const passed =
    !result.error &&
    !result.timedOut &&
    !result.compileFailed &&
    matched;
  return {
    testId,
    passed,
    stdout: result.stdout,
    stderr: result.stderr,
    ...(result.error ? { error: result.error } : {}),
    ...(result.timedOut ? { timedOut: true } : {}),
    ...(result.compileFailed ? { compileFailed: true } : {}),
  };
}

/**
 * Run all stdin/stdout cases via Wandbox.
 * - Fail-fast: if the first case is a compile error, skip the rest.
 * - Otherwise run remaining cases in parallel (bounded concurrency).
 */
export async function runWandboxTests(options: {
  language: CodeLanguage;
  code: string;
  tests: {
    id: string;
    stdin: string;
    expectedStdout: string;
    expectedRegex?: string;
  }[];
  timeoutMs?: number;
}): Promise<WandboxTestResult[]> {
  const { language, code, tests } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (tests.length === 0) return [];

  const runOne = (t: {
    id: string;
    stdin: string;
    expectedStdout: string;
    expectedRegex?: string;
  }) =>
    runWandboxOnce({ language, code, stdin: t.stdin, timeoutMs }).then((r) =>
      toTestResult(t.id, r, t.expectedStdout, t.expectedRegex),
    );

  const first = await runOne(tests[0]!);
  if (first.compileFailed) {
    // Same broken program — don't recompile N times.
    return tests.map((t, i) =>
      i === 0
        ? first
        : {
            testId: t.id,
            passed: false,
            stdout: "",
            stderr: first.stderr,
            compileFailed: true,
            ...(first.error ? { error: first.error } : {}),
          },
    );
  }

  if (tests.length === 1) return [first];

  const rest = await mapPool(tests.slice(1), MAX_CONCURRENCY, (t) => runOne(t));
  return [first, ...rest];
}
