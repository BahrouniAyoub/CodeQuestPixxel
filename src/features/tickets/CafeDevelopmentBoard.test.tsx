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
  CAFE_DEV_TASKS,
  getCafeDevTask,
  type CafeDevTaskId,
} from "@/features/chapter1/cafeCoding/cafeDevTasks";
import {
  completeCafeDevTask,
  initialCafeDevProgress,
  type CafeDevProgress,
} from "@/features/chapter1/cafeCoding/cafeDevProgress";
import { useCafeDev } from "@/features/chapter1/cafeCoding/cafeDevStore";
import { initialCafeDocProgress } from "@/features/chapter1/cafeCoding/cafeDocProgress";
import { useCafeDoc } from "@/features/chapter1/cafeCoding/cafeDocStore";
import type { CafeDevValidationResult } from "@/features/chapter1/cafeCoding/cafeDevValidator";
import { CAFE_SETUP_TASKS } from "@/features/chapter1/cafeSetup/cafeSetupTasks";
import {
  completeCafeSetupTask,
  initialCafeSetupProgress,
} from "@/features/chapter1/cafeSetup/cafeSetupProgress";
import { useCafeSetup } from "@/features/chapter1/cafeSetup/cafeSetupStore";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import type { GigboardApplication } from "@/features/browser/data/gigboardApplication";
import { ALEX_ACCEPTANCE_MESSAGE } from "@/features/browser/data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { useFileSession } from "@/features/editor/fileSession";
import { useProgress } from "@/features/progress/progressStore";
import { desktopBounds, useWindows } from "@/core/windows/windowStore";
import { createInitialState } from "@/core/windows/windowReducer";
import type { FsEntry } from "@/services/filesystem/types";
import { CafeDevelopmentBoard } from "./CafeDevelopmentBoard";

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

vi.mock("@/features/chapter1/cafeCoding/cafeDevValidator", () => ({
  validateCafeDevTask: validateMock,
}));

function chapterProgressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function devProgressAfter(count: number): CafeDevProgress {
  return CAFE_DEV_TASKS.slice(0, count).reduce(
    (progress, task) => completeCafeDevTask(progress, task.id, "2026-01-02T09:00:00.000Z"),
    initialCafeDevProgress,
  );
}

function completeSetupProgress() {
  return CAFE_SETUP_TASKS.reduce(
    (progress, task) => completeCafeSetupTask(progress, task.id, "2026-01-02T09:00:00.000Z"),
    initialCafeSetupProgress,
  );
}

function validation(
  taskId: CafeDevTaskId,
  status: CafeDevValidationResult["status"] = "passed",
): CafeDevValidationResult {
  const total = getCafeDevTask(taskId).tests.length;
  return {
    taskId,
    status,
    testsPassed: status === "passed" ? total : 1,
    testsExecuted: total,
    testsTotal: total,
    outcomes: [
      {
        name: "pricing test",
        passed: status === "passed",
        message: status === "passed" ? "Passed." : "Expected 11, got 10.",
      },
    ],
    message:
      status === "passed" ? `All ${total} task tests passed.` : `1 of ${total} task tests passed.`,
    error: null,
  };
}

function setEntry(path: string, content = ""): void {
  fsState.entries.set(path, { path, kind: "file", content, updatedAt: 0 });
}

function acceptedApplication(): GigboardApplication {
  return {
    jobId: CAFE_CALCULATOR_JOB_ID,
    proposal: "I will build the café order calculator with clean Python functions.",
    status: "accepted" as const,
    submittedAt: "2026-01-02T09:00:00.000Z",
    acceptedAt: "2026-01-02T10:00:00.000Z",
    acceptanceMessage: ALEX_ACCEPTANCE_MESSAGE,
  };
}

const defaultCompleteTask = useCafeDev.getState().completeTask;

function resetStores() {
  fsState.entries.clear();
  fsState.createEntry.mockReset();
  fsState.writeFile.mockReset();
  validateMock.mockReset();
  validateMock.mockImplementation(async (_runner: unknown, taskId: CafeDevTaskId) =>
    validation(taskId),
  );

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
  useCafeDev.setState({
    progress: initialCafeDevProgress,
    hydrated: true,
    loading: false,
    error: null,
    questSyncError: null,
    hasSavedRecord: false,
    completeTask: defaultCompleteTask,
  });
  useCafeDoc.setState({
    progress: initialCafeDocProgress,
    hydrated: true,
    loading: false,
    error: null,
    hasSavedRecord: false,
  });
  useWindows.setState(createInitialState(desktopBounds()));
}

function BoardHarness({ initial = "CAFE-DEV-01" }: { initial?: CafeDevTaskId }) {
  const [selected, setSelected] = useState<CafeDevTaskId>(initial);
  return <CafeDevelopmentBoard selectedTaskId={selected} onSelectTask={setSelected} />;
}

beforeEach(resetStores);
afterEach(cleanup);

