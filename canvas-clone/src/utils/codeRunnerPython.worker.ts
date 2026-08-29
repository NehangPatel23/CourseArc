/**
 * Web Worker that runs student Python against stdin/stdout test cases via Pyodide.
 * Pyodide is loaded lazily from the jsDelivr CDN on first use.
 *
 * Contract: `stdin` is a string; use `print(...)` for stdout. `input()` reads
 * successive lines from stdin.
 */
import {
  normalizeStdout,
  type PythonWorkerRequest,
  type PythonWorkerResponse,
  type WorkerTestResult,
} from "./codeRunnerShared";

const PYODIDE_VERSION = "0.27.5";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
};

let pyodidePromise: Promise<PyodideInterface> | null = null;

async function loadPyodideRuntime(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const mod = await import(
        /* @vite-ignore */ `${PYODIDE_INDEX}pyodide.mjs`
      );
      const loadPyodide = mod.loadPyodide as (opts: {
        indexURL: string;
      }) => Promise<PyodideInterface>;
      return loadPyodide({ indexURL: PYODIDE_INDEX });
    })();
  }
  return pyodidePromise;
}

function asTuple3(result: unknown): [string, string, string | null] {
  const tup = result as {
    toJs?: (opts?: { create_proxies?: boolean }) => unknown;
  };
  let arr: unknown[] | null = null;
  if (tup && typeof tup.toJs === "function") {
    const js = tup.toJs({ create_proxies: false });
    if (Array.isArray(js)) arr = js;
  } else if (Array.isArray(result)) {
    arr = result;
  }
  if (!arr || arr.length < 3) return ["", "", "Unexpected runner result"];
  return [
    String(arr[0] ?? ""),
    String(arr[1] ?? ""),
    arr[2] == null || arr[2] === undefined ? null : String(arr[2]),
  ];
}

async function runOnePythonTest(
  py: PyodideInterface,
  code: string,
  stdin: string,
  expectedStdout: string,
  timeoutMs: number,
  expectedRegex?: string,
): Promise<Omit<WorkerTestResult, "testId">> {
  let stdout = "";
  let stderr = "";
  let error: string | undefined;
  let timedOut = false;

  const stdinLiteral = JSON.stringify(stdin);
  const codeLiteral = JSON.stringify(code);

  const harness = `
import sys
from io import StringIO

_stdin_data = ${stdinLiteral}
_student_code = ${codeLiteral}
_lines = iter(_stdin_data.splitlines(True))

def input(prompt=""):
    try:
        line = next(_lines)
        return line.rstrip("\\n").rstrip("\\r")
    except StopIteration:
        return ""

stdin = _stdin_data
_ns = {"input": input, "stdin": stdin, "__name__": "__main__"}
_out_buf, _err_buf = StringIO(), StringIO()
_old_out, _old_err = sys.stdout, sys.stderr
sys.stdout, sys.stderr = _out_buf, _err_buf
_err = None
try:
    exec(compile(_student_code, "<student>", "exec"), _ns)
except Exception as e:
    _err = f"{type(e).__name__}: {e}"
_out = _out_buf.getvalue()
_err_out = _err_buf.getvalue()
sys.stdout, sys.stderr = _old_out, _old_err
[_out, _err_out, _err]
`;

  try {
    const result = await Promise.race([
      py.runPythonAsync(harness),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    const [out, errOut, errMsg] = asTuple3(result);
    stdout = out;
    stderr = errOut;
    if (errMsg) error = errMsg;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Timed out")) {
      timedOut = true;
      error = msg;
    } else {
      error = msg;
    }
  }

  const passed =
    !timedOut &&
    !error &&
    (() => {
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
    })();

  return {
    passed,
    stdout,
    stderr,
    ...(error ? { error } : {}),
    ...(timedOut ? { timedOut: true } : {}),
  };
}

self.onmessage = async (event: MessageEvent<PythonWorkerRequest>) => {
  const { requestId, code, tests, timeoutMs } = event.data;
  try {
    const py = await loadPyodideRuntime();
    const results: WorkerTestResult[] = [];
    for (const t of tests) {
      results.push({
        testId: t.id,
        ...(await runOnePythonTest(
          py,
          code,
          t.stdin,
          t.expectedStdout,
          timeoutMs,
          t.expectedRegex,
        )),
      });
    }
    const response: PythonWorkerResponse = {
      requestId,
      results,
    };
    self.postMessage(response);
  } catch (e) {
    const loadError = e instanceof Error ? e.message : String(e);
    pyodidePromise = null;
    const response: PythonWorkerResponse = {
      requestId,
      loadError,
      results: tests.map((t) => ({
        testId: t.id,
        passed: false,
        stdout: "",
        stderr: "",
        error: `Failed to load Python runtime: ${loadError}`,
      })),
    };
    self.postMessage(response);
  }
};
