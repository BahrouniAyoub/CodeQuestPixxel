/**
 * Deterministic README documentation analysis.
 *
 * The checks are intentionally tolerant: players may use any Markdown structure
 * and ordinary phrasing. Each requirement is independent so the UI can report
 * exactly which part of the documentation is still missing. No AI model or
 * network service participates in verification.
 */

export const CAFE_README_MIN_LENGTH = 80;

export type CafeReadmeRequirementId =
  "purpose" | "products" | "discount" | "run" | "quantities" | "example" | "invalid-input";

export interface CafeReadmeRequirement {
  readonly id: CafeReadmeRequirementId;
  readonly label: string;
  readonly feedback: string;
}

export interface CafeReadmeRequirementResult extends CafeReadmeRequirement {
  readonly passed: boolean;
}

export interface CafeReadmeAnalysis {
  /** False for an empty, tiny, or content-free file. */
  readonly meaningful: boolean;
  readonly length: number;
  readonly requirements: readonly CafeReadmeRequirementResult[];
  readonly missing: readonly string[];
  readonly ok: boolean;
  /** Player-facing summary with every missing section named. */
  readonly summary: string;
}

export const CAFE_README_REQUIREMENTS: readonly CafeReadmeRequirement[] = [
  {
    id: "purpose",
    label: "What the application does",
    feedback: "Explain what the café calculator does and who it is for.",
  },
  {
    id: "products",
    label: "Products and prices",
    feedback: "Document both products with their prices: coffee costs $3 and a sandwich costs $5.",
  },
  {
    id: "discount",
    label: "10% discount at $20 or more",
    feedback:
      "Describe the discount accurately: orders of $20 or more receive 10% off, and smaller orders pay full price.",
  },
  {
    id: "run",
    label: "How to run main.py",
    feedback: "Explain how to run the application, for example with python main.py.",
  },
  {
    id: "quantities",
    label: "Entering coffee and sandwich quantities",
    feedback: "Explain that the program asks the user to enter coffee and sandwich quantities.",
  },
  {
    id: "example",
    label: "Example order and result",
    feedback: "Include an example order with quantities and the expected total.",
  },
  {
    id: "invalid-input",
    label: "Invalid input handling",
    feedback:
      "Mention how invalid input is handled, such as a friendly message instead of a crash.",
  },
];

function hasAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function productPricePatterns(item: string, price: number): RegExp[] {
  const amount = String(price);
  return [
    new RegExp(`\\b${item}\\b[^\\n]{0,80}?\\$\\s*${amount}(?:\\.0{1,2})?\\b`, "i"),
    new RegExp(`\\$\\s*${amount}(?:\\.0{1,2})?\\b[^\\n]{0,80}?\\b${item}\\b`, "i"),
    new RegExp(
      `\\b${item}\\b[^\\n]{0,60}?\\b${amount}(?:\\.0{1,2})?\\s*(?:usd|dollars?|each|per)\\b`,
      "i",
    ),
    new RegExp(
      `\\b${item}\\b[^\\n]{0,40}?\\b(?:costs?|prices?|priced|price\\s*(?:is|at|of)?|:|=|\\|)\\s*\\$?\\s*${amount}(?:\\.0{1,2})?\\b`,
      "i",
    ),
  ];
}

const COFFEE_PRICE_PATTERNS = productPricePatterns("coffees?", 3);
const SANDWICH_PRICE_PATTERNS = productPricePatterns("sandwich(?:es)?", 5);

