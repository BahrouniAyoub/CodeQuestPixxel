# CodeQuest — Testing Guide

## Baseline Commands

Run from repository root:

```sh
npm test            # Vitest run
npm run test:watch  # Vitest watch
npm run lint        # ESLint
npm run build       # Production build
npm run build:dev   # Development-mode build
```

## Baseline Results (2026-11-26, this setup task)

| Command | Result | Notes |
|---|---|---|
| `npm test` | PASS | 65 test files passed, 540 tests passed. Duration ~82.88s. |
| `npm run lint` | BLOCKED/TIMEOUT | Timed out after 120s and again after 180s; no final pass/fail result obtained. |
| `npm run build` | PASS | Built client/ssr/nitro successfully in ~39s total. Warning: large chunks >500kB and tsconfig-paths/native note. |

## Task 004 Results (2026-11-27, Windows-style Start menu)

| Command | Result | Notes |
|---|---|---|
| `npm test` (pre-change baseline) | PASS | 67 test files, 540 tests; 44.71s. |
| Focused Start/registry/Browser/game Vitest run | PASS | 7 test files, 50 tests; 10.24s. |
| `npm test` (final) | PASS | 71 test files, 565 tests; 36.33s. |
| `npm run build` | PASS | Existing chunk-size and `vite-tsconfig-paths` warnings only. |
| `npx tsc --noEmit` | FAIL (pre-existing) | 13 diagnostics in unmodified files; no new diagnostics. |
| `npm run lint` | FAIL (pre-existing) | 2906 problems (2892 errors, 14 warnings); no new file had diagnostics. |

Manual browser verification for the Start menu was not performed; follow the checklist below and the instructions in `docs/reports/004-windows-style-start-menu.md`.

## Task 005 Results (2026-11-27, Dynamic Taskbar)

| Command | Result | Notes |
|---|---|---|
| `npm test` (fresh baseline before Task 005 source edits) | PASS | 71 test files, 565 tests; 63.95s. |
| Focused taskbar/settings/window/registry/Start tests | PASS | 7 test files, 38 tests; 9.78s (`taskbarModel`, `Taskbar`, `PixelOS`, `StartMenu`, `settingsStore`, `windowReducer`, `registry`). |
| `npx vitest run src/app/Taskbar.test.tsx` | PASS | 1 file, 8 tests; 7.10s. |
| `npm test` (final full suite) | PASS | 74 test files, 584 tests; 47.09s. |
| `npm run build` | PASS | Existing vite-tsconfig-paths/chunk-size/Nitro/plugin-timing warnings only. |
| `npx tsc --noEmit` | FAIL (pre-existing) | 13 diagnostics in unmodified files; 0 new after fixing 2 Task 005 test casts for `exactOptionalPropertyTypes`. |
| `npm run lint` | BLOCKED/TIMEOUT (pre-existing) | Timed out after 120000ms before completion; KI-001 backlog. |

Manual browser verification for the dynamic taskbar was not performed; follow the checklist below and `docs/reports/005-dynamic-taskbar.md`.

## Test Layout

- Vitest config: `vitest.config.ts` (jsdom, globals, setup `src/test/setup.ts`, includes `src/**/*.{test,spec}.{ts,tsx}`).
- Tests are colocated in features/services/routes and also under `src/test/`.

### Key Test Areas

| Area | Examples |
|---|---|
| Window manager | `src/core/windows/windowReducer.test.ts` |
| Routing/game bridge | `src/routes/-game.test.tsx`, `src/test/app-routing.test.tsx` |
| Chapter 1 progress/store/bridge | `src/features/chapter1/*.test.ts(x)` |
| Cafe setup/coding workflow | `src/features/chapter1/cafeSetup/*.test.ts(x)`, `src/features/chapter1/cafeCoding/*.test.ts` |
| Tickets/progress/editor | `src/features/tickets/*.test.tsx`, `src/features/progress/progressLogic.test.ts`, `src/features/editor/*.test.ts(x)` |
| Browser/GigBoard/mail | `src/features/browser/*.test.tsx`, `src/features/mail/*.test.ts(x)` |
| Start menu / shell integration | `src/app/StartMenu.test.tsx`, `src/app/PixelOS.test.tsx`, `src/core/applications/registry.test.ts` |
| Taskbar / window shell | `src/app/taskbarModel.test.ts`, `src/app/Taskbar.test.tsx`, `src/app/PixelOS.test.tsx`, `src/core/windows/windowReducer.test.ts` |
| Settings / taskbar pinning | `src/features/settings/settingsStore.test.ts` |
| Browser navigation intent | `src/features/browser/browserNavigationIntent.test.ts`, `src/features/browser/BrowserApp.test.tsx` |
| Return to Game / player name | `src/routes/-game-fresh.test.tsx` |
| Runner/filesystem/save | `src/services/runner/testing.test.ts`, `src/features/gameMenu/gameSave.test.ts` |

