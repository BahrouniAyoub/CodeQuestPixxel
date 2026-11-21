import { sortMailMessages, type MailMessage } from "./mailTypes";

export interface MailThread {
  readonly id: string;
  readonly subject: string;
  readonly messages: readonly MailMessage[];
  readonly latest: MailMessage;
  readonly unreadCount: number;
  readonly hasIncoming: boolean;
  readonly hasOutgoing: boolean;
  readonly projectId?: string;
}

function newestFirst(a: MailMessage, b: MailMessage): number {
  const time = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (time !== 0) return time;
  return a.id.localeCompare(b.id);
}

/** Group messages into deterministic conversation threads, newest activity first. */
export function buildMailThreads(messages: readonly MailMessage[]): MailThread[] {
  const byThread = new Map<string, MailMessage[]>();
  for (const message of messages) {
    const list = byThread.get(message.threadId);
    if (list) list.push(message);
    else byThread.set(message.threadId, [message]);
  }

  const threads: MailThread[] = [];
  for (const [id, threadMessages] of byThread) {
    const ordered = sortMailMessages(threadMessages);
    const latest = ordered[ordered.length - 1];
    if (!latest) continue;
    const projectMessage = ordered.find((message) => message.projectId !== undefined);
    threads.push({
      id,
      subject: ordered[0]?.subject ?? "(no subject)",
      messages: ordered,
      latest,
      unreadCount: ordered.filter((message) => message.direction === "incoming" && !message.read)
        .length,
      hasIncoming: ordered.some((message) => message.direction === "incoming"),
      hasOutgoing: ordered.some((message) => message.direction === "outgoing"),
      ...(projectMessage?.projectId !== undefined ? { projectId: projectMessage.projectId } : {}),
    });
  }

  return threads.sort((a, b) => newestFirst(a.latest, b.latest));
}

export function findMailThread(
  threads: readonly MailThread[],
  threadId: string | null,
): MailThread | null {
  if (!threadId) return null;
  return threads.find((thread) => thread.id === threadId) ?? null;
}

/** The newest message from one direction, used for list previews. */
export function latestByDirection(
  thread: MailThread,
  direction: MailMessage["direction"],
): MailMessage | null {
  for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
    const message = thread.messages[index];
    if (message && message.direction === direction) return message;
  }
  return null;
}
