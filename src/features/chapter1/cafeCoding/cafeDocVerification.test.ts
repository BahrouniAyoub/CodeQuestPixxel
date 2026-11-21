import { describe, expect, it, vi } from "vitest";
import type { FsEntry } from "@/services/filesystem/types";
import { readmeFingerprint } from "./cafeDelivery";
import { CAFE_DOC_README_PATH } from "./cafeDocTask";
import { verifyCafeDocumentationFromSavedFile } from "./cafeDocVerification";

const COMPLETE_README = `# Café Order Calculator

This application calculates café orders and prints a receipt.

- Coffee: $3
- Sandwich: $5

Orders of $20 or more receive 10% off.

Run it with python main.py.
Enter the number of coffees and sandwiches when prompted.
Example: 2 coffees and 3 sandwiches total $18.90 after the discount.
Invalid or negative input shows a friendly message instead of crashing.
`;

function file(path: string, content: string): FsEntry {
  return { path, kind: "file", content, updatedAt: 0 };
}

describe("saved README verification", () => {
  it("stays locked until all four development tasks are complete", async () => {
    const readEntry = vi.fn(async () => file(CAFE_DOC_README_PATH, COMPLETE_README));
    const recordVerified = vi.fn();

    const result = await verifyCafeDocumentationFromSavedFile(
      { developmentComplete: false, openFilePath: null, openFileDirty: false },
      { readEntry, recordVerified },
    );

    expect(result).toMatchObject({ ok: false, kind: "locked" });
    expect(readEntry).not.toHaveBeenCalled();
    expect(recordVerified).not.toHaveBeenCalled();
  });

  it("blocks verification while README.md has unsaved changes", async () => {
    const readEntry = vi.fn(async () => file(CAFE_DOC_README_PATH, COMPLETE_README));

    const result = await verifyCafeDocumentationFromSavedFile(
      {
        developmentComplete: true,
        openFilePath: CAFE_DOC_README_PATH,
        openFileDirty: true,
      },
      { readEntry, recordVerified: vi.fn() },
    );

    expect(result).toMatchObject({ ok: false, kind: "unsaved-changes" });
    expect(readEntry).not.toHaveBeenCalled();
  });

  it("reports a missing README.md", async () => {
    const result = await verifyCafeDocumentationFromSavedFile(
      { developmentComplete: true, openFilePath: null, openFileDirty: false },
      { readEntry: vi.fn(async () => undefined), recordVerified: vi.fn() },
    );

    expect(result).toMatchObject({ ok: false, kind: "missing-file" });
    if (!result.ok && result.kind === "missing-file") {
      expect(result.reason).toMatch(/README\.md was not found/);
    }
  });

  it("lists the specific missing documentation without recording it", async () => {
    const recordVerified = vi.fn();
    const result = await verifyCafeDocumentationFromSavedFile(
      { developmentComplete: true, openFilePath: null, openFileDirty: false },
      {
        readEntry: vi.fn(async () =>
          file(
            CAFE_DOC_README_PATH,
            "This café application calculates orders. Coffee costs $3 and a sandwich costs $5.",
          ),
        ),
        recordVerified,
      },
    );

    expect(result).toMatchObject({ ok: false, kind: "incomplete" });
    if (!result.ok && result.kind === "incomplete") {
      expect(result.analysis.missing).toEqual(
        expect.arrayContaining(["How to run main.py", "Invalid input handling"]),
      );
      expect(result.reason).toMatch(/discount/i);
    }
    expect(recordVerified).not.toHaveBeenCalled();
  });

  it("reads the saved content and records its signature", async () => {
    const readEntry = vi.fn(async () => file(CAFE_DOC_README_PATH, COMPLETE_README));
    const recordVerified = vi.fn(async () => ({ ok: true as const, alreadyVerified: false }));

    const result = await verifyCafeDocumentationFromSavedFile(
      { developmentComplete: true, openFilePath: null, openFileDirty: false },
      { readEntry, recordVerified },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("verified");
      expect(result.signature).toBe(readmeFingerprint(COMPLETE_README));
      expect(result.analysis.ok).toBe(true);
    }
    expect(recordVerified).toHaveBeenCalledWith(readmeFingerprint(COMPLETE_README));
  });

  it("maps a persistence failure to a clear save failure", async () => {
    const result = await verifyCafeDocumentationFromSavedFile(
      { developmentComplete: true, openFilePath: null, openFileDirty: false },
      {
        readEntry: vi.fn(async () => file(CAFE_DOC_README_PATH, COMPLETE_README)),
        recordVerified: vi.fn(async () => ({
          ok: false as const,
          reason: "Could not save your documentation verification.",
        })),
      },
    );

    expect(result).toMatchObject({ ok: false, kind: "save-failed" });
    if (!result.ok) expect(result.reason).toMatch(/Could not save/);
  });
});
