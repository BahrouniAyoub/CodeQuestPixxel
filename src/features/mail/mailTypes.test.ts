import { describe, expect, it } from "vitest";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  ALEX_PARTY,
  CAFE_MAIL_THREAD_ID,
  MAIL_MAX_MESSAGE_LENGTH,
  MAIL_VERSION,
  PLAYER_PARTY,
  createMailSaveRecord,
  sortMailMessages,
  unreadMailCount,
  validateMailBody,
  validateMailSaveRecord,
  type MailMessage,
} from "./mailTypes";

function incoming(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: "message-1",
    threadId: CAFE_MAIL_THREAD_ID,
    from: ALEX_PARTY,
    to: PLAYER_PARTY,
    subject: "Welcome",
    body: "Hello there.",
    createdAt: "2026-01-02T09:00:00.000Z",
    read: false,
    direction: "incoming",
    projectId: CAFE_CALCULATOR_JOB_ID,
    ...overrides,
  };
}

describe("mail body validation", () => {
  it("trims whitespace around replies", () => {
    expect(validateMailBody("  Hello Alex  ")).toEqual({ ok: true, body: "Hello Alex" });
  });

  it("normalizes Windows line endings", () => {
    expect(validateMailBody("Line one\r\nLine two")).toEqual({
      ok: true,
      body: "Line one\nLine two",
    });
  });

  it("rejects empty replies", () => {
    expect(validateMailBody("   ")).toMatchObject({ ok: false });
  });

  it("rejects oversized replies", () => {
    const result = validateMailBody("x".repeat(MAIL_MAX_MESSAGE_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too long/i);
  });
});

describe("mail save record validation", () => {
  it("accepts a valid record and sorts messages oldest first", () => {
    const later = incoming({ id: "later", createdAt: "2026-01-02T10:00:00.000Z" });
    const earlier = incoming({ id: "earlier", createdAt: "2026-01-02T09:00:00.000Z" });
    const result = validateMailSaveRecord({
      version: MAIL_VERSION,
      messages: [later, earlier],
    });

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.messages.map((message) => message.id)).toEqual(["earlier", "later"]);
  });

  it("rejects corrupted records without throwing", () => {
    expect(validateMailSaveRecord(null)).toMatchObject({ ok: false });
    expect(validateMailSaveRecord({ version: 99, messages: [] })).toMatchObject({ ok: false });
    expect(validateMailSaveRecord({ version: MAIL_VERSION, messages: "nope" })).toMatchObject({
      ok: false,
    });
    expect(
      validateMailSaveRecord({
        version: MAIL_VERSION,
        messages: [{ ...incoming(), read: "no" }],
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects duplicate message IDs", () => {
    const result = validateMailSaveRecord({
      version: MAIL_VERSION,
      messages: [incoming(), incoming()],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/duplicate/i);
  });

  it("creates a versioned envelope with deterministic ordering", () => {
    const later = incoming({ id: "b", createdAt: "2026-01-02T11:00:00.000Z" });
    const earlier = incoming({ id: "a", createdAt: "2026-01-02T09:00:00.000Z" });
    const record = createMailSaveRecord([later, earlier]);

    expect(record.version).toBe(MAIL_VERSION);
    expect(record.messages.map((message) => message.id)).toEqual(["a", "b"]);
    expect(sortMailMessages([later, earlier]).map((message) => message.id)).toEqual(["a", "b"]);
  });

  it("counts only unread incoming messages", () => {
    expect(
      unreadMailCount([
        incoming({ id: "1", read: false }),
        incoming({ id: "2", read: true }),
        incoming({
          id: "3",
          read: false,
          direction: "outgoing",
          from: PLAYER_PARTY,
          to: ALEX_PARTY,
        }),
      ]),
    ).toBe(1);
  });
});
