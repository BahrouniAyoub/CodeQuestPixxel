import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeChapter1Quest,
  getCurrentChapter1Quest,
  initialChapter1Progress,
  type Chapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { CHAPTER1_QUESTS } from "@/features/chapter1/chapter1Quests";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { useProgress } from "@/features/progress/progressStore";
import { BrowserApp } from "./BrowserApp";
import { ALEX_ACCEPTANCE_MESSAGE } from "./data/gigboardApplication";
import { useGigboardApplication } from "./gigboardApplicationStore";

const VALID_PROPOSAL =
  "I would build the café order calculator as a clean Python script with variables, totals, and a readable receipt. I can deliver it this week.";

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return { ...actual, trackedSave: vi.fn(async () => true) };
});

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function setChapterProgress(count: number): void {
  useChapter1.setState({
    progress: progressAfter(count),
    hydrated: true,
    loading: false,
    error: null,
  });
}

function addressBar(): HTMLInputElement {
  return screen.getByLabelText("Address bar") as HTMLInputElement;
}

function navigateTo(value: string): void {
  const input = addressBar();
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function currentQuestId(): string | null {
  return getCurrentChapter1Quest(useChapter1.getState().progress)?.id ?? null;
}

async function openApplicationForm(): Promise<void> {
  const apply = await screen.findByRole("button", { name: "Apply for Project" });
  expect(apply).toBeEnabled();
  fireEvent.click(apply);
  expect(
    screen.getByRole("dialog", { name: /Apply to Build a Café Order Calculator/ }),
  ).toBeInTheDocument();
}

function fillProposal(value: string): void {
  fireEvent.change(screen.getByLabelText("Your proposal"), { target: { value } });
}

async function submitProposal(value: string): Promise<void> {
  await openApplicationForm();
  fillProposal(value);
  fireEvent.click(screen.getByRole("button", { name: "Submit proposal" }));
}

function resetStores(): void {
  useChapter1.setState({
    progress: initialChapter1Progress,
    hydrated: true,
    loading: false,
    error: null,
  });
  useGigboardApplication.setState({
    application: null,
    hydrated: true,
    loading: false,
    error: null,
  });
  useProgress.setState({
    completions: {},
    currentTicketId: "CQ-001",
    started: [],
    celebrate: 0,
  });
}

beforeEach(resetStores);
afterEach(cleanup);

describe("GigBoard café application UI", () => {
  it("opens a polished proposal form from the café job details", async () => {
    setChapterProgress(3);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");

    await openApplicationForm();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Alex Morgan")).toBeInTheDocument();
    expect(within(dialog).getByText("$50")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Your proposal")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("shows proposal validation feedback and does not advance Chapter 1", async () => {
    setChapterProgress(3);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");

    await openApplicationForm();
    fillProposal("Too short.");
    fireEvent.click(screen.getByRole("button", { name: "Submit proposal" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/too short/i);
    expect(useGigboardApplication.getState().application).toBeNull();
    expect(currentQuestId()).toBe("CH1-04");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cancels without submitting or saving anything", async () => {
    setChapterProgress(3);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");

    await openApplicationForm();
    fillProposal(VALID_PROPOSAL);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useGigboardApplication.getState().application).toBeNull();
    expect(currentQuestId()).toBe("CH1-04");
  });

  it("submits once, shows the status, completes CH1-04, and grants no money or XP", async () => {
    setChapterProgress(3);
    const xpBefore = JSON.stringify(useProgress.getState().completions);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");

    await submitProposal(`  ${VALID_PROPOSAL}  `);

    await waitFor(() =>
      expect(screen.getByTestId("gigboard-application-status")).toHaveTextContent(
        "Application submitted",
      ),
    );
    await waitFor(() => expect(currentQuestId()).toBe("CH1-05"));

    const application = useGigboardApplication.getState().application;
    const chapter = useChapter1.getState().progress;
    expect(application?.proposal).toBe(VALID_PROPOSAL);
    expect(application?.status).toBe("submitted");
    expect(chapter.completedQuestIds).toEqual(["CH1-01", "CH1-02", "CH1-03", "CH1-04"]);
    expect(chapter.money).toBe(0);
    expect(chapter.paymentClaimed).toBe(false);
    expect(chapter.completedQuestIds).not.toContain("CH1-05");
    expect(JSON.stringify(useProgress.getState().completions)).toBe(xpBefore);
    expect(screen.queryByRole("button", { name: "Apply for Project" })).not.toBeInTheDocument();
  });

  it("prevents a second application from the status view", async () => {
    setChapterProgress(3);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");
    await submitProposal(VALID_PROPOSAL);

    await waitFor(() =>
      expect(useGigboardApplication.getState().application?.status).toBe("submitted"),
    );
    expect(screen.queryByRole("button", { name: "Apply for Project" })).not.toBeInTheDocument();
    expect(screen.getByTestId("gigboard-application-status")).toHaveTextContent(
      "Application submitted",
    );
  });

  it("shows the deterministic client acceptance and the project-ready state", async () => {
    setChapterProgress(3);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");
    await submitProposal(VALID_PROPOSAL);
    await waitFor(() => expect(currentQuestId()).toBe("CH1-05"));

    fireEvent.click(screen.getByRole("button", { name: "Check client response" }));

    await waitFor(() => expect(screen.getByText(ALEX_ACCEPTANCE_MESSAGE)).toBeInTheDocument());
    expect(screen.getAllByText("Hired / Accepted").length).toBeGreaterThan(0);
    expect(screen.getByText("Project ready: Build a Café Order Calculator")).toBeInTheDocument();
    expect(screen.getByText("Variables and print")).toBeInTheDocument();
    expect(screen.getByText("Arithmetic and functions")).toBeInTheDocument();
    expect(screen.getByText("Conditional discounts")).toBeInTheDocument();

    const chapter = useChapter1.getState().progress;
    expect(chapter.currentQuestIndex).toBe(4);
    expect(chapter.completedQuestIds).not.toContain("CH1-05");
    expect(chapter.money).toBe(0);
    expect(chapter.paymentClaimed).toBe(false);
    expect(useGigboardApplication.getState().application?.status).toBe("accepted");
  });

  it("completes CH1-03 only from an explicit job-details navigation while it is active", async () => {
    setChapterProgress(2);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");

    await waitFor(() => expect(currentQuestId()).toBe("CH1-04"));
    expect(useChapter1.getState().progress.completedQuestIds).toContain("CH1-03");
    expect(useChapter1.getState().progress.money).toBe(0);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply for Project" })).toBeEnabled(),
    );
  });

  it("cannot skip earlier quests by opening the café listing", async () => {
    setChapterProgress(1);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const chapter = useChapter1.getState().progress;
    expect(chapter.currentQuestIndex).toBe(1);
    expect(chapter.completedQuestIds).toEqual(["CH1-01"]);
    expect(chapter.completedQuestIds).not.toContain("CH1-03");
    expect(screen.getByRole("button", { name: "Apply for Project" })).toBeDisabled();
    expect(screen.getByTestId("gigboard-application-locked")).toBeInTheDocument();
  });

  it("keeps the application truthful when the Chapter 1 save fails and allows a safe retry", async () => {
    setChapterProgress(3);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply for Project" })).toBeEnabled(),
    );

    const originalCompleteQuest = useChapter1.getState().completeQuest;
    const failedCompleteQuest = vi.fn(async () => false);
    act(() => {
      useChapter1.setState({
        completeQuest: failedCompleteQuest as unknown as typeof originalCompleteQuest,
      });
    });

    await openApplicationForm();
    fillProposal(VALID_PROPOSAL);
    fireEvent.click(screen.getByRole("button", { name: "Submit proposal" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/application is saved/i),
    );
    expect(useGigboardApplication.getState().application?.status).toBe("submitted");
    expect(currentQuestId()).toBe("CH1-04");
    expect(failedCompleteQuest).toHaveBeenCalledWith("CH1-04");
    const submittedAt = useGigboardApplication.getState().application?.submittedAt;

    act(() => {
      useChapter1.setState({ completeQuest: originalCompleteQuest });
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry Chapter 1 update" }));

    await waitFor(() => expect(currentQuestId()).toBe("CH1-05"));
    expect(useChapter1.getState().progress.completedQuestIds).toContain("CH1-04");
    expect(useGigboardApplication.getState().application?.submittedAt).toBe(submittedAt);
    expect(
      screen.queryByRole("button", { name: "Retry Chapter 1 update" }),
    ).not.toBeInTheDocument();
  });

  it("leaves other GigBoard jobs as browsing-only listings", async () => {
    setChapterProgress(3);
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/rename-files-python");

    expect(screen.getByRole("button", { name: "Apply for Project" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply for Project" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useGigboardApplication.getState().application).toBeNull();
  });
});
