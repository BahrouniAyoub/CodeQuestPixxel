import {
  CAFE_PAYMENT_SAVE_VERSION,
  validateCafePaymentSaveRecord,
  type CafePaymentRecord,
} from "@/features/chapter1/cafeCoding/cafePayment";
import {
  CHAPTER1_SAVE_VERSION,
  createChapter1SaveRecord,
  validateChapter1SaveRecord,
} from "@/features/chapter1/chapter1Validation";
import type { Chapter1Progress } from "@/features/chapter1/chapter1Progress";
import { dbGet, dbGetAll, type StoreName } from "@/services/persistence/db";
import { trackedSave } from "@/services/persistence/saveStatus";

export const GAME_SAVE_VERSION = 1;
export const GAME_SAVE_STORE: StoreName = "progress";
export const GAME_SAVE_PREFIX = "codequest:save:";
export const QUICK_SAVE_KEY = `${GAME_SAVE_PREFIX}quick`;
export const SAVE_SLOT_KEYS = [1, 2, 3].map((slot) => `${GAME_SAVE_PREFIX}slot-${slot}`);

export interface CharacterSaveData {
  readonly name: string;
  readonly bodyIndex: number;
  readonly skinIndex: number;
  readonly hairStyleIndex: number;
  readonly hairColorIndex: number;
  readonly topIndex: number;
  readonly bottomIndex: number;
  readonly feetIndex: number;
}

export interface GameSaveRecord {
  readonly version: typeof GAME_SAVE_VERSION;
  readonly savedAt: string;
  readonly slot: string;
  readonly reason: string;
  readonly character: CharacterSaveData;
  readonly progress: Chapter1Progress;
  readonly payment: CafePaymentRecord | null;
}

export type GameSaveValidationResult =
  { ok: true; record: GameSaveRecord } | { ok: false; reason: string };

export const DEFAULT_CHARACTER: CharacterSaveData = {
  name: "Player",
  bodyIndex: 0,
  skinIndex: 0,
  hairStyleIndex: 0,
  hairColorIndex: 0,
  topIndex: 0,
  bottomIndex: 0,
  feetIndex: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readIndex(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= max) {
    return null;
  }
  return value;
}

export function parseCharacterSnapshot(value: unknown): CharacterSaveData | null {
  if (!isRecord(value)) return null;

  const rawName = value["name"] ?? value["character_name"] ?? value["characterName"];
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 24) : "";
  const bodyIndex = readIndex(value["body_index"] ?? value["bodyIndex"], 2);
  const skinIndex = readIndex(value["skin_index"] ?? value["skinIndex"], 18);
  const hairStyleIndex = readIndex(value["hair_style_index"] ?? value["hairStyleIndex"], 18);
  const hairColorIndex = readIndex(value["hair_color_index"] ?? value["hairColorIndex"], 12);
  const topIndex = readIndex(value["top_index"] ?? value["topIndex"], 18);
  const bottomIndex = readIndex(value["bottom_index"] ?? value["bottomIndex"], 18);
  const feetIndex = readIndex(value["feet_index"] ?? value["feetIndex"], 18);

  if (
    bodyIndex === null ||
    skinIndex === null ||
    hairStyleIndex === null ||
    hairColorIndex === null ||
    topIndex === null ||
    bottomIndex === null ||
    feetIndex === null
  ) {
    return null;
  }

  return {
    name: name || DEFAULT_CHARACTER.name,
    bodyIndex,
    skinIndex,
    hairStyleIndex,
    hairColorIndex,
    topIndex,
    bottomIndex,
    feetIndex,
  };
}

export function createGameSaveRecord(input: {
  readonly savedAt?: string;
  readonly slot: string;
  readonly reason: string;
  readonly character: CharacterSaveData;
  readonly progress: Chapter1Progress;
  readonly payment: CafePaymentRecord | null;
}): GameSaveRecord {
  return {
    version: GAME_SAVE_VERSION,
    savedAt: input.savedAt ?? new Date().toISOString(),
    slot: input.slot,
    reason: input.reason,
    character: { ...input.character },
    progress: createChapter1SaveRecord(input.progress).progress,
    payment: input.payment === null ? null : { ...input.payment },
  };
}

export function validateGameSaveRecord(raw: unknown): GameSaveValidationResult {
  if (!isRecord(raw)) return { ok: false, reason: "save record is not an object" };
  if (raw["version"] !== GAME_SAVE_VERSION) {
    return { ok: false, reason: "unsupported game save version" };
  }

  const slot = raw["slot"];
  if (typeof slot !== "string" || slot.length === 0) {
    return { ok: false, reason: "save slot is missing" };
  }
  const savedAt = raw["savedAt"];
  if (typeof savedAt !== "string" || Number.isNaN(Date.parse(savedAt))) {
    return { ok: false, reason: "save timestamp is invalid" };
  }
  const reason = typeof raw["reason"] === "string" ? raw["reason"] : "Saved game";
  const character = parseCharacterSnapshot(raw["character"]);
  if (character === null) return { ok: false, reason: "character snapshot is invalid" };

  const progress = validateChapter1SaveRecord({
    version: CHAPTER1_SAVE_VERSION,
    progress: raw["progress"],
  });
  if (!progress.ok) return { ok: false, reason: progress.reason };

  const payment = validateCafePaymentSaveRecord({
    version: CAFE_PAYMENT_SAVE_VERSION,
    payment: raw["payment"] ?? null,
  });
  if (!payment.ok) return { ok: false, reason: payment.reason };

  return {
    ok: true,
    record: {
      version: GAME_SAVE_VERSION,
      savedAt,
      slot,
      reason,
      character,
      progress: progress.progress,
      payment: payment.payment,
    },
  };
}

export function isGameSaveKey(key: string): boolean {
  return key.startsWith(GAME_SAVE_PREFIX);
}

export function getSaveSlotKey(slot: number): string {
  return `${GAME_SAVE_PREFIX}slot-${slot}`;
}

export async function saveGameRecord(
  record: GameSaveRecord,
  keys: readonly string[],
): Promise<boolean> {
  let saved = true;
  for (const key of keys) {
    const ok = await trackedSave(GAME_SAVE_STORE, key, record);
    saved = saved && ok;
  }
  return saved;
}

export async function readGameSave(key: string): Promise<GameSaveRecord | null> {
  const raw = await dbGet<unknown>(GAME_SAVE_STORE, key);
  if (raw === undefined) return null;
  const result = validateGameSaveRecord(raw);
  return result.ok ? result.record : null;
}

export async function listGameSaves(): Promise<GameSaveRecord[]> {
  const all = await dbGetAll<unknown>(GAME_SAVE_STORE);
  const records: GameSaveRecord[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (!isGameSaveKey(key)) continue;
    const result = validateGameSaveRecord(value);
    if (result.ok) records.push(result.record);
  }
  return records.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}

export async function findLatestGameSave(): Promise<GameSaveRecord | null> {
  const saves = await listGameSaves();
  return saves[0] ?? null;
}
