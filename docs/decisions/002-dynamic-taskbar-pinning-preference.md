# 002 — Dynamic Taskbar Pinning Preference

- Date: 2026-11-27
- Branch: `feature/pixelos-cleanup`
- Status: Accepted
- Related report: `docs/reports/005-dynamic-taskbar.md`

## Context

Task 005 required a dynamic PixelOS taskbar that reflects running/minimized/focused/pinned/closed applications. The user approved customizable pin/unpin behavior, but also required that pinning remain a global interface preference and not modify save schemas or introduce new persistence architecture.

## Decision

- Add an additive optional `taskbarPinnedAppIds?: AppId[]` field to `Settings` in `src/features/settings/settingsStore.ts`.
- Persist it through the existing `prefs/settings` debounced save path (`dbSet`/IndexedDB prefs store) with no new DB store, no DB version bump, and no Godot save changes.
- Normalization rules:
  - Missing property / `undefined`: use registry default pins (`PINNED_APPS`).
  - Explicit empty array: respect user choice (no pinned taskbar apps).
  - Unknown app IDs: removed.
  - Duplicate IDs: removed while preserving first-seen order.
- Pin appends to the effective pinned list. Unpin removes it. Open unpinned apps remain visible until closed.
- Desktop shortcuts and `START_PINNED_APPS` remain unchanged.

## Alternatives considered

- Store pins in a separate `prefs/taskbar` key: simple, but adds another prefs record; not needed.
- Persist pins in Godot/save slots: rejected; pinning is global UI preference, not per-save gameplay progress.
- No pin customization: rejected by approved Task 005 scope.

## Impact

- Backward compatible: old settings records without the field behave as before.
- UI-only: no quest, save-slot, bridge, or gameplay impact.
- Taskbar derivation uses existing window state and registry; no second window manager.

## Migration / compatibility

- No migration required. Hydration normalizes missing/invalid values.
- Existing `prefs/settings` records remain valid.

## Risks

- Additive prefs shape change must be kept normalized to avoid invalid IDs lingering.
- Future drag-and-drop reordering would need a separate decision and UX design.

## Validation

- `src/features/settings/settingsStore.test.ts` covers missing/default, explicit empty, invalid/dedup normalization, and update normalization.
- `src/app/Taskbar.test.tsx` covers pin/unpin visibility rules and explicit empty/normalized persisted IDs.
- Full suite: 74 files, 584 tests passed (Task 005 final run).