import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Inbox as InboxIcon,
  Loader2,
  Mail as MailIcon,
  RefreshCw,
  Send as SendIcon,
} from "lucide-react";
import { useWindows } from "@/core/windows/windowStore";
import { useMail } from "./mailStore";
import { syncCafeWelcomeEmail } from "./mailIntegration";
import { buildMailThreads, latestByDirection } from "./mailThreads";
import { MAIL_MAX_MESSAGE_LENGTH, unreadMailCount } from "./mailTypes";
import "../shared-apps.css";
import "./mail.css";

type MailView = "inbox" | "sent";

function formatMailDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function previewText(body: string): string {
  const singleLine = body.replace(/\s+/g, " ").trim();
  return singleLine.length > 110 ? `${singleLine.slice(0, 110)}…` : singleLine;
}

export function MailApp() {
  const messages = useMail((state) => state.messages);
  const hydrated = useMail((state) => state.hydrated);
  const loading = useMail((state) => state.loading);
  const sending = useMail((state) => state.sending);
  const storeError = useMail((state) => state.error);
  const [view, setView] = useState<MailView>("inbox");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const threads = useMemo(() => buildMailThreads(messages), [messages]);
  const visibleThreads = useMemo(
    () =>
      view === "inbox"
        ? threads.filter((thread) => thread.hasIncoming)
        : threads.filter((thread) => thread.hasOutgoing),
    [threads, view],
  );
  const selectedThread = visibleThreads.find((thread) => thread.id === selectedThreadId) ?? null;
  const unread = unreadMailCount(messages);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      await useMail.getState().hydrate();
      await useMail.getState().retryPendingResponses();
      if (!alive) return;
      setSyncing(true);
      await syncCafeWelcomeEmail();
      if (alive) setSyncing(false);
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (visibleThreads.length === 0) {
      setSelectedThreadId(null);
      return;
    }
    if (!visibleThreads.some((thread) => thread.id === selectedThreadId)) {
      const firstThread = visibleThreads[0];
      if (firstThread) setSelectedThreadId(firstThread.id);
    }
  }, [visibleThreads, selectedThreadId]);

  useEffect(() => {
    if (selectedThreadId) void useMail.getState().markThreadRead(selectedThreadId);
  }, [selectedThreadId, messages]);

  useEffect(() => {
    setDraft("");
    setComposeError(null);
  }, [selectedThreadId]);

  const changeView = (next: MailView) => {
    setView(next);
    setSelectedThreadId(null);
  };

  const retryHydration = async () => {
    await useMail.getState().hydrate();
    await useMail.getState().retryPendingResponses();
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedThread || sending) return;
    if (draft.trim().length === 0) {
      setComposeError("Write a message before sending.");
      return;
    }
    if (draft.trim().length > MAIL_MAX_MESSAGE_LENGTH) {
      setComposeError(`Keep your message under ${MAIL_MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    setComposeError(null);
    const result = await useMail.getState().sendReply(selectedThread.id, draft);
    if (result.ok) {
      setDraft("");
      return;
    }
    setComposeError(result.reason);
  };

  const openTickets = () => useWindows.getState().open("tickets");

  return (
    <div className="cq-app cq-mail">
      <aside className="cq-mail-side" aria-label="Mail folders">
        <div className="cq-mail-brand">
          <MailIcon size={20} aria-hidden="true" />
          <div>
            <strong>CodeQuest Mail</strong>
            <small>client inbox</small>
          </div>
        </div>
        <nav className="cq-mail-folders">
          <button
            type="button"
            className={view === "inbox" ? "active" : ""}
            aria-pressed={view === "inbox"}
            onClick={() => changeView("inbox")}
          >
            <InboxIcon size={16} aria-hidden="true" /> Inbox
            {unread > 0 ? (
              <span className="cq-mail-unread-badge" aria-label={`${unread} unread`}>
                {unread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={view === "sent" ? "active" : ""}
            aria-pressed={view === "sent"}
            onClick={() => changeView("sent")}
          >
            <SendIcon size={16} aria-hidden="true" /> Sent
          </button>
        </nav>
        <p className="cq-mail-side-note">
          Simulated client inbox. Replies are scripted and no real email is sent.
        </p>
      </aside>

      <section className="cq-mail-list" aria-label={view === "inbox" ? "Inbox" : "Sent messages"}>
        <header className="cq-mail-list-head">
          <div>
            <span className="cq-eyebrow">{view === "inbox" ? "INBOX" : "SENT"}</span>
            <strong>
              {visibleThreads.length} conversation{visibleThreads.length === 1 ? "" : "s"}
            </strong>
          </div>
          {unread > 0 && view === "inbox" ? <span>{unread} unread</span> : null}
        </header>

        {!hydrated && loading ? (
          <div className="cq-mail-empty" role="status">
            <Loader2 size={18} className="cq-mail-spin" aria-hidden="true" /> Loading your inbox…
          </div>
        ) : null}

        {!hydrated && !loading ? (
          <div className="cq-mail-empty cq-mail-error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>{storeError ?? "Your inbox could not be loaded."}</p>
            <button type="button" onClick={() => void retryHydration()}>
              <RefreshCw size={14} aria-hidden="true" /> Retry
            </button>
          </div>
        ) : null}

        {hydrated && visibleThreads.length === 0 ? (
          <div className="cq-mail-empty">
            <MailIcon size={22} aria-hidden="true" />
            <p>
              {view === "sent"
                ? "No sent messages yet. Reply to a client to start the conversation."
                : "No messages yet. Accept a GigBoard project to receive your first client email."}
            </p>
            {syncing ? <small>Synchronizing client mail…</small> : null}
          </div>
        ) : null}

        <div className="cq-mail-items">
          {visibleThreads.map((thread) => {
            const previewMessage =
              view === "sent"
                ? (latestByDirection(thread, "outgoing") ?? thread.latest)
                : thread.latest;
            const senderName =
              view === "sent" ? `To: ${previewMessage.to.name}` : previewMessage.from.name;
            return (
              <button
                key={thread.id}
                type="button"
                className={`cq-mail-item ${selectedThread?.id === thread.id ? "selected" : ""} ${
                  thread.unreadCount > 0 && view === "inbox" ? "unread" : ""
                }`}
                aria-current={selectedThread?.id === thread.id ? "true" : undefined}
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <span className="cq-mail-item-top">
                  <strong>{senderName}</strong>
                  <time>{formatMailDate(previewMessage.createdAt)}</time>
                </span>
                <span className="cq-mail-item-subject">
                  {thread.subject}
                  {thread.unreadCount > 0 && view === "inbox" ? (
                    <i aria-label="Unread" className="cq-mail-dot" />
                  ) : null}
                </span>
                <span className="cq-mail-item-preview">{previewText(previewMessage.body)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <main className="cq-mail-detail">
        {storeError && hydrated ? (
          <div className="cq-mail-banner" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{storeError}</span>
            <button type="button" onClick={() => useMail.getState().clearError()}>
              Dismiss
            </button>
          </div>
        ) : null}

        {!hydrated ? (
          <div className="cq-mail-detail-empty">
            <MailIcon size={38} aria-hidden="true" />
            <h2>CodeQuest Mail</h2>
            <p>Load your inbox to read client messages and reply.</p>
          </div>
        ) : !selectedThread ? (
          <div className="cq-mail-detail-empty">
            <MailIcon size={38} aria-hidden="true" />
            <h2>Select a conversation</h2>
            <p>Client requirements, questions, and replies live here.</p>
          </div>
        ) : (
          <div className="cq-mail-conversation">
            <header className="cq-mail-conversation-head">
              <div>
                <span className="cq-eyebrow">CLIENT CONVERSATION</span>
                <h2>{selectedThread.subject}</h2>
                <p>
                  {selectedThread.messages[0]?.from.name} · to {selectedThread.messages[0]?.to.name}
                </p>
              </div>
              <button type="button" className="cq-mail-open-tickets" onClick={openTickets}>
                <ClipboardList size={15} aria-hidden="true" /> Open Tickets
              </button>
            </header>

            <div className="cq-mail-messages">
              {selectedThread.messages.map((message) => (
                <article
                  key={message.id}
                  className={`cq-mail-message cq-mail-message-${message.direction}`}
                >
                  <header>
                    <strong>{message.from.name}</strong>
                    <span>to {message.to.name}</span>
                    <time>{formatMailDate(message.createdAt)}</time>
                  </header>
                  <p className="cq-mail-message-subject">{message.subject}</p>
                  <p className="cq-mail-message-body">{message.body}</p>
                  {message.scriptedResponseKind ? (
                    <small className="cq-mail-scripted">Automated client reply</small>
                  ) : null}
                </article>
              ))}
            </div>

            <form className="cq-mail-compose" onSubmit={(event) => void handleSend(event)}>
              <label htmlFor="cq-mail-reply">
                Reply to {selectedThread.messages[0]?.from.name}
              </label>
              <textarea
                id="cq-mail-reply"
                aria-label="Reply message"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (composeError) setComposeError(null);
                }}
                rows={4}
                maxLength={MAIL_MAX_MESSAGE_LENGTH}
                placeholder="Ask Alex about the café requirements…"
                disabled={sending}
              />
              <div className="cq-mail-compose-foot">
                <small>
                  {draft.trim().length} / {MAIL_MAX_MESSAGE_LENGTH} characters
                </small>
                <button type="submit" disabled={sending || draft.trim().length === 0}>
                  {sending ? (
                    <>
                      <Loader2 size={15} className="cq-mail-spin" aria-hidden="true" /> Sending…
                    </>
                  ) : (
                    <>
                      <SendIcon size={15} aria-hidden="true" /> Send reply
                    </>
                  )}
                </button>
              </div>
              {composeError ? (
                <p className="cq-mail-compose-error" role="alert">
                  <AlertTriangle size={14} aria-hidden="true" /> {composeError}
                </p>
              ) : null}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
