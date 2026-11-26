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
5. Run a simple Python script in Editor; verify output.
6. Verify file create/edit/save/reopen in Explorer/Editor.
7. Verify Chapter 1 quest state updates in Journal and Godot objective UI.
8. Verify save/load flow (auto/slot) and character persistence.
9. Verify no console errors/blocking regressions in normal flow.

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