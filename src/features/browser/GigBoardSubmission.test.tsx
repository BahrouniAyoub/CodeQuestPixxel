import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindows } from "@/core/windows/windowStore";
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
import { checkCafeClientResponse } from "@/features/chapter1/cafeCoding/cafeClientReview";
import {
  applyCafeDeliveryCheck,
  applyCafeDocumentationVerification,
  initialCafeDocProgress,
} from "@/features/chapter1/cafeCoding/cafeDocProgress";
import { useCafeDoc } from "@/features/chapter1/cafeCoding/cafeDocStore";
import { initialCafeMilestoneProgress } from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import { createCafeSubmissionRecord } from "@/features/chapter1/cafeCoding/cafeSubmission";
import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import { useCafeSubmission } from "@/features/chapter1/cafeCoding/cafeSubmissionStore";
import { submitCafeProject } from "@/features/chapter1/cafeCoding/cafeSubmissionVerification";
import {
  completeChapter1Quest,
  initialChapter1Progress,
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
const CALCULATOR = "def calculate_total(c, s): return c * 3 + s * 5\n";
const MAIN = "import calculator\nprint(calculator.calculate_total(2, 3))\n";

const fsState = vi.hoisted(() => ({ entries: new Map<string, FsEntry>() }));

vi.mock("@/services/filesystem/filesystem", () => ({
  getEntry: vi.fn(async (path: string) => fsState.entries.get(path)),
  createEntry: vi.fn(),
  writeFile: vi.fn(),
  normalizePath: (path: string) => (path.startsWith("/") ? path : `/${path}`),
  listEntries: vi.fn(async () => []),
}));

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return { ...actual, trackedSave: vi.fn(async () => true), debouncedSave: vi.fn() };
});

vi.mock("@/features/mail/mailIntegration", () => ({
  syncCafeWelcomeEmail: vi.fn(async () => ({ ok: true, created: false })),
}));

vi.mock("@/features/chapter1/cafeCoding/cafeSubmissionVerification", () => ({
  submitCafeProject: vi.fn(),
}));

vi.mock("@/features/chapter1/cafeCoding/cafeClientReview", () => ({
  checkCafeClientResponse: vi.fn(),
}));

const submitProject = vi.mocked(submitCafeProject);
const checkResponse = vi.mocked(checkCafeClientResponse);

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

function progressAfter(count: number) {
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
    projectSignature: cafeProjectFingerprint({ readme: README, calculator: CALCULATOR, main: MAIN }),
    checkedAt: "2026-01-02T12:00:00.000Z",
  });
}

function submittedRecord(reviewStatus: "awaiting-review" | "approved" = "awaiting-review") {
  const record = createCafeSubmissionRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: "sub-ui-test",
    submittedAt: "2026-01-02T12:00:00.000Z",
    files: [
      { name: "PLAN.md", content: "Plan the calculator." },
      { name: "calculator.py", content: CALCULATOR },
      { name: "main.py", content: MAIN },
      { name: "README.md", content: README },
    ],
  });
  if (!record) throw new Error("submission fixture was rejected");
  return reviewStatus === "approved"
    ? { ...record, reviewStatus: "approved" as const, reviewedAt: "2026-01-02T15:00:00.000Z" }
    : record;
}

const defaultCompleteTask = useCafeDev.getState().completeTask;

function resetStores() {
  fsState.entries.clear();
  setEntry("README.md", README);
  setEntry("calculator.py", CALCULATOR);
  setEntry("main.py", MAIN);
  setEntry("PLAN.md", "Plan the calculator.");

  useChapter1.setState({ progress: progressAfter(5), hydrated: true, loading: false, error: null });
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
  } as Parameters<typeof useCafeMilestones.setState>[0]);
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
  useCafeSubmission.setState({
    submission: null,
    hydrated: true,
    loading: false,
    error: null,
  });
  useCafePayment.setState({
    payment: null,
    hydrated: true,
    loading: false,
    error: null,
    invalidRecord: false,
  });
  submitProject.mockReset();
  checkResponse.mockReset();
}

function markReady() {
  useCafeDev.setState({ progress: completeDevProgress() });
  useCafeDoc.setState({ progress: readyDocumentationProgress() });
}

