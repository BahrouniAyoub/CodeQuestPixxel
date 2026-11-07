import { describe, expect, it, vi, type Mock } from "vitest";
import {
  ALEX_ACCEPTANCE_MESSAGE,
  GIGBOARD_APPLICATION_VERSION,
  GIGBOARD_PROPOSAL_MIN_LENGTH,
  type GigboardApplicationSaveRecord,
} from "./data/gigboardApplication";
import { CAFE_CALCULATOR_JOB_ID } from "./data/gigboardJobs";
import {
  GIGBOARD_APPLICATION_STORAGE_KEY,
  GIGBOARD_APPLICATION_STORAGE_STORE,
  createGigboardApplicationStore,
} from "./gigboardApplicationStore";

const VALID_PROPOSAL =
  "I would build the café order calculator as a clean Python script with variables, totals, and a readable receipt. I can deliver it this week.";

function submittedRecord(
  overrides: Partial<GigboardApplicationSaveRecord["application"]> = {},
): GigboardApplicationSaveRecord {
  return {
    version: GIGBOARD_APPLICATION_VERSION,
    application: {
      jobId: CAFE_CALCULATOR_JOB_ID,
      proposal: VALID_PROPOSAL,
      status: "submitted",
      submittedAt: "2026-01-02T09:30:00.000Z",
      acceptedAt: null,
      acceptanceMessage: null,
      ...overrides,
    },
  };
}

function acceptedRecord(): GigboardApplicationSaveRecord {
  return submittedRecord({
    status: "accepted",
    acceptedAt: "2026-01-02T10:00:00.000Z",
    acceptanceMessage: ALEX_ACCEPTANCE_MESSAGE,
  });
}

interface Harness {
  store: ReturnType<typeof createGigboardApplicationStore>;
  load: Mock<() => Promise<unknown>>;
  save: Mock<(record: GigboardApplicationSaveRecord) => Promise<boolean>>;
  saved: GigboardApplicationSaveRecord[];
}

function makeStore(
  raw: unknown,
  saveResult: (record: GigboardApplicationSaveRecord) => Promise<boolean> = async () => true,
): Harness {
  const saved: GigboardApplicationSaveRecord[] = [];
  const load = vi.fn(async () => raw);
  const save = vi.fn(async (record: GigboardApplicationSaveRecord) => {
    const ok = await saveResult(record);
    if (ok) saved.push(record);
    return ok;
  });
  const store = createGigboardApplicationStore({ load, save });
  return { store, load, save, saved };
}

