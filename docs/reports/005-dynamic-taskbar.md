# 005 — Dynamic PixelOS Taskbar

- **Date:** 2026-11-27
- **Branch:** `feature/pixelos-cleanup`
- **Status:** Complete for implementation, focused/full automated tests, TypeScript, build, and documentation. Lint timed out in this environment (pre-existing backlog). Manual browser verification was not performed.

## Original request

Improve the PixelOS taskbar so it behaves like a real desktop operating system, dynamically reflecting running, minimized, focused, pinned and closed applications. Preserve the newly implemented Start menu and the existing PixelOS visual identity. Follow AGENTS.md and the established CodeQuest development workflow. Provide a planning response first, then implement after explicit approval.

## Objective and acceptance criteria

1. Analyze current implementation and reuse existing window manager/registry/settings/persistence patterns.
2. Show pinned applications whether running or closed; show running unpinned applications including minimized; one entry per app; remove closed unpinned apps; keep closed pinned apps.
3. Reuse `taskbarClick(id)` for taskbar clicks: closed opens, minimized restores/focuses, focused minimizes, background focuses. Preserve Start menu launch behavior (`open()` focuses, does not minimize).
4. Provide distinct visual states for closed pinned, running, focused, minimized, hover/keyboard focus. Do not rely on color only. Support dark/light, UI scale, reduced motion.
5. Provide app-name/state tooltips and state-aware context menu actions (Open/Focus/Restore/Minimize/Close/Pin/Unpin). Close uses `windowStore.close(id)` and preserves editor unsaved-file protection.
6. Implement approved pinning with additive optional `taskbarPinnedAppIds` in `settingsStore`, persisted through existing `prefs/settings`. Missing = defaults, explicit empty = respect, invalid IDs removed, duplicates deduped.
7. Horizontal overflow with left/right controls when needed; keep Start/notifications/clock accessible; do not overlap tray/start.
8. Add stable semantic tutorial IDs for taskbar container, app buttons, indicators, overflow controls, context menu actions.
9. Establish fresh baseline before source changes; run tests/build/tsc/lint after; report pre-existing failures separately.

## Previous behavior

- Taskbar rendered only static `PINNED_APPS` (`src/app/PixelOS.tsx`).
- Running unpinned apps (`terminal`, `explorer`) had no taskbar icon.
- Taskbar click used `taskbarClick(id)` but there was no distinct minimized visual state, no context menu, no tooltip beyond `title`, no overflow handling, and no user pin/unpin preference.
- Start menu already used `open(id)` through `launch()` and preserved focus-not-minimize behavior.

## Root cause

The taskbar was a static pinned-app list in the shell. It did not derive its items from live window state plus pin preferences, so it could not represent running unpinned apps, minimized/focus states clearly, or user-customized pinning.

## Implementation plan

1. Verify git status/branch and establish fresh test baseline before source edits.
2. Add pure taskbar derivation model (`taskbarModel.ts`) and settings normalization for `taskbarPinnedAppIds`.
3. Extract taskbar into `Taskbar.tsx` + `Taskbar.css` with dynamic items, states, tooltip, context menu, overflow controls, and tutorial IDs.
4. Wire PixelOS to Taskbar, preserve Start/notification/clock behavior.
5. Add/extend tests for model, settings, taskbar behavior, and regressions.
6. Run focused/full tests, build, tsc, lint; record actual outcomes.
7. Update docs/report index/changelog/architecture/testing guide.

## Actual implementation

### Taskbar model

- Added `src/app/taskbarModel.ts` with pure `deriveTaskbarItems(windows, focusedAppId, taskbarPinnedAppIds)`.
- Inclusion: effective pinned apps always visible; open unpinned apps included; closed unpinned apps excluded.
- Ordering: pinned segment in effective pinned order, then open unpinned apps in deterministic `APP_ORDER`.
- Deduplication: first-seen wins; pinned segment prevents duplicate unpinned entries.
- State: `closed-pinned`, `running`, `focused`, `minimized`.

### Settings / pinning persistence

- Extended `src/features/settings/settingsStore.ts` with additive optional `taskbarPinnedAppIds?: AppId[]`.
- `normalizeTaskbarPinnedAppIds()` removes unknown IDs and deduplicates while preserving order.
- Hydration: missing property/undefined => registry defaults; explicit `[]` => preserved; invalid entries removed.
- Update: normalizes patch when `taskbarPinnedAppIds` is present.
- Persistence: saved through existing `debouncedSave("prefs","settings",...)` only; no new DB store, no schema version bump, no Godot save changes.
- Pin action appends to effective pinned list; unpin removes from effective pinned list. Open unpinned apps remain visible until closed by model behavior.

### Taskbar component

