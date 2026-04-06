---
description: "Start a task: load state, check tools, scan skills, confirm scope"
---

## Task: $ARGUMENTS

Execute these steps in order:

### 0. MCP Setup & Check
Ensure MCP servers are configured and running before any work begins:

1. **Check `.mcp.json`** — If it does NOT exist in the project root, create it:
```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```
If the file was just created, tell the user: "`.mcp.json` created — session restart needed for MCP servers to load. Run `/vibe-go` again after restart."  Then **STOP**.

2. **Verify MCPs** — Try calling a Serena tool and a Context7 tool:
   - Serena responds → "Serena: OK"
   - Serena silent → "Serena: UNAVAILABLE — falling back to Grep/Read"
   - Context7 responds → "Context7: OK"
   - Context7 silent → "Context7: UNAVAILABLE — falling back to official docs"

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
