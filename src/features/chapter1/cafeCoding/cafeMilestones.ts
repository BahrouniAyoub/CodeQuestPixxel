/**
 * Canonical definitions for the Chapter 1 café coding project.
 *
 * This module is pure data. It is shared by the Python editor panel, the
 * Pyodide validator, the milestone persistence layer, and GigBoard. Keep the
 * three milestones ordered: progress is stored as a prefix of this array.
 */

export const CAFE_MILESTONE_IDS = [
  "variables-print",
  "arithmetic-functions",
  "conditional-discounts",
] as const;

export type CafeMilestoneId = (typeof CAFE_MILESTONE_IDS)[number];

export interface CafeMilestoneTestCase {
  /** Human-readable test name shown in the editor feedback. */
  readonly name: string;
  /** Python assertions executed in the same namespace as the submitted file. */
  readonly pythonCheck: string;
  /** Optional values that must appear in the program's stdout. */
  readonly stdoutNumbers?: readonly number[];
}

export interface CafeMilestoneDefinition {
  readonly id: CafeMilestoneId;
  readonly index: number;
  readonly title: string;
  readonly description: string;
  readonly instructions: readonly string[];
  readonly example: string;
  readonly displayFileName: string;
  readonly filePath: string;
  readonly starterCode: string;
  readonly tests: readonly CafeMilestoneTestCase[];
}

const CAFE_PROJECT_DIRECTORY = "/Projects/Python";

