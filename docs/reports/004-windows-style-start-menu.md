# 004 — Windows-Style Start Menu

- **Date:** 2026-11-27
- **Branch:** `feature/pixelos-cleanup`
- **Status:** Complete for implementation, automated verification, and documentation. Manual browser verification was not performed. Final UI adjustment applied on 2026-11-27: removed the floating overlay "Exit Computer · Return to Game" button from `/game`; the Start menu footer Return to Game action remains the only in-OS return control.
- **Related decision record:** [001-windows-style-start-menu-integration.md](../decisions/001-windows-style-start-menu-integration.md)

## Original request

Replace the existing PixelOS Start menu with a Windows 11-inspired launcher that keeps the established registry/window-manager architecture, adds Start-only pinning and All Apps, searches only applications, recommends GigBoard through the existing Browser, shows the live player/quest data, and provides Return to Game. Implement only Task 004; do not implement the educational/tutorial features from Task 003.

## Objective and acceptance criteria

1. Extract a reusable `StartMenu.tsx` and scoped `StartMenu.css` instead of keeping Start markup/styles inline in `PixelOS.tsx`.
2. Reuse `APPS`, `APP_ORDER`, `searchApps()`, `PixelIcon`, and the existing window manager. Do not add a second app router or duplicate app metadata.
3. Add an ID-only `START_PINNED_APPS` constant containing all ten apps; leave desktop/taskbar `pinned` flags unchanged.
4. Provide Pinned, All Apps, and application-only Search views with stable keyboard/focus behavior and outside-click/Escape dismissal.
5. Make the GigBoard recommendation open the existing Browser through a non-persisted intent, consume the intent once, work with Browser closed or already open, and never bypass quest discovery by navigating to a job-detail URL.
6. Read the player name from existing `game.tsx` character data with a `Player` fallback; do not add a profile store or save schema changes.
7. Add Return to Game to the Start footer. The temporary floating return button was retained during initial Task 004 implementation and removed in the final UI adjustment after manual testing confirmed the Start menu action works.
8. Respect dark/light themes, UI scale, viewport constraints, internal scrolling, and reduced motion.
9. Add stable semantic IDs only; do not add a tutorial engine/state or implement Task 003 educational features.
10. Verify focused Start, registry/window, Browser/GigBoard, return-to-game, full suite, TypeScript, lint, and build behavior.

## Previous behavior

- Start was an inline block inside `PixelOS.tsx`: a compact header, one omnibox-like search grid, and a single “Continue your Chapter 1 mission” recommendation that launched Tickets.
- There was no Start-only pin order, no All Apps view, no player footer, no Return to Game action, and no application-only empty state.
- Search results included every registry app but there was no ID matching and no Enter-to-launch shortcut.
- Escape and outside-click closed the menu, but there was no focus restoration, no close animation handling, and no launched-window focus handoff.
- `game.tsx` passed no player name or return callback to `PixelOS`; the only return action was the floating overlay button.

## Root cause

Start presentation and launch logic were embedded in the desktop shell, so Start-specific presentation (pin order, views, recommendations, footer) could not evolve without changing the shell. There was also no cross-app navigation handoff from a launcher surface to the existing simulated Browser router, and no props carrying the live character name into PixelOS.

## Implementation plan

1. Capture the baseline (`npm test`) before source edits.
2. Add an ID-only Start pin order and ID-aware application search to the registry.
3. Add a non-persisted Browser navigation intent store and consume it inside the existing `BrowserApp` `goTo()` path.
4. Create `StartMenu.tsx`/`StartMenu.css` with pinned/all/search views, recommendations, footer, keyboard/focus handling, and stable IDs.
5. Rewrite `PixelOS.tsx` to delegate Start rendering to the new component while preserving desktop/taskbar/window behavior.
6. Pass the live player name and shared return callback from `game.tsx`.
7. Add focused regression tests, run focused/full tests, TypeScript, lint, build, and record results.
8. Write this report and update the report index, changelog, testing guide, architecture, known issues, and decision record index.

## Actual implementation

### Registry

- Added `START_PINNED_APPS` in `src/core/applications/registry.ts`: `browser`, `mail`, `editor`, `explorer`, `chat`, `tickets`, `terminal`, `progress`, `journal`, `settings`.
- It is an ID-only view constant typed with `satisfies readonly AppId[]`; it does not copy `AppDefinition` metadata or mutate `PINNED_APPS`.
- `searchApps()` now also matches lowercased application IDs.

### Browser navigation handoff

- Created `src/features/browser/browserNavigationIntent.ts`, an in-memory Zustand store with monotonically increasing request IDs and `consumeNavigation()`. It is intentionally not persisted.
- `BrowserApp.tsx` subscribes to the request and calls the existing `goTo()` path, then consumes it. The same omnibox rules still apply, including the CH1-03 guard that only advances when the café job-detail address is explicitly navigated to.
- `StartMenu.tsx` requests `GIGBOARD_ADDRESS` (`gigboard.codequest`) only; it never requests a job-detail URL and never writes quest state.

