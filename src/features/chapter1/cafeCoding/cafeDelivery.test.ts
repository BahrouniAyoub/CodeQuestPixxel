import { describe, expect, it, vi } from "vitest";
import type { FsEntry } from "@/services/filesystem/types";
import {
  cafeDeliveryStatusLabel,
  cafeProjectFingerprint,
  evaluateCafeDeliveryStatus,
  fingerprintText,
  readCafeProjectSnapshot,
  readmeFingerprint,
} from "./cafeDelivery";

const FILES = {
  readme: "# Café Calculator\n\nCalculates coffee and sandwich orders.",
  calculator:
    "def calculate_total(coffees, sandwiches):\n    return coffees * 3 + sandwiches * 5\n",
  main: "from calculator import calculate_total\nprint(calculate_total(2, 3))\n",
};

describe("café delivery status", () => {
  it("is in development until all four coding tasks are verified", () => {
    expect(
      evaluateCafeDeliveryStatus({
        developmentComplete: false,
        setupComplete: true,
        documentationVerified: true,
        finalCheckPassed: true,
      }),
    ).toBe("in-development");
  });

  it("requires setup, documentation, and a final check after development", () => {
    expect(
      evaluateCafeDeliveryStatus({
        developmentComplete: true,
        setupComplete: false,
        documentationVerified: true,
        finalCheckPassed: true,
      }),
    ).toBe("final-checks-required");
    expect(
      evaluateCafeDeliveryStatus({
        developmentComplete: true,
        setupComplete: true,
        documentationVerified: false,
        finalCheckPassed: true,
      }),
    ).toBe("final-checks-required");
    expect(
      evaluateCafeDeliveryStatus({
        developmentComplete: true,
        setupComplete: true,
        documentationVerified: true,
        finalCheckPassed: false,
      }),
    ).toBe("final-checks-required");
  });

  it("is ready only when every readiness condition holds", () => {
    expect(
      evaluateCafeDeliveryStatus({
        developmentComplete: true,
        setupComplete: true,
        documentationVerified: true,
        finalCheckPassed: true,
      }),
    ).toBe("ready-for-delivery");
  });

  it("uses the required player-facing labels", () => {
    expect(cafeDeliveryStatusLabel("in-development")).toBe("In Development");
    expect(cafeDeliveryStatusLabel("final-checks-required")).toBe("Final Checks Required");
    expect(cafeDeliveryStatusLabel("ready-for-delivery")).toBe("Ready for Delivery");
  });
});

describe("café project fingerprints", () => {
  it("normalizes line endings for README signatures", () => {
    expect(readmeFingerprint("a\r\nb\r\n")).toBe(readmeFingerprint("a\nb\n"));
    expect(readmeFingerprint("a\nb\n")).toBe(fingerprintText("a\nb\n"));
  });

  it("changes the project signature when any signed file changes", () => {
    const base = cafeProjectFingerprint(FILES);

    expect(cafeProjectFingerprint(FILES)).toBe(base);
    expect(cafeProjectFingerprint({ ...FILES, readme: FILES.readme + "\n" })).not.toBe(base);
    expect(cafeProjectFingerprint({ ...FILES, calculator: FILES.calculator + "\n" })).not.toBe(
      base,
    );
    expect(cafeProjectFingerprint({ ...FILES, main: FILES.main + "\n" })).not.toBe(base);
  });
});

describe("café project snapshots", () => {
  const directory = "/Projects/Python/cafe-calculator";

  function entry(name: string, content: string): [string, FsEntry] {
    const path = `${directory}/${name}`;
    return [path, { path, kind: "file", content, updatedAt: 0 }];
  }

  it("reads saved files and exposes stable signatures", async () => {
    const entries = new Map([
      entry("README.md", FILES.readme),
      entry("calculator.py", FILES.calculator),
      entry("main.py", FILES.main),
      entry("PLAN.md", "Build the calculator."),
    ]);

    const snapshot = await readCafeProjectSnapshot({
      getEntry: vi.fn(async (path: string) => entries.get(path)),
    });

    expect(snapshot.missingFiles).toEqual([]);
    expect(snapshot.readmeSignature).toBe(readmeFingerprint(FILES.readme));
    expect(snapshot.projectSignature).toBe(cafeProjectFingerprint(FILES));
  });

  it("reports missing files instead of silently producing readiness", async () => {
    const entries = new Map([entry("calculator.py", FILES.calculator)]);

    const snapshot = await readCafeProjectSnapshot({
      getEntry: vi.fn(async (path: string) => entries.get(path)),
    });

    expect(snapshot.missingFiles).toEqual(
      expect.arrayContaining(["README.md", "main.py", "PLAN.md"]),
    );
    expect(snapshot.readmeSignature).toBeNull();
    expect(snapshot.projectSignature).toBeNull();
  });

  it("treats a filesystem read failure as a missing file", async () => {
    const snapshot = await readCafeProjectSnapshot({
      getEntry: vi.fn(async (path: string) => {
        if (path.endsWith("README.md")) throw new Error("read failure");
        const name = path.split("/").pop() ?? "";
        return { path, kind: "file", content: name, updatedAt: 0 } satisfies FsEntry;
      }),
    });

    expect(snapshot.missingFiles).toContain("README.md");
  });
});
