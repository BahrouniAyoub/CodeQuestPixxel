import { describe, expect, it } from "vitest";
import { FALLBACK_REPLY, classifyClientQuestion, scriptedReplyFor } from "./mailScripts";

describe("scripted café client replies", () => {
  it("answers discount questions", () => {
    expect(scriptedReplyFor("Does the 10% discount apply at exactly $20?")).toEqual({
      kind: "discount",
      body: "The 10% discount should apply when the order subtotal is $20 or more, including exactly $20.",
    });
  });

  it("answers price questions", () => {
    expect(scriptedReplyFor("How much do coffee and sandwiches cost?")).toEqual({
      kind: "prices",
      body: "Coffee costs $3 and sandwiches cost $5. These prices should remain fixed for this project.",
    });
  });

  it("answers receipt and output questions", () => {
    expect(scriptedReplyFor("What should the printed receipt show?")).toEqual({
      kind: "receipt",
      body: "The receipt should show the items ordered, subtotal, any discount applied, and the final total.",
    });
  });

  it("answers deadline questions", () => {
    expect(scriptedReplyFor("Is there a deadline for this project?")).toEqual({
      kind: "deadline",
      body: "There's no strict real-time deadline for this project. Focus on making sure the program works correctly.",
    });
  });

  it("answers testing and invalid input questions", () => {
    expect(scriptedReplyFor("Which invalid quantities should I test?")).toEqual({
      kind: "testing",
      body: "Please test normal orders, zero quantities, negative quantities, invalid input, and the discount threshold.",
    });
  });

  it("uses the polite fallback for unrecognized messages", () => {
    expect(scriptedReplyFor("What is your favourite colour?")).toEqual({
      kind: "fallback",
      body: FALLBACK_REPLY,
    });
  });

  it("uses explicit precedence when a message matches several topics", () => {
    // Mentions prices and the discount. Discount is intentionally first.
    expect(classifyClientQuestion("Is the discount applied to the $3 coffee?")).toBe("discount");
    // Mentions testing and a receipt. Receipt is checked before testing.
    expect(classifyClientQuestion("How should I test the receipt output?")).toBe("receipt");
    // Mentions a deadline and tests. Deadline is checked before testing.
    expect(classifyClientQuestion("When is the deadline for the tests?")).toBe("deadline");
  });

  it("is deterministic for the same input", () => {
    const first = scriptedReplyFor("Do you need tests?");
    const second = scriptedReplyFor("Do you need tests?");
    expect(second).toEqual(first);
  });
});
