# Tech Stack

## Framework (Vibecode itself)
- **Hooks:** Node.js (JavaScript)
- **Scripts:** Bash
- **Configuration:** JSON (settings, MCP), YAML (Serena, Docker), Markdown (standards, skills, commands)
- **MCP Servers:** Serena (code navigation), Context7 (library docs)

## Target Project Stack (what vibecode sets up)
- **Backend:** Python + FastAPI
  - ORM: SQLAlchemy (async)
  - Migrations: Alembic
  - Validation: Pydantic v2
  - Linting: Ruff
  - Testing: Pytest
  - Security: pip-audit
- **Frontend:** TypeScript + React
  - State: Zustand + TanStack Query
  - UI: shadcn/ui + Tailwind CSS
  - Linting: ESLint + Prettier
  - Testing: Vitest
  - Security: npm audit
- **Database:** PostgreSQL (default)
- **Infrastructure:** Docker Compose
- **API:** REST with OpenAPI schema + auto-generated TypeScript types

## MCP Tools Available
- **Serena:** Symbol search, referencing symbols, code overview, semantic editing, memories, modes
- **Context7:** Library documentation lookup (FastAPI, React, SQLAlchemy, etc.)

## Key Design Decisions (from ADRs)
- ADR-001: Structured error memory in `.vibecode/memories/errors/`
- ADR-002: Skill Orchestrator for automatic skill suggestions (via pre-tool-use hook)
- ADR-003: Hybrid doc-sync (tracking + batch update)
- ADR-004: Security review skill with `/vibe-security-review` command
