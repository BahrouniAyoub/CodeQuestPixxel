/**
 * Pure, versioned progress for the Chapter 1 café coding milestones.
 *
 * Progress is a strict prefix of CAFE_MILESTONES. A save can never skip a
 * milestone, repeat one, or contain a completion timestamp it did not earn.
 */
import {
  CAFE_MILESTONE_IDS,
  CAFE_MILESTONES,
  isCafeMilestoneId,
  type CafeMilestoneDefinition,
  type CafeMilestoneId,
} from "./cafeMilestones";

export const CAFE_MILESTONE_SAVE_VERSION = 1;

export interface CafeMilestoneCompletion {
  readonly milestoneId: CafeMilestoneId;
  /** ISO timestamp of the successful milestone save. */
  readonly completedAt: string;
}

export interface CafeMilestoneProgress {
  /** 0..CAFE_MILESTONES.length. Always equals completedMilestones.length. */
  readonly currentMilestoneIndex: number;
  readonly completedMilestones: readonly CafeMilestoneCompletion[];
}

export interface CafeMilestoneSaveRecord {
  readonly version: typeof CAFE_MILESTONE_SAVE_VERSION;
  readonly progress: CafeMilestoneProgress;
}

export const initialCafeMilestoneProgress: CafeMilestoneProgress = {
  currentMilestoneIndex: 0,
  completedMilestones: [],
};

export type CafeMilestoneValidationResult =
  { ok: true; progress: CafeMilestoneProgress } | { ok: false; reason: string };

function invalid(reason: string): CafeMilestoneValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/** Return the milestone the player may work on, or null at 3/3. */
export function getCurrentCafeMilestone(
  progress: CafeMilestoneProgress,
): CafeMilestoneDefinition | null {
  const index = progress.currentMilestoneIndex;
  if (!Number.isInteger(index) || index < 0 || index >= CAFE_MILESTONES.length) return null;
  return CAFE_MILESTONES[index] ?? null;
}

export function isCafeMilestoneComplete(
  progress: CafeMilestoneProgress,
  milestoneId: CafeMilestoneId,
): boolean {
  return progress.completedMilestones.some((completion) => completion.milestoneId === milestoneId);
}

export function cafeMilestoneProgressCount(progress: CafeMilestoneProgress): number {
  return progress.completedMilestones.length;
}

export function cafeMilestoneProgressPercent(progress: CafeMilestoneProgress): number {
  return Math.round((progress.completedMilestones.length / CAFE_MILESTONES.length) * 100);
}

/**
 * Complete the current milestone and return new immutable progress.
 * Repeated, skipped, out-of-order, or unknown milestone IDs return the same
 * progress object unchanged so the store performs no write.
 */
export function completeCafeMilestone(
  progress: CafeMilestoneProgress,
  milestoneId: CafeMilestoneId,
  completedAt: string = new Date().toISOString(),
): CafeMilestoneProgress {
  if (!isCafeMilestoneId(milestoneId)) return progress;
  if (!isIsoTimestamp(completedAt)) return progress;

  const current = getCurrentCafeMilestone(progress);
  if (!current || current.id !== milestoneId) return progress;
  if (isCafeMilestoneComplete(progress, milestoneId)) return progress;

  return {
    currentMilestoneIndex: progress.currentMilestoneIndex + 1,
    completedMilestones: [
      ...progress.completedMilestones.map((completion) => ({ ...completion })),
      { milestoneId, completedAt },
    ],
  };
}

/** Copy progress into the persisted envelope without retaining caller arrays. */
export function createCafeMilestoneSaveRecord(
  progress: CafeMilestoneProgress,
): CafeMilestoneSaveRecord {
  return {
    version: CAFE_MILESTONE_SAVE_VERSION,
    progress: {
      currentMilestoneIndex: progress.currentMilestoneIndex,
      completedMilestones: progress.completedMilestones.map((completion) => ({
        milestoneId: completion.milestoneId,
        completedAt: completion.completedAt,
      })),
    },
  };
}

/**
 * Validate untrusted IndexedDB data before it can become milestone state.
 * The completed milestones must be the exact canonical prefix.
 */
export function validateCafeMilestoneSaveRecord(raw: unknown): CafeMilestoneValidationResult {
  if (!isRecord(raw)) return invalid("save record is not an object");
  if (raw["version"] !== CAFE_MILESTONE_SAVE_VERSION) {
    return invalid("unsupported save version");
  }

  const value = raw["progress"];
  if (!isRecord(value)) return invalid("progress is not an object");

  const index = value["currentMilestoneIndex"];
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > CAFE_MILESTONES.length
  ) {
    return invalid("currentMilestoneIndex is outside the milestone range");
  }

  const completed = value["completedMilestones"];
  if (!Array.isArray(completed)) return invalid("completedMilestones is not an array");
  if (completed.length !== index) {
    return invalid("currentMilestoneIndex does not match the completed milestone count");
  }

  const completions: CafeMilestoneCompletion[] = [];
  for (const [position, entry] of completed.entries()) {
    if (!isRecord(entry)) return invalid("completed milestone entry is not an object");

    const milestoneId = entry["milestoneId"];
    if (!isCafeMilestoneId(milestoneId)) {
      return invalid("completedMilestones contains an invalid milestone ID");
    }
    if (milestoneId !== CAFE_MILESTONE_IDS[position]) {
      return invalid("completed milestones are not the exact canonical prefix");
    }

    const completedAt = entry["completedAt"];
    if (!isIsoTimestamp(completedAt)) {
      return invalid("completedAt is not a valid timestamp");
    }

    completions.push({ milestoneId, completedAt });
  }

  return {
    ok: true,
    progress: {
      currentMilestoneIndex: index,
      completedMilestones: completions,
    },
  };
}
