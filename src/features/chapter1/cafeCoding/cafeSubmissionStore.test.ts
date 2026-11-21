import { describe, expect, it, vi } from "vitest";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  CAFE_SUBMISSION_SAVE_VERSION,
  approveCafeSubmission,
  cafeSubmittedFile,
  createCafeSubmissionRecord,
  type CafeSubmissionRecord,
} from "./cafeSubmission";
import { createCafeSubmissionStore, type CafeSubmissionPersistence } from "./cafeSubmissionStore";

const FILES = {
  "PLAN.md": "Plan",
  "calculator.py": "def calculate_total(c, s): return c * 3 + s * 5\n",
  "main.py": "import calculator\nprint(calculator.calculate_total(0, 0))\n",
  "README.md": "# Café Order Calculator\nCoffee $3, sandwiches $5, discount at $20.\n",
} as const;

function makeRecord(id = "sub-1"): CafeSubmissionRecord {
  const record = createCafeSubmissionRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: id,
    submittedAt: "2026-01-02T12:00:00.000Z",
    files: (Object.keys(FILES) as (keyof typeof FILES)[]).map((name) => ({
      name,
      content: FILES[name],
    })),
  });
  if (!record) throw new Error("test fixture record was rejected");
  return record;
}

function persistence(initial?: unknown) {
  let stored = initial;
  return {
    load: vi.fn(async () => stored),
    save: vi.fn(async (record: unknown) => {
      stored = record;
      return true;
    }),
    peek: () => stored,
    seed: (record: unknown) => {
      stored = record;
    },
  } satisfies CafeSubmissionPersistence & { peek: () => unknown; seed: (r: unknown) => void };
}

describe("café submission store", () => {
  it("hydrates a valid persisted snapshot and deep-validates it", async () => {
    const record = makeRecord();
    const valid = persistence({
      version: CAFE_SUBMISSION_SAVE_VERSION,
      submission: record,
    });
    const store = createCafeSubmissionStore(valid);

    await store.getState().hydrate();
    expect(store.getState().submission?.submissionId).toBe("sub-1");
    expect(store.getState().error).toBeNull();

    const invalid = persistence({
      version: CAFE_SUBMISSION_SAVE_VERSION,
      submission: { ...record, projectFingerprint: "deadbeef" },
    });
    const invalidStore = createCafeSubmissionStore(invalid);
    await invalidStore.getState().hydrate();
    expect(invalidStore.getState().submission).toBeNull();
    expect(invalidStore.getState().error).toMatch(/invalid and was not loaded/);
  });

  it("submits only once and never overwrites the first snapshot", async () => {
    const saved = persistence();
    const store = createCafeSubmissionStore(saved);
    const first = makeRecord("sub-first");

    const result = await store.getState().submit(first);
    expect(result).toEqual({ ok: true, created: true });
    expect(saved.save).toHaveBeenCalledTimes(1);

    const duplicate = await store.getState().submit(makeRecord("sub-second"));
    expect(duplicate).toEqual({ ok: true, created: false });
    expect(saved.save).toHaveBeenCalledTimes(1);
    expect(store.getState().submission?.submissionId).toBe("sub-first");
  });

  it("survives a reload with the submitted files unchanged", async () => {
    const saved = persistence();
    const firstStore = createCafeSubmissionStore(saved);
    await firstStore.getState().submit(makeRecord("sub-reload"));

    const reloaded = createCafeSubmissionStore(saved);
    await reloaded.getState().hydrate();
    const restored = reloaded.getState().submission;
    expect(restored?.submittedAt).toBe("2026-01-02T12:00:00.000Z");
    expect(cafeSubmittedFile(restored!, "README.md")).toBe(FILES["README.md"]);
    expect(restored?.projectFingerprint).toBe(makeRecord("sub-reload").projectFingerprint);
  });

  it("persists approval idempotently without touching the snapshot", async () => {
    const saved = persistence();
    const store = createCafeSubmissionStore(saved);
    const record = makeRecord();
    await store.getState().submit(record);

    const first = await store.getState().approve("2026-01-02T13:00:00.000Z");
    expect(first).toEqual({ ok: true, created: true });
    expect(store.getState().submission?.reviewStatus).toBe("approved");
    expect(store.getState().submission?.reviewedAt).toBe("2026-01-02T13:00:00.000Z");
    expect(store.getState().submission?.files).toEqual(record.files);

    const second = await store.getState().approve("2026-01-03T00:00:00.000Z");
    expect(second).toEqual({ ok: true, created: false });
    expect(saved.save).toHaveBeenCalledTimes(2);
    expect(store.getState().submission?.reviewedAt).toBe("2026-01-02T13:00:00.000Z");
  });

  it("keeps the in-memory state unchanged when saving fails", async () => {
    const saved = persistence();
    saved.save.mockResolvedValueOnce(false);
    const store = createCafeSubmissionStore(saved);
    const record = makeRecord();

    const result = await store.getState().submit(record);
    expect(result.ok).toBe(false);
    expect(store.getState().submission).toBeNull();
    expect(store.getState().error).toMatch(/Nothing was sent/);
  });

  it("refuses approval when no snapshot exists", async () => {
    const store = createCafeSubmissionStore(persistence());
    await store.getState().hydrate();
    expect((await store.getState().approve()).ok).toBe(false);
  });

  it("validates an approved record on hydration", async () => {
    const record = approveCafeSubmission(makeRecord(), "2026-01-02T13:00:00.000Z");
    if (!record) throw new Error("approval fixture was rejected");
    const store = createCafeSubmissionStore(
      persistence({ version: CAFE_SUBMISSION_SAVE_VERSION, submission: record }),
    );

    await store.getState().hydrate();
    expect(store.getState().submission?.reviewStatus).toBe("approved");
    expect(store.getState().submission?.reviewedAt).toBe("2026-01-02T13:00:00.000Z");
  });
});
