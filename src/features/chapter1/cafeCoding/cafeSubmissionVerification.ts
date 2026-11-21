/**
 * Pre-submission verification for the café project.
 *
 * Submission is an explicit player action. Before a snapshot is committed this
 * re-checks the active workflow, four-task progress, README verification,
 * delivery readiness, unsaved editor changes, and the saved-file signatures.
 * The same executable CAFE-DEV-04 verifier used by the final project check is
 * re-run against the saved files; no readiness record is rewritten here.
 */
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { normalizePath } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import {
  CAFE_PROJECT_DIRECTORY,
  CAFE_PROJECT_REQUIRED_FILES,
  type CafeProjectRequiredFile,
} from "../cafeSetup/cafeSetupTasks";
import {
  cafeProjectFingerprint,
  readmeFingerprint,
  type CafeProjectFileContents,
} from "./cafeDelivery";
import type { CafeDocProgress } from "./cafeDocProgress";
import type { CafeDevFileContents } from "./cafeDevTasks";
import type { CafeDevValidationResult } from "./cafeDevValidator";
import {
  verifyCafeProjectDelivery,
  type CafeDeliveryCheckFailureKind,
} from "./cafeDeliveryVerification";
import type { CafeWorkflow } from "./cafeWorkflow";
import {
  cafeSubmittedFileFingerprint,
  createCafeSubmissionRecord,
  type CafeSubmissionRecord,
} from "./cafeSubmission";

export type CafeSubmissionFailureKind =
  | CafeDeliveryCheckFailureKind
  | "legacy-workflow"
  | "delivery-not-ready"
  | "files-changed"
  | "record-invalid";

export interface CafeSubmissionResult {
  readonly ok: boolean;
  readonly kind: CafeSubmissionFailureKind | "submitted";
  readonly reason: string;
  readonly record: CafeSubmissionRecord | null;
  readonly validation: CafeDevValidationResult | null;
}

export interface CafeSubmissionVerificationInput {
  /** Workflow selected from the same evidence used by Tickets and GigBoard. */
  readonly workflow: CafeWorkflow;
  readonly developmentComplete: boolean;
  readonly setupComplete: boolean;
  readonly docProgress: CafeDocProgress;
  /** Delivery readiness derived from saved-file signatures, not a stored flag. */
  readonly finalCheckPassed: boolean;
  readonly openFilePath: string | null;
  readonly openFileDirty: boolean;
}

export interface CafeSubmissionVerificationDeps {
  readonly readEntry: (path: string) => Promise<FsEntry | undefined>;
  /** Reuse the executable CAFE-DEV-04 verifier against saved calculator/main. */
  readonly validateProject: (files: CafeDevFileContents) => Promise<CafeDevValidationResult>;
  readonly now?: () => Date;
  readonly submissionId?: (input: {
    submittedAt: string;
    projectSignature: string;
  }) => string;
}

type SavedFiles = Map<CafeProjectRequiredFile, string>;

function failure(
  kind: CafeSubmissionFailureKind,
  reason: string,
  validation?: CafeDevValidationResult,
): CafeSubmissionResult {
  return { ok: false, kind, reason, record: null, validation: validation ?? null };
}

async function readSavedFiles(
  readEntry: (path: string) => Promise<FsEntry | undefined>,
): Promise<{ files: SavedFiles; missing: readonly string[] }> {
  const files: SavedFiles = new Map();
  const missing: string[] = [];

  for (const name of CAFE_PROJECT_REQUIRED_FILES) {
    const path = normalizePath(`${CAFE_PROJECT_DIRECTORY}/${name}`);
    try {
      const entry = await readEntry(path);
      if (!entry || entry.kind !== "file") {
        missing.push(name);
        continue;
      }
      files.set(name, entry.content ?? "");
    } catch {
      missing.push(name);
    }
  }

  return { files, missing };
}

function sameFiles(before: SavedFiles, after: SavedFiles): boolean {
  if (before.size !== after.size) return false;
  for (const [name, content] of before) {
    if (after.get(name) !== content) return false;
  }
  return true;
}

