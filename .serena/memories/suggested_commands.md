# Suggested Commands

## Vibecode Slash Commands
- `/vibe-go [task]` — Start a task: load state, check tools, scan skills, confirm scope
- `/vibe-done` — Complete task: verify, update docs, write HANDOFF.md, propose commit
- `/vibe-plan [feature]` — Create architecture plan, wait for approval before coding
- `/vibe-compact` — Save state to HANDOFF.md, then compact context
- `/vibe-status` — Show session state and MCP health
- `/vibe-security-review [file]` — OWASP Top 10 security review

## Make Commands (for projects built with vibecode)
- `make verify` — Full verification: lint + test + security audit
- `make up` — Start all Docker services
- `make down` — Stop all Docker services
- `make build` — Rebuild all containers
- `make logs` — Tail all service logs
- `make lint` — Run linters (ruff for Python, eslint/prettier for TS)
- `make format` — Auto-format all code
- `make test` — Run all tests (pytest + vitest)
- `make test-backend` — Backend tests only
- `make test-frontend` — Frontend tests only
- `make audit` — Security audit (pip-audit + npm audit)
- `make migrate` — Run database migrations (alembic)
- `make generate-types` — Generate frontend API types from OpenAPI

## Git Commands
- `git status` / `git diff` / `git log` — All pre-allowed in settings
- `git add` / `git commit` / `git push` — Allowed via settings.local.json

## System (Darwin/macOS)
- `ls`, `find`, `wc` — Pre-allowed
- Shell: zsh
- Package managers: uvx (Python), npx (Node.js)
