# Task 002 — Remove Legacy PixelOS Tickets

- **Date**: 2026-11-26
- **Branch**: `feature/pixelos-cleanup`
- **Status**: Completed

## Original Request

Remove legacy PixelOS demo/practice tickets so only the Café Calculator mission / Chapter 1 tickets remain visible. Plan was approved by user (“go with this plan”).

## Objective and Acceptance Criteria

- [x] Remove unrelated/legacy tickets from GigBoard, ticket management apps, and default seeded data.
- [x] Prevent legacy tickets from reappearing on refresh/restart/load of existing saves by sanitizing persisted legacy IDs on hydrate.
- [x] Preserve Café Calculator tasks/progress/dependencies/tests/reward logic, player-created files, existing save data shape where possible, and reusable ticket architecture for future chapters.
- [x] Tickets app becomes Café Calculator-only when no general tickets exist.
- [x] Hide/disable legacy Editor ticket mode when no active ticket catalog / missing ticket.
- [x] Progress hides legacy ticket XP/track when catalog is empty but preserves raw saved records handling safely.
- [x] Keep cafe reward/quest logic untouched.
- [x] Do not simplify Café Calculator tasks; do not change save architecture; do not reset IndexedDB; do not modify unrelated UI components; do not implement remaining PixelOS improvements.
- [x] Add regression tests for legacy-save sanitization/no-CQ visibility.
- [x] Run relevant tests, `npm test`, and `npm run build`; record lint as blocked if it times out.

## Previous Behavior

- `src/features/tickets/data/tickets.ts` defined five active demo tickets: `CQ-001`..`CQ-005`.
- Tickets app showed “My Tickets” and general ticket workflow alongside Café Calculator.
- Progress app showed legacy ticket XP, achievements derived from CQ tickets, and “Sprint 01 · Python basics” ticket list.
- Editor assumed `currentTicketId` always mapped to an active ticket definition.
- Chat seeded CQ-specific completion/ticket messages.
- GigBoard contained 7 jobs, including 6 non-Chapter-1 legacy/browsing jobs.
- Persisted progress/drafts could restore legacy CQ IDs.

## Root Cause

Legacy demo ticket content (CQ-001..CQ-005) and unrelated GigBoard jobs remained in active catalogs/seed data. Persistence hydration restored saved IDs without filtering retired IDs, allowing legacy content to reappear or create invalid assumptions.

## Implementation Plan

1. Retire CQ-001..CQ-005 from active ticket catalog while keeping reusable ticket types/architecture and legacy ID constants for sanitization.
2. Sanitize legacy/unknown ticket IDs in progress and draft hydration; make progress/ticket selection tolerate empty catalog.
3. Update Tickets, Progress, Editor, Chat seed data, and GigBoard job catalog/UI assumptions.
4. Add/update regression tests for sanitization and cafe-only visibility.
5. Run focused tests, full test suite, build; record lint status.
6. Create report and update report index/changelog.

## Actual Implementation

- **Tickets catalog**: `tickets.ts` now exports an empty active `TICKETS` catalog, keeps reusable ticket types, adds `LEGACY_TICKET_IDS`, `isLegacyTicketId`, `isActiveTicketId`. `TicketId` is now `string` to support future chapter tickets while retiring fixed CQ IDs.
- **Progress logic/store**: Added sanitization helpers (`sanitizeCompletions`, `sanitizeStarted`, `sanitizeCurrentTicketId`) and empty-catalog-safe behavior. `ProgressPersisted.currentTicketId` is `TicketId | null` (version remains 1). Hydration removes legacy/unknown CQ IDs and falls back safely. `submitVerified` ignores unknown tickets with `unknown-ticket` reason.
- **Drafts**: `draftStore` sanitizes legacy/unknown draft IDs on hydrate and guards `getCode/setCode/resetToStarter` for missing tickets.
- **Tickets UI**: Tickets app defaults to Café Calculator and hides the general ticket tab/view when there are no active general tickets. Café workflow/boards remain intact.
- **Progress UI**: Legacy ticket XP/ticket sections are hidden when ticket catalog is empty; Chapter 1 tracker and Café guidance remain visible. Division-by-zero guarded for empty catalog.
- **Editor**: Handles `currentTicketId=null`/missing ticket safely; disables ticket submit/reset when no active ticket; file mode behavior preserved.
- **Chat**: Removed CQ seed/completion templates; replaced with generic Chapter 1 guidance. `COMPLETION_MESSAGES` is now `Partial<Record<string,...>>`.
- **GigBoard**: Removed all non-Chapter-1 jobs from `gigboardJobs.ts`; only `GB-1042` `cafe-calculator` remains. Existing route resolution now yields not-found for removed slugs.
- **PixelOS**: Updated Start menu recommended action text from “Continue your first Python ticket” to “Continue your Chapter 1 mission” (directly related to legacy ticket removal).

