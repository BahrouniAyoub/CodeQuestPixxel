import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindows } from "@/core/windows/windowStore";
import { completeCafeDevTask, initialCafeDevProgress } from "@/features/chapter1/cafeCoding/cafeDevProgress";
import { useCafeDev } from "@/features/chapter1/cafeCoding/cafeDevStore";
import { cafeProjectFingerprint, readmeFingerprint } from "@/features/chapter1/cafeCoding/cafeDelivery";
import { CAFE_DEV_TASKS } from "@/features/chapter1/cafeCoding/cafeDevTasks";
import {
  applyCafeDeliveryCheck,
  applyCafeDocumentationVerification,
  initialCafeDocProgress,
} from "@/features/chapter1/cafeCoding/cafeDocProgress";
import { useCafeDoc } from "@/features/chapter1/cafeCoding/cafeDocStore";
import { initialCafeMilestoneProgress } from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import { createCafePaymentRecord } from "@/features/chapter1/cafeCoding/cafePayment";
import {
  claimCafePayment,
  reconcileCafePaymentQuest,
  retryCafePaymentMail,
} from "@/features/chapter1/cafeCoding/cafePaymentService";
import { useCafePayment } from "@/features/chapter1/cafeCoding/cafePaymentStore";
import { createCafeSubmissionRecord } from "@/features/chapter1/cafeCoding/cafeSubmission";
import { useCafeSubmission } from "@/features/chapter1/cafeCoding/cafeSubmissionStore";
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
import { useMail } from "@/features/mail/mailStore";
import type { FsEntry } from "@/services/filesystem/types";
import { ALEX_ACCEPTANCE_MESSAGE } from "./data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID, findGigboardJobBySlug } from "./data/gigboardJobs";
import { useGigboardApplication } from "./gigboardApplicationStore";
import { GigBoardJobDetails } from "./pages/GigBoardJobDetails";

const DIRECTORY = "/Projects/Python/cafe-calculator";
const README = `# Café Order Calculator\nCoffee $3, sandwich $5, 10% off at $20.\n`;
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

vi.mock("@/features/chapter1/cafeCoding/cafeClientReview", () => ({
  checkCafeClientResponse: vi.fn(),
}));

vi.mock("@/features/chapter1/cafeCoding/cafePaymentService", () => ({
  CAFE_PAYMENT_MESSAGE_ID: "mail-cafe-payment",
  claimCafePayment: vi.fn(),
  reconcileCafePaymentQuest: vi.fn(),
  retryCafePaymentMail: vi.fn(),
}));

const claimPayment = vi.mocked(claimCafePayment);
const reconcileQuest = vi.mocked(reconcileCafePaymentQuest);
const retryMail = vi.mocked(retryCafePaymentMail);

function setEntry(name: string, content: string): void {
  const path = `${DIRECTORY}/${name}`;
  fsState.entries.set(path, { path, kind: "file", content, updatedAt: 0 });
}

function progressAfter(count: number) {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
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

function submission(status: "awaiting-review" | "approved" = "approved") {
  const record = createCafeSubmissionRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: "sub-ui-payment",
    submittedAt: "2026-01-02T12:00:00.000Z",
    files: [
      { name: "PLAN.md", content: "Plan." },
      { name: "calculator.py", content: CALCULATOR },
      { name: "main.py", content: MAIN },
      { name: "README.md", content: README },
    ],
  });
  if (!record) throw new Error("submission fixture was rejected");
  return status === "approved"
    ? { ...record, reviewStatus: "approved" as const, reviewedAt: "2026-01-02T15:00:00.000Z" }
    : record;
}

function paymentRecord() {
  const record = createCafePaymentRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: "sub-ui-payment",
    claimedAt: "2026-01-02T16:00:00.000Z",
  });
  if (!record) throw new Error("payment fixture was rejected");
  return record;
}

const defaultCompleteDevTask = useCafeDev.getState().completeTask;