## What to Run by Change Type

| Change Type | Minimum Validation |
|---|---|
| Pure logic/util | Focused Vitest file(s) for that module |
| React UI/component | Focused component/hook tests + related integration tests |
| Chapter 1 quest/save/payment | Chapter 1 tests, game save tests, browser/mail/tickets tests as affected, then full `npm test` if practical |
| Bridge/Godot-React integration | `src/routes/-game*.test.tsx`, `src/features/chapter1/godotBridge.test.ts`, `godotSourceContract.test.ts`; manual `/game` smoke test |
| Python runner/editor/terminal | runner/editor/terminal/tickets tests; manual run in UI |
| Filesystem/explorer/editor dirty state | filesystem/editor/explorer/terminal/window tests as affected |
| Docs-only | Verify links/paths/commands referenced; no code tests required beyond sanity check |
| Godot source changes | Godot validation/export as applicable + web integration smoke test; rebuild `public/godot/` when needed |

## Bug Fix Rule

- Add a regression test that fails before/without the fix when feasible.
- Do not weaken or delete existing valid tests.

## Manual Smoke Test Checklist

1. `npm run dev` and open the game route.
2. Confirm Godot loads in iframe.
3. Trigger `codequest:open-os` flow by interacting with in-game computer.
4. Open PixelOS apps: Tickets, Editor, Browser, Mail, Journal, Explorer, Terminal, Settings.
5. Open Start from the taskbar; verify ten Start pins, All Apps, application-only search, keyboard/focus behavior, Escape/outside-click dismissal, and the live player footer.
6. Open GigBoard from the Start recommendation with Browser closed and already open; verify `gigboard.codequest` navigation without early CH1-03 completion.
7. Verify Return to Game from the Start footer, confirm there is no floating Exit Computer overlay button, then re-enter the OS.
8. Check dynamic taskbar: pinned apps visible when closed, open unpinned apps (Terminal/Explorer) appear, closed unpinned apps disappear, closed pinned apps remain. One icon per app.
9. Verify taskbar click semantics: closed opens, background focuses, focused minimizes, minimized restores/focuses. Start menu launch still focuses already-open apps without minimizing.
10. Right-click taskbar icons in closed/running/focused/minimized states; verify state-aware actions (Open/Focus/Restore/Minimize/Close/Pin/Unpin). Close uses window close path; dirty Editor close cancellation keeps editor open.
11. Pin/unpin apps; confirm missing pref uses defaults, explicit empty keeps no pins, invalid/duplicate persisted IDs are cleaned, and pin preference persists across refresh/reopen. Pinning is global UI preference (not per-save).
12. Narrow viewport / high UI scale: verify horizontal overflow controls appear only when needed, focused/newly opened app can be brought into view, Start/notifications/clock remain accessible, tooltip/context menu not clipped.
13. Check dark/light theme, UI scale, reduced motion, and a narrow/short viewport; confirm the menu stays bounded and scrolls internally. Taskbar states must remain distinguishable without color only.
14. Run a simple Python script in Editor; verify output.
15. Verify file create/edit/save/reopen in Explorer/Editor.
16. Verify Chapter 1 quest state updates in Journal and Godot objective UI.
17. Verify save/load flow (auto/slot) and character persistence, including the Start footer name.
18. Verify no console errors/blocking regressions in normal flow.

## Godot Validation

When `godot-source/` changes:

- Run relevant Godot headless checks/export if Godot CLI is available.
- Rebuild web export into `public/godot/`.
- Smoke test `/game` in browser.
- Record exact commands/results in the task report.

## Reporting

For every actionable task, record exact commands and outcomes in `docs/reports/NNN-*.md`. Distinguish:

- tests run vs not run;
- pass vs fail;
- existing failures vs new failures;
- blocked validation with reason.