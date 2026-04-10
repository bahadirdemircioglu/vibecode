---
description: "Start a task: load state, check tools, scan skills, confirm scope"
---

## Task: $ARGUMENTS

Execute these steps in order:

### 0. MCP Setup & Check
Ensure MCP servers are configured and running before any work begins:

1. **Check `.mcp.json`** — Should already exist (tracked in git). If missing for any reason, create it with Serena (`--project-from-cwd`) and Context7 servers, then WARN: "`.mcp.json` was missing and recreated — restart session for MCP servers." Then **STOP**.

2. **Check `.serena/project.yml`** — Should already exist (tracked in git). If missing, auto-detect languages from project files and create it:
   - Language detection: `*.py`/`pyproject.toml` → python, `package.json`/`*.ts` → typescript, `go.mod` → go, `Cargo.toml` → rust, `Gemfile` → ruby, `pom.xml`/`build.gradle` → java, `*.csproj` → csharp, `composer.json` → php, `*.tf` → terraform, `*.sh` → bash, `*.cpp`/`CMakeLists.txt` → cpp, etc.
   - Use template from `.vibecode/templates/serena-project.yml` if available
   - Also create `.serena/.gitignore` with: `/cache`, `/project.local.yml`, `/memories`
   - WARN: "`.serena/project.yml` created — restart session for Serena." Then **STOP**.
   
   If it exists but task needs a language not listed → WARN and add it, then note restart is needed.

3. **Verify MCPs** — Call `get_current_config` on Serena:
   - Active project with correct languages → "Serena: OK"
   - No active project → "Serena: UNAVAILABLE — restart session"
   - Active project but task needs a language not listed → WARN and suggest adding it to `.serena/project.yml`
   - Context7: try a Context7 tool call
     - responds → "Context7: OK"
     - silent → "Context7: UNAVAILABLE — falling back to official docs"

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
