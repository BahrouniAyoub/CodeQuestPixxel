import { describe, expect, it, vi } from "vitest";
import { evaluateTest, normalizeOutput, runTestSuite } from "./testing";
import type { PythonRunner, RunResult } from "./types";

const result = (overrides: Partial<RunResult> = {}): RunResult => ({
  engine: "pyodide", ok: true, stdout: "Hello, Pixel!\n", error: null,
  errorType: null, line: null, phase: null, truncated: false,
  timedOut: false, cancelled: false, durationMs: 1, ...overrides,
});

const mockRunner = (results: RunResult[]): PythonRunner => {
  const run = vi.fn().mockImplementation(async () => results.shift() ?? result());
  return { status: "ready", init: vi.fn(async () => {}), run,
    cancel: vi.fn(), subscribe: vi.fn(() => () => {}) };
};

describe("Python test evaluation", () => {
  const test = { name: "output", expectedStdout: "Hello, Pixel!" };

  it("normalizes line endings and trailing spaces", () => {
    expect(normalizeOutput("Hi  \r\nThere \r\n")).toBe("Hi\nThere");
    expect(evaluateTest(test, result()).passed).toBe(true);
  });

  it("rejects mismatched output", () => {
    const actual = evaluateTest(test, result({ stdout: "Wrong" }));
    expect(actual.passed).toBe(false);
    expect(actual.expected).toBe("Hello, Pixel!");
  });

  it.each([
    [{ ok: false, error: "SyntaxError" }, "SyntaxError"],
    [{ timedOut: true }, "Execution timed out"],
    [{ cancelled: true }, "Execution cancelled"],
    [{ truncated: true }, "Output limit exceeded"],
  ] as const)("rejects unsuccessful or incomplete execution %#", (overrides, message) => {
    const actual = evaluateTest(test, result(overrides));
    expect(actual.passed).toBe(false);
    expect(actual.message).toBe(message);
  });

  it("runs all tests and returns a passing suite", async () => {
    const runner = mockRunner([result(), result()]);
    const suite = await runTestSuite(runner, "print('Hello, Pixel!')", [test, test]);
    expect(suite).toMatchObject({ allPassed: true, passed: 2, total: 2, cancelled: false });
    expect(runner.run).toHaveBeenCalledTimes(2);
  });

  it("stops after cancellation and never reports success", async () => {
    const runner = mockRunner([result({ cancelled: true, ok: false })]);
    const suite = await runTestSuite(runner, "while True: pass", [test, test]);
    expect(suite).toMatchObject({ allPassed: false, passed: 0, total: 2, cancelled: true });
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it("fails a suite when one test fails", async () => {
    const runner = mockRunner([result(), result({ stdout: "No" })]);
    const suite = await runTestSuite(runner, "code", [test, test]);
    expect(suite).toMatchObject({ allPassed: false, passed: 1, total: 2 });
  });
});
