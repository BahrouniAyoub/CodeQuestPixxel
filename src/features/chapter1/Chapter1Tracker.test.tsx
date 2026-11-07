import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TICKETS } from "@/features/tickets/data/tickets";
import { ProgressApp } from "@/features/progress/ProgressApp";
import { useProgress } from "@/features/progress/progressStore";
import { Chapter1Tracker } from "./Chapter1Tracker";
import {
  completeChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "./chapter1Progress";
import { CHAPTER1_QUESTS } from "./chapter1Quests";
import { useChapter1 } from "./chapter1Store";

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function resetChapter1(
  state: Partial<{
    progress: Chapter1Progress;
    hydrated: boolean;
    loading: boolean;
    error: string | null;
  }> = {},
): void {
  useChapter1.setState({
    progress: initialChapter1Progress,
    hydrated: false,
    loading: false,
    error: null,
    ...state,
  });
}

beforeEach(() => {
  resetChapter1();
  useProgress.setState({
    completions: {},
    currentTicketId: "CQ-001",
    started: [],
    celebrate: 0,
  });
});

afterEach(cleanup);

describe("Chapter1Tracker", () => {
  it("shows a loading state before hydration completes", () => {
    resetChapter1({ loading: true });
    render(<Chapter1Tracker />);

    expect(screen.getByTestId("chapter1-loading")).toHaveTextContent("Loading Chapter 1 progress…");
    expect(screen.queryByText("A Difficult Morning")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("does not present unhydrated progress as saved when loading failed", () => {
    resetChapter1({
      loading: false,
      error: "Could not load Chapter 1 progress: no storage",
    });
    render(<Chapter1Tracker />);

    expect(screen.getByText("Chapter 1 progress is not available.")).toBeInTheDocument();
    expect(screen.queryByText("A Difficult Morning")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load Chapter 1 progress");
  });

  it("displays the initial quest and objective after hydration", () => {
    resetChapter1({ hydrated: true });
    render(<Chapter1Tracker />);

    expect(
      screen.getByRole("heading", { name: /Chapter 1 — The First Paycheck/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("CH1-01")).toBeInTheDocument();
    expect(screen.getByText("A Difficult Morning")).toBeInTheDocument();
    expect(screen.getByText("Listen to your father's warning")).toBeInTheDocument();
    expect(screen.getByText("0 / 8 COMPLETE")).toBeInTheDocument();
    expect(screen.getByText("IN PROGRESS")).toBeInTheDocument();
  });

  it("advances the display after one completed quest", () => {
    resetChapter1({ hydrated: true, progress: progressAfter(1) });
    render(<Chapter1Tracker />);

    expect(screen.getByText("CH1-02")).toBeInTheDocument();
    expect(screen.getByText("Find a Way Out")).toBeInTheDocument();
    expect(screen.getByText("Go to your bedroom and open the computer")).toBeInTheDocument();
    expect(screen.getByText("1 / 8 COMPLETE")).toBeInTheDocument();
    expect(screen.queryByText("A Difficult Morning")).not.toBeInTheDocument();
  });

  it("reports completion percentage from the quest definitions", () => {
    resetChapter1({ hydrated: true, progress: progressAfter(1) });
    render(<Chapter1Tracker />);

    const bar = screen.getByRole("progressbar", { name: "Chapter 1 quest progress" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", String(CHAPTER1_QUESTS.length));
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuetext", "1 of 8 quests complete (12.5%)");
    expect(screen.getByText("1 / 8 · 12.5%")).toBeInTheDocument();
    expect(bar.firstElementChild).toHaveStyle({ width: "12.5%" });
  });

  it("shows earnings before the payment quest", () => {
    resetChapter1({ hydrated: true, progress: progressAfter(6) });
    render(<Chapter1Tracker />);

    expect(screen.getByText("$0 / $50")).toBeInTheDocument();
    expect(screen.getByText("CH1-07")).toBeInTheDocument();
  });

  it("shows earnings after CH1-07", () => {
    resetChapter1({ hydrated: true, progress: progressAfter(7) });
    render(<Chapter1Tracker />);

    expect(screen.getByText("$50 / $50")).toBeInTheDocument();
    expect(screen.getByText("CH1-08")).toBeInTheDocument();
    expect(screen.getByText("7 / 8 COMPLETE")).toBeInTheDocument();
  });

  it("shows the chapter-complete state after all quests", () => {
    resetChapter1({ hydrated: true, progress: progressAfter(CHAPTER1_QUESTS.length) });
    render(<Chapter1Tracker />);

    expect(screen.getByText("Chapter complete")).toBeInTheDocument();
    expect(screen.getByText("8 / 8 COMPLETE")).toBeInTheDocument();
    expect(screen.getByText("CHAPTER COMPLETE")).toBeInTheDocument();
    expect(screen.getByText("$50 / $50")).toBeInTheDocument();
    expect(screen.getByText("8 / 8 · 100%")).toBeInTheDocument();
    expect(screen.queryByText("A New Beginning")).not.toBeInTheDocument();
  });

  it("shows a non-blocking warning when saved data was recovered", () => {
    resetChapter1({
      hydrated: true,
      error: "Saved Chapter 1 progress was invalid and was not loaded: bad data.",
    });
    render(<Chapter1Tracker />);

    expect(screen.getByRole("alert")).toHaveTextContent("Saved Chapter 1 progress was invalid");
    expect(screen.getByText("A Difficult Morning")).toBeInTheDocument();
  });

  it("reacts to Zustand store updates", () => {
    resetChapter1({ hydrated: true });
    render(<Chapter1Tracker />);

    expect(screen.getByText("A Difficult Morning")).toBeInTheDocument();

    act(() => useChapter1.setState({ progress: progressAfter(1) }));
    expect(screen.getByText("CH1-02")).toBeInTheDocument();
    expect(screen.queryByText("CH1-01")).not.toBeInTheDocument();

    act(() => useChapter1.setState({ progress: progressAfter(7) }));
    expect(screen.getByText("$50 / $50")).toBeInTheDocument();

    act(() => useChapter1.setState({ progress: progressAfter(CHAPTER1_QUESTS.length) }));
    expect(screen.getByText("Chapter complete")).toBeInTheDocument();
  });

  it("keeps the existing Progress app sections working", () => {
    resetChapter1({ hydrated: true });
    render(<ProgressApp />);

    expect(
      screen.getByRole("heading", { name: /Chapter 1 — The First Paycheck/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Achievements/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sprint 01 · Python basics/ })).toBeInTheDocument();
    expect(screen.getByText("TOTAL XP")).toBeInTheDocument();
    expect(screen.getByText("0/5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hello, Pixel City/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(TICKETS.length);
  });
});
