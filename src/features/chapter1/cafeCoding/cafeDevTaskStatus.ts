/**
 * Presentation helpers for the four café development tasks in Tickets.
 *
 * Everything here is pure: the board supplies persisted progress, the saved
 * files that currently exist, and the editor's open/dirty state. No file or
 * storage writes happen in this module.
 */
import { normalizePath } from "@/services/filesystem/filesystem";
import type { CafeCodingAccess } from "./cafeQuestSync";
import {
  CAFE_DEV_TASKS,
  cafeDevFilePath,
  type CafeDevFileName,
  type CafeDevTaskDefinition,
} from "./cafeDevTasks";
import { isCafeDevTaskComplete, type CafeDevProgress } from "./cafeDevProgress";

export type CafeDevTaskStatus = "locked" | "available" | "in-progress" | "completed";

export interface CafeDevTaskStatusInput {
  readonly progress: CafeDevProgress;
  /** Required files that exist in the workspace, regardless of content. */
  readonly existingFileNames?: ReadonlySet<CafeDevFileName>;
  /** Required files that contain at least one non-whitespace character. */
  readonly nonEmptyFileNames?: ReadonlySet<CafeDevFileName>;
}

const EMPTY_FILE_NAMES: ReadonlySet<CafeDevFileName> = new Set();

/**
 * Status of one development task. Setup creates empty files, so a task only
 * becomes "in-progress" once its primary file contains real code.
 */
export function getCafeDevTaskStatus(
  task: CafeDevTaskDefinition,
  input: CafeDevTaskStatusInput,
): CafeDevTaskStatus {
  const { progress } = input;
  const nonEmpty = input.nonEmptyFileNames ?? EMPTY_FILE_NAMES;

  if (isCafeDevTaskComplete(progress, task.id)) return "completed";
  if (task.index > progress.currentTaskIndex) return "locked";
  if (task.index < progress.currentTaskIndex) return "completed";
  return nonEmpty.has(task.primaryFile) ? "in-progress" : "available";
}

export interface CafeDevTaskView {
  readonly task: CafeDevTaskDefinition;
  readonly status: CafeDevTaskStatus;
}

/** Ordered task list used by the Tickets board. */
export function getCafeDevTaskViews(input: CafeDevTaskStatusInput): readonly CafeDevTaskView[] {
  return CAFE_DEV_TASKS.map((task) => ({
    task,
    status: getCafeDevTaskStatus(task, input),
  }));
}

export interface CafeDevTaskActionState {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface CafeDevTaskActions {
  readonly open: CafeDevTaskActionState;
  readonly verify: CafeDevTaskActionState;
}

export interface CafeDevTaskActionInput {
  readonly task: CafeDevTaskDefinition;
  readonly status: CafeDevTaskStatus;
  readonly applicationAccepted: boolean;
  /** Result of `evaluateCafeCodingAccess` (hydration, acceptance, CH1-05). */
  readonly access: CafeCodingAccess;
  readonly setupRequired: boolean;
  readonly setupTaskTitle?: string | null;
  readonly running: boolean;
  /** File currently open in the editor, if any. */
  readonly openFilePath: string | null;
  readonly openFileDirty: boolean;
  /** Required files that exist in the workspace. */
  readonly existingFileNames: ReadonlySet<CafeDevFileName>;
}

const ALLOWED: CafeDevTaskActionState = { allowed: true, reason: null };

function blocked(reason: string): CafeDevTaskActionState {
  return { allowed: false, reason };
}

const ACCEPTANCE_REASON =
  "The café coding project unlocks after Alex Morgan accepts your proposal.";

function setupReason(setupTaskTitle: string | null | undefined): string {
  return setupTaskTitle
    ? `Complete the café project setup first: ${setupTaskTitle}. Open GigBoard to continue.`
    : "Complete the café project setup in GigBoard before verifying this task.";
}

function isTaskFile(path: string, task: CafeDevTaskDefinition): boolean {
  const normalized = normalizePath(path);
  return task.files.some((fileName) => normalized === normalizePath(cafeDevFilePath(fileName)));
}

function missingFiles(
  task: CafeDevTaskDefinition,
  existing: ReadonlySet<CafeDevFileName>,
): CafeDevFileName[] {
  return task.files.filter((fileName) => !existing.has(fileName));
}

/**
 * Decide whether "Open in Editor" and "Verify Task" are available.
 *
 * Open only needs the task's primary file. Verification needs every file the
 * task depends on, and it is blocked while any of those files has unsaved
 * edits so the player can see exactly what will be checked.
 */
export function evaluateCafeDevTaskActions(input: CafeDevTaskActionInput): CafeDevTaskActions {
  if (!input.applicationAccepted) {
    const state = blocked(ACCEPTANCE_REASON);
    return { open: state, verify: state };
  }

  if (input.status === "locked") {
    const state = blocked("Complete the previous café development task to unlock this one.");
    return { open: state, verify: state };
  }

  if (input.status === "completed") {
    return {
      open: ALLOWED,
      verify: blocked("This task is already completed."),
    };
  }

  if (input.setupRequired) {
    const state = blocked(setupReason(input.setupTaskTitle));
    return { open: state, verify: state };
  }

  const runningState = input.running
    ? blocked("Wait for the current verification to finish.")
    : ALLOWED;

  const primaryMissing = !input.existingFileNames.has(input.task.primaryFile);
  const open = primaryMissing
    ? blocked(`${input.task.primaryFile} was not found. Recreate it in the project folder first.`)
    : runningState;

  const missing = missingFiles(input.task, input.existingFileNames);
  if (missing.length > 0) {
    return {
      open,
      verify: blocked(
        `Open and save ${missing.join(" and ")} in the editor before verifying this task.`,
      ),
    };
  }

  if (!input.access.allowed) {
    return { open, verify: blocked(input.access.reason) };
  }
  if (input.running) {
    return { open, verify: blocked("Tests are already running.") };
  }
  if (input.openFilePath && input.openFileDirty && isTaskFile(input.openFilePath, input.task)) {
    return {
      open,
      verify: blocked(
        `Save or discard your unsaved changes in ${input.openFilePath.split("/").pop()} before verifying.`,
      ),
    };
  }

  return { open, verify: ALLOWED };
}

export function cafeDevTaskStatusLabel(status: CafeDevTaskStatus): string {
  switch (status) {
    case "locked":
      return "Locked";
    case "available":
      return "Available";
    case "in-progress":
      return "In Progress";
    case "completed":
      return "Completed";
  }
}
