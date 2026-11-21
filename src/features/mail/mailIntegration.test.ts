import { describe, expect, it, vi } from "vitest";
import {
  ALEX_ACCEPTANCE_MESSAGE,
  GIGBOARD_APPLICATION_VERSION,
  type GigboardApplication,
  type GigboardApplicationSaveRecord,
} from "@/features/browser/data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import { createGigboardApplicationStore } from "@/features/browser/gigboardApplicationStore";
import {
  CAFE_WELCOME_BODY,
  CAFE_WELCOME_SUBJECT,
  createCafeWelcomeMessage,
  isCafeApplicationAccepted,
  shouldCreateCafeWelcomeEmail,
  syncCafeWelcomeEmail,
} from "./mailIntegration";
import { createMailStore } from "./mailStore";
import {
  CAFE_MAIL_PROJECT_ID,
  CAFE_MAIL_THREAD_ID,
  CAFE_WELCOME_MESSAGE_ID,
  MAIL_VERSION,
  type MailSaveRecord,
} from "./mailTypes";

vi.mock("@/features/notifications/notificationStore", () => ({ notify: vi.fn() }));

const VALID_PROPOSAL =
  "I would build the café order calculator as a clean Python script with variables, totals, and a readable receipt.";

function applicationRecord(status: GigboardApplication["status"]): GigboardApplicationSaveRecord {
  return {
    version: GIGBOARD_APPLICATION_VERSION,
    application: {
      jobId: CAFE_CALCULATOR_JOB_ID,
      proposal: VALID_PROPOSAL,
      status,
      submittedAt: "2026-01-02T09:30:00.000Z",
      acceptedAt: status === "accepted" ? "2026-01-02T10:00:00.000Z" : null,
      acceptanceMessage: status === "accepted" ? ALEX_ACCEPTANCE_MESSAGE : null,
    },
  };
}

function mailRecord(records: MailSaveRecord["messages"] = []): MailSaveRecord {
  return { version: MAIL_VERSION, messages: records };
}

function makeApplicationStore(raw: unknown) {
  return createGigboardApplicationStore({
    load: async () => raw,
    save: async () => true,
  });
}

function makeMailStore(raw: unknown, saveImpl: () => boolean | Promise<boolean> = () => true) {
  const saved: MailSaveRecord[] = [];
  let impl = saveImpl;
  const store = createMailStore({
    load: async () => raw,
    save: async (record) => {
      const ok = await impl();
      if (ok) saved.push(record);
      return ok;
    },
  });
  return {
    store,
    saved,
    setSaveImpl: (next: () => boolean | Promise<boolean>) => {
      impl = next;
    },
  };
}

const NOW = () => new Date("2026-01-02T10:05:00.000Z");

describe("GigBoard acceptance → Mail welcome integration", () => {
  it("does not create mail before an application exists", async () => {
    const appStore = makeApplicationStore(undefined);
    const mail = makeMailStore(undefined);

    const result = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, created: false });
    expect(mail.store.getState().messages).toEqual([]);
    expect(mail.saved).toEqual([]);
  });

  it("does not create mail while the application is only submitted", async () => {
    const appStore = makeApplicationStore(applicationRecord("submitted"));
    const mail = makeMailStore(undefined);

    const result = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, created: false });
    expect(mail.store.getState().messages).toEqual([]);
  });

  it("creates the welcome email after acceptance", async () => {
    const appStore = makeApplicationStore(applicationRecord("accepted"));
    const mail = makeMailStore(undefined);

    const result = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, created: true });
    const message = mail.store.getState().messages[0];
    expect(message).toMatchObject({
      id: CAFE_WELCOME_MESSAGE_ID,
      threadId: CAFE_MAIL_THREAD_ID,
      subject: CAFE_WELCOME_SUBJECT,
      body: CAFE_WELCOME_BODY,
      createdAt: "2026-01-02T10:05:00.000Z",
      read: false,
      direction: "incoming",
      projectId: CAFE_MAIL_PROJECT_ID,
    });
    expect(message?.from.name).toBe("Alex Morgan");
    expect(message?.body).toContain("Coffee costs $3 and sandwiches cost $5.");
    expect(mail.saved).toHaveLength(1);
  });

  it("creates the welcome email exactly once", async () => {
    const appStore = makeApplicationStore(applicationRecord("accepted"));
    const mail = makeMailStore(undefined);

    const first = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });
    const second = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });

    expect(first).toEqual({ ok: true, created: true });
    expect(second).toEqual({ ok: true, created: false });
    expect(mail.store.getState().messages).toHaveLength(1);
    expect(mail.saved).toHaveLength(1);
  });

  it("supports an application accepted before Mail existed", async () => {
    const appStore = makeApplicationStore(applicationRecord("accepted"));
    const mail = makeMailStore(mailRecord([]));

    const result = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, created: true });
    expect(mail.store.getState().messages.map((message) => message.id)).toEqual([
      CAFE_WELCOME_MESSAGE_ID,
    ]);
  });

  it("does not duplicate the welcome when older mail already contains it", async () => {
    const appStore = makeApplicationStore(applicationRecord("accepted"));
    const existing = createCafeWelcomeMessage("2026-01-01T08:00:00.000Z");
    const mail = makeMailStore(mailRecord([existing]));

    const result = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, created: false });
    expect(mail.store.getState().messages).toHaveLength(1);
    expect(mail.saved).toEqual([]);
  });

  it("does not create a welcome email for an unrelated job", () => {
    const unrelated = {
      ...applicationRecord("accepted").application,
      jobId: "GB-1038",
    } as unknown as GigboardApplication;

    expect(isCafeApplicationAccepted(unrelated)).toBe(false);
    expect(shouldCreateCafeWelcomeEmail(unrelated, [])).toBe(false);
  });

  it("reports a mail hydration failure and can be retried", async () => {
    const appStore = makeApplicationStore(applicationRecord("accepted"));
    let load: () => Promise<unknown> = async () => {
      throw new Error("mail storage offline");
    };
    const store = createMailStore({
      load: () => load(),
      save: async () => true,
    });

    const failed = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: store,
      now: NOW,
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.reason).toMatch(/mail storage offline/i);

    load = async () => undefined;
    const retried = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: store,
      now: NOW,
    });
    expect(retried).toEqual({ ok: true, created: true });
  });

  it("retries when the welcome save fails", async () => {
    const appStore = makeApplicationStore(applicationRecord("accepted"));
    const mail = makeMailStore(undefined, () => false);

    const failed = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });
    expect(failed.ok).toBe(false);
    expect(mail.store.getState().messages).toEqual([]);

    mail.setSaveImpl(() => true);
    const retried = await syncCafeWelcomeEmail({
      applicationStore: appStore,
      mailStore: mail.store,
      now: NOW,
    });
    expect(retried).toEqual({ ok: true, created: true });
    expect(mail.store.getState().messages).toHaveLength(1);
  });
});
