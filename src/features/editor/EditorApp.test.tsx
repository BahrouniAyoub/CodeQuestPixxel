import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { initialChapter1Progress } from "@/features/chapter1/chapter1Progress";
import { initialCafeMilestoneProgress } from "@/features/chapter1/cafeCoding/cafeMilestoneProgress";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { useFileSession } from "@/features/editor/fileSession";
import { useProgress } from "@/features/progress/progressStore";
import { useDrafts } from "@/features/tickets/draftStore";
import { EditorApp } from "./EditorApp";

const runner = vi.hoisted(() => ({
  status: "ready" as const,
  init: vi.fn(async () => undefined),
  run: vi.fn(async () => ({
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
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange?.(event.target.value),
      }),
  };
});

function resetStores(): void {
  useProgress.setState({
    completions: {},
    currentTicketId: null,
    started: [],
    celebrate: 0,
  });
  useDrafts.setState({ drafts: {}, saveState: {} });
  useFileSession.setState({ filePath: null, dirty: false });
  useChapter1.setState({ progress: initialChapter1Progress, hydrated: true, loading: false, error: null });
  useGigboardApplication.setState({ application: null, hydrated: true, loading: false, error: null });
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

describe("EditorApp with legacy CQ tickets removed", () => {
  it("renders a safe no-ticket state without crashing", () => {
    render(<EditorApp />);

    expect(screen.getByText("NO ACTIVE TICKET")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit tests" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("does not crash when persisted progress points at a removed legacy ticket", () => {
    useProgress.getState().hydrate({
      version: 1,
      completions: { "CQ-001": { ticketId: "CQ-001", completedAt: 1 } } as never,
      currentTicketId: "CQ-001" as never,
      started: ["CQ-001"] as never,
    });

    render(<EditorApp />);

    expect(screen.getByText("NO ACTIVE TICKET")).toBeInTheDocument();
    expect(screen.queryByText(/CQ-001/)).not.toBeInTheDocument();
  });
});