### Start menu component

- Created `src/app/StartMenu.tsx` and `src/app/StartMenu.css`.
- Pinned view uses `START_PINNED_APPS`; All Apps uses `APP_ORDER`; Search uses `searchApps()` with an application-only “No applications found” state.
- Recommendations: GigBoard (through the intent + `browser` launch) and Quest Journal (normal `journal` launch) with real Chapter 1 completion count when hydrated.
- Footer shows the supplied player name, XP-derived level, Chapter 1 progress, Settings, and optional Return to Game.
- Keyboard behavior: search input receives focus on mount; Enter launches the first search result; the results grid supports Arrow/Home/End; Tab/Shift+Tab and text-editing arrows remain native.
- Dismissal: outside `pointerdown` calls `onClose(false)` and leaves focus on the click target; Escape and the header close button call `onClose(true)` so the shell can restore focus to the Start button.
- Global listeners mount only while Start is open and are disabled during the closing animation.
- Styles use existing `--px-*` theme tokens, `--font-pixel`, `--cq-scale`, viewport-relative bounds, internal scrolling, rounded container, subtle open/close animation, and reduced-motion opt-outs.

### Shell and game integration

- Removed the obsolete inline Start CSS from `src/app/pixel-os-shell.css`.
- `PixelOS.tsx` now accepts optional `playerName` and `onReturnToGame` props (defaults: `Player` and hidden action), so the standalone `/` preview remains valid.
- Added a 120 ms close animation with immediate completion under reduced motion; focus is restored on `onClose(true)`, and launching an app blurs the hidden menu, calls `open(id)`, then focuses `[data-window-id="${id}"]`.
- Window frames gained a focusable `data-window-id` wrapper for that handoff; desktop/taskbar still use `PINNED_APPS`.
- `game.tsx` tracks `playerName` from `DEFAULT_CHARACTER`, character snapshots, save load, and `codequest:request-state`; a shared `returnToGame` callback is passed to `PixelOS`. The initial Task 004 build also wired this callback to a temporary floating overlay button; the final UI adjustment removed that button, leaving the Start menu footer action as the only in-OS return control.

### Task 003 boundary

- No tutorial engine, onboarding state, lessons, quest-gating, or educational UI was added. Only stable `data-tutorial-id` hooks were placed on semantic elements for future work.

### Final UI adjustment (2026-11-27)

After manual testing confirmed the Start menu Return to Game action works, the temporary floating overlay button was removed from `/game`.

- **Removed:** the fixed-position `Exit Computer · Return to Game` button rendered inside the PixelOS overlay in `src/routes/game.tsx`. The button used inline styles only; no separate CSS file required cleanup.
- **Preserved:** `returnToGame` callback, `PixelOS` `onReturnToGame` prop wiring, Godot iframe visibility/session preservation, Start menu footer Return to Game action (`data-tutorial-id="start-return-to-game"`), and character/quest/save state behavior.
- **Tests updated:** `src/routes/-game-fresh.test.tsx` no longer asserts the removed floating button exists; it still verifies the OS opens with the live player name, the iframe is hidden while OS is open, and clicking the Start Return to Game action hides PixelOS and reveals the Godot iframe.

## Technical decisions

See [ADR 001](../decisions/001-windows-style-start-menu-integration.md). In summary: Start-only pins are a view concern; Browser recommendation navigation is a non-persisted one-shot intent through the existing router; player data stays owned by the existing game bridge/stores; no save schema, quest authority, or tutorial-system changes were made.

## Modified, created, and deleted files

### Created

- `src/app/StartMenu.tsx`
- `src/app/StartMenu.css`
- `src/app/StartMenu.test.tsx`
- `src/app/PixelOS.test.tsx`
- `src/core/applications/registry.test.ts`
- `src/features/browser/browserNavigationIntent.ts`
- `src/features/browser/browserNavigationIntent.test.ts`
- `docs/reports/004-windows-style-start-menu.md`
- `docs/decisions/001-windows-style-start-menu-integration.md`

### Modified

- `src/app/PixelOS.tsx`
- `src/app/pixel-os-shell.css` (removed obsolete inline Start CSS)
- `src/core/applications/registry.ts`
- `src/core/windows/windowReducer.test.ts`
- `src/features/browser/BrowserApp.tsx`
- `src/features/browser/BrowserApp.test.tsx`
- `src/routes/game.tsx`
- `src/routes/-game-fresh.test.tsx`
- `docs/reports/README.md`
- `docs/CHANGELOG.md`
- `docs/TESTING_GUIDE.md`
- `docs/ARCHITECTURE.md`
- `docs/KNOWN_ISSUES.md`
- `docs/decisions/README.md`

