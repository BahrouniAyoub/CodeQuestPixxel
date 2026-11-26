import { describe, expect, it } from "vitest";
import { initialChapter1Progress } from "@/features/chapter1/chapter1Progress";
import {
  createGameSaveRecord,
  DEFAULT_CHARACTER,
  parseCharacterSnapshot,
  validateGameSaveRecord,
} from "./gameSave";

describe("gameSave", () => {
  it("parses snake_case character snapshots from Godot", () => {
    expect(
      parseCharacterSnapshot({
        name: "  Pixel Kid  ",
        body_index: 1,
        skin_index: 3,
        hair_style_index: 4,
        hair_color_index: 2,
        top_index: 5,
        bottom_index: 6,
        feet_index: 7,
      }),
    ).toEqual({
      name: "Pixel Kid",
      bodyIndex: 1,
      skinIndex: 3,
      hairStyleIndex: 4,
      hairColorIndex: 2,
      topIndex: 5,
      bottomIndex: 6,
      feetIndex: 7,
    });
  });

  it("validates a record created from authoritative progress", () => {
    const record = createGameSaveRecord({
      savedAt: "2026-11-24T10:00:00.000Z",
      slot: "quick",
      reason: "Bedroom rest",
      character: DEFAULT_CHARACTER,
      progress: initialChapter1Progress,
      payment: null,
    });

    expect(validateGameSaveRecord(record)).toEqual({ ok: true, record });
    expect(validateGameSaveRecord({ ...record, version: 99 })).toMatchObject({ ok: false });
  });
});
