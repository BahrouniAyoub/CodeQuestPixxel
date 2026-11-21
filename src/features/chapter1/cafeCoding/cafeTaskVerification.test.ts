import { describe, expect, it, vi } from "vitest";
import type { FsEntry } from "@/services/filesystem/types";
import { getCafeMilestone, type CafeMilestoneId } from "./cafeMilestones";
import type { CafeMilestoneValidationResult } from "./cafeMilestoneValidator";
import { verifyCafeTaskFromSavedFile, type CafeTaskVerificationDeps } from "./cafeTaskVerification";

function file(path: string, content: string): FsEntry {
  return { path, kind: "file", content, updatedAt: 0 };
}

function validation(
  milestoneId: CafeMilestoneId,
  status: CafeMilestoneValidationResult["status"] = "passed",
): CafeMilestoneValidationResult {
  return {
    milestoneId,
    status,
    testsPassed: status === "passed" ? 3 : 1,
    testsExecuted: 3,
    testsTotal: 3,
    outcomes: [],
    message: status === "passed" ? "All milestone tests passed." : "1 of 3 tests passed.",
    error: null,
  };
}

function makeDeps(overrides: Partial<CafeTaskVerificationDeps> = {}) {
  const readEntry = vi.fn(async (path: string) => file(path, "saved café code"));
  const validate = vi.fn(async (milestoneId: CafeMilestoneId) => validation(milestoneId));
  const completeMilestone = vi.fn(async () => ({ ok: true as const, alreadyCompleted: false }));
  const getCurrentMilestoneId = vi.fn((): CafeMilestoneId | null => "arithmetic-functions");
  const syncQuest = vi.fn(async () => ({ ok: true as const, completed: true }));
  const deps: CafeTaskVerificationDeps = {
    readEntry,
    validate,
    completeMilestone,
    getCurrentMilestoneId,
    syncQuest,
    ...overrides,
  };
  return { deps, readEntry, validate, completeMilestone, getCurrentMilestoneId, syncQuest };
}

describe("café task verification from the saved file", () => {
  it("reads and validates the canonical saved file even when a different file is open", async () => {
    const deps = makeDeps();
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("variables-print"),
        currentMilestoneId: "variables-print",
        openFilePath: "/Projects/Python/cafe_milestone_2.py",
        openFileDirty: true,
      },
      deps.deps,
    );

    expect(result.ok).toBe(true);
    expect(deps.readEntry).toHaveBeenCalledWith("/Projects/Python/cafe_milestone_1.py");
    expect(deps.validate).toHaveBeenCalledWith("variables-print", "saved café code");
    expect(deps.completeMilestone).toHaveBeenCalledTimes(1);
  });

  it("does not verify or read while the canonical file has unsaved changes", async () => {
    const deps = makeDeps();
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("variables-print"),
        currentMilestoneId: "variables-print",
        openFilePath: "/Projects/Python/cafe_milestone_1.py",
        openFileDirty: true,
      },
      deps.deps,
    );

    expect(result).toMatchObject({ ok: false, kind: "unsaved-changes" });
    expect(deps.readEntry).not.toHaveBeenCalled();
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.completeMilestone).not.toHaveBeenCalled();
  });

  it("reports a missing milestone file without completing anything", async () => {
    const deps = makeDeps({ readEntry: vi.fn(async () => undefined) });
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("variables-print"),
        currentMilestoneId: "variables-print",
        openFilePath: null,
        openFileDirty: false,
      },
      deps.deps,
    );

    expect(result).toMatchObject({ ok: false, kind: "file-missing" });
    expect(deps.completeMilestone).not.toHaveBeenCalled();
  });

  it("keeps the milestone incomplete when tests fail", async () => {
    const deps = makeDeps({
      validate: vi.fn(async (milestoneId: CafeMilestoneId) => validation(milestoneId, "failed")),
    });
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("variables-print"),
        currentMilestoneId: "variables-print",
        openFilePath: null,
        openFileDirty: false,
      },
      deps.deps,
    );

    expect(result).toMatchObject({ ok: false, kind: "tests-failed" });
    expect(deps.completeMilestone).not.toHaveBeenCalled();
  });

  it("rejects locked milestones before running the validator", async () => {
    const deps = makeDeps();
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("conditional-discounts"),
        currentMilestoneId: "variables-print",
        openFilePath: null,
        openFileDirty: false,
      },
      deps.deps,
    );

    expect(result).toMatchObject({ ok: false, kind: "not-current" });
    expect(deps.readEntry).not.toHaveBeenCalled();
    expect(deps.validate).not.toHaveBeenCalled();
  });

  it("completes exactly one milestone per verification pass", async () => {
    const deps = makeDeps();
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("variables-print"),
        currentMilestoneId: "variables-print",
        openFilePath: null,
        openFileDirty: false,
      },
      deps.deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deps.completeMilestone.mock.calls).toEqual([["variables-print"]]);
    expect(result.nextMilestoneId).toBe("arithmetic-functions");
    expect(result.allComplete).toBe(false);
    expect(deps.syncQuest).not.toHaveBeenCalled();
  });

  it("does not advance Chapter 1 before the third milestone", async () => {
    const deps = makeDeps({ getCurrentMilestoneId: () => "conditional-discounts" });
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("arithmetic-functions"),
        currentMilestoneId: "arithmetic-functions",
        openFilePath: null,
        openFileDirty: false,
      },
      deps.deps,
    );

    expect(result.ok).toBe(true);
    expect(deps.syncQuest).not.toHaveBeenCalled();
  });

  it("syncs CH1-05 exactly once after the third milestone", async () => {
    const deps = makeDeps({ getCurrentMilestoneId: () => null });
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("conditional-discounts"),
        currentMilestoneId: "conditional-discounts",
        openFilePath: null,
        openFileDirty: false,
      },
      deps.deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deps.completeMilestone.mock.calls).toEqual([["conditional-discounts"]]);
    expect(deps.syncQuest).toHaveBeenCalledTimes(1);
    expect(result.allComplete).toBe(true);
    expect(result.questSync).toEqual({ ok: true, completed: true });
  });

  it("reports a persistence failure without claiming progress", async () => {
    const deps = makeDeps({
      completeMilestone: vi.fn(async () => ({ ok: false as const, reason: "Save failed." })),
    });
    const result = await verifyCafeTaskFromSavedFile(
      {
        milestone: getCafeMilestone("variables-print"),
        currentMilestoneId: "variables-print",
        openFilePath: null,
        openFileDirty: false,
      },
      deps.deps,
    );

    expect(result).toMatchObject({ ok: false, kind: "save-failed", reason: "Save failed." });
    expect(deps.syncQuest).not.toHaveBeenCalled();
  });
});
