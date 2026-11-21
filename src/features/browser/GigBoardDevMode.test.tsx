import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialCafeMilestoneProgress } from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import {
  getCurrentChapter1Quest,
  initialChapter1Progress,
} from "@/features/chapter1/chapter1Progress";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { useGigboardApplication } from "./gigboardApplicationStore";
import { ALEX_ACCEPTANCE_MESSAGE } from "./data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID, findGigboardJobBySlug } from "./data/gigboardJobs";
import { GigBoardJobDetails } from "./pages/GigBoardJobDetails";
import { GigBoardDevTestingPanel } from "./pages/GigBoardDevTestingPanel";

const VALID_PROPOSAL =
  "I would build the café order calculator as a clean Python script with variables, totals, and a readable receipt. I can deliver it this week.";

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return { ...actual, trackedSave: vi.fn(async () => true) };
});

const job = findGigboardJobBySlug("cafe-calculator");
if (!job) throw new Error("Café calculator job fixture is missing");
const defaultCompleteQuest = useChapter1.getState().completeQuest;

function currentQuestId(): string | null {
  return getCurrentChapter1Quest(useChapter1.getState().progress)?.id ?? null;
}

function resetStores(): void {
  useChapter1.setState({
    progress: initialChapter1Progress,
    hydrated: true,
    loading: false,
    error: null,
    completeQuest: defaultCompleteQuest,
  });
  useGigboardApplication.setState({
    application: null,
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
}

function renderPage(devTestingEnabled: boolean) {
  return render(
    <GigBoardJobDetails
      job={job}
      onNavigate={() => undefined}
      devTestingEnabled={devTestingEnabled}
    />,
  );
}

beforeEach(resetStores);
afterEach(cleanup);

describe("GigBoard development testing UI", () => {
  it("renders no development controls when disabled", () => {
    renderPage(false);

    expect(screen.queryByText("Development Testing — Café Job")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlock Application for Testing" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply for Project" })).toBeDisabled();
  });

  it("advances to CH1-04 without submitting an application and enables Apply", async () => {
    renderPage(true);

    expect(screen.getByRole("button", { name: "Apply for Project" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Unlock Application for Testing" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply for Project" })).toBeEnabled(),
    );

    expect(currentQuestId()).toBe("CH1-04");
    expect(useChapter1.getState().progress.completedQuestIds).toEqual([
      "CH1-01",
      "CH1-02",
      "CH1-03",
    ]);
    expect(useGigboardApplication.getState().application).toBeNull();
    expect(screen.getByText(/advanced to CH1-04/i)).toBeInTheDocument();
    expect(useChapter1.getState().progress.money).toBe(0);
  });

  it("submits a valid proposal through the real application flow", async () => {
    renderPage(true);
    fireEvent.click(screen.getByRole("button", { name: "Unlock Application for Testing" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply for Project" })).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply for Project" }));
    fireEvent.change(screen.getByLabelText("Your proposal"), {
      target: { value: VALID_PROPOSAL },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit proposal" }));

    await waitFor(() =>
      expect(screen.getByTestId("gigboard-application-status")).toHaveTextContent(
        "Application submitted",
      ),
    );
    await waitFor(() => expect(currentQuestId()).toBe("CH1-05"));
    expect(useGigboardApplication.getState().application?.status).toBe("submitted");
    expect(useGigboardApplication.getState().application?.proposal).toBe(VALID_PROPOSAL);
  });

  it("keeps invalid proposals blocked", async () => {
    renderPage(true);
    fireEvent.click(screen.getByRole("button", { name: "Unlock Application for Testing" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply for Project" })).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply for Project" }));
    fireEvent.change(screen.getByLabelText("Your proposal"), {
      target: { value: "Too short." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit proposal" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/too short/i);
    expect(useGigboardApplication.getState().application).toBeNull();
    expect(currentQuestId()).toBe("CH1-04");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cannot create a duplicate application from the status view", async () => {
    useGigboardApplication.setState({
      application: {
        jobId: CAFE_CALCULATOR_JOB_ID,
        proposal: VALID_PROPOSAL,
        status: "accepted",
        submittedAt: "2026-01-02T09:00:00.000Z",
        acceptedAt: "2026-01-02T10:00:00.000Z",
        acceptanceMessage: ALEX_ACCEPTANCE_MESSAGE,
      },
      hydrated: true,
      loading: false,
      error: null,
    });

    renderPage(true);

    expect(screen.queryByRole("button", { name: "Apply for Project" })).not.toBeInTheDocument();
    expect(screen.getByTestId("gigboard-application-status")).toHaveTextContent("Hired / Accepted");
  });

  it("shows a save error instead of falsely unlocking the job", async () => {
    renderPage(true);
    useChapter1.setState({
      completeQuest: vi.fn(async () => false) as unknown as typeof defaultCompleteQuest,
    });

    fireEvent.click(screen.getByRole("button", { name: "Unlock Application for Testing" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not complete/i));
    expect(screen.getByRole("button", { name: "Apply for Project" })).toBeDisabled();
    expect(currentQuestId()).toBe("CH1-01");
    expect(useChapter1.getState().progress.completedQuestIds).toEqual([]);
  });
});

describe("development panel production guard", () => {
  it("renders nothing when disabled", () => {
    const { container } = render(<GigBoardDevTestingPanel enabled={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
