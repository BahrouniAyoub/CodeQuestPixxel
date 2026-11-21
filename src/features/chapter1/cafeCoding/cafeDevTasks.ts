/**
 * Canonical definitions for the real café calculator development project.
 *
 * The four development tasks replace the old disconnected exercises for new
 * saves. They are ordered: progress is stored as a strict prefix of this array.
 * Files are created by the player during the setup phase; this module contains
 * no starter code and never writes to the workspace.
 */

export const CAFE_DEV_TASK_IDS = [
  "CAFE-DEV-01",
  "CAFE-DEV-02",
  "CAFE-DEV-03",
  "CAFE-DEV-04",
] as const;

export type CafeDevTaskId = (typeof CAFE_DEV_TASK_IDS)[number];

export const CAFE_DEV_PROJECT_DIRECTORY = "/Projects/Python/cafe-calculator";

export const CAFE_DEV_FILE_NAMES = ["calculator.py", "main.py"] as const;

export type CafeDevFileName = (typeof CAFE_DEV_FILE_NAMES)[number];

export type CafeDevFileContents = Readonly<Partial<Record<CafeDevFileName, string>>>;

/**
 * A project module supplied to one isolated test run. Most tests only need the
 * saved calculator.py; task 4 uses a controlled module to prove that main.py
 * actually calls the calculator instead of duplicating its logic.
 */
export interface CafeDevTestModule {
  /** Import name without the `.py` extension. */
  readonly name: string;
  /** Python source used only for this test run. */
  readonly content: string;
}

export interface CafeDevTestCase {
  /** Human-readable test name shown in the task feedback. */
  readonly name: string;
  /** Lines supplied to input() for interactive scenarios. */
  readonly stdin?: readonly string[];
  /** Python assertions executed after the program in the same namespace. */
  readonly pythonCheck?: string;
  /** Case-insensitive substrings that must appear in the program output. */
  readonly stdoutContains?: readonly string[];
  /** Case-insensitive regular expressions that must match the program output. */
  readonly stdoutMatches?: readonly string[];
  /** Case-insensitive substrings that must not appear in the output. */
  readonly stdoutNotContains?: readonly string[];
  /** Case-insensitive regular expressions that must not match the output. */
  readonly stdoutNotMatches?: readonly string[];
  /** Optional modules that replace the task's default project modules. */
  readonly modules?: readonly CafeDevTestModule[];
}

export interface CafeDevTaskDefinition {
  readonly id: CafeDevTaskId;
  readonly index: number;
  readonly title: string;
  readonly description: string;
  readonly expectedBehavior: string;
  readonly instructions: readonly string[];
  readonly example: string;
  readonly hints: readonly string[];
  /** File the editor opens when the player starts the task. */
  readonly primaryFile: CafeDevFileName;
  /** Every saved file required to verify the task. */
  readonly files: readonly CafeDevFileName[];
  readonly tests: readonly CafeDevTestCase[];
}

const CALCULATOR = "calculator.py" as const;
const MAIN = "main.py" as const;

/** Shared Python helper that asserts a call raises instead of returning a value. */
function rejectsCall(call: string, description: string): string {
  return (
    `try:\n` +
    `    ${call}\n` +
    `except (ValueError, TypeError):\n` +
    `    pass\n` +
    `else:\n` +
    `    raise AssertionError(f"${description}")`
  );
}

