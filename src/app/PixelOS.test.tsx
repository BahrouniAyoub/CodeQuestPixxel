import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/core/windows/windowReducer";
import { useWindows } from "@/core/windows/windowStore";
import { useBrowserNavigationIntent } from "@/features/browser/browserNavigationIntent";
import { useNotifications } from "@/features/notifications/notificationStore";
import { useSettings } from "@/features/settings/settingsStore";
import PixelOS from "./PixelOS";

vi.mock("@/services/persistence/db", () => ({
  DB_NAME: "codequest-pixel-os",
  DB_VERSION: 1,
  StorageUnavailableError: class StorageUnavailableError extends Error {},
  dbGet: vi.fn(async () => undefined),
  dbGetAll: vi.fn(async () => []),
  dbSet: vi.fn(async () => undefined),
  dbClear: vi.fn(async () => undefined),
  dbDelete: vi.fn(async () => undefined),
  dbAtomic: vi.fn(async () => ({ ok: false, reason: "mock", conflict: false })),
}));

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return {
    ...actual,
    trackedSave: vi.fn(async () => true),
    trackedTransaction: vi.fn(async (operation: () => Promise<unknown>) => operation()),
    debouncedSave: vi.fn(),
  };
});

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

const bounds = { width: 1280, height: 720 };

beforeEach(() => {
  useWindows.setState(createInitialState(bounds));
  useSettings.setState({
    theme: "dark",
    uiScale: 1,
    reducedMotion: false,
    notificationsEnabled: true,
  });
  useBrowserNavigationIntent.setState({ request: null });
  useNotifications.setState({ history: [], toasts: [], unseen: 0 });
});

afterEach(cleanup);

async function renderReady(osProps: { playerName: string; onReturnToGame: () => void }) {
  const view = render(<PixelOS {...osProps} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading saved CodeQuest workspace/)).not.toBeInTheDocument();
  });
  return view;
}

function startButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Open Start menu" }) as HTMLButtonElement;
}

describe("PixelOS Start menu integration", () => {
  it("blurs the hidden menu and focuses a launched window", async () => {
    await renderReady({ playerName: "Launch Hero", onReturnToGame: vi.fn() });

    fireEvent.click(startButton());
    const search = screen.getByPlaceholderText("Search applications...");
    expect(search).toHaveFocus();

    const editor = document.querySelector<HTMLButtonElement>(
      '[data-tutorial-id="start-pinned-app-editor"]',
    );
    expect(editor).not.toBeNull();
    fireEvent.click(editor!);

    await waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('[data-window-id="editor"]'));
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Start menu" })).not.toBeInTheDocument();
    });
    expect(useWindows.getState().windows.editor.open).toBe(true);
  });

  it("restores focus to the Start button after Escape", async () => {
    await renderReady({ playerName: "Launch Hero", onReturnToGame: vi.fn() });
    const button = startButton();

    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Start menu" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(button).toHaveFocus();

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Start menu" })).not.toBeInTheDocument();
    });
  });

  it("uses the provided player name in the Start footer", async () => {
    await renderReady({ playerName: "Ada Pixel", onReturnToGame: vi.fn() });
    fireEvent.click(startButton());

    expect(screen.getByText("Ada Pixel")).toBeInTheDocument();
  });

  it("applies theme, UI scale and reduced-motion settings to the desktop shell", async () => {
    await renderReady({ playerName: "Player", onReturnToGame: vi.fn() });
    act(() => {
      useSettings.setState({
        theme: "light",
        uiScale: 1.25,
        reducedMotion: true,
      });
    });

    const shell = document.querySelector<HTMLElement>(".cq-os");
    expect(shell).toHaveClass("theme-light");
    expect(shell).toHaveClass("cq-reduced-motion");
    expect(shell).toHaveStyle("--cq-scale: 1.25");
  });
});
