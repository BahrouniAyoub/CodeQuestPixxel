import { describe, expect, it, vi } from "vitest";
import type { FsEntry } from "@/services/filesystem/types";
import {
  applyCafeDocumentationVerification,
  initialCafeDocProgress,
  type CafeDocProgress,
} from "./cafeDocProgress";
import { cafeProjectFingerprint, readmeFingerprint } from "./cafeDelivery";
import type { CafeDevValidationResult } from "./cafeDevValidator";
import { submitCafeProject, type CafeSubmissionVerificationInput } from "./cafeSubmissionVerification";
import { cafeSubmittedFile } from "./cafeSubmission";

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
const CALCULATOR = "def calculate_total(c, s):\n    return c * 3 + s * 5\n";
const MAIN = "import calculator\nprint(calculator.calculate_total(2, 3))\n";
const PLAN = "Build the café calculator.";

const SAVED: Record<string, string> = {
  "README.md": README,
  "calculator.py": CALCULATOR,
  "main.py": MAIN,
  "PLAN.md": PLAN,
};

function passedValidation(): CafeDevValidationResult {
  return {
    taskId: "CAFE-DEV-04",
    status: "passed",
    testsPassed: 9,
    testsExecuted: 9,
    testsTotal: 9,
    outcomes: [],
    message: "All 9 task tests passed.",
    error: null,
  };
}

function fileEntry(path: string, content: string): FsEntry {
  return { path, kind: "file", content, updatedAt: 0 };
}

function files(overrides: Record<string, string | null> = {}) {
  const map = new Map<string, FsEntry>();
  for (const [name, content] of Object.entries({ ...SAVED, ...overrides })) {
    if (content === null) continue;
    const path = `${DIRECTORY}/${name}`;
    map.set(path, fileEntry(path, content));
  }
  return {
    map,
    readEntry: vi.fn(async (path: string) => map.get(path)),
  };
}

function verifiedProgress(readme = README): CafeDocProgress {
  return applyCafeDocumentationVerification(
    initialCafeDocProgress,
    readmeFingerprint(readme),
    "2026-01-02T11:00:00.000Z",
  );
}

function input(overrides: Partial<CafeSubmissionVerificationInput> = {}): CafeSubmissionVerificationInput {
  return {
    workflow: "development",
    developmentComplete: true,
    setupComplete: true,
    docProgress: verifiedProgress(),
    finalCheckPassed: true,
    openFilePath: null,
    openFileDirty: false,
    ...overrides,
  };
}

function deps(readEntry: (path: string) => Promise<FsEntry | undefined>) {
  return {
    readEntry,
    validateProject: vi.fn(async () => passedValidation()),
    now: () => new Date("2026-01-02T12:00:00.000Z"),
    submissionId: () => "sub-test",
  };
}

describe("café project submission verification", () => {
  it("re-runs the final tests and captures an immutable four-file snapshot", async () => {
    const fs = files();
    const result = await submitCafeProject(input(), deps(fs.readEntry));

    expect(result.ok).toBe(true);
    expect(result.validation?.testsExecuted).toBe(9);
    expect(result.record?.files.map((file) => file.name)).toEqual([
      "PLAN.md",
      "calculator.py",
      "main.py",
      "README.md",
    ]);
    expect(result.record?.projectFingerprint).toBe(
      cafeProjectFingerprint({ readme: README, calculator: CALCULATOR, main: MAIN }),
    );
    expect(cafeSubmittedFile(result.record!, "PLAN.md")).toBe(PLAN);

    // Editing the working file later cannot change the submitted snapshot.
    fs.map.set(`${DIRECTORY}/main.py`, fileEntry(`${DIRECTORY}/main.py`, "print('later edit')"));
    expect(cafeSubmittedFile(result.record!, "main.py")).toBe(MAIN);
  });

  it("blocks a legacy save and incomplete or unverified projects", async () => {
    const fs = files();
    const legacy = await submitCafeProject(input({ workflow: "legacy" }), deps(fs.readEntry));
    expect(legacy).toMatchObject({ ok: false, kind: "legacy-workflow" });

    const incomplete = await submitCafeProject(
      input({ developmentComplete: false }),
      deps(fs.readEntry),
    );
    expect(incomplete).toMatchObject({ ok: false, kind: "development-incomplete" });

    const setup = await submitCafeProject(input({ setupComplete: false }), deps(fs.readEntry));
    expect(setup).toMatchObject({ ok: false, kind: "setup-incomplete" });

    const unready = await submitCafeProject(input({ finalCheckPassed: false }), deps(fs.readEntry));
    expect(unready).toMatchObject({ ok: false, kind: "delivery-not-ready" });
    expect(fs.readEntry).not.toHaveBeenCalled();
  });

  it("rejects unsaved changes, missing files, and stale documentation before submitting", async () => {
    const dirty = await submitCafeProject(
      input({ openFilePath: `${DIRECTORY}/calculator.py`, openFileDirty: true }),
      deps(files().readEntry),
    );
    expect(dirty).toMatchObject({ ok: false, kind: "unsaved-changes" });

    const missing = await submitCafeProject(
      input(),
      deps(files({ "PLAN.md": null }).readEntry),
    );
    expect(missing).toMatchObject({ ok: false, kind: "missing-file" });

    const stale = await submitCafeProject(
      input({ docProgress: initialCafeDocProgress }),
      deps(files().readEntry),
    );
    expect(stale).toMatchObject({ ok: false, kind: "documentation-stale" });
  });

  it("does not submit when the re-run Python tests fail", async () => {
    const fs = files();
    const verification = deps(fs.readEntry);
    verification.validateProject.mockResolvedValueOnce({
      ...passedValidation(),
      status: "failed",
      testsPassed: 1,
      message: "1 of 9 task tests passed.",
    });

    const result = await submitCafeProject(input(), verification);
    expect(result).toMatchObject({ ok: false, kind: "tests-failed" });
    expect(result.record).toBeNull();
  });

  it("blocks a file modified while the verification is running", async () => {
    const fs = files();
    const verification = deps(fs.readEntry);
    verification.validateProject.mockImplementationOnce(async () => {
      const path = `${DIRECTORY}/main.py`;
      fs.map.set(path, fileEntry(path, "print('changed during validation')"));
      return passedValidation();
    });

    const result = await submitCafeProject(input(), verification);
    expect(result).toMatchObject({ ok: false, kind: "files-changed" });
    expect(result.record).toBeNull();
  });
});
