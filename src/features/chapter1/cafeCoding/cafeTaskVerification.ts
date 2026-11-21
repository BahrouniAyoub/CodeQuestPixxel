/**
 * Verify a café milestone from its saved workspace file.
 *
 * The editor no longer hosts the café instructions, so verification happens
 * from Tickets. The canonical file path comes from `cafeMilestones.ts`; the
 * editor's open tab is only used to detect unsaved changes, never as the
 * source of truth. This module performs no filesystem writes.
 */
import { normalizePath } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import type { CafeMilestoneDefinition, CafeMilestoneId } from "./cafeMilestones";
import type { CafeMilestoneCompletionResult } from "./cafeMilestoneStore";
import type { CafeMilestoneValidationResult } from "./cafeMilestoneValidator";
import type { CafeQuestSyncResult } from "./cafeQuestSync";

export interface CafeTaskVerificationDeps {
  readonly readEntry: (path: string) => Promise<FsEntry | undefined>;
  readonly validate: (
    milestoneId: CafeMilestoneId,
    code: string,
  ) => Promise<CafeMilestoneValidationResult>;
  readonly completeMilestone: (
    milestoneId: CafeMilestoneId,
  ) => Promise<CafeMilestoneCompletionResult>;
  /** Read the persisted current milestone after completion (null at 3/3). */
  readonly getCurrentMilestoneId: () => CafeMilestoneId | null;
  /** Optional CH1-05 sync. Called once, only after the third milestone. */
  readonly syncQuest?: () => Promise<CafeQuestSyncResult>;
}

export interface CafeTaskVerificationInput {
  readonly milestone: CafeMilestoneDefinition;
  readonly currentMilestoneId: CafeMilestoneId | null;
  readonly openFilePath: string | null;
  readonly openFileDirty: boolean;
}

export type CafeTaskVerificationFailureKind =
  "not-current" | "unsaved-changes" | "file-missing" | "tests-failed" | "save-failed";

export type CafeTaskVerificationResult =
  | {
      readonly ok: false;
      readonly kind: "not-current" | "unsaved-changes" | "file-missing";
      readonly reason: string;
    }
  | {
      readonly ok: false;
      readonly kind: "tests-failed" | "save-failed";
      readonly reason: string;
      readonly validation: CafeMilestoneValidationResult;
    }
  | {
      readonly ok: true;
      readonly kind: "passed";
      readonly validation: CafeMilestoneValidationResult;
      readonly alreadyCompleted: boolean;
      readonly allComplete: boolean;
      readonly nextMilestoneId: CafeMilestoneId | null;
      readonly questSync: CafeQuestSyncResult | null;
    };

function samePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

export async function verifyCafeTaskFromSavedFile(
  input: CafeTaskVerificationInput,
  deps: CafeTaskVerificationDeps,
): Promise<CafeTaskVerificationResult> {
  const { milestone } = input;

  // Complete milestones in order. The store enforces this too, but checking
  // here avoids running Pyodide for a task the player cannot finish yet.
  if (input.currentMilestoneId !== milestone.id) {
    return {
      ok: false,
      kind: "not-current",
      reason: "This task is locked. Complete the current café task first.",
    };
  }

  const filePath = normalizePath(milestone.filePath);

  if (input.openFilePath && samePath(input.openFilePath, filePath) && input.openFileDirty) {
    return {
      ok: false,
      kind: "unsaved-changes",
      reason: `Save or discard your unsaved changes in ${milestone.displayFileName} before verifying.`,
    };
  }

  const entry = await deps.readEntry(filePath);
  if (!entry || entry.kind !== "file") {
    return {
      ok: false,
      kind: "file-missing",
      reason: `${milestone.displayFileName} was not found. Open it in the editor and save your code first.`,
    };
  }

  // Always validate the saved canonical file, never an in-memory editor draft.
  const validation = await deps.validate(milestone.id, entry.content ?? "");
  if (validation.status !== "passed") {
    return {
      ok: false,
      kind: "tests-failed",
      reason: validation.message,
      validation,
    };
  }

  // Exactly one milestone is recorded per successful verification. The store
  // rejects skips, duplicates, and out-of-order completions.
  const completion = await deps.completeMilestone(milestone.id);
  if (!completion.ok) {
    return {
      ok: false,
      kind: "save-failed",
      reason: completion.reason,
      validation,
    };
  }

  const nextMilestoneId = deps.getCurrentMilestoneId();
  const allComplete = nextMilestoneId === null;
  const questSync = allComplete && deps.syncQuest ? await deps.syncQuest() : null;

  return {
    ok: true,
    kind: "passed",
    validation,
    alreadyCompleted: completion.alreadyCompleted,
    allComplete,
    nextMilestoneId,
    questSync,
  };
}
