import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { notify } from "@/features/notifications/notificationStore";
import {
  ALEX_PARTY,
  CAFE_MAIL_THREAD_ID,
  MAIL_VERSION,
  PLAYER_PARTY,
  createMailSaveRecord,
  unreadMailCount,
  type MailMessage,
  type MailSaveRecord,
} from "./mailTypes";
import { createMailStore, pendingScriptedResponses, scriptedResponseId } from "./mailStore";

vi.mock("@/features/notifications/notificationStore", () => ({ notify: vi.fn() }));

const notifier = vi.mocked(notify);

function welcome(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: "welcome-1",
    threadId: CAFE_MAIL_THREAD_ID,
    from: ALEX_PARTY,
    to: PLAYER_PARTY,
    subject: "Welcome to the Café Calculator Project",
    body: "Hi, I'm glad you're joining this project!",
    createdAt: "2026-01-02T09:00:00.000Z",
    read: false,
    direction: "incoming",
    projectId: CAFE_CALCULATOR_JOB_ID,
    ...overrides,
  };
}

function outgoing(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: "outgoing-1",
    threadId: CAFE_MAIL_THREAD_ID,
    from: PLAYER_PARTY,
    to: ALEX_PARTY,
    subject: "Re: Welcome to the Café Calculator Project",
    body: "What does the discount apply to?",
    createdAt: "2026-01-02T09:05:00.000Z",
    read: true,
    direction: "outgoing",
    projectId: CAFE_CALCULATOR_JOB_ID,
    ...overrides,
  };
}

function record(messages: MailMessage[]): MailSaveRecord {
  return createMailSaveRecord(messages);
}

interface Harness {
  store: ReturnType<typeof createMailStore>;
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  saved: MailSaveRecord[];
  setSaveImpl: (impl: (record: MailSaveRecord, call: number) => boolean | Promise<boolean>) => void;
}

function makeStore(
  raw: unknown,
  saveImpl: (record: MailSaveRecord, call: number) => boolean | Promise<boolean> = () => true,
): Harness {
  const saved: MailSaveRecord[] = [];
  let calls = 0;
  let impl = saveImpl;
  const load = vi.fn(async () => raw);
  const save = vi.fn(async (saveRecord: MailSaveRecord) => {
    calls += 1;
    const ok = await impl(saveRecord, calls);
    if (ok) saved.push(saveRecord);
    return ok;
  });
  const store = createMailStore({ load, save });
  return {
    store,
    load,
    save,
    saved,
    setSaveImpl: (next) => {
      impl = next;
    },
  };
}

describe("mail store hydration", () => {
  beforeEach(() => notifier.mockClear());

  it("hydrates to an empty inbox when no record exists", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    expect(h.store.getState().hydrated).toBe(true);
    expect(h.store.getState().messages).toEqual([]);
    expect(h.store.getState().error).toBeNull();
  });

  it("hydrates valid messages and preserves read state", async () => {
    const h = makeStore(record([welcome({ read: true })]));
    await h.store.getState().hydrate();

    expect(h.store.getState().messages).toHaveLength(1);
    expect(h.store.getState().messages[0]?.read).toBe(true);
    expect(unreadMailCount(h.store.getState().messages)).toBe(0);
  });

  it("handles corrupted records safely and keeps the app usable", async () => {
    const h = makeStore({ version: MAIL_VERSION, messages: [{ id: 42 }] });
    await h.store.getState().hydrate();

    expect(h.store.getState().hydrated).toBe(true);
    expect(h.store.getState().messages).toEqual([]);
    expect(h.store.getState().error).toMatch(/invalid/i);
  });

  it("surfaces hydration failures and retries successfully", async () => {
    const h = makeStore(undefined);
    h.load.mockRejectedValueOnce(new Error("storage offline"));

    await h.store.getState().hydrate();
    expect(h.store.getState().hydrated).toBe(false);
    expect(h.store.getState().error).toMatch(/storage offline/i);

    await h.store.getState().hydrate();
    expect(h.load).toHaveBeenCalledTimes(2);
    expect(h.store.getState().hydrated).toBe(true);
  });

  it("repairs a scripted response that was not persisted before reload", async () => {
    const h = makeStore(record([welcome(), outgoing()]));
    await h.store.getState().hydrate();

    const messages = h.store.getState().messages;
    expect(messages).toHaveLength(3);
    expect(messages.some((message) => message.inReplyTo === "outgoing-1")).toBe(true);
    expect(h.saved).toHaveLength(1);
  });
});

