# CodeQuest Pixel OS — Stage 2: Application Interfaces

## Added
- Editor interface (`src/features/editor/EditorApp.tsx`): CodeMirror Python editing, draft save, input, Run/Submit panels, and existing runner adapter.
- Chat interface (`src/features/chat/ChatApp.tsx`): channels, messages, local scripted replies.
- Progress interface (`src/features/progress/ProgressApp.tsx`): derived XP, levels, achievements, ticket history.
- Settings interface (`src/features/settings/SettingsApp.tsx`): appearance, notification preferences, reset actions.
- Shared pixel-app styling (`src/features/shared-apps.css`).
- Connected application mounting and chat/draft hydration in `src/app/PixelOS.tsx`.
- Notification toasts and history panel.

## Existing functionality preserved
- Desktop/taskbar/start/window manager.
- Jira-style Tickets app and ticket data.
- IndexedDB and existing Python runner and test suite infrastructure.

## Verification limitations
- Archive integrity can be checked, but dependency installation timed out in the authoring environment.
- TypeScript build, automated tests and browser interactions are **not verified**.
- Python worker isolation, execution timeout and test validation require an independent security/functional review before relying on them for trusted scoring.
- Terminal and File Explorer remain intentionally out of scope.

## Local run
```bash
npm install
npm run dev
npm run build
npm test
```

If install/build fails, provide the exact terminal error so it can be corrected. The source is based on the existing TanStack Start + Vite Lovable scaffold (not converted to a plain Vite SPA).
