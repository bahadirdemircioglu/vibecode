---
description: "Start a task: load state, check tools, scan skills, confirm scope"
---

## Task: $ARGUMENTS

Execute these steps in order:

### 0. MCP Check
Verify that required MCP servers are running before any work begins:
1. **Serena** — Try calling a Serena tool (e.g. `serena_search_symbols` or list available tools). If it responds: "Serena: OK". If not: "Serena: UNAVAILABLE — code navigation will fall back to Grep/Read"
2. **Context7** — Try calling a Context7 tool (e.g. list available tools). If it responds: "Context7: OK". If not: "Context7: UNAVAILABLE — library docs will fall back to official docs"

If Serena is unavailable, WARN the user and ask if they want to continue without it. Serena is critical for token-efficient code navigation.

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
  MCP: Serena [OK/UNAVAILABLE] | Context7 [OK/UNAVAILABLE]
  Skills: [loaded list]
  Constraints: [loaded list or none]
```

Begin work after confirmation.
