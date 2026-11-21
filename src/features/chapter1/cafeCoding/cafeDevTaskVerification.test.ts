import { describe, expect, it, vi } from "vitest";
import type { FsEntry } from "@/services/filesystem/types";
import { getCafeDevTask } from "./cafeDevTasks";
import type { CafeDevCompletionResult } from "./cafeDevStore";
import type { CafeDevValidationResult } from "./cafeDevValidator";
import {
  verifyCafeDevTaskFromSavedFiles,
  type CafeDevTaskVerificationDeps,
} from "./cafeDevTaskVerification";

function entry(path: string, content: string): FsEntry {
  return { path, kind: "file", content, updatedAt: 0 };
}

function validation(status: CafeDevValidationResult["status"] = "passed"): CafeDevValidationResult {
  return {
    taskId: "CAFE-DEV-01",
    status,
    testsPassed: status === "passed" ? 5 : 2,
    testsExecuted: status === "passed" ? 5 : 5,
    testsTotal: 5,
    outcomes: [],
    message: status === "passed" ? "All 5 task tests passed." : "Passed 2 of 5 task tests.",
    error: null,
  };
}

const calculator = "COFFEE_PRICE = 3";
const main = "from calculator import COFFEE_PRICE";

function deps(overrides: Partial<CafeDevTaskVerificationDeps> = {}): CafeDevTaskVerificationDeps {
  const saved = new Map<string, FsEntry>([
    [
      "/Projects/Python/cafe-calculator/calculator.py",
      entry("/Projects/Python/cafe-calculator/calculator.py", calculator),
    ],
    [
      "/Projects/Python/cafe-calculator/main.py",
      entry("/Projects/Python/cafe-calculator/main.py", main),
    ],
  ]);

  return {
    readEntry: vi.fn(async (path: string) => saved.get(path)),
    validate: vi.fn(async () => validation()),
    completeTask: vi.fn(async (): Promise<CafeDevCompletionResult> => ({
      ok: true,
      alreadyCompleted: false,
    })),
    getCurrentTaskId: vi.fn(() => "CAFE-DEV-02" as const),
    syncQuest: vi.fn(async () => ({ ok: true, completed: true })),
    ...overrides,
  };
}

const baseInput = {
  task: getCafeDevTask("CAFE-DEV-01"),
  currentTaskId: "CAFE-DEV-01" as const,
  openFilePath: null,
  openFileDirty: false,
};

describe("café development task verification", () => {
  it("validates the saved canonical file, not an editor buffer", async () => {
    const d = deps();

    const result = await verifyCafeDevTaskFromSavedFiles(baseInput, d);

    expect(result.ok).toBe(true);
    expect(d.readEntry).toHaveBeenCalledWith("/Projects/Python/cafe-calculator/calculator.py");
    expect(d.validate).toHaveBeenCalledWith("CAFE-DEV-01", {
      "calculator.py": calculator,
    });
    expect(d.completeTask).toHaveBeenCalledWith("CAFE-DEV-01");
    expect(d.syncQuest).not.toHaveBeenCalled();
  });

  it("blocks verification when a required file has unsaved changes", async () => {
    const d = deps();

    const result = await verifyCafeDevTaskFromSavedFiles(
      {
        ...baseInput,
        openFilePath: "/Projects/Python/cafe-calculator/calculator.py",
        openFileDirty: true,
      },
      d,
    );

    expect(result).toMatchObject({ ok: false, kind: "unsaved-changes" });
    expect(d.readEntry).not.toHaveBeenCalled();
    expect(d.validate).not.toHaveBeenCalled();
  });

  it("does not block on unsaved changes in an unrelated file", async () => {
    const d = deps();
    const result = await verifyCafeDevTaskFromSavedFiles(
      {
        ...baseInput,
        openFilePath: "/Projects/Python/notes.py",
        openFileDirty: true,
      },
      d,
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a task that is not the current task", async () => {
    const d = deps();
    const result = await verifyCafeDevTaskFromSavedFiles(
      { ...baseInput, currentTaskId: "CAFE-DEV-02" },
      d,
    );

    expect(result).toMatchObject({ ok: false, kind: "not-current" });
    expect(d.validate).not.toHaveBeenCalled();
  });

  it("reports a missing required file without running Python", async () => {
    const d = deps({
      readEntry: vi.fn(async (path: string) =>
        path.endsWith("calculator.py") ? entry(path, calculator) : undefined,
      ),
    });
    const result = await verifyCafeDevTaskFromSavedFiles(
      {
        ...baseInput,
        task: getCafeDevTask("CAFE-DEV-03"),
        currentTaskId: "CAFE-DEV-03",
      },
      d,
    );

    expect(result).toMatchObject({ ok: false, kind: "file-missing" });
    expect(d.validate).not.toHaveBeenCalled();
    expect(d.completeTask).not.toHaveBeenCalled();
  });

  it("keeps the task incomplete when tests fail", async () => {
    const d = deps({
      validate: vi.fn(async () => validation("failed")),
    });
    const result = await verifyCafeDevTaskFromSavedFiles(baseInput, d);

    expect(result).toMatchObject({ ok: false, kind: "tests-failed" });
    expect(d.completeTask).not.toHaveBeenCalled();
  });

  it("reports a progress save failure after passing tests", async () => {
    const d = deps({
      completeTask: vi.fn(async (): Promise<CafeDevCompletionResult> => ({
        ok: false,
        reason: "Could not save your development progress.",
      })),
    });
    const result = await verifyCafeDevTaskFromSavedFiles(baseInput, d);

    expect(result).toMatchObject({ ok: false, kind: "save-failed" });
  });

  it("completes CH1-05 only after the fourth task", async () => {
    const d = deps({
      completeTask: vi.fn(async (): Promise<CafeDevCompletionResult> => ({
        ok: true,
        alreadyCompleted: false,
      })),
      getCurrentTaskId: vi.fn(() => null),
    });

    const result = await verifyCafeDevTaskFromSavedFiles(
      {
        ...baseInput,
        task: getCafeDevTask("CAFE-DEV-04"),
        currentTaskId: "CAFE-DEV-04",
      },
      d,
    );

    expect(result).toMatchObject({
      ok: true,
      allComplete: true,
      nextTaskId: null,
      questSync: { ok: true, completed: true },
    });
    expect(d.syncQuest).toHaveBeenCalledTimes(1);
  });
});
