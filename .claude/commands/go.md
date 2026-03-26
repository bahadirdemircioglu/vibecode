---
description: "Start a task: load state, check tools, scan skills, confirm scope"
---

## Task: $ARGUMENTS

Execute these steps in order:

### 1. Load State
- Read `HANDOFF.md` if it exists, summarize previous session
- If not found: "Fresh session — no prior state"

### 2. Load Skills
- Session startup hook already detected matching skills from project config files
- Read the listed skill files from `.vibecode/skills/` before starting work
- If skills need manual lookup: scan `.vibecode/skills/` for task-relevant skills

### 3. Load Constraints
- Read `docs/constraints/*.md` if the directory exists

### 4. Confirm Ready
```
Ready: $ARGUMENTS
  State: [fresh / resumed from HANDOFF.md]
  Skills: [loaded list]
  Constraints: [loaded list or none]
```

Begin work after confirmation.