export function analyzeCafeReadme(raw: string): CafeReadmeAnalysis {
  const content = raw.replace(/\r\n/g, "\n");
  const trimmed = content.trim();
  const length = trimmed.length;
  const meaningful = length >= CAFE_README_MIN_LENGTH && /[a-z0-9]/i.test(trimmed);

  const lower = content.toLowerCase();

  const hasCoffee = /\bcoffees?\b/.test(lower);
  const hasSandwich = /\bsandwich(?:es)?\b/.test(lower);
  const hasCoffeePrice = hasAny(content, COFFEE_PRICE_PATTERNS);
  const hasSandwichPrice = hasAny(content, SANDWICH_PRICE_PATTERNS);

  const purpose = hasAny(content, [
    /\bcaf[eé]\b[\s\S]{0,220}\b(?:calculat|order|total|price|receipt|program|application|app|script|bill)\w*/i,
    /\b(?:coffee|sandwich)\b[\s\S]{0,220}\b(?:calculat|order|total|price|receipt|program|application|app|script|bill)\w*/i,
    /\b(?:this|the)\s+(?:program|application|app|script|tool)\b[\s\S]{0,180}\b(?:calculat|total|price|order|receipt)\w*/i,
    /\b(?:calculat|total)\w*[\s\S]{0,140}\b(?:caf[eé]|coffee|order)\b/i,
  ]);

  const hasTenPercent = /\b10\s*%|\bten\s+percent\b/i.test(content);
  const hasDiscountWord = /\bdiscount(?:s|ed)?\b|\b10\s*%\s*off\b|\bten\s+percent\s+off\b/i.test(
    content,
  );
  const hasTwentyDollars =
    /\$\s*20(?:\.0{1,2})?\b|\b20(?:\.0{1,2})?\s*(?:usd|dollars?)\b|\btwenty(?:\s+(?:usd|dollars?))?\b|\b20\b/.test(
      content,
    );
  const discount = hasTenPercent && hasDiscountWord && hasTwentyDollars;

  const run = hasAny(content, [
    /\bpython(?:3)?\s+(?:-m\s+)?(?:\S+\/)?main\.py\b/i,
    /\b(?:run|execute|launch|start)\b[^\n]{0,50}\bmain\.py\b/i,
    /\bmain\.py\b[^\n]{0,50}\b(?:run|execute|launch|start)\b/i,
    /\bopen\b[^\n]{0,40}\bmain\.py\b[^\n]{0,40}\b(?:run|execute)\b/i,
  ]);

  const hasEntryLanguage =
    /\binput\b|\benter(?:s|ing|ed)?\b|\btype[ds]?\b|\bprompt(?:s|ed)?\b|\basks?\b|\bhow many\b|\bquantit(?:y|ies)\b/i.test(
      content,
    );
  const quantities = hasCoffee && hasSandwich && hasEntryLanguage;

  const hasExampleWord = /\bexample\b|\bsample\b|\bfor instance\b|\be\.g\.\b/i.test(content);
  const hasOrderNumbers = /\b\d+\s*(?:coffees?|sandwiches?)\b/i.test(content);
  const hasMoneyValue =
    /\$\s*\d+(?:\.\d{1,2})?|\b\d+(?:\.\d{1,2})?\s*(?:usd|dollars?)\b|\b(?:sub\s*total|total|discount)\b[^\n]{0,50}\d/i.test(
      content,
    );
  const example = hasExampleWord && (hasOrderNumbers || hasMoneyValue);

  const hasInvalidLanguage =
    /\binvalid\b|\berror\b|\bnegative\b|\bnon-?numeric\b|\bnot a (?:valid |whole )?number\b|\bwhole number\b|\bbad input\b|\bwrong input\b/i.test(
      content,
    );
  const hasHandlingLanguage =
    /\bhandl\w*|\bmessage\b|\breject\w*|\bfriendly\b|\bagain\b|\bexplain\w*|\bdisplay\w*|\bshow\w*|\bignore\w*|\bcrash\w*|\bstop\w*|\bprevent\w*|\bexit\w*|\bprint\w*|\bwarn\w*|\bvalidat\w*/i.test(
      content,
    );
  const invalidInput = hasInvalidLanguage && hasHandlingLanguage;

  const passedById: Record<CafeReadmeRequirementId, boolean> = {
    purpose: meaningful && purpose,
    products: meaningful && hasCoffee && hasSandwich && hasCoffeePrice && hasSandwichPrice,
    discount: meaningful && discount,
    run: meaningful && run,
    quantities: meaningful && quantities,
    example: meaningful && example,
    "invalid-input": meaningful && invalidInput,
  };

  const requirements = CAFE_README_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    passed: passedById[requirement.id],
  }));
  const missing = requirements.filter((item) => !item.passed).map((item) => item.label);

  let summary: string;
  if (!meaningful) {
    summary =
      length === 0
        ? "README.md is empty. Write a short description and the required project sections."
        : "README.md is too short to count as project documentation. Add a description and the required sections.";
  } else if (missing.length === 0) {
    summary = "README.md documents every required part of the café calculator.";
  } else {
    summary = `README.md is missing documentation for: ${missing.join(", ")}.`;
  }

  return {
    meaningful,
    length,
    requirements,
    missing,
    ok: meaningful && missing.length === 0,
    summary,
  };
}