## Technical Decisions

- **Retire, don’t delete architecture**: Kept ticket types, stores, and UI components reusable; removed only active CQ content.
- **Sanitize on hydrate**: Legacy IDs are dropped during hydration rather than migrating save schema or resetting IndexedDB.
- **Empty-catalog behavior**: UI components guard against missing tickets; progress returns no ticket achievements when catalog is empty.
- **GigBoard removed slugs**: Removed jobs are no longer in catalog; Browser shows existing not-found page for old slugs, preventing stale access.
- **No save architecture change**: `ProgressPersisted.version` remains 1; only `currentTicketId` now allows `null` and hydration sanitizes values.

## Modified, Created, and Deleted Files

### Modified
- `src/app/PixelOS.tsx` — recommended action text updated to Chapter 1 mission.
- `src/features/browser/BrowserApp.test.tsx` — updated for cafe-only catalog.
- `src/features/browser/GigBoardApplication.test.tsx` — updated removed-job case and reset state.
- `src/features/browser/data/gigboardJobs.ts` — removed non-Chapter-1 jobs.
- `src/features/chapter1/Chapter1Tracker.test.tsx` — updated ProgressApp expectations for no legacy ticket catalog.
- `src/features/chat/chatData.ts` — removed CQ seed/completion content.
- `src/features/editor/EditorApp.test.tsx` — replaced obsolete CQ ticket tests with no-ticket/legacy-sanitization safety tests.
- `src/features/editor/EditorApp.tsx` — null/missing ticket guards; ticket actions disabled when no active ticket.
- `src/features/progress/ProgressApp.tsx` — hide legacy ticket XP/track when catalog empty.
- `src/features/progress/progressLogic.test.ts` — rewritten for empty catalog and sanitization.
- `src/features/progress/progressLogic.ts` — sanitization and empty-catalog-safe logic.
- `src/features/progress/progressStore.ts` — hydrate sanitization and null current ticket support.
- `src/features/tickets/CafeDevelopmentBoard.test.tsx` — reset `currentTicketId` to null.
- `src/features/tickets/CafeProjectBoard.test.tsx` — reset `currentTicketId` to null.
- `src/features/tickets/TicketsApp.test.tsx` — updated for cafe-only behavior.
- `src/features/tickets/TicketsApp.tsx` — cafe-only when no general tickets.
- `src/features/tickets/data/tickets.ts` — retired CQ catalog; added legacy ID helpers.
- `src/features/tickets/draftStore.ts` — sanitize/guard legacy drafts.
- `src/features/tickets/ticketsViewState.ts` — default view cafe.

### Created
- `src/features/progress/progressStore.test.ts` — regression test for CQ ID hydration sanitization.
- `src/features/tickets/draftStore.test.ts` — regression test for legacy draft sanitization.
- `docs/reports/002-remove-legacy-tickets.md` — this report.

### Deleted
- None.

### Pre-existing unrelated modification (not changed by this task)
- `package.json` — pre-existing `dev` script modification (`vite dev --port 9090 --strictPort`) present before Task 002; left untouched.

## Important Implementation Details

- Legacy CQ IDs are only recognized for sanitization; they are not present in active ticket selectors/UI.
- `sanitizeCurrentTicketId` returns `null` when no active tickets exist.
- Editor still supports file mode; ticket submit/reset is unavailable without an active ticket.
- GigBoard route for removed slugs resolves to the existing Browser not-found page.
- Cafe stores, cafe boards, chapter1 quest/payment/reward logic, and IndexedDB save architecture were not changed.

## Automated Tests and Exact Results

### Focused baseline (before implementation, already passing)
- `npx vitest run src/features/progress/progressLogic.test.ts src/features/tickets/TicketsApp.test.tsx src/features/editor/EditorApp.test.tsx src/features/browser/GigBoardApplication.test.tsx src/features/browser/BrowserApp.test.tsx` — **PASS** (5 files, 43 tests)
- `npx vitest run src/features/browser/GigBoardDeliveryReadiness.test.tsx src/features/browser/GigBoardDevMode.test.tsx src/features/browser/GigBoardPayment.test.tsx src/features/browser/GigBoardSubmission.test.tsx src/features/tickets/CafeProjectBoard.test.tsx src/features/tickets/CafeDevelopmentBoard.test.tsx` — **PASS** (6 files, 41 tests)

### Focused regression/affected tests (after implementation)
- `npx vitest run src/features/progress/progressLogic.test.ts src/features/progress/progressStore.test.ts src/features/tickets/draftStore.test.ts src/features/tickets/TicketsApp.test.tsx src/features/editor/EditorApp.test.tsx src/features/browser/GigBoardApplication.test.tsx src/features/browser/BrowserApp.test.tsx src/features/chapter1/Chapter1Tracker.test.tsx` — **PASS** (8 files, 54 tests)
- `npx vitest run src/features/browser/GigBoardDeliveryReadiness.test.tsx src/features/browser/GigBoardDevMode.test.tsx src/features/browser/GigBoardPayment.test.tsx src/features/browser/GigBoardSubmission.test.tsx src/features/tickets/CafeProjectBoard.test.tsx src/features/tickets/CafeDevelopmentBoard.test.tsx` — **PASS** (6 files, 41 tests)

