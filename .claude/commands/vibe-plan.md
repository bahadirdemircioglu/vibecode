---
description: "Create an architecture plan for a new feature or project"
---

## Feature: $ARGUMENTS

Create a detailed architecture plan. Do NOT write any code until the plan is approved.

> **Model:** This command runs entirely on Opus. Do NOT delegate to Sonnet subagents — planning requires deep reasoning.

### 0. MCP Setup & Check
Ensure MCP servers are configured and running before any work begins:

1. **Check `.mcp.json`** — Should already exist (tracked in git). If missing for any reason, create it with Serena (`--project-from-cwd`) and Context7 servers, then WARN: "`.mcp.json` was missing and recreated — restart session for MCP servers." Then **STOP**.

2. **Check `.serena/project.yml`** — NOT tracked in git (it is in `.gitignore`); the session-start hook auto-creates it from `.vibecode/templates/serena-project.yml` on first run. If missing, auto-detect languages and create it. If task needs a language not listed, add it and note restart is needed.

3. **Verify MCPs** — Call `get_current_config` on Serena:
   - Active project with correct languages → "Serena: OK"
   - No active project → "Serena: UNAVAILABLE — restart session"
   - Context7: try a Context7 tool call
     - responds → "Context7: OK"
     - silent → "Context7: UNAVAILABLE — falling back to official docs"

If Serena is unavailable, WARN the user and ask if they want to continue without it. Serena is critical for token-efficient code navigation.

### 0.5 Serena Planning Mode
Switch Serena to read-only planning mode to prevent accidental file writes during planning:
- Call `switch_modes` with `["planning", "interactive"]`
- This disables all write tools in Serena — only read/search/analysis tools remain active
- After plan is approved and implementation begins (via `/vibe-go`), mode automatically returns to `["editing", "interactive"]`

### 1. Load Standards
- Read `.vibecode/standards/architecture.md`
- Read all files in `docs/constraints/*.md`

### 2. Research
- **Read `docs/architecture/INDEX.md`** — bir satır özetlerden ilgili eski planları tespit et (mevcut planların tek otoritesi; `ls` çekme)
- Sadece **ilgili** plan dosyalarını targeted Read et (hepsini değil)
- Use Serena to analyze existing codebase for related code
- Use Context7 for any third-party library decisions
- Review `docs/decisions.md` for prior architectural decisions

### 3. Create Architecture Plan
Write `docs/architecture/$ARGUMENTS-plan.md` with these sections:

```markdown
# Architecture Plan: $ARGUMENTS

## Overview & Goals
[What this feature does and why it's needed]

## Directory Structure Changes
[New directories, files to create or modify]

## Tech Decisions
[Libraries, patterns, approaches — with rationale for each]

## Database Schema
[New tables, columns, relationships, indexes — skip if N/A]

## API Contract
[New endpoints: method, path, request/response shapes — skip if N/A]

## Docker Services
[New containers, volumes, networks — skip if N/A]

## Port Assignments
[Read from ports file — assigned ports for any new services]

## Security Considerations
[Auth, CORS, rate limiting, input validation relevant to this feature]

## Migration Plan
[Steps to implement without breaking existing functionality]

## Open Questions
[Decisions that need user input before proceeding]
```

### 4. Update INDEX
Append a one-line entry to `docs/architecture/INDEX.md` under "Aktif Planlar":
```
- [$ARGUMENTS]($ARGUMENTS-plan.md) — bir cümlelik özet (~80 karakter)
```
If a previous plan is superseded by this one, **move** that line to "Superseded / Arşivlenmiş" with note: `superseded by [$ARGUMENTS]`.

### 5. Present Plan
Show the complete plan to the user.

### 6. Wait for Approval
**STOP HERE.** Do NOT proceed without explicit user approval.

Say: "Plan written to `docs/architecture/$ARGUMENTS-plan.md` (INDEX güncellendi). Please review and approve before I begin implementation."
