# PixelOS Onboarding Design (Revised)

> **Status**: Proposed design (documentation only). No implementation.  
> **Date**: 2026-11-26 (revised after Task 003 review)  
> **Approved directions**: reusable PixelOS tutorial system, existing Pyodide runtime, mentor-driven/job-first flow.

## 1. Goal

Teach players how to use PixelOS through gameplay, at the moment they need each feature. Onboarding should feel like helpful in-game guidance, not a disconnected manual or a blocking gate.

## 2. Design Principles (Issue 5)

- **Just-in-time and contextual**: explain an app when the player needs it for the current objective.
- **Action-based**: show the target, then ask the player to perform a real action.
- **Advance only on real success**: a step completes only after the relevant action has actually succeeded (verified semantic event/state change), not merely on click/tooltip dismissal.
- **Non-blocking by default**: tutorials guide but do not unnecessarily restrict exploration of PixelOS. Players can move, open, or inspect other apps unless a specific safety/consistency reason exists.
- **Respect player agency**: Skip, Replay, Resume, and "remind me later" are available. Skipping UI tutorials never completes programming assessments, never grants quest completion, XP, or money.
- **Recoverable**: if a window is moved, resized, minimized, closed, off-screen, or obscured, the tutorial pauses/repositions and offers recovery actions.
- **Persist safely**: tutorial UI progress/preferences survive refresh/save/load as defined in save ownership (global UI prefs vs per-save gameplay progress).
- **Accessible**: keyboard operable, screen-reader labels, visible focus, no color-only cues, reduced-motion support.

## 3. Onboarding Modes

| Mode | Purpose | Blocking? | Skippable | Completion source |
|---|---|---|---|---|
| Contextual hint | Small nudge near relevant UI | No | Dismissible | N/A or simple acknowledge |
| Guided tutorial | Step-by-step spotlight for a feature | No, modal spotlight only when necessary for focus; player can pause/skip | Yes | Verified action success |
| Practice assessment | Check programming skill | No to start; assessment itself is an explicit task | Can exit, but passing requires valid submission | Automated validation pass |
| Mandatory quest action | Real quest progression | Only by quest rules | No | Existing quest authority |

## 4. Initial Desktop Onboarding (First PixelOS Entry)

Triggered the first time PixelOS overlay opens after CH1-02. Non-blocking: player may Skip; replay available in Settings/Help.

| Step ID | Target | Message | Advance condition (verified success) | Recovery / Skip |
|---|---|---|---|---|
| TUT-OS-01 | Desktop area | "This is PixelOS — your in-game computer." | Player acknowledges with Next/Enter, or focus moves intentionally to highlighted desktop region | Skip marks onboarding skipped; replay available |
| TUT-OS-02 | Desktop icon/app | "Double-click an app icon to open it, or select it and press Enter." | `window_opened` event for selected app ID observed | If icon obscured, highlight Start menu alternative; Skip available |
| TUT-OS-03 | Window titlebar | "Windows can be moved, focused, minimized, and closed." | Player performs one verified window action: move delta, focus change, minimize, or restore | If window closed, prompt "Reopen app" with button; tutorial waits/repositions |
| TUT-OS-04 | Start button | "Open Start to find apps and search." | Start menu state becomes open | If Start moved/hidden by layout, target resolver re-anchors; Skip |
| TUT-OS-05 | Taskbar item | "Running apps appear here. Use it to switch or minimize." | Taskbar app click causes focus/minimize state change | If no running app, prompt to open one; Skip |
| TUT-OS-06 | Return/exit control | "You can return to the Godot world anytime. PixelOS will be here when you come back." | Acknowledge | Skip |

## 5. Contextual Onboarding by App

| App | Trigger | Tutorial ID | Teaches | Verified completion condition | Recovery |
|---|---|---|---|---|---|
| Browser | CH1-03 active, first Browser open | TUT-BROWSER-01 | Address/search, GigBoard, job listing | GigBoard route/job details opened (`route_changed`/app state) | If navigated away, "Back to GigBoard" action; no lockout |
| GigBoard | First GigBoard view | TUT-GIGBOARD-01 | Read job carefully, apply when ready | Café job details opened; application step separate and gated by readiness | Can explore other jobs/pages; tutorial pauses |
| Mail | Player prompted to contact Alex / first Mail open | TUT-MAIL-01 | Inbox, thread, compose/reply | Alex thread opened or help request sent (message persisted) | If Mail closed, reopen via prompt; compose draft not lost |
| File Explorer | Before first practice | TUT-EXPLORER-01 | Folders, create/open practice files | Practice folder opened/created in virtual FS | If folder missing, offer "Create practice folder" |
| Code Editor | First lesson/practice open | TUT-EDITOR-01 | Edit, Run, output, Save, Submit/Check | Successful run event with result received (not necessarily passing tests) | If panel hidden, restore layout; Skip |
| Chat | First hint needed | TUT-CHAT-01 | Ask Alex for hints; hint levels | Chat opened or hint requested event | Optional, non-blocking |
| Tickets | First Café task phase | TUT-TICKETS-01 | Task details, requirements, verify/submit | Task card opened and requirements viewed | If Tickets closed, reopen prompt |
| Progress | After first lesson/task completion | TUT-PROGRESS-01 | XP/skills/chapter progress | Progress app opened | Optional |
| Quest Journal | First open or objective change | TUT-JOURNAL-01 | Current objective, location, completed quests | Journal opened | Optional |
| Terminal | First mission requiring Terminal (later) | TUT-TERMINAL-01 | Run simple commands | Safe command executed with result | Later chapter |
| Settings | Optional | TUT-SETTINGS-01 | Accessibility, tutorial replay/reset | Settings opened | Optional |