function renderJob() {
  const job = findGigboardJobBySlug("cafe-calculator");
  if (!job) throw new Error("café job fixture missing");
  return render(<GigBoardJobDetails job={job} onNavigate={vi.fn()} devTestingEnabled={false} />);
}

beforeEach(resetStores);
afterEach(cleanup);

describe("GigBoard café project submission", () => {
  it("only enables Submit Project for a ready project", async () => {
    renderJob();

    const button = await screen.findByTestId("cafe-submit-project");
    await waitFor(() => expect(button).toBeDisabled());

    act(() => markReady());
    await waitFor(() => expect(screen.getByTestId("cafe-submit-project")).toBeEnabled());
    expect(screen.getByTestId("gigboard-delivery-status")).toHaveTextContent("Ready for Delivery");
  });

  it("shows the confirmation details and cancels without submitting", async () => {
    markReady();
    renderJob();
    const submitButton = await screen.findByTestId("cafe-submit-project");
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Submit Build a Café Order Calculator/)).toBeInTheDocument();
    expect(within(dialog).getByText("Alex Morgan")).toBeInTheDocument();
    for (const name of ["PLAN.md", "calculator.py", "main.py", "README.md"]) {
      expect(within(dialog).getByText(name)).toBeInTheDocument();
    }
    expect(within(dialog).getByText(/README: Verified/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Final checks: Passed/)).toBeInTheDocument();
    expect(within(dialog).getByText(/sent to Alex Morgan for review/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cafe-submit-cancel"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submitProject).not.toHaveBeenCalled();
    expect(useCafeSubmission.getState().submission).toBeNull();
  });

  it("persists the snapshot and shows Awaiting Review after confirmation", async () => {
    markReady();
    const record = submittedRecord();
    submitProject.mockResolvedValue({
      ok: true,
      kind: "submitted",
      reason: "sent",
      record,
      validation: null,
    });
    renderJob();
    const submitButton = await screen.findByTestId("cafe-submit-project");
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);
    fireEvent.click(screen.getByTestId("cafe-submit-confirm"));

    expect(submitProject).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId("cafe-submission-status")).toHaveTextContent("Awaiting Review"),
    );
    expect(useCafeSubmission.getState().submission?.submissionId).toBe("sub-ui-test");
    expect(screen.getByTestId("cafe-check-client-response")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the inline validation error when submission is rejected", async () => {
    markReady();
    submitProject.mockResolvedValue({
      ok: false,
      kind: "files-changed",
      reason: "A project file changed while your work was being verified.",
      record: null,
      validation: null,
    });
    renderJob();
    const submitButton = await screen.findByTestId("cafe-submit-project");
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);
    fireEvent.click(screen.getByTestId("cafe-submit-confirm"));

    expect(await screen.findByTestId("cafe-submission-error")).toHaveTextContent(
      /A project file changed/,
    );
    expect(useCafeSubmission.getState().submission).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("exposes Check Client Response and Open Mail through the approved lifecycle", async () => {
    markReady();
    useCafeSubmission.setState({ submission: submittedRecord() });
    checkResponse.mockImplementation(async () => {
      await useCafeSubmission.getState().approve("2026-01-02T15:00:00.000Z");
      return {
        ok: true,
        approved: true,
        emailCreated: true,
        questCompleted: true,
        questRetryAvailable: false,
        reason: "approved",
      };
    });
    renderJob();
    fireEvent.click(await screen.findByTestId("cafe-check-client-response"));
    await waitFor(() =>
      expect(screen.getByTestId("cafe-submission-status")).toHaveTextContent("Approved"),
    );
    expect(checkResponse).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("cafe-open-mail")).toBeInTheDocument();

    const openSpy = vi.spyOn(useWindows.getState(), "open");
    fireEvent.click(screen.getByTestId("cafe-open-mail"));
    expect(openSpy).toHaveBeenCalledWith("mail");
  });

  it("offers a safe Chapter 1 retry after a failed quest sync", async () => {
    markReady();
    useCafeSubmission.setState({ submission: submittedRecord("approved") });
    checkResponse.mockResolvedValue({
      ok: false,
      approved: true,
      emailCreated: true,
      questCompleted: false,
      questRetryAvailable: true,
      reason: "Chapter 1 could not be updated.",
    });
    renderJob();

    expect(await screen.findByTestId("cafe-retry-quest")).toHaveTextContent(
      "Retry Chapter 1 update",
    );
  });
});
