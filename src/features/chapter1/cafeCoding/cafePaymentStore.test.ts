import { describe, expect, it, vi } from "vitest";
import { CAFE_CALCULATOR_JOB_ID } from "@/features/browser/data/gigboardJobs";
import {
  CAFE_PAYMENT_SAVE_VERSION,
  createCafePaymentRecord,
  createCafePaymentSaveRecord,
} from "./cafePayment";
import { createCafePaymentStore } from "./cafePaymentStore";

function payment(id = "sub-store") {
  const record = createCafePaymentRecord({
    jobId: CAFE_CALCULATOR_JOB_ID,
    submissionId: id,
    claimedAt: "2026-01-02T16:00:00.000Z",
  });
  if (!record) throw new Error("payment fixture was rejected");
  return record;
}

function persistence(initial?: unknown) {
  let stored = initial;
  return {
    load: vi.fn(async () => stored),
    peek: () => stored,
    seed: (value: unknown) => {
      stored = value;
    },
  };
}

describe("café payment store", () => {
  it("hydrates a valid persisted payment without touching it", async () => {
    const saved = persistence(createCafePaymentSaveRecord(payment()));
    const store = createCafePaymentStore(saved);

    await store.getState().hydrate();

    expect(store.getState().payment?.paymentId).toBe("pay-sub-store");
    expect(store.getState().invalidRecord).toBe(false);
    expect(store.getState().error).toBeNull();
  });

  it("treats a missing record as an unclaimed fresh save", async () => {
    const store = createCafePaymentStore(persistence());
    await store.getState().hydrate();
    expect(store.getState().payment).toBeNull();
    expect(store.getState().invalidRecord).toBe(false);
  });

  it("blocks claims when a stored payment fails validation", async () => {
    const record = payment();
    const saved = persistence({
      version: CAFE_PAYMENT_SAVE_VERSION,
      payment: { ...record, amount: 100 },
    });
    const store = createCafePaymentStore(saved);

    await store.getState().hydrate();

    expect(store.getState().payment).toBeNull();
    expect(store.getState().invalidRecord).toBe(true);
    expect(store.getState().error).toMatch(/invalid and was not loaded/);
    expect(saved.peek()).toMatchObject({ payment: { amount: 100 } });
  });

  it("keeps hydration false when storage cannot be read", async () => {
    const store = createCafePaymentStore({
      load: vi.fn(async () => {
        throw new Error("storage offline");
      }),
    });

    await store.getState().hydrate();

    expect(store.getState().hydrated).toBe(false);
    expect(store.getState().error).toMatch(/storage offline/);
  });

  it("adopts an atomic commit without issuing another write", async () => {
    const saved = persistence();
    const store = createCafePaymentStore(saved);
    const record = payment();

    store.getState().adopt(record);

    expect(store.getState().payment).toEqual(record);
    expect(saved.load).not.toHaveBeenCalled();
  });
});
