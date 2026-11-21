import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPS, APP_ORDER, PINNED_APPS } from "@/core/applications/registry";
import { useWindows } from "@/core/windows/windowStore";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { useProgress } from "@/features/progress/progressStore";
import { trackedSave } from "@/services/persistence/saveStatus";
import { MailApp } from "./MailApp";
import { useMail } from "./mailStore";
import {
  ALEX_PARTY,
  CAFE_MAIL_PROJECT_ID,
  CAFE_MAIL_THREAD_ID,
  MAIL_MAX_MESSAGE_LENGTH,
  PLAYER_PARTY,
  type MailMessage,
} from "./mailTypes";

vi.mock("./mailIntegration", () => ({
  syncCafeWelcomeEmail: vi.fn(async () => ({ ok: true, created: false })),
}));

vi.mock("@/services/persistence/saveStatus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/persistence/saveStatus")>();
  return { ...actual, trackedSave: vi.fn(async () => true) };
});

const trackedSaveMock = vi.mocked(trackedSave);

function welcome(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: "welcome-1",
    threadId: CAFE_MAIL_THREAD_ID,
    from: ALEX_PARTY,
    to: PLAYER_PARTY,
    subject: "Welcome to the Café Calculator Project",
    body: "Hi,\n\nI'm glad you're joining this project!",
    createdAt: "2026-01-02T09:00:00.000Z",
    read: false,
    direction: "incoming",
    projectId: CAFE_MAIL_PROJECT_ID,
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
    body: "What should the receipt show?",
    createdAt: "2026-01-02T09:05:00.000Z",
    read: true,
    direction: "outgoing",
    projectId: CAFE_MAIL_PROJECT_ID,
    ...overrides,
  };
}

function response(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: "response-1",
    threadId: CAFE_MAIL_THREAD_ID,
    from: ALEX_PARTY,
    to: PLAYER_PARTY,
    subject: "Re: Welcome to the Café Calculator Project",
    body: "The receipt should show the items ordered, subtotal, any discount applied, and the final total.",
    createdAt: "2026-01-02T09:05:00.001Z",
    read: false,
    direction: "incoming",
    projectId: CAFE_MAIL_PROJECT_ID,
    scriptedResponseKind: "receipt",
    inReplyTo: "outgoing-1",
    ...overrides,
  };
}

function otherThread(): MailMessage {
  return {
    id: "other-1",
    threadId: "other-thread",
    from: { name: "Priya Shah", address: "priya@example.com" },
    to: PLAYER_PARTY,
    subject: "File rename script",
    body: "Could you rename these files for me?",
    createdAt: "2026-01-02T11:00:00.000Z",
    read: true,
    direction: "incoming",
  };
}

function setMail(messages: MailMessage[]): void {
  useMail.setState({
    messages,
    hydrated: true,
    loading: false,
    error: null,
    sending: false,
  });
}

describe("CodeQuest Mail registration", () => {
  afterEach(() => {
    cleanup();
    useWindows.getState().close("mail");
  });

  it("registers Mail as a pinned Pixel OS application", () => {
    expect(APPS.mail).toMatchObject({
      id: "mail",
      title: "CodeQuest Mail",
      shortTitle: "Mail",
      icon: "mail",
      pinned: true,
    });
    expect(APP_ORDER).toContain("mail");
    expect(PINNED_APPS).toContain("mail");
  });

  it("opens through the existing window manager", () => {
    useWindows.getState().open("mail");
    expect(useWindows.getState().windows.mail.open).toBe(true);
    expect(useWindows.getState().focused).toBe("mail");
  });
});

