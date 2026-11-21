/**
 * Canonical setup workflow for the Chapter 1 café project.
 *
 * Phase A (setup) runs before the three existing Python milestones. Tasks are
 * strictly ordered: progress is stored as a prefix of this array.
 */

export const CAFE_SETUP_TASK_IDS = [
  "read-brief",
  "create-folder",
  "create-files",
  "write-plan",
  "verify-setup",
] as const;

export type CafeSetupTaskId = (typeof CAFE_SETUP_TASK_IDS)[number];

export type CafeSetupAppId = "explorer" | "editor" | null;

export interface CafeSetupTaskDefinition {
  readonly id: CafeSetupTaskId;
  readonly index: number;
  readonly title: string;
  readonly objective: string;
  readonly instructions: readonly string[];
  readonly hint: string;
  readonly app: CafeSetupAppId;
  readonly openLabel: string;
}

/** Canonical workspace directory inside the existing Pixel OS filesystem. */
export const CAFE_PROJECT_DIRECTORY = "/Projects/Python/cafe-calculator";

/** Files the player must create by hand inside CAFE_PROJECT_DIRECTORY. */
export const CAFE_PROJECT_REQUIRED_FILES = [
  "PLAN.md",
  "calculator.py",
  "main.py",
  "README.md",
] as const;

export type CafeProjectRequiredFile = (typeof CAFE_PROJECT_REQUIRED_FILES)[number];

export const CAFE_PROJECT_FILE_PATHS: readonly string[] = CAFE_PROJECT_REQUIRED_FILES.map(
  (name) => `${CAFE_PROJECT_DIRECTORY}/${name}`,
);

/** Planning topics the player confirms in the guided PLAN.md checklist. */
export const CAFE_SETUP_PLAN_TOPICS = [
  "Product prices",
  "Order total calculation",
  "Discount logic",
  "User input",
  "Receipt output",
  "Testing",
] as const;

export const CAFE_SETUP_TASKS: readonly CafeSetupTaskDefinition[] = [
  {
    id: "read-brief",
    index: 0,
    title: "Read Client Brief",
    objective: "Read Alex Morgan's requirements and acknowledge that you understand them.",
    instructions: [
      "Open the client brief in the accepted GigBoard project.",
      "Read every requirement, including prices, discounts, receipts, and invalid input.",
      "Mark the brief reviewed when you are ready to start the project setup.",
    ],
    hint: "The brief is the source of truth for the calculator's behaviour.",
    app: null,
    openLabel: "Read Requirements",
  },
  {
    id: "create-folder",
    index: 1,
    title: "Create Project Folder",
    objective: "Create the project folder inside the existing virtual filesystem.",
    instructions: [
      "Open File Explorer and navigate to /Projects/Python.",
      "Create a new folder named exactly cafe-calculator.",
      "Return here and click Check Task so the folder can be verified.",
    ],
    hint: "The game never creates this folder for you.",
    app: "explorer",
    openLabel: "Open File Explorer",
  },
  {
    id: "create-files",
    index: 2,
    title: "Create Project Files",
    objective: "Create the four project files inside cafe-calculator.",
    instructions: [
      "Inside /Projects/Python/cafe-calculator, create PLAN.md.",
      "Create calculator.py and main.py.",
      "Create README.md, then click Check Task.",
    ],
    hint: "No Python code is required yet. The files only need to exist.",
    app: "explorer",
    openLabel: "Open File Explorer",
  },
  {
    id: "write-plan",
    index: 3,
    title: "Write Development Plan",
    objective: "Write a short, meaningful plan in PLAN.md that covers the six topics.",
    instructions: [
      "Open PLAN.md in the existing Editor.",
      "Write a short plan covering all six topics in the checklist below.",
      "Confirm the checklist and click Check Task.",
    ],
    hint: "A development plan is a short list of what you will build and how you will test it.",
    app: "editor",
    openLabel: "Open PLAN.md in Editor",
  },
  {
    id: "verify-setup",
    index: 4,
    title: "Verify Project Setup",
    objective: "Confirm the folder, files, and plan are all in place.",
    instructions: [
      "Check that cafe-calculator contains all four files.",
      "Check that PLAN.md still contains your plan.",
      "Click Check Task to unlock the four café development tasks.",
    ],
    hint: "Verification checks the real filesystem; the café development tasks stay locked until it passes.",
    app: "explorer",
    openLabel: "Open File Explorer",
  },
] as const;

export const CAFE_SETUP_TASK_COUNT = CAFE_SETUP_TASKS.length;

const CAFE_SETUP_TASK_ID_SET: ReadonlySet<string> = new Set(CAFE_SETUP_TASK_IDS);

export function isCafeSetupTaskId(value: unknown): value is CafeSetupTaskId {
  return typeof value === "string" && CAFE_SETUP_TASK_ID_SET.has(value);
}

export function getCafeSetupTask(id: CafeSetupTaskId): CafeSetupTaskDefinition {
  const task = CAFE_SETUP_TASKS.find((item) => item.id === id);
  if (!task) throw new Error(`Unknown café setup task: ${id}`);
  return task;
}

export function getCafeSetupTaskByIndex(index: number): CafeSetupTaskDefinition | null {
  return CAFE_SETUP_TASKS[index] ?? null;
}
