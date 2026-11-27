import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/core/windows/windowReducer";
import { useWindows } from "@/core/windows/windowStore";
import { useBrowserNavigationIntent } from "@/features/browser/browserNavigationIntent";
import { useNotifications } from "@/features/notifications/notificationStore";
import { useSettings, DEFAULT_SETTINGS } from "@/features/settings/settingsStore";
import { useFileSession } from "@/features/editor/fileSession";
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

Object.defineProperty(window, "ResizeObserver", { writable: true, value: MockResizeObserver });
Object.defineProperty(Element.prototype, "scrollTo", { writable: true, value: vi.fn() });

const bounds = { width: 1280, height: 720 };

beforeEach(() => {
  useWindows.setState(createInitialState(bounds));
  useSettings.setState({ ...DEFAULT_SETTINGS, taskbarPinnedAppIds: undefined } as any);
  useBrowserNavigationIntent.setState({ request: null });
  useNotifications.setState({ history: [], toasts: [], unseen: 0 });
  useFileSession.setState({ filePath: null, dirty: false });
});

afterEach(cleanup);

async function renderReady() {
  render(<PixelOS playerName="Player" onReturnToGame={vi.fn()} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading saved CodeQuest workspace/)).not.toBeInTheDocument();
  });
}

function taskbarApp(id: string): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-tutorial-id="taskbar-app-${id}"]`)!;
}

describe("Taskbar", () => {
  it("renders pinned apps and adds open unpinned apps dynamically without duplicates", async () => {
    await renderReady();
    expect(taskbarApp("editor")).toBeInTheDocument();
    expect(document.querySelector('[data-tutorial-id="taskbar-app-terminal"]')).toBeNull();

    act(() => {
      useWindows.getState().open("terminal");
    });

    await waitFor(() => {
      expect(taskbarApp("terminal")).toBeInTheDocument();
    });
    expect(document.querySelectorAll('[data-tutorial-id="taskbar-app-terminal"]')).toHaveLength(1);
  });

  it("removes unpinned app when closed and keeps pinned app", async () => {
    await renderReady();
    act(() => {
      useWindows.getState().open("terminal");
      useWindows.getState().open("editor");
    });
    await waitFor(() => expect(taskbarApp("terminal")).toBeInTheDocument());

    act(() => {
      useWindows.getState().close("terminal");
      useWindows.getState().close("editor");
    });

    await waitFor(() => {
      expect(document.querySelector('[data-tutorial-id="taskbar-app-terminal"]')).toBeNull();
    });
    expect(taskbarApp("editor")).toBeInTheDocument();
  });

  it("uses taskbar click semantics for focused, minimized and background apps", async () => {
    await renderReady();
    act(() => {
      useWindows.getState().open("browser");
      useWindows.getState().open("editor");
    });
    await waitFor(() => expect(taskbarApp("editor")).toHaveAttribute("data-app-state", "focused"));

    fireEvent.click(taskbarApp("editor"));
    expect(useWindows.getState().windows.editor.minimized).toBe(true);

    fireEvent.click(taskbarApp("editor"));
    expect(useWindows.getState().windows.editor.minimized).toBe(false);
    expect(useWindows.getState().focused).toBe("editor");

    fireEvent.click(taskbarApp("browser"));
    expect(useWindows.getState().focused).toBe("browser");
  });

  it("shows distinct state indicators and tutorial IDs", async () => {
    await renderReady();
    act(() => {
      useWindows.getState().open("browser");
      useWindows.getState().open("editor");
      useWindows.getState().minimize("browser");
    });
    await waitFor(() => {
      expect(taskbarApp("browser")).toHaveAttribute("data-app-state", "minimized");
      expect(taskbarApp("editor")).toHaveAttribute("data-app-state", "focused");
      expect(taskbarApp("tickets")).toHaveAttribute("data-app-state", "closed-pinned");
    });
    expect(document.querySelector('[data-tutorial-id="taskbar-app-indicator-editor"]')).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Running and pinned applications" })).toBeInTheDocument();
  });

  it("supports context menu actions and uses close path for editor unsaved protection", async () => {
    window.confirm = vi.fn(() => false);
    await renderReady();
    act(() => {
      useWindows.getState().open("editor");
    });
    await waitFor(() => expect(taskbarApp("editor")).toBeInTheDocument());

    fireEvent.contextMenu(taskbarApp("editor"));
    const menu = screen.getByRole("menu", { name: "Code Editor taskbar actions" });
    expect(within(menu).getByRole("menuitem", { name: "Close" })).toBeInTheDocument();

    act(() => {
      useFileSession.setState({ filePath: "/home/user/test.py", dirty: true });
      useWindows.getState().close("editor");
    });

    expect(useWindows.getState().windows.editor.open).toBe(true);
  });

  it("pins and unpins apps with correct visibility rules", async () => {
    await renderReady();

    act(() => {
      useWindows.getState().open("terminal");
    });
    await waitFor(() => expect(taskbarApp("terminal")).toBeInTheDocument());

    fireEvent.contextMenu(taskbarApp("terminal"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin to taskbar" }));
    expect(useSettings.getState().taskbarPinnedAppIds).toContain("terminal");

    fireEvent.contextMenu(taskbarApp("terminal"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpin from taskbar" }));
    expect(taskbarApp("terminal")).toBeInTheDocument(); // still open

    act(() => {
      useWindows.getState().close("terminal");
    });
    await waitFor(() => {
      expect(document.querySelector('[data-tutorial-id="taskbar-app-terminal"]')).toBeNull();
    });

    // Unpinning a closed pinned app removes it immediately.
    fireEvent.contextMenu(taskbarApp("editor"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpin from taskbar" }));
    await waitFor(() => {
      expect(document.querySelector('[data-tutorial-id="taskbar-app-editor"]')).toBeNull();
    });
  });

  it("respects explicit empty pin preference and normalizes invalid persisted IDs", async () => {
    useSettings.setState({
      ...DEFAULT_SETTINGS,
      taskbarPinnedAppIds: [],
    });
    await renderReady();
    expect(document.querySelectorAll('[data-tutorial-id^="taskbar-app-"]')).toHaveLength(0);

    act(() => {
      useSettings.getState().hydrate({
        taskbarPinnedAppIds: ["editor", "bogus", "editor", "terminal"] as any,
      });
    });
    await waitFor(() => {
      const ids = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-tutorial-id^="taskbar-app-"]'),
      )
        .filter((el) => !el.getAttribute("data-tutorial-id")?.includes("-indicator-"))
        .map((el) => el.getAttribute("data-tutorial-id"));
      expect(ids).toEqual(["taskbar-app-editor", "taskbar-app-terminal"]);
    });
  });

  it("opens a closed pinned app from taskbar click and supports context menu state actions", async () => {
    await renderReady();
    await waitFor(() => expect(taskbarApp("tickets")).toBeInTheDocument());

    fireEvent.click(taskbarApp("tickets"));
    expect(useWindows.getState().windows.tickets.open).toBe(true);
    expect(useWindows.getState().focused).toBe("tickets");

    fireEvent.contextMenu(taskbarApp("tickets"));
    let menu = screen.getByRole("menu", { name: "My Tickets taskbar actions" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Minimize" }));
    expect(useWindows.getState().windows.tickets.minimized).toBe(true);

    fireEvent.contextMenu(taskbarApp("tickets"));
    menu = screen.getByRole("menu", { name: "My Tickets taskbar actions" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Restore" }));
    expect(useWindows.getState().windows.tickets.minimized).toBe(false);
  });
});
