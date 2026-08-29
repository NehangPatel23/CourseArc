import type { CodeFile, CodeLanguage, CodeTestCase } from "./quizzes";
import {
  combineCodeFiles,
  expandPropertyHarnessTests,
  isCodeRunnerLanguage,
  isHtmlCssRunnerLanguage,
  isLocalCodeRunnerLanguage,
  isRemoteCodeRunnerLanguage,
} from "./quizzes";
import {
  normalizeStdout,
  runJsTestsLocally,
  type PythonWorkerRequest,
  type PythonWorkerResponse,
  type WorkerRequest,
  type WorkerResponse,
  type WorkerTestResult,
} from "./codeRunnerShared";
import { runHtmlCssTests } from "./codeRunnerHtml";
import { transpileStudentCode } from "./codeRunnerTranspile";
import { runWandboxTests } from "./codeRunnerWandbox";

export { normalizeStdout };
export { buildHtmlCssSrcdoc, normalizeMarkupSource, hashNormalizedSource, isCssPropertyChecklist } from "./codeRunnerHtml";

export type CodeTestRunResult = {
  testId: string;
  passed: boolean;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut?: boolean;
  /** Language is not supported by the client runner. */
  unsupported?: boolean;
};

export type RunCodeTestsOptions = {
  language: CodeLanguage | string | undefined;
  code: string;
  tests: CodeTestCase[];
  /** Per-test soft timeout (ms). Default 2000. Overridden by test.timeoutMs. */
  timeoutMs?: number;
  /** Multi-file sources; combined when provided (overrides bare `code` if non-empty). */
  files?: CodeFile[];
  /** SQL setup prepended for SQL language. */
  sqlSetup?: string;
  /** TypeScript transpile mode (Sucrase). */
  tsTranspileMode?: "transpile" | "strip";
  /** Optional progress messages (e.g. Pyodide load). */
  onProgress?: (message: string) => void;
};

let jsWorker: Worker | null = null;
let pythonWorker: Worker | null = null;
let requestSeq = 0;

function getJsWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (jsWorker) return jsWorker;
  try {
    jsWorker = new Worker(new URL("./codeRunner.worker.ts", import.meta.url), {
      type: "module",
    });
    return jsWorker;
  } catch {
    return null;
  }
}

function getPythonWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (pythonWorker) return pythonWorker;
  try {
    pythonWorker = new Worker(
      new URL("./codeRunnerPython.worker.ts", import.meta.url),
      { type: "module" },
    );
    return pythonWorker;
  } catch {
    return null;
  }
}

function resetJsWorker() {
  if (jsWorker) {
    jsWorker.terminate();
    jsWorker = null;
  }
}

function resetPythonWorker() {
  if (pythonWorker) {
    pythonWorker.terminate();
    pythonWorker = null;
  }
}

function toRunResults(
  tests: CodeTestCase[],
  results: WorkerTestResult[],
): CodeTestRunResult[] {
  const byId = new Map(results.map((r) => [r.testId, r]));
  return tests.map((t) => {
    const r = byId.get(t.id);
    if (!r) {
      return {
        testId: t.id,
        passed: false,
        stdout: "",
        stderr: "",
        error: "No result from runner",
      };
    }
    return {
      testId: r.testId,
      passed: r.passed,
      stdout: r.stdout,
      stderr: r.stderr,
      error: r.error,
      timedOut: r.timedOut,
    };
  });
}

function runViaWorker<TReq extends { requestId: string }, TRes extends {
  requestId: string;
  results: WorkerTestResult[];
}>(
  worker: Worker,
  payload: TReq,
  overallTimeout: number,
  onTimeoutReset: () => void,
): Promise<CodeTestRunResult[]> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      worker.removeEventListener("message", onMessage);
      onTimeoutReset();
      const tests = (payload as unknown as { tests: { id: string }[] }).tests;
      resolve(
        tests.map((t) => ({
          testId: t.id,
          passed: false,
          stdout: "",
          stderr: "",
          timedOut: true,
          error: `Timed out after ${overallTimeout}ms`,
        })),
      );
    }, overallTimeout);

    const onMessage = (event: MessageEvent<TRes>) => {
      if (event.data?.requestId !== (payload as { requestId: string }).requestId) {
        return;
      }
      window.clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      const tests = (payload as unknown as { tests: CodeTestCase[] }).tests;
      resolve(toRunResults(tests, event.data.results));
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage(payload);
  });
}

/**
 * Run student code against stdin/stdout test cases.
 * Local: JavaScript, TypeScript (Sucrase), Python (Pyodide), HTML/CSS.
 * Remote (free Wandbox API): C, C++, Java, SQL.
 */
