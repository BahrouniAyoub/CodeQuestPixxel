import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuestJournalApp } from "./QuestJournalApp";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { completeChapter1Quest, initialChapter1Progress, type Chapter1Progress } from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function resetChapter1(state: Partial<{ progress: Chapter1Progress; hydrated: boolean; loading: boolean; error: string | null }> = {}): void {
  useChapter1.setState({
    progress: initialChapter1Progress,
    hydrated: false,
    loading: false,
    error: null,
    ...state,
  } as any);
}

describe("QuestJournalApp", () => {
  beforeEach(() => {
    resetChapter1({ hydrated: true, progress: initialChapter1Progress });
  });
  afterEach(() => {
    cleanup();
  });

  it("shows the current mission, objective, location, and chapter progress", () => {
    render(<QuestJournalApp />);
    expect(screen.getByText("Chapter 1 — The First Paycheck")).toBeInTheDocument();
    expect(screen.getAllByText("A Tough Morning").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Talk to Dad in the living room").length).toBeGreaterThan(0);
    expect(screen.getByText("Living room · Dad")).toBeInTheDocument();
    expect(screen.getByText("0/8 quests")).toBeInTheDocument();
  });

  it("updates when the same Chapter 1 store progresses", () => {
    render(<QuestJournalApp />);
    act(() => {
      resetChapter1({ hydrated: true, progress: progressAfter(2) });
    });
    expect(screen.getAllByText("Find a Job").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Find a Python job on GigBoard").length).toBeGreaterThan(0);
    expect(screen.getByText("2/8 quests")).toBeInTheDocument();
  });

  it("shows completion state when Chapter 1 is finished", () => {
    render(<QuestJournalApp />);
    act(() => {
      resetChapter1({ hydrated: true, progress: progressAfter(8) });
    });
    expect(screen.getByText(/Chapter 1 Complete/i)).toBeInTheDocument();
    expect(screen.getByText("8/8 quests")).toBeInTheDocument();
  });
});
