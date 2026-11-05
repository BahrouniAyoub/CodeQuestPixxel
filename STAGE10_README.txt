CodeQuest Stage 10 Core Workflow

Extract this ZIP into your CodeQuest project root, replacing matching src files.
No npm install needed.

Features:
- Explorer double-click Python file opens Editor; warns before discarding unsaved changes.
- Explorer select a Python file, click Open in Terminal; Terminal input is prefilled.
- Editor Back to ticket and window close warn about unsaved edits.
- Terminal refuses to run the open file while Editor has unsaved changes.
- Python runner, ticket system, filesystem implementation and XP remain unchanged.
- Stage 8 debug alert and footer removed.

Test:
1. Open hello.py and edit without saving. Double-click another .py and choose Cancel; original stays open.
2. Click Back to ticket while dirty and choose Cancel; remain in file mode.
3. Save, select hello.py in Explorer, click Open in Terminal. Press Enter to run.
4. Edit without saving, run python hello.py in Terminal; save before running.

This patch was inspected against uploaded source, but not compiled against your project dependencies.
