import type { ProjectModule, PythonRunner, RunResult } from "@/services/runner/types";
import {
  getCafeDevTask,
  type CafeDevFileContents,
  type CafeDevTaskId,
  type CafeDevTestCase,
} from "./cafeDevTasks";

export type CafeDevValidationStatus = "passed" | "failed" | "runtime-error" | "busy";

export interface CafeDevTestOutcome {
  readonly name: string;
  readonly passed: boolean;
  readonly message: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface CafeDevValidationResult {
  readonly taskId: CafeDevTaskId | null;
  readonly status: CafeDevValidationStatus;
  readonly testsPassed: number;
  readonly testsExecuted: number;
  readonly testsTotal: number;
  readonly outcomes: readonly CafeDevTestOutcome[];
  readonly message: string;
  readonly error: string | null;
}

export interface CafeDevValidationOptions {
  readonly timeoutMs?: number;
  readonly outputLimit?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_OUTPUT_LIMIT = 20_000;

/**
 * Only one development validation may use the shared runner at a time. The
 * legacy milestone validator keeps its own lock; the runner itself also refuses
 * overlapping executions.
 */
let validationActive = false;

function normalizeOutput(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim().toLowerCase();
}

function rawOutput(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

/** Return the first regex source that does not match, or null when all match. */
function firstMissingPattern(
  output: string,
  patterns: readonly string[],
  shouldMatch: boolean,
): string | null {
  for (const source of patterns) {
    let matches = false;
    try {
      matches = new RegExp(source, "im").test(output);
    } catch {
      // An invalid pattern can only come from static task data; treat it as a
      // failed check rather than crashing the whole verification.
      matches = false;
    }
    if (matches !== shouldMatch) return source;
  }
  return null;
}

function runtimeError(
  taskId: CafeDevTaskId,
  message: string,
  outcomes: CafeDevTestOutcome[],
  testsTotal: number,
): CafeDevValidationResult {
  return {
    taskId,
    status: "runtime-error",
    testsPassed: outcomes.filter((outcome) => outcome.passed).length,
    testsExecuted: outcomes.length,
    testsTotal,
    outcomes,
    message,
    error: message,
  };
}

function checkOutcome(test: CafeDevTestCase, result: RunResult): CafeDevTestOutcome {
  if (!result.ok) {
    return {
      name: test.name,
      passed: false,
      message: result.error ?? "Test failed",
    };
  }

  const output = normalizeOutput(result.stdout);
  const raw = rawOutput(result.stdout);

  if (test.stdoutContains && test.stdoutContains.length > 0) {
    const missing = test.stdoutContains.filter(
      (expected) => !output.includes(normalizeOutput(expected)),
    );
    if (missing.length > 0) {
      return {
        name: test.name,
        passed: false,
        message: "Program output did not contain the expected receipt values.",
        expected: missing.join(", "),
        actual: result.stdout.trim() || "(no output)",
      };
    }
  }

  if (test.stdoutMatches && test.stdoutMatches.length > 0) {
    const missing = firstMissingPattern(raw, test.stdoutMatches, true);
    if (missing) {
      return {
        name: test.name,
        passed: false,
        message: "Program output did not contain the expected receipt values.",
        expected: missing,
        actual: result.stdout.trim() || "(no output)",
      };
    }
  }

  if (test.stdoutNotContains && test.stdoutNotContains.length > 0) {
    const forbidden = test.stdoutNotContains.find((value) =>
      output.includes(normalizeOutput(value)),
    );
    if (forbidden) {
      return {
        name: test.name,
        passed: false,
        message: `Program output must not contain "${forbidden}".`,
        ...(test.stdoutContains?.length ? { expected: test.stdoutContains.join(", ") } : {}),
        actual: result.stdout.trim() || "(no output)",
      };
    }
  }

  if (test.stdoutNotMatches && test.stdoutNotMatches.length > 0) {
    const forbidden = firstMissingPattern(raw, test.stdoutNotMatches, false);
    if (forbidden) {
      return {
        name: test.name,
        passed: false,
        message: `Program output must not match "${forbidden}".`,
        ...(test.stdoutMatches?.length ? { expected: test.stdoutMatches.join(", ") } : {}),
        actual: result.stdout.trim() || "(no output)",
      };
    }
  }

  return { name: test.name, passed: true, message: "Passed" };
}

function emptyFileResult(
  taskId: CafeDevTaskId,
  fileName: string,
  testsTotal: number,
  message: string,
): CafeDevValidationResult {
  return {
    taskId,
    status: "failed",
    testsPassed: 0,
    testsExecuted: 0,
    testsTotal,
    outcomes: [
      {
        name: fileName,
        passed: false,
        message,
      },
    ],
    message: `Write some Python code in ${fileName} before running the task tests.`,
    error: null,
  };
}

/**
 * Execute a development task against saved project files through the existing
 * Pyodide runner.
 *
 * - Tasks 1–2 execute calculator.py directly.
 * - Tasks 3–4 execute main.py with calculator.py supplied as a fresh project
 *   module, so `import calculator` uses the saved source for this run only.
 */
export async function validateCafeDevTask(
  runner: PythonRunner,
  taskId: CafeDevTaskId,
  files: CafeDevFileContents,
  options: CafeDevValidationOptions = {},
): Promise<CafeDevValidationResult> {
  const task = getCafeDevTask(taskId);
  const testsTotal = task.tests.length;
  const codeFileName = task.primaryFile;
  const code = files[codeFileName] ?? "";
  const calculatorCode = files["calculator.py"] ?? "";

  if (validationActive) {
    return {
      taskId,
      status: "busy",
      testsPassed: 0,
      testsExecuted: 0,
      testsTotal,
      outcomes: [],
      message: "Another task validation is already running. Stop it or wait for it to finish.",
      error: null,
    };
  }

  if (code.trim().length === 0) {
    return emptyFileResult(taskId, codeFileName, testsTotal, `${codeFileName} is empty.`);
  }

  if (codeFileName === "main.py" && calculatorCode.trim().length === 0) {
    return emptyFileResult(
      taskId,
      "calculator.py",
      testsTotal,
      "calculator.py is empty. Finish the pricing tasks before running main.py.",
    );
  }

  validationActive = true;
  const outcomes: CafeDevTestOutcome[] = [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const outputLimit = options.outputLimit ?? DEFAULT_OUTPUT_LIMIT;
  const defaultProjectModules: readonly ProjectModule[] | undefined =
    codeFileName === "main.py" ? [{ name: "calculator", content: calculatorCode }] : undefined;

  try {
    for (const test of task.tests) {
      // A test can supply a controlled module (task 4 uses this to prove that
      // main.py really calls calculator instead of duplicating its logic).
      const projectModules = test.modules ? [...test.modules] : defaultProjectModules;
      let result: RunResult;
      try {
        result = await runner.run({
          code,
          stdin: [...(test.stdin ?? [])],
          ...(test.pythonCheck ? { check: test.pythonCheck } : {}),
          ...(projectModules ? { projectModules } : {}),
          echoPrompts: true,
          timeoutMs,
          outputLimit,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outcomes.push({ name: test.name, passed: false, message });
        return runtimeError(taskId, `Python runtime error: ${message}`, outcomes, testsTotal);
      }

      if (result.timedOut) {
        outcomes.push({
          name: test.name,
          passed: false,
          message: "Execution timed out. Check for an endless loop.",
        });
        return runtimeError(
          taskId,
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
          taskId,
          status: "failed",
          testsPassed: 0,
          testsExecuted: outcomes.length,
          testsTotal,
          outcomes,
          message: "Validation cancelled.",
          error: null,
        };
      }

      // A program-phase failure means the submitted file (or an imported
      // project module) itself crashed. Stop immediately: later cases would
      // fail for the same reason.
      if (!result.ok && result.phase !== "check") {
        outcomes.push({
          name: test.name,
          passed: false,
          message: result.error ?? "Program failed",
        });
        const where = result.file ? ` in ${result.file}` : "";
        return runtimeError(
          taskId,
          `Python runtime error${where}: ${result.error ?? "Program failed"}`,
          outcomes,
          testsTotal,
        );
      }

      outcomes.push(checkOutcome(test, result));

      if (result.truncated) {
        return runtimeError(
          taskId,
          "Output limit exceeded. Check for an endless print loop.",
          outcomes,
          testsTotal,
        );
      }
    }

    const passed = outcomes.filter((outcome) => outcome.passed).length;
    const allPassed = outcomes.length === testsTotal && passed === testsTotal;
    return {
      taskId,
      status: allPassed ? "passed" : "failed",
      testsPassed: passed,
      testsExecuted: outcomes.length,
      testsTotal,
      outcomes,
      message: allPassed
        ? `All ${testsTotal} task tests passed.`
        : `Passed ${passed} of ${testsTotal} task tests.`,
      error: null,
    };
  } finally {
    validationActive = false;
  }
}

/** Exposed for focused tests that assert the lock is released after a run. */
export function isCafeDevValidationActive(): boolean {
  return validationActive;
}
