/**
 * Pure, versioned café project submission record.
 *
 * A submission is an immutable snapshot of the four saved project files plus a
 * small amount of lifecycle state (review status and review time). IndexedDB and
 * Zustand live in `cafeSubmissionStore.ts`; this module only builds, validates,
 * and transitions records. Later edits to the working files never change a
 * submitted snapshot.
 */
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  CAFE_PROJECT_REQUIRED_FILES,
  type CafeProjectRequiredFile,
} from "../cafeSetup/cafeSetupTasks";
import { cafeProjectFingerprint, fingerprintText } from "./cafeDelivery";

export const CAFE_SUBMISSION_SAVE_VERSION = 1;

export type CafeSubmissionReviewStatus = "awaiting-review" | "approved";

export interface CafeSubmittedFile {
  /** Canonical file name inside the café project directory. */
  readonly name: CafeProjectRequiredFile;
  /** Saved file content captured at submission time. */
  readonly content: string;
  /** Fingerprint of the captured content. */
  readonly fingerprint: string;
}

export interface CafeSubmissionRecord {
  readonly jobId: string;
  readonly submissionId: string;
  /** ISO timestamp of the explicit player submission. */
  readonly submittedAt: string;
  /** The immutable submitted snapshot, in canonical required-file order. */
  readonly files: readonly CafeSubmittedFile[];
  /** Fingerprint of README.md + calculator.py + main.py in the snapshot. */
  readonly projectFingerprint: string;
  readonly reviewStatus: CafeSubmissionReviewStatus;
  /** ISO timestamp of Alex Morgan's deterministic review, or null while awaiting. */
  readonly reviewedAt: string | null;
}

export interface CafeSubmissionSaveRecord {
  readonly version: typeof CAFE_SUBMISSION_SAVE_VERSION;
  /** Null is a valid "nothing submitted yet" save. */
  readonly submission: CafeSubmissionRecord | null;
}

export type CafeSubmissionValidationResult =
  | { ok: true; record: CafeSubmissionRecord | null }
  | { ok: false; reason: string };

export interface CafeSubmissionRecordInput {
  readonly jobId: string;
  readonly submissionId: string;
  readonly submittedAt: string;
  readonly files: readonly { readonly name: CafeProjectRequiredFile; readonly content: string }[];
  readonly reviewStatus?: CafeSubmissionReviewStatus;
  readonly reviewedAt?: string | null;
}

function invalid(reason: string): CafeSubmissionValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown, maxLength = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isReviewStatus(value: unknown): value is CafeSubmissionReviewStatus {
  return value === "awaiting-review" || value === "approved";
}

function isRequiredFileName(value: unknown): value is CafeProjectRequiredFile {
  return (
    typeof value === "string" &&
    (CAFE_PROJECT_REQUIRED_FILES as readonly string[]).includes(value)
  );
}

/** Newline-normalized fingerprint used for each captured file. */
export function cafeSubmittedFileFingerprint(content: string): string {
  return fingerprintText(content.replace(/\r\n/g, "\n"));
}

function copyFile(file: CafeSubmittedFile): CafeSubmittedFile {
  return { name: file.name, content: file.content, fingerprint: file.fingerprint };
}

function copyRecord(record: CafeSubmissionRecord): CafeSubmissionRecord {
  return {
    jobId: record.jobId,
    submissionId: record.submissionId,
    submittedAt: record.submittedAt,
    files: record.files.map(copyFile),
    projectFingerprint: record.projectFingerprint,
    reviewStatus: record.reviewStatus,
    reviewedAt: record.reviewedAt,
  };
}

/**
 * Build a snapshot record from verified saved files. Returns null when the file
 * set is incomplete or a required field is invalid, so no partial record can be
 * persisted.
 */
export function createCafeSubmissionRecord(
  input: CafeSubmissionRecordInput,
): CafeSubmissionRecord | null {
  if (input.jobId !== CAFE_CALCULATOR_JOB_ID) return null;
  if (!isNonEmptyString(input.submissionId)) return null;
  if (!isIsoTimestamp(input.submittedAt)) return null;

  const reviewStatus = input.reviewStatus ?? "awaiting-review";
  const reviewedAt = input.reviewedAt ?? null;
  if (!isReviewStatus(reviewStatus)) return null;
  if (reviewStatus === "awaiting-review" && reviewedAt !== null) return null;
  if (reviewStatus === "approved" && !isIsoTimestamp(reviewedAt)) return null;

  const files = new Map<CafeProjectRequiredFile, string>();
  for (const file of input.files) {
    if (!isRequiredFileName(file.name) || typeof file.content !== "string" || files.has(file.name)) {
      return null;
    }
    files.set(file.name, file.content);
  }
  if (files.size !== CAFE_PROJECT_REQUIRED_FILES.length) return null;

  const readme = files.get("README.md");
  const calculator = files.get("calculator.py");
  const main = files.get("main.py");
  if (readme === undefined || calculator === undefined || main === undefined) return null;

  return {
    jobId: input.jobId,
    submissionId: input.submissionId,
    submittedAt: input.submittedAt,
    files: CAFE_PROJECT_REQUIRED_FILES.map((name) => {
      const content = files.get(name) ?? "";
      return { name, content, fingerprint: cafeSubmittedFileFingerprint(content) };
    }),
    projectFingerprint: cafeProjectFingerprint({ readme, calculator, main }),
    reviewStatus,
    reviewedAt: reviewStatus === "approved" ? (reviewedAt as string) : null,
  };
}

