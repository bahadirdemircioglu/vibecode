---
description: "Safe context compaction: save state before compacting"
---

Save all session state before context compaction. Execute these steps in order.

### 1. Save CHANGELOG
- Check if there are any unsaved changes from this session
- If yes: update `docs/CHANGELOG.md` with all pending changes
- If no changes to save: note "CHANGELOG already current"

### 2. Write HANDOFF.md
Fill `.vibecode/templates/HANDOFF.md` (copy the template; every section, `N/A` where not applicable)
into `HANDOFF.md` at the project root. Include `$ARGUMENTS` (if provided) in the task description and
keep an existing `## Goal` section intact.

### 3. Confirm State Saved
Report:
```
State saved to HANDOFF.md. Safe to compact now.

Summary:
  Task: [current task]
  Status: [status]
  Files changed: [count]
  Next steps: [brief]
```

### 4. Show HANDOFF.md
Display the full contents of HANDOFF.md so the user can verify before compacting.
