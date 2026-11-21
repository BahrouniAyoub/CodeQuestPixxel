import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import {
  completeChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { initialCafeMilestoneProgress } from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import { CAFE_SETUP_TASKS } from "@/features/chapter1/cafeSetup/cafeSetupTasks";
import {
  completeCafeSetupTask,
  initialCafeSetupProgress,
  markCafeSetupWorkflow,
} from "@/features/chapter1/cafeSetup/cafeSetupProgress";
import { useCafeSetup } from "@/features/chapter1/cafeSetup/cafeSetupStore";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { ALEX_ACCEPTANCE_MESSAGE } from "@/features/browser/data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { useFileSession } from "@/features/editor/fileSession";
import { useProgress } from "@/features/progress/progressStore";
import { desktopBounds, useWindows } from "@/core/windows/windowStore";
import { createInitialState } from "@/core/windows/windowReducer";
import { resetTicketsViewStateForTests } from "./ticketsViewState";
import { TicketsApp } from "./TicketsApp";

const fsState = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
}));

vi.mock("@/services/filesystem/filesystem", () => ({
  getEntry: vi.fn(async (path: string) => fsState.entries.get(path)),
  createEntry: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
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

function chapterProgressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function completeSetupProgress() {
  const completed = CAFE_SETUP_TASKS.reduce(
    (progress, task) => completeCafeSetupTask(progress, task.id, "2026-01-02T09:00:00.000Z"),
    initialCafeSetupProgress,
  );
  // The real setup store stamps the workflow after the final task.
  return markCafeSetupWorkflow(completed, "development");
}

function legacyMilestoneProgress() {
  return {
    currentMilestoneIndex: 1,
    completedMilestones: [
      { milestoneId: "variables-print" as const, completedAt: "2026-01-02T09:00:00.000Z" },
    ],
  };
}

function resetStores() {
  fsState.entries.clear();
  resetTicketsViewStateForTests();
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
  useCafeSetup.setState({
    progress: completeSetupProgress(),
    hydrated: true,
    loading: false,
    error: null,
    hasSavedRecord: true,
  });
  useCafeMilestones.setState({
    progress: initialCafeMilestoneProgress,
    hydrated: true,
    loading: false,
    error: null,
    questSyncError: null,
  });
  useWindows.setState(createInitialState(desktopBounds()));
}

beforeEach(resetStores);
afterEach(cleanup);

describe("Tickets app project switcher", () => {
  it("keeps the general ticket workflow unchanged", () => {
    render(<TicketsApp />);

    expect(screen.getByRole("heading", { name: /My Tickets/i, level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Hello, Pixel City", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /My Tickets/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /Open in Code Editor/ }));

    expect(useProgress.getState().currentTicketId).toBe("CQ-001");
    expect(useProgress.getState().started).toContain("CQ-001");
  });

  it("switches to the café project and remembers the selected task across remounts", () => {
    const first = render(<TicketsApp />);

    fireEvent.click(screen.getByRole("tab", { name: /Café Calculator/ }));
    expect(screen.getByText("Build a Café Order Calculator")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Discount rules/ }));
    expect(screen.getByText(/apply_discount\(20\) → 18/)).toBeInTheDocument();

    first.unmount();
    render(<TicketsApp />);

    expect(screen.getByRole("tab", { name: /Café Calculator/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Build a Café Order Calculator")).toBeInTheDocument();
    expect(screen.getByText(/apply_discount\(20\) → 18/)).toBeInTheDocument();
  });

  it("shows the four-task development project on a brand-new save", () => {
    useCafeSetup.setState({
      progress: initialCafeSetupProgress,
      hydrated: true,
      loading: false,
      error: null,
      hasSavedRecord: false,
    });
    useCafeMilestones.setState({
      progress: initialCafeMilestoneProgress,
      hydrated: true,
      loading: false,
      error: null,
      questSyncError: null,
    });

    render(<TicketsApp />);
    fireEvent.click(screen.getByRole("tab", { name: /Café Calculator/ }));

    expect(screen.getByText(/Four development tasks · Multi-file Python project/)).toBeInTheDocument();
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Order totals/ })).toBeInTheDocument();
    expect(screen.queryByText("CAFÉ-1")).not.toBeInTheDocument();
    expect(screen.getByText(/Project setup required/)).toBeInTheDocument();
  });

  it("keeps an existing legacy milestone save on the three-milestone board", () => {
    useCafeSetup.setState({
      progress: initialCafeSetupProgress,
      hydrated: true,
      loading: false,
      error: null,
      hasSavedRecord: false,
    });
    useCafeMilestones.setState({
      progress: legacyMilestoneProgress(),
      hydrated: true,
      loading: false,
      error: null,
      questSyncError: null,
    });

    render(<TicketsApp />);
    fireEvent.click(screen.getByRole("tab", { name: /Café Calculator/ }));

    expect(screen.getAllByText(/Three development tasks/).length).toBeGreaterThan(0);
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getAllByText("CAFÉ-2").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Order totals/ })).not.toBeInTheDocument();
  });
});
