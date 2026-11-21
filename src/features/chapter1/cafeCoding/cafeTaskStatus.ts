/**
 * Presentation helpers for the three café milestones when they are shown as
 * development tasks in the Tickets app.
 *
 * Everything here is pure: the Tickets board supplies the persisted progress,
 * the files that currently exist, and the same access/setup checks the editor
 * panel used. No file or storage writes happen in this module.
 */
import {
  CAFE_MILESTONES,
  type CafeMilestoneDefinition,
  type CafeMilestoneId,
} from "./cafeMilestones";
import { isCafeMilestoneComplete, type CafeMilestoneProgress } from "./cafeMilestoneProgress";
import type { CafeCodingAccess } from "./cafeQuestSync";

export type CafeTaskStatus = "locked" | "available" | "in-progress" | "completed";

export interface CafeTaskStatusInput {
  readonly progress: CafeMilestoneProgress;
  /** Canonical milestone files that already exist in the workspace. */
  readonly existingFileIds?: ReadonlySet<CafeMilestoneId>;
}

const EMPTY_FILE_IDS: ReadonlySet<CafeMilestoneId> = new Set();

/** Status of one café milestone in the Tickets task list. */
export function getCafeTaskStatus(
  milestone: CafeMilestoneDefinition,
  input: CafeTaskStatusInput,
): CafeTaskStatus {
  const { progress } = input;
  const existing = input.existingFileIds ?? EMPTY_FILE_IDS;

  if (isCafeMilestoneComplete(progress, milestone.id)) return "completed";
  if (milestone.index > progress.currentMilestoneIndex) return "locked";
  if (milestone.index < progress.currentMilestoneIndex) return "completed";
  return existing.has(milestone.id) ? "in-progress" : "available";
}

export interface CafeTaskView {
  readonly milestone: CafeMilestoneDefinition;
  readonly status: CafeTaskStatus;
}

/** Ordered task list used by the Tickets board. */
export function getCafeTaskViews(input: CafeTaskStatusInput): readonly CafeTaskView[] {
  return CAFE_MILESTONES.map((milestone) => ({
    milestone,
    status: getCafeTaskStatus(milestone, input),
  }));
}

export interface CafeTaskActionState {
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface CafeTaskActions {
  readonly open: CafeTaskActionState;
  readonly verify: CafeTaskActionState;
}

export interface CafeTaskActionInput {
  readonly milestone: CafeMilestoneDefinition;
  readonly status: CafeTaskStatus;
  readonly applicationAccepted: boolean;
  /** Result of `evaluateCafeCodingAccess` (hydration, acceptance, CH1-05). */
  readonly access: CafeCodingAccess;
  readonly setupRequired: boolean;
  readonly setupTaskTitle?: string | null;
  readonly running: boolean;
  /** True when the canonical milestone file is the editor's open file. */
  readonly fileOpen: boolean;
  readonly fileDirty: boolean;
  /** True when the canonical milestone file exists in the workspace. */
  readonly fileExists: boolean;
}

const ALLOWED: CafeTaskActionState = { allowed: true, reason: null };

function blocked(reason: string): CafeTaskActionState {
  return { allowed: false, reason };
}

const ACCEPTANCE_REASON =
  "The café coding project unlocks after Alex Morgan accepts your proposal.";

function setupReason(setupTaskTitle: string | null | undefined): string {
  return setupTaskTitle
    ? `Complete the café project setup first: ${setupTaskTitle}. Open GigBoard to continue.`
    : "Complete the café project setup in GigBoard before verifying this task.";
}

/**
 * Decide whether "Open in Editor" and "Verify Task" are available.
 *
 * Verification always reads the saved milestone file. When that same file is
 * open with unsaved changes we block instead of silently checking stale disk
 * content the player cannot see.
 */
export function evaluateCafeTaskActions(input: CafeTaskActionInput): CafeTaskActions {
  if (!input.applicationAccepted) {
    const state = blocked(ACCEPTANCE_REASON);
    return { open: state, verify: state };
  }

  if (input.status === "locked") {
    const state = blocked("Complete the previous café task to unlock this one.");
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

  const open = input.running ? blocked("Wait for the current verification to finish.") : ALLOWED;

  if (!input.access.allowed) {
    return { open, verify: blocked(input.access.reason) };
  }
  if (input.running) {
    return { open, verify: blocked("Tests are already running.") };
  }
  if (input.fileOpen && input.fileDirty) {
    return {
      open,
      verify: blocked(
        `Save or discard your unsaved changes in ${input.milestone.displayFileName} before verifying.`,
      ),
    };
  }
  if (!input.fileExists) {
    return {
      open,
      verify: blocked(
        `Open ${input.milestone.displayFileName} in the editor and save it before verifying.`,
      ),
    };
  }

  return { open, verify: ALLOWED };
}
