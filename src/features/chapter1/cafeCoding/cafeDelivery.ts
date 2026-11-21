/**
 * Pure delivery-readiness rules for the café project.
 *
 * Readiness is never stored as a single button click. It is derived from saved
 * development progress, verified README content, and the content signatures
 * captured by the last successful final check. Changing a project file after a
 * check therefore moves the project back to "Final Checks Required".
 */
import { CAFE_PROJECT_DIRECTORY, CAFE_PROJECT_REQUIRED_FILES } from "../cafeSetup/cafeSetupTasks";
import type { FsEntry } from "@/services/filesystem/types";

export type CafeDeliveryStatus = "in-development" | "final-checks-required" | "ready-for-delivery";

export interface CafeDeliveryStatusInput {
  readonly developmentComplete: boolean;
  readonly setupComplete: boolean;
  /** README verification exists and still matches the saved README. */
  readonly documentationVerified: boolean;
  /** Last final check passed and still matches the saved project files. */
  readonly finalCheckPassed: boolean;
}

export function evaluateCafeDeliveryStatus(input: CafeDeliveryStatusInput): CafeDeliveryStatus {
  if (!input.developmentComplete) return "in-development";
  if (input.setupComplete && input.documentationVerified && input.finalCheckPassed) {
    return "ready-for-delivery";
  }
  return "final-checks-required";
}

export function cafeDeliveryStatusLabel(status: CafeDeliveryStatus): string {
  switch (status) {
    case "in-development":
      return "In Development";
    case "final-checks-required":
      return "Final Checks Required";
    case "ready-for-delivery":
      return "Ready for Delivery";
  }
}

/** Small deterministic, non-cryptographic content fingerprint. */
export function fingerprintText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function readmeFingerprint(content: string): string {
  return fingerprintText(content.replace(/\r\n/g, "\n"));
}

export interface CafeProjectFileContents {
  readonly readme: string;
  readonly calculator: string;
  readonly main: string;
}

/**
 * Fingerprint the files that define delivery readiness. PLAN.md must exist but
 * its prose is not part of the executable project signature.
 */
export function cafeProjectFingerprint(files: CafeProjectFileContents): string {
  return fingerprintText(
    [
      `readme:${files.readme.replace(/\r\n/g, "\n")}`,
      `calculator:${files.calculator.replace(/\r\n/g, "\n")}`,
      `main:${files.main.replace(/\r\n/g, "\n")}`,
    ].join("\u0000"),
  );
}

export interface CafeProjectSnapshot {
  readonly readme: string | null;
  readonly calculator: string | null;
  readonly main: string | null;
  readonly plan: string | null;
  readonly missingFiles: readonly string[];
  /** Present only when README.md exists. */
  readonly readmeSignature: string | null;
  /** Present only when all three project files exist. */
  readonly projectSignature: string | null;
}

export interface CafeProjectSnapshotFileSystem {
  readonly getEntry: (path: string) => Promise<FsEntry | undefined>;
}

export const EMPTY_CAFE_PROJECT_SNAPSHOT: CafeProjectSnapshot = {
  readme: null,
  calculator: null,
  main: null,
  plan: null,
  missingFiles: [...CAFE_PROJECT_REQUIRED_FILES],
  readmeSignature: null,
  projectSignature: null,
};

/**
 * Read the saved project files needed to derive delivery status. Missing files
 * become explicit entries instead of silently producing a ready state.
 */
export async function readCafeProjectSnapshot(
  fileSystem: CafeProjectSnapshotFileSystem,
): Promise<CafeProjectSnapshot> {
  const contents = new Map<string, string>();
  const missingFiles: string[] = [];

  for (const fileName of CAFE_PROJECT_REQUIRED_FILES) {
    const path = `${CAFE_PROJECT_DIRECTORY}/${fileName}`;
    try {
      const entry = await fileSystem.getEntry(path);
      if (!entry || entry.kind !== "file") {
        missingFiles.push(fileName);
        continue;
      }
      contents.set(fileName, entry.content ?? "");
    } catch {
      missingFiles.push(fileName);
    }
  }

  const readme = contents.get("README.md") ?? null;
  const calculator = contents.get("calculator.py") ?? null;
  const main = contents.get("main.py") ?? null;

  return {
    readme,
    calculator,
    main,
    plan: contents.get("PLAN.md") ?? null,
    missingFiles,
    readmeSignature: readme === null ? null : readmeFingerprint(readme),
    projectSignature:
      readme === null || calculator === null || main === null
        ? null
        : cafeProjectFingerprint({ readme, calculator, main }),
  };
}