- Added `src/app/Taskbar.tsx` and `src/app/Taskbar.css`.
- PixelOS delegates taskbar rendering to `Taskbar`; Start menu, desktop icons, toasts, notification center panel, window layer remain in PixelOS.
- App click calls `taskbarClick(id)` after closing Start. Start button behavior unchanged.
- Tooltip: lightweight fixed-position app title + state label; hidden while context menu is open.
- Context menu: state-aware actions Open/Restore/Focus/Minimize/Close/Pin/Unpin. Close uses `close(id)` from window store (editor unsaved guard preserved). Escape/outside click dismiss; menu clamped to viewport via layout measurement.
- Overflow: horizontal scroll area with left/right controls shown only when needed; ResizeObserver/window resize/scroll update controls. Focused/newly opened apps scroll into view.
- Visual states: closed-pinned muted, running indicator bar, focused highlight + wider cyan indicator, minimized dimmed + distinct hollow/dot indicator. Hover/focus-visible styles included. Reduced motion uses non-smooth scroll.

### Tutorial IDs

- Container: `taskbar`
- App button: `taskbar-app-${id}`
- App indicator: `taskbar-app-indicator-${id}`
- Overflow controls: `taskbar-overflow-left`, `taskbar-overflow-right`
- Context menu actions: `taskbar-context-open`, `taskbar-context-restore`, `taskbar-context-focus`, `taskbar-context-minimize`, `taskbar-context-close`, `taskbar-context-pin`, `taskbar-context-unpin`

## Technical decisions

- **Pure derivation model:** taskbar items are derived from window state + effective pin list; no second window manager or running-app store.
- **Additive settings field:** `taskbarPinnedAppIds` is an optional global UI preference in existing `prefs/settings`. Missing means registry defaults; explicit empty array means no pins. This avoids new persistence architecture and preserves backward compatibility.
- **Deterministic ordering:** running unpinned apps follow `APP_ORDER`, as approved.
- **No Start/desktop behavior changes:** `START_PINNED_APPS` and desktop shortcuts remain unchanged. Start still launches via `open(id)`.
- **Lightweight tooltip only:** no thumbnail/screenshot preview; tooltip is fixed-position to avoid scroll clipping.
- **Context menu close path:** uses `windowStore.close(id)` so editor unsaved-file guard remains authoritative.

## Modified, created, and deleted files

### Created

- `src/app/taskbarModel.ts`
- `src/app/taskbarModel.test.ts`
- `src/app/Taskbar.tsx`
- `src/app/Taskbar.css`
- `src/app/Taskbar.test.tsx`
- `src/features/settings/settingsStore.test.ts`
- `docs/reports/005-dynamic-taskbar.md`
- `docs/decisions/002-dynamic-taskbar-pinning-preference.md`

### Modified

- `src/app/PixelOS.tsx`
- `src/app/PixelOS.test.tsx`
- `src/app/pixel-os-shell.css`
- `src/features/settings/settingsStore.ts`
- `docs/reports/README.md`
- `docs/CHANGELOG.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING_GUIDE.md`
- `docs/decisions/README.md`

### Deleted

- None. Old taskbar rules were removed from `src/app/pixel-os-shell.css` and replaced by `Taskbar.css`.

## Important implementation details

- Taskbar overflow uses a scroll container inside the taskbar; tooltip/context menu are rendered as fixed-position siblings so they are not clipped by `overflow-x: auto`.
- `taskbarClick(id)` remains the single click behavior source; context menu uses explicit action intents (`open/focus/minimize/close`) for clarity.
- Default pins come from registry `PINNED_APPS` only when preference is missing. `PINNED_APPS` export remains unchanged.
- `Element.prototype.scrollTo` is not available in jsdom; Taskbar tests stub it. This is test-environment support, not production behavior change.

## Automated tests and exact results

| Command | Result | Exact outcome |
|---|---|---|
| `npm test` (fresh baseline, before source edits) | PASS | 71 test files passed, 565 tests passed; 63.95s. |
| `npx vitest run src/app/taskbarModel.test.ts src/app/Taskbar.test.tsx src/app/PixelOS.test.tsx src/app/StartMenu.test.tsx src/features/settings/settingsStore.test.ts src/core/windows/windowReducer.test.ts src/core/applications/registry.test.ts` (focused, after fixes) | PASS | 7 test files passed, 38 tests passed; 9.78s. |
| `npx vitest run src/app/Taskbar.test.tsx` (after adding state-action test) | PASS | 1 test file passed, 8 tests passed; 7.10s. |
| `npm test` (final full suite) | PASS | 74 test files passed, 584 tests passed; 47.09s. |

## Build and validation results

