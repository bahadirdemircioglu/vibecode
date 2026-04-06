# CLAUDE.md

> Entry point for Claude's behavior. Detailed rules live in `.vibecode/standards/`
> and are loaded on demand. Skills live in `.vibecode/skills/`.

---

## Standards Index

Read the relevant standard before writing code in that area.

| Area                       | Standard file                                 |
|---------------------------|-----------------------------------------------|
| Backend code               | `.vibecode/standards/backend.md`              |
| Frontend code              | `.vibecode/standards/frontend.md`             |
| Tests                      | `.vibecode/standards/testing.md`              |
| Docker / infra             | `.vibecode/standards/docker.md`               |
| Architecture / new feature | `.vibecode/standards/architecture.md`         |
| Git commits / branching    | `.vibecode/standards/git.md`                  |
| Documentation              | `.vibecode/standards/documentation.md`        |
| Port assignments           | `.vibecode/standards/ports.md`                |
| Security / auth            | `.vibecode/standards/security.md`             |
| Backup / data              | `.vibecode/standards/backup.md`               |
| Project-specific decisions | `docs/constraints/*.md`                       |

---

## Session Startup

Use `/vibe-go [task]` for the full sequence. Summary:

1. **Load state** — read HANDOFF.md if it exists, otherwise fresh session
2. **Load skills** — scan `.vibecode/skills/` for task-matching skills
3. **Confirm** — "Ready: [task] | Skills: [loaded list]"

---

## Tools

**Serena** (code navigation) — prefer over grep/find when available. Use for:
- Finding symbols, routes, classes, functions
- Dependency and impact analysis before edits
- Understanding code relationships

**Context7** (library docs) — prefer over memory when available. Use for:
- FastAPI, SQLAlchemy, Alembic, React, TypeScript, TanStack Query, Zustand, shadcn/ui, Pydantic v2

If Serena or Context7 are unavailable, fall back to Grep/Read and official docs.
Do not block work waiting for MCP setup.

---

## Project Structure

```
project-root/
├── backend/                  # FastAPI — src/{api,services,models,schemas,core}
├── frontend/                 # React+TS — src/{components,pages,hooks,store,api}
├── .vibecode/
│   ├── standards/            # Coding standards (10 files)
│   ├── skills/               # AI skills
│   └── memories/errors/      # Error history
├── .claude/
│   ├── commands/             # Slash commands
│   ├── hooks/                # Lifecycle hooks
│   └── rules/                # Path-scoped rules
├── docs/
│   ├── constraints/          # Project-specific constraints
│   ├── CHANGELOG.md
│   ├── decisions.md          # ADRs
│   └── progress.md
├── HANDOFF.md                # Session state (written by /done, read by /go)
├── Makefile                  # Dev commands entry point
└── docker-compose.yml
```

> `backend/`, `frontend/`, `Makefile`, `docker-compose.yml` are created by `/vibe-scaffold`.

---

## Skills

Load matching skills from `.vibecode/skills/` at task start.
Project skills override user-level skills when both exist.

If a skill defines a template, use it.
If a skill defines an anti-pattern, avoid it.

---

## Slash Commands

| Command | Action |
|---------|--------|
| `/vibe-go [task]` | Load state + skills + begin task |
| `/vibe-done` | Verify + update docs + write HANDOFF.md + propose commit |
| `/vibe-plan [feature]` | Architecture plan, wait for approval |
| `/vibe-compact` | Save state to HANDOFF.md, then compact context |
| `/vibe-scaffold [name]` | Initialize new project from template |
| `/vibe-security-review [file]` | OWASP Top 10 security review with patched code |
| `/vibe-status` | Show session state and MCP health |

---

## /vibe-done Checklist

1. Summarize changes
2. Run `make verify` (lint + test + audit) — fix failures before continuing
3. Update CHANGELOG.md and relevant docs
4. Write HANDOFF.md for next session
5. Propose commit message (Conventional Commits)

---

## Core Rules

1. Read the relevant standard before writing code in that area
2. Verify library APIs from docs (Context7 or official) — don't guess
3. Write tests for every new feature or change
4. Run `make verify` before reporting task complete — fix failures, don't skip
5. Update CHANGELOG.md after every change
6. Use Serena for code navigation when available — prefer it over grep
7. Max 3 files per step — use subagents for larger changes
8. New feature or architecture change — write plan, wait for approval

---

## Quick Reference

```
New project?          →  /vibe-scaffold → /vibe-plan → /vibe-go
Existing project?     →  /vibe-go [task]
Searching code?       →  Serena (preferred) or Grep
3rd party library?    →  Context7 or official docs
Backend code?         →  .vibecode/standards/backend.md
Frontend code?        →  .vibecode/standards/frontend.md
Tests?                →  .vibecode/standards/testing.md
Done with task?       →  /vibe-done
Context bloating?     →  /vibe-compact
Session state?        →  /vibe-status
Error history?        →  .vibecode/memories/errors/
```