describe("GigBoard application store", () => {
  it("starts with no application and is not hydrated", () => {
    const { store } = makeStore(undefined);
    const state = store.getState();

    expect(state.application).toBeNull();
    expect(state.hydrated).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("hydrates to not-applied when no saved record exists", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.store.getState().application).toBeNull();
    expect(h.store.getState().hydrated).toBe(true);
    expect(h.store.getState().error).toBeNull();
  });

  it("restores a submitted application after reload", async () => {
    const h = makeStore(submittedRecord());

    await h.store.getState().hydrate();

    expect(h.store.getState().application).toEqual(submittedRecord().application);
    expect(h.store.getState().application?.status).toBe("submitted");
    expect(h.store.getState().hydrated).toBe(true);
  });

  it("restores a scripted acceptance after reload", async () => {
    const h = makeStore(acceptedRecord());

    await h.store.getState().hydrate();

    expect(h.store.getState().application?.status).toBe("accepted");
    expect(h.store.getState().application?.acceptanceMessage).toBe(ALEX_ACCEPTANCE_MESSAGE);
    expect(h.store.getState().application?.acceptedAt).toBe("2026-01-02T10:00:00.000Z");
  });

  it.each([
    ["wrong job", submittedRecord({ jobId: "GB-9999" as typeof CAFE_CALCULATOR_JOB_ID })],
    ["short proposal", submittedRecord({ proposal: "too short" })],
    [
      "forged acceptance",
      submittedRecord({ status: "accepted", acceptanceMessage: "You are hired." }),
    ],
    [
      "submitted with acceptance metadata",
      submittedRecord({ acceptedAt: "2026-01-02T10:00:00.000Z" }),
    ],
    ["invalid timestamp", submittedRecord({ submittedAt: "not-a-date" })],
  ])("rejects invalid persisted data: %s", async (_label, raw) => {
    const h = makeStore(raw);

    await h.store.getState().hydrate();

    expect(h.store.getState().application).toBeNull();
    expect(h.store.getState().hydrated).toBe(true);
    expect(h.store.getState().error).toContain("invalid");
    expect(h.save).not.toHaveBeenCalled();
  });

  it("saves a valid proposal once and commits only after the write", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const result = await h.store.getState().submitApplication(`  ${VALID_PROPOSAL}  `);

    expect(result).toEqual({ ok: true });
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.saved[0]?.application).toMatchObject({
      jobId: CAFE_CALCULATOR_JOB_ID,
      proposal: VALID_PROPOSAL,
      status: "submitted",
      acceptedAt: null,
      acceptanceMessage: null,
    });
    expect(h.store.getState().application?.status).toBe("submitted");
    expect(h.store.getState().error).toBeNull();
  });

  it("rejects empty, short, and oversized proposals without writing", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    await expect(h.store.getState().submitApplication("")).resolves.toMatchObject({ ok: false });
    await expect(
      h.store.getState().submitApplication("x".repeat(GIGBOARD_PROPOSAL_MIN_LENGTH - 1)),
    ).resolves.toMatchObject({ ok: false });
    await expect(h.store.getState().submitApplication("x".repeat(1300))).resolves.toMatchObject({
      ok: false,
    });

    expect(h.save).not.toHaveBeenCalled();
    expect(h.store.getState().application).toBeNull();
  });

  it("prevents duplicate submissions", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();
    await h.store.getState().submitApplication(VALID_PROPOSAL);

    const duplicate = await h.store.getState().submitApplication("A second proposal should fail");

    expect(duplicate).toMatchObject({ ok: false });
    expect(duplicate.ok === false && duplicate.reason).toMatch(/already applied/i);
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(h.store.getState().application?.proposal).toBe(VALID_PROPOSAL);
  });

  it("prevents concurrent duplicate submissions with serialized saves", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const results = await Promise.all([
      h.store.getState().submitApplication(VALID_PROPOSAL),
      h.store.getState().submitApplication(VALID_PROPOSAL),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it("reports application save failures, keeps state empty, and allows retry", async () => {
    let allowSave = false;
    const h = makeStore(undefined, async () => allowSave);
    await h.store.getState().hydrate();

    const failed = await h.store.getState().submitApplication(VALID_PROPOSAL);

    expect(failed).toMatchObject({ ok: false });
    expect(h.store.getState().application).toBeNull();
    expect(h.store.getState().error).toContain("Could not save");
    expect(h.save).toHaveBeenCalledTimes(1);

    allowSave = true;
    await expect(h.store.getState().submitApplication(VALID_PROPOSAL)).resolves.toEqual({
      ok: true,
    });
    expect(h.store.getState().application?.status).toBe("submitted");
    expect(h.store.getState().error).toBeNull();
    expect(h.saved).toHaveLength(1);
  });

  it("does not accept an application that was never submitted", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();

    const result = await h.store.getState().acceptApplication();

    expect(result).toMatchObject({ ok: false });
    expect(h.save).not.toHaveBeenCalled();
  });

  it("applies the deterministic scripted acceptance and persists it", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();
    await h.store.getState().submitApplication(VALID_PROPOSAL);

    const result = await h.store.getState().acceptApplication();

    expect(result).toEqual({ ok: true });
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.saved[1]?.application).toMatchObject({
      status: "accepted",
      acceptanceMessage: ALEX_ACCEPTANCE_MESSAGE,
    });
    expect(h.saved[1]?.application.acceptedAt).toEqual(expect.any(String));
    expect(h.store.getState().application?.status).toBe("accepted");
  });

  it("does not write again when an accepted application is checked twice", async () => {
    const h = makeStore(acceptedRecord());
    await h.store.getState().hydrate();

    await expect(h.store.getState().acceptApplication()).resolves.toEqual({ ok: true });
    await expect(h.store.getState().acceptApplication()).resolves.toEqual({ ok: true });

    expect(h.save).not.toHaveBeenCalled();
  });

  it("keeps a submitted application when the acceptance save fails and allows retry", async () => {
    let allowSave = true;
    const h = makeStore(undefined, async () => allowSave);
    await h.store.getState().hydrate();
    await h.store.getState().submitApplication(VALID_PROPOSAL);

    allowSave = false;
    const failed = await h.store.getState().acceptApplication();

    expect(failed).toMatchObject({ ok: false });
    expect(h.store.getState().application?.status).toBe("submitted");
    expect(h.store.getState().error).toContain("Could not save");

    allowSave = true;
    await expect(h.store.getState().acceptApplication()).resolves.toEqual({ ok: true });
    expect(h.store.getState().application?.status).toBe("accepted");
    expect(h.saved.at(-1)?.application.acceptanceMessage).toBe(ALEX_ACCEPTANCE_MESSAGE);
  });

  it("blocks submissions when persisted data could not be loaded and retries hydration", async () => {
    const h = makeStore(undefined);
    h.load.mockRejectedValue(new Error("IndexedDB unavailable"));

    await h.store.getState().hydrate();
    expect(h.store.getState().hydrated).toBe(false);

    const blocked = await h.store.getState().submitApplication(VALID_PROPOSAL);
    expect(blocked).toMatchObject({ ok: false });
    expect(h.save).not.toHaveBeenCalled();

    h.load.mockResolvedValue(undefined);
    await h.store.getState().hydrate();
    expect(h.store.getState().hydrated).toBe(true);
    await expect(h.store.getState().submitApplication(VALID_PROPOSAL)).resolves.toEqual({
      ok: true,
    });
  });

  it("uses an isolated persistence key and never touches Chapter 1 or ticket keys", async () => {
    const h = makeStore(undefined);
    await h.store.getState().hydrate();
    await h.store.getState().submitApplication(VALID_PROPOSAL);

    expect(GIGBOARD_APPLICATION_STORAGE_STORE).toBe("progress");
    expect(GIGBOARD_APPLICATION_STORAGE_KEY).toBe("gigboard-application-cafe-calculator");
    expect(GIGBOARD_APPLICATION_STORAGE_KEY).not.toBe("chapter1");
    expect(GIGBOARD_APPLICATION_STORAGE_KEY).not.toBe("state");
    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.save).toHaveBeenCalledTimes(1);
  });
});