| Command | Result | Details |
|---|---|---|
| `npm run build` | PASS | Vite production build completed. Existing warnings: vite-tsconfig-paths native suggestion, large chunks, Nitro inlineDynamicImports note, plugin timing. |
| `npx tsc --noEmit` | FAIL (pre-existing) | 13 diagnostics in unmodified files. Initial run also showed 2 new test-file diagnostics caused by `exactOptionalPropertyTypes` + explicit `taskbarPinnedAppIds: undefined`; fixed by test cast. Final run: 13 pre-existing diagnostics only (GigBoardDeliveryReadiness, GigBoardDevMode, GigBoardPayment x2, GigBoardSubmission, cafeSubmission, cafeTaskStatus x3, EditorApp, TerminalApp, CafeDeliveryPreparation, CafeProjectBoard). |
| `npm run lint` | BLOCKED/TIMEOUT (pre-existing) | Timed out after 120000 ms before completion. Pre-existing lint backlog is tracked as KI-001; no lint run completed to final pass/fail in this environment. |

## Manual tests actually performed

- Not performed in a browser in this environment. Verification is based on automated Vitest/jsdom tests, TypeScript, and production build.

## Manual testing instructions

1. Run `npm run dev` in `CodeQuestPixxel-pixelos-dev`, open `/game`, and enter PixelOS.
2. Confirm default pinned apps appear in taskbar. Open Terminal from Start/Desktop; confirm Terminal icon appears in taskbar. Close Terminal; confirm icon disappears. Close a pinned app; confirm its icon remains.
3. Open multiple apps and click taskbar icons: closed opens, background focuses, focused minimizes, minimized restores. Confirm Start menu launch still focuses an already-open app without minimizing.
4. Right-click taskbar icons in each state: closed pinned shows Open/Pin-Unpin as appropriate; open background shows Focus/Minimize/Close/Pin-Unpin; focused shows Minimize/Close/Pin-Unpin; minimized shows Restore/Close/Pin-Unpin.
5. Pin Terminal, refresh/reopen PixelOS, and confirm Terminal remains pinned. Unpin an open app and confirm it stays until closed. Unpin a closed pinned app and confirm it disappears immediately.
6. In Settings storage/prefs scenario, test missing preference (defaults), explicit empty array (no pinned apps), and invalid/duplicate IDs (cleaned). 
7. Open Editor, make a dirty file, right-click taskbar Editor icon, choose Close, cancel confirmation; confirm Editor remains open. Accept confirmation; confirm it closes.
8. Resize viewport narrow and increase UI scale; open many apps. Confirm left/right overflow controls appear only when needed, Start/clock/notifications remain accessible, and no overlap occurs.
9. Hover/focus taskbar icons; confirm lightweight name+state tooltip appears and is not clipped. Open context menu and confirm it stays inside viewport.
10. Check dark theme, light theme, reduced motion. Confirm minimized/running/focused/closed-pinned states are distinguishable without relying on color alone.
11. Use Start menu Return to Game and re-enter PixelOS; confirm no regressions.

## Risks and limitations

- Manual browser/visual verification was not performed; overflow, tooltip clipping, and viewport behavior should be smoke-tested in a real browser.
- `pixel-os-shell.css` remains mostly minified; taskbar styles were moved to `Taskbar.css`, but the shell stylesheet is still not fully reformatted.
- jsdom cannot fully validate scroll/overflow visuals or ResizeObserver layout; tests cover logic and DOM state.
- Lint could not be completed due 120s timeout; pre-existing lint debt remains.
- Pre-existing TypeScript diagnostics remain in unrelated files.

## Unverified assumptions

- Fixed-position tooltip/menu avoids clipping in all target browsers/layouts used by the game.
- `ResizeObserver` availability matches supported runtime environments (modern browser expected).
- Users expect deterministic `APP_ORDER` for open unpinned apps rather than recency ordering.

## Remaining issues

- KI-001/KI-011 remain open (lint backlog and pre-existing TS diagnostics).
- Manual browser smoke test for Task 005 is pending.

## Acceptance criteria checklist

- [x] Dynamic taskbar shows pinned apps always, running unpinned apps while open, one entry per app.
- [x] Closed unpinned removed; closed pinned retained.
- [x] Taskbar click reuses `taskbarClick`; Start launch behavior preserved.
- [x] Distinct states for closed pinned, running, focused, minimized, hover/keyboard focus.
- [x] Tooltips and state-aware context menus implemented.
- [x] Close uses `windowStore.close(id)`; editor unsaved protection preserved.
- [x] Additive `taskbarPinnedAppIds` setting implemented with normalization and existing prefs persistence.
- [x] Horizontal overflow controls implemented; tray/start kept accessible.
- [x] Stable semantic tutorial IDs added.
- [x] Fresh baseline and post-implementation tests/build/tsc recorded.
- [x] Lint attempted; timed out (pre-existing backlog) and reported.
- [ ] Manual browser visual verification (not performed).

## Recommended next steps

1. Run the manual smoke checklist in `/game`, especially narrow viewport, UI scale, overflow, and context menu clipping.
2. Consider a separate tooling task for lint performance/backlog and the pre-existing tsc diagnostics.
3. If desired, add a small ADR follow-up note for any future taskbar drag-and-drop/reordering decision (not implemented here).