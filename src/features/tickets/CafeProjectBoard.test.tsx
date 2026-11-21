import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import {
  completeChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import {
  CAFE_MILESTONES,
  getCafeMilestone,
  type CafeMilestoneId,
} from "@/features/chapter1/cafeCoding/cafeMilestones";
import {
  completeCafeMilestone,
  initialCafeMilestoneProgress,
  type CafeMilestoneProgress,
} from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import type { CafeMilestoneValidationResult } from "@/features/chapter1/cafeCoding/cafeMilestoneValidator";
import { CAFE_SETUP_TASKS } from "@/features/chapter1/cafeSetup/cafeSetupTasks";
import {
  completeCafeSetupTask,
  initialCafeSetupProgress,
} from "@/features/chapter1/cafeSetup/cafeSetupProgress";
import { useCafeSetup } from "@/features/chapter1/cafeSetup/cafeSetupStore";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { ALEX_ACCEPTANCE_MESSAGE } from "@/features/browser/data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { useFileSession } from "@/features/editor/fileSession";
import { useProgress } from "@/features/progress/progressStore";
import { desktopBounds, useWindows } from "@/core/windows/windowStore";
import { createInitialState } from "@/core/windows/windowReducer";
import type { FsEntry } from "@/services/filesystem/types";
import { CafeProjectBoard } from "./CafeProjectBoard";

const fsState = vi.hoisted(() => ({
  entries: new Map<string, FsEntry>(),
  createEntry: vi.fn(),
  writeFile: vi.fn(),
}));

const validateMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/filesystem/filesystem", () => ({
  getEntry: vi.fn(async (path: string) => fsState.entries.get(path)),
  createEntry: fsState.createEntry,
  writeFile: fsState.writeFile,
  normalizePath: (path: string) => (path.startsWith("/") ? path : `/${path}`),
  listEntries: vi.fn(async () => []),
}));

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return {
    ...actual,
    trackedSave: vi.fn(async () => true),
    debouncedSave: vi.fn(),
  };
});

vi.mock("@/features/chapter1/cafeCoding/cafeMilestoneValidator", () => ({
  validateCafeMilestone: validateMock,
}));

function chapterProgressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function milestoneProgressAfter(count: number): CafeMilestoneProgress {
  return CAFE_MILESTONES.slice(0, count).reduce(
    (progress, milestone) =>
      completeCafeMilestone(progress, milestone.id, "2026-01-02T09:00:00.000Z"),
    initialCafeMilestoneProgress,
  );
}

function completeSetupProgress() {
  return CAFE_SETUP_TASKS.reduce(
    (progress, task) => completeCafeSetupTask(progress, task.id, "2026-01-02T09:00:00.000Z"),
    initialCafeSetupProgress,
  );
}

function validation(
  milestoneId: CafeMilestoneId,
  status: CafeMilestoneValidationResult["status"] = "passed",
): CafeMilestoneValidationResult {
  return {
    milestoneId,
    status,
    testsPassed: status === "passed" ? 3 : 1,
    testsExecuted: status === "passed" ? 3 : 3,
    testsTotal: 3,
    outcomes: [
      {
        name: "coffee_price is 3",
        passed: status === "passed",
        message: status === "passed" ? "Passed." : "Expected 3, got 2.",
      },
    ],
    message: status === "passed" ? "All milestone tests passed." : "1 of 3 tests passed.",
    error: null,
  };
}

function setEntry(path: string, content = ""): void {
  fsState.entries.set(path, { path, kind: "file", content, updatedAt: 0 });
}

function acceptedApplication() {
  return {
    jobId: CAFE_CALCULATOR_JOB_ID,
    proposal: "I will build the café order calculator with clean Python functions.",
    status: "accepted" as const,
    submittedAt: "2026-01-02T09:00:00.000Z",
    acceptedAt: "2026-01-02T10:00:00.000Z",
    acceptanceMessage: ALEX_ACCEPTANCE_MESSAGE,
  };
}

