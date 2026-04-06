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

### 2. Identify Skills (DO NOT READ YET)
**List relevant skills but do NOT load their content into context.**
- Note which skills from `.vibecode/skills/` match the task (by name/description only)
- Skills will be loaded **lazily** — only when about to work on that specific area
- Example: don't load `react-patterns` if the task is backend-only

### 3. Load Constraints
- Read `docs/constraints/*.md` ONLY if the task touches constrained areas
- Skip if task is clearly unrelated (e.g., don't load database constraints for a CSS fix)

### 4. Confirm Ready
```
Ready: $ARGUMENTS
  State: [fresh / resumed from HANDOFF.md]
  MCP: Serena [OK/UNAVAILABLE] | Context7 [OK/UNAVAILABLE]
  Skills available: [list by name — NOT loaded yet]
  Constraints: [loaded list or "skipped — not relevant"]
  Model routing: Opus (planning/review) → Sonnet (code writing)
```

### 5. Context Rules
**Minimize context at all times:**
- **Skills:** Load a skill ONLY when about to use it. Read it into the subagent that needs it, not the main context.
- **Standards:** Load the relevant standard ONLY when about to write code in that area.
- **Files:** Don't read files "just in case." Read only what the current step requires.
- **Model routing:** Opus plans/reviews. Sonnet subagents write code (pass relevant skill content to the subagent prompt).

Begin work after confirmation.
