import { describe, expect, it, vi } from "vitest";
import type { PythonRunner, RunResult } from "@/services/runner/types";
import { isCafeMilestoneValidationActive, validateCafeMilestone } from "./cafeMilestoneValidator";

const okResult = (overrides: Partial<RunResult> = {}): RunResult => ({
  engine: "pyodide",
  ok: true,
  stdout: "",
  error: null,
  errorType: null,
  line: null,
  phase: null,
  truncated: false,
  timedOut: false,
  cancelled: false,
  durationMs: 1,
  ...overrides,
});

const failedCheck = (message: string): RunResult =>
  okResult({
    ok: false,
    phase: "check",
    errorType: "AssertionError",
    error: message,
  });

function queuedRunner(results: RunResult[]): PythonRunner {
  const run = vi.fn(async () => results.shift() ?? okResult());
  return {
    status: "ready",
    init: vi.fn(async () => undefined),
    run,
    cancel: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("café milestone Pyodide validation", () => {
  it("passes a correct milestone 1 solution with variable and output checks", async () => {
    const runner = queuedRunner([
      okResult(),
      okResult(),
      okResult({ stdout: "Coffee: $3.00\nSandwich: $5.00\n" }),
    ]);

    const result = await validateCafeMilestone(runner, "variables-print", "coffee_price = 3");

    expect(result.status).toBe("passed");
    expect(result.testsPassed).toBe(3);
    expect(result.testsExecuted).toBe(3);
    expect(result.testsTotal).toBe(3);
    expect(result.outcomes.every((outcome) => outcome.passed)).toBe(true);
    expect(runner.run).toHaveBeenCalledTimes(3);
    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        check: expect.stringContaining("coffee_price == 3"),
        echoPrompts: false,
      }),
    );
  });

  it("rejects a hardcoded print-only milestone 1 solution", async () => {
    const runner = queuedRunner([
      failedCheck("NameError: name 'coffee_price' is not defined"),
      failedCheck("NameError: name 'sandwich_price' is not defined"),
      okResult({ stdout: "3\n5\n" }),
    ]);

    const result = await validateCafeMilestone(runner, "variables-print", 'print("3")\nprint("5")');

    expect(result.status).toBe("failed");
    expect(result.testsPassed).toBe(1);
    expect(result.outcomes[0]).toMatchObject({
      name: "coffee_price is 3",
      passed: false,
    });
    expect(result.outcomes[0]?.message).toContain("coffee_price");
  });

  it("passes a correct milestone 2 function with four independent cases", async () => {
    const runner = queuedRunner([okResult(), okResult(), okResult(), okResult()]);

    const result = await validateCafeMilestone(
      runner,
      "arithmetic-functions",
      "def calculate_total(coffees, sandwiches):\n    return coffees * 3 + sandwiches * 5",
    );

    expect(result.status).toBe("passed");
    expect(result.testsPassed).toBe(4);
    expect(result.testsExecuted).toBe(4);
    expect(runner.run).toHaveBeenCalledTimes(4);
  });

  it("rejects a hardcoded milestone 2 return that only works for one example", async () => {
    const runner = queuedRunner([
      okResult(),
      okResult(),
      okResult(),
      failedCheck("calculate_total(1, 1) returned 11, expected 8"),
    ]);

    const result = await validateCafeMilestone(
      runner,
      "arithmetic-functions",
      "def calculate_total(coffees, sandwiches):\n    return 11",
    );

    expect(result.status).toBe("failed");
    expect(result.testsPassed).toBe(3);
    expect(result.outcomes[3]?.message).toContain("expected 8");
  });

  it("passes a correct milestone 3 solution and checks the $20 boundary", async () => {
    const runner = queuedRunner([okResult(), okResult(), okResult(), okResult(), okResult()]);

    const result = await validateCafeMilestone(
      runner,
      "conditional-discounts",
      "def apply_discount(total):\n    return total * 0.9 if total >= 20 else total",
    );

    expect(result.status).toBe("passed");
    expect(result.testsPassed).toBe(5);
    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        check: expect.stringContaining("apply_discount(20)"),
      }),
    );
  });

  it("fails at the threshold when $20 is not discounted", async () => {
    const runner = queuedRunner([
      okResult(),
      okResult(),
      failedCheck("apply_discount(20) returned 20, expected 18"),
      okResult(),
      okResult(),
    ]);

    const result = await validateCafeMilestone(
      runner,
      "conditional-discounts",
      "def apply_discount(total):\n    return total * 0.9 if total > 20 else total",
    );

    expect(result.status).toBe("failed");
    expect(result.testsPassed).toBe(4);
    expect(result.outcomes[2]).toMatchObject({
      name: "threshold: apply_discount(20) returns 18",
      passed: false,
    });
  });

  it("reports program runtime errors without running every remaining case", async () => {
    const runner = queuedRunner([
      okResult({
        ok: false,
        phase: "program",
        errorType: "ZeroDivisionError",
        error: "ZeroDivisionError: division by zero",
      }),
    ]);

    const result = await validateCafeMilestone(
      runner,
      "arithmetic-functions",
      "def calculate_total(coffees, sandwiches):\n    return 1 / 0",
    );

    expect(result.status).toBe("runtime-error");
    expect(result.testsPassed).toBe(0);
    expect(result.testsExecuted).toBe(1);
    expect(result.error).toContain("ZeroDivisionError");
    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(isCafeMilestoneValidationActive()).toBe(false);
  });

  it("returns structured feedback for partial failures", async () => {
    const runner = queuedRunner([
      okResult(),
      failedCheck("Expected 19, got 10"),
      failedCheck("Expected 18, got 20"),
      failedCheck("Expected 27, got 30"),
      failedCheck("Expected 45, got 50"),
    ]);

    const result = await validateCafeMilestone(
      runner,
      "conditional-discounts",
      "def apply_discount(total):\n    return total",
    );

    expect(result.status).toBe("failed");
    expect(result.message).toBe("Passed 1 of 5 milestone tests.");
    expect(result.outcomes).toHaveLength(5);
    expect(result.outcomes[2]).toMatchObject({
      name: "threshold: apply_discount(20) returns 18",
      passed: false,
      message: "Expected 18, got 20",
    });
  });

  it("rejects empty code before touching the runner", async () => {
    const runner = queuedRunner([okResult()]);

    const result = await validateCafeMilestone(runner, "variables-print", "   \n");

    expect(result.status).toBe("failed");
    expect(result.message).toMatch(/write some python/i);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it("blocks overlapping validation requests and releases the lock afterwards", async () => {
    const gate = deferred<RunResult>();
    const run = vi.fn(async () => gate.promise);
    const runner: PythonRunner = {
      status: "ready",
      init: vi.fn(async () => undefined),
      run,
      cancel: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
    };

    const first = validateCafeMilestone(runner, "variables-print", "coffee_price = 3");
    const second = await validateCafeMilestone(runner, "variables-print", "coffee_price = 3");

    expect(second.status).toBe("busy");
    expect(second.testsExecuted).toBe(0);

    gate.resolve(okResult({ stdout: "3\n5" }));
    const firstResult = await first;
    expect(firstResult.status).toBe("passed");
    expect(isCafeMilestoneValidationActive()).toBe(false);
  });

  it("reports timeouts as runtime errors", async () => {
    const runner = queuedRunner([
      okResult({ ok: false, timedOut: true, error: "Execution timed out" }),
    ]);

    const result = await validateCafeMilestone(runner, "variables-print", "while True: pass");

    expect(result.status).toBe("runtime-error");
    expect(result.message).toMatch(/timed out/i);
    expect(result.testsExecuted).toBe(1);
  });
});
