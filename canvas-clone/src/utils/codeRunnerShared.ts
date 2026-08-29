/** Normalize stdout for comparison: trim trailing whitespace per line + overall. */
export function normalizeStdout(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

export type WorkerTestCase = {
  id: string;
  stdin: string;
  expectedStdout: string;
  expectedHash?: string;
  expectedRegex?: string;
  assertJs?: string;
};

export type WorkerTestResult = {
  testId: string;
  passed: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
};

export type WorkerRequest = {
  requestId: string;
  code: string;
  tests: WorkerTestCase[];
  timeoutMs: number;
};

export type WorkerResponse = {
  requestId: string;
  results: WorkerTestResult[];
};

export type PythonWorkerRequest = {
  requestId: string;
  code: string;
  tests: WorkerTestCase[];
  timeoutMs: number;
};

export type PythonWorkerResponse = {
  requestId: string;
  results: WorkerTestResult[];
  loadError?: string;
};

function matchExpected(
  stdout: string,
  expectedStdout: string,
  expectedRegex?: string,
): boolean {
  const actual = normalizeStdout(stdout);
  const reSrc = (expectedRegex ?? "").trim();
  if (reSrc) {
    try {
      return new RegExp(reSrc, "s").test(actual);
    } catch {
      return false;
    }
  }
  return actual === normalizeStdout(expectedStdout);
}

function runAssertJs(
  assertJs: string,
  ctx: { stdout: string; stdin: string; expected: string },
): { ok: boolean; error?: string } {
  try {
    const fn = new Function(
      "stdout",
      "stdin",
      "expected",
      `"use strict";\n${assertJs}\n`,
    );
    const result = fn(ctx.stdout, ctx.stdin, ctx.expected);
    if (result === false) return { ok: false, error: "assertJs returned false" };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Execute one JS test in the current realm (worker or main-thread fallback). */
export function runOneJsTest(
  code: string,
  stdin: string,
  expectedStdout: string,
  timeoutMs: number,
  extras?: { expectedRegex?: string; assertJs?: string },
): Omit<WorkerTestResult, "testId"> {
  const logs: string[] = [];
  const errs: string[] = [];
  const fakeConsole = {
    log: (...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
    },
    info: (...args: unknown[]) => {
      logs.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
    },
    warn: (...args: unknown[]) => {
      errs.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
    },
    error: (...args: unknown[]) => {
      errs.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
    },
  };

  let timedOut = false;
  let error: string | undefined;
  const start = Date.now();

  try {
    const fn = new Function(
      "stdin",
      "console",
      `"use strict";\n${code}\n`,
    );
    fn(stdin, fakeConsole);
    if (Date.now() - start > timeoutMs) {
      timedOut = true;
      error = `Timed out after ${timeoutMs}ms`;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const stdout = logs.join("\n");
  const stderr = errs.join("\n");

  let passed =
    !timedOut &&
    !error &&
    matchExpected(stdout, expectedStdout, extras?.expectedRegex);

  if (passed && extras?.assertJs?.trim()) {
    const assert = runAssertJs(extras.assertJs, {
      stdout,
      stdin,
      expected: expectedStdout,
    });
    if (!assert.ok) {
      passed = false;
      error = assert.error ?? "assertJs failed";
    }
  }

  return {
    passed,
    stdout,
    stderr,
    ...(error ? { error } : {}),
    ...(timedOut ? { timedOut: true } : {}),
  };
}

export function runJsTestsLocally(
  code: string,
  tests: WorkerTestCase[],
  timeoutMs: number,
): WorkerTestResult[] {
  return tests.map((t) => ({
    testId: t.id,
    ...runOneJsTest(code, t.stdin, t.expectedStdout, timeoutMs, {
      expectedRegex: t.expectedRegex,
      assertJs: t.assertJs,
    }),
  }));
}
