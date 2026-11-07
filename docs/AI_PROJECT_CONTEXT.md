
# CodeQuest — AI Development Context

## Project
CodeQuest is a story-driven programming learning game.

## Architecture
- Godot: game world, NPCs, character movement.
- React + TypeScript: Pixel OS.
- TanStack Router: routing.
- Zustand: application state.
- IndexedDB: persistence.
- Pyodide: Python execution.
- Vitest: testing.

## Integration
- Godot Web runs inside a React iframe.
- Godot sends `codequest:open-os`.
- React opens Pixel OS without unmounting Godot.

## Development
- Branch: pixelos-dev
- Work on React only unless explicitly instructed.
- Preserve existing functionality.
- Do not install dependencies unnecessarily.
- Do not commit or push automatically.

## Chapter 1
Title: The First Paycheck.

Player finds a freelance Python job and earns $50.

Quest manager:
- src/features/chapter1/chapter1Quests.ts
- src/features/chapter1/chapter1Progress.ts

Existing progress:
- src/features/progress/progressStore.ts

Persistence:
- src/services/persistence/db.ts

## Rules
- Inspect only task-relevant files.
- Reuse existing utilities.
- Avoid unrelated refactoring.
- Run focused tests before full validation.
- Document important changes in docs/.
