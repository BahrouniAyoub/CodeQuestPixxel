/**
 * Verify the player's saved README.md.
 *
 * Verification always reads the saved file, never the Editor buffer. It is
 * blocked while README.md has unsaved changes so the player can see exactly
 * what will be checked. Nothing here writes documentation content.
 */
import { normalizePath } from "@/services/filesystem/filesystem";
import type { FsEntry } from "@/services/filesystem/types";
import { isCafeReadmePath } from "./cafeDocFiles";
import { analyzeCafeReadme, type CafeReadmeAnalysis } from "./cafeDocReadme";
import { CAFE_DOC_README_PATH } from "./cafeDocTask";
import type { CafeDocumentationVerificationResult } from "./cafeDocStore";
import { readmeFingerprint } from "./cafeDelivery";

export interface CafeDocVerificationDeps {
  readonly readEntry: (path: string) => Promise<FsEntry | undefined>;
  /** Persist a successful verification. Must never award XP or money. */
  readonly recordVerified: (
    readmeSignature: string,
  ) => Promise<CafeDocumentationVerificationResult>;
}

export interface CafeDocVerificationInput {
  readonly developmentComplete: boolean;
  readonly openFilePath: string | null;
  readonly openFileDirty: boolean;
}

export type CafeDocVerificationResult =
  | {
      readonly ok: false;
      readonly kind: "locked" | "unsaved-changes" | "missing-file" | "not-a-file";
      readonly reason: string;
    }
  | {
      readonly ok: false;
      readonly kind: "incomplete" | "save-failed";
      readonly reason: string;
      readonly analysis: CafeReadmeAnalysis;
    }
  | {
      readonly ok: true;
      readonly kind: "verified";
      readonly reason: string;
      readonly signature: string;
      readonly analysis: CafeReadmeAnalysis;
      readonly alreadyVerified: boolean;
    };

export async function verifyCafeDocumentationFromSavedFile(
  input: CafeDocVerificationInput,
  deps: CafeDocVerificationDeps,
): Promise<CafeDocVerificationResult> {
  if (!input.developmentComplete) {
    return {
      ok: false,
      kind: "locked",
      reason: "Finish and verify all four café coding tasks before documenting the project.",
    };
  }

  if (input.openFilePath && input.openFileDirty && isCafeReadmePath(input.openFilePath)) {
    return {
      ok: false,
      kind: "unsaved-changes",
      reason: "Save or discard your unsaved changes in README.md before verifying.",
    };
  }

  const path = normalizePath(CAFE_DOC_README_PATH);
  const entry = await deps.readEntry(path);
  if (!entry) {
    return {
      ok: false,
      kind: "missing-file",
      reason:
        "README.md was not found. Recreate it in /Projects/Python/cafe-calculator and save your documentation first.",
    };
  }
  if (entry.kind !== "file") {
    return {
      ok: false,
      kind: "not-a-file",
      reason: "README.md is a folder. Recreate it as a file.",
    };
  }

  const content = entry.content ?? "";
  const analysis = analyzeCafeReadme(content);
  if (!analysis.ok) {
    return {
      ok: false,
      kind: "incomplete",
      reason: analysis.summary,
      analysis,
    };
  }

  const signature = readmeFingerprint(content);
  const record = await deps.recordVerified(signature);
  if (!record.ok) {
    return {
      ok: false,
      kind: "save-failed",
      reason: record.reason,
      analysis,
    };
  }

  return {
    ok: true,
    kind: "verified",
    reason: record.alreadyVerified
      ? "README.md is already verified with this content."
      : "README.md documentation verified. Run the final project check next.",
    signature,
    analysis,
    alreadyVerified: record.alreadyVerified,
  };
}
