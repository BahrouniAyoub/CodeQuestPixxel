import { describe, expect, it } from "vitest";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  CAFE_SUBMISSION_SAVE_VERSION,
  approveCafeSubmission,
  cafeSubmittedFile,
  cafeSubmittedFileFingerprint,
  createCafeSubmissionRecord,
  createCafeSubmissionSaveRecord,
  validateCafeSubmissionSaveRecord,
  type CafeSubmissionRecord,
} from "./cafeSubmission";

const FILES = {
  "PLAN.md": "Build the calculator, then verify it.",
  "calculator.py": "def calculate_total(c, s):\n    return c * 3 + s * 5\n",
  "main.py": "from calculator import calculate_total\nprint(calculate_total(2, 3))\n",
  "README.md": "# Café Order Calculator\nCoffee $3, sandwich $5, 10% off at $20.\n",
} as const;

function fileInput() {
  return (Object.keys(FILES) as (keyof typeof FILES)[]).map((name) => ({
    name,
    content: FILES[name],
  }));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withChangedContent(record: CafeSubmissionRecord, index: number, content: string) {
  const raw = clone(record) as unknown as { files: { content: string }[] };
  raw.files[index]!.content = content;
  return raw;
}

function makeRecord(): CafeSubmissionRecord {
  const record = createCafeSubmissionRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: "sub-test-1",
    submittedAt: "2026-01-02T12:00:00.000Z",
    files: fileInput(),
  });
  if (!record) throw new Error("test fixture record was rejected");
  return record;
}

describe("café submission record", () => {
  it("captures all four files with per-file and overall fingerprints", () => {
    const record = makeRecord();

    expect(record.files.map((file) => file.name)).toEqual([
      "PLAN.md",
      "calculator.py",
      "main.py",
      "README.md",
    ]);
    expect(record.projectFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(record.reviewStatus).toBe("awaiting-review");
    expect(record.reviewedAt).toBeNull();
    for (const file of record.files) {
      expect(file.fingerprint).toBe(cafeSubmittedFileFingerprint(file.content));
    }
    expect(cafeSubmittedFile(record, "main.py")).toBe(FILES["main.py"]);
  });

  it("does not retain caller objects and survives a versioned envelope round trip", () => {
    const inputFiles = fileInput();
    const record = createCafeSubmissionRecord({
      jobId: CAFE_CALCULATOR_JOB_ID,
      submissionId: "sub-test-2",
      submittedAt: "2026-01-02T12:00:00.000Z",
      files: inputFiles,
    });
    if (!record) throw new Error("test fixture record was rejected");

    inputFiles[0]!.content = "changed after submission";
    expect(cafeSubmittedFile(record, "PLAN.md")).toBe(FILES["PLAN.md"]);

    const envelope = clone(createCafeSubmissionSaveRecord(record)) as unknown as {
      submission: { files: { content: string }[] } | null;
    };
    if (!envelope.submission) throw new Error("missing saved submission");
    envelope.submission.files[0]!.content = "tampered";
    expect(cafeSubmittedFile(record, "PLAN.md")).toBe(FILES["PLAN.md"]);

    envelope.submission.files[0]!.content = FILES["PLAN.md"];
    const result = validateCafeSubmissionSaveRecord(envelope);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record?.projectFingerprint).toBe(record.projectFingerprint);
  });

  it("accepts an empty save and rejects unsupported versions or missing records", () => {
    expect(validateCafeSubmissionSaveRecord(undefined)).toEqual({ ok: true, record: null });
    expect(
      validateCafeSubmissionSaveRecord({
        version: CAFE_SUBMISSION_SAVE_VERSION + 1,
        submission: null,
      }).ok,
    ).toBe(false);
    expect(
      validateCafeSubmissionSaveRecord({
        version: CAFE_SUBMISSION_SAVE_VERSION,
        submission: {},
      }).ok,
    ).toBe(false);
  });

  it("rejects tampered snapshots, wrong jobs, and invalid review fields", () => {
    const record = makeRecord();
    const envelope = (submission: unknown) => ({
      version: CAFE_SUBMISSION_SAVE_VERSION,
      submission,
    });

    const wrongJob = validateCafeSubmissionSaveRecord(
      envelope({ ...record, jobId: "GB-9999" }),
    );
    expect(wrongJob.ok).toBe(false);

    expect(validateCafeSubmissionSaveRecord(envelope(withChangedContent(record, 1, "print(1)"))).ok).toBe(
      false,
    );

    const tamperedFingerprint = { ...record, projectFingerprint: "deadbeef" };
    expect(validateCafeSubmissionSaveRecord(envelope(tamperedFingerprint)).ok).toBe(false);

    const badReview = validateCafeSubmissionSaveRecord(
      envelope({ ...record, reviewStatus: "approved", reviewedAt: null }),
    );
    expect(badReview.ok).toBe(false);
  });

  it("transitions only the lifecycle fields when approving", () => {
    const record = makeRecord();
    const approved = approveCafeSubmission(record, "2026-01-02T13:00:00.000Z");
    expect(approved).not.toBeNull();
    if (!approved) return;

    expect(approved.reviewStatus).toBe("approved");
    expect(approved.reviewedAt).toBe("2026-01-02T13:00:00.000Z");
    expect(approved.files).toEqual(record.files);
    expect(approved.projectFingerprint).toBe(record.projectFingerprint);
    expect(record.reviewStatus).toBe("awaiting-review");

    const again = approveCafeSubmission(approved, "2026-01-03T00:00:00.000Z");
    expect(again?.reviewedAt).toBe("2026-01-02T13:00:00.000Z");
    expect(approveCafeSubmission(record, "not-a-date")).toBeNull();
  });
});
