import { describe, expect, it } from "vitest";
import { CAFE_README_MIN_LENGTH, analyzeCafeReadme } from "./cafeDocReadme";

const COMPLETE_README = `# Café Order Calculator

This Python application calculates café orders and prints a readable receipt.

## Products
- Coffee: $3
- Sandwich: $5

## Discount
Orders of $20 or more receive 10% off. Smaller orders pay the full price.

## Run
python main.py

## Using the program
Enter the number of coffees and sandwiches when prompted.

## Example
Example: 2 coffees and 3 sandwiches = $21.00, with a 10% discount of $2.10, total $18.90.

## Invalid input
Negative or non-numeric input shows a friendly message and asks again instead of crashing.
`;

describe("café README analysis", () => {
  it("accepts a README that documents every required area", () => {
    const analysis = analyzeCafeReadme(COMPLETE_README);

    expect(analysis.meaningful).toBe(true);
    expect(analysis.ok).toBe(true);
    expect(analysis.missing).toEqual([]);
    expect(analysis.requirements).toHaveLength(7);
    expect(analysis.requirements.every((requirement) => requirement.passed)).toBe(true);
    expect(analysis.summary).toMatch(/documents every required part/i);
  });

  it("rejects an empty README with an actionable message", () => {
    const analysis = analyzeCafeReadme("   \n\n");

    expect(analysis.meaningful).toBe(false);
    expect(analysis.ok).toBe(false);
    expect(analysis.summary).toMatch(/empty/i);
    expect(analysis.requirements.every((requirement) => !requirement.passed)).toBe(true);
  });

  it("rejects a file that is too short to be meaningful documentation", () => {
    const analysis = analyzeCafeReadme("Coffee $3 Sandwich $5");

    expect(analysis.meaningful).toBe(false);
    expect(analysis.ok).toBe(false);
    expect(analysis.length).toBeLessThan(CAFE_README_MIN_LENGTH);
    expect(analysis.summary).toMatch(/too short/i);
  });

  it("names each missing documentation area specifically", () => {
    const analysis = analyzeCafeReadme(
      "This café application calculates coffee orders.\n\nCoffee costs $3 and a sandwich costs $5.\n",
    );

    expect(analysis.meaningful).toBe(true);
    expect(analysis.ok).toBe(false);
    expect(analysis.missing).toEqual(
      expect.arrayContaining([
        "10% discount at $20 or more",
        "How to run main.py",
        "Entering coffee and sandwich quantities",
        "Example order and result",
        "Invalid input handling",
      ]),
    );
    expect(analysis.summary).toMatch(/missing documentation for/i);
    expect(analysis.summary).toMatch(/discount/i);
  });

  it("accepts equivalent Markdown structure and ordinary wording", () => {
    const analysis = analyzeCafeReadme(`# Coffee shop bill calculator
This script totals customer orders for a small café.

| Item | Price |
| --- | --- |
| Coffee | 3 dollars |
| Sandwich | 5 dollars |

A ten percent discount applies when the order reaches twenty dollars.

Run it with python3 main.py.
The script prompts for how many coffees and sandwiches you want.
For instance, 4 coffees and 2 sandwiches produce a total of $22.00 before the discount.
If someone types bad input, the program prints a warning and lets them try again.
`);

    expect(analysis.ok).toBe(true);
    expect(analysis.missing).toEqual([]);
  });
});
