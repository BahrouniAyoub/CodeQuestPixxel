/**
 * Final delivery-readiness verification for the café project.
 *
 * Re-reads every saved project file, re-checks the README signature, and runs
 * the existing CAFE-DEV-04 end-to-end Pyodide verification. Historical task
 * completion alone never makes a project ready: changed files move delivery
 * back to "Final Checks Required".
 */
import { normalizePath } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import { CAFE_PROJECT_DIRECTORY, CAFE_PROJECT_REQUIRED_FILES } from "../cafeSetup/cafeSetupTasks";
import { analyzeCafeReadme, type CafeReadmeAnalysis } from "./cafeDocReadme";
import type { CafeDocProgress } from "./cafeDocProgress";
import type { CafeDeliveryRecordResult } from "./cafeDocStore";
import { isCafeReadmePath } from "./cafeDocFiles";
import { cafeDevFilePath, type CafeDevFileContents } from "./cafeDevTasks";
import type { CafeDevValidationResult } from "./cafeDevValidator";
import {
  cafeProjectFingerprint,
  readmeFingerprint,
  type CafeProjectFileContents,
} from "./cafeDelivery";

export interface CafeDeliveryCheckDeps {
  readonly readEntry: (path: string) => Promise<FsEntry | undefined>;
  /** Reuse the executable CAFE-DEV-04 verifier against saved calculator/main. */
  readonly validateProject: (files: CafeDevFileContents) => Promise<CafeDevValidationResult>;
  readonly recordDeliveryCheck: (input: {
    passed: boolean;
    projectSignature: string | null;
    checkedAt?: string;
  }) => Promise<CafeDeliveryRecordResult>;
}

export interface CafeDeliveryCheckInput {
  readonly developmentComplete: boolean;
  readonly setupComplete: boolean;
  readonly docProgress: CafeDocProgress;
  readonly openFilePath: string | null;
  readonly openFileDirty: boolean;
}

export type CafeDeliveryCheckFailureKind =
  | "development-incomplete"
  | "setup-incomplete"
  | "unsaved-changes"
  | "missing-file"
  | "documentation-missing"
  | "documentation-stale"
  | "tests-failed"
  | "save-failed";

export type CafeDeliveryCheckResult =
  | {
      readonly ok: false;
      readonly kind:
        "development-incomplete" | "setup-incomplete" | "unsaved-changes" | "documentation-stale";
      readonly reason: string;
    }
  | {
      readonly ok: false;
      readonly kind: "missing-file";
      readonly reason: string;
      readonly missingFiles: readonly string[];
    }
  | {
      readonly ok: false;
      readonly kind: "documentation-missing";
      readonly reason: string;
      readonly analysis: CafeReadmeAnalysis;
    }
  | {
      readonly ok: false;
      readonly kind: "tests-failed" | "save-failed";
      readonly reason: string;
      readonly validation?: CafeDevValidationResult;
    }
  | {
      readonly ok: true;
      readonly kind: "ready";
      readonly reason: string;
      readonly validation: CafeDevValidationResult;
      readonly projectSignature: string;
      readonly checkedAt: string;
    };

const DELIVERY_FILES = ["README.md", "calculator.py", "main.py"] as const;

function isDeliveryFile(path: string): boolean {
  const normalized = normalizePath(path);
  if (isCafeReadmePath(normalized)) return true;
  return (
    normalized === normalizePath(cafeDevFilePath("calculator.py")) ||
    normalized === normalizePath(cafeDevFilePath("main.py"))
  );
}

function fileLabel(fileName: string): string {
  return fileName;
}

export async function verifyCafeProjectDelivery(
  input: CafeDeliveryCheckInput,
  deps: CafeDeliveryCheckDeps,
): Promise<CafeDeliveryCheckResult> {
  if (!input.developmentComplete) {
    return {
      ok: false,
      kind: "development-incomplete",
      reason: "All four café coding tasks must be verified before the final project check.",
    };
  }

  if (!input.setupComplete) {
    return {
      ok: false,
      kind: "setup-incomplete",
      reason: "Finish the café project setup before running the final project check.",
    };
  }

  if (input.openFilePath && input.openFileDirty && isDeliveryFile(input.openFilePath)) {
    return {
      ok: false,
      kind: "unsaved-changes",
      reason: `Save or discard your unsaved changes in ${
        input.openFilePath.split("/").pop() ?? input.openFilePath
      } before running the final project check.`,
    };
  }

  const contents = new Map<string, string>();
  const missingFiles: string[] = [];

  for (const fileName of CAFE_PROJECT_REQUIRED_FILES) {
    const path = normalizePath(`${CAFE_PROJECT_DIRECTORY}/${fileName}`);
    const entry = await deps.readEntry(path);
    if (!entry || entry.kind !== "file") {
      missingFiles.push(fileLabel(fileName));
      continue;
    }
    contents.set(fileName, entry.content ?? "");
  }

  if (missingFiles.length > 0) {
    return {
      ok: false,
      kind: "missing-file",
      reason: `The project is missing ${missingFiles.join(", ")}. Recreate the required files before the final check.`,
      missingFiles,
    };
  }

  const readme = contents.get("README.md") ?? "";
  const calculator = contents.get("calculator.py") ?? "";
  const main = contents.get("main.py") ?? "";

  const analysis = analyzeCafeReadme(readme);
  if (!analysis.ok) {
    return {
      ok: false,
      kind: "documentation-missing",
      reason: `${analysis.summary} Verify the documentation before the final project check.`,
      analysis,
    };
  }

  const signature = readmeFingerprint(readme);
  const verifiedSignature = input.docProgress.documentation.readmeSignature;
  if (!input.docProgress.documentation.verifiedAt || verifiedSignature === null) {
    return {
      ok: false,
      kind: "documentation-stale",
      reason: "Verify the README documentation before running the final project check.",
    };
  }
  if (verifiedSignature !== signature) {
    return {
      ok: false,
      kind: "documentation-stale",
      reason:
        "README.md changed since documentation was verified. Verify the documentation again before the final check.",
    };
  }

  const files: CafeProjectFileContents = { readme, calculator, main };
  const projectSignature = cafeProjectFingerprint(files);

  const validation = await deps.validateProject({
    "calculator.py": calculator,
    "main.py": main,
  });

  if (validation.status !== "passed") {
    // Record the failed attempt so the Tickets panel can show accurate tests
    // status. A storage failure here must not hide the more useful test result.
    await deps.recordDeliveryCheck({
      passed: false,
      projectSignature: null,
    });
    return {
      ok: false,
      kind: "tests-failed",
      reason: validation.message,
      validation,
    };
  }

  const checkedAt = new Date().toISOString();
  const recorded = await deps.recordDeliveryCheck({
    passed: true,
    projectSignature,
    checkedAt,
  });
  if (!recorded.ok) {
    return {
      ok: false,
      kind: "save-failed",
      reason: recorded.reason,
      validation,
    };
  }

  return {
    ok: true,
    kind: "ready",
    reason: "Final project check passed. The café calculator is ready for delivery.",
    validation,
    projectSignature,
    checkedAt,
  };
}