// Receipt patterns are intentionally tolerant: labels may be upper/lower case,
// use "Coffee" or "Coffees", include currency symbols, and format 18.9 as
// 18.90. The checks still verify the actual order values.
const receiptPatterns = {
  twoCoffeesThreeSandwiches: [
    String.raw`coffees?\s*[:=]?\s*\$?\s*2\b`,
    String.raw`sandwich(?:es)?\s*[:=]?\s*\$?\s*3\b`,
    String.raw`sub\s*total\s*[:=]?\s*\$?\s*21(?:\.0+)?\b`,
    String.raw`discount\s*[:=]?\s*-?\$?\s*2\.1(?:0+)?\b`,
    String.raw`(?<![a-z])(?:order\s+|grand\s+)?total\s*[:=]?\s*\$?\s*18\.9(?:0+)?\b`,
  ],
  emptyOrder: [
    String.raw`coffees?\s*[:=]?\s*\$?\s*0\b`,
    String.raw`sandwich(?:es)?\s*[:=]?\s*\$?\s*0\b`,
    String.raw`sub\s*total\s*[:=]?\s*\$?\s*0(?:\.0+)?\b`,
    String.raw`discount\s*[:=]?\s*-?\$?\s*0(?:\.0+)?\b`,
    String.raw`(?<![a-z])(?:order\s+|grand\s+)?total\s*[:=]?\s*\$?\s*0(?:\.0+)?\b`,
  ],
  belowThreshold: [
    String.raw`sub\s*total\s*[:=]?\s*\$?\s*19(?:\.0+)?\b`,
    String.raw`discount\s*[:=]?\s*-?\$?\s*0(?:\.0+)?\b`,
    String.raw`(?<![a-z])(?:order\s+|grand\s+)?total\s*[:=]?\s*\$?\s*19(?:\.0+)?\b`,
  ],
  discountedOrder: [
    String.raw`sub\s*total\s*[:=]?\s*\$?\s*22(?:\.0+)?\b`,
    String.raw`discount\s*[:=]?\s*-?\$?\s*2\.2(?:0+)?\b`,
    String.raw`(?<![a-z])(?:order\s+|grand\s+)?total\s*[:=]?\s*\$?\s*19\.8(?:0+)?\b`,
  ],
  boundaryOrder: [
    String.raw`sub\s*total\s*[:=]?\s*\$?\s*20(?:\.0+)?\b`,
    String.raw`discount\s*[:=]?\s*-?\$?\s*2(?:\.0+)?\b`,
    String.raw`(?<![a-z])(?:order\s+|grand\s+)?total\s*[:=]?\s*\$?\s*18(?:\.0+)?\b`,
  ],
  justBelowThreshold: [
    String.raw`sub\s*total\s*[:=]?\s*\$?\s*17(?:\.0+)?\b`,
    String.raw`discount\s*[:=]?\s*-?\$?\s*0(?:\.0+)?\b`,
    String.raw`(?<![a-z])(?:order\s+|grand\s+)?total\s*[:=]?\s*\$?\s*17(?:\.0+)?\b`,
  ],
};

/**
 * Accepts many friendly invalid-input messages without requiring exact wording.
 * This is an alternation: any one of the friendly phrasings is enough.
 */
const invalidInputPattern = [
  String.raw`(?:invalid|not\s+(?:a\s+)?(?:valid|number|whole)|whole\s+number|non-?negative|negative|0\s+or\s+more|must\s+be\s+(?:a\s+)?(?:positive|whole|number|0)|enter\s+(?:a\s+)?(?:valid\s+|whole\s+)?number|try\s+again|please\s+(?:enter|provide))`,
];

