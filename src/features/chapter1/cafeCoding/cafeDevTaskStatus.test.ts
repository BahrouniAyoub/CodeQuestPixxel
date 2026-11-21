import { describe, expect, it } from "vitest";
import { CAFE_DEV_TASKS, getCafeDevTask } from "./cafeDevTasks";
import {
  completeCafeDevTask,
  initialCafeDevProgress,
  type CafeDevProgress,
} from "./cafeDevProgress";
import {
  cafeDevTaskStatusLabel,
  evaluateCafeDevTaskActions,
  getCafeDevTaskStatus,
  getCafeDevTaskViews,
  type CafeDevTaskActionInput,
} from "./cafeDevTaskStatus";

const COMPLETED_AT = "2026-01-02T09:00:00.000Z";
const ACCEPTED = { allowed: true, reason: "Ready." };

function progressAfter(count: number): CafeDevProgress {
  return CAFE_DEV_TASKS.slice(0, count).reduce(
    (progress, task) => completeCafeDevTask(progress, task.id, COMPLETED_AT),
    initialCafeDevProgress,
  );
}

function actionInput(overrides: Partial<CafeDevTaskActionInput> = {}): CafeDevTaskActionInput {
  return {
    task: getCafeDevTask("CAFE-DEV-01"),
    status: "available",
    applicationAccepted: true,
    access: ACCEPTED,
    setupRequired: false,
    running: false,
    openFilePath: null,
    openFileDirty: false,
    existingFileNames: new Set(["calculator.py", "main.py"]),
    ...overrides,
  };
}

describe("café development task status", () => {
  it("keeps setup-created empty files as available, not in progress", () => {
    expect(
      getCafeDevTaskStatus(CAFE_DEV_TASKS[0]!, {
        progress: initialCafeDevProgress,
        existingFileNames: new Set(["calculator.py", "main.py"]),
        nonEmptyFileNames: new Set(),
      }),
    ).toBe("available");
  });

  it("marks the first task in progress once calculator.py has code", () => {
    expect(
      getCafeDevTaskStatus(CAFE_DEV_TASKS[0]!, {
        progress: initialCafeDevProgress,
        nonEmptyFileNames: new Set(["calculator.py"]),
      }),
    ).toBe("in-progress");
  });

  it("locks later tasks and marks completed tasks", () => {
    const views = getCafeDevTaskViews({
      progress: progressAfter(2),
      nonEmptyFileNames: new Set(["calculator.py"]),
    });

    expect(views.map((view) => view.status)).toEqual([
      "completed",
      "completed",
      "available",
      "locked",
    ]);
    expect(cafeDevTaskStatusLabel(views[3]!.status)).toBe("Locked");
  });
});

describe("café development task actions", () => {
  it("allows open and verify with saved files and no unsaved edits", () => {
    expect(evaluateCafeDevTaskActions(actionInput())).toEqual({
      open: { allowed: true, reason: null },
      verify: { allowed: true, reason: null },
    });
  });

  it("blocks verification while a required file has unsaved changes", () => {
    const actions = evaluateCafeDevTaskActions(
      actionInput({
        openFilePath: "/Projects/Python/cafe-calculator/calculator.py",
        openFileDirty: true,
      }),
    );

    // Opening stays available so the player can return and save the file.
    expect(actions.open.allowed).toBe(true);
    expect(actions.verify.reason).toMatch(/unsaved changes/i);
  });

  it("ignores unsaved changes in unrelated files", () => {
    const actions = evaluateCafeDevTaskActions(
      actionInput({
        openFilePath: "/Projects/Python/notes.py",
        openFileDirty: true,
      }),
    );

    expect(actions.verify.allowed).toBe(true);
  });

  it("blocks verification when a required file is missing", () => {
    const actions = evaluateCafeDevTaskActions(
      actionInput({
        task: getCafeDevTask("CAFE-DEV-03"),
        status: "available",
        existingFileNames: new Set(["calculator.py"]),
      }),
    );

    expect(actions.open.allowed).toBe(false);
    expect(actions.verify.reason).toMatch(/main\.py/i);
  });

  it("blocks tasks until setup is complete", () => {
    const actions = evaluateCafeDevTaskActions(
      actionInput({
        setupRequired: true,
        setupTaskTitle: "Create Project Files",
      }),
    );

    expect(actions.open.allowed).toBe(false);
    expect(actions.open.reason).toMatch(/Create Project Files/);
    expect(actions.verify.allowed).toBe(false);
  });

  it("blocks verification when CH1-05 is not the active quest", () => {
    const actions = evaluateCafeDevTaskActions(
      actionInput({
        access: { allowed: false, reason: "CH1-05 must be active." },
      }),
    );

    expect(actions.open.allowed).toBe(true);
    expect(actions.verify.reason).toBe("CH1-05 must be active.");
  });

  it("blocks locked tasks and completed-task verification", () => {
    const locked = evaluateCafeDevTaskActions(actionInput({ status: "locked" }));
    expect(locked.open.allowed).toBe(false);
    expect(locked.verify.allowed).toBe(false);

    const completed = evaluateCafeDevTaskActions(actionInput({ status: "completed" }));
    expect(completed.open.allowed).toBe(true);
    expect(completed.verify.allowed).toBe(false);
  });

  it("blocks actions before Alex accepts the proposal", () => {
    const actions = evaluateCafeDevTaskActions(actionInput({ applicationAccepted: false }));

    expect(actions.open.allowed).toBe(false);
    expect(actions.verify.reason).toMatch(/accepts your proposal/i);
  });
});
