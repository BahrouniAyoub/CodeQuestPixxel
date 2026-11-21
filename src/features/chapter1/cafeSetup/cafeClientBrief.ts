/** The scripted client brief shown for the accepted café project. */
export const CAFE_CLIENT_BRIEF_INTRO =
  "Thanks for taking the café calculator job. I run a small café and need a simple Python program that takes a customer's order and prints a receipt. Please keep it readable and reliable.";

export const CAFE_CLIENT_BRIEF_REQUIREMENTS = [
  "Coffee costs $3.",
  "A sandwich costs $5.",
  "Customers enter the quantity of each item they want.",
  "Calculate the subtotal from the entered quantities.",
  "Apply a 10% discount when the subtotal is at least $20.",
  "Print a readable customer receipt.",
  "Handle zero quantities correctly.",
  "Reject negative quantities and invalid numeric input gracefully.",
] as const;

export const CAFE_CLIENT_BRIEF_SIGN_OFF = "— Alex Morgan, Café Owner";
