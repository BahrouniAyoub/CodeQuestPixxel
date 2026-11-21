/**
 * Canonical definition for the final café documentation task.
 *
 * The task is intentionally a single step: document the finished calculator in
 * the existing README.md. Nothing here writes, templates, or completes the
 * README for the player. The README is only ever opened in the existing Editor.
 */
import { CAFE_DEV_PROJECT_DIRECTORY } from "./cafeDevTasks";

export const CAFE_DOC_TASK_ID = "CAFE-DOC-01" as const;

export type CafeDocTaskId = typeof CAFE_DOC_TASK_ID;

export const CAFE_DOC_README_PATH = `${CAFE_DEV_PROJECT_DIRECTORY}/README.md`;

export interface CafeDocTaskDefinition {
  readonly id: CafeDocTaskId;
  readonly title: string;
  readonly description: string;
  readonly objective: string;
  readonly instructions: readonly string[];
  readonly hints: readonly string[];
  /** A small outline, deliberately not a complete ready-to-submit README. */
  readonly example: string;
  readonly primaryFile: "README.md";
}

export const CAFE_DOC_TASK: CafeDocTaskDefinition = {
  id: CAFE_DOC_TASK_ID,
  title: "Document Your Application",
  description:
    "Write the project README so another person can understand what the café calculator does, what it costs, and how to run it.",
  objective:
    "Update README.md with the application purpose, product prices, discount rule, run instructions, example order, and invalid-input behaviour.",
  instructions: [
    "Open README.md in the Editor. Keep the file you created during project setup.",
    "Explain what the café calculator does and who it is for.",
    "List both products and their prices: coffee is $3 and a sandwich is $5.",
    "Describe the discount: orders of $20 or more receive 10% off; smaller orders pay full price.",
    "Explain how to run the application with main.py.",
    "Explain that the program asks the user to enter coffee and sandwich quantities.",
    "Include one example order with its expected result, and explain what happens when the user enters invalid input.",
    "Save README.md, then click Verify Documentation in Tickets.",
  ],
  hints: [
    "Start with a short opening paragraph: what the program does and who will use it. A heading such as “Café Order Calculator” and a sentence about calculating café orders is enough.",
    "Add a products section with both prices and a discount section that mentions 10% off when the subtotal is $20 or more. Keep the threshold inclusive: exactly $20 also receives the discount.",
    "Finish with a run command such as python main.py, a short example order with its final total, and a note that invalid or negative input shows a friendly message instead of crashing.",
  ],
  example:
    "A useful README usually contains:\n" +
    "• a one-paragraph description\n" +
    "• a product and price list\n" +
    "• the $20 / 10% discount rule\n" +
    "• how to run main.py\n" +
    "• how quantities are entered\n" +
    "• one example order and result\n" +
    "• what happens for invalid input\n\n" +
    "Example order: 2 coffees ($6) + 3 sandwiches ($15) = $21 subtotal, $2.10 discount, $18.90 total.",
  primaryFile: "README.md",
};