## 6. Tutorial UX Pattern

### 6.1 Spotlight + Tooltip

- Dimmed backdrop with highlighted target rectangle; target remains interactive when possible.
- Tooltip card: title, short explanation, step count, Back/Next (when allowed), Skip, Pause, Replay.
- Tooltip positions auto (top/right/bottom/left) with viewport clamping.
- Non-blocking mode: no hard input trap outside tooltip except optional focus guidance; player can interact with other UI. Modal trap used only for critical onboarding steps where losing context is likely, and Esc/pause always available.

### 6.2 Action-Gated Advancement (verified success)

- "Next" disabled when step requires in-app action.
- Advance only after semantic success event/state transition, e.g. `window_opened`, `window_focused`, `route_changed`, `file_created`, `file_saved`, `run_completed`, `test_submitted`, `message_sent`.
- Do not advance on mere button click intent, tooltip close, or failed attempt.
- Failed action gives helpful feedback and keeps step active.

### 6.3 Recovery for moved/closed/minimized windows

| Situation | Behavior |
|---|---|
| Target moved/resized | Reposition spotlight on next frame via ResizeObserver/MutationObserver/requestAnimationFrame |
| Target window minimized | Pause step, show "Restore [App] to continue" action button |
| Target window closed | Pause step, show "Reopen [App]" action; tutorial resumes on reopen/focus |
| Target off-screen/unavailable | Pause and offer Resume, Re-anchor, Skip step, or Skip tutorial |
| App route changed | If still compatible, re-anchor; if not, show "Return to [view]" CTA |
| User explores elsewhere | Tutorial enters paused/waiting state; no penalty; resume affordance visible |

### 6.4 Exploration policy

- Do not lock unrelated apps, desktop icons, or movement unless technically necessary for a short-lived modal prompt.
- If a step requires a specific app, guide the player back with a button rather than disabling the rest of PixelOS.
- Skipping or pausing tutorials must never block unrelated exploration.

## 7. Tutorial State Model (Proposed)

```ts
interface TutorialProgress {
  tutorialId: string;
  status: "not_started" | "active" | "paused" | "completed" | "skipped";
  currentStepIndex: number;
  completedStepIds: string[];
  lastActionEventId?: string;
  skippedAt?: string;
  completedAt?: string;
  version: 1;
}
```

Persistence ownership is defined in `LEARNING_ARCHITECTURE_PROPOSAL.md` (global UI prefs vs per-save gameplay state). No schema changes/migrations in this task.

## 8. Accessibility Requirements

- Keyboard: Tab/Shift+Tab through tooltip controls; Enter/Space activate; Esc pauses/closes tutorial (never traps user permanently).
- `aria-describedby`/`aria-labelledby` on target and tooltip; live region announces step changes.
- Visible focus ring; high contrast spotlight border; no color-only cues.
- Respect `reduceMotion` setting: disable pulsing/animated transitions.
- Screen-reader fallback: textual tutorial list and step status in Settings > Tutorials.
- Touch/click targets meet minimum size.

## 9. Compatibility with Existing PixelOS

- **Window manager**: spotlight tracks `react-rnd` window bounds and window-store geometry/focus/order.
- **Z-order**: tutorial overlay above normal windows but below critical system modals/alerts where appropriate; never steals irreversible focus.
- **Stable targets**: use `data-tutorial-id` attributes; avoid brittle CSS selectors.
- **App registry**: reference app IDs from registry.
- **No assessment bypass**: skipping TUT-* never completes L1-* assessments or CH1 quests.

## 10. Metrics / Telemetry (Future, optional)

- Tutorial started/completed/skipped/paused/resumed.
- Step drop-off and recovery events.
- Time to complete first run/test/submit.
- No external telemetry by default; local debug only.