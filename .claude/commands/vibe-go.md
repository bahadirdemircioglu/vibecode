---
description: "Start a task: load state, check tools, scan skills, confirm scope"
---

## Task: $ARGUMENTS

Execute these steps in order:

### 0. MCP Setup & Check
Ensure MCP servers are configured and running before any work begins:

1. **Check `.mcp.json`** — Should already exist (tracked in git). If missing for any reason, create it with Serena (`--project-from-cwd`) and Context7 servers, then WARN: "`.mcp.json` was missing and recreated — restart session for MCP servers." Then **STOP**.

2. **Check `.serena/project.yml`** — NOT tracked in git (it is in `.gitignore`); the session-start hook auto-creates it from `.vibecode/templates/serena-project.yml` on first run. If missing, auto-detect languages from project files and create it:
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

### 1. Serena Onboarding & Language Check

**Onboarding kontrolü:**
- Call `list_memories` on Serena
- If memories exist → list them, devam et
- If memories are empty → session-start hook otomatik oluşturmuş olmalı, yine de kontrol et:
  - `.serena/memories/` dizininde dosya var mı? Varsa Serena restart gerekebilir
  - Yoksa → proje yapısından temel memory'leri `write_memory` ile oluştur (project_overview, suggested_commands, tech_stack, task_completion)
  - Context-yoğun tam onboarding YAPMA — hafif memory'ler yeterli

**Dil kontrolü:**
- Projedeki dosya uzantılarını kontrol et:
  - `*.py` / `pyproject.toml` → python gerekli
  - `package.json` / `*.ts` / `*.tsx` → typescript gerekli
  - `go.mod` → go gerekli
  - `Cargo.toml` → rust gerekli
  - `*.sh` → bash gerekli
- `.serena/project.yml`'deki `languages` listesiyle karşılaştır
- Eksik dil varsa → project.yml'e ekle + WARN: "Dil eklendi — restart gerekebilir"

### 2. Load State
- Read `HANDOFF.md` if it exists, summarize previous session
- If its `## Goal` section has an active goal (`- **Goal status:** active`): show the goal + acceptance
  criteria and keep this task pointed at it (goal set/update/clear: see `.vibecode/templates/HANDOFF.md`)
- If not found: "Fresh session — no prior state"

### 3. Identify Skills (DO NOT READ YET)
**List relevant skills but do NOT load their content into context.**
- Note which skills from `.vibecode/skills/` match the task (by name/description only)
- Skills will be loaded **lazily** — only when about to work on that specific area
- Example: don't load `react-patterns` if the task is backend-only

### 4. Load Constraints
- Read `docs/constraints/*.md` ONLY if the task touches constrained areas
- Skip if task is clearly unrelated (e.g., don't load database constraints for a CSS fix)

### 5. Confirm Ready
```
Ready: $ARGUMENTS
  State: [fresh / resumed from HANDOFF.md]
  MCP: Serena [OK/UNAVAILABLE] | Context7 [OK/UNAVAILABLE]
  Serena: Onboarding [done/needed] | Memories [count] | Languages [list]
  Goal: [active goal one-liner / none]
  Skills available: [list by name — NOT loaded yet]
  Constraints: [loaded list or "skipped — not relevant"]
  Model routing: Sonnet-first (default) → Opus (planning / 2-fail escalation)
```

### 6. Context Rules
**Minimize context at all times:**
- **Skills:** Load a skill ONLY when about to use it. Read it into the subagent that needs it, not the main context.
- **Standards:** Load the relevant standard ONLY when about to write code in that area.
- **Files:** Don't read files "just in case." Read only what the current step requires.
- **Model routing / delegation / 2 deneme kuralı:** `.vibecode/standards/delegation.md` (load when delegating or escalating).
- **Tooling:** Docker-first — dependency install / test / migration komutları container içinde (`docker compose exec <service> uv …` / `npm …`, ya da `make` hedefleri); host'a `pip`/`npm install` yok.

Begin work after confirmation.
