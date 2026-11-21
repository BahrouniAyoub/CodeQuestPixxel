import { describe, expect, it, vi } from "vitest";
import {
  createCafeDocSaveRecord,
  initialCafeDocProgress,
  isCafeDeliveryReady,
  isCafeDocumentationVerified,
} from "./cafeDocProgress";
import { createCafeDocStore, type CafeDocPersistence } from "./cafeDocStore";

function memoryPersistence(initial?: unknown) {
  let stored = initial;
  const persistence: CafeDocPersistence = {
    load: vi.fn(async () => stored),
    save: vi.fn(async (record) => {
      stored = record;
      return true;
    }),
  };
  return {
    persistence,
    read: () => stored,
  };
}

describe("café documentation store", () => {
  it("hydrates an empty save without inventing verification", async () => {
    const { persistence } = memoryPersistence(undefined);
    const store = createCafeDocStore(persistence);

    await store.getState().hydrate();

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().hasSavedRecord).toBe(false);
    expect(store.getState().progress).toEqual(initialCafeDocProgress);
    expect(isCafeDocumentationVerified(store.getState().progress)).toBe(false);
  });

  it("persists README verification and a passing final check", async () => {
    const { persistence, read } = memoryPersistence(undefined);
    const store = createCafeDocStore(persistence);

    await store.getState().hydrate();
    const verification = await store
      .getState()
      .recordDocumentationVerified("readme-1", "2026-01-02T09:00:00.000Z");
    expect(verification).toEqual({ ok: true, alreadyVerified: false });

    const check = await store.getState().recordDeliveryCheck({
      passed: true,
      projectSignature: "project-1",
      checkedAt: "2026-01-02T10:00:00.000Z",
    });
    expect(check).toEqual({ ok: true });

    expect(isCafeDeliveryReady(store.getState().progress)).toBe(true);
    expect(persistence.save).toHaveBeenCalledTimes(2);
    expect(read()).toMatchObject({
      version: 1,
      progress: {
        documentation: { readmeSignature: "readme-1" },
        delivery: { finalCheckPassed: true, projectSignature: "project-1" },
      },
    });
  });

  it("survives a reload with the same readiness state", async () => {
    const { persistence, read } = memoryPersistence(undefined);
    const first = createCafeDocStore(persistence);

    await first.getState().hydrate();
    await first.getState().recordDocumentationVerified("readme-1");
    await first.getState().recordDeliveryCheck({ passed: true, projectSignature: "project-1" });

    const second = createCafeDocStore(memoryPersistence(read()).persistence);
    await second.getState().hydrate();

    expect(second.getState().hasSavedRecord).toBe(true);
    expect(isCafeDeliveryReady(second.getState().progress)).toBe(true);
  });

  it("does not duplicate an identical README verification", async () => {
    const { persistence } = memoryPersistence(undefined);
    const store = createCafeDocStore(persistence);

    await store.getState().hydrate();
    await store.getState().recordDocumentationVerified("readme-1");
    const again = await store.getState().recordDocumentationVerified("readme-1");

    expect(again).toEqual({ ok: true, alreadyVerified: true });
    expect(persistence.save).toHaveBeenCalledTimes(1);
  });

  it("refuses to overwrite a save it could not load", async () => {
    const persistence: CafeDocPersistence = {
      load: vi.fn(async () => {
        throw new Error("storage offline");
      }),
      save: vi.fn(async () => true),
    };
    const store = createCafeDocStore(persistence);

    const result = await store.getState().recordDocumentationVerified("readme-1");

    expect(result.ok).toBe(false);
    expect(store.getState().hydrated).toBe(false);
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it("falls back safely when the saved record is invalid", async () => {
    const { persistence } = memoryPersistence({ version: 99, progress: {} });
    const store = createCafeDocStore(persistence);

    await store.getState().hydrate();

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().hasSavedRecord).toBe(false);
    expect(store.getState().error).toMatch(/invalid/i);
    expect(store.getState().progress).toEqual(initialCafeDocProgress);
  });

  it("does not update state when persistence reports a failed save", async () => {
    const persistence: CafeDocPersistence = {
      load: vi.fn(async () => undefined),
      save: vi.fn(async () => false),
    };
    const store = createCafeDocStore(persistence);

    await store.getState().hydrate();
    const result = await store.getState().recordDocumentationVerified("readme-1");

    expect(result.ok).toBe(false);
    expect(store.getState().progress).toEqual(initialCafeDocProgress);
    expect(store.getState().error).toMatch(/could not save/i);
  });

  it("accepts a valid pre-existing record without resetting it", async () => {
    const saved = createCafeDocSaveRecord({
      documentation: {
        verifiedAt: "2026-01-02T09:00:00.000Z",
        readmeSignature: "readme-1",
      },
      delivery: {
        finalCheckPassed: true,
        checkedAt: "2026-01-02T10:00:00.000Z",
        projectSignature: "project-1",
      },
    });
    const store = createCafeDocStore(memoryPersistence(saved).persistence);

    await store.getState().hydrate();

    expect(store.getState().hasSavedRecord).toBe(true);
    expect(store.getState().progress).toEqual(saved.progress);
  });
});
