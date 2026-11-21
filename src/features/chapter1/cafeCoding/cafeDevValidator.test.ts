import { describe, expect, it, vi } from "vitest";
import type { PythonRunner, RunRequest, RunResult } from "@/services/runner/types";
import { CAFE_DEV_TASKS } from "./cafeDevTasks";
import { validateCafeDevTask } from "./cafeDevValidator";

function result(overrides: Partial<RunResult> = {}): RunResult {
  return {
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
  };
}

function runnerWith(
  implementation: (request: RunRequest) => Promise<RunResult> = async () => result(),
) {
  const run = vi.fn(implementation);
  const runner = {
    status: "ready" as const,
    init: vi.fn(async () => undefined),
    run,
    cancel: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
  } satisfies PythonRunner;
  return { runner, run };
}

const calculator = `
COFFEE_PRICE = 3
SANDWICH_PRICE = 5

def calculate_total(coffees, sandwiches):
    if not isinstance(coffees, int) or not isinstance(sandwiches, int):
        raise TypeError("quantities must be integers")
    if coffees < 0 or sandwiches < 0:
        raise ValueError("quantities cannot be negative")
    return coffees * COFFEE_PRICE + sandwiches * SANDWICH_PRICE

def apply_discount(total):
    if not isinstance(total, (int, float)):
        raise TypeError("subtotal must be a number")
    if total < 0:
        raise ValueError("subtotal cannot be negative")
    return total * 0.9 if total >= 20 else total
`;

const main = `
from calculator import calculate_total, apply_discount

print("Coffee:", 2)
print("Sandwich:", 1)
print("Subtotal:", 11)
print("Discount:", 0)
print("Order total:", 11)
`;

const invalid = "Invalid quantity. Enter a whole number of 0 or more.";

/** Produce a valid receipt matching the requested stdin for the mock runner. */
function receiptFor(stdin: readonly string[]): string {
  const key = stdin.join(",");
  switch (key) {
    case "2,3":
      return "Coffee: 2\nSandwich: 3\nSubtotal: $21.00\nDiscount: $2.10\nTotal: $18.90";
    case "0,0":
      return "Coffee: 0\nSandwich: 0\nSubtotal: $0.00\nDiscount: $0.00\nTotal: $0.00";
    case "3,2":
      return "Coffee: 3\nSandwich: 2\nSubtotal: $19.00\nDiscount: $0.00\nTotal: $19.00";
    case "4,2":
      return "Coffee: 4\nSandwich: 2\nSubtotal: $22.00\nDiscount: $2.20\nTotal: $19.80";
    case "5,1":
      return "Coffee: 5\nSandwich: 1\nSubtotal: $20.00\nDiscount: $2.00\nTotal: $18.00";
    case "4,1":
      return "Coffee: 4\nSandwich: 1\nSubtotal: $17.00\nDiscount: $0.00\nTotal: $17.00";
    case "1,1":
      return "Coffee: 1\nSandwich: 1\nSubtotal: $123.45\nDiscount: $73.45\nTotal: $50.00";
    default:
      return `${invalid}\n`;
  }
}