function resetStores() {
  fsState.entries.clear();
  setEntry("README.md", README);
  setEntry("calculator.py", CALCULATOR);
  setEntry("main.py", MAIN);
  setEntry("PLAN.md", "Plan.");

  useChapter1.setState({ progress: progressAfter(6), hydrated: true, loading: false, error: null });
  useGigboardApplication.setState({
    application: {
      jobId: CAFE_CALCULATOR_JOB_ID,
      proposal: "I will build the café order calculator.",
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
    progress: completeDevProgress(),
    hydrated: true,
    loading: false,
    error: null,
    questSyncError: null,
    hasSavedRecord: true,
    completeTask: defaultCompleteDevTask,
  });
  useCafeDoc.setState({
    progress: readyDocumentationProgress(),
    hydrated: true,
    loading: false,
    error: null,
    hasSavedRecord: true,
  });
  useCafeSubmission.setState({
    submission: submission(),
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
  useMail.setState({
    messages: [],
    hydrated: true,
    loading: false,
    error: null,
    sending: false,
  });
  claimPayment.mockReset();
  reconcileQuest.mockReset();
  retryMail.mockReset();
}

function renderJob() {
  const job = findGigboardJobBySlug("cafe-calculator");
  if (!job) throw new Error("café job fixture missing");
  return render(<GigBoardJobDetails job={job} onNavigate={vi.fn()} devTestingEnabled={false} />);
}

beforeEach(resetStores);
afterEach(cleanup);

describe("GigBoard café payment", () => {
  it("shows the claim section with amount, client, job, and approved status", async () => {
    renderJob();

    const section = await screen.findByTestId("cafe-payment-section");
    expect(within(section).getByTestId("cafe-payment-status")).toHaveTextContent("Available to Claim");
    expect(within(section).getByText("Project status")).toBeInTheDocument();
    expect(within(section).getByText("Approved")).toBeInTheDocument();
    expect(within(section).getByText("$50")).toBeInTheDocument();
    expect(within(section).getByText("Alex Morgan")).toBeInTheDocument();
    expect(within(section).getByText(CAFE_CALCULATOR_JOB_ID)).toBeInTheDocument();
    expect(within(section).getByTestId("cafe-claim-payment")).toBeEnabled();
  });

  it("opens a confirmation dialog and cancels without changing anything", async () => {
    renderJob();
    fireEvent.click(await screen.findByTestId("cafe-claim-payment"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Confirm Payment")).toBeInTheDocument();
    expect(within(dialog).getByText("Alex Morgan")).toBeInTheDocument();
    expect(within(dialog).getByText(CAFE_CALCULATOR_JOB_ID)).toBeInTheDocument();
    expect(within(dialog).getByText("$50")).toBeInTheDocument();
    expect(within(dialog).getByText(/added to your in-game wallet/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cafe-payment-cancel"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(claimPayment).not.toHaveBeenCalled();
    expect(useChapter1.getState().progress.money).toBe(0);
    expect(useCafePayment.getState().payment).toBeNull();
  });

  it("confirms the payment and hides the claim button", async () => {
    claimPayment.mockImplementation(async () => {
      act(() => {
        useCafePayment.getState().adopt(paymentRecord());
        useChapter1.getState().adopt(progressAfter(7));
        useMail.setState((state) => ({
          messages: [
            ...state.messages,
            {
              id: "mail-cafe-payment",
              threadId: "cafe-calculator-thread",
              from: { name: "Alex Morgan", address: "alex.morgan@morgancafe.example" },
              to: { name: "You", address: "you@codequest.dev" },
              subject: "Café Calculator Payment Sent",
              body: "Payment sent.",
              createdAt: "2026-01-02T16:00:00.000Z",
              read: false,
              direction: "incoming",
              projectId: CAFE_CALCULATOR_JOB_ID,
              scriptedResponseKind: "payment",
            },
          ],
        }));
      });
      return {
        ok: true,
        created: true,
        emailCreated: true,
        mailRetryAvailable: false,
        questSynced: true,
        balance: 50,
        reason: "paid",
      };
    });

    renderJob();
    fireEvent.click(await screen.findByTestId("cafe-claim-payment"));
    fireEvent.click(screen.getByTestId("cafe-payment-confirm"));

    expect(await screen.findByTestId("cafe-payment-success")).toHaveTextContent(
      "Payment received! Alex Morgan paid you $50 for the Café Order Calculator.",
    );
    expect(screen.getByTestId("cafe-payment-balance")).toHaveTextContent("$50");
    expect(screen.getByTestId("cafe-payment-status")).toHaveTextContent("Paid");
    expect(screen.queryByTestId("cafe-claim-payment")).not.toBeInTheDocument();
    expect(claimPayment).toHaveBeenCalledTimes(1);
  });

  it("prevents double-clicks while a claim is in progress", async () => {
    let resolveClaim: (() => void) | null = null;
    claimPayment.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClaim = () =>
            resolve({
              ok: true,
              created: true,
              emailCreated: true,
              mailRetryAvailable: false,
              questSynced: true,
              balance: 50,
              reason: "paid",
            });
        }),
    );

    renderJob();
    fireEvent.click(await screen.findByTestId("cafe-claim-payment"));
    const confirm = screen.getByTestId("cafe-payment-confirm");
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(claimPayment).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();

    await act(async () => {
      resolveClaim?.();
    });
  });

  it("shows a completed payment on subsequent visits without a claim button", async () => {
    act(() => {
      useCafePayment.getState().adopt(paymentRecord());
      useChapter1.setState({ progress: progressAfter(7) });
      useMail.setState({
        messages: [
          {
            id: "mail-cafe-payment",
            threadId: "cafe-calculator-thread",
            from: { name: "Alex Morgan", address: "alex.morgan@morgancafe.example" },
            to: { name: "You", address: "you@codequest.dev" },
            subject: "Café Calculator Payment Sent",
            body: "Payment sent.",
            createdAt: "2026-01-02T16:00:00.000Z",
            read: false,
            direction: "incoming",
            projectId: CAFE_CALCULATOR_JOB_ID,
            scriptedResponseKind: "payment",
          },
        ],
      });
    });

    renderJob();

    expect(await screen.findByTestId("cafe-payment-success")).toHaveTextContent(
      "Payment received! Alex Morgan paid you $50 for the Café Order Calculator.",
    );
    expect(screen.getByTestId("cafe-payment-status")).toHaveTextContent("Paid");
    expect(screen.queryByTestId("cafe-claim-payment")).not.toBeInTheDocument();
  });

  it("does not offer payment before approval or for a legacy save", async () => {
    useCafeSubmission.setState({ submission: submission("awaiting-review") });
    renderJob();
    await waitFor(() => expect(screen.queryByTestId("cafe-payment-section")).not.toBeInTheDocument());
    cleanup();

    useCafeMilestones.setState({
      progress: {
        currentMilestoneIndex: 1,
        completedMilestones: [
          { milestoneId: "variables-print", completedAt: "2026-01-02T09:00:00.000Z" },
        ],
      },
      hasSavedRecord: false,
    });
    useCafeSubmission.setState({ submission: submission() });
    renderJob();
    await waitFor(() => expect(screen.queryByTestId("cafe-payment-section")).not.toBeInTheDocument());
  });
});
