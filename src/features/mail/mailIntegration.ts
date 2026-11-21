/**
 * Idempotent Mail ↔ GigBoard integration.
 *
 * Rendering Mail must never create side effects. This helper is called from
 * safe hydration points (the Pixel OS boot sequence and the Mail app mount) and
 * can be retried freely: the welcome message has a stable ID.
 */
import type { GigboardApplication } from "@/features/browser/data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import {
  ALEX_PARTY,
  CAFE_MAIL_PROJECT_ID,
  CAFE_MAIL_THREAD_ID,
  CAFE_WELCOME_MESSAGE_ID,
  PLAYER_PARTY,
  type MailMessage,
} from "./mailTypes";
import { useMail, type MailEnsureResult, type MailStore } from "./mailStore";

export const CAFE_WELCOME_SUBJECT = "Welcome to the Café Calculator Project";

export const CAFE_WELCOME_BODY = `Hi,

I'm glad you're joining this project!

We need a simple Python program for our café.

Coffee costs $3 and sandwiches cost $5.

The program should calculate order totals, apply a 10% discount for subtotals of $20 or more, and print a clear receipt.

It should also handle invalid quantities safely.

Please organize your project files and write a short development plan before starting implementation.

Looking forward to working with you!

Alex Morgan`;

export type CafeWelcomeSyncResult = { ok: true; created: boolean } | { ok: false; reason: string };

interface ApplicationStoreLike {
  getState: () => Pick<
    ReturnType<typeof useGigboardApplication.getState>,
    "application" | "hydrated" | "error" | "hydrate"
  >;
}

interface MailStoreLike {
  getState: () => Pick<MailStore, "messages" | "hydrated" | "error" | "hydrate" | "ensureMessage">;
}

export interface CafeWelcomeSyncOptions {
  applicationStore?: ApplicationStoreLike;
  mailStore?: MailStoreLike;
  now?: () => Date;
}

export function isCafeApplicationAccepted(
  application: GigboardApplication | null | undefined,
): boolean {
  return application?.status === "accepted" && application.jobId === CAFE_CALCULATOR_JOB_ID;
}

export function createCafeWelcomeMessage(createdAt: string): MailMessage {
  return {
    id: CAFE_WELCOME_MESSAGE_ID,
    threadId: CAFE_MAIL_THREAD_ID,
    from: ALEX_PARTY,
    to: PLAYER_PARTY,
    subject: CAFE_WELCOME_SUBJECT,
    body: CAFE_WELCOME_BODY,
    createdAt,
    read: false,
    direction: "incoming",
    projectId: CAFE_MAIL_PROJECT_ID,
  };
}

/** True only when the accepted café application exists and mail lacks its welcome. */
export function shouldCreateCafeWelcomeEmail(
  application: GigboardApplication | null | undefined,
  messages: readonly MailMessage[],
): boolean {
  if (!isCafeApplicationAccepted(application)) return false;
  return !messages.some((message) => message.id === CAFE_WELCOME_MESSAGE_ID);
}

export async function syncCafeWelcomeEmail(
  options: CafeWelcomeSyncOptions = {},
): Promise<CafeWelcomeSyncResult> {
  const applicationStore = options.applicationStore ?? useGigboardApplication;
  const mailStore = options.mailStore ?? useMail;

  await applicationStore.getState().hydrate();
  await mailStore.getState().hydrate();

  if (!applicationStore.getState().hydrated) {
    return {
      ok: false,
      reason:
        applicationStore.getState().error ??
        "Your GigBoard application could not be loaded, so Mail was not synchronized.",
    };
  }

  if (!mailStore.getState().hydrated) {
    return {
      ok: false,
      reason:
        mailStore.getState().error ??
        "Mail could not be loaded, so the welcome email was not created.",
    };
  }

  const application = applicationStore.getState().application;
  if (!shouldCreateCafeWelcomeEmail(application, mailStore.getState().messages)) {
    return { ok: true, created: false };
  }

  const createdAt = (options.now?.() ?? new Date()).toISOString();
  const result: MailEnsureResult = await mailStore
    .getState()
    .ensureMessage(createCafeWelcomeMessage(createdAt));

  return result.ok ? { ok: true, created: result.created } : { ok: false, reason: result.reason };
}