/** Persist a deep copy so later caller mutations cannot alter the snapshot. */
export function createCafeSubmissionSaveRecord(
  record: CafeSubmissionRecord | null,
): CafeSubmissionSaveRecord {
  return {
    version: CAFE_SUBMISSION_SAVE_VERSION,
    submission: record === null ? null : copyRecord(record),
  };
}

function validateRecord(raw: unknown): CafeSubmissionValidationResult {
  if (!isRecord(raw)) return invalid("submission is not an object");
  if (raw["jobId"] !== CAFE_CALCULATOR_JOB_ID) return invalid("submission has an invalid job ID");
  if (!isNonEmptyString(raw["submissionId"])) return invalid("submission has an invalid ID");
  if (!isIsoTimestamp(raw["submittedAt"])) return invalid("submission has an invalid timestamp");

  const reviewStatus = raw["reviewStatus"];
  const reviewedAt = raw["reviewedAt"];
  if (!isReviewStatus(reviewStatus)) return invalid("submission has an invalid review status");
  if (reviewStatus === "awaiting-review" && reviewedAt !== null) {
    return invalid("an awaiting submission cannot have a review timestamp");
  }
  if (reviewStatus === "approved" && !isIsoTimestamp(reviewedAt)) {
    return invalid("an approved submission requires a review timestamp");
  }

  const rawFiles = raw["files"];
  if (!Array.isArray(rawFiles)) return invalid("submission files are not an array");
  if (rawFiles.length !== CAFE_PROJECT_REQUIRED_FILES.length) {
    return invalid("submission does not contain all required files");
  }

  const files: CafeSubmittedFile[] = [];
  for (const [index, rawFile] of rawFiles.entries()) {
    if (!isRecord(rawFile)) return invalid(`submitted file ${index} is not an object`);
    const name = rawFile["name"];
    const content = rawFile["content"];
    const fingerprint = rawFile["fingerprint"];
    if (name !== CAFE_PROJECT_REQUIRED_FILES[index]) {
      return invalid("submitted files are not in canonical order");
    }
    if (typeof content !== "string") return invalid(`submitted file ${index} has invalid content`);
    if (fingerprint !== cafeSubmittedFileFingerprint(content)) {
      return invalid(`submitted file ${index} has a mismatched fingerprint`);
    }
    files.push({ name: name as CafeProjectRequiredFile, content, fingerprint });
  }

  const readme = files.find((file) => file.name === "README.md")?.content;
  const calculator = files.find((file) => file.name === "calculator.py")?.content;
  const main = files.find((file) => file.name === "main.py")?.content;
  if (readme === undefined || calculator === undefined || main === undefined) {
    return invalid("submission is missing executable project files");
  }

  const projectFingerprint = raw["projectFingerprint"];
  if (projectFingerprint !== cafeProjectFingerprint({ readme, calculator, main })) {
    return invalid("submission has a mismatched project fingerprint");
  }

  return {
    ok: true,
    record: {
      jobId: CAFE_CALCULATOR_JOB_ID,
      submissionId: raw["submissionId"] as string,
      submittedAt: raw["submittedAt"] as string,
      files,
      projectFingerprint: projectFingerprint as string,
      reviewStatus,
      reviewedAt: reviewedAt as string | null,
    },
  };
}

/** Validate untrusted IndexedDB data before it can become submission state. */
export function validateCafeSubmissionSaveRecord(raw: unknown): CafeSubmissionValidationResult {
  // A missing record is a valid empty save for a fresh installation.
  if (raw === undefined || raw === null) return { ok: true, record: null };
  if (!isRecord(raw)) return invalid("save record is not an object");
  if (raw["version"] !== CAFE_SUBMISSION_SAVE_VERSION) {
    return invalid("unsupported save version");
  }

  const submission = raw["submission"];
  if (submission === undefined || submission === null) return { ok: true, record: null };
  return validateRecord(submission);
}

/** Record Alex Morgan's deterministic approval without touching the snapshot. */
export function approveCafeSubmission(
  record: CafeSubmissionRecord,
  reviewedAt: string = new Date().toISOString(),
): CafeSubmissionRecord | null {
  if (!isIsoTimestamp(reviewedAt)) return null;
  if (record.reviewStatus === "approved") return copyRecord(record);
  return {
    ...copyRecord(record),
    reviewStatus: "approved",
    reviewedAt,
  };
}

/** Read one captured file by name from a submitted snapshot. */
export function cafeSubmittedFile(
  record: CafeSubmissionRecord,
  name: CafeProjectRequiredFile,
): string | undefined {
  return record.files.find((file) => file.name === name)?.content;
}
