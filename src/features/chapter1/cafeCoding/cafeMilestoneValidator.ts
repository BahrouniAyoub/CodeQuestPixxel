import type { PythonRunner, RunResult } from "@/services/runner/types";
import { getCafeMilestone, type CafeMilestoneId } from "./cafeMilestones";

export type CafeMilestoneValidationStatus = "passed" | "failed" | "runtime-error" | "busy";

export interface CafeMilestoneTestOutcome {
  readonly name: string;
  readonly passed: boolean;
  readonly message: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface CafeMilestoneValidationResult {
  readonly milestoneId: CafeMilestoneId | null;
  readonly status: CafeMilestoneValidationStatus;
  readonly testsPassed: number;
  readonly testsExecuted: number;
  readonly testsTotal: number;
  readonly outcomes: readonly CafeMilestoneTestOutcome[];
  readonly message: string;
  readonly error: string | null;
}

export interface CafeMilestoneValidationOptions {
  readonly timeoutMs?: number;
  readonly outputLimit?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_OUTPUT_LIMIT = 20_000;

/**
 * Only one validation may use the shared runner at a time. The editor also
 * tracks a local generation so an older result can never be applied to newer
 * editor code.
 */
let validationActive = false;

function runtimeError(
  milestoneId: CafeMilestoneId,
  message: string,
  outcomes: CafeMilestoneTestOutcome[],
  testsTotal: number,
): CafeMilestoneValidationResult {
  return {
    milestoneId,
    status: "runtime-error",
    testsPassed: outcomes.filter((outcome) => outcome.passed).length,
    testsExecuted: outcomes.length,
    testsTotal,
    outcomes,
    message,
    error: message,
  };
}

function stdoutNumbers(stdout: string): number[] {
  return (stdout.match(/-?\d+(?:\.\d+)?/g) ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function containsNumber(values: readonly number[], expected: number): boolean {
  return values.some((value) => Math.abs(value - expected) < 1e-9);
}

function checkOutcome(
  testName: string,
  result: RunResult,
  expectedNumbers: readonly number[],
): CafeMilestoneTestOutcome {
  if (!result.ok) {
    return {
      name: testName,
      passed: false,
      message: result.error ?? "Test failed",
    };
  }

  if (expectedNumbers.length > 0) {
    const printed = stdoutNumbers(result.stdout);
    const missing = expectedNumbers.filter((value) => !containsNumber(printed, value));
    if (missing.length > 0) {
      return {
        name: testName,
        passed: false,
        message: "Output does not show the expected item prices",
        expected: expectedNumbers.join(" and "),
        actual: result.stdout.trim() || "(no output)",
      };
    }
  }

  return { name: testName, passed: true, message: "Passed" };
}

/**
 * Execute a milestone through the existing Pyodide runner and return
 * structured feedback. Correctness is decided by running Python checks and
 * inspecting real output, never by matching the submitted source text.
 */
export async function validateCafeMilestone(
  runner: PythonRunner,
  milestoneId: CafeMilestoneId,
  code: string,
  options: CafeMilestoneValidationOptions = {},
): Promise<CafeMilestoneValidationResult> {
  const milestone = getCafeMilestone(milestoneId);
  const testsTotal = milestone.tests.length;

  if (validationActive) {
    return {
      milestoneId,
      status: "busy",
      testsPassed: 0,
      testsExecuted: 0,
      testsTotal,
      outcomes: [],
      message: "Another milestone validation is already running. Stop it or wait for it to finish.",
      error: null,
    };
  }

  if (code.trim().length === 0) {
    return {
      milestoneId,
      status: "failed",
      testsPassed: 0,
      testsExecuted: 0,
      testsTotal,
      outcomes: [],
      message: "Write some Python code before running the milestone tests.",
      error: null,
    };
  }

  validationActive = true;
  const outcomes: CafeMilestoneTestOutcome[] = [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const outputLimit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT;

  try {
    for (const test of milestone.tests) {
      let result: RunResult;
      try {
        result = await runner.run({
          code,
          stdin: [],
          check: test.pythonCheck,
          echoPrompts: false,
          timeoutMs,
          outputLimit,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outcomes.push({ name: test.name, passed: false, message });
        return runtimeError(milestoneId, `Python runtime error: ${message}`, outcomes, testsTotal);
      }

      if (result.timedOut) {
        outcomes.push({
          name: test.name,
          passed: false,
          message: "Execution timed out. Check for an endless loop.",
        });
        return runtimeError(
          milestoneId,
          "Execution timed out. Check for an endless loop.",
          outcomes,
          testsTotal,
        );
      }

      if (result.cancelled) {
        outcomes.push({
          name: test.name,
          passed: false,
          message: "Validation cancelled.",
        });
        return {
          milestoneId,
          status: "failed",
          testsPassed: 0,
          testsExecuted: outcomes.length,
          testsTotal,
          outcomes,
          message: "Validation cancelled.",
          error: null,
        };
      }

      // A program-phase failure means the submitted file itself crashed.
      // Stop immediately: later test cases would fail for the same reason.
      if (!result.ok && result.phase !== "check") {
        outcomes.push({
          name: test.name,
          passed: false,
          message: result.error ?? "Program failed",
        });
        return runtimeError(
          milestoneId,
          `Python runtime error: ${result.error ?? "Program failed"}`,
          outcomes,
          testsTotal,
        );
      }

      outcomes.push(checkOutcome(test.name, result, test.stdoutNumbers ?? []));

      if (result.truncated) {
        return runtimeError(
          milestoneId,
          "Output limit exceeded. Check for an endless print loop.",
          outcomes,
          testsTotal,
        );
      }
    }

    const passed = outcomes.filter((outcome) => outcome.passed).length;
    const allPassed = outcomes.length === testsTotal && passed === testsTotal;
    return {
      milestoneId,
      status: allPassed ? "passed" : "failed",
      testsPassed: passed,
      testsExecuted: outcomes.length,
      testsTotal,
      outcomes,
      message: allPassed
        ? `All ${testsTotal} milestone tests passed.`
        : `Passed ${passed} of ${testsTotal} milestone tests.`,
      error: null,
    };
  } finally {
    validationActive = false;
  }
}

/** Exposed for focused tests that assert the lock is released after a run. */
export function isCafeMilestoneValidationActive(): boolean {
  return validationActive;
}