describe("CodeQuest Mail app", () => {
  beforeEach(() => {
    trackedSaveMock.mockResolvedValue(true);
    setMail([]);
  });

  afterEach(() => {
    cleanup();
    useMail.setState({
      messages: [],
      hydrated: false,
      loading: false,
      error: null,
      sending: false,
    });
  });

  it("shows the inbox, unread count, and the welcome conversation", async () => {
    setMail([welcome()]);
    render(<MailApp />);

    expect(screen.getByRole("button", { name: /Inbox/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sent/ })).toBeInTheDocument();
    expect(screen.getByLabelText("1 unread")).toBeInTheDocument();
    expect(screen.getAllByText("Welcome to the Café Calculator Project").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getAllByText(/I'm glad you're joining this project!/).length).toBeGreaterThan(
        0,
      ),
    );
  });

  it("shows outgoing messages in Sent view", async () => {
    setMail([welcome({ read: true }), outgoing(), response()]);
    render(<MailApp />);

    fireEvent.click(screen.getByRole("button", { name: /Sent/ }));

    expect(screen.getByText("To: Alex Morgan")).toBeInTheDocument();
    expect(screen.getAllByText(/What should the receipt show\?/).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        screen.getAllByText(/The receipt should show the items ordered/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("explains an empty Sent folder", () => {
    setMail([welcome({ read: true })]);
    render(<MailApp />);

    fireEvent.click(screen.getByRole("button", { name: /Sent/ }));
    expect(screen.getByText(/No sent messages yet/)).toBeInTheDocument();
  });

  it("selects a conversation thread", async () => {
    setMail([welcome({ read: true }), otherThread()]);
    render(<MailApp />);

    fireEvent.click(screen.getByRole("button", { name: /Welcome to the Café Calculator Project/ }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Welcome to the Café Calculator Project" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/I'm glad you're joining this project!/).length).toBeGreaterThan(0);
  });

  it("marks a conversation read and removes the unread badge", async () => {
    setMail([welcome()]);
    render(<MailApp />);

    await waitFor(() => expect(useMail.getState().messages[0]?.read).toBe(true));
    expect(screen.queryByLabelText("1 unread")).not.toBeInTheDocument();
  });

  it("sends a reply and shows the deterministic client response", async () => {
    setMail([welcome({ read: true })]);
    render(<MailApp />);

    fireEvent.change(screen.getByLabelText("Reply message"), {
      target: { value: "What should the receipt show?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() =>
      expect(
        screen.getAllByText(/The receipt should show the items ordered/).length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/What should the receipt show\?/).length).toBeGreaterThan(0);
    expect(useMail.getState().messages).toHaveLength(3);
  });

  it("rejects an empty reply", async () => {
    setMail([welcome({ read: true })]);
    const { container } = render(<MailApp />);

    fireEvent.submit(container.querySelector("form.cq-mail-compose") as HTMLFormElement);
    expect(screen.getByText("Write a message before sending.")).toBeInTheDocument();
  });

  it("rejects an oversized reply", async () => {
    setMail([welcome({ read: true })]);
    render(<MailApp />);

    fireEvent.change(screen.getByLabelText("Reply message"), {
      target: { value: "x".repeat(MAIL_MAX_MESSAGE_LENGTH + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    expect(screen.getByText(new RegExp(`under ${MAIL_MAX_MESSAGE_LENGTH}`))).toBeInTheDocument();
  });

  it("keeps the draft when saving fails", async () => {
    setMail([welcome({ read: true })]);
    render(<MailApp />);

    const draft = "Hello Alex, could you confirm the prices?";
    fireEvent.change(screen.getByLabelText("Reply message"), { target: { value: draft } });
    trackedSaveMock.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() =>
      expect(screen.getByText(/Your message could not be saved/)).toBeInTheDocument(),
    );
    expect((screen.getByLabelText("Reply message") as HTMLTextAreaElement).value).toBe(draft);
  });

  it("does not award XP, money, or complete a Chapter 1 quest", async () => {
    setMail([welcome({ read: true })]);
    const progressBefore = {
      completions: useProgress.getState().completions,
      currentTicketId: useProgress.getState().currentTicketId,
      started: useProgress.getState().started,
    };
    const chapterBefore = useChapter1.getState().progress;
    render(<MailApp />);

    fireEvent.change(screen.getByLabelText("Reply message"), {
      target: { value: "What is the deadline?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(useMail.getState().messages).toHaveLength(3));

    expect(useProgress.getState().completions).toEqual(progressBefore.completions);
    expect(useProgress.getState().currentTicketId).toBe(progressBefore.currentTicketId);
    expect(useProgress.getState().started).toEqual(progressBefore.started);
    expect(useChapter1.getState().progress).toEqual(chapterBefore);
  });
});
