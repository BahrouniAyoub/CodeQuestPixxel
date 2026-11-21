/**
 * Pure, versioned progress for the café project setup phase.
 *
 * Progress is a strict prefix of CAFE_SETUP_TASKS. A save can never skip a
 * task, repeat one, or contain a completion timestamp it did not earn.
 */
import {
  CAFE_SETUP_TASK_IDS,
  CAFE_SETUP_TASKS,
  isCafeSetupTaskId,
  type CafeSetupTaskDefinition,
  type CafeSetupTaskId,
} from "./cafeSetupTasks";

export const CAFE_SETUP_SAVE_VERSION = 1;

/** New saves continue into the four-task development workflow. */
export type CafeSetupWorkflow = "development";

export interface CafeSetupTaskCompletion {
  readonly taskId: CafeSetupTaskId;
  /** ISO timestamp of the successful task save. */
  readonly completedAt: string;
}

export interface CafeSetupProgress {
  /** 0..CAFE_SETUP_TASKS.length. Always equals completedTasks.length. */
  readonly currentTaskIndex: number;
  readonly completedTasks: readonly CafeSetupTaskCompletion[];
  /**
   * Stamped only when the final setup task is completed. A setup record saved
   * before this field existed stays without a marker and keeps the legacy
   * three-milestone workflow.
   */
  readonly workflow?: CafeSetupWorkflow;
}

export interface CafeSetupSaveRecord {
  readonly version: typeof CAFE_SETUP_SAVE_VERSION;
  readonly progress: CafeSetupProgress;
}

export const initialCafeSetupProgress: CafeSetupProgress = {
  currentTaskIndex: 0,
  completedTasks: [],
};

export type CafeSetupValidationResult =
  { ok: true; progress: CafeSetupProgress } | { ok: false; reason: string };

function invalid(reason: string): CafeSetupValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/** Return the setup task the player may work on, or null when setup is done. */
export function getCurrentCafeSetupTask(
  progress: CafeSetupProgress,
): CafeSetupTaskDefinition | null {
  const index = progress.currentTaskIndex;
  if (!Number.isInteger(index) || index < 0 || index >= CAFE_SETUP_TASKS.length) return null;
  return CAFE_SETUP_TASKS[index] ?? null;
}

export function isCafeSetupTaskComplete(
  progress: CafeSetupProgress,
  taskId: CafeSetupTaskId,
): boolean {
  return progress.completedTasks.some((completion) => completion.taskId === taskId);
}

export function cafeSetupProgressCount(progress: CafeSetupProgress): number {
  return progress.completedTasks.length;
}

const CAFE_SETUP_TASK_COUNT_VALUE = CAFE_SETUP_TASKS.length;

export function isCafeSetupComplete(progress: CafeSetupProgress): boolean {
  return (
    progress.currentTaskIndex === CAFE_SETUP_TASK_COUNT_VALUE &&
    progress.completedTasks.length === CAFE_SETUP_TASK_COUNT_VALUE
  );
}

/** Persisted workflow marker, or null for setup records created before it. */
export function getCafeSetupWorkflow(progress: CafeSetupProgress): CafeSetupWorkflow | null {
  return progress.workflow ?? null;
}

/**
 * Complete the current setup task and return new immutable progress.
 * Repeated, skipped, out-of-order, or unknown task IDs return the same progress
 * object unchanged so the store performs no write.
 */
export function completeCafeSetupTask(
  progress: CafeSetupProgress,
  taskId: CafeSetupTaskId,
  completedAt: string = new Date().toISOString(),
): CafeSetupProgress {
  if (!isCafeSetupTaskId(taskId)) return progress;
  if (!isIsoTimestamp(completedAt)) return progress;

  const current = getCurrentCafeSetupTask(progress);
  if (!current || current.id !== taskId) return progress;
  if (isCafeSetupTaskComplete(progress, taskId)) return progress;

  return {
    currentTaskIndex: progress.currentTaskIndex + 1,
    completedTasks: [
      ...progress.completedTasks.map((completion) => ({ ...completion })),
      { taskId, completedAt },
    ],
    ...(progress.workflow ? { workflow: progress.workflow } : {}),
  };
}

/**
 * Stamp the workflow that a completed setup continues into. This is applied by
 * the store after the final task is saved, so pure progress helpers and older
 * test fixtures without a marker keep the legacy workflow.
 */
export function markCafeSetupWorkflow(
  progress: CafeSetupProgress,
  workflow: CafeSetupWorkflow,
): CafeSetupProgress {
  if (!isCafeSetupComplete(progress)) return progress;
  if (progress.workflow === workflow) return progress;
  return { ...progress, workflow };
}

/** Copy progress into the persisted envelope without retaining caller arrays. */
export function createCafeSetupSaveRecord(progress: CafeSetupProgress): CafeSetupSaveRecord {
  return {
    version: CAFE_SETUP_SAVE_VERSION,
    progress: {
      currentTaskIndex: progress.currentTaskIndex,
      completedTasks: progress.completedTasks.map((completion) => ({
        taskId: completion.taskId,
        completedAt: completion.completedAt,
      })),
      ...(progress.workflow ? { workflow: progress.workflow } : {}),
    },
  };
}

/**
 * Validate untrusted IndexedDB data before it can become setup state.
 * Completed tasks must be the exact canonical prefix.
 */
export function validateCafeSetupSaveRecord(raw: unknown): CafeSetupValidationResult {
  if (!isRecord(raw)) return invalid("save record is not an object");
  if (raw["version"] !== CAFE_SETUP_SAVE_VERSION) {
    return invalid("unsupported save version");
  }

  const value = raw["progress"];
  if (!isRecord(value)) return invalid("progress is not an object");

  const index = value["currentTaskIndex"];
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > CAFE_SETUP_TASK_COUNT_VALUE
  ) {
    return invalid("currentTaskIndex is outside the setup task range");
  }

  const workflow = value["workflow"];
  if (workflow !== undefined && workflow !== "development") {
    return invalid("workflow marker is not recognised");
  }

  const completed = value["completedTasks"];
  if (!Array.isArray(completed)) return invalid("completedTasks is not an array");
  if (completed.length !== index) {
    return invalid("currentTaskIndex does not match the completed task count");
  }

  const completions: CafeSetupTaskCompletion[] = [];
  for (const [position, entry] of completed.entries()) {
    if (!isRecord(entry)) return invalid("completed task entry is not an object");

    const taskId = entry["taskId"];
    if (!isCafeSetupTaskId(taskId)) {
      return invalid("completedTasks contains an invalid task ID");
    }
    if (taskId !== CAFE_SETUP_TASK_IDS[position]) {
      return invalid("completed tasks are not the exact canonical prefix");
    }

    const completedAt = entry["completedAt"];
    if (!isIsoTimestamp(completedAt)) {
      return invalid("completedAt is not a valid timestamp");
    }

    completions.push({ taskId, completedAt });
  }

  return {
    ok: true,
    progress: {
      currentTaskIndex: index,
      completedTasks: completions,
      ...(workflow ? { workflow } : {}),
    },
  };
}