const defaultCompleteMilestone = useCafeMilestones.getState().completeMilestone;

function resetStores() {
  fsState.entries.clear();
  fsState.createEntry.mockReset();
  fsState.writeFile.mockReset();
  validateMock.mockReset();
  validateMock.mockImplementation(async (milestoneId: CafeMilestoneId) => validation(milestoneId));

  useProgress.setState({
    completions: {},
    currentTicketId: "CQ-001",
    started: [],
    celebrate: 0,
  });
  useFileSession.setState({ filePath: null, dirty: false });
  useChapter1.setState({
    progress: chapterProgressAfter(4),
    hydrated: true,
    loading: false,
    error: null,
  });
  useGigboardApplication.setState({
    application: acceptedApplication(),
    hydrated: true,
    loading: false,
    error: null,
  });
  useCafeSetup.setState({
    progress: completeSetupProgress(),
    hydrated: true,
    loading: false,
    error: null,
    hasSavedRecord: true,
    completeTask: useCafeSetup.getState().completeTask,
  });
  useCafeMilestones.setState({
    progress: initialCafeMilestoneProgress,
    hydrated: true,
    loading: false,
    error: null,
    questSyncError: null,
    completeMilestone: defaultCompleteMilestone,
  });
  useWindows.setState(createInitialState(desktopBounds()));
}

function BoardHarness({ initial = "variables-print" }: { initial?: CafeMilestoneId }) {
  const [selected, setSelected] = useState<CafeMilestoneId>(initial);
  return <CafeProjectBoard selectedTaskId={selected} onSelectTask={setSelected} />;
}

beforeEach(resetStores);
afterEach(cleanup);

