import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { initialCafeMilestoneProgress } from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { ALEX_ACCEPTANCE_MESSAGE } from "@/features/browser/data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import type { FsEntry } from "@/services/filesystem/types";
import { CafeProjectGuidancePanel } from "./CafeProjectGuidancePanel";
import { initialCafeSetupProgress } from "./cafeSetupProgress";
import { useCafeSetup } from "./cafeSetupStore";
import { CAFE_PROJECT_DIRECTORY } from "./cafeSetupTasks";

const fsState = vi.hoisted(() => ({
  entries: new Map<
    string,
    { path: string; kind: "file" | "dir"; content?: string; updatedAt: number }
  >(),
  createEntry: vi.fn(),
}));

vi.mock("@/services/filesystem/filesystem", () => ({
  getEntry: vi.fn(async (path: string) => fsState.entries.get(path)),
  createEntry: fsState.createEntry,
  writeFile: vi.fn(async () => undefined),
  normalizePath: (path: string) => (path.startsWith("/") ? path : `/${path}`),
  listEntries: vi.fn(async () => []),
}));

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return { ...actual, trackedSave: vi.fn(async () => true) };
});

function chapterProgressAfter(count: number) {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function setEntry(path: string, kind: FsEntry["kind"], content = "") {
  fsState.entries.set(path, { path, kind, content, updatedAt: 0 });
}

function addProjectFiles(planContent: string) {
  setEntry(CAFE_PROJECT_DIRECTORY, "dir");
  setEntry(`${CAFE_PROJECT_DIRECTORY}/PLAN.md`, "file", planContent);
  setEntry(`${CAFE_PROJECT_DIRECTORY}/calculator.py`, "file");
  setEntry(`${CAFE_PROJECT_DIRECTORY}/main.py`, "file");
  setEntry(`${CAFE_PROJECT_DIRECTORY}/README.md`, "file");
}

const defaultCompleteTask = useCafeSetup.getState().completeTask;

beforeEach(() => {
  fsState.entries.clear();
  fsState.createEntry.mockClear();
  useCafeSetup.setState({
    progress: initialCafeSetupProgress,
    hydrated: true,
    loading: false,
    error: null,
    hasSavedRecord: false,
    completeTask: defaultCompleteTask,
  });
  useChapter1.setState({
    progress: chapterProgressAfter(4),
    hydrated: true,
    loading: false,
    error: null,
  });
  useCafeMilestones.setState({
    progress: initialCafeMilestoneProgress,
    hydrated: true,
    loading: false,
    error: null,
    questSyncError: null,
  });
  useGigboardApplication.setState({
    application: {
      jobId: CAFE_CALCULATOR_JOB_ID,
      proposal: "I will build the café order calculator with clean Python functions.",
      status: "accepted",
      submittedAt: "2026-01-02T09:00:00.000Z",
      acceptedAt: "2026-01-02T10:00:00.000Z",
      acceptanceMessage: ALEX_ACCEPTANCE_MESSAGE,
    },
    hydrated: true,
    loading: false,
    error: null,
  });
});

afterEach(cleanup);

describe("café project setup guidance", () => {
  it("walks through the sequential setup without creating files or completing CH1-05", async () => {
    render(<CafeProjectGuidancePanel />);

    expect(screen.getByText("Read Client Brief")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark Brief Reviewed" }));
    await waitFor(() => expect(screen.getByText("Create Project Folder")).toBeInTheDocument());
    expect(useCafeSetup.getState().progress.currentTaskIndex).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /Check Task/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Folder not found/i));
    expect(useCafeSetup.getState().progress.currentTaskIndex).toBe(1);

    setEntry(CAFE_PROJECT_DIRECTORY, "dir");
    fireEvent.click(screen.getByRole("button", { name: /Check Task/ }));
    await waitFor(() => expect(screen.getByText("Create Project Files")).toBeInTheDocument());

    setEntry(`${CAFE_PROJECT_DIRECTORY}/PLAN.md`, "file", "A plan");
    fireEvent.click(screen.getByRole("button", { name: /Check Task/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Missing project file/i),
    );

    addProjectFiles("A plan");
    fireEvent.click(screen.getByRole("button", { name: /Check Task/ }));
    await waitFor(() => expect(screen.getByText("Write Development Plan")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Check Task/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/six planning topics/i),
    );

    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /Check Task/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/more detail/i));

    setEntry(
      `${CAFE_PROJECT_DIRECTORY}/PLAN.md`,
      "file",
      "Coffee $3, sandwich $5. Calculate totals, apply a 10% discount at $20, read quantities from the customer, print a receipt, and test zero, negative, and invalid input.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Check Task/ }));
    await waitFor(() => expect(screen.getByText("Verify Project Setup")).toBeInTheDocument());
    expect(useCafeSetup.getState().progress.currentTaskIndex).toBe(4);

    fireEvent.click(screen.getByRole("button", { name: /Check Task/ }));
    await waitFor(() => expect(screen.getByText(/setup complete/i)).toBeInTheDocument());

    expect(useCafeSetup.getState().progress.currentTaskIndex).toBe(5);
    expect(getCurrentChapter1Quest(useChapter1.getState().progress)?.id).toBe("CH1-05");
    expect(useChapter1.getState().progress.money).toBe(0);
    expect(useChapter1.getState().progress.completedQuestIds).not.toContain("CH1-05");
    expect(fsState.createEntry).not.toHaveBeenCalled();
  });

  it("shows a save error instead of falsely completing the brief", async () => {
    useCafeSetup.setState({
      completeTask: vi.fn(async () => ({
        ok: false as const,
        reason: "Could not save project setup.",
      })) as unknown as typeof defaultCompleteTask,
    });
    render(<CafeProjectGuidancePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Mark Brief Reviewed" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Could not save/i));
    expect(useCafeSetup.getState().progress.currentTaskIndex).toBe(0);
  });

  it("does not force setup on an existing milestone save", async () => {
    useCafeMilestones.setState({
      progress: {
        currentMilestoneIndex: 1,
        completedMilestones: [
          { milestoneId: "variables-print", completedAt: "2026-01-02T09:00:00.000Z" },
        ],
      },
      hydrated: true,
      loading: false,
      error: null,
      questSyncError: null,
    });

    render(<CafeProjectGuidancePanel />);

    await waitFor(() => expect(screen.queryByText("Read Client Brief")).not.toBeInTheDocument());
    expect(useCafeSetup.getState().progress.currentTaskIndex).toBe(0);
  });
});
