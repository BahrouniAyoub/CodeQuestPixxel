import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import { initialChapter1Progress } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { createGameSaveRecord, DEFAULT_CHARACTER } from "@/features/gameMenu/gameSave";
import { trackedSave } from "@/services/persistence/saveStatus";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return { ...actual, trackedSave: vi.fn(async () => true) };
});

const savedGame = createGameSaveRecord({
  slot: "auto",
  reason: "Bedroom rest",
  character: { ...DEFAULT_CHARACTER, name: "Saved Pixel Kid" },
  progress: {
    currentQuestIndex: 2,
    completedQuestIds: ["CH1-01", "CH1-02"],
    money: 25,
    paymentClaimed: false,
  },
  payment: null,
});

vi.mock("@/features/gameMenu/gameSave", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/gameMenu/gameSave")>();
  return { ...actual, listGameSaves: vi.fn(async () => []) };
});

import { listGameSaves } from "@/features/gameMenu/gameSave";
import { BrowserGame } from "./game";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listGameSaves).mockResolvedValue([]);
});

afterEach(cleanup);

function godotMessage(data: Record<string, unknown>, source: MessageEventSource): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        source,
        data,
      }),
    );
  });
}

describe("/game Godot-owned menu bridge", () => {
  it("does not render a React menu and resets React progress on Godot new-game", async () => {
    render(<BrowserGame />);

    expect(screen.queryByTestId("game-menu")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(useChapter1.getState().loading).toBe(false);
      expect(useCafePayment.getState().loading).toBe(false);
    });

    const iframe = document.querySelector<HTMLIFrameElement>("#codequest-godot")!;
    const source = iframe.contentWindow as unknown as MessageEventSource;

    act(() => {
      useChapter1.setState({
        progress: {
          currentQuestIndex: 4,
          completedQuestIds: ["CH1-01", "CH1-02", "CH1-03", "CH1-04"],
          money: 50,
          paymentClaimed: true,
        },
        hydrated: true,
        loading: false,
        error: null,
      });
    });

    godotMessage({ type: "codequest:new-game", source: "godot" }, source);

    await waitFor(() => {
      expect(useChapter1.getState().progress).toEqual(initialChapter1Progress);
    });
  });

  it("answers a Godot save request with a full state snapshot without writing React saves", async () => {
    render(<BrowserGame />);
    const iframe = document.querySelector<HTMLIFrameElement>("#codequest-godot")!;
    const iframeWindow = iframe.contentWindow as Window;
    const source = iframeWindow as unknown as MessageEventSource;
    const postMessage = vi.spyOn(iframeWindow, "postMessage");

    await waitFor(() => {
      expect(useChapter1.getState().loading).toBe(false);
      expect(useCafePayment.getState().loading).toBe(false);
    });

    act(() => {
      useChapter1.setState({
        progress: {
          currentQuestIndex: 4,
          completedQuestIds: ["CH1-01", "CH1-02", "CH1-03", "CH1-04"],
          money: 50,
          paymentClaimed: false,
        },
        hydrated: true,
        loading: false,
        error: null,
      });
      useCafePayment.setState({
        hydrated: true,
        loading: false,
        error: null,
        invalidRecord: false,
      });
    });

    godotMessage(
      {
        type: "codequest:request-state",
        source: "godot",
        requestId: "save-1",
        slot: "auto",
        reason: "Bedroom rest",
        character: {
          name: "Pixel Kid",
          body_index: 0,
          skin_index: 2,
          hair_style_index: 1,
          hair_color_index: 3,
          top_index: 4,
          bottom_index: 5,
          feet_index: 6,
        },
      },
      source,
    );

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "codequest:state-snapshot",
          source: "react",
          requestId: "save-1",
          slot: "auto",
          reason: "Bedroom rest",
          character: expect.objectContaining({ name: "Pixel Kid", skin_index: 2 }),
          progress: expect.objectContaining({ currentQuestIndex: 4 }),
          chapterState: expect.objectContaining({ schema: 1, questId: "CH1-05" }),
        }),
        window.location.origin,
      );
    });
    expect(trackedSave).not.toHaveBeenCalled();
  });

  it("adopts a complete Godot save and acknowledges the load", async () => {
    render(<BrowserGame />);
    const iframe = document.querySelector<HTMLIFrameElement>("#codequest-godot")!;
    const iframeWindow = iframe.contentWindow as Window;
    const source = iframeWindow as unknown as MessageEventSource;
    const postMessage = vi.spyOn(iframeWindow, "postMessage");

    await waitFor(() => {
      expect(useChapter1.getState().loading).toBe(false);
      expect(useCafePayment.getState().loading).toBe(false);
    });

    godotMessage({ type: "codequest:load-state", source: "godot", save: savedGame }, source);

    await waitFor(() => {
      expect(useChapter1.getState().progress.currentQuestIndex).toBe(2);
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "codequest:load-applied", source: "react" }),
        window.location.origin,
      );
    });
    expect(screen.getByTestId("game-save-notice")).toHaveTextContent("Loaded Saved Pixel Kid");
    expect(trackedSave).not.toHaveBeenCalled();
  });

  it("asks Godot to auto-save when an OS task advances the quest", async () => {
    render(<BrowserGame />);
    const iframe = document.querySelector<HTMLIFrameElement>("#codequest-godot")!;
    const iframeWindow = iframe.contentWindow as Window;
    const source = iframeWindow as unknown as MessageEventSource;
    const postMessage = vi.spyOn(iframeWindow, "postMessage");

    await waitFor(() => {
      expect(useChapter1.getState().loading).toBe(false);
      expect(useCafePayment.getState().loading).toBe(false);
    });

    act(() => {
      useChapter1.setState({
        progress: {
          currentQuestIndex: 1,
          completedQuestIds: ["CH1-01"],
          money: 0,
          paymentClaimed: false,
        },
        hydrated: true,
        loading: false,
        error: null,
      });
    });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "codequest:state-commit",
          source: "react",
          slot: "auto",
          reason: "PixelOS task complete",
        }),
        window.location.origin,
      );
    });
    expect(trackedSave).not.toHaveBeenCalled();
    expect(source).toBeTruthy();
  });

  it("imports legacy React saves into Godot storage once", async () => {
    vi.mocked(listGameSaves).mockResolvedValue([savedGame]);
    render(<BrowserGame />);
    const iframe = document.querySelector<HTMLIFrameElement>("#codequest-godot")!;
    const iframeWindow = iframe.contentWindow as Window;
    const postMessage = vi.spyOn(iframeWindow, "postMessage");

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "codequest:import-saves",
          source: "react",
          saves: [
            expect.objectContaining({
              slot: "auto",
              chapterState: expect.objectContaining({ schema: 1, questId: "CH1-03" }),
            }),
          ],
        }),
        window.location.origin,
      );
    });
  });
});
