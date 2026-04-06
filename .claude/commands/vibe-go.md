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

### 2. Load Skills (MANDATORY)
**Do NOT skip this step. Skills MUST be loaded before any coding begins.**
- Session startup hook already detected matching skills from project config files
- Read EVERY listed skill file from `.vibecode/skills/` — actually open and read the SKILL.md content
- If skills need manual lookup: scan `.vibecode/skills/` for task-relevant skills
- Skills define patterns, templates, and anti-patterns — they are the coding standards

### 3. Load Constraints
- Read `docs/constraints/*.md` if the directory exists

### 4. Confirm Ready
```
Ready: $ARGUMENTS
  State: [fresh / resumed from HANDOFF.md]
  MCP: Serena [OK/UNAVAILABLE] | Context7 [OK/UNAVAILABLE]
  Skills: [loaded — actually read: list]
  Constraints: [loaded list or none]
  Model routing: Opus (planning/review) → Sonnet (code writing)
```

### 5. Model Routing
When coding begins:
- **Planning, analysis, review, debugging** → Stay on Opus (main context)
- **Writing/editing code** → Delegate to subagents with `model: "sonnet"` for token efficiency
- **Never write code directly on Opus** — always spawn a Sonnet subagent for implementation

Begin work after confirmation.
