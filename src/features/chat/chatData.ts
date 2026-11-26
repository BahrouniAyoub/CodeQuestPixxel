export type ChannelId = "general" | "dev" | "mentor";
export type MemberId = "alex" | "maya" | "sam" | "you";

export interface Member {
  id: MemberId;
  name: string;
  role: string;
  /** palette token used for the pixel avatar */
  color: "cyan" | "purple" | "green" | "yellow";
}

export interface ChatMessage {
  id: string;
  channel: ChannelId;
  author: MemberId;
  text: string;
  at: number;
}

export const MEMBERS: Record<MemberId, Member> = {
  alex: { id: "alex", name: "Alex", role: "Team Lead", color: "cyan" },
  maya: { id: "maya", name: "Maya", role: "Senior Developer", color: "purple" },
  sam: { id: "sam", name: "Sam", role: "Teammate", color: "green" },
  you: { id: "you", name: "You", role: "Junior Developer", color: "yellow" },
};

export const CHANNELS: { id: ChannelId; name: string; topic: string }[] = [
  { id: "general", name: "general", topic: "Company-wide chatter" },
  { id: "dev", name: "development-team", topic: "Tickets, code and deploys" },
  { id: "mentor", name: "mentor", topic: "Ask Maya anything" },
];

export function seedMessages(now: number): ChatMessage[] {
  const m = (channel: ChannelId, author: MemberId, text: string, minsAgo: number, i: number): ChatMessage => ({
    id: `seed-${channel}-${i}`,
    channel,
    author,
    text,
    at: now - minsAgo * 60_000,
  });
  return [
    m("general", "alex", "Morning team! Please welcome our newest developer 🎉", 42, 1),
    m("general", "sam", "Welcome aboard! The coffee machine is on floor 8-bit.", 40, 2),
    m("general", "maya", "Glad to have you. Check your Chapter 1 mission when you're ready to start real client work.", 38, 3),
    m("dev", "alex", "Your first client opportunity is on GigBoard. Read the brief carefully before you apply.", 35, 1),
    m("dev", "sam", "Pro tip: hit Run to try your code, Submit to run the real tests.", 33, 2),
    m(
      "mentor",
      "maya",
      "Hi! I'm your mentor. Stuck? Read the error message line number first — Python usually tells you exactly where it hurts.",
      30,
      1,
    ),
    m("mentor", "maya", "Also: hints in each ticket are free. Using them is what seniors do too.", 29, 2),
  ];
}

/** Completion chat messages keyed by active ticket ID. Legacy CQ tickets removed. */
export const COMPLETION_MESSAGES: Partial<Record<string, { channel: ChannelId; author: MemberId; text: string }[]>> = {};

const MENTOR_TIPS: { match: RegExp; reply: string }[] = [
  { match: /syntax|colon|:/i, reply: "SyntaxError usually means a missing colon after if/for/def, or an unclosed quote/bracket." },
  { match: /indent/i, reply: "Python uses indentation for blocks. Use 4 spaces inside if, for and def — and be consistent." },
  { match: /input|string|str/i, reply: "input() returns text. Wrap it with int(...) when you need a number." },
  { match: /loop|range|for|while/i, reply: "range(start, stop, step) stops *before* stop. range(3, 0, -1) gives 3, 2, 1." },
  { match: /function|def|return/i, reply: "A function should return its result. print() only displays — the caller gets None." },
  { match: /error|bug|help|stuck/i, reply: "Read the last line of the error first, then jump to the line number it mentions." },
];

export function mentorReply(text: string): string {
  return (
    MENTOR_TIPS.find((t) => t.match.test(text))?.reply ??
    "Good question! Try breaking it into tiny steps and print() values along the way to see what's happening."
  );
}