function defaultSubmissionId(input: { submittedAt: string; projectSignature: string }): string {
  const time = Date.parse(input.submittedAt);
  const stamp = Number.isNaN(time) ? "0" : time.toString(36);
  return `sub-${CAFE_CALCULATOR_JOB_ID}-${stamp}-${input.projectSignature}`;
}

/**
 * Validate the current project and capture its immutable submission snapshot.
 * The snapshot is built only from the second, post-verification read so a file
 * modified while the Python tests were running blocks the submission.
 */
export async function submitCafeProject(
  input: CafeSubmissionVerificationInput,
  deps: CafeSubmissionVerificationDeps,
): Promise<CafeSubmissionResult> {
  if (input.workflow !== "development") {
    return failure(
      "legacy-workflow",
      "This project uses the legacy milestone workflow. The café submission is only available for the four-task development project.",
    );
  }
  if (!input.developmentComplete) {
    return failure(
      "development-incomplete",
      "All four café coding tasks must be verified before you can submit this project.",
    );
  }
  if (!input.setupComplete) {
    return failure(
      "setup-incomplete",
      "Finish the café project setup before you submit your work.",
    );
  }
  if (!input.finalCheckPassed) {
    return failure(
      "delivery-not-ready",
      "The final project check must pass for the current saved files before you can submit.",
    );
  }

  const before = await readSavedFiles(deps.readEntry);
  if (before.missing.length > 0) {
    return failure(
      "missing-file",
      `The project is missing ${before.missing.join(", ")}. Recreate the required files before submitting.`,
    );
  }

  const check = await verifyCafeProjectDelivery(
    {
      developmentComplete: true,
      setupComplete: true,
      docProgress: input.docProgress,
      openFilePath: input.openFilePath,
      openFileDirty: input.openFileDirty,
    },
    {
      readEntry: deps.readEntry,
      validateProject: deps.validateProject,
      // Re-run the tests without rewriting the final-check record.
      recordDeliveryCheck: async () => ({ ok: true }),
    },
  );
  if (!check.ok) {
    return failure(check.kind, check.reason, "validation" in check ? check.validation : undefined);
  }

  const after = await readSavedFiles(deps.readEntry);
  if (after.missing.length > 0 || !sameFiles(before.files, after.files)) {
    return failure(
      "files-changed",
      "A project file changed while your work was being verified. Confirm the submission again to send the saved version.",
    );
  }

  const readme = after.files.get("README.md");
  const calculator = after.files.get("calculator.py");
  const main = after.files.get("main.py");
  if (
    readme === undefined ||
    calculator === undefined ||
    main === undefined ||
    readmeFingerprint(readme) !== input.docProgress.documentation.readmeSignature ||
    cafeProjectFingerprint({ readme, calculator, main }) !== check.projectSignature
  ) {
    return failure(
      "files-changed",
      "The saved project files no longer match the verified signatures. Run the final check again before submitting.",
    );
  }

  const now = deps.now?.() ?? new Date();
  const submittedAt = now.toISOString();
  const snapshotFiles = CAFE_PROJECT_REQUIRED_FILES.map((name) => ({
    name,
    content: after.files.get(name) ?? "",
  }));
  const submittedProjectFiles: CafeProjectFileContents = { readme, calculator, main };
  const projectSignature = cafeProjectFingerprint(submittedProjectFiles);

  const record = createCafeSubmissionRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: deps.submissionId?.({ submittedAt, projectSignature }) ??
      defaultSubmissionId({ submittedAt, projectSignature }),
    submittedAt,
    files: snapshotFiles,
  });
  if (!record) {
    return failure("record-invalid", "The submission snapshot could not be created. Try again.");
  }

  // Defensive integrity check: every captured fingerprint must describe the
  // exact content that was just verified.
  const mismatched = record.files.some(
    (file) => file.fingerprint !== cafeSubmittedFileFingerprint(file.content),
  );
  if (mismatched || record.projectFingerprint !== projectSignature) {
    return failure("record-invalid", "The submission snapshot failed its integrity check.");
  }

  return {
    ok: true,
    kind: "submitted",
    reason: "Your project was sent to Alex Morgan for review.",
    record,
    validation: check.validation,
  };
}
