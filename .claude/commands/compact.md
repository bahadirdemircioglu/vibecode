---
description: "Safe context compaction: save state before compacting"
---

Save all session state before context compaction. Execute these steps in order.

### 1. Save CHANGELOG
- Check if there are any unsaved changes from this session
- If yes: update `docs/CHANGELOG.md` with all pending changes
- If no changes to save: note "CHANGELOG already current"

### 2. Write HANDOFF.md
Create or update `HANDOFF.md` in the project root with complete session state:

```markdown
# Session Handoff

## Current Task
[What was being worked on — include $ARGUMENTS if provided]

## Status
[In progress / Paused / Blocked — what's done, what's left]

## Branch
[Current git branch name]

## Changes This Session
- [List of all files changed and why]

## Tests
- [Tests added or modified]

## Loaded Skills
- [List of skill files that were active]

## Open Questions
- [Anything unresolved or needing user input]

## Next Steps
- [What to do when resuming]
```

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
