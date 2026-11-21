import { describe, expect, it } from "vitest";
import { CAFE_MILESTONES, getCafeMilestone } from "./cafeMilestones";
import {
  completeCafeMilestone,
  initialCafeMilestoneProgress,
  type CafeMilestoneProgress,
} from "./cafeMilestoneProgress";
import {
  evaluateCafeTaskActions,
  getCafeTaskStatus,
  getCafeTaskViews,
  type CafeTaskActionInput,
} from "./cafeTaskStatus";
import type { CafeCodingAccess } from "./cafeQuestSync";

const READY: CafeCodingAccess = { allowed: true, reason: "Ready to verify café milestones." };

function progressWithFirstComplete(): CafeMilestoneProgress {
  return completeCafeMilestone(
    initialCafeMilestoneProgress,
    "variables-print",
    "2026-01-02T09:00:00.000Z",
  );
}

function actionInput(overrides: Partial<CafeTaskActionInput> = {}): CafeTaskActionInput {
  return {
    milestone: getCafeMilestone("variables-print"),
    status: "available",
    applicationAccepted: true,
    access: READY,
    setupRequired: false,
    setupTaskTitle: null,
    running: false,
    fileOpen: false,
    fileDirty: false,
    fileExists: true,
    ...overrides,
  };
}

describe("café task status", () => {
  it("marks only the current milestone available and later ones locked", () => {
    const views = getCafeTaskViews({ progress: initialCafeMilestoneProgress });
    expect(views.map((view) => view.status)).toEqual(["available", "locked", "locked"]);
  });

  it("marks the current milestone in progress once its file exists", () => {
    const views = getCafeTaskViews({
      progress: initialCafeMilestoneProgress,
      existingFileIds: new Set(["variables-print"]),
    });
    expect(views.map((view) => view.status)).toEqual(["in-progress", "locked", "locked"]);
  });

  it("marks completed milestones and unlocks the next one", () => {
    const progress = progressWithFirstComplete();
    expect(getCafeTaskStatus(CAFE_MILESTONES[0], { progress })).toBe("completed");
    expect(getCafeTaskStatus(CAFE_MILESTONES[1], { progress })).toBe("available");
    expect(getCafeTaskStatus(CAFE_MILESTONES[2], { progress })).toBe("locked");
  });

  it("shows all three milestones completed after the third save", () => {
    let progress = progressWithFirstComplete();
    progress = completeCafeMilestone(progress, "arithmetic-functions", "2026-01-02T09:10:00.000Z");
    progress = completeCafeMilestone(progress, "conditional-discounts", "2026-01-02T09:20:00.000Z");
    const views = getCafeTaskViews({ progress });
    expect(views.map((view) => view.status)).toEqual(["completed", "completed", "completed"]);
  });
});

describe("café task action gating", () => {
  it("allows open and verify for an available, accepted task with a saved file", () => {
    const actions = evaluateCafeTaskActions(actionInput());
    expect(actions.open.allowed).toBe(true);
    expect(actions.verify.allowed).toBe(true);
  });

  it("blocks the project before Alex accepts the proposal", () => {
    const actions = evaluateCafeTaskActions(actionInput({ applicationAccepted: false }));
    expect(actions.open.allowed).toBe(false);
    expect(actions.verify.allowed).toBe(false);
    expect(actions.verify.reason).toMatch(/Alex Morgan accepts/i);
  });

  it("blocks locked tasks until the previous task is completed", () => {
    const actions = evaluateCafeTaskActions(
      actionInput({ milestone: getCafeMilestone("conditional-discounts"), status: "locked" }),
    );
    expect(actions.open.allowed).toBe(false);
    expect(actions.verify.allowed).toBe(false);
    expect(actions.verify.reason).toMatch(/previous café task/i);
  });

  it("keeps completed tasks openable but not verifiable again", () => {
    const actions = evaluateCafeTaskActions(actionInput({ status: "completed" }));
    expect(actions.open.allowed).toBe(true);
    expect(actions.verify.allowed).toBe(false);
    expect(actions.verify.reason).toMatch(/already completed/i);
  });

  it("blocks both actions while the setup phase is required", () => {
    const actions = evaluateCafeTaskActions(
      actionInput({ setupRequired: true, setupTaskTitle: "Create Project Files" }),
    );
    expect(actions.open.allowed).toBe(false);
    expect(actions.verify.allowed).toBe(false);
    expect(actions.verify.reason).toContain("Create Project Files");
    expect(actions.verify.reason).toMatch(/GigBoard/i);
  });

  it("blocks verification when CH1-05 is not the active quest", () => {
    const actions = evaluateCafeTaskActions(
      actionInput({
        access: { allowed: false, reason: "CH1-05 must be active before verifying." },
      }),
    );
    expect(actions.open.allowed).toBe(true);
    expect(actions.verify.allowed).toBe(false);
    expect(actions.verify.reason).toMatch(/CH1-05/);
  });

  it("blocks verification while the canonical file has unsaved changes", () => {
    const actions = evaluateCafeTaskActions(actionInput({ fileOpen: true, fileDirty: true }));
    expect(actions.verify.allowed).toBe(false);
    expect(actions.verify.reason).toMatch(/unsaved changes/i);
  });

  it("does not block verification because a different file is open and dirty", () => {
    const actions = evaluateCafeTaskActions(actionInput({ fileOpen: false, fileDirty: true }));
    expect(actions.verify.allowed).toBe(true);
  });

  it("blocks verification when the saved milestone file does not exist", () => {
    const actions = evaluateCafeTaskActions(actionInput({ fileExists: false }));
    expect(actions.open.allowed).toBe(true);
    expect(actions.verify.allowed).toBe(false);
    expect(actions.verify.reason).toMatch(/Open cafe_milestone_1\.py/i);
  });

  it("blocks repeated clicks while a verification is running", () => {
    const actions = evaluateCafeTaskActions(actionInput({ running: true }));
    expect(actions.open.allowed).toBe(false);
    expect(actions.verify.allowed).toBe(false);
  });
});