export const CAFE_DEV_TASKS: readonly CafeDevTaskDefinition[] = [
  {
    id: "CAFE-DEV-01",
    index: 0,
    title: "Order totals",
    description:
      "Build the pricing core of Alex's café calculator in calculator.py. Coffee costs $3 and a sandwich costs $5.",
    expectedBehavior:
      "calculate_total(coffees, sandwiches) returns the correct price before discounts for whole-number quantities, including zero. Negative quantities and invalid quantity types are rejected instead of producing a wrong total.",
    instructions: [
      "Open calculator.py from the project folder.",
      "Implement calculate_total(coffees, sandwiches) using the $3 coffee and $5 sandwich prices.",
      "Return the total. Zero coffees and zero sandwiches are valid and should return zero.",
      "Reject negative quantities and values that are not whole numbers with an exception (for example ValueError or TypeError).",
      "Save calculator.py, then verify the task in Tickets.",
    ],
    example:
      "calculate_total(1, 1) → 8\ncalculate_total(2, 3) → 21\ncalculate_total(0, 0) → 0\ncalculate_total(-1, 1) → rejected with an error",
    hints: [
      "A function receives its inputs as parameters and uses return to send the answer back to the caller.",
      "Multiply the number of coffees by the coffee price and the number of sandwiches by the sandwich price, then add the two products.",
      "Before multiplying, check each quantity. Raise ValueError for negative values and TypeError for values that are not integers. Named constants such as COFFEE_PRICE = 3 make the prices easier to maintain.",
    ],
    primaryFile: CALCULATOR,
    files: [CALCULATOR],
    tests: [
      {
        name: "calculate_total(1, 1) returns 8",
        pythonCheck:
          '_result = calculate_total(1, 1)\nassert abs(_result - 8) < 1e-9, f"calculate_total(1, 1) returned {_result!r}, expected 8"',
      },
      {
        name: "calculate_total(2, 3) returns 21",
        pythonCheck:
          '_result = calculate_total(2, 3)\nassert abs(_result - 21) < 1e-9, f"calculate_total(2, 3) returned {_result!r}, expected 21"',
      },
      {
        name: "calculate_total(0, 0) returns 0",
        pythonCheck:
          '_result = calculate_total(0, 0)\nassert abs(_result - 0) < 1e-9, f"calculate_total(0, 0) returned {_result!r}, expected 0"',
      },
      {
        name: "supports zero quantities and larger orders",
        pythonCheck:
          '_zero_coffee = calculate_total(0, 5)\nassert abs(_zero_coffee - 25) < 1e-9, f"calculate_total(0, 5) returned {_zero_coffee!r}, expected 25"\n' +
          '_zero_sandwich = calculate_total(4, 0)\nassert abs(_zero_sandwich - 12) < 1e-9, f"calculate_total(4, 0) returned {_zero_sandwich!r}, expected 12"',
      },
      {
        name: "rejects negative quantities",
        pythonCheck:
          rejectsCall("calculate_total(-1, 0)", "calculate_total(-1, 0) must not return a total") +
          "\n" +
          rejectsCall("calculate_total(0, -1)", "calculate_total(0, -1) must not return a total") +
          "\n" +
          rejectsCall("calculate_total(-2, -3)", "negative quantities must be rejected"),
      },
      {
        name: "rejects invalid quantity types",
        pythonCheck:
          rejectsCall(
            'calculate_total("2", 1)',
            "a text quantity must be rejected instead of producing a total",
          ) +
          "\n" +
          rejectsCall(
            "calculate_total(1, None)",
            "a missing quantity must be rejected instead of producing a total",
          ),
      },
    ],
  },
  {
    id: "CAFE-DEV-02",
    index: 1,
    title: "Discount rules",
    description:
      "Add Alex's 10% discount rule to the same calculator.py file. Orders of $20 or more receive 10% off; smaller orders pay full price.",
    expectedBehavior:
      "apply_discount(total) returns the subtotal unchanged below $20 and returns 90% of the subtotal at $20 or more. Negative or non-numeric subtotals are rejected.",
    instructions: [
      "Keep working in the same calculator.py from Task 1; do not create a second exercise file.",
      "Implement apply_discount(total).",
      "Below $20, return the subtotal unchanged. At $20 or more, return 90% of the subtotal.",
      "Reject negative or non-numeric subtotals with an exception.",
      "Save calculator.py, then verify. The tests also re-check calculate_total from Task 1.",
    ],
    example:
      "apply_discount(10) → 10\napply_discount(19.99) → 19.99\napply_discount(20) → 18\napply_discount(20.01) → 18.009\napply_discount(30) → 27",
    hints: [
      "Use an if statement to compare the subtotal with 20.",
      "The threshold is inclusive: a subtotal of exactly 20 receives the discount.",
      "A 10% discount means the customer pays 90%, so multiply qualifying subtotals by 0.9. Validate the input before comparing it.",
    ],
    primaryFile: CALCULATOR,
    files: [CALCULATOR],
    tests: [
      {
        name: "apply_discount(10) returns 10",
        pythonCheck:
          '_result = apply_discount(10)\nassert abs(_result - 10) < 1e-9, f"apply_discount(10) returned {_result!r}, expected 10"',
      },
      {
        name: "orders just below $20 pay full price",
        pythonCheck:
          '_result = apply_discount(19.99)\nassert abs(_result - 19.99) < 1e-9, f"apply_discount(19.99) returned {_result!r}, expected 19.99"',
      },
      {
        name: "discount boundary: apply_discount(20) returns 18",
        pythonCheck:
          '_result = apply_discount(20)\nassert abs(_result - 18) < 1e-9, f"apply_discount(20) returned {_result!r}, expected 18"',
      },
      {
        name: "orders just above $20 receive the discount",
        pythonCheck:
          '_result = apply_discount(20.01)\nassert abs(_result - 18.009) < 1e-9, f"apply_discount(20.01) returned {_result!r}, expected 18.009"',
      },
      {
        name: "apply_discount(30) returns 27",
        pythonCheck:
          '_result = apply_discount(30)\nassert abs(_result - 27) < 1e-9, f"apply_discount(30) returned {_result!r}, expected 27"',
      },
      {
        name: "rejects negative subtotals",
        pythonCheck: rejectsCall(
          "apply_discount(-1)",
          "apply_discount(-1) must not return a total",
        ),
      },
      {
        name: "rejects invalid subtotal types",
        pythonCheck:
          rejectsCall(
            'apply_discount("20")',
            "a text subtotal must be rejected instead of producing a total",
          ) +
          "\n" +
          rejectsCall(
            "apply_discount(None)",
            "a missing subtotal must be rejected instead of producing a total",
          ),
      },
      {
        name: "previous order total calculation still works",
        pythonCheck:
          '_one_each = calculate_total(1, 1)\nassert abs(_one_each - 8) < 1e-9, f"calculate_total(1, 1) returned {_one_each!r}, expected 8"\n' +
          '_mixed = calculate_total(2, 3)\nassert abs(_mixed - 21) < 1e-9, f"calculate_total(2, 3) returned {_mixed!r}, expected 21"',
      },
    ],
  },
  {
    id: "CAFE-DEV-03",
    index: 2,
    title: "Interactive order",
    description:
      "Write main.py so a customer can enter quantities and receive a readable receipt. Use the pricing and discount functions from calculator.py instead of copying them.",
    expectedBehavior:
      "main.py imports calculator.py, reads coffee and sandwich quantities with input(), and prints a receipt showing both items, the subtotal, the discount, and the final total. Invalid or negative quantities show a friendly message instead of crashing.",
    instructions: [
      "Open main.py from the project folder.",
      "Import calculate_total and apply_discount from calculator. Do not duplicate the pricing or discount rules.",
      "Ask for the number of coffees and sandwiches with input(), converting each answer to a whole number.",
      "If an answer is negative or not a number, print a helpful message and stop without a traceback.",
      "Print a receipt with the two item quantities, subtotal, discount, and final total. Acceptable formatting is flexible.",
      "Save main.py, then verify the task in Tickets.",
    ],
    example:
      "Welcome to Alex's Café!\nHow many coffees? 2\nHow many sandwiches? 3\n\n----- RECEIPT -----\nCoffees: 2\nSandwiches: 3\nSubtotal: $21.00\nDiscount: $2.10\nTotal: $18.90\n-------------------",
    hints: [
      "input() returns text. Convert each answer with int() inside a try/except ValueError block.",
      "Read and validate both quantities before calculating. Check for negative values, then call calculate_total() and apply_discount() from calculator.",
      'Put the program in main() and call it from if __name__ == "__main__":. For an invalid value, print a friendly message and return. The discount amount is the subtotal minus the final total.',
    ],
    primaryFile: MAIN,
    files: [CALCULATOR, MAIN],
    tests: [
      {
        name: "prints a complete receipt for 2 coffees and 3 sandwiches",
        stdin: ["2", "3"],
        stdoutMatches: receiptPatterns.twoCoffeesThreeSandwiches,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "supports an empty order",
        stdin: ["0", "0"],
        stdoutMatches: receiptPatterns.emptyOrder,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "applies no discount below $20",
        stdin: ["3", "2"],
        stdoutMatches: receiptPatterns.belowThreshold,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "applies the 10% discount at $20 or more",
        stdin: ["4", "2"],
        stdoutMatches: receiptPatterns.discountedOrder,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "rejects negative quantities gracefully",
        stdin: ["-1", "2"],
        stdoutMatches: invalidInputPattern,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "rejects non-numeric quantities gracefully",
        stdin: ["two", "1"],
        stdoutMatches: invalidInputPattern,
        stdoutNotContains: ["traceback"],
      },
    ],
  },
  {
    id: "CAFE-DEV-04",
    index: 3,
    title: "End-to-end verification",
    description:
      "Verify the finished café calculator end to end using the saved calculator.py and main.py together.",
    expectedBehavior:
      "Both functions still work, main.py actually uses the calculator module, receipts are correct for empty, normal, threshold, and large orders, and invalid quantities never crash the program.",
    instructions: [
      "Confirm calculator.py still contains working calculate_total and apply_discount functions.",
      "Confirm main.py imports and uses the calculator module instead of copying its pricing logic.",
      "Save both files. The game checks the saved project; it never replaces or writes your code.",
      "Verify the complete application in Tickets.",
    ],
    example:
      "Input: 5, then 1\nSubtotal: $20.00\nDiscount: $2.00\nTotal: $18.00\n\nInput: abc\nPlease enter a whole number of 0 or more.",
    hints: [
      "This task uses both saved files. main.py is the program and calculator.py is its project module.",
      "The $20 boundary is inclusive, so 5 coffees and 1 sandwich receive the discount.",
      "Test an empty order, an order just below $20, exactly $20, and invalid input. Your main.py should use the calculator functions for these values rather than re-implementing them.",
    ],
    primaryFile: MAIN,
    files: [CALCULATOR, MAIN],
    tests: [
      {
        name: "calculator functions still work with the saved module",
        // main.py is interactive, so it needs input even though this case only
        // asserts against the calculator module. Without stdin Pyodide raises
        // EOFError before the check can run.
        stdin: ["2", "3"],
        pythonCheck:
          "import calculator\n" +
          '_total = calculator.calculate_total(1, 1)\nassert abs(_total - 8) < 1e-9, f"calculate_total(1, 1) returned {_total!r}, expected 8"\n' +
          '_mixed = calculator.calculate_total(2, 3)\nassert abs(_mixed - 21) < 1e-9, f"calculate_total(2, 3) returned {_mixed!r}, expected 21"\n' +
          '_discount = calculator.apply_discount(20)\nassert abs(_discount - 18) < 1e-9, f"apply_discount(20) returned {_discount!r}, expected 18"\n' +
          '_boundary = calculator.apply_discount(19.99)\nassert abs(_boundary - 19.99) < 1e-9, f"apply_discount(19.99) returned {_boundary!r}, expected 19.99"',
      },
      {
        name: "rejects invalid function input",
        stdin: ["2", "3"],
        pythonCheck:
          "import calculator\n" +
          rejectsCall(
            "calculator.calculate_total(-1, 0)",
            "calculate_total must reject negative quantities",
          ) +
          "\n" +
          rejectsCall(
            "calculator.apply_discount(-1)",
            "apply_discount must reject negative subtotals",
          ) +
          "\n" +
          rejectsCall(
            "calculator.apply_discount(None)",
            "apply_discount must reject invalid subtotal types",
          ),
      },
      {
        name: "receipt shows every line item and the final total",
        stdin: ["2", "3"],
        stdoutMatches: receiptPatterns.twoCoffeesThreeSandwiches,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "empty order prints zero",
        stdin: ["0", "0"],
        stdoutMatches: receiptPatterns.emptyOrder,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "discount boundary at exactly $20",
        stdin: ["5", "1"],
        stdoutMatches: receiptPatterns.boundaryOrder,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "order just below the threshold pays full price",
        stdin: ["4", "1"],
        stdoutMatches: receiptPatterns.justBelowThreshold,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "invalid negative input ends gracefully",
        stdin: ["-1", "2"],
        stdoutMatches: invalidInputPattern,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "non-numeric sandwich input ends gracefully",
        stdin: ["1", "two"],
        stdoutMatches: invalidInputPattern,
        stdoutNotContains: ["traceback"],
      },
      {
        name: "main.py uses the calculator module",
        stdin: ["1", "1"],
        modules: [
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
        ],
        stdoutMatches: [
          String.raw`sub\s*total\s*[:=]?\s*\$?\s*123\.45\b`,
          String.raw`(?<![a-z])(?:order\s+|grand\s+)?total\s*[:=]?\s*\$?\s*50(?:\.0+)?\b`,
        ],
        stdoutNotContains: ["traceback"],
      },
    ],
  },
] as const;

export const CAFE_DEV_TASK_COUNT = CAFE_DEV_TASKS.length;

const CAFE_DEV_TASK_ID_SET: ReadonlySet<string> = new Set(CAFE_DEV_TASK_IDS);

export function isCafeDevTaskId(value: unknown): value is CafeDevTaskId {
  return typeof value === "string" && CAFE_DEV_TASK_ID_SET.has(value);
}

export function getCafeDevTask(id: CafeDevTaskId): CafeDevTaskDefinition {
  const task = CAFE_DEV_TASKS.find((item) => item.id === id);
  if (!task) throw new Error(`Unknown café development task: ${id}`);
  return task;
}

export function getCafeDevTaskByIndex(index: number): CafeDevTaskDefinition | null {
  return CAFE_DEV_TASKS[index] ?? null;
}

export function cafeDevFilePath(fileName: CafeDevFileName): string {
  return `${CAFE_DEV_PROJECT_DIRECTORY}/${fileName}`;
}
