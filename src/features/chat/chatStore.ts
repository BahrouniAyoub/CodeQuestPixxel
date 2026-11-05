import { create } from "zustand";
import { debouncedSave } from "@/services/persistence/saveStatus";
import { notify } from "@/features/notifications/notificationStore";
import { MEMBERS, mentorReply, seedMessages, type ChannelId, type ChatMessage, type MemberId } from "./chatData";

export interface ChatPersisted {
  messages: ChatMessage[];
  lastRead: Partial<Record<ChannelId, number>>;
}

interface ChatStore extends ChatPersisted {
  activeChannel: ChannelId;
  /** whether the chat window is focused & visible — set by the chat app */
  viewing: boolean;
  hydrate: (p: ChatPersisted | undefined) => void;
  setActive: (c: ChannelId) => void;
  setViewing: (v: boolean) => void;
  markRead: (c: ChannelId) => void;
  send: (text: string) => void;
  post: (channel: ChannelId, author: MemberId, text: string) => void;
}

let msgSeq = 0;
const mkId = () => `m-${Date.now().toString(36)}-${++msgSeq}`;

function persist(s: ChatPersisted) {
  debouncedSave("chat", "state", { messages: s.messages.slice(-300), lastRead: s.lastRead }, 300);
}

export function unreadCount(s: Pick<ChatPersisted, "messages" | "lastRead">, channel: ChannelId): number {
  const last = s.lastRead[channel] ?? 0;
  return s.messages.filter((m) => m.channel === channel && m.author !== "you" && m.at > last).length;
}

export const useChat = create<ChatStore>((set, get) => ({
  messages: [],
  lastRead: {},
  activeChannel: "general",
  viewing: false,
  hydrate: (p) => {
    if (p && Array.isArray(p.messages) && p.messages.length) set({ messages: p.messages, lastRead: p.lastRead ?? {} });
    else set({ messages: seedMessages(Date.now()), lastRead: {} });
  },
  setActive: (c) => {
    set({ activeChannel: c });
    get().markRead(c);
  },
  setViewing: (v) => {
    set({ viewing: v });
    if (v) get().markRead(get().activeChannel);
  },
  markRead: (c) => {
    const s = get();
    const latest = Math.max(0, ...s.messages.filter((m) => m.channel === c).map((m) => m.at));
    if ((s.lastRead[c] ?? 0) >= latest) return;
    set({ lastRead: { ...s.lastRead, [c]: latest } });
    persist(get());
  },
  post: (channel, author, text) => {
    const msg: ChatMessage = { id: mkId(), channel, author, text, at: Date.now() };
    set((s) => ({ messages: [...s.messages, msg] }));
    const s = get();
    if (s.viewing && s.activeChannel === channel) s.markRead(channel);
    else if (author !== "you") {
      notify({ kind: "info", title: `New message from ${MEMBERS[author].name}`, message: text.slice(0, 80) });
    }
    persist(get());
  },
  send: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const channel = get().activeChannel;
    get().post(channel, "you", trimmed);
    if (channel === "mentor") {
      setTimeout(() => get().post("mentor", "maya", mentorReply(trimmed)), 1200);
    }
  },
}));