describe("café development validator", () => {
  it("runs calculator.py directly for the pricing and discount tasks", async () => {
    const { runner, run } = runnerWith();
    const first = await validateCafeDevTask(runner, "CAFE-DEV-01", {
      "calculator.py": calculator,
    });
    const second = await validateCafeDevTask(runner, "CAFE-DEV-02", {
      "calculator.py": calculator,
    });

    expect(first.status).toBe("passed");
    expect(first.testsPassed).toBe(6);
    expect(first.testsTotal).toBe(6);
    expect(second.status).toBe("passed");
    expect(second.testsPassed).toBe(8);
    expect(second.testsTotal).toBe(8);
    expect(run.mock.calls[0]?.[0].code).toBe(calculator);
    expect(run.mock.calls[0]?.[0].projectModules).toBeUndefined();
  });

  it("runs main.py with calculator.py as a fresh project module", async () => {
    const { runner, run } = runnerWith(async (request) =>
      result({ stdout: receiptFor(request.stdin) }),
    );
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-03", {
      "calculator.py": calculator,
      "main.py": main,
    });

    expect(validation.status).toBe("passed");
    expect(run).toHaveBeenCalledTimes(6);
    expect(run.mock.calls[0]?.[0]).toMatchObject({
      code: main,
      stdin: ["2", "3"],
      projectModules: [{ name: "calculator", content: calculator }],
    });
  });

  it("accepts flexible receipt labels and currency formatting", async () => {
    const { runner } = runnerWith(async (request) =>
      result({
        stdout:
          request.stdin.join(",") === "2,3"
            ? "Coffees = 2\nSandwiches = 3\nSUB TOTAL = $21.00\nDiscount = -$2.10\nGrand total = $18.90"
            : receiptFor(request.stdin),
      }),
    );
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-03", {
      "calculator.py": calculator,
      "main.py": main,
    });

    expect(validation.status).toBe("passed");
    expect(validation.testsPassed).toBe(6);
  });

  it("reports missing receipt values without completing the task", async () => {
    const { runner } = runnerWith(async () => result({ stdout: "Coffee: 2" }));
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-03", {
      "calculator.py": calculator,
      "main.py": main,
    });

    expect(validation.status).toBe("failed");
    expect(validation.testsPassed).toBe(0);
    expect(validation.outcomes[0]?.expected).toMatch(/sandwich/i);
  });

  it("treats forbidden output such as a traceback as a failure", async () => {
    const { runner } = runnerWith(async () =>
      result({
        stdout:
          "Coffee: 2\nSandwich: 3\nSubtotal: $21.00\nDiscount: $2.10\nTotal: $18.90\n" +
          `${invalid}\nTraceback (most recent call last):`,
      }),
    );
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-03", {
      "calculator.py": calculator,
      "main.py": main,
    });

    expect(validation.status).toBe("failed");
    expect(validation.outcomes.some((outcome) => /must not contain/i.test(outcome.message))).toBe(
      true,
    );
  });

  it("uses a controlled calculator module to prove main.py calls it", async () => {
    const { runner, run } = runnerWith(async (request) =>
      result({ stdout: receiptFor(request.stdin) }),
    );
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-04", {
      "calculator.py": calculator,
      "main.py": main,
    });

    expect(validation.status).toBe("passed");
    const dependencyCall = run.mock.calls.find(
      (call) => call[0].projectModules?.[0]?.content.includes("123.45") === true,
    );
    expect(dependencyCall?.[0].stdin).toEqual(["1", "1"]);
    expect(dependencyCall?.[0].projectModules).toEqual([
      {
        name: "calculator",
        content:
          "COFFEE_PRICE = 7\n" +
          "SANDWICH_PRICE = 11\n\n" +
          "def calculate_total(coffees, sandwiches):\n" +
          "    return 123.45\n\n" +
          "def apply_discount(total):\n" +
          "    return 50.0\n",
      },
    ]);
  });

  it("stops immediately on a program-phase runtime error", async () => {
    const { runner, run } = runnerWith(async () =>
      result({
        ok: false,
        error: "NameError: name 'calculate_total' is not defined",
        errorType: "NameError",
        phase: "program",
        file: "main.py",
      }),
    );
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-03", {
      "calculator.py": calculator,
      "main.py": main,
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(validation.status).toBe("runtime-error");
    expect(validation.error).toMatch(/main\.py/);
  });

  it("does not run an empty primary file", async () => {
    const { runner, run } = runnerWith();
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-01", {
      "calculator.py": "   \n",
    });

    expect(run).not.toHaveBeenCalled();
    expect(validation.status).toBe("failed");
    expect(validation.message).toMatch(/calculator\.py/i);
  });

  it("does not run main.py when calculator.py is empty", async () => {
    const { runner, run } = runnerWith();
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-04", {
      "calculator.py": "",
      "main.py": main,
    });

    expect(run).not.toHaveBeenCalled();
    expect(validation.status).toBe("failed");
    expect(validation.message).toMatch(/calculator\.py/i);
  });

  it("reports timeouts as runtime errors", async () => {
    const { runner } = runnerWith(async () =>
      result({ ok: false, timedOut: true, error: "Execution timed out." }),
    );
    const validation = await validateCafeDevTask(runner, "CAFE-DEV-01", {
      "calculator.py": calculator,
    });

    expect(validation.status).toBe("runtime-error");
    expect(validation.error).toMatch(/timed out/i);
  });
});

describe("café development task data", () => {
  it("supplies stdin for every test that executes the interactive main.py", () => {
    // The runner always executes the primary file before the optional check, so
    // a check-only case still runs main.py. Leaving stdin empty makes a correct
    // interactive program raise EOFError before the assertion can run.
    for (const task of CAFE_DEV_TASKS.filter((item) => item.primaryFile === "main.py")) {
      for (const test of task.tests) {
        expect(
          test.stdin?.length ?? 0,
          `${task.id} · ${test.name} must provide stdin`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