### Deleted

- No files were deleted. Only the obsolete inline Start CSS block was removed from `src/app/pixel-os-shell.css`.

### Pre-existing user changes left untouched

- `package.json` (`dev` script already changed to `vite dev --port 9090 --strictPort`).
- `docs/learning.zip`.

## Important implementation details

Stable IDs added: `start-button`, `start-menu`, `start-search`, `start-pinned-app-${id}`, `start-all-app-${id}`, `start-all-apps-button`, `start-back-button`, `start-recommended-gigboard`, `start-recommended-journal`, `start-settings`, `start-return-to-game`, `start-close-button`. The dialog DOM id is `cq-start-menu`; `aria-controls`/the results group use `cq-start-results`.

Launch behavior deliberately uses the existing `open(id)` action: an already-open app is focused rather than minimized. Taskbar clicks keep their existing `taskbarClick(id)` behavior. The browser intent is consumed immediately to avoid replay after remount/hydration.

`StartMenuProps` uses `(() => void) | undefined` for optional callbacks because the project enables `exactOptionalPropertyTypes`; standalone `PixelOS` usage omits the callback entirely and hides Return to Game.

## Automated tests and exact results

| Command | Result | Exact outcome |
|---|---|---|
| `npm test` (baseline, before source edits) | PASS | 67 test files passed, 540 tests passed; 44.71s. |
| `npx vitest run src/app/StartMenu.test.tsx src/app/PixelOS.test.tsx src/core/applications/registry.test.ts src/core/windows/windowReducer.test.ts src/features/browser/browserNavigationIntent.test.ts src/features/browser/BrowserApp.test.tsx src/routes/-game-fresh.test.tsx` | PASS | 7 test files passed, 50 tests passed; 10.24s. |
| `npm test` (final, after all source/format edits) | PASS | 71 test files passed, 565 tests passed; 36.33s. |
| `npx vitest run src/app/StartMenu.test.tsx src/app/PixelOS.test.tsx src/routes/-game-fresh.test.tsx` (final UI adjustment, 2026-11-27) | PASS | 3 test files passed, 18 tests passed; 57.57s. |

Focused coverage includes: Start pin order and stable IDs; All Apps including unpinned apps; application-only search by ID/title/description and empty state; Enter-to-launch; Arrow/Home/End without intercepting Tab; Escape/close/outside-click focus semantics; GigBoard intent; player name fallback; Return to Game; shell launch focus/focus restore; theme/scale/reduced-motion classes; `START_PINNED_APPS` shape and `PINNED_APPS` invariance; reducer re-open/focus; intent request/consume-once; Browser intent with closed/open Browser, no quest bypass, and ordinary navigation after consumption; game-route snapshot/load player name and Start-menu return-to-game integration.

No automated test failed in the final full run.

## Build and validation results

| Command | Result | Details |
|---|---|---|
| `npm run build` | PASS | Vite production build completed. Existing warnings: chunks >500 kB, `vite-tsconfig-paths` native-resolution suggestion, `inlineDynamicImports` ignored under Nitro, and plugin timing breakdown. |
| `npx tsc --noEmit` | FAIL (pre-existing) | Exit code 1 with 13 diagnostics in files not changed by this task: `GigBoardDeliveryReadiness.test.tsx`, `GigBoardDevMode.test.tsx`, `GigBoardPayment.test.tsx` (2), `GigBoardSubmission.test.tsx`, `cafeSubmission.test.ts`, `cafeTaskStatus.test.ts` (3), `EditorApp.tsx`, `TerminalApp.tsx`, `CafeDeliveryPreparation.tsx`, `CafeProjectBoard.test.tsx`. No task source or new test file produced a diagnostic. |
| `npm run lint` | FAIL (pre-existing backlog) | Exit code 1; final run reported 2906 problems (2892 errors, 14 warnings), mostly Prettier/CRLF formatting debt across the repository. An earlier run in this task reported 2912 problems (2896 errors, 16 warnings); the hook-dependency warnings introduced during refactoring were removed. No newly created file has lint diagnostics. The only remaining `react-hooks/exhaustive-deps` warning is in unmodified `src/features/chat/ChatApp.tsx`. |

The 2026-11-27 final UI adjustment (floating button removal) was validated with the focused regression command above; `npm run build`, `npx tsc --noEmit`, and `npm run lint` were not rerun for this small UI/test/documentation-only change.

## Manual tests actually performed

None by the agent in this environment. The user reported that the new Start menu has been manually tested and is working correctly, which prompted the final UI adjustment to remove the temporary floating overlay button. No additional browser/manual UI verification was performed by the agent after that adjustment; behavioral claims for the adjustment are based on code inspection and the automated Vitest/jsdom regression run listed above.

