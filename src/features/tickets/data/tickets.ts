export type TicketId = "CQ-001" | "CQ-002" | "CQ-003" | "CQ-004" | "CQ-005";
export type Difficulty = "Starter" | "Easy" | "Medium" | "Tricky";

export interface TicketTest {
  name: string;
  /** Lines returned, in order, by input() */
  stdin?: string[];
  /** Exact expected stdout (trailing whitespace per line ignored). Prompts passed to input() are not printed during tests. */
  expectedStdout?: string;
  /** Python assertions executed after the program, in the same namespace */
  check?: string;
}

export interface TicketDefinition {
  id: TicketId;
  title: string;
  topic: string;
  difficulty: Difficulty;
  xp: number;
  fileName: string;
  summary: string;
  description: string;
  requirements: string[];
  examples: { input?: string; output: string }[];
  acceptance: string[];
  hints: string[];
  starterCode: string;
  tests: TicketTest[];
}

export const TICKETS: TicketDefinition[] = [
  {
    id: "CQ-001",
    title: "Hello, Pixel City",
    topic: "Variables and Printing",
    difficulty: "Starter",
    xp: 100,
    fileName: "cq001_hello.py",
    summary: "Store your hero name and level in variables, then print a greeting.",
    description:
      "Welcome aboard! Our onboarding bot needs to greet new developers. Store the hero name and level in variables and print a two-line greeting.",
    requirements: [
      'Create a variable named `name` with the value "Pixel".',
      "Create a variable named `level` with the value 1 (a number, not text).",
      "Print the greeting using the variables, not hard-coded text.",
    ],
    examples: [{ output: "Hello, Pixel!\nLevel: 1" }],
    acceptance: [
      'Output line 1 is exactly "Hello, Pixel!"',
      'Output line 2 is exactly "Level: 1"',
      '`name == "Pixel"` and `level == 1` after the program runs',
    ],
    hints: [
      'Assign with `=`, e.g. `name = "Pixel"`.',
      'An f-string mixes text and variables: `print(f"Hello, {name}!")`.',
      "Numbers don't need quotes: `level = 1`.",
    ],
    starterCode: `# CQ-001 — Variables and Printing
# Create the variables, then print the greeting.

name = ""
level = 0

print("Hello!")
`,
    tests: [
      { name: "Prints the greeting", expectedStdout: "Hello, Pixel!\nLevel: 1" },
      { name: "`name` variable is \"Pixel\"", check: 'assert name == "Pixel", f"name is {name!r}, expected \'Pixel\'"' },
      {
        name: "`level` is the number 1",
        check: 'assert isinstance(level, int) and level == 1, f"level is {level!r}, expected the number 1"',
      },
    ],
  },
  {
    id: "CQ-002",
    title: "Badge Printer",
    topic: "User Input and Strings",
    difficulty: "Easy",
    xp: 150,
    fileName: "cq002_badge.py",
    summary: "Read a name, clean it up and print a badge.",
    description:
      "The front desk badge printer reads a visitor's name. People type messy names with extra spaces and lowercase letters — clean the name up and print the badge text.",
    requirements: [
      "Read one line of input with `input()`.",
      "Remove surrounding spaces from the name.",
      'Print "Welcome, NAME!" with the name in UPPERCASE.',
      'Print "Your name has N letters." where N is the length of the cleaned name.',
    ],
    examples: [
      { input: "ada", output: "Welcome, ADA!\nYour name has 3 letters." },
      { input: "  Grace  ", output: "Welcome, GRACE!\nYour name has 5 letters." },
    ],
    acceptance: ["Works for any name", "Leading/trailing spaces are ignored", "Exactly two lines are printed"],
    hints: [
      "`input()` always returns a string.",
      "`.strip()` removes surrounding spaces; `.upper()` makes uppercase.",
      "`len(text)` counts characters. Prompts inside input() are ignored by the tests.",
    ],
    starterCode: `# CQ-002 — User Input and Strings
name = input("Your name: ")

# Clean up the name, then print the badge
print("Welcome, " + name + "!")
`,
    tests: [
      { name: "Lowercase name", stdin: ["ada"], expectedStdout: "Welcome, ADA!\nYour name has 3 letters." },
      { name: "Name with spaces", stdin: ["  Grace  "], expectedStdout: "Welcome, GRACE!\nYour name has 5 letters." },
      { name: "Mixed case name", stdin: ["LiNuS"], expectedStdout: "Welcome, LINUS!\nYour name has 5 letters." },
    ],
  },
  {
    id: "CQ-003",
    title: "Code Review Grader",
    topic: "Conditions",
    difficulty: "Medium",
    xp: 200,
    fileName: "cq003_grader.py",
    summary: "Turn a review score into a verdict using if / elif / else.",
    description:
      "Code reviews produce a score from 0 to 100. Print a verdict the dashboard can display.",
    requirements: [
      "Read a whole number score from input.",
      'Print "Excellent" if the score is 90 or more.',
      'Print "Pass" if the score is 50 to 89.',
      'Otherwise print "Try again".',
    ],
    examples: [
      { input: "95", output: "Excellent" },
      { input: "50", output: "Pass" },
      { input: "12", output: "Try again" },
    ],
    acceptance: ["Boundaries 90 and 50 are handled correctly", "Prints exactly one line"],
    hints: [
      "Convert text to a number with `int(input())`.",
      "Check the highest range first: `if score >= 90:` then `elif score >= 50:`.",
      "`else:` catches everything left over.",
    ],
    starterCode: `# CQ-003 — Conditions
score = int(input("Score: "))

# Print Excellent, Pass, or Try again
`,
    tests: [
      { name: "Score 95", stdin: ["95"], expectedStdout: "Excellent" },
      { name: "Boundary 90", stdin: ["90"], expectedStdout: "Excellent" },
      { name: "Score 89", stdin: ["89"], expectedStdout: "Pass" },
      { name: "Boundary 50", stdin: ["50"], expectedStdout: "Pass" },
      { name: "Score 49", stdin: ["49"], expectedStdout: "Try again" },
      { name: "Score 0", stdin: ["0"], expectedStdout: "Try again" },
    ],
  },
  {
    id: "CQ-004",
    title: "Deploy Countdown",
    topic: "Loops",
    difficulty: "Medium",
    xp: 250,
    fileName: "cq004_countdown.py",
    summary: "Count down from N to 1, then launch the deploy.",
    description: "Before every deploy the pipeline prints a countdown. Build it with a loop.",
    requirements: [
      "Read a whole number N from input.",
      "Print the numbers from N down to 1, one per line.",
      'Finally print "Liftoff!".',
      'If N is 0, only "Liftoff!" is printed.',
    ],
    examples: [
      { input: "3", output: "3\n2\n1\nLiftoff!" },
      { input: "0", output: "Liftoff!" },
    ],
    acceptance: ["Uses a loop (for or while)", "Correct for N = 0", "Last line is Liftoff!"],
    hints: [
      "`range(n, 0, -1)` counts down from n to 1.",
      "A `while n > 0:` loop works too — remember `n -= 1`.",
      "Put the Liftoff print after (outside) the loop.",
    ],
    starterCode: `# CQ-004 — Loops
n = int(input("Count from: "))

# Count down, then print Liftoff!
`,
    tests: [
      { name: "Countdown from 3", stdin: ["3"], expectedStdout: "3\n2\n1\nLiftoff!" },
      { name: "Countdown from 1", stdin: ["1"], expectedStdout: "1\nLiftoff!" },
      { name: "Countdown from 0", stdin: ["0"], expectedStdout: "Liftoff!" },
      { name: "Countdown from 10", stdin: ["10"], expectedStdout: "10\n9\n8\n7\n6\n5\n4\n3\n2\n1\nLiftoff!" },
    ],
  },
  {
    id: "CQ-005",
    title: "XP Calculator",
    topic: "Functions",
    difficulty: "Tricky",
    xp: 300,
    fileName: "cq005_xp.py",
    summary: "Write reusable functions that calculate XP and format a level label.",
    description:
      "The Progress app needs helper functions. Write two functions that other code can call. They must return values — not print them.",
    requirements: [
      "Define `calculate_xp(tickets_completed, bonus=0)` that returns tickets_completed * 100 + bonus.",
      'Define `format_level(xp)` that returns the text "Level N" where N = xp // 200 + 1.',
      "Both functions must use `return`.",
    ],
    examples: [
      { output: "calculate_xp(3)        -> 300\ncalculate_xp(2, 50)    -> 250\nformat_level(450)      -> 'Level 3'" },
    ],
    acceptance: ["calculate_xp works with and without bonus", "format_level returns a string", "No input() is needed"],
    hints: [
      "`def name(param, other=0):` gives a parameter a default value.",
      "`return value` sends the result back to the caller.",
      '`//` is whole-number division. Build the text with `f"Level {n}"`.',
    ],
    starterCode: `# CQ-005 — Functions

def calculate_xp(tickets_completed, bonus=0):
    pass


def format_level(xp):
    pass


print(calculate_xp(3))
print(format_level(450))
`,
    tests: [
      { name: "calculate_xp(3) returns 300", check: "r = calculate_xp(3)\nassert r == 300, f'got {r!r}'" },
      { name: "calculate_xp(2, 50) returns 250", check: "r = calculate_xp(2, 50)\nassert r == 250, f'got {r!r}'" },
      { name: "calculate_xp(0) returns 0", check: "r = calculate_xp(0)\nassert r == 0, f'got {r!r}'" },
      { name: "format_level(0) is 'Level 1'", check: "r = format_level(0)\nassert r == 'Level 1', f'got {r!r}'" },
      { name: "format_level(450) is 'Level 3'", check: "r = format_level(450)\nassert r == 'Level 3', f'got {r!r}'" },
      { name: "format_level(199) is 'Level 1'", check: "r = format_level(199)\nassert r == 'Level 1', f'got {r!r}'" },
    ],
  },
];

export const TICKET_IDS = TICKETS.map((t) => t.id);
export const TICKETS_BY_ID = Object.fromEntries(TICKETS.map((t) => [t.id, t])) as Record<TicketId, TicketDefinition>;
export const MAX_XP = TICKETS.reduce((sum, t) => sum + t.xp, 0);