describe("café development board in Tickets", () => {
  it("presents the four tasks with instructions and acceptance criteria", () => {
    render(<BoardHarness />);

    expect(screen.getByText("Build a Café Order Calculator")).toBeInTheDocument();
    expect(screen.getAllByText("CAFE-DEV-01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CAFE-DEV-02").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CAFE-DEV-03").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CAFE-DEV-04").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Locked").length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText(getCafeDevTask("CAFE-DEV-01").description)).toBeInTheDocument();
    expect(screen.getByText(getCafeDevTask("CAFE-DEV-01").instructions[0]!)).toBeInTheDocument();
    expect(screen.getByText(getCafeDevTask("CAFE-DEV-01").expectedBehavior)).toBeInTheDocument();
  });

  it("keeps later tasks locked until the previous task is complete", () => {
    render(<BoardHarness />);

    fireEvent.click(screen.getByRole("button", { name: /Discount rules/ }));

    expect(screen.getByRole("button", { name: /Verify Task/ })).toBeDisabled();
    expect(screen.getByText(/Complete the previous café development task/)).toBeInTheDocument();
  });

  it("verifies the saved files and records the task", async () => {
    setEntry("/Projects/Python/cafe-calculator/calculator.py", "saved calculator code");

    render(<BoardHarness />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Verify Task/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Verify Task/ }));

    await waitFor(() => expect(validateMock).toHaveBeenCalledTimes(1));
    expect(validateMock).toHaveBeenCalledWith(expect.anything(), "CAFE-DEV-01", {
      "calculator.py": "saved calculator code",
    });
    await waitFor(() => expect(useCafeDev.getState().progress.currentTaskIndex).toBe(1));
    expect(screen.getByText(/Task 1 verified/)).toBeInTheDocument();
    expect(fsState.createEntry).not.toHaveBeenCalled();
    expect(fsState.writeFile).not.toHaveBeenCalled();
  });

  it("blocks verification while a required file has unsaved changes", async () => {
    setEntry("/Projects/Python/cafe-calculator/calculator.py", "saved calculator code");
    useFileSession.setState({
      filePath: "/Projects/Python/cafe-calculator/calculator.py",
      dirty: true,
    });

    render(<BoardHarness />);

    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Task/ })).toBeDisabled();
    expect(validateMock).not.toHaveBeenCalled();
  });

  it("opens calculator.py then main.py for the matching tasks", async () => {
    useCafeDev.setState({ progress: devProgressAfter(2) });
    setEntry("/Projects/Python/cafe-calculator/calculator.py", "calculator");
    setEntry("/Projects/Python/cafe-calculator/main.py", "main");

    render(<BoardHarness />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /(Open in Editor|Practice in Editor)/ }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /(Open in Editor|Practice in Editor)/ }));

    await waitFor(() =>
      expect(useFileSession.getState().filePath).toBe(
        "/Projects/Python/cafe-calculator/calculator.py",
      ),
    );
    expect(fsState.writeFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Interactive order/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Open in Editor/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Open in Editor/ }));
    await waitFor(() =>
      expect(useFileSession.getState().filePath).toBe("/Projects/Python/cafe-calculator/main.py"),
    );
  });

  it("keeps the task incomplete when tests fail", async () => {
    setEntry("/Projects/Python/cafe-calculator/calculator.py", "broken code");
    validateMock.mockImplementation(async (_runner: unknown, taskId: CafeDevTaskId) =>
      validation(taskId, "failed"),
    );

    render(<BoardHarness />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Verify Task/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Verify Task/ }));

    await waitFor(() =>
      expect(screen.getAllByText(/1 of \d+ task tests passed/).length).toBeGreaterThan(0),
    );
    expect(useCafeDev.getState().progress.currentTaskIndex).toBe(0);
  });

  it("completes CH1-05 only after the fourth task, without XP or money", async () => {
    useCafeDev.setState({ progress: devProgressAfter(3) });
    setEntry("/Projects/Python/cafe-calculator/calculator.py", "calculator");
    setEntry("/Projects/Python/cafe-calculator/main.py", "main");

    render(<BoardHarness initial="CAFE-DEV-04" />);

    expect(useChapter1.getState().progress.completedQuestIds).not.toContain("CH1-05");
    await waitFor(() => expect(screen.getByRole("button", { name: /Verify Task/ })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Verify Task/ }));

    await waitFor(() => expect(useCafeDev.getState().progress.currentTaskIndex).toBe(4));
    await waitFor(() =>
      expect(useChapter1.getState().progress.completedQuestIds).toContain("CH1-05"),
    );

    expect(useChapter1.getState().progress.money).toBe(0);
    expect(useChapter1.getState().progress.paymentClaimed).toBe(false);
    expect(useProgress.getState().completions).toEqual({});
    expect(screen.getByText(/All four café development tasks are verified/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("cafe-delivery-status")).toHaveTextContent("Final Checks Required"),
    );
  });
});