## Manual testing instructions

1. From the repository root, run `npm run dev` and open the game route; use the in-game computer interaction that emits `codequest:open-os`. The standalone `/` route can be used for shell-only checks, but it intentionally has no Return to Game action.
2. Click the taskbar Start button. Confirm the rounded Windows-style menu opens centered above the taskbar, the search input has focus, and ten pinned apps appear in this order: Browser, Mail, Editor, File Explorer, Chat, Tickets, Terminal, Progress, Journal, Settings.
3. Press Escape and reopen; confirm focus returns to the Start button. Reopen and click a game window behind the menu; confirm the menu closes and the clicked target keeps focus.
4. Type `explorer` in search and press Enter. Confirm File Explorer opens/focuses rather than minimizing if already open. Type `homework.pdf` and confirm the only result state is “No applications found”.
5. Press Tab/Shift+Tab through results; confirm native tab order. With a result focused, try Arrow keys, Home, and End; confirm focus wraps or jumps as expected.
6. Click All apps; confirm all ten registered apps appear, including the unpinned Terminal and File Explorer. Click Pinned to return.
7. With Browser closed, click the GigBoard recommendation; confirm Browser opens at `gigboard.codequest` and shows the internal GigBoard landing page. Repeat with Browser already open; confirm the same address is shown and CH1-03 is not completed merely by opening GigBoard.
8. In `/game`, emit/confirm a character snapshot or load a save with a different name; reopen Start and confirm the footer name updates. Click Return to Game in the Start footer and confirm the OS closes and the Godot iframe becomes visible again. Confirm there is no floating “Exit Computer · Return to Game” overlay button and that the Start menu footer action is the only in-OS return control.
9. Toggle Settings theme between dark/light, UI scale, and reduced motion. Reopen Start each time; confirm colors/tokens, scale, viewport bounds, internal scrolling, and that open/close animation is suppressed under reduced motion.
10. Repeat at a narrow viewport/short window height; confirm the menu stays within the viewport and the content area scrolls without hiding the header/footer.
11. Check the browser console for new errors and confirm taskbar notifications, clock, desktop shortcuts, and window drag/resize behavior remain intact.

## Risks and limitations

- Manual browser verification was not performed; visual/UX behavior is covered only by jsdom tests and CSS review.
- `npm run lint` and `npx tsc --noEmit` are not clean because of large pre-existing repo-wide backlogs. They were not fixed here to avoid unrelated churn.
- CSS `zoom` is used to apply UI scale consistently to the Start menu; verify it visually in the target browsers.
- The Browser intent is in-memory only. This is intentional, but any future cross-page (not same-document) launch surface will need a different handoff.
- GigBoard recommendation uses the landing address only. This preserves quest discovery but does not deep-link to a specific job.

## Unverified assumptions

- The existing Browser `goTo("gigboard.codequest")` path renders the intended landing page in the real UI; automated tests verify routing and state, not visual output.
- Existing Godot character snapshots and save-load payloads provide valid names; automated tests verify the React-side extraction/fallbacks with representative payloads.
- Existing `--px-*` theme variables resolve correctly in the running app; automated tests verify shell classes/style, not final rendered colors.

## Remaining issues

- KI-001/KI-011: lint and TypeScript diagnostics remain open as pre-existing tooling debt.
- Manual browser smoke test from the instructions above is still pending.
- No Godot source files were changed, so no Godot validation/export was required.

## Acceptance criteria checklist

- [x] Reusable Start component and scoped CSS created.
- [x] Registry/window manager/PixelIcon reused; no second router.
- [x] `START_PINNED_APPS` contains all ten apps and is ID-only; desktop/taskbar pins unchanged.
- [x] Pinned/All Apps/application-only Search implemented.
- [x] GigBoard recommendation uses one-shot non-persisted intent through existing Browser navigation and does not bypass CH1-03 discovery.
- [x] Player name comes from existing game data with `Player` fallback; no save schema/profile store changes.
- [x] Return to Game added to Start footer; temporary floating button removed after manual validation. Start menu footer is the only in-OS return control.
- [x] Keyboard/focus/dismissal, stable IDs, theming, scale, viewport, scrolling, and reduced motion implemented.
- [x] No Task 003 educational/tutorial features implemented.
- [x] Focused, full, build, TypeScript, and lint validation executed and recorded.
- [ ] Manual browser verification (not performed; instructions provided).

## Recommended next steps

1. Perform the manual smoke test above in the actual `/game` browser flow.
2. Address the pre-existing lint/TypeScript backlogs in a separate tooling debt task; do not mix that formatting churn into future feature diffs.
3. Confirm the Windows-style visual direction and narrow-viewport behavior with the product owner before extending the launcher.
