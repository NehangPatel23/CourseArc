/**
 * Web Worker that runs student JavaScript against stdin/stdout test cases.
 * Stdin is provided as `stdin`; stdout is captured from console.log.
 */
import {
  runJsTestsLocally,
  type WorkerRequest,
  type WorkerResponse,
} from "./codeRunnerShared";

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { requestId, code, tests, timeoutMs } = event.data;
  const results = runJsTestsLocally(code, tests, timeoutMs);
  const response: WorkerResponse = { requestId, results };
  self.postMessage(response);
};
