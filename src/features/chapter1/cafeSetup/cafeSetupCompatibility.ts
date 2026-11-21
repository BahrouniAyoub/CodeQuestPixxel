import { getEntry } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import { CAFE_MILESTONES } from "../cafeCoding/cafeMilestones";
import { useCafeMilestones } from "../cafeCoding/cafeMilestoneStore";

export interface CafeSetupRequirementInput {
  readonly setupHydrated: boolean;
  readonly setupComplete: boolean;
  readonly milestoneIndex: number;
  readonly legacyMilestoneFileExists: boolean;
}

export interface CafeSetupRequirement {
  /** True when the coding milestones must wait for the setup phase. */
  readonly required: boolean;
  /** True when an older save is allowed to continue without setup. */
  readonly legacy: boolean;
}

/**
 * Decide whether a session must complete the new setup phase.
 *
 * New sessions have no setup record and no earlier café milestone work, so they
 * must complete setup first. Existing development saves are detected from
 * milestone progress or an already-created milestone file and are allowed to
 * continue without a destructive migration.
 */
export function evaluateCafeSetupRequirement(
  input: CafeSetupRequirementInput,
): CafeSetupRequirement {
  if (input.setupComplete) return { required: false, legacy: false };

  const legacy = input.milestoneIndex > 0 || input.legacyMilestoneFileExists;
  if (legacy) return { required: false, legacy: true };

  // Block until the setup record is hydrated so a locked pad never flashes
  // open for a new session.
  return { required: true, legacy: false };
}

export interface CafeSetupCompatibilityFileSystem {
  getEntry: (path: string) => Promise<FsEntry | undefined>;
}

const realFileSystem: CafeSetupCompatibilityFileSystem = { getEntry };

/** A milestone file that already exists proves this is not a fresh session. */
export async function detectLegacyCafeProjectFiles(
  fileSystem: CafeSetupCompatibilityFileSystem = realFileSystem,
): Promise<boolean> {
  const firstMilestone = CAFE_MILESTONES[0];
  if (!firstMilestone) return false;
  const entry = await fileSystem.getEntry(firstMilestone.filePath);
  return entry?.kind === "file";
}

/** Production helper that also checks in-memory milestone progress. */
export async function detectLegacyCafeProject(
  fileSystem: CafeSetupCompatibilityFileSystem = realFileSystem,
): Promise<boolean> {
  if (useCafeMilestones.getState().progress.currentMilestoneIndex > 0) return true;
  return detectLegacyCafeProjectFiles(fileSystem);
}