export const CAFE_MILESTONES: readonly CafeMilestoneDefinition[] = [
  {
    id: "variables-print",
    index: 0,
    title: "Variables and print",
    description: "Store the café item prices in Python variables and print a readable receipt.",
    instructions: [
      "Create a variable named coffee_price and set it to 3.",
      "Create a variable named sandwich_price and set it to 5.",
      "Print both item prices so Alex can see the receipt.",
    ],
    example: "Example output:\nCoffee: 3\nSandwich: 5",
    displayFileName: "cafe_milestone_1.py",
    filePath: `${CAFE_PROJECT_DIRECTORY}/cafe_milestone_1.py`,
    starterCode: `# Café Order Calculator — Milestone 1
# Alex wants a simple receipt for the café.
#
# 1. Create a variable named coffee_price with the value 3.
# 2. Create a variable named sandwich_price with the value 5.
# 3. Print both prices.
`,
    tests: [
      {
        name: "coffee_price is 3",
        pythonCheck: 'assert coffee_price == 3, f"coffee_price should be 3, got {coffee_price!r}"',
      },
      {
        name: "sandwich_price is 5",
        pythonCheck:
          'assert sandwich_price == 5, f"sandwich_price should be 5, got {sandwich_price!r}"',
      },
      {
        name: "prints both item prices",
        pythonCheck: "pass",
        stdoutNumbers: [3, 5],
      },
    ],
  },
  {
    id: "arithmetic-functions",
    index: 1,
    title: "Arithmetic and functions",
    description: "Calculate order totals with reusable arithmetic in a Python function.",
    instructions: [
      "Coffee costs $3 and a sandwich costs $5.",
      "Implement calculate_total(coffees, sandwiches).",
      "Return the order total for the requested quantities.",
    ],
    example:
      "calculate_total(2, 1) → 11\ncalculate_total(0, 2) → 10\ncalculate_total(3, 0) → 9\ncalculate_total(1, 1) → 8",
    displayFileName: "cafe_milestone_2.py",
    filePath: `${CAFE_PROJECT_DIRECTORY}/cafe_milestone_2.py`,
    starterCode: `# Café Order Calculator — Milestone 2
# Coffee costs $3 and a sandwich costs $5.
#
# Implement calculate_total(coffees, sandwiches).
# It should return the total price for the order.

def calculate_total(coffees, sandwiches):
    # TODO: calculate and return the order total.
    pass
`,
    tests: [
      {
        name: "calculate_total(2, 1) returns 11",
        pythonCheck:
          '_result = calculate_total(2, 1)\nassert _result == 11, f"calculate_total(2, 1) returned {_result!r}, expected 11"',
      },
      {
        name: "calculate_total(0, 2) returns 10",
        pythonCheck:
          '_result = calculate_total(0, 2)\nassert _result == 10, f"calculate_total(0, 2) returned {_result!r}, expected 10"',
      },
      {
        name: "calculate_total(3, 0) returns 9",
        pythonCheck:
          '_result = calculate_total(3, 0)\nassert _result == 9, f"calculate_total(3, 0) returned {_result!r}, expected 9"',
      },
      {
        name: "calculate_total(1, 1) returns 8",
        pythonCheck:
          '_result = calculate_total(1, 1)\nassert _result == 8, f"calculate_total(1, 1) returned {_result!r}, expected 8"',
      },
    ],
  },
  {
    id: "conditional-discounts",
    index: 2,
    title: "Conditional discounts",
    description: "Apply a 10% discount only when an order total is $20 or more.",
    instructions: [
      "Implement apply_discount(total).",
      "If the total is $20 or more, return 90% of the total.",
      "Otherwise, return the original total unchanged.",
    ],
    example:
      "apply_discount(10) → 10\napply_discount(19) → 19\napply_discount(20) → 18\napply_discount(30) → 27\napply_discount(50) → 45",
    displayFileName: "cafe_milestone_3.py",
    filePath: `${CAFE_PROJECT_DIRECTORY}/cafe_milestone_3.py`,
    starterCode: `# Café Order Calculator — Milestone 3
# Apply a 10% discount when the order total is $20 or more.
# Otherwise return the original total.
#
# Implement apply_discount(total).

def apply_discount(total):
    # TODO: apply the café discount rule and return the final total.
    pass
`,
    tests: [
      {
        name: "apply_discount(10) returns 10",
        pythonCheck:
          '_result = apply_discount(10)\nassert abs(_result - 10) < 1e-9, f"apply_discount(10) returned {_result!r}, expected 10"',
      },
      {
        name: "apply_discount(19) returns 19",
        pythonCheck:
          '_result = apply_discount(19)\nassert abs(_result - 19) < 1e-9, f"apply_discount(19) returned {_result!r}, expected 19"',
      },
      {
        name: "threshold: apply_discount(20) returns 18",
        pythonCheck:
          '_result = apply_discount(20)\nassert abs(_result - 18) < 1e-9, f"apply_discount(20) returned {_result!r}, expected 18"',
      },
      {
        name: "apply_discount(30) returns 27",
        pythonCheck:
          '_result = apply_discount(30)\nassert abs(_result - 27) < 1e-9, f"apply_discount(30) returned {_result!r}, expected 27"',
      },
      {
        name: "apply_discount(50) returns 45",
        pythonCheck:
          '_result = apply_discount(50)\nassert abs(_result - 45) < 1e-9, f"apply_discount(50) returned {_result!r}, expected 45"',
      },
    ],
  },
] as const;

export const CAFE_MILESTONE_COUNT = CAFE_MILESTONES.length;

const CAFE_MILESTONE_ID_SET: ReadonlySet<string> = new Set(CAFE_MILESTONE_IDS);

export function isCafeMilestoneId(value: unknown): value is CafeMilestoneId {
  return typeof value === "string" && CAFE_MILESTONE_ID_SET.has(value);
}

export function getCafeMilestone(id: CafeMilestoneId): CafeMilestoneDefinition {
  const milestone = CAFE_MILESTONES.find((item) => item.id === id);
  if (!milestone) throw new Error(`Unknown café milestone: ${id}`);
  return milestone;
}

export function getCafeMilestoneByIndex(index: number): CafeMilestoneDefinition | null {
  return CAFE_MILESTONES[index] ?? null;
}
