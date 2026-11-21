/**
 * Pure, versioned progress for the four café development tasks.
 *
 * Progress is a strict prefix of CAFE_DEV_TASKS. A save can never skip a task,
 * repeat one, or contain a completion timestamp it did not earn. This record is
 * completely separate from the legacy three-milestone record so existing saves
 * are never reinterpreted.
 */
import {
  CAFE_DEV_TASK_IDS,
  CAFE_DEV_TASKS,
  isCafeDevTaskId,
  type CafeDevTaskDefinition,
  type CafeDevTaskId,
} from "./cafeDevTasks";

export const CAFE_DEV_SAVE_VERSION = 1;

export interface CafeDevTaskCompletion {
  readonly taskId: CafeDevTaskId;
  /** ISO timestamp of the successful task save. */
  readonly completedAt: string;
}

export interface CafeDevProgress {
  /** 0..CAFE_DEV_TASKS.length. Always equals completedTasks.length. */
  readonly currentTaskIndex: number;
  readonly completedTasks: readonly CafeDevTaskCompletion[];
}

export interface CafeDevSaveRecord {
  readonly version: typeof CAFE_DEV_SAVE_VERSION;
  readonly progress: CafeDevProgress;
}

export const initialCafeDevProgress: CafeDevProgress = {
  currentTaskIndex: 0,
  completedTasks: [],
};

export type CafeDevProgressValidationResult =
  { ok: true; progress: CafeDevProgress } | { ok: false; reason: string };

function invalid(reason: string): CafeDevProgressValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/** Return the task the player may work on, or null at 4/4. */
export function getCurrentCafeDevTask(progress: CafeDevProgress): CafeDevTaskDefinition | null {
  const index = progress.currentTaskIndex;
  if (!Number.isInteger(index) || index < 0 || index >= CAFE_DEV_TASKS.length) return null;
  return CAFE_DEV_TASKS[index] ?? null;
}

export function isCafeDevTaskComplete(progress: CafeDevProgress, taskId: CafeDevTaskId): boolean {
  return progress.completedTasks.some((completion) => completion.taskId === taskId);
}

export function cafeDevProgressCount(progress: CafeDevProgress): number {
  return progress.completedTasks.length;
}

export function cafeDevProgressPercent(progress: CafeDevProgress): number {
  return Math.round((progress.completedTasks.length / CAFE_DEV_TASKS.length) * 100);
}

export function isCafeDevComplete(progress: CafeDevProgress): boolean {
  return (
    progress.currentTaskIndex === CAFE_DEV_TASKS.length &&
    progress.completedTasks.length === CAFE_DEV_TASKS.length
  );
}

/**
 * Complete the current task and return new immutable progress.
 * Repeated, skipped, out-of-order, or unknown task IDs return the same progress
 * object unchanged so the store performs no write.
 */
export function completeCafeDevTask(
  progress: CafeDevProgress,
  taskId: CafeDevTaskId,
  completedAt: string = new Date().toISOString(),
): CafeDevProgress {
  if (!isCafeDevTaskId(taskId)) return progress;
  if (!isIsoTimestamp(completedAt)) return progress;

  const current = getCurrentCafeDevTask(progress);
  if (!current || current.id !== taskId) return progress;
  if (isCafeDevTaskComplete(progress, taskId)) return progress;

  return {
    currentTaskIndex: progress.currentTaskIndex + 1,
    completedTasks: [
      ...progress.completedTasks.map((completion) => ({ ...completion })),
      { taskId, completedAt },
    ],
  };
}

/** Copy progress into the persisted envelope without retaining caller arrays. */
export function createCafeDevSaveRecord(progress: CafeDevProgress): CafeDevSaveRecord {
  return {
    version: CAFE_DEV_SAVE_VERSION,
    progress: {
      currentTaskIndex: progress.currentTaskIndex,
      completedTasks: progress.completedTasks.map((completion) => ({
        taskId: completion.taskId,
        completedAt: completion.completedAt,
      })),
    },
  };
}

/**
 * Validate untrusted IndexedDB data before it can become development state.
 * The completed tasks must be the exact canonical prefix.
 */
export function validateCafeDevSaveRecord(raw: unknown): CafeDevProgressValidationResult {
  if (!isRecord(raw)) return invalid("save record is not an object");
  if (raw["version"] !== CAFE_DEV_SAVE_VERSION) {
    return invalid("unsupported save version");
  }

  const value = raw["progress"];
  if (!isRecord(value)) return invalid("progress is not an object");

  const index = value["currentTaskIndex"];
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > CAFE_DEV_TASKS.length
  ) {
    return invalid("currentTaskIndex is outside the development task range");
  }

  const completed = value["completedTasks"];
  if (!Array.isArray(completed)) return invalid("completedTasks is not an array");
  if (completed.length !== index) {
    return invalid("currentTaskIndex does not match the completed task count");
  }

  const completions: CafeDevTaskCompletion[] = [];
  for (const [position, entry] of completed.entries()) {
    if (!isRecord(entry)) return invalid("completed task entry is not an object");

    const taskId = entry["taskId"];
    if (!isCafeDevTaskId(taskId)) {
      return invalid("completedTasks contains an invalid task ID");
    }
    if (taskId !== CAFE_DEV_TASK_IDS[position]) {
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
    },
  };
}
