<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# CodeQuest — Agent Instructions

These rules are permanent project-wide development rules for CodeQuest. They apply to every future development task unless the user explicitly overrides them.

## Project Orientation

- Read `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/GAME_DESIGN.md`, `docs/CODING_STANDARDS.md`, `docs/TESTING_GUIDE.md`, and `docs/KNOWN_ISSUES.md` before making significant changes.
- `docs/AI_PROJECT_CONTEXT.md` contains earlier AI context; keep it compatible with the canonical docs above.
- Do not invent functionality. Distinguish implemented, partially implemented, and planned features.

## Mandatory Workflow — Before Implementing Any Task

1. Read the relevant project documentation.
2. Check Git status and the current branch.
3. Inspect the existing implementation.
4. Identify relevant dependencies and affected systems.
5. Understand the root cause of a bug before attempting to fix it.
6. Define measurable acceptance criteria.
7. Prepare an implementation plan.
8. Request approval before major architectural changes, destructive operations, or ambiguous design decisions.

## During Implementation

- Implement only the requested task.
- Prefer small and maintainable changes.
- Reuse existing components and utilities.
- Avoid duplicated business logic.
- Preserve existing working features.
- Do not introduce unnecessary dependencies.
- Follow existing naming conventions.
- Use appropriate TypeScript types.
- Keep React components modular.
- Follow Godot scene and script conventions.
- Preserve compatibility with the existing save system.
- Preserve player files and progress.
- Do not introduce multiple conflicting sources of truth.
- Avoid hardcoded chapter-specific logic in reusable systems unless justified.
- Never silently remove working functionality.
- Never hide errors using meaningless exception handling or disabled tests.
- Do not edit unrelated files.
- Do not overwrite existing user modifications.

## Architecture Protection

The existing Godot and PixelOS architecture must be understood and respected.

Any significant change to save ownership, quest state, Python execution, persistence, communication protocols, or chapter progression requires:

- an architectural impact analysis,
- explicit user approval before implementation,
- a decision record under `docs/decisions/`.

Record important architectural decisions as `docs/decisions/NNN-title.md` and update `docs/decisions/README.md`.

## Testing Requirements

Before significant implementation, establish the current test baseline where practical.

After implementation:

1. Run relevant automated tests.
2. Add regression tests for bug fixes.
3. Run the appropriate type checks.
4. Run the production build.
5. If Godot source files were modified, perform relevant Godot validation.
6. Rebuild the Godot Web export when required.
7. Verify integration between Godot and PixelOS when affected.
8. Provide exact manual testing instructions.

Rules:

- Do not claim that tests passed unless they were actually executed successfully.
- Clearly distinguish existing failures from newly introduced failures.
- Never remove or weaken valid tests simply to make the test suite pass.

## Mandatory Implementation Reports

For every actionable development task, bug fix, feature, refactoring, investigation, or documentation task, create a separate Markdown report under `docs/reports/`.

Use sequential numbering and descriptive filenames: `NNN-short-description.md`.

Each report must contain:

- Task title, date, branch, and status.
- Original request.
- Objective and acceptance criteria.
- Previous behavior.
- Root cause, when applicable.
- Implementation plan.
- Actual implementation.
- Technical decisions.
- Modified, created, and deleted files.
- Important implementation details.
- Automated tests and exact results.
- Build and validation results.
- Manual tests actually performed.
- Manual testing instructions.
- Risks and limitations.
- Unverified assumptions.
- Remaining issues.
- Acceptance criteria checklist.
- Recommended next steps.

Create a report even if a task fails or is blocked. Update `docs/reports/README.md` after each report.

## Documentation Maintenance

- Keep relevant project documentation synchronized with significant changes.
- Update `docs/CHANGELOG.md` for meaningful changes.
- Update `docs/ARCHITECTURE.md` whenever architecture changes.
- Update `docs/KNOWN_ISSUES.md` when bugs are discovered or resolved.
- Do not rewrite all documentation unnecessarily for small changes.

## Git Safety Rules

- Never automatically commit or push without explicit permission.
- Never force push.
- Never execute destructive Git commands without explicit approval.
- Never discard uncommitted user changes.
- Never merge branches automatically.
- Never delete project files unrelated to the task.
- Never expose credentials or secrets.
- Review the final diff before declaring completion.
- Do not commit caches, temporary files, or unnecessary generated artifacts.

## Definition of Done

A task is complete only when:

- The requested functionality is implemented.
- Acceptance criteria are satisfied or explicitly marked pending.
- Relevant tests have been executed or clearly marked as blocked.
- Existing functionality has been protected.
- The implementation report exists.
- The report index is updated.
- Relevant project documentation is updated.
- Manual verification instructions are provided.

Do not start another task automatically.
