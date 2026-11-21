/**
 * Pure, versioned progress for café documentation and delivery checks.
 *
 * This record is separate from the development task record, the legacy
 * milestone record, Chapter 1 progress, and GigBoard applications. It never
 * grants XP or money and never completes a quest. Signatures let the UI detect
 * when the README or the Python files changed after a successful check.
 */

export const CAFE_DOC_SAVE_VERSION = 1;

export interface CafeDocumentationState {
  /** ISO timestamp of the successful README verification. */
  readonly verifiedAt: string | null;
  /** Content signature of the README that passed verification. */
  readonly readmeSignature: string | null;
}

export interface CafeDeliveryRecord {
  readonly finalCheckPassed: boolean;
  /** ISO timestamp of the latest final project check. */
  readonly checkedAt: string | null;
  /** Signature of README.md + calculator.py + main.py at the successful check. */
  readonly projectSignature: string | null;
}

export interface CafeDocProgress {
  readonly documentation: CafeDocumentationState;
  readonly delivery: CafeDeliveryRecord;
}

export interface CafeDocSaveRecord {
  readonly version: typeof CAFE_DOC_SAVE_VERSION;
  readonly progress: CafeDocProgress;
}

export const initialCafeDocProgress: CafeDocProgress = {
  documentation: { verifiedAt: null, readmeSignature: null },
  delivery: { finalCheckPassed: false, checkedAt: null, projectSignature: null },
};

export type CafeDocProgressValidationResult =
  { ok: true; progress: CafeDocProgress } | { ok: false; reason: string };

function invalid(reason: string): CafeDocProgressValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isSignature(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function copyProgress(progress: CafeDocProgress): CafeDocProgress {
  return {
    documentation: { ...progress.documentation },
    delivery: { ...progress.delivery },
  };
}

/**
 * Record a successful README verification. A changed README invalidates any
 * previous final check because the delivery signature no longer describes the
 * saved project. Re-verifying identical content keeps an existing final check.
 */
export function applyCafeDocumentationVerification(
  progress: CafeDocProgress,
  readmeSignature: string,
  verifiedAt: string = new Date().toISOString(),
): CafeDocProgress {
  if (!isSignature(readmeSignature) || !isIsoTimestamp(verifiedAt)) return progress;

  const sameSignature = progress.documentation.readmeSignature === readmeSignature;
  if (sameSignature && progress.documentation.verifiedAt) return progress;

  return {
    documentation: { verifiedAt, readmeSignature },
    delivery: sameSignature ? { ...progress.delivery } : { ...initialCafeDocProgress.delivery },
  };
}

export interface CafeDeliveryRecordInput {
  readonly passed: boolean;
  readonly projectSignature: string | null;
  readonly checkedAt: string;
}

/**
 * Persist the result of a final project check. A failed check always clears the
 * passed flag so the UI cannot keep claiming delivery readiness.
 */
export function applyCafeDeliveryCheck(
  progress: CafeDocProgress,
  input: CafeDeliveryRecordInput,
): CafeDocProgress {
  if (!isIsoTimestamp(input.checkedAt)) return progress;

  if (!input.passed) {
    return {
      documentation: { ...progress.documentation },
      delivery: {
        finalCheckPassed: false,
        checkedAt: input.checkedAt,
        projectSignature: null,
      },
    };
  }

  if (!isSignature(input.projectSignature)) return progress;

  return {
    documentation: { ...progress.documentation },
    delivery: {
      finalCheckPassed: true,
      checkedAt: input.checkedAt,
      projectSignature: input.projectSignature,
    },
  };
}

export function isCafeDocumentationVerified(progress: CafeDocProgress): boolean {
  return (
    progress.documentation.verifiedAt !== null && progress.documentation.readmeSignature !== null
  );
}

export function isCafeDeliveryReady(progress: CafeDocProgress): boolean {
  return (
    isCafeDocumentationVerified(progress) &&
    progress.delivery.finalCheckPassed &&
    progress.delivery.projectSignature !== null
  );
}

/** Copy progress into the persisted envelope without retaining caller objects. */
export function createCafeDocSaveRecord(progress: CafeDocProgress): CafeDocSaveRecord {
  return {
    version: CAFE_DOC_SAVE_VERSION,
    progress: copyProgress(progress),
  };
}

/** Validate untrusted IndexedDB data before it can become documentation state. */
export function validateCafeDocSaveRecord(raw: unknown): CafeDocProgressValidationResult {
  if (!isRecord(raw)) return invalid("save record is not an object");
  if (raw["version"] !== CAFE_DOC_SAVE_VERSION) {
    return invalid("unsupported save version");
  }

  const value = raw["progress"];
  if (!isRecord(value)) return invalid("progress is not an object");

  const documentation = value["documentation"];
  if (!isRecord(documentation)) return invalid("documentation is not an object");

  const verifiedAt = documentation["verifiedAt"];
  const readmeSignature = documentation["readmeSignature"];
  if (verifiedAt === null && readmeSignature === null) {
    // Not verified yet: valid initial state.
  } else if (!isIsoTimestamp(verifiedAt) || !isSignature(readmeSignature)) {
    return invalid("documentation verification fields are inconsistent");
  }

  const delivery = value["delivery"];
  if (!isRecord(delivery)) return invalid("delivery is not an object");

  const finalCheckPassed = delivery["finalCheckPassed"];
  if (typeof finalCheckPassed !== "boolean") return invalid("finalCheckPassed is not a boolean");

  const checkedAt = delivery["checkedAt"];
  if (checkedAt !== null && !isIsoTimestamp(checkedAt)) {
    return invalid("checkedAt is not a valid timestamp");
  }

  const projectSignature = delivery["projectSignature"];
  if (projectSignature !== null && !isSignature(projectSignature)) {
    return invalid("projectSignature is not a valid signature");
  }

  if (finalCheckPassed && (checkedAt === null || projectSignature === null)) {
    return invalid("a passed final check requires a timestamp and project signature");
  }

  return {
    ok: true,
    progress: {
      documentation: {
        verifiedAt: verifiedAt as string | null,
        readmeSignature: readmeSignature as string | null,
      },
      delivery: {
        finalCheckPassed,
        checkedAt: checkedAt as string | null,
        projectSignature: projectSignature as string | null,
      },
    },
  };
}
