# CodeQuest — Coding Standards

## General Principles

- Understand existing behavior before changing it.
- Make the smallest change that solves the task.
- Preserve working behavior and player progress.
- Prefer clarity and maintainability over cleverness.
- Do not add dependencies unless necessary and justified.

## TypeScript / React

- **Strict TS**: respect `tsconfig.json` strictness (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.).
- **Types**: avoid `any`; use explicit interfaces/types for domain records, bridge payloads, and persisted data.
- **State**: prefer existing Zustand store patterns; keep domain logic pure where possible (see `chapter1Progress.ts`, `progressLogic.ts`, `windowReducer.ts`).
- **Components**: keep components modular; move reusable logic to feature/domain modules or services.
- **Imports**: use `@/*` alias for `src/*` as configured.
- **Side effects**: isolate persistence/bridge/runtime side effects from pure validation/progression logic.
- **Error handling**: surface actionable errors; do not swallow errors with empty catches unless explicitly justified.
- **UI**: follow existing PixelOS visual patterns and shared UI primitives where appropriate.

## TanStack Start / Vite

- Do not manually duplicate plugins/config already provided by `@lovable.dev/vite-tanstack-config` (`vite.config.ts` has warning).
- Routes live under `src/routes/`; generated `routeTree.gen.ts` should only change through normal tooling.
- Keep SSR/server entry conventions intact (`tanstackStart.server.entry = "server"`).

## Godot / GDScript

- Follow existing scene/script organization under `godot-source/MVPCODE (1)/MVPCODE/`.
- Keep bridge payloads explicit and validated.
- Use stable IDs/event types for cross-runtime contracts.
- When changing Godot source that affects web gameplay, rebuild/export to `public/godot/` as required and document it.
- Preserve save schema compatibility or add explicit migration with approval.

## Persistence and Data Contracts

- Treat persisted data as untrusted input; validate before adopting.
- Version persisted records/schemas where appropriate.
- Do not silently overwrite unreadable saves; fail safely.
- Use `trackedSave`/`debouncedSave`/`dbAtomic` patterns appropriately.
- Keep store keys and schema versions explicit.

## Bridge / Integration Contracts

- Validate message `origin` and `source`.
- Validate payload shape exactly before acting.
- Keep event IDs/dialogue IDs/quest IDs stable unless a migration is planned.
- Maintain idempotency for quest completion and payment flows.
- Document contract changes in `docs/ARCHITECTURE.md` and create a decision record for significant changes.

## Testing and Verification

- Add/adjust tests close to affected domain.
- Bug fixes should include regression tests when feasible.
- Do not weaken assertions or delete tests to pass.
- Run focused tests first, then broader validation as needed.

## File and Change Management

- Do not edit unrelated files.
- Do not overwrite user modifications; check `git status` before and after.
- Avoid creating duplicate docs/sources of truth; update canonical docs.
- Do not commit generated artifacts/caches unless intentionally required.

## Naming and Structure

- Follow existing feature-based structure under `src/features/<domain>/`.
- Keep tests near features or in existing test locations following current conventions.
- Use descriptive names; avoid abbreviations that obscure domain meaning.
- Prefer `*.test.ts` / `*.test.tsx` for Vitest.