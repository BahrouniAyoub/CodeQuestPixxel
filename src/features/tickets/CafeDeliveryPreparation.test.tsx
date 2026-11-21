import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAFE_DEV_TASKS } from "@/features/chapter1/cafeCoding/cafeDevTasks";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
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
import type { CafeDevValidationResult } from "@/features/chapter1/cafeCoding/cafeDevValidator";
import { CAFE_SETUP_TASKS } from "@/features/chapter1/cafeSetup/cafeSetupTasks";
import {
  completeCafeSetupTask,
  initialCafeSetupProgress,
} from "@/features/chapter1/cafeSetup/cafeSetupProgress";
import { useCafeSetup } from "@/features/chapter1/cafeSetup/cafeSetupStore";
import { useFileSession } from "@/features/editor/fileSession";
import type { FsEntry } from "@/services/filesystem/types";
import { CafeDeliveryPreparation } from "./CafeDeliveryPreparation";

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

const validateMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/services/runner/pyodideRunner", () => ({
  getPythonRunner: vi.fn(() => ({})),
}));

vi.mock("@/features/chapter1/cafeCoding/cafeDevValidator", () => ({
  validateCafeDevTask: validateMock,
}));

function passedValidation(): CafeDevValidationResult {
  return {
    taskId: "CAFE-DEV-04",
    status: "passed",
    testsPassed: 5,
    testsExecuted: 5,
    testsTotal: 5,
    outcomes: [],
    message: "All 5 task tests passed.",
    error: null,
  };
}

function setEntry(name: string, content: string): void {
  const path = `${DIRECTORY}/${name}`;
  fsState.entries.set(path, { path, kind: "file", content, updatedAt: 0 });
}

function completeSetupProgress() {
  return CAFE_SETUP_TASKS.reduce(
    (progress, task) => completeCafeSetupTask(progress, task.id, "2026-01-02T09:00:00.000Z"),
    initialCafeSetupProgress,
  );
}

function completeDevProgress() {
  return CAFE_DEV_TASKS.reduce(
    (progress, task) => completeCafeDevTask(progress, task.id, "2026-01-02T10:00:00.000Z"),
    initialCafeDevProgress,
  );
}

function seedProjectFiles() {
  setEntry("README.md", README);
  setEntry("calculator.py", CALCULATOR);
  setEntry("main.py", MAIN);
  setEntry("PLAN.md", "Build and test the calculator.");
}

function seedDocumentation() {
  useCafeDoc.setState({
    progress: applyCafeDocumentationVerification(
      initialCafeDocProgress,
      readmeFingerprint(README),
      "2026-01-02T11:00:00.000Z",
    ),
  });
}

const defaultCompleteTask = useCafeDev.getState().completeTask;

function resetStores() {
  fsState.entries.clear();
  validateMock.mockReset();
  validateMock.mockImplementation(async () => passedValidation());

  useFileSession.setState({ filePath: null, dirty: false });
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

function renderPreparation(developmentComplete = true) {
  return render(
    <CafeDeliveryPreparation
      developmentComplete={developmentComplete}
      applicationAccepted
      setupRequired={false}
    />,
  );
}

beforeEach(resetStores);
afterEach(cleanup);

describe("Project Delivery Preparation in Tickets", () => {
  it("stays locked until all four coding tasks are verified", async () => {
    seedProjectFiles();
    useCafeDev.setState({ progress: initialCafeDevProgress });

    renderPreparation(false);

    expect(screen.getByText("CAFE-DOC-01 · FINAL PREPARATION")).toBeInTheDocument();
    expect(screen.getByText("Project Delivery Preparation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Documentation/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Run Final Project Check/ })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByTestId("cafe-delivery-status")).toHaveTextContent("In Development"),
    );
  });

  it("shows Final Checks Required after coding and before documentation", async () => {
    seedProjectFiles();

    renderPreparation();

    await waitFor(() =>
      expect(screen.getByTestId("cafe-delivery-status")).toHaveTextContent("Final Checks Required"),
    );
    expect(screen.getByText("4/4 complete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify Documentation/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Run Final Project Check/ })).toBeDisabled();
  });

  it("verifies the saved README and records documentation progress", async () => {
    seedProjectFiles();

    renderPreparation();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Verify Documentation/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Verify Documentation/ }));

    await waitFor(() =>
      expect(screen.getByText(/README\.md documentation verified/)).toBeInTheDocument(),
    );
    expect(useCafeDoc.getState().progress.documentation.readmeSignature).toBe(
      readmeFingerprint(README),
    );
    expect(screen.getByRole("button", { name: /Verify Documentation/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Run Final Project Check/ })).toBeEnabled();
  });

  it("blocks documentation verification while README.md has unsaved changes", async () => {
    seedProjectFiles();
    useFileSession.setState({ filePath: `${DIRECTORY}/README.md`, dirty: true });

    renderPreparation();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Verify Documentation/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Verify Documentation/ }));

    expect(
      await screen.findByText(/Save or discard your unsaved changes in README\.md/),
    ).toBeInTheDocument();
    expect(useCafeDoc.getState().progress.documentation.verifiedAt).toBeNull();
  });

  it("runs the final project check and becomes Ready for Delivery", async () => {
    seedProjectFiles();
    seedDocumentation();

    renderPreparation();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Run Final Project Check/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Run Final Project Check/ }));

    await waitFor(() =>
      expect(screen.getByTestId("cafe-delivery-status")).toHaveTextContent("Ready for Delivery"),
    );
    expect(validateMock).toHaveBeenCalledWith(expect.anything(), "CAFE-DEV-04", {
      "calculator.py": CALCULATOR,
      "main.py": MAIN,
    });
    expect(useCafeDoc.getState().progress.delivery.projectSignature).toBe(
      cafeProjectFingerprint({ readme: README, calculator: CALCULATOR, main: MAIN }),
    );
    expect(screen.getByText(/final tests passed/)).toBeInTheDocument();
    expect(useChapter1.getState().progress.completedQuestIds).not.toContain("CH1-06");
  });

  it("requires re-verification when README.md changes after verification", async () => {
    seedProjectFiles();
    useCafeDoc.setState({
      progress: applyCafeDocumentationVerification(
        initialCafeDocProgress,
        "old-readme-signature",
        "2026-01-02T11:00:00.000Z",
      ),
    });

    renderPreparation();

    expect(await screen.findByText(/README\.md changed since it was verified/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("cafe-delivery-status")).toHaveTextContent("Final Checks Required"),
    );
    expect(screen.getByRole("button", { name: /Run Final Project Check/ })).toBeDisabled();
  });

  it("requires a re-check when Python files change after a passing final check", async () => {
    seedProjectFiles();
    const verified = applyCafeDocumentationVerification(
      initialCafeDocProgress,
      readmeFingerprint(README),
      "2026-01-02T11:00:00.000Z",
    );
    useCafeDoc.setState({
      progress: applyCafeDeliveryCheck(verified, {
        passed: true,
        projectSignature: "project-from-an-older-file-version",
        checkedAt: "2026-01-02T12:00:00.000Z",
      }),
    });

    renderPreparation();

    expect(
      await screen.findByText(/Project files changed since the last final check/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("cafe-delivery-status")).toHaveTextContent("Final Checks Required"),
    );
  });
});
