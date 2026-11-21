import { describe, expect, it, vi } from "vitest";
import type { FsEntry } from "@/services/filesystem/types";
import {
  applyCafeDocumentationVerification,
  initialCafeDocProgress,
  type CafeDocProgress,
} from "./cafeDocProgress";
import { cafeProjectFingerprint, readmeFingerprint } from "./cafeDelivery";
import { verifyCafeProjectDelivery } from "./cafeDeliveryVerification";
import type { CafeDevValidationResult } from "./cafeDevValidator";

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
const DIRECTORY = "/Projects/Python/cafe-calculator";

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

function failingValidation(): CafeDevValidationResult {
  return {
    taskId: "CAFE-DEV-04",
    status: "failed",
    testsPassed: 1,
    testsExecuted: 5,
    testsTotal: 5,
    outcomes: [],
    message: "1 of 5 task tests passed.",
    error: null,
  };
}

function entries(overrides: Record<string, string | null> = {}) {
  const files: Record<string, string | null> = {
    "README.md": README,
    "calculator.py": CALCULATOR,
    "main.py": MAIN,
    "PLAN.md": "Plan the calculator.",
    ...overrides,
  };
  const map = new Map<string, FsEntry>();
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    const path = `${DIRECTORY}/${name}`;
    map.set(path, { path, kind: "file", content, updatedAt: 0 });
  }
  return {
    readEntry: vi.fn(async (path: string) => map.get(path)),
  };
}

function verifiedProgress(readme = README): CafeDocProgress {
  return applyCafeDocumentationVerification(
    initialCafeDocProgress,
    readmeFingerprint(readme),
    "2026-01-02T09:00:00.000Z",
  );
}

function baseInput(docProgress: CafeDocProgress) {
  return {
    developmentComplete: true,
    setupComplete: true,
    docProgress,
    openFilePath: null,
    openFileDirty: false,
  };
}

describe("final café project verification", () => {
  it("blocks the check until all four coding tasks are verified", async () => {
    const result = await verifyCafeProjectDelivery(
      { ...baseInput(verifiedProgress()), developmentComplete: false },
      {
        ...entries(),
        validateProject: vi.fn(),
        recordDeliveryCheck: vi.fn(),
      },
    );

    expect(result).toMatchObject({ ok: false, kind: "development-incomplete" });
  });

  it("blocks the check until setup is complete", async () => {
    const result = await verifyCafeProjectDelivery(
      { ...baseInput(verifiedProgress()), setupComplete: false },
      {
        ...entries(),
        validateProject: vi.fn(),
        recordDeliveryCheck: vi.fn(),
      },
    );

    expect(result).toMatchObject({ ok: false, kind: "setup-incomplete" });
  });

  it("blocks the check while a project file has unsaved changes", async () => {
    const result = await verifyCafeProjectDelivery(
      {
        ...baseInput(verifiedProgress()),
        openFilePath: `${DIRECTORY}/calculator.py`,
        openFileDirty: true,
      },
      {
        ...entries(),
        validateProject: vi.fn(),
        recordDeliveryCheck: vi.fn(),
      },
    );

    expect(result).toMatchObject({ ok: false, kind: "unsaved-changes" });
    expect(result.reason).toMatch(/calculator\.py/);
  });

  it("reports every missing required file", async () => {
    const result = await verifyCafeProjectDelivery(baseInput(verifiedProgress()), {
      ...entries({ "calculator.py": null, "PLAN.md": null }),
      validateProject: vi.fn(),
      recordDeliveryCheck: vi.fn(),
    });

    expect(result).toMatchObject({ ok: false, kind: "missing-file" });
    if (!result.ok && result.kind === "missing-file") {
      expect(result.missingFiles).toEqual(expect.arrayContaining(["calculator.py", "PLAN.md"]));
      expect(result.missingFiles).toHaveLength(2);
    }
  });

  it("rejects incomplete documentation before running Python", async () => {
    const readme =
      "This café calculator calculates orders. Coffee costs $3 and sandwiches cost $5.";
    const result = await verifyCafeProjectDelivery(baseInput(verifiedProgress(readme)), {
      ...entries({ "README.md": readme }),
      validateProject: vi.fn(),
      recordDeliveryCheck: vi.fn(),
    });

    expect(result).toMatchObject({ ok: false, kind: "documentation-missing" });
    if (!result.ok && result.kind === "documentation-missing") {
      expect(result.analysis.missing.length).toBeGreaterThan(0);
    }
  });

  it("requires the saved README to match the verified signature", async () => {
    const notVerified = await verifyCafeProjectDelivery(baseInput(initialCafeDocProgress), {
      ...entries(),
      validateProject: vi.fn(),
      recordDeliveryCheck: vi.fn(),
    });
    expect(notVerified).toMatchObject({ ok: false, kind: "documentation-stale" });

    const changed = await verifyCafeProjectDelivery(baseInput(verifiedProgress("old content")), {
      ...entries(),
      validateProject: vi.fn(),
      recordDeliveryCheck: vi.fn(),
    });
    expect(changed).toMatchObject({ ok: false, kind: "documentation-stale" });
    if (!changed.ok) expect(changed.reason).toMatch(/changed since documentation was verified/);
  });

  it("records a failed final check when the Python tests fail", async () => {
    const recordDeliveryCheck = vi.fn(async () => ({ ok: true as const }));

    const result = await verifyCafeProjectDelivery(baseInput(verifiedProgress()), {
      ...entries(),
      validateProject: vi.fn(async () => failingValidation()),
      recordDeliveryCheck,
    });

    expect(result).toMatchObject({ ok: false, kind: "tests-failed" });
    expect(recordDeliveryCheck).toHaveBeenCalledWith({
      passed: false,
      projectSignature: null,
    });
  });

  it("runs the existing CAFE-DEV-04 verifier and records readiness", async () => {
    const validateProject = vi.fn(async () => passedValidation());
    const recordDeliveryCheck = vi.fn(async () => ({ ok: true as const }));

    const result = await verifyCafeProjectDelivery(baseInput(verifiedProgress()), {
      ...entries(),
      validateProject,
      recordDeliveryCheck,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("ready");
      expect(result.projectSignature).toBe(
        cafeProjectFingerprint({ readme: README, calculator: CALCULATOR, main: MAIN }),
      );
    }
    expect(validateProject).toHaveBeenCalledWith({
      "calculator.py": CALCULATOR,
      "main.py": MAIN,
    });
    expect(recordDeliveryCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        passed: true,
        projectSignature: cafeProjectFingerprint({
          readme: README,
          calculator: CALCULATOR,
          main: MAIN,
        }),
      }),
    );
  });

  it("keeps the project unready when the readiness record cannot be saved", async () => {
    const result = await verifyCafeProjectDelivery(baseInput(verifiedProgress()), {
      ...entries(),
      validateProject: vi.fn(async () => passedValidation()),
      recordDeliveryCheck: vi.fn(async () => ({
        ok: false as const,
        reason: "Could not save the final project check result.",
      })),
    });

    expect(result).toMatchObject({ ok: false, kind: "save-failed" });
  });
});
