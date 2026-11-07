import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { ALEX_ACCEPTANCE_MESSAGE } from "@/features/browser/data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { useFileSession } from "@/features/editor/fileSession";
import { useProgress } from "@/features/progress/progressStore";
import { useDrafts } from "@/features/tickets/draftStore";
import { TICKETS_BY_ID } from "@/features/tickets/data/tickets";
import { EditorApp } from "./EditorApp";

const runner = vi.hoisted(() => ({
  status: "ready" as const,
  init: vi.fn(async () => undefined),
  run: vi.fn(async (_request?: { code?: string; echoPrompts?: boolean }) => ({
    engine: "pyodide" as const,
    ok: true,
    stdout: "",
    error: null,
    errorType: null,
    line: null,
    phase: null,
    truncated: false,
    timedOut: false,
    cancelled: false,
    durationMs: 1,
  })),
  cancel: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock("@/services/runner/pyodideRunner", () => ({
  getPythonRunner: () => runner,
}));

vi.mock("@uiw/react-codemirror", async () => {
  const React = await import("react");
  return {
    default: (props: {
      value?: string;
      editable?: boolean;
      onChange?: (value: string) => void;
      "aria-label"?: string;
    }) =>
      React.createElement("textarea", {
        "aria-label": props["aria-label"] ?? "Python code editor",
        value: props.value,
        disabled: props.editable === false,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
          props.onChange?.(event.target.value),
      }),
  };
});

function progressAfter(count: number): Chapter1Progress {
  return CHAPTER1_QUESTS.slice(0, count).reduce(
    (progress, quest) => completeChapter1Quest(progress, quest.id),
    initialChapter1Progress,
  );
}

function resetStores(): void {
  useProgress.setState({
    completions: {},
    currentTicketId: "CQ-001",
    started: [],
    celebrate: 0,
  });
  useDrafts.setState({ drafts: {}, saveState: {} });
  useFileSession.setState({ filePath: null, dirty: false });
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
  useCafeMilestones.setState({
    progress: initialCafeMilestoneProgress,
    hydrated: true,
    loading: false,
    error: null,
    questSyncError: null,
  });
  runner.run.mockClear();
}

beforeEach(resetStores);
afterEach(cleanup);

describe("existing Python editor with the café panel", () => {
  it("keeps the existing ticket Run behavior", async () => {
    render(<EditorApp />);

    expect(screen.getByText("CQ-001 · Variables and Printing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(runner.run).toHaveBeenCalledTimes(1));
    expect(runner.run.mock.calls[0]?.[0]).toMatchObject({
      code: TICKETS_BY_ID["CQ-001"].starterCode,
      echoPrompts: true,
    });
  });

  it("keeps the existing ticket test submission behavior", async () => {
    render(<EditorApp />);

    fireEvent.click(screen.getByRole("button", { name: "Submit tests" }));

    await waitFor(() => expect(runner.run).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("button", { name: /Test Results/ })).toBeInTheDocument();
  });

  it("shows the café milestone panel for a hired player without breaking ticket Run", async () => {
    useChapter1.setState({
      progress: progressAfter(4),
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

    render(<EditorApp />);

    expect(screen.getByText("Build a Café Order Calculator")).toBeInTheDocument();
    expect(screen.getByText("1. Variables and print")).toBeInTheDocument();
    expect(screen.getByText("Milestone 1: Variables and print")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Tests" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(runner.run).toHaveBeenCalledTimes(1));
  });
});