### Full suite
- `npm test` (`vitest run`) — **1 flaky failure observed, passed on isolated rerun**.
  - Initial full run: **FAIL** (67 files: 66 passed, 1 failed; 540 tests: 539 passed, 1 failed)
  - Failure: `src/features/browser/GigBoardDevMode.test.tsx > GigBoard development testing UI > advances to CH1-04 without submitting an application and enables Apply` — could not find text `/advanced to CH1-04/i`; DOM showed dev panel stuck in “Unlocking…” state.
  - Isolated rerun: `npx vitest run src/features/browser/GigBoardDevMode.test.tsx` — **PASS** (1 file, 7 tests).
  - Assessment: flaky/timing-sensitive test; not caused by Task 002 code changes.

## Build and Validation Results

- `npm run build` — **PASS**. Vite client build, SSR build, and Nitro build completed successfully. Existing chunk-size warnings remain.
- `npm run lint` — **BLOCKED/INCONCLUSIVE** (not rerun in this task; previously timed out at 120s and 180s during Task 001 baseline). Pre-existing known issue.

## Manual Tests Actually Performed

- None (no interactive browser/Godot runtime launched in this session). Validation relied on automated tests and build.

## Manual Testing Instructions

1. Start the app (`npm run dev`) and open PixelOS.
2. **Tickets app**: Open My Tickets/Tickets app. Confirm only Café Calculator mission is visible; no “My Tickets” general tab, no CQ-001..CQ-005 tickets.
3. **GigBoard**: Open Browser → GigBoard jobs. Confirm only “Build a Café Order Calculator” is listed. Navigate manually to `gigboard.codequest/jobs/rename-files-python`; confirm not-found page.
4. **Progress**: Open Progress app. Confirm Chapter 1 tracker and Café guidance are visible; no “Sprint 01 · Python basics”, no CQ ticket XP/track.
5. **Editor**: Open Editor with no file selected. Confirm no crash; no active ticket state; Run/Submit ticket actions disabled. Open a Python file from Explorer and confirm file mode Run/Save still work.
6. **Legacy save sanity**: With an existing save containing CQ IDs in local IndexedDB (if available), reload app. Confirm no CQ tickets appear in Tickets/Progress and no crashes in Editor/Progress.

## Risks and Limitations

- **Full suite has a known flaky test**: `GigBoardDevMode.test.tsx` showed one timing-sensitive failure in full run but passed isolated rerun. Not introduced by this task, but should be monitored.
- **Lint still blocked**: `npm run lint` times out in this environment; no lint signal for this change.
- **Empty ticket catalog UX**: Progress/Tickets now assume no general tickets. When future chapter tickets are added, UI paths for general tickets should be revalidated.
- **Sanitization drops legacy records silently**: This is intentional to prevent reappearance/crash; old CQ completion records are not migrated into a new system because CQ content is retired.

## Unverified Assumptions

- No other runtime path constructs CQ IDs outside the sanitized stores/catalog. Grep-based checks were used, but only exercised code paths covered by tests were executed.
- Existing saved player files in the virtual filesystem are unaffected (no code path touched file contents; not manually verified in runtime).

## Remaining Issues

- `npm run lint` timeout remains unresolved (pre-existing).
- `GigBoardDevMode.test.tsx` may be flaky under full-suite load.

## Acceptance Criteria Checklist

- [x] Legacy CQ tickets removed from active catalog/UI.
- [x] Legacy GigBoard jobs removed; only cafe calculator remains.
- [x] Legacy persisted CQ IDs sanitized on hydrate.
- [x] Café Calculator mission/progress/dependencies/tests/reward logic preserved.
- [x] Save architecture unchanged; IndexedDB not reset.
- [x] Regression tests added/updated.
- [x] Focused tests pass.
- [x] `npm test` executed; one flaky failure observed, isolated rerun passed (documented).
- [x] `npm run build` passed.
- [x] Lint reported as blocked/inconclusive.

## Recommended Next Steps

1. Investigate/fix `GigBoardDevMode.test.tsx` flakiness (wait for async UI state more robustly).
2. Investigate `npm run lint` timeout and make lint runnable in CI/local.
3. When adding Chapter 2 tickets, add them to the reusable ticket catalog and confirm Tickets/Progress/Editor general-ticket paths.
4. Consider a small migration note in docs if future saves need explicit legacy-ticket cleanup telemetry (currently silent).
