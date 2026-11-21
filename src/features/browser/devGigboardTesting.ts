import { getCurrentChapter1Quest } from "@/features/chapter1/chapter1Progress";
import { useChapter1, type Chapter1Store } from "@/features/chapter1/chapter1Store";
import { CHAPTER1_QUEST_IDS, type Chapter1QuestId } from "@/features/chapter1/chapter1Quests";

/**
 * Temporary, development-only bridge for manually testing the GigBoard café
 * application before the Godot Chapter 1 missions exist.
 *
 * This does not bypass progression rules: it advances CH1-01..CH1-03 through
 * the normal `completeQuest` action (including persistence), then stops. The
 * player still writes and submits the proposal manually.
 */
export const GIGBOARD_DEV_TEST_QUEST_IDS = [
  "CH1-01",
  "CH1-02",
  "CH1-03",
] as const satisfies readonly Chapter1QuestId[];

export interface DevUnlockResult {
  readonly ok: boolean;
  readonly message: string;
}

interface Chapter1TestingStore {
  getState: () => Pick<
    Chapter1Store,
    "progress" | "hydrated" | "error" | "hydrate" | "completeQuest"
  >;
}

/** `import.meta.env.DEV` is inlined by Vite, so production cannot enable this. */
export function isDevTestingEnabled(devFlag: boolean | undefined = import.meta.env.DEV): boolean {
  return devFlag === true;
}

export async function unlockCafeApplicationForTesting(
  store: Chapter1TestingStore = useChapter1,
  devFlag: boolean | undefined = import.meta.env.DEV,
): Promise<DevUnlockResult> {
  if (!isDevTestingEnabled(devFlag)) {
    return {
      ok: false,
      message: "Development testing controls are disabled.",
    };
  }

  await store.getState().hydrate();
  if (!store.getState().hydrated) {
    return {
      ok: false,
      message:
        store.getState().error ??
        "Chapter 1 progress could not be loaded, so the job was not unlocked.",
    };
  }

  for (const questId of GIGBOARD_DEV_TEST_QUEST_IDS) {
    const current = getCurrentChapter1Quest(store.getState().progress);
    if (!current || current.id === "CH1-04") break;
    if (current.id !== questId) continue;

    const saved = await store.getState().completeQuest(questId);
    const after = getCurrentChapter1Quest(store.getState().progress);
    if (!saved && after?.id === questId) {
      return {
        ok: false,
        message:
          store.getState().error ??
          `Could not complete ${questId}. Chapter 1 was not unlocked; try again.`,
      };
    }
  }

  const current = getCurrentChapter1Quest(store.getState().progress);
  if (current?.id === "CH1-04") {
    return {
      ok: true,
      message: "Chapter 1 advanced to CH1-04. Enter a proposal and apply normally.",
    };
  }
  if (!current) {
    return {
      ok: true,
      message: "Chapter 1 is already complete. The café application window is closed.",
    };
  }

  const currentIndex = CHAPTER1_QUEST_IDS.indexOf(current.id);
  if (currentIndex > CHAPTER1_QUEST_IDS.indexOf("CH1-04")) {
    return {
      ok: true,
      message: "Chapter 1 is already past CH1-04. Open the application status below.",
    };
  }

  return {
    ok: false,
    message: `Could not reach CH1-04. The active quest is ${current.id}.`,
  };
}
