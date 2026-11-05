import type { TicketTest } from "@/features/tickets/data/tickets";
import type { PythonRunner, RunResult } from "./types";

export interface TestOutcome {
  name: string;
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
  result: RunResult;
}

export interface TestSuiteResult {
  engine: "pyodide";
  passed: number;
  total: number;
  allPassed: boolean;
  outcomes: TestOutcome[];
  cancelled: boolean;
}

export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export function evaluateTest(test: TicketTest, result: RunResult): TestOutcome {
  if (!result.ok || result.timedOut || result.cancelled || result.truncated) {
    return { name: test.name, passed: false, message: result.timedOut ? "Execution timed out" : result.cancelled ? "Execution cancelled" : result.truncated ? "Output limit exceeded" : (result.error ?? "Program failed"), result };
  }
  if (test.expectedStdout !== undefined) {
    const expected = normalizeOutput(test.expectedStdout);
    const actual = normalizeOutput(result.stdout);
    if (expected !== actual) {
      return { name: test.name, passed: false, message: "Output does not match", expected, actual, result };
    }
  }
  return { name: test.name, passed: true, message: "Passed", result };
}

export async function runTestSuite(runner: PythonRunner, code: string, tests: TicketTest[]): Promise<TestSuiteResult> {
  const outcomes: TestOutcome[] = [];
  let cancelled = false;
  for (const test of tests) {
    const result = await runner.run({
      code,
      stdin: test.stdin ?? [],
      ...(test.check !== undefined ? { check: test.check } : {}),
      echoPrompts: false,
      timeoutMs: 5000,
      outputLimit: 20000,
    });
    if (result.cancelled) {
      cancelled = true;
      break;
    }
    outcomes.push(evaluateTest(test, result));
  }
  const passed = outcomes.filter((o) => o.passed).length;
  return {
    engine: "pyodide",
    passed,
    total: tests.length,
    allPassed: !cancelled && outcomes.length === tests.length && passed === tests.length,
    outcomes,
    cancelled,
  };
}
