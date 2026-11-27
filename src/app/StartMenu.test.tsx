import { cleanup, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPS, APP_ORDER, START_PINNED_APPS, type AppId } from "@/core/applications/registry";
import { useBrowserNavigationIntent } from "@/features/browser/browserNavigationIntent";
import { GIGBOARD_ADDRESS } from "@/features/browser/browserRoutes";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { initialChapter1Progress } from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { useProgress } from "@/features/progress/progressStore";
import StartMenu, { type StartMenuProps } from "./StartMenu";

type StartOverrides = Partial<StartMenuProps>;

function renderStart(overrides: StartOverrides = {}) {
  const menuRef = createRef<HTMLDivElement>();
  const startButtonRef = createRef<HTMLButtonElement>();
  const onClose = vi.fn();
  const onLaunch = vi.fn();
  const onReturnToGame = vi.fn();
  const props: StartMenuProps = {
    menuRef,
    startButtonRef,
    onClose,
    onLaunch,
    onReturnToGame,
    playerName: "Test Player",
    ...overrides,
  };
  const view = render(
    <>
      <button ref={startButtonRef} data-testid="start-button-host">
        Start
      </button>
      <button data-testid="outside-app">Game window</button>
      <StartMenu {...props} />
    </>,
  );
  return { view, props, menuRef, startButtonRef, onClose, onLaunch, onReturnToGame };
}

function tutorialId(id: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(`[data-tutorial-id="${id}"]`);
  if (!element) throw new Error(`Missing tutorial element: ${id}`);
  return element;
}

beforeEach(() => {
  useChapter1.setState({
    progress: initialChapter1Progress,
    hydrated: true,
    loading: false,
    error: null,
  });
  useProgress.setState({ completions: {}, currentTicketId: null, started: [] });
  useBrowserNavigationIntent.setState({ request: null });
});

afterEach(() => {
  cleanup();
  useBrowserNavigationIntent.setState({ request: null });
});

describe("StartMenu", () => {
  it("renders the ten Start-only pinned apps in their own order with stable IDs", () => {
    renderStart();

    expect(screen.getByRole("dialog", { name: "Start menu" })).toHaveAttribute(
      "data-tutorial-id",
      "start-menu",
    );
    expect(
      Array.from(document.querySelectorAll("[data-tutorial-id^='start-pinned-app-']")).map(
        (element) => element.getAttribute("data-tutorial-id"),
      ),
    ).toEqual(START_PINNED_APPS.map((id) => `start-pinned-app-${id}`));
    expect(tutorialId("start-search")).toBeInTheDocument();
    expect(tutorialId("start-all-apps-button")).toBeInTheDocument();
  });

  it("shows every registered app in All apps, including unpinned apps", () => {
    renderStart();
    fireEvent.click(tutorialId("start-all-apps-button"));

    expect(screen.getByRole("heading", { name: "All applications" })).toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll("[data-tutorial-id^='start-all-app-']")).map((element) =>
        element.getAttribute("data-tutorial-id"),
      ),
    ).toEqual(APP_ORDER.map((id) => `start-all-app-${id}`));
    expect(APPS.explorer.pinned).toBe(false);
    expect(tutorialId("start-all-app-explorer")).toBeInTheDocument();

    fireEvent.click(tutorialId("start-back-button"));
    expect(screen.getByRole("heading", { name: "Pinned applications" })).toBeInTheDocument();
  });

  it("searches applications by ID and launches the first result with Enter", () => {
    const { onLaunch } = renderStart();
    const input = screen.getByPlaceholderText("Search applications...");

    fireEvent.change(input, { target: { value: "explorer" } });

    const results = screen.getByRole("group", { name: "Search results" });
    expect(within(results).getAllByRole("button")).toHaveLength(1);
    expect(tutorialId("start-pinned-app-explorer")).toBeInTheDocument();

    const arrowEvent = createEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent(input, arrowEvent);
    expect(arrowEvent.defaultPrevented).toBe(false);
    expect(onLaunch).not.toHaveBeenCalled();

    const enterEvent = createEvent.keyDown(input, { key: "Enter" });
    fireEvent(input, enterEvent);
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(onLaunch).toHaveBeenCalledWith("explorer" satisfies AppId);
  });

  it("shows an application-only empty state for non-app queries", () => {
    renderStart();
    fireEvent.change(screen.getByPlaceholderText("Search applications..."), {
      target: { value: "homework.pdf" },
    });

    expect(screen.getByRole("status")).toHaveTextContent("No applications found");
    expect(document.querySelector("input[type='file']")).toBeNull();
  });

  it("moves focus through results without intercepting Tab", () => {
    renderStart();
    const browser = tutorialId("start-pinned-app-browser");
    const mail = tutorialId("start-pinned-app-mail");
    const settings = tutorialId("start-pinned-app-settings");
    browser.focus();

    const tabEvent = createEvent.keyDown(browser, { key: "Tab" });
    fireEvent(browser, tabEvent);
    expect(tabEvent.defaultPrevented).toBe(false);

    fireEvent.keyDown(browser, { key: "ArrowRight" });
    expect(document.activeElement).toBe(mail);

    fireEvent.keyDown(mail, { key: "End" });
    expect(document.activeElement).toBe(settings);

    fireEvent.keyDown(settings, { key: "Home" });
    expect(document.activeElement).toBe(browser);
  });

  it("restores focus through onClose for Escape and the header close action", () => {
    const { onClose } = renderStart();
    expect(screen.getByPlaceholderText("Search applications...")).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(true);

    onClose.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Close Start menu" }));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("dismisses on outside pointerdown without stealing focus from the target app", () => {
    const { onClose, startButtonRef } = renderStart();
    const outside = screen.getByTestId("outside-app");
    outside.focus();

    fireEvent.pointerDown(outside);
    expect(onClose).toHaveBeenCalledWith(false);
    expect(outside).toHaveFocus();

    onClose.mockClear();
    const startButton = startButtonRef.current;
    expect(startButton).not.toBeNull();
    fireEvent.pointerDown(startButton!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requests GigBoard navigation through the existing Browser intent", () => {
    const { onLaunch } = renderStart();

    fireEvent.click(screen.getByRole("button", { name: "Open GigBoard in Browser" }));

    expect(useBrowserNavigationIntent.getState().request).toMatchObject({
      address: GIGBOARD_ADDRESS,
    });
    expect(onLaunch).toHaveBeenCalledWith("browser");
    expect(tutorialId("start-recommended-gigboard")).toBeInTheDocument();
    expect(tutorialId("start-recommended-journal")).toBeInTheDocument();
  });

  it("shows real character/quest data and a working Return to Game action", () => {
    const { onClose, onLaunch, onReturnToGame } = renderStart({ playerName: "Ada Pixel" });

    expect(screen.getByText("Ada Pixel")).toBeInTheDocument();
    expect(screen.getByText(/Level 1/)).toBeInTheDocument();
    expect(
      screen.getByText(`0/${CHAPTER1_QUESTS.length} Chapter 1 quests complete`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Return to Game/ }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(onReturnToGame).toHaveBeenCalledOnce();

    fireEvent.click(tutorialId("start-settings"));
    expect(onLaunch).toHaveBeenCalledWith("settings");
  });

  it("falls back to Player when no character name is supplied", () => {
    renderStart({ playerName: "   " });
    expect(screen.getByText("Player")).toBeInTheDocument();
  });
});
