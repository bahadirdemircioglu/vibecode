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
| Model routing / delegation | `.vibecode/standards/delegation.md`           |
| Git commits / branching    | `.vibecode/standards/git.md`                  |
| Documentation              | `.vibecode/standards/documentation.md`        |
| Port assignments           | `.vibecode/standards/ports.md`                |
| Security / auth            | `.vibecode/standards/security.md`             |
| Backup / data              | `.vibecode/standards/backup.md`               |
| Project-specific decisions | `docs/constraints/*.md`                       |
| Architecture plans index   | `docs/architecture/INDEX.md` (tek otorite — `ls docs/architecture/` çekme) |

---

## Session Startup

Use `/vibe-go [task]` for the full sequence. Summary:

1. **Load state** — read HANDOFF.md if it exists, otherwise fresh session
2. **Load skills** — scan `.vibecode/skills/` for task-matching skills
3. **Confirm** — "Ready: [task] | Skills: [loaded list]"

### New Project Setup (Clone Workflow)

1. `git clone <vibecode-repo> <project-name>`
2. `cd <project-name>`
3. `rm -rf .git README.md`
4. Run `claude` — Serena and Context7 available immediately
5. `/vibe-go [first-task]` to begin

> `.git` is auto-initialized by session-start hook. Project name is auto-detected from directory.
> `.serena/project.yml` is **not** tracked in git — the session-start hook creates it from
> `.vibecode/templates/serena-project.yml` on first run (a restart may be needed for Serena to pick it up).

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
│   ├── standards/            # Coding standards (11 files)
│   └── skills/               # AI skills
├── .claude/
│   ├── commands/             # Slash commands
│   ├── hooks/                # Lifecycle hooks
│   └── rules/                # Path-scoped rules
├── docs/
│   ├── constraints/          # Project-specific constraints
│   ├── CHANGELOG.md
│   ├── decisions.md          # ADRs
│   └── progress.md
├── HANDOFF.md                # Session state + optional ## Goal (written by /vibe-done, read by /vibe-go)
├── Makefile                  # Dev commands entry point
└── docker-compose.yml
```

> `backend/`, `frontend/`, `Makefile`, `docker-compose.yml` are created during project setup.

---

## Skills

**Lazy loading:** Do NOT read skill files at task start. Only list matching skills by name.
Load a skill's SKILL.md content ONLY when about to work in that area — and prefer loading into the subagent that needs it, not the main context.

Project skills override user-level skills when both exist.
If a skill defines a template, use it.
If a skill defines an anti-pattern, avoid it.

---

## Slash Commands

| Command | Action |
|---------|--------|
| `/vibe-go [task]` | Load state + skills + begin task |
| `/vibe-done [--full]` | Verify + update docs + write HANDOFF.md + propose commit (`--full` adds doc-sync) |
| `/vibe-plan [feature]` | Architecture plan, wait for approval |
| `/vibe-sdd [feature]` | Spec-Driven Development on the approved `/vibe-plan` file: questions → requirements → tasks → execute |
| `/vibe-fleet [task]` | Director: dispatch task across parallel role subagents, roll up results |
| `/vibe-collab-debug [bug/paths]` | BugHunter → RefactorPlanner → Critic trio → verified fix plan |
| `/vibe-compact` | Save state to HANDOFF.md, then compact context |
| `/vibe-security-review [file]` | OWASP Top 10 security review with patched code |
| `/vibe-doc-sync [--live] [--tier full] [paths...]` | Continuous doc maintainer — sync docs with code (shadow default) |
| `/vibe-update [ref]` | Sync framework files (standards/skills/hooks/commands) from upstream vibecode — hash-based safe merge |
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
6. Serena aktifken kod okuma sırası: `get_symbols_overview` → `find_symbol(include_body=False)` → gerekli gövdeleri `find_symbol(include_body=True)` ile oku. Tüm dosyayı Read ile okuma — sadece config/doc dosyaları veya Serena'nın kapsamadığı dosyalar için.
   Serena memory = proje bilgisi (yapı, standartlar, komutlar). Claude auto-memory = kullanıcı tercihleri.
7. Max 3 files per step — use subagents for larger changes
8. New feature or architecture change — write plan, wait for approval
9. **Model routing — Sonnet-first:** default Sonnet; planlama **Opus** (`/vibe-plan` → Opus subagent); mekanik iş → `mechanic` (Haiku).
   Kod delegasyonunda sözleşme-spec + kabul vakaları ver, pseudo-code verme. Belirsizlik → `BELIRSIZ: [soru]`.
   İkinci başarısız Sonnet denemesinden sonra Opus subagent fix'i kendisi yazar (3. deneme yok). Tek otorite: `.vibecode/standards/delegation.md`.

---

## Quick Reference

```
New project?          →  clone → rm -rf .git README.md → claude → /vibe-go
Existing project?     →  /vibe-go [task]
Searching code?       →  Serena (preferred) or Grep
3rd party library?    →  Context7 or official docs
Backend code?         →  .vibecode/standards/backend.md
Frontend code?        →  .vibecode/standards/frontend.md
Tests?                →  .vibecode/standards/testing.md
Done with task?       →  /vibe-done
Context bloating?     →  /vibe-compact
Session state?        →  /vibe-status
Delegating?           →  .vibecode/standards/delegation.md
```
