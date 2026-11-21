import { describe, expect, it } from "vitest";
import type { FsEntry } from "@/services/filesystem/types";
import {
  CAFE_MINIMUM_PLAN_LENGTH,
  checkCafeProjectFiles,
  checkCafeProjectFolder,
  readCafePlan,
  validateCafePlanContent,
  verifyCafeSetupTask,
  type CafeSetupFileSystem,
} from "./cafeSetupChecks";
import { CAFE_PROJECT_DIRECTORY } from "./cafeSetupTasks";

function makeFileSystem(entries: FsEntry[]): CafeSetupFileSystem {
  const map = new Map(entries.map((entry) => [entry.path, entry]));
  return {
    getEntry: async (path) => map.get(path),
  };
}

function dir(path: string): FsEntry {
  return { path, kind: "dir", updatedAt: 0 };
}
function file(path: string, content = ""): FsEntry {
  return { path, kind: "file", content, updatedAt: 0 };
}

const ALL_FILES: FsEntry[] = [
  dir(CAFE_PROJECT_DIRECTORY),
  file(
    `${CAFE_PROJECT_DIRECTORY}/PLAN.md`,
    "Coffee $3. Sandwich $5. Calculate totals, apply discounts, read input, print receipts, and test invalid input.",
  ),
  file(`${CAFE_PROJECT_DIRECTORY}/calculator.py`),
  file(`${CAFE_PROJECT_DIRECTORY}/main.py`),
  file(`${CAFE_PROJECT_DIRECTORY}/README.md`),
];

describe("café setup filesystem checks", () => {
  it("verifies the real project folder", async () => {
    const fs = makeFileSystem(ALL_FILES);
    expect(await checkCafeProjectFolder(fs)).toEqual({ ok: true });

    expect((await checkCafeProjectFolder(makeFileSystem([]))).ok).toBe(false);
    expect((await checkCafeProjectFolder(makeFileSystem([file(CAFE_PROJECT_DIRECTORY)]))).ok).toBe(
      false,
    );
  });

  it("reports missing and incorrectly named project files", async () => {
    const missing = await checkCafeProjectFiles(
      makeFileSystem([dir(CAFE_PROJECT_DIRECTORY), file(`${CAFE_PROJECT_DIRECTORY}/plan.md`)]),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.missing).toEqual(["PLAN.md", "calculator.py", "main.py", "README.md"]);
      expect(missing.reason).toMatch(/Missing project file/);
    }
  });

  it("rejects a required file that is a folder", async () => {
    const wrongKind = await checkCafeProjectFiles(
      makeFileSystem([
        dir(CAFE_PROJECT_DIRECTORY),
        dir(`${CAFE_PROJECT_DIRECTORY}/PLAN.md`),
        ...ALL_FILES.filter(
          (entry) => entry.path.endsWith(".py") || entry.path.endsWith("README.md"),
        ),
      ]),
    );
    expect(wrongKind.ok).toBe(false);
    if (!wrongKind.ok) expect(wrongKind.reason).toMatch(/is a folder/);
  });

  it("accepts all four correctly named files", async () => {
    const result = await checkCafeProjectFiles(makeFileSystem(ALL_FILES));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.paths).toHaveLength(4);
  });

  it("requires meaningful PLAN.md text", async () => {
    expect(validateCafePlanContent("").ok).toBe(false);
    expect(validateCafePlanContent("Too short").ok).toBe(false);
    expect(validateCafePlanContent("x".repeat(CAFE_MINIMUM_PLAN_LENGTH)).ok).toBe(true);
    expect((await readCafePlan(makeFileSystem([]))).ok).toBe(false);
  });

  it("requires the guided checklist before checking the plan", async () => {
    const fs = makeFileSystem(ALL_FILES);
    const withoutChecklist = await verifyCafeSetupTask("write-plan", {}, fs);
    expect(withoutChecklist.ok).toBe(false);
    if (!withoutChecklist.ok) expect(withoutChecklist.reason).toMatch(/six planning topics/i);

    const withChecklist = await verifyCafeSetupTask(
      "write-plan",
      { planTopicsConfirmed: true },
      fs,
    );
    expect(withChecklist.ok).toBe(true);
  });

  it("verifies the complete setup without creating anything", async () => {
    const result = await verifyCafeSetupTask("verify-setup", {}, makeFileSystem(ALL_FILES));
    expect(result.ok).toBe(true);
    expect((await verifyCafeSetupTask("verify-setup", {}, makeFileSystem([]))).ok).toBe(false);
  });
});
