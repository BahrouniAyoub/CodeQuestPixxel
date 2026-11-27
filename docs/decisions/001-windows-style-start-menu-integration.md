# 001 — Windows-Style Start Menu Integration

- **Date:** 2026-11-27
- **Branch:** `feature/pixelos-cleanup`
- **Status:** Accepted
- **Related report:** [004-windows-style-start-menu.md](../reports/004-windows-style-start-menu.md)

## Context

The PixelOS Start menu was inline in `PixelOS.tsx` and coupled to the desktop shell. Task 004 required a Windows 11-inspired launcher with Start-only pinning, All Apps, application-only search, recommendations, live player information, and Return to Game, while preserving the existing registry, window manager, simulated Browser router, Godot bridge, and save ownership. Task 003 tutorial/educational implementation was explicitly out of scope.

## Decision

1. Extract `src/app/StartMenu.tsx` with scoped `StartMenu.css`. It consumes `APPS`, `APP_ORDER`, `searchApps()`, `PixelIcon`, and the existing window manager through props; it does not own windows, routing, or persistence.
2. Add `START_PINNED_APPS` as an ID-only view constant in the registry. It defines the Start grid order but does not change `AppDefinition.pinned`, desktop shortcuts, or taskbar pins.
3. Hand the GigBoard recommendation to the existing Browser through `browserNavigationIntent.ts`, an in-memory one-shot request store. `BrowserApp` calls its existing `goTo()` path with `GIGBOARD_ADDRESS` and consumes the request immediately. No job-detail URL, new router, or quest-state write is used by the launcher.
4. Source the footer player name from the existing `game.tsx` character data (snapshot/load/request-state/reset) with a `Player` fallback. `PixelOS` props are optional so the standalone desktop preview still works. No profile store or save schema was added.
5. Share one `returnToGame` callback owned by `/game` and passed into `PixelOS`/Start menu. The initial Task 004 implementation also used it for a temporary floating overlay button; that button was removed in the final UI adjustment after manual validation, leaving the Start footer as the only in-OS return control. Return to Game is hidden when `PixelOS` is used without a game host.
6. Add stable `data-tutorial-id` hooks to semantic elements only. No tutorial engine, onboarding state, or curriculum behavior was implemented.

## Alternatives considered

- **Reuse `PINNED_APPS` for Start:** rejected because the requested Start order differs from desktop/taskbar pinning and changing `pinned` would alter unrelated surfaces.
- **Navigate directly to a GigBoard job detail from Start:** rejected because it could bypass the CH1-03 discovery flow.
- **Add a Start-specific router or app store:** rejected because the registry/window manager already provide the required sources of truth.
- **Persist navigation intents or add a profile store:** rejected because they would create unnecessary save/schema ownership and replay risk.
- **Implement Task 003 tutorial hooks/state now:** rejected as explicitly out of scope; only stable IDs were added.

## Impact

- Start-specific UI is now isolated and testable without rewriting shell behavior.
- Browser gains a small in-memory handoff hook but keeps one navigation path and one quest-discovery guard.
- `game.tsx` owns the live player name and return callback; `PixelOS` remains reusable on `/`.
- No save records, quest authority, Python execution, or Godot↔React message contracts changed.

## Migration / compatibility

- Existing saves and character snapshots remain valid; missing/blank names fall back to `Player`.
- Desktop/taskbar pinning behavior is unchanged.
- The standalone `/` preview renders without player/return props.
- Already-open apps launched from Start are focused, matching the existing `OPEN` reducer behavior.

## Risks

- Browser intent is limited to the same document; a future cross-page launcher needs a different mechanism.
- CSS `zoom` is used for UI scaling and should be visually verified in target browsers.
- Lint/TypeScript repo-wide backlogs remain unresolved and can obscure future diagnostics.

## Validation

- Baseline `npm test`: 67 files / 540 tests passed (44.71s).
- Focused Vitest: 7 files / 50 tests passed (10.24s).
- Final `npm test`: 71 files / 565 tests passed (36.33s).
- `npm run build`: passed with existing warnings.
- `npx tsc --noEmit`: failed with 13 pre-existing diagnostics in unmodified files; no new diagnostics.
- `npm run lint`: failed with 2906 pre-existing problems (2892 errors, 14 warnings); no new files had diagnostics and no new hook warnings remained.
- Manual browser verification not performed; exact instructions are in the related report.
