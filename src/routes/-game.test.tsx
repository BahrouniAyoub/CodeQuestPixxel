import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { createCafePaymentRecord } from "@/features/chapter1/cafeCoding/cafePayment";
import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import { useNotifications } from "@/features/notifications/notificationStore";
import { completeChapter1Quest, initialChapter1Progress } from "@/features/chapter1/chapter1Progress";
import {
  CHAPTER1_COMPLETE_MESSAGE,
  CHAPTER1_COMPLETE_TITLE,
  CHAPTER1_QUESTS,
} from "@/features/chapter1/chapter1Quests";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { FATHER_DIALOGUE_COMPLETION_PAYLOAD } from "@/features/chapter1/godotBridge";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// jsdom has no IndexedDB. Hydration state is seeded explicitly below; only the
// final write needs to succeed for this bridge/UI test.
vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return { ...actual, trackedSave: vi.fn(async () => true) };
});

import { BrowserGame } from "./game";

function progressAfter(count: number) {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

afterEach(cleanup);

describe("/game Godot bridge", () => {
  it("rejects unrelated messages, mirrors CH1-08, then completes from a valid father event", async () => {
    useNotifications.setState({ history: [], toasts: [], unseen: 0 });
    render(<BrowserGame />);

    const iframe = document.querySelector<HTMLIFrameElement>("#codequest-godot")!;
    const source = iframe.contentWindow as unknown as MessageEventSource;

    // jsdom has no IndexedDB; wait for the route's hydration attempt to settle,
    // then seed a valid post-Step-8F state before dispatching bridge events.
    await waitFor(() => {
      expect(useChapter1.getState().loading).toBe(false);
      expect(useCafePayment.getState().loading).toBe(false);
    });

    act(() => {
      useChapter1.setState({
        progress: { ...progressAfter(7), money: 75 },
        hydrated: true,
        loading: false,
        error: null,
      });
      useCafePayment.setState({
        payment: createCafePaymentRecord({
          jobId: CAFE_CALCULATOR_JOB_ID,
          submissionId: "submission-browser",
          claimedAt: "2026-11-19T12:00:00.000Z",
        }),
        hydrated: true,
        loading: false,
        error: null,
        invalidRecord: false,
      });
    });

    await waitFor(() => {
      expect((window as Window & { __codequestChapterState?: unknown }).__codequestChapterState).toMatchObject({
        schema: 1,
        questId: "CH1-08",
        chapterComplete: false,
        money: 75,
        paymentClaimed: true,
      });
      expect(
        (iframe.contentWindow as Window & { __codequestChapterState?: unknown }).__codequestChapterState,
      ).toMatchObject({ questId: "CH1-08" });
    });

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          source,
          data: { ...FATHER_DIALOGUE_COMPLETION_PAYLOAD, type: "codequest:player-moved" },
        }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("chapter1-completion-banner")).not.toBeInTheDocument();
    expect(useChapter1.getState().progress.currentQuestIndex).toBe(7);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          source,
          data: FATHER_DIALOGUE_COMPLETION_PAYLOAD,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("chapter1-completion-banner")).toHaveTextContent(
        CHAPTER1_COMPLETE_TITLE,
      );
      expect(screen.getByTestId("chapter1-completion-banner")).toHaveTextContent(
        CHAPTER1_COMPLETE_MESSAGE,
      );
    });

    expect(useChapter1.getState().progress.currentQuestIndex).toBe(CHAPTER1_QUESTS.length);
    expect(useChapter1.getState().progress.money).toBe(75);
    expect(useChapter1.getState().progress.completedQuestIds).toHaveLength(CHAPTER1_QUESTS.length);
    expect(useNotifications.getState().history[0]?.title).toBe(CHAPTER1_COMPLETE_TITLE);
  });
});
