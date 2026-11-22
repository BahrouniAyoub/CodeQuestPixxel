import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { createCafePaymentRecord } from "@/features/chapter1/cafeCoding/cafePayment";
import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import { completeChapter1Quest, initialChapter1Progress } from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import {
  COMPUTER_INTERACTION_COMPLETION_PAYLOAD,
  FATHER_DIALOGUE_COMPLETION_PAYLOAD,
  FATHER_INTRO_COMPLETION_PAYLOAD,
  GODOT_CHAPTER_STATE_EVENT_TYPE,
} from "@/features/chapter1/godotBridge";
import { useNotifications } from "@/features/notifications/notificationStore";
import { trackedSave } from "@/services/persistence/saveStatus";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/persistence/db", () => ({
  DB_NAME: "codequest-pixel-os",
  DB_VERSION: 1,
  StorageUnavailableError: class StorageUnavailableError extends Error {},
  dbGet: vi.fn(async () => undefined),
  dbGetAll: vi.fn(async () => ({})),
  dbSet: vi.fn(async () => undefined),
  dbClear: vi.fn(async () => undefined),
  dbDelete: vi.fn(async () => undefined),
  dbAtomic: vi.fn(async () => ({ ok: false, reason: "mock", conflict: false })),
}));

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return { ...actual, trackedSave: vi.fn(async () => true) };
});

vi.mock("@/app/PixelOS", async () => {
  const React = await import("react");
  return {
    default: function MockPixelOS() {
      return React.createElement("div", { "data-testid": "pixel-os" }, "PixelOS");
    },
  };
});

import { BrowserGame } from "./game";

function progressAfter(count: number) {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function chapterMirror(): { questId?: string | null; questObjective?: string | null } {
  return (window as Window & { __codequestChapterState?: Record<string, unknown> })
    .__codequestChapterState as { questId?: string | null; questObjective?: string | null };
}

function dispatchFromGodot(source: MessageEventSource, data: unknown) {
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: window.location.origin,
      source,
      data,
    }),
  );
}

beforeEach(() => {
  vi.mocked(trackedSave).mockClear();
  useNotifications.setState({ history: [], toasts: [], unseen: 0 });
  useChapter1.setState({
    progress: initialChapter1Progress,
    hydrated: false,
    loading: false,
    error: null,
  });
  useCafePayment.setState({
    payment: null,
    hydrated: false,
    loading: false,
    error: null,
    invalidRecord: false,
  });
});

afterEach(cleanup);

describe("/game fresh Chapter 1 journey", () => {
  it("starts a new player at CH1-01 and advances only from real Godot events", async () => {
    render(<BrowserGame />);
    const iframe = document.querySelector<HTMLIFrameElement>("#codequest-godot")!;
    const source = iframe.contentWindow as unknown as MessageEventSource;

    await waitFor(() => {
      expect(useChapter1.getState().hydrated).toBe(true);
      expect(useCafePayment.getState().hydrated).toBe(true);
    });

    // 1. A genuinely new player starts at CH1-01 in React and in the mirror.
    expect(useChapter1.getState().progress.currentQuestIndex).toBe(0);
    expect(useChapter1.getState().progress.completedQuestIds).toEqual([]);
    expect(chapterMirror()).toMatchObject({
      schema: 1,
      questId: "CH1-01",
      questObjective: "Talk to Dad in the living room",
      chapterComplete: false,
      money: 0,
      paymentClaimed: false,
    });
    expect(
      (iframe.contentWindow as Window & { __codequestChapterState?: Record<string, unknown> })
        .__codequestChapterState,
    ).toMatchObject({ questId: "CH1-01" });
    expect(vi.mocked(trackedSave)).not.toHaveBeenCalled();

    // 2. The real father-introduction end event completes CH1-01.
    act(() => dispatchFromGodot(source, FATHER_INTRO_COMPLETION_PAYLOAD));
    await waitFor(() => {
      expect(useChapter1.getState().progress.currentQuestIndex).toBe(1);
      expect(chapterMirror()).toMatchObject({
        questId: "CH1-02",
        questObjective: "Use the computer in your bedroom",
      });
    });
    expect(screen.queryByTestId("chapter1-completion-banner")).not.toBeInTheDocument();

    // 3. Loading PixelOS from the open-os bridge event does not complete CH1-02.
    act(() => dispatchFromGodot(source, { type: "codequest:open-os" }));
    await screen.findByTestId("pixel-os");
    expect(useChapter1.getState().progress.currentQuestIndex).toBe(1);
    expect(chapterMirror().questId).toBe("CH1-02");

    // 4. The real computer E interaction completes CH1-02 and exposes CH1-03.
    act(() => dispatchFromGodot(source, COMPUTER_INTERACTION_COMPLETION_PAYLOAD));
    await waitFor(() => {
      expect(useChapter1.getState().progress.currentQuestIndex).toBe(2);
      expect(chapterMirror()).toMatchObject({
        questId: "CH1-03",
        questObjective: "Find a Python job on GigBoard",
      });
    });

    // 5. Repeated interactions do not write or advance again.
    act(() => dispatchFromGodot(source, COMPUTER_INTERACTION_COMPLETION_PAYLOAD));
    await act(async () => {
      await Promise.resolve();
    });
    expect(useChapter1.getState().progress.currentQuestIndex).toBe(2);
    expect(vi.mocked(trackedSave)).toHaveBeenCalledTimes(2);
    expect(useChapter1.getState().progress.completedQuestIds).toEqual(["CH1-01", "CH1-02"]);
  });

  it("publishes the CH1-08 objective immediately without reloading Godot, then finishes Chapter 1", async () => {
    render(<BrowserGame />);
    const iframe = document.querySelector<HTMLIFrameElement>("#codequest-godot")!;
    const source = iframe.contentWindow as unknown as MessageEventSource;
    const srcBefore = iframe.getAttribute("src");

    await waitFor(() => {
      expect(useChapter1.getState().hydrated).toBe(true);
      expect(useCafePayment.getState().hydrated).toBe(true);
    });

    const postMessage = vi.spyOn(iframe.contentWindow as Window, "postMessage");

    act(() => {
      useChapter1.setState({
        progress: { ...progressAfter(7), money: 50, paymentClaimed: true },
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
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: GODOT_CHAPTER_STATE_EVENT_TYPE,
          state: expect.objectContaining({
            schema: 1,
            questId: "CH1-08",
            questObjective: "Go home and tell Dad about your job",
            money: 50,
            paymentClaimed: true,
          }),
        }),
        window.location.origin,
      );
    });
    expect(chapterMirror()).toMatchObject({
      questId: "CH1-08",
      questObjective: "Go home and tell Dad about your job",
    });
    expect(iframe.getAttribute("src")).toBe(srcBefore);

    act(() => dispatchFromGodot(source, FATHER_DIALOGUE_COMPLETION_PAYLOAD));
    await waitFor(() => {
      expect(screen.getByTestId("chapter1-completion-banner")).toBeInTheDocument();
      expect(useChapter1.getState().progress.currentQuestIndex).toBe(CHAPTER1_QUESTS.length);
    });
    expect(useChapter1.getState().progress.money).toBe(50);
  });
});
