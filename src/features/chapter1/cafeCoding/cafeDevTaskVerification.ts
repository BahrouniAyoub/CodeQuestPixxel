/**
 * Verify a development task from its saved workspace files.
 *
 * Verification always reads the saved calculator.py/main.py files, never an
 * in-memory editor buffer. The editor's open tab is used only to detect unsaved
 * changes and block verification with a clear message.
 */
import { normalizePath } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import {
  cafeDevFilePath,
  type CafeDevFileContents,
  type CafeDevTaskDefinition,
  type CafeDevTaskId,
} from "./cafeDevTasks";
import type { CafeDevCompletionResult } from "./cafeDevStore";
import type { CafeDevValidationResult } from "./cafeDevValidator";
import type { CafeQuestSyncResult } from "./cafeQuestSync";

export interface CafeDevTaskVerificationDeps {
  readonly readEntry: (path: string) => Promise<FsEntry | undefined>;
  readonly validate: (
    taskId: CafeDevTaskId,
    files: CafeDevFileContents,
  ) => Promise<CafeDevValidationResult>;
  readonly completeTask: (taskId: CafeDevTaskId) => Promise<CafeDevCompletionResult>;
  /** Read the persisted current task after completion (null at 4/4). */
  readonly getCurrentTaskId: () => CafeDevTaskId | null;
  /** Optional CH1-05 sync. Called once, only after the fourth task. */
  readonly syncQuest?: () => Promise<CafeQuestSyncResult>;
}

export interface CafeDevTaskVerificationInput {
  readonly task: CafeDevTaskDefinition;
  readonly currentTaskId: CafeDevTaskId | null;
  readonly openFilePath: string | null;
  readonly openFileDirty: boolean;
}

export type CafeDevTaskVerificationFailureKind =
  "not-current" | "unsaved-changes" | "file-missing" | "tests-failed" | "save-failed";

export type CafeDevTaskVerificationResult =
  | {
      readonly ok: false;
      readonly kind: "not-current" | "unsaved-changes" | "file-missing";
      readonly reason: string;
    }
  | {
      readonly ok: false;
      readonly kind: "tests-failed" | "save-failed";
      readonly reason: string;
      readonly validation: CafeDevValidationResult;
    }
  | {
      readonly ok: true;
      readonly kind: "passed";
      readonly validation: CafeDevValidationResult;
      readonly alreadyCompleted: boolean;
      readonly allComplete: boolean;
      readonly nextTaskId: CafeDevTaskId | null;
      readonly questSync: CafeQuestSyncResult | null;
    };

function samePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

export async function verifyCafeDevTaskFromSavedFiles(
  input: CafeDevTaskVerificationInput,
  deps: CafeDevTaskVerificationDeps,
): Promise<CafeDevTaskVerificationResult> {
  const { task } = input;

  // Complete tasks in order. The store enforces this too, but checking here
  // avoids running Pyodide for a task the player cannot finish yet.
  if (input.currentTaskId !== task.id) {
    return {
      ok: false,
      kind: "not-current",
      reason: "This task is locked. Complete the current café development task first.",
    };
  }

  if (
    input.openFilePath &&
    input.openFileDirty &&
    task.files.some((fileName) => samePath(input.openFilePath ?? "", cafeDevFilePath(fileName)))
  ) {
    return {
      ok: false,
      kind: "unsaved-changes",
      reason: `Save or discard your unsaved changes in ${input.openFilePath
        .split("/")
        .pop()} before verifying.`,
    };
  }

  const contents: Record<string, string> = {};
  for (const fileName of task.files) {
    const path = normalizePath(cafeDevFilePath(fileName));
    const entry = await deps.readEntry(path);
    if (!entry) {
      return {
        ok: false,
        kind: "file-missing",
        reason: `${fileName} was not found. Create it in the project folder and save your code first.`,
      };
    }
    if (entry.kind !== "file") {
      return {
        ok: false,
        kind: "file-missing",
        reason: `${fileName} is a folder. Recreate it as a Python file.`,
      };
    }
    contents[fileName] = entry.content ?? "";
  }

  // Always validate the saved canonical files, never an in-memory draft.
  const validation = await deps.validate(task.id, contents);
  if (validation.status !== "passed") {
    return {
      ok: false,
      kind: "tests-failed",
      reason: validation.message,
      validation,
    };
  }

  // Exactly one task is recorded per successful verification. The store rejects
  // skips, duplicates, and out-of-order completions.
  const completion = await deps.completeTask(task.id);
  if (!completion.ok) {
    return {
      ok: false,
      kind: "save-failed",
      reason: completion.reason,
      validation,
    };
  }

  const nextTaskId = deps.getCurrentTaskId();
  const allComplete = nextTaskId === null;
  const questSync = allComplete && deps.syncQuest ? await deps.syncQuest() : null;

  return {
    ok: true,
    kind: "passed",
    validation,
    alreadyCompleted: completion.alreadyCompleted,
    allComplete,
    nextTaskId,
    questSync,
  };
}