export async function runCodeTests(
  options: RunCodeTestsOptions,
): Promise<CodeTestRunResult[]> {
  const { language } = options;
  const timeoutMs = options.timeoutMs ?? 2000;
  const progress = options.onProgress;

  let code =
    options.files && options.files.length > 0
      ? combineCodeFiles(options.files, options.code)
      : options.code;

  if (language === "sql" && (options.sqlSetup ?? "").trim()) {
    code = `${options.sqlSetup!.trim()}\n\n${code}`;
  }

  const tests = expandPropertyHarnessTests(options.tests ?? []);
  if (tests.length === 0) return [];

  if (!isCodeRunnerLanguage(language)) {
    return tests.map((t) => ({
      testId: t.id,
      passed: false,
      stdout: "",
      stderr: "",
      unsupported: true,
      error: `Code runner does not support ${language ?? "this language"}`,
    }));
  }

  const workerCases = tests.map((t) => ({
    id: t.id,
    stdin: t.stdin ?? "",
    expectedStdout: t.expectedStdout ?? "",
    expectedHash: t.expectedHash,
    expectedRegex: t.expectedRegex,
    assertJs: t.assertJs,
  }));

  const caseTimeout = (t: CodeTestCase) =>
    typeof t.timeoutMs === "number" && t.timeoutMs > 0 ? t.timeoutMs : timeoutMs;

  if (isHtmlCssRunnerLanguage(language)) {
    return toRunResults(
      tests,
      runHtmlCssTests({ language: language ?? "html", code: code ?? "", tests: workerCases }),
    );
  }

  if (isRemoteCodeRunnerLanguage(language)) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return tests.map((t) => ({
        testId: t.id,
        passed: false,
        stdout: "",
        stderr: "",
        error:
          "Offline — C/C++/Java/SQL need the Wandbox network compiler. Reconnect and retry.",
      }));
    }
    progress?.("Running on Wandbox…");
    try {
      // Use max case timeout for the batch (Wandbox API is one timeout per call).
      const maxT = Math.max(8_000, ...tests.map(caseTimeout));
      return await runWandboxTests({
        language: language as CodeLanguage,
        code,
        tests: workerCases,
        timeoutMs: maxT,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return tests.map((t) => ({
        testId: t.id,
        passed: false,
        stdout: "",
        stderr: "",
        error: `Wandbox unavailable: ${msg}. Check network and retry.`,
      }));
    }
  }

  if (language === "python") {
    const w = getPythonWorker();
    if (!w) {
      return tests.map((t) => ({
        testId: t.id,
        passed: false,
        stdout: "",
        stderr: "",
        error: "Python runner requires Web Workers",
      }));
    }
    progress?.(
      "Loading Python (Pyodide) — first run may download ~15MB and then cache in the browser…",
    );
    const requestId = `req_${++requestSeq}_${Date.now()}`;
    const maxT = Math.max(...tests.map(caseTimeout), timeoutMs);
    const overallTimeout = maxT * Math.max(1, tests.length) + 90_000;
    const payload: PythonWorkerRequest = {
      requestId,
      code,
      timeoutMs: maxT,
      tests: workerCases,
    };
    return runViaWorker<PythonWorkerRequest, PythonWorkerResponse>(
      w,
      payload,
      overallTimeout,
      resetPythonWorker,
    );
  }

  // JavaScript + TypeScript (local worker)
  if (!isLocalCodeRunnerLanguage(language)) {
    return tests.map((t) => ({
      testId: t.id,
      passed: false,
      stdout: "",
      stderr: "",
      unsupported: true,
      error: `Code runner does not support ${language ?? "this language"}`,
    }));
  }

  let jsCode = code;
  if (language === "typescript") {
    const compiled = transpileStudentCode(language, code, options.tsTranspileMode);
    if (compiled.error) {
      return tests.map((t) => ({
        testId: t.id,
        passed: false,
        stdout: "",
        stderr: "",
        error: `TypeScript compile error: ${compiled.error}`,
      }));
    }
    jsCode = compiled.code;
  }

  // Per-test timeouts: run sequentially when timeouts differ, else batch.
  const timeouts = tests.map(caseTimeout);
  const uniform = timeouts.every((t) => t === timeouts[0]);

  if (!uniform) {
    const results: CodeTestRunResult[] = [];
    for (let i = 0; i < tests.length; i++) {
      const one = runJsTestsLocally(
        jsCode,
        [workerCases[i]!],
        timeouts[i]!,
      )[0]!;
      results.push({
        testId: one.testId,
        passed: one.passed,
        stdout: one.stdout,
        stderr: one.stderr,
        error: one.error,
        timedOut: one.timedOut,
      });
    }
    return results;
  }

  const w = getJsWorker();
  if (!w) {
    return toRunResults(tests, runJsTestsLocally(jsCode, workerCases, timeouts[0]!));
  }

  const requestId = `req_${++requestSeq}_${Date.now()}`;
  const overallTimeout = timeouts[0]! * Math.max(1, tests.length) + 1000;
  const payload: WorkerRequest = {
    requestId,
    code: jsCode,
    timeoutMs: timeouts[0]!,
    tests: workerCases,
  };
  return runViaWorker<WorkerRequest, WorkerResponse>(
    w,
    payload,
    overallTimeout,
    resetJsWorker,
  );
}

/** Score from test results with optional per-test weights (default 1 each). */
export function scoreFromCodeTestResults(
  results: CodeTestRunResult[],
  possible: number,
  tests?: CodeTestCase[],
): { correct: boolean; partial: boolean; earned: number; possible: number } {
  const total = results.length;
  if (total === 0 || possible <= 0) {
    return { correct: false, partial: false, earned: 0, possible };
  }
  if (results.some((r) => r.unsupported)) {
    return { correct: false, partial: false, earned: 0, possible };
  }
  const weightOf = (testId: string) => {
    const t = tests?.find((x) => x.id === testId || testId.startsWith(`${x.id}_ph_`));
    const w = t?.weight;
    return typeof w === "number" && w > 0 ? w : 1;
  };
  let passedW = 0;
  let totalW = 0;
  for (const r of results) {
    const w = weightOf(r.testId);
    totalW += w;
    if (r.passed) passedW += w;
  }
  if (totalW <= 0) totalW = total;
  if (passedW >= totalW - 1e-9) {
    return { correct: true, partial: false, earned: possible, possible };
  }
  const earned = Math.round((passedW / totalW) * possible * 100) / 100;
  return {
    correct: false,
    partial: earned > 0,
    earned,
    possible,
  };
}