describe("mail store sending", () => {
  beforeEach(() => notifier.mockClear());

  it("persists the outgoing message before the scripted response", async () => {
    const h = makeStore(record([welcome()]));
    await h.store.getState().hydrate();

    const result = await h.store
      .getState()
      .sendReply(CAFE_MAIL_THREAD_ID, "  Does the discount apply at exactly $20?  ");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message.body).toBe("Does the discount apply at exactly $20?");
    expect(result.response?.scriptedResponseKind).toBe("discount");
    expect(result.response?.inReplyTo).toBe(result.message.id);
    expect(h.saved).toHaveLength(2);
    expect(h.saved[0]?.messages.at(-1)?.id).toBe(result.message.id);
    expect(h.saved[1]?.messages.at(-1)?.id).toBe(scriptedResponseId(result.message.id));
    expect(h.store.getState().messages).toHaveLength(3);
  });

  it("rejects empty and oversized replies without saving", async () => {
    const h = makeStore(record([welcome()]));
    await h.store.getState().hydrate();

    const empty = await h.store.getState().sendReply(CAFE_MAIL_THREAD_ID, "   ");
    const oversized = await h.store.getState().sendReply(CAFE_MAIL_THREAD_ID, "x".repeat(2001));

    expect(empty.ok).toBe(false);
    expect(oversized.ok).toBe(false);
    expect(h.save).not.toHaveBeenCalled();
  });

  it("does not commit a message when the outgoing save fails", async () => {
    const h = makeStore(record([welcome()]), () => false);
    await h.store.getState().hydrate();

    const result = await h.store.getState().sendReply(CAFE_MAIL_THREAD_ID, "Hello Alex");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/could not be saved/i);
    expect(h.store.getState().messages).toHaveLength(1);
    expect(h.store.getState().messages[0]?.direction).toBe("incoming");
  });

  it("retries a response that failed to persist without duplicating the reply", async () => {
    let calls = 0;
    const h = makeStore(record([welcome()]), () => {
      calls += 1;
      return calls !== 2;
    });
    await h.store.getState().hydrate();

    const first = await h.store.getState().sendReply(CAFE_MAIL_THREAD_ID, "Tell me about tests");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.responsePending).toBe(true);
    expect(h.store.getState().messages).toHaveLength(2);
    expect(h.store.getState().messages[1]?.id).toBe(first.message.id);

    h.setSaveImpl(() => true);
    await h.store.getState().retryPendingResponses();

    const messages = h.store.getState().messages;
    expect(messages).toHaveLength(3);
    expect(messages.filter((message) => message.inReplyTo === first.message.id)).toHaveLength(1);
    expect(messages.at(-1)?.scriptedResponseKind).toBe("testing");
  });

  it("hides the sending state after persistence settles", async () => {
    const h = makeStore(record([welcome()]));
    await h.store.getState().hydrate();

    await h.store.getState().sendReply(CAFE_MAIL_THREAD_ID, "Hello");
    expect(h.store.getState().sending).toBe(false);
  });

  it("creates exactly one response per outgoing message", () => {
    const waiting = [
      outgoing({ id: "one", body: "What is the discount?" }),
      outgoing({ id: "two", body: "What is the deadline?", createdAt: "2026-01-02T09:06:00.000Z" }),
    ];

    const pending = pendingScriptedResponses(waiting);
    expect(pending.map((message) => message.id)).toEqual([
      scriptedResponseId("one"),
      scriptedResponseId("two"),
    ]);
    expect(pendingScriptedResponses([...waiting, ...pending])).toEqual([]);
  });

  it("does not duplicate messages when the persisted record is reloaded", async () => {
    const h = makeStore(record([welcome()]));
    await h.store.getState().hydrate();
    await h.store.getState().sendReply(CAFE_MAIL_THREAD_ID, "What is the deadline?");

    const persisted = h.saved.at(-1);
    expect(persisted).toBeDefined();
    const reloaded = makeStore(persisted);
    await reloaded.store.getState().hydrate();
    await reloaded.store.getState().retryPendingResponses();

    expect(reloaded.store.getState().messages).toHaveLength(3);
    expect(
      reloaded.store.getState().messages.filter((message) => message.direction === "outgoing"),
    ).toHaveLength(1);
    expect(
      reloaded.store.getState().messages.filter((message) => message.direction === "incoming"),
    ).toHaveLength(2);
  });
});

describe("mail store read state and notifications", () => {
  beforeEach(() => notifier.mockClear());

  it("persists read state and restores it after reload", async () => {
    const h = makeStore(record([welcome()]));
    await h.store.getState().hydrate();
    expect(unreadMailCount(h.store.getState().messages)).toBe(1);

    await h.store.getState().markThreadRead(CAFE_MAIL_THREAD_ID);
    expect(unreadMailCount(h.store.getState().messages)).toBe(0);
    expect(h.saved.at(-1)?.messages[0]?.read).toBe(true);

    const reloaded = makeStore(h.saved.at(-1));
    await reloaded.store.getState().hydrate();
    expect(unreadMailCount(reloaded.store.getState().messages)).toBe(0);
  });

  it("does not re-save an already read thread", async () => {
    const h = makeStore(record([welcome({ read: true })]));
    await h.store.getState().hydrate();

    await h.store.getState().markThreadRead(CAFE_MAIL_THREAD_ID);
    expect(h.save).not.toHaveBeenCalled();
  });

  it("notifies once for a new welcome email and once for each scripted reply", async () => {
    const h = makeStore(record([]));
    await h.store.getState().hydrate();

    await h.store.getState().ensureMessage(welcome());
    expect(notifier).toHaveBeenCalledTimes(1);
    expect(notifier).toHaveBeenCalledWith({
      kind: "info",
      title: "New email from Alex Morgan",
      message: "Welcome to the Café Calculator Project",
    });

    await h.store.getState().sendReply(CAFE_MAIL_THREAD_ID, "What does the receipt show?");
    expect(notifier).toHaveBeenCalledTimes(2);

    // Reloading the same persisted conversation must not notify again.
    const reloaded = makeStore(h.saved.at(-1));
    await reloaded.store.getState().hydrate();
    expect(notifier).toHaveBeenCalledTimes(2);
  });

  it("does not create a duplicate welcome email", async () => {
    const h = makeStore(record([]));
    await h.store.getState().hydrate();

    const first = await h.store.getState().ensureMessage(welcome());
    const second = await h.store.getState().ensureMessage(welcome());

    expect(first).toEqual({ ok: true, created: true });
    expect(second).toEqual({ ok: true, created: false });
    expect(h.store.getState().messages).toHaveLength(1);
  });
});
