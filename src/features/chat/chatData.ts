import type { TicketId } from "@/features/tickets/data/tickets";

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
    m("general", "maya", "Glad to have you. Your tickets are waiting in My Tickets.", 38, 3),
    m("dev", "alex", "Sprint goal: onboarding tickets CQ-001 to CQ-005. Start with CQ-001 — it unlocks the rest.", 35, 1),
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

export const COMPLETION_MESSAGES: Record<TicketId, { channel: ChannelId; author: MemberId; text: string }[]> = {
  "CQ-001": [
    { channel: "dev", author: "alex", text: "CQ-001 merged ✅ Variables and print() — the foundation of everything. CQ-002 is yours." },
    { channel: "mentor", author: "maya", text: "Nice first ticket! Next up: input() always gives you a string. Keep that in mind." },
  ],
  "CQ-002": [
    { channel: "dev", author: "sam", text: "Badge printer works! No more 'gRaCe' badges at the front desk 😄" },
    { channel: "mentor", author: "maya", text: "String methods mastered. Conditions next — watch your boundary values (>= vs >)." },
  ],
  "CQ-003": [
    { channel: "dev", author: "alex", text: "Grader shipped. Edge cases at 90 and 50 handled — that's real-world thinking." },
    { channel: "mentor", author: "maya", text: "You're officially a Python Beginner. Loops are next: let the computer repeat for you." },
  ],
  "CQ-004": [
    { channel: "dev", author: "sam", text: "3… 2… 1… Liftoff! 🚀 The deploy countdown is live." },
    { channel: "mentor", author: "maya", text: "Last one: functions. Remember — return gives a value back, print just shows it." },
  ],
  "CQ-005": [
    { channel: "general", author: "alex", text: "Huge shout-out: our new dev finished every onboarding ticket! 🏆" },
    { channel: "mentor", author: "maya", text: "Functions done — you write reusable code now. Proud of you!" },
  ],
};

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
