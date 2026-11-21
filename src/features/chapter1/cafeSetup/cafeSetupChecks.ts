import { getEntry } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import {
  CAFE_PROJECT_DIRECTORY,
  CAFE_PROJECT_REQUIRED_FILES,
  type CafeSetupTaskId,
} from "./cafeSetupTasks";

export interface CafeSetupFileSystem {
  getEntry: (path: string) => Promise<FsEntry | undefined>;
}

export type CafeSetupCheckResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export interface CafeSetupVerificationOptions {
  /** Player-confirmed checklist for the development plan task. */
  readonly planTopicsConfirmed?: boolean;
}

export const CAFE_MINIMUM_PLAN_LENGTH = 40;

const realFileSystem: CafeSetupFileSystem = { getEntry };

const ok: CafeSetupCheckResult = { ok: true };

function fail(reason: string): CafeSetupCheckResult {
  return { ok: false, reason };
}

export async function checkCafeProjectFolder(
  fileSystem: CafeSetupFileSystem = realFileSystem,
): Promise<CafeSetupCheckResult> {
  const entry = await fileSystem.getEntry(CAFE_PROJECT_DIRECTORY);
  if (!entry) {
    return fail(`Folder not found: ${CAFE_PROJECT_DIRECTORY}. Create it in File Explorer first.`);
  }
  if (entry.kind !== "dir") {
    return fail(`${CAFE_PROJECT_DIRECTORY} exists but is not a folder.`);
  }
  return ok;
}

export type CafeProjectFilesCheck =
  | { ok: true; paths: readonly string[]; reason?: undefined }
  | { ok: false; reason: string; missing: readonly string[] };

export async function checkCafeProjectFiles(
  fileSystem: CafeSetupFileSystem = realFileSystem,
): Promise<CafeProjectFilesCheck> {
  const folder = await checkCafeProjectFolder(fileSystem);
  if (!folder.ok) return { ok: false, reason: folder.reason, missing: [] };

  const missing: string[] = [];
  for (const fileName of CAFE_PROJECT_REQUIRED_FILES) {
    const path = `${CAFE_PROJECT_DIRECTORY}/${fileName}`;
    const entry = await fileSystem.getEntry(path);
    if (!entry) {
      missing.push(fileName);
      continue;
    }
    if (entry.kind !== "file") {
      return {
        ok: false,
        reason: `${fileName} exists but is a folder. Create it as a file instead.`,
        missing: [],
      };
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Missing project file${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
      missing,
    };
  }

  return {
    ok: true,
    paths: CAFE_PROJECT_REQUIRED_FILES.map((fileName) => `${CAFE_PROJECT_DIRECTORY}/${fileName}`),
  };
}

export type CafePlanContentCheck = { ok: true; reason?: undefined } | { ok: false; reason: string };

/**
 * Lightweight, deterministic content check. It only proves PLAN.md contains
 * meaningful text; the six topics are confirmed by the player checklist rather
 * than pretending to understand the prose.
 */
export function validateCafePlanContent(content: string | undefined): CafePlanContentCheck {
  const text = (content ?? "").trim();
  const meaningfulLength = text.replace(/\s+/g, "").length;
  if (meaningfulLength === 0) {
    return fail("PLAN.md is empty. Write a short plan before checking this task.");
  }
  if (meaningfulLength < CAFE_MINIMUM_PLAN_LENGTH) {
    return fail(
      `PLAN.md needs a bit more detail. Write at least ${CAFE_MINIMUM_PLAN_LENGTH} non-space characters covering the six planning topics.`,
    );
  }
  return ok;
}

export async function readCafePlan(
  fileSystem: CafeSetupFileSystem = realFileSystem,
): Promise<{ ok: true; content: string } | { ok: false; reason: string }> {
  const path = `${CAFE_PROJECT_DIRECTORY}/PLAN.md`;
  const entry = await fileSystem.getEntry(path);
  if (!entry) {
    return { ok: false, reason: `PLAN.md not found. Create it inside ${CAFE_PROJECT_DIRECTORY}.` };
  }
  if (entry.kind !== "file") {
    return { ok: false, reason: "PLAN.md exists but is a folder. Recreate it as a file." };
  }
  return { ok: true, content: entry.content ?? "" };
}

/** Verify the task against the real filesystem. Reading the brief has no filesystem check. */
export async function verifyCafeSetupTask(
  taskId: CafeSetupTaskId,
  options: CafeSetupVerificationOptions = {},
  fileSystem: CafeSetupFileSystem = realFileSystem,
): Promise<CafeSetupCheckResult> {
  switch (taskId) {
    case "read-brief":
      return fail("Use Mark Brief Reviewed to acknowledge the client brief.");

    case "create-folder":
      return checkCafeProjectFolder(fileSystem);

    case "create-files":
      return checkCafeProjectFiles(fileSystem);

    case "write-plan": {
      if (!options.planTopicsConfirmed) {
        return fail("Confirm all six planning topics before checking your plan.");
      }
      const files = await checkCafeProjectFiles(fileSystem);
      if (!files.ok) return fail(files.reason);
      const plan = await readCafePlan(fileSystem);
      if (!plan.ok) return fail(plan.reason);
      return validateCafePlanContent(plan.content);
    }

    case "verify-setup": {
      const files = await checkCafeProjectFiles(fileSystem);
      if (!files.ok) return fail(files.reason);
      const plan = await readCafePlan(fileSystem);
      if (!plan.ok) return fail(plan.reason);
      return validateCafePlanContent(plan.content);
    }

    default:
      return fail("Unknown setup task.");
  }
}