describe("café project board in Tickets", () => {
  it("presents the three tasks with instructions, expected behavior and acceptance criteria", async () => {
    render(<BoardHarness />);

    expect(screen.getByText("Build a Café Order Calculator")).toBeInTheDocument();
    expect(screen.getAllByText("CAFÉ-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CAFÉ-2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CAFÉ-3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Locked").length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText(getCafeMilestone("variables-print").description)).toBeInTheDocument();
    expect(
      screen.getByText(getCafeMilestone("variables-print").instructions[0]!),
    ).toBeInTheDocument();
    expect(
      screen.getByText(getCafeMilestone("variables-print").expectedBehavior),
    ).toBeInTheDocument();
    expect(screen.getByText("coffee_price is 3")).toBeInTheDocument();
    expect(screen.getByText(/Example output:/)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Reveal hint 1 of 3/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reveal hint 1 of 3/ }));
    expect(screen.getByText(/Variables store values without quotes/)).toBeInTheDocument();
  });

  it("keeps later tasks locked until the previous task is complete", async () => {
    render(<BoardHarness />);

    fireEvent.click(screen.getByRole("button", { name: /Arithmetic and functions/ }));

    expect(screen.getByText(/returns 3 × coffees/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Task/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Open in Editor/ })).toBeDisabled();
    expect(
      screen.getByText(/Complete the previous café task to unlock this one/),
    ).toBeInTheDocument();
  });

  it("blocks the project before Alex accepts the proposal", async () => {
    useGigboardApplication.setState({ application: null });

    render(<BoardHarness />);

    expect(screen.getByText(/unlocks after Alex Morgan accepts/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Task/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Open in Editor/ })).toBeDisabled();
  });

  it("requires setup for a new save and points the player to GigBoard", async () => {
    useCafeSetup.setState({
      progress: initialCafeSetupProgress,
      hydrated: true,
      hasSavedRecord: false,
    });

    render(<BoardHarness />);

    expect(screen.getByText(/Project setup required/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Task/ })).toBeDisabled();
    expect(screen.getByText(/Open GigBoard to continue/i)).toBeInTheDocument();
    expect(fsState.createEntry).not.toHaveBeenCalled();
  });

  it("does not force setup on an existing milestone save", async () => {
    useCafeSetup.setState({
      progress: initialCafeSetupProgress,
      hydrated: true,
      hasSavedRecord: false,
    });
    useCafeMilestones.setState({ progress: milestoneProgressAfter(1) });
    setEntry("/Projects/Python/cafe_milestone_2.py", "saved café code");

    render(<BoardHarness initial="arithmetic-functions" />);

    await waitFor(() =>
      expect(screen.getByText(/Existing café project detected/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Project setup required/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Task/ })).toBeEnabled();
  });

  it("verifies the saved milestone file, not the open unsaved file", async () => {
    setEntry("/Projects/Python/cafe_milestone_1.py", "saved café code");
    useFileSession.setState({ filePath: "/Projects/Python/cafe_milestone_2.py", dirty: true });

    render(<BoardHarness />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Verify Task/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Verify Task/ }));

    await waitFor(() => expect(validateMock).toHaveBeenCalledTimes(1));
    expect(validateMock).toHaveBeenCalledWith(
      expect.anything(),
      "variables-print",
      "saved café code",
    );
    await waitFor(() =>
      expect(useCafeMilestones.getState().progress.currentMilestoneIndex).toBe(1),
    );
    expect(screen.getByText(/Task 1 verified/i)).toBeInTheDocument();
    expect(fsState.createEntry).not.toHaveBeenCalled();
    expect(fsState.writeFile).not.toHaveBeenCalled();
  });

  it("blocks verification when the canonical file has unsaved edits", async () => {
    setEntry("/Projects/Python/cafe_milestone_1.py", "saved café code");
    useFileSession.setState({ filePath: "/Projects/Python/cafe_milestone_1.py", dirty: true });

    render(<BoardHarness />);

    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Task/ })).toBeDisabled();
  });

  it("keeps the task incomplete when tests fail", async () => {
    setEntry("/Projects/Python/cafe_milestone_1.py", "broken café code");
    validateMock.mockImplementation(async (milestoneId: CafeMilestoneId) =>
      validation(milestoneId, "failed"),
    );

    render(<BoardHarness />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Verify Task/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Verify Task/ }));

    await waitFor(() =>
      expect(screen.getAllByText(/1 of 3 tests passed/).length).toBeGreaterThan(0),
    );
    expect(useCafeMilestones.getState().progress.currentMilestoneIndex).toBe(0);
    expect(useCafeMilestones.getState().progress.completedMilestones).toHaveLength(0);
  });

  it("opens the canonical file without overwriting existing project files", async () => {
    for (const milestone of CAFE_MILESTONES) {
      setEntry(milestone.filePath, "existing code");
    }

    render(<BoardHarness />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Open in Editor/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Open in Editor/ }));

    await waitFor(() =>
      expect(useFileSession.getState().filePath).toBe("/Projects/Python/cafe_milestone_1.py"),
    );
    expect(fsState.createEntry).not.toHaveBeenCalled();
    expect(fsState.writeFile).not.toHaveBeenCalled();
  });

  it("completes CH1-05 only after the third milestone, without XP or money", async () => {
    useCafeMilestones.setState({ progress: milestoneProgressAfter(2) });
    setEntry("/Projects/Python/cafe_milestone_3.py", "saved café code");

    render(<BoardHarness initial="conditional-discounts" />);

    expect(useChapter1.getState().progress.completedQuestIds).not.toContain("CH1-05");
    await waitFor(() => expect(screen.getByRole("button", { name: /Verify Task/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Verify Task/ }));

    await waitFor(() =>
      expect(useCafeMilestones.getState().progress.currentMilestoneIndex).toBe(3),
    );
    await waitFor(() =>
      expect(useChapter1.getState().progress.completedQuestIds).toContain("CH1-05"),
    );

    expect(useChapter1.getState().progress.money).toBe(0);
    expect(useChapter1.getState().progress.paymentClaimed).toBe(false);
    expect(useProgress.getState().completions).toEqual({});
    expect(screen.getByText(/Project ready for delivery/i)).toBeInTheDocument();
  });
});
