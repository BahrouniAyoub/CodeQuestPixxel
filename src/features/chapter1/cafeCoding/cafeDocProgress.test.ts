import { describe, expect, it } from "vitest";
import {
  applyCafeDeliveryCheck,
  applyCafeDocumentationVerification,
  createCafeDocSaveRecord,
  initialCafeDocProgress,
  isCafeDeliveryReady,
  isCafeDocumentationVerified,
  validateCafeDocSaveRecord,
  type CafeDocProgress,
} from "./cafeDocProgress";

const VERIFIED_AT = "2026-01-02T09:00:00.000Z";
const CHECKED_AT = "2026-01-02T10:00:00.000Z";

function verifiedProgress(signature = "readme-1"): CafeDocProgress {
  return applyCafeDocumentationVerification(initialCafeDocProgress, signature, VERIFIED_AT);
}

function readyProgress(signature = "readme-1"): CafeDocProgress {
  return applyCafeDeliveryCheck(verifiedProgress(signature), {
    passed: true,
    projectSignature: "project-1",
    checkedAt: CHECKED_AT,
  });
}

describe("café documentation progress", () => {
  it("records a README verification without granting delivery readiness", () => {
    const progress = verifiedProgress();

    expect(isCafeDocumentationVerified(progress)).toBe(true);
    expect(progress.documentation.verifiedAt).toBe(VERIFIED_AT);
    expect(progress.documentation.readmeSignature).toBe("readme-1");
    expect(progress.delivery.finalCheckPassed).toBe(false);
    expect(isCafeDeliveryReady(progress)).toBe(false);
  });

  it("requires a verified README and a matching final check for readiness", () => {
    expect(isCafeDeliveryReady(verifiedProgress())).toBe(false);

    const ready = readyProgress();
    expect(ready.delivery.finalCheckPassed).toBe(true);
    expect(ready.delivery.projectSignature).toBe("project-1");
    expect(isCafeDeliveryReady(ready)).toBe(true);
  });

  it("keeps the final check when the same README is verified again", () => {
    const ready = readyProgress();
    const reverified = applyCafeDocumentationVerification(
      ready,
      "readme-1",
      "2026-01-02T11:00:00.000Z",
    );

    expect(reverified).toBe(ready);
    expect(isCafeDeliveryReady(reverified)).toBe(true);
  });

  it("invalidates the final check when the README content changes", () => {
    const changed = applyCafeDocumentationVerification(
      readyProgress("readme-1"),
      "readme-2",
      "2026-01-02T11:00:00.000Z",
    );

    expect(changed.documentation.readmeSignature).toBe("readme-2");
    expect(changed.delivery.finalCheckPassed).toBe(false);
    expect(changed.delivery.projectSignature).toBeNull();
    expect(isCafeDeliveryReady(changed)).toBe(false);
  });

  it("clears readiness when a later final check fails", () => {
    const failed = applyCafeDeliveryCheck(readyProgress(), {
      passed: false,
      projectSignature: null,
      checkedAt: "2026-01-02T12:00:00.000Z",
    });

    expect(failed.delivery.finalCheckPassed).toBe(false);
    expect(failed.delivery.checkedAt).toBe("2026-01-02T12:00:00.000Z");
    expect(failed.delivery.projectSignature).toBeNull();
    expect(isCafeDeliveryReady(failed)).toBe(false);
  });

  it("never stores a passed check without a project signature", () => {
    const progress = verifiedProgress();
    const next = applyCafeDeliveryCheck(progress, {
      passed: true,
      projectSignature: null,
      checkedAt: CHECKED_AT,
    });

    expect(next).toBe(progress);
    expect(isCafeDeliveryReady(next)).toBe(false);
  });

  it("wraps progress in a versioned, untrusted-input-safe save record", () => {
    const record = createCafeDocSaveRecord(readyProgress());
    const result = validateCafeDocSaveRecord(record);

    expect(record.version).toBe(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.progress.documentation.readmeSignature).toBe("readme-1");
      expect(result.progress.delivery.finalCheckPassed).toBe(true);
      expect(isCafeDeliveryReady(result.progress)).toBe(true);
    }
  });

  it("rejects invalid saved data instead of guessing", () => {
    expect(validateCafeDocSaveRecord(null).ok).toBe(false);
    expect(validateCafeDocSaveRecord({ version: 99, progress: {} }).ok).toBe(false);
    expect(
      validateCafeDocSaveRecord({
        version: 1,
        progress: {
          documentation: { verifiedAt: "not-a-date", readmeSignature: "x" },
          delivery: { finalCheckPassed: false, checkedAt: null, projectSignature: null },
        },
      }).ok,
    ).toBe(false);
    expect(
      validateCafeDocSaveRecord({
        version: 1,
        progress: {
          documentation: { verifiedAt: null, readmeSignature: null },
          delivery: {
            finalCheckPassed: true,
            checkedAt: CHECKED_AT,
            projectSignature: null,
          },
        },
      }).ok,
    ).toBe(false);
  });
});
