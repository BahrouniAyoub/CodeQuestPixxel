import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import type { Chapter1QuestId } from "@/features/chapter1/chapter1Quests";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { CAFE_MILESTONE_COUNT } from "./cafeMilestones";
import { useCafeMilestones } from "./cafeMilestoneStore";

/**
 * Pure access check shared by the editor panel and tests. "Unlocked" means the
 * player has been hired; verification additionally requires CH1-05 to be the
 * active Chapter 1 quest.
 */
export interface CafeCodingAccessInput {
  readonly chapterHydrated: boolean;
  readonly milestoneHydrated: boolean;
  readonly applicationStatus: "submitted" | "accepted" | null;
  readonly currentQuestId: Chapter1QuestId | null;
}

export interface CafeCodingAccess {
  readonly allowed: boolean;
  readonly reason: string;
}

export function evaluateCafeCodingAccess(input: CafeCodingAccessInput): CafeCodingAccess {
  if (!input.milestoneHydrated) {
    return { allowed: false, reason: "Loading your café milestone progress…" };
  }
  if (input.applicationStatus !== "accepted") {
    return {
      allowed: false,
      reason: "The café coding project unlocks after Alex Morgan accepts your proposal.",
    };
  }
  if (!input.chapterHydrated) {
    return { allowed: false, reason: "Checking your Chapter 1 progress…" };
  }
  if (input.currentQuestId !== "CH1-05") {
    return {
      allowed: false,
      reason:
        "Milestone verification opens while “Build the Application” (CH1-05) is the active Chapter 1 quest.",
    };
  }
  return { allowed: true, reason: "Ready to verify café milestones." };
}

export interface CafeQuestSyncInput {
  readonly milestoneHydrated: boolean;
  readonly allMilestonesComplete: boolean;
  readonly chapterHydrated: boolean;
  readonly currentQuestId: Chapter1QuestId | null;
  readonly completedQuestIds: readonly Chapter1QuestId[];
  readonly applicationStatus: "submitted" | "accepted" | null;
  readonly completeQuest: (questId: Chapter1QuestId) => Promise<boolean>;
  /** Re-read the active quest after a failed save so an idempotent retry is safe. */
  readonly readCurrentQuestId?: () => Chapter1QuestId | null;
}

export interface CafeQuestSyncResult {
  readonly ok: boolean;
  readonly completed: boolean;
  readonly reason?: string;
}

const RETRY_MESSAGE =
  "Your milestones are saved, but Chapter 1 could not be updated. Retry the Chapter 1 update — do not run the milestone tests again.";

/**
 * Complete CH1-05 exactly once after 3/3 verified milestones. This function
 * only touches Chapter 1 progress. It never grants the $50 payment, never
 * awards XP, and never completes CH1-06.
 */
export async function syncCafeProjectQuest(
  input: CafeQuestSyncInput,
): Promise<CafeQuestSyncResult> {
  if (!input.milestoneHydrated) {
    return {
      ok: false,
      completed: false,
      reason: "Milestone progress is still loading. Retry the Chapter 1 update.",
    };
  }
  if (!input.allMilestonesComplete) {
    return {
      ok: false,
      completed: false,
      reason: "All three café milestones must pass before Chapter 1 can advance.",
    };
  }
  if (input.completedQuestIds.includes("CH1-05")) {
    // Idempotent: a reload or repeat click must not complete the quest twice.
    return { ok: true, completed: false };
  }
  if (!input.chapterHydrated) {
    return {
      ok: false,
      completed: false,
      reason: "Chapter 1 progress is not ready yet. Retry the Chapter 1 update.",
    };
  }
  if (input.applicationStatus !== "accepted") {
    return {
      ok: false,
      completed: false,
      reason: "The café application is not accepted, so Chapter 1 cannot advance.",
    };
  }
  if (input.currentQuestId !== "CH1-05") {
    return {
      ok: false,
      completed: false,
      reason:
        "“Build the Application” (CH1-05) is not the active Chapter 1 quest. Retry when it is active.",
    };
  }

  const completed = await input.completeQuest("CH1-05");
  if (completed) return { ok: true, completed: true };

  const after = input.readCurrentQuestId?.() ?? input.currentQuestId;
  if (after === "CH1-05") {
    return { ok: false, completed: false, reason: RETRY_MESSAGE };
  }

  // The quest store advanced even though the boolean was false (for example a
  // previous call already committed). Treat that as synced, not as an error.
  return { ok: true, completed: false };
}

/** Production adapter around the shared Chapter 1, GigBoard, and milestone stores. */
export function syncCafeProjectQuestFromStores(): Promise<CafeQuestSyncResult> {
  const chapter = useChapter1.getState();
  const application = useGigboardApplication.getState();
  const milestones = useCafeMilestones.getState();

  return syncCafeProjectQuest({
    milestoneHydrated: milestones.hydrated,
    allMilestonesComplete: milestones.progress.currentMilestoneIndex === CAFE_MILESTONE_COUNT,
    chapterHydrated: chapter.hydrated,
    currentQuestId: getCurrentChapter1Quest(chapter.progress)?.id ?? null,
    completedQuestIds: chapter.progress.completedQuestIds,
    applicationStatus: application.application?.status ?? null,
    completeQuest: chapter.completeQuest,
    readCurrentQuestId: () => getCurrentChapter1Quest(useChapter1.getState().progress)?.id ?? null,
  });
}
