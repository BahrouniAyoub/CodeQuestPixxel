import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAFE_DEV_TASKS } from "@/features/chapter1/cafeCoding/cafeDevTasks";
import {
  completeCafeDevTask,
  initialCafeDevProgress,
} from "@/features/chapter1/cafeCoding/cafeDevProgress";
import { useCafeDev } from "@/features/chapter1/cafeCoding/cafeDevStore";
import {
  cafeProjectFingerprint,
  readmeFingerprint,
} from "@/features/chapter1/cafeCoding/cafeDelivery";
import {
  applyCafeDeliveryCheck,
  applyCafeDocumentationVerification,
  initialCafeDocProgress,
} from "@/features/chapter1/cafeCoding/cafeDocProgress";
import { useCafeDoc } from "@/features/chapter1/cafeCoding/cafeDocStore";
import { initialCafeMilestoneProgress } from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { CAFE_SETUP_TASKS } from "@/features/chapter1/cafeSetup/cafeSetupTasks";
import {
  completeCafeSetupTask,
  initialCafeSetupProgress,
  markCafeSetupWorkflow,
} from "@/features/chapter1/cafeSetup/cafeSetupProgress";
import { useCafeSetup } from "@/features/chapter1/cafeSetup/cafeSetupStore";
import type { FsEntry } from "@/services/filesystem/types";
import { ALEX_ACCEPTANCE_MESSAGE } from "./data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID, findGigboardJobBySlug } from "./data/gigboardJobs";
import { useGigboardApplication } from "./gigboardApplicationStore";
import { GigBoardJobDetails } from "./pages/GigBoardJobDetails";

const DIRECTORY = "/Projects/Python/cafe-calculator";

const README = `# Café Order Calculator

This application calculates café orders and prints a receipt.

- Coffee: $3
- Sandwich: $5

Orders of $20 or more receive 10% off.

Run it with python main.py.
Enter the number of coffees and sandwiches when prompted.
Example: 2 coffees and 3 sandwiches total $18.90 after the discount.
Invalid or negative input shows a friendly message instead of crashing.
`;
const CALCULATOR =
  "def calculate_total(coffees, sandwiches):\n    return coffees * 3 + sandwiches * 5\n";
const MAIN = "from calculator import calculate_total\nprint(calculate_total(2, 3))\n";

const fsState = vi.hoisted(() => ({
  entries: new Map<string, FsEntry>(),
}));

vi.mock("@/services/filesystem/filesystem", () => ({
  getEntry: vi.fn(async (path: string) => fsState.entries.get(path)),
  createEntry: vi.fn(),
  writeFile: vi.fn(),
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

function setEntry(name: string, content: string): void {
  const path = `${DIRECTORY}/${name}`;
  fsState.entries.set(path, { path, kind: "file", content, updatedAt: 0 });
}

function completeSetupProgress() {
  return markCafeSetupWorkflow(
    CAFE_SETUP_TASKS.reduce(
      (progress, task) => completeCafeSetupTask(progress, task.id, "2026-01-02T09:00:00.000Z"),
      initialCafeSetupProgress,
    ),
    "development",
  );
}

function completeDevProgress() {
  return CAFE_DEV_TASKS.reduce(
    (progress, task) => completeCafeDevTask(progress, task.id, "2026-01-02T10:00:00.000Z"),
    initialCafeDevProgress,
  );
}

function chapterProgressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function readyDocumentationProgress() {
  const verified = applyCafeDocumentationVerification(
    initialCafeDocProgress,
    readmeFingerprint(README),
    "2026-01-02T11:00:00.000Z",
  );
  return applyCafeDeliveryCheck(verified, {
    passed: true,
    projectSignature: cafeProjectFingerprint({
      readme: README,
      calculator: CALCULATOR,
      main: MAIN,
    }),
    checkedAt: "2026-01-02T12:00:00.000Z",
  });
}

const defaultCompleteTask = useCafeDev.getState().completeTask;

function resetStores() {
  fsState.entries.clear();
  setEntry("README.md", README);
  setEntry("calculator.py", CALCULATOR);
  setEntry("main.py", MAIN);
  setEntry("PLAN.md", "Build and test the calculator.");

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
  useCafeMilestones.setState({
    progress: initialCafeMilestoneProgress,
    hydrated: true,
    loading: false,
    error: null,
    hasSavedRecord: false,
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
    hasSavedRecord: true,
    completeTask: defaultCompleteTask,
  });
  useCafeDoc.setState({
    progress: initialCafeDocProgress,
    hydrated: true,
    loading: false,
    error: null,
    hasSavedRecord: false,
  });
}

function renderJob() {
  const job = findGigboardJobBySlug("cafe-calculator");
  if (!job) throw new Error("café job fixture missing");
  return render(<GigBoardJobDetails job={job} onNavigate={vi.fn()} devTestingEnabled={false} />);
}

beforeEach(resetStores);
afterEach(cleanup);

describe("GigBoard café delivery readiness", () => {
  it("shows In Development while coding tasks are unfinished", async () => {
    renderJob();

    expect(await screen.findByText("Project Delivery Preparation")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("gigboard-delivery-status")).toHaveTextContent("In Development"),
    );
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.queryByText(/No work has been submitted/)).not.toBeInTheDocument();
  });

  it("shows Final Checks Required when coding is complete but documentation is missing", async () => {
    useCafeDev.setState({ progress: completeDevProgress() });

    renderJob();

    await waitFor(() =>
      expect(screen.getByTestId("gigboard-delivery-status")).toHaveTextContent(
        "Final Checks Required",
      ),
    );
    expect(screen.getByText("4/4")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("shows Ready for Delivery only from verified documentation and final checks", async () => {
    useCafeDev.setState({ progress: completeDevProgress() });
    useCafeDoc.setState({ progress: readyDocumentationProgress() });

    renderJob();

    await waitFor(() =>
      expect(screen.getByTestId("gigboard-delivery-status")).toHaveTextContent(
        "Ready for Delivery",
      ),
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText(/No work has been submitted and no payment/)).toBeInTheDocument();
  });

  it("keeps the legacy milestone display for legacy saves", async () => {
    useCafeDev.setState({ hasSavedRecord: false });
    useCafeMilestones.setState({
      progress: {
        currentMilestoneIndex: 1,
        completedMilestones: [
          { milestoneId: "variables-print", completedAt: "2026-01-02T09:00:00.000Z" },
        ],
      },
    });
    useCafeSetup.setState({
      progress: CAFE_SETUP_TASKS.reduce(
        (progress, task) => completeCafeSetupTask(progress, task.id, "2026-01-02T09:00:00.000Z"),
        initialCafeSetupProgress,
      ),
    });

    renderJob();

    expect(await screen.findByLabelText("Café milestones")).toBeInTheDocument();
    expect(screen.queryByText("Project Delivery Preparation")).not.toBeInTheDocument();
  });

  it("keeps Chapter 1 and payment untouched while showing readiness", async () => {
    useCafeDev.setState({ progress: completeDevProgress() });
    useCafeDoc.setState({ progress: readyDocumentationProgress() });

    renderJob();

    await waitFor(() =>
      expect(screen.getByTestId("gigboard-delivery-status")).toHaveTextContent(
        "Ready for Delivery",
      ),
    );
    expect(getCurrentChapter1Quest(useChapter1.getState().progress)?.id).toBe("CH1-05");
    expect(useChapter1.getState().progress.completedQuestIds).not.toContain("CH1-06");
    expect(useChapter1.getState().progress.paymentClaimed).toBe(false);
    expect(useChapter1.getState().progress.money).toBe(0);
  });
});
