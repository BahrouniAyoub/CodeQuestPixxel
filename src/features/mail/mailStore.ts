import { create } from "zustand";
import {
  ALEX_PARTY,
  CAFE_MAIL_PROJECT_ID,
  CAFE_MAIL_THREAD_ID,
  PLAYER_PARTY,
  createMailSaveRecord,
  sortMailMessages,
  validateMailBody,
  validateMailSaveRecord,
} from "./mailTypes";
import type { MailMessage } from "./mailTypes";
import { scriptedReplyFor } from "./mailScripts";
import { defaultMailPersistence, type MailPersistence } from "./mailPersistence";
import { notify } from "@/features/notifications/notificationStore";

export type MailSendResult =
  | {
      ok: true;
      message: MailMessage;
      response: MailMessage | null;
      responsePending: boolean;
    }
  | { ok: false; reason: string };

export type MailEnsureResult = { ok: true; created: boolean } | { ok: false; reason: string };

export interface MailStore {
  messages: MailMessage[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  sending: boolean;
  hydrate: () => Promise<void>;
  /** Idempotently add a message. Returns created=false when the ID already exists. */
  ensureMessage: (message: MailMessage) => Promise<MailEnsureResult>;
  /** Persist an outgoing reply before creating exactly one scripted response. */
  sendReply: (threadId: string, body: string) => Promise<MailSendResult>;
  markThreadRead: (threadId: string) => Promise<void>;
  /** Retries scripted replies that were not persisted after a partial failure. */
  retryPendingResponses: () => Promise<void>;
  clearError: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Stable ID for the one scripted reply that belongs to an outgoing message. */
export function scriptedResponseId(outgoingMessageId: string): string {
  return `mail-response-${outgoingMessageId}`;
}

function timestampAfter(iso: string): string {
  return new Date(Date.parse(iso) + 1).toISOString();
}

function nextTimestamp(messages: readonly MailMessage[]): string {
  const latest = messages.reduce((max, message) => Math.max(max, Date.parse(message.createdAt)), 0);
  return new Date(Math.max(Date.now(), latest + 1)).toISOString();
}

function createScriptedResponse(outgoing: MailMessage): MailMessage {
  const reply = scriptedReplyFor(outgoing.body);
  return {
    id: scriptedResponseId(outgoing.id),
    threadId: outgoing.threadId,
    from: ALEX_PARTY,
    to: PLAYER_PARTY,
    subject: outgoing.subject,
    body: reply.body,
    createdAt: timestampAfter(outgoing.createdAt),
    read: false,
    direction: "incoming",
    projectId: outgoing.projectId ?? CAFE_MAIL_PROJECT_ID,
    scriptedResponseKind: reply.kind,
    inReplyTo: outgoing.id,
  };
}

/**
 * Find outgoing café messages whose deterministic scripted response is missing.
 * This makes a partial two-write send safely retryable after reload.
 */
export function pendingScriptedResponses(messages: readonly MailMessage[]): MailMessage[] {
  const replyTargets = new Set(
    messages
      .filter((message) => message.inReplyTo !== undefined)
      .map((message) => message.inReplyTo as string),
  );

  return messages
    .filter(
      (message) =>
        message.direction === "outgoing" &&
        message.threadId === CAFE_MAIL_THREAD_ID &&
        (message.projectId === undefined || message.projectId === CAFE_MAIL_PROJECT_ID) &&
        !replyTargets.has(message.id) &&
        !messages.some((candidate) => candidate.id === scriptedResponseId(message.id)),
    )
    .map(createScriptedResponse);
}

function notifyIncoming(message: MailMessage): void {
  if (message.direction !== "incoming") return;
  notify({
    kind: "info",
    title: `New email from ${message.from.name}`,
    message: message.subject,
  });
}

/**
 * Store factory with injectable persistence for focused tests.
 * Production uses the shared `useMail` singleton below.
 */
export function createMailStore(persistence: MailPersistence = defaultMailPersistence) {
  let hydrationPromise: Promise<void> | null = null;
  let saveQueue: Promise<unknown> = Promise.resolve();
  let sequence = 0;

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = saveQueue.then(task);
    saveQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  function nextMessageId(): string {
    sequence += 1;
    return `mail-${Date.now().toString(36)}-${sequence.toString(36)}`;
  }

  return create<MailStore>((set, get) => {
    const persist = async (messages: readonly MailMessage[]): Promise<boolean> => {
      try {
        return await persistence.save(createMailSaveRecord(messages));
      } catch (error) {
        set({ error: `Could not save your mail: ${errorMessage(error)}` });
        return false;
      }
    };

    const repairPendingResponses = async (): Promise<void> => {
      if (!get().hydrated) return;
      const missing = pendingScriptedResponses(get().messages);
      if (missing.length === 0) return;

      const next = sortMailMessages([...get().messages, ...missing]);
      const saved = await persist(next);
      if (!saved) {
        set({
          error:
            "Your messages are saved, but one or more client replies could not be stored. Reload to retry.",
        });
        return;
      }

      set({ messages: next, error: null });
      missing.forEach(notifyIncoming);
    };

    const loadMail = async (): Promise<void> => {
      set({ loading: true, error: null });
      try {
        const raw = await persistence.load();
        if (raw === undefined) {
          set({ messages: [], hydrated: true });
          return;
        }

        const result = validateMailSaveRecord(raw);
        if (!result.ok) {
          set({
            messages: [],
            hydrated: true,
            error: `Saved mail was invalid and was not loaded: ${result.reason}. New messages can still be saved.`,
          });
          return;
        }

        set({ messages: result.messages, hydrated: true });
        await repairPendingResponses();
      } catch (error) {
        // Keep hydrated=false so a send cannot overwrite a record we failed to
        // read. hydrate() can be retried from the Mail app.
        set({
          hydrated: false,
          error: `Could not load your mail: ${errorMessage(error)}`,
        });
      } finally {
        set({ loading: false });
      }
    };

    return {
      messages: [],
      hydrated: false,
      loading: false,
      error: null,
      sending: false,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        if (!hydrationPromise) {
          hydrationPromise = loadMail().finally(() => {
            hydrationPromise = null;
          });
        }
        return hydrationPromise;
      },

      ensureMessage: (message) =>
        enqueue(async () => {
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason: "Saved mail could not be loaded. Try again before opening this conversation.",
            };
          }

          if (get().messages.some((existing) => existing.id === message.id)) {
            return { ok: true, created: false };
          }

          const next = sortMailMessages([...get().messages, message]);
          if (!(await persist(next))) {
            return { ok: false, reason: "The email could not be saved. Try again." };
          }

          set({ messages: next, error: null });
          notifyIncoming(message);
          return { ok: true, created: true };
        }),

      sendReply: (threadId, body) =>
        enqueue(async () => {
          await get().hydrate();
          if (!get().hydrated) {
            return {
              ok: false,
              reason: "Saved mail could not be loaded, so nothing was sent. Try again.",
            };
          }
          if (get().sending) {
            return { ok: false, reason: "Your previous message is still being saved." };
          }

          const validation = validateMailBody(body);
          if (!validation.ok) return { ok: false, reason: validation.reason };

          const threadMessages = get().messages.filter((message) => message.threadId === threadId);
          if (threadMessages.length === 0) {
            return { ok: false, reason: "This conversation could not be found." };
          }

          const first = threadMessages[0];
          if (!first) {
            return { ok: false, reason: "This conversation could not be found." };
          }
          const projectId = threadMessages.find(
            (message) => message.projectId !== undefined,
          )?.projectId;
          const outgoing: MailMessage = {
            id: nextMessageId(),
            threadId,
            from: PLAYER_PARTY,
            to: first.direction === "incoming" ? first.from : first.to,
            subject: /^re:\s/i.test(first.subject) ? first.subject : `Re: ${first.subject}`,
            body: validation.body,
            createdAt: nextTimestamp(get().messages),
            read: true,
            direction: "outgoing",
            ...(projectId !== undefined ? { projectId } : {}),
          };

          set({ sending: true, error: null });
          try {
            const afterOutgoing = sortMailMessages([...get().messages, outgoing]);
            if (!(await persist(afterOutgoing))) {
              return {
                ok: false,
                reason:
                  "Your message could not be saved, so it was not sent. Your draft is still here.",
              };
            }

            // The outgoing message is durable before the scripted reply exists.
            set({ messages: afterOutgoing });

            if (projectId !== CAFE_MAIL_PROJECT_ID) {
              return { ok: true, message: outgoing, response: null, responsePending: false };
            }

            const response = createScriptedResponse(outgoing);
            const withResponse = sortMailMessages([...afterOutgoing, response]);
            if (!(await persist(withResponse))) {
              set({
                error:
                  "Your message was sent, but Alex's reply could not be saved. It will be retried after reload.",
              });
              return { ok: true, message: outgoing, response: null, responsePending: true };
            }

            set({ messages: withResponse, error: null });
            notifyIncoming(response);
            return { ok: true, message: outgoing, response, responsePending: false };
          } finally {
            set({ sending: false });
          }
        }),

      markThreadRead: (threadId) =>
        enqueue(async () => {
          await get().hydrate();
          if (!get().hydrated) return;

          const current = get().messages;
          let changed = false;
          const next = current.map((message) => {
            if (
              message.threadId === threadId &&
              message.direction === "incoming" &&
              !message.read
            ) {
              changed = true;
              return { ...message, read: true };
            }
            return message;
          });
          if (!changed) return;

          const ordered = sortMailMessages(next);
          set({ messages: ordered });
          if (!(await persist(ordered))) {
            set({
              error: "Your unread state could not be saved. Try opening the conversation again.",
            });
          }
        }),

      retryPendingResponses: () => enqueue(repairPendingResponses),

      clearError: () => set({ error: null }),
    };
  });
}

export const useMail = createMailStore();
