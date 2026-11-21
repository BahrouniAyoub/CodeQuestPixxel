/**
 * CodeQuest Mail data model.
 *
 * This module is pure: it contains the versioned persisted envelope, the mail
 * message types, and validation for untrusted IndexedDB data. IndexedDB and
 * Zustand live in `mailPersistence.ts` and `mailStore.ts`.
 *
 * Mail reuses the existing `chat` object store under an isolated key so the
 * database schema never has to change.
 */
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";

export const MAIL_VERSION = 1;

/** Reuse the existing chat store; the key keeps mail separate from team chat. */
export const MAIL_STORAGE_STORE = "chat";
export const MAIL_STORAGE_KEY = "mail-state";

export const MAIL_MAX_MESSAGE_LENGTH = 2000;
export const MAIL_MAX_SUBJECT_LENGTH = 160;

/** Stable project/thread identifiers. The project ID matches GigBoard exactly. */
export const CAFE_MAIL_PROJECT_ID = CAFE_CALCULATOR_JOB_ID;
export const CAFE_MAIL_THREAD_ID = "cafe-calculator-thread";
export const CAFE_WELCOME_MESSAGE_ID = "mail-cafe-welcome";

export const PLAYER_PARTY = {
  name: "You",
  address: "you@codequest.dev",
} as const;

export const ALEX_PARTY = {
  name: "Alex Morgan",
  address: "alex.morgan@morgancafe.example",
} as const;

export const MAIL_SCRIPTED_RESPONSE_KINDS = [
  "discount",
  "prices",
  "receipt",
  "deadline",
  "testing",
  "approval",
  "payment",
  "fallback",
] as const;

export type MailScriptedResponseKind = (typeof MAIL_SCRIPTED_RESPONSE_KINDS)[number];

export type MailDirection = "incoming" | "outgoing";

export interface MailParty {
  readonly name: string;
  readonly address: string;
}

export interface MailMessage {
  /** Unique, stable message ID. Scripted replies derive theirs from the outgoing ID. */
  readonly id: string;
  readonly threadId: string;
  readonly from: MailParty;
  readonly to: MailParty;
  readonly subject: string;
  readonly body: string;
  /** ISO timestamp. Used to sort conversations deterministically. */
  readonly createdAt: string;
  readonly read: boolean;
  readonly direction: MailDirection;
  /** Present for project-related mail. */
  readonly projectId?: string;
  /** Present on deterministic scripted client replies. */
  readonly scriptedResponseKind?: MailScriptedResponseKind;
  /** Set on a scripted reply so it can never be created twice. */
  readonly inReplyTo?: string;
}

export interface MailSaveRecord {
  readonly version: typeof MAIL_VERSION;
  readonly messages: readonly MailMessage[];
}

export type MailValidationResult =
  { ok: true; messages: MailMessage[] } | { ok: false; reason: string };

export type MailBodyValidationResult = { ok: true; body: string } | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isParty(value: unknown): value is MailParty {
  if (!isRecord(value)) return false;
  return (
    typeof value["name"] === "string" &&
    value["name"].trim().length > 0 &&
    typeof value["address"] === "string" &&
    value["address"].trim().length > 0
  );
}

function isDirection(value: unknown): value is MailDirection {
  return value === "incoming" || value === "outgoing";
}

function isScriptedKind(value: unknown): value is MailScriptedResponseKind {
  return (
    typeof value === "string" && (MAIL_SCRIPTED_RESPONSE_KINDS as readonly string[]).includes(value)
  );
}

function normalizeParty(party: MailParty): MailParty {
  return { name: party.name.trim(), address: party.address.trim() };
}

/** Deterministic conversation ordering: oldest first, ties broken by ID. */
export function compareMailMessages(a: MailMessage, b: MailMessage): number {
  const time = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (time !== 0) return time;
  return a.id.localeCompare(b.id);
}

export function sortMailMessages(messages: readonly MailMessage[]): MailMessage[] {
  return [...messages].sort(compareMailMessages);
}

export function unreadMailCount(messages: readonly MailMessage[]): number {
  return messages.filter((message) => message.direction === "incoming" && !message.read).length;
}

