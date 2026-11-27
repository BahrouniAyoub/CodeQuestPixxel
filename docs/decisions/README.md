# Architectural Decision Records

Create a decision record for any significant architectural change, especially changes affecting:

- save ownership or save schemas
- quest state or progression authority
- Python execution/runtime behavior
- persistence/storage contracts
- Godot↔React communication protocols
- chapter progression model
- cross-cutting architecture or major dependency changes

## Naming

`NNN-short-title.md`

## Suggested Template

```md
# NNN — Title

- Date:
- Branch:
- Status: Proposed | Accepted | Superseded | Rejected
- Related report:

## Context
## Decision
## Alternatives considered
## Impact
## Migration / compatibility
## Risks
## Validation
```

## Index

| Decision | Date | Status | Summary |
|---|---|---|---|
| [001-windows-style-start-menu-integration.md](./001-windows-style-start-menu-integration.md) | 2026-11-27 | Accepted | Start-only ID pins, one-shot non-persisted Browser navigation intent, existing game data for player name, no tutorial engine or save/schema changes. |
| [002-dynamic-taskbar-pinning-preference.md](./002-dynamic-taskbar-pinning-preference.md) | 2026-11-27 | Accepted | Additive optional `taskbarPinnedAppIds` in existing `prefs/settings`; missing=defaults, empty=respect, normalized IDs; global UI pref, no save/schema/DB version changes. |