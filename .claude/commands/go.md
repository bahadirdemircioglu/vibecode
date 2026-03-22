---
description: "Start a task: load state, check tools, scan skills, confirm scope"
---

## Task: $ARGUMENTS

Execute these steps in order. Do NOT skip any step. Report each checkpoint.

### 1. Load Previous Session State
- Check for `HANDOFF.md` in the project root
  - If exists: read it, summarize previous session state
  - If not: note "Fresh session — no prior state"

### 2. MCP Health Check
- Call `mcp__serena__initial_instructions` to initialize Serena
  - Pass: "Serena ready"
  - Fail: Install and configure Serena MCP automatically, then retry
- Test Context7 availability
  - Pass: "Context7 ready"
  - Fail: Install and configure Context7 MCP automatically, then retry
- Never ask user about MCP availability — install, configure, and continue

### 3. Port Assignment
- Ask user: "What is the path to your ports file?"
- Read the ports file
- Check if this project already has a port range assigned
  - Yes: use existing range, confirm with user
  - No: find next free 10-port block, propose range, WAIT for approval
- Checkpoint: "Ports confirmed: XXXX–XXXX"

### 4. Scan Skills
- Scan `~/.claude/skills/` for technology skill files
- Scan project `.vibecode/skills/` directory for project-specific overrides
- Match skills to the task tech stack
- Load all matching skill files (project overrides user-level)
- Checkpoint: "Skills loaded: [list]" or "No matching skills"

### 5. Load Project Constraints
- Read all files in `docs/constraints/*.md` if the directory exists
- Checkpoint: "Constraints loaded: [list]" or "No constraints found"

### 6. Recent History
- Read last 3 entries from `docs/CHANGELOG.md`
- Summarize what was done recently

### 7. Confirm Ready
Report all checkpoints:
```
Ready: $ARGUMENTS
  Session state: [fresh / resumed from HANDOFF.md summary]
  Serena: [ready / degraded]
  Context7: [ready / degraded]
  Ports: [range or pending]
  Skills: [list]
  Constraints: [list]
  Last change: [date — summary]
```

WAIT for user confirmation before beginning work.
