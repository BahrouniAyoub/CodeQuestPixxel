/**
 * GigBoard café application model.
 *
 * This module is pure: it contains the application types, proposal validation,
 * the persisted save envelope, and the deterministic scripted client response.
 * IndexedDB and Zustand live in `gigboardApplicationStore.ts`.
 */
import { CAFE_CALCULATOR_JOB_ID } from "./gigboardJobs";

export const GIGBOARD_APPLICATION_VERSION = 1;

export const GIGBOARD_PROPOSAL_MIN_LENGTH = 40;
export const GIGBOARD_PROPOSAL_MAX_LENGTH = 1200;

/** The exact, deterministic message the player receives from Alex Morgan. */
export const ALEX_ACCEPTANCE_MESSAGE =
  "Hi! Thanks for applying. Your proposal looks promising. I'd like to hire you for the café order calculator project. Let's get started!";

export type GigboardApplicationStatus = "submitted" | "accepted";

export interface GigboardApplication {
  readonly jobId: typeof CAFE_CALCULATOR_JOB_ID;
  readonly proposal: string;
  readonly status: GigboardApplicationStatus;
  /** ISO timestamp of the successful application save. */
  readonly submittedAt: string;
  /** ISO timestamp of the scripted acceptance save, or null while pending. */
  readonly acceptedAt: string | null;
  /** Scripted client message, or null while the response is pending. */
  readonly acceptanceMessage: string | null;
}

export interface GigboardApplicationSaveRecord {
  version: typeof GIGBOARD_APPLICATION_VERSION;
  application: GigboardApplication;
}

export type ProposalValidationResult =
  { ok: true; proposal: string } | { ok: false; reason: string };

export type GigboardApplicationValidationResult =
  { ok: true; application: GigboardApplication } | { ok: false; reason: string };

/** Informational only: no milestone is completed in this step. */
export const CAFE_PROJECT_MILESTONES = [
  {
    id: "variables-print",
    title: "Variables and print",
    description: "Store an order in Python variables and print a readable receipt.",
  },
  {
    id: "arithmetic-functions",
    title: "Arithmetic and functions",
    description: "Calculate subtotals and totals with reusable functions.",
  },
  {
    id: "conditional-discounts",
    title: "Conditional discounts",
    description: "Apply a discount only when the order qualifies for it.",
  },
] as const;

function invalid(reason: string): GigboardApplicationValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isApplicationStatus(value: unknown): value is GigboardApplicationStatus {
  return value === "submitted" || value === "accepted";
}

/**
 * Normalize and validate proposal text before it can be saved.
 * Newlines are preserved; surrounding whitespace is trimmed.
 */
export function validateProposal(input: string): ProposalValidationResult {
  const proposal = input.replace(/\r\n/g, "\n").trim();
  if (proposal.length === 0) {
    return { ok: false, reason: "Write a proposal before submitting your application." };
  }
  if (proposal.length < GIGBOARD_PROPOSAL_MIN_LENGTH) {
    const remaining = GIGBOARD_PROPOSAL_MIN_LENGTH - proposal.length;
    return {
      ok: false,
      reason: `Your proposal is too short. Add ${remaining} more character${remaining === 1 ? "" : "s"} (minimum ${GIGBOARD_PROPOSAL_MIN_LENGTH}).`,
    };
  }
  if (proposal.length > GIGBOARD_PROPOSAL_MAX_LENGTH) {
    return {
      ok: false,
      reason: `Your proposal is too long. Keep it under ${GIGBOARD_PROPOSAL_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, proposal };
}

/** Copy an application into the persisted envelope without retaining caller arrays. */
export function createApplicationSaveRecord(
  application: GigboardApplication,
): GigboardApplicationSaveRecord {
  return {
    version: GIGBOARD_APPLICATION_VERSION,
    application: {
      jobId: CAFE_CALCULATOR_JOB_ID,
      proposal: application.proposal,
      status: application.status,
      submittedAt: application.submittedAt,
      acceptedAt: application.acceptedAt,
      acceptanceMessage: application.acceptanceMessage,
    },
  };
}

/**
 * Validate untrusted IndexedDB data before it can become GigBoard state.
 * Only the café project is supported, and the status metadata must be
 * internally consistent so an acceptance cannot be faked through storage.
 */
export function validateApplicationSaveRecord(raw: unknown): GigboardApplicationValidationResult {
  if (!isRecord(raw)) return invalid("save record is not an object");
  if (raw["version"] !== GIGBOARD_APPLICATION_VERSION) {
    return invalid("unsupported save version");
  }

  const value = raw["application"];
  if (!isRecord(value)) return invalid("application is not an object");

  if (value["jobId"] !== CAFE_CALCULATOR_JOB_ID) {
    return invalid("application does not belong to the café calculator project");
  }

  const proposalResult = validateProposal(
    typeof value["proposal"] === "string" ? value["proposal"] : "",
  );
  if (!proposalResult.ok) return invalid(proposalResult.reason);

  const status = value["status"];
  if (!isApplicationStatus(status)) return invalid("application status is not valid");

  const submittedAt = value["submittedAt"];
  if (!isIsoTimestamp(submittedAt)) return invalid("submittedAt is not a valid timestamp");

  const acceptedAt = value["acceptedAt"];
  const acceptanceMessage = value["acceptanceMessage"];

  if (status === "submitted") {
    if (acceptedAt !== null) return invalid("a submitted application cannot have acceptedAt");
    if (acceptanceMessage !== null) {
      return invalid("a submitted application cannot have an acceptance message");
    }
  } else {
    if (!isIsoTimestamp(acceptedAt)) return invalid("acceptedAt is not a valid timestamp");
    if (acceptanceMessage !== ALEX_ACCEPTANCE_MESSAGE) {
      return invalid("acceptance message is not the scripted client response");
    }
  }

  return {
    ok: true,
    application: {
      jobId: CAFE_CALCULATOR_JOB_ID,
      proposal: proposalResult.proposal,
      status,
      submittedAt,
      acceptedAt: status === "accepted" ? (acceptedAt as string) : null,
      acceptanceMessage: status === "accepted" ? ALEX_ACCEPTANCE_MESSAGE : null,
    },
  };
}
