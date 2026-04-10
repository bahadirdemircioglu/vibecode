# Vibecode - Project Overview

## Purpose
Vibecode is a **Claude Code framework/boilerplate** — a reusable project template that provides:
- Coding standards (`.vibecode/standards/`)
- AI skills library (`.vibecode/skills/` — 110+ skills)
- Slash commands (`/vibe-go`, `/vibe-done`, `/vibe-plan`, `/vibe-compact`, `/vibe-status`, `/vibe-security-review`)
- Lifecycle hooks (session-start, pre-tool-use, notifications)
- Project templates (Makefile, docker-compose, .env.example)
- Architecture decision records (`docs/decisions.md`)

## How It's Used
1. Clone vibecode repo into a new project directory
2. Remove `.git` and `README.md`
3. Run `claude` — Serena and Context7 MCP servers start automatically
4. Use `/vibe-go [task]` to begin work

## Project Structure
```
project-root/
├── .vibecode/
│   ├── standards/     # 10 coding standard files (backend, frontend, testing, docker, etc.)
│   ├── skills/        # 110+ AI skill definitions (SKILL.md each)
│   ├── scripts/       # scaffold.sh, db-backup.sh, db-restore.sh
│   └── templates/     # Makefile, docker-compose.yml, .env.example, etc.
├── .claude/
│   ├── commands/      # Slash command definitions (vibe-go.md, vibe-done.md, etc.)
│   ├── hooks/         # Lifecycle hooks (pre-tool-use.js, session-start.sh, notification.js)
│   ├── rules/         # Path-scoped rules (backend-api.md, frontend-components.md, etc.)
│   └── settings.json  # Permissions and hook configuration
├── .serena/
│   └── project.yml    # Serena MCP configuration
├── docs/
│   ├── constraints/   # 7 constraint files (api, backend, frontend, auth, database, infra, external)
│   ├── architecture/  # Architecture plan documents
│   ├── decisions.md   # ADRs (4 decisions recorded)
│   ├── CHANGELOG.md
│   └── progress.md
├── CLAUDE.md          # Main entry point for Claude behavior
├── HANDOFF.md         # Session state for cross-session continuity
└── .mcp.json          # MCP server configuration (Serena + Context7)
```

## Key Principle
This is NOT an application — it's a **development framework**. It has no backend/ or frontend/ directories of its own. Those are created when the framework is used to build actual projects.

## Language
Primary language for code: Bash (hooks, scripts), JavaScript/Node.js (hooks)
Standards and skills cover: Python (FastAPI), TypeScript (React), SQL, Docker
Documentation language: Turkish + English mixed
