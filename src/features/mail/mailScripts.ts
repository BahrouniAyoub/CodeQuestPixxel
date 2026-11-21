/**
 * Deterministic scripted client replies for the Café Calculator conversation.
 *
 * There is no AI service and no network call. Classification is keyword based
 * with an explicit precedence order defined by `SCRIPTED_TOPICS`.
 */
import type { MailScriptedResponseKind } from "./mailTypes";

export interface ScriptedTopic {
  readonly kind: Exclude<MailScriptedResponseKind, "fallback">;
  readonly pattern: RegExp;
  readonly reply: string;
}

/**
 * First match wins. Discount is checked before prices so a question such as
 * "Is the discount applied to the $3 coffee?" gets the discount answer.
 */
export const SCRIPTED_TOPICS: readonly ScriptedTopic[] = [
  {
    kind: "discount",
    pattern: /\bdiscount|\b10\s*%|\bthreshold\b|\$20\b|\b20\s*dollars?\b/i,
    reply:
      "The 10% discount should apply when the order subtotal is $20 or more, including exactly $20.",
  },
  {
    kind: "prices",
    pattern: /\bprice|\bcost|\bcoffee|\bsandwich|\$3\b|\$5\b|\b3\s*dollars?\b|\b5\s*dollars?\b/i,
    reply:
      "Coffee costs $3 and sandwiches cost $5. These prices should remain fixed for this project.",
  },
  {
    kind: "receipt",
    pattern: /\breceipt|\boutput|\bprint|\bshow\b.*\b(items|total)\b/i,
    reply:
      "The receipt should show the items ordered, subtotal, any discount applied, and the final total.",
  },
  {
    kind: "deadline",
    pattern: /\bdeadline|\bdue\b|\btimeline|\bhow long|\bwhen\b.*\b(finish|done|deliver)\b/i,
    reply:
      "There's no strict real-time deadline for this project. Focus on making sure the program works correctly.",
  },
  {
    kind: "testing",
    pattern: /\btest|\binvalid|\bzero|\bnegative|\bedge case|\bquantity|\bquantities|\binput/i,
    reply:
      "Please test normal orders, zero quantities, negative quantities, invalid input, and the discount threshold.",
  },
] as const;

export const FALLBACK_REPLY =
  "Thanks for your message. Could you clarify your question? I can help with the café requirements, prices, discounts, receipts, or testing.";

export interface ScriptedReply {
  readonly kind: MailScriptedResponseKind;
  readonly body: string;
}

export function classifyClientQuestion(body: string): MailScriptedResponseKind {
  const topic = SCRIPTED_TOPICS.find((candidate) => candidate.pattern.test(body));
  return topic?.kind ?? "fallback";
}

export function scriptedReplyFor(body: string): ScriptedReply {
  const kind = classifyClientQuestion(body);
  const topic = SCRIPTED_TOPICS.find((candidate) => candidate.kind === kind);
  return { kind, body: topic?.reply ?? FALLBACK_REPLY };
}