/** Normalize and validate reply text before it can be saved. */
export function validateMailBody(input: string): MailBodyValidationResult {
  const body = input.replace(/\r\n/g, "\n").trim();
  if (body.length === 0) {
    return { ok: false, reason: "Write a message before sending." };
  }
  if (body.length > MAIL_MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      reason: `Your message is too long. Keep it under ${MAIL_MAX_MESSAGE_LENGTH} characters.`,
    };
  }
  return { ok: true, body };
}

function validateMessage(raw: unknown, index: number): MailMessage | string {
  if (!isRecord(raw)) return `message ${index} is not an object`;

  const id = raw["id"];
  const threadId = raw["threadId"];
  if (!isNonEmptyString(id, 200)) return `message ${index} has an invalid id`;
  if (!isNonEmptyString(threadId, 200)) return `message ${index} has an invalid thread id`;

  const from = raw["from"];
  const to = raw["to"];
  if (!isParty(from)) return `message ${index} has an invalid sender`;
  if (!isParty(to)) return `message ${index} has an invalid recipient`;

  const subject = raw["subject"];
  if (typeof subject !== "string" || subject.length > MAIL_MAX_SUBJECT_LENGTH) {
    return `message ${index} has an invalid subject`;
  }

  const body = raw["body"];
  if (!isNonEmptyString(body, MAIL_MAX_MESSAGE_LENGTH)) {
    return `message ${index} has an invalid body`;
  }

  const createdAt = raw["createdAt"];
  if (!isIsoTimestamp(createdAt)) return `message ${index} has an invalid timestamp`;

  const read = raw["read"];
  if (typeof read !== "boolean") return `message ${index} has an invalid read state`;

  const direction = raw["direction"];
  if (!isDirection(direction)) return `message ${index} has an invalid direction`;

  const projectId = raw["projectId"];
  if (projectId !== undefined && !isNonEmptyString(projectId, 200)) {
    return `message ${index} has an invalid project id`;
  }

  const scriptedResponseKind = raw["scriptedResponseKind"];
  if (scriptedResponseKind !== undefined && !isScriptedKind(scriptedResponseKind)) {
    return `message ${index} has an invalid scripted response kind`;
  }

  const inReplyTo = raw["inReplyTo"];
  if (inReplyTo !== undefined && !isNonEmptyString(inReplyTo, 200)) {
    return `message ${index} has an invalid reply target`;
  }

  return {
    id,
    threadId,
    from: normalizeParty(from),
    to: normalizeParty(to),
    subject,
    body,
    createdAt,
    read,
    direction,
    ...(projectId !== undefined ? { projectId } : {}),
    ...(scriptedResponseKind !== undefined ? { scriptedResponseKind } : {}),
    ...(inReplyTo !== undefined ? { inReplyTo } : {}),
  };
}

export function createMailSaveRecord(messages: readonly MailMessage[]): MailSaveRecord {
  return { version: MAIL_VERSION, messages: sortMailMessages(messages) };
}

/**
 * Validate an untrusted persisted record before it can become Mail state.
 * Duplicate message IDs are rejected because they would make scripted response
 * deduplication unreliable.
 */
export function validateMailSaveRecord(raw: unknown): MailValidationResult {
  if (!isRecord(raw)) return { ok: false, reason: "save record is not an object" };
  if (raw["version"] !== MAIL_VERSION) {
    return { ok: false, reason: "unsupported save version" };
  }

  const rawMessages = raw["messages"];
  if (!Array.isArray(rawMessages)) return { ok: false, reason: "messages is not an array" };

  const messages: MailMessage[] = [];
  const ids = new Set<string>();

  for (let index = 0; index < rawMessages.length; index += 1) {
    const result = validateMessage(rawMessages[index], index);
    if (typeof result === "string") return { ok: false, reason: result };
    if (ids.has(result.id)) return { ok: false, reason: `duplicate message id: ${result.id}` };
    ids.add(result.id);
    messages.push(result);
  }

  return { ok: true, messages: sortMailMessages(messages) };
}
