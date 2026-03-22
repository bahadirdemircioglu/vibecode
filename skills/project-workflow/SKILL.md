---
name: project-workflow
description: "Project-specific build, test, and deploy workflow for FastAPI + React + Docker projects. Use when running make commands, managing Docker services, or deploying."
---

# Project Workflow Skill

## Purpose

Defines the standard build, test, and deploy workflow for projects using the
FastAPI + React + Docker stack. All commands run inside Docker containers.

---

## Core Commands

| Command                | What it does                                      |
|------------------------|---------------------------------------------------|
| `make verify`          | Lint + test + security audit (all-in-one)          |
| `make test`            | Run all tests (backend + frontend)                 |
| `make test-backend`    | Run backend tests only                             |
| `make test-frontend`   | Run frontend tests only                            |
| `make lint`            | Run all linters (ruff, eslint, prettier)           |
| `make format`          | Auto-format all code (ruff, prettier)              |
| `make audit`           | Security audit (pip-audit, npm audit)              |
| `make migrate`         | Run Alembic database migrations                    |
| `make generate-types`  | Regenerate frontend API types from OpenAPI schema  |
| `make up`              | Start all Docker services                          |
| `make down`            | Stop all Docker services                           |
| `make build`           | Rebuild all Docker containers                      |
| `make logs`            | Tail all service logs                              |
| `make shell-backend`   | Open a shell in the backend container              |
| `make shell-frontend`  | Open a shell in the frontend container             |

---

## Test Database

- **Always use:** `postgres-test` service (tmpfs/RAM-backed, no persistence)
- **Never use:** dev `postgres` service for tests
- **Connection:** `TEST_DATABASE_URL` env var points to postgres-test
- **Behavior:** Data resets on every container restart — tests are isolated
- **Config:** `postgres-test` is internal-only (no host port exposed)

---

## Package Management

### Backend: uv (mandatory)

- **Never use:** pip, poetry, pipenv
- **Adding dependencies:** Edit `pyproject.toml`, then `docker compose build backend`
- **Lock file:** `uv.lock` MUST be committed
- **Dockerfile:** Copy `pyproject.toml` + `uv.lock` before `uv sync --frozen`

### Frontend: npm (mandatory)

- **Adding dependencies:** Edit `package.json`, then `docker compose build frontend`
- **Lock file:** `package-lock.json` MUST be committed
- **Dockerfile:** Copy `package.json` + `package-lock.json` before `npm ci`

---

## Port Management

- **Never invent port numbers** — always read from the ports file
- **Port blocks:** Each project gets a 10-port block (e.g., 5100-5109)
- **Assignment:** At session start, read ports file, confirm assignment with user
- **Standard slots within a block:**
  - +0: Backend API
  - +1: Frontend dev server
  - +2: PostgreSQL (if exposed)
  - +3: Tome documentation server
  - +4 to +9: Available for additional services

---

## Type Generation

After any API change (new endpoint, changed schema, modified response):

1. Run `make generate-types`
2. Verify `frontend/src/types/api.generated.ts` is updated
3. Commit the regenerated file
4. **Never** manually edit `api.generated.ts`

---

## Docker-First Principle

- Everything runs inside Docker containers
- Nothing is installed on the host machine
- The host only runs `docker compose` and `make` commands
- Commands execute via `docker compose exec <service> <command>` or Makefile targets
- `docker-compose.override.yml` is gitignored — used for per-developer overrides

---

## Lock Files

| File                  | Location   | Must commit? |
|-----------------------|------------|-------------|
| `uv.lock`             | `backend/` | Yes          |
| `package-lock.json`   | `frontend/`| Yes          |

- Lock files ensure reproducible builds
- Never manually edit lock files
- When dependencies change, verify lock file updates and commit both files

---

## Dockerfile Rules

Every Dockerfile MUST include:

1. **Non-root USER** — never run as root in final stage
2. **Lock file copy before install** — for Docker layer caching
3. **`extra_hosts: host.docker.internal:host-gateway`** — in docker-compose.yml for every service
4. **Healthcheck** — defined in docker-compose.yml for every service

---

## Adding a New Service

Adding a new data service (Redis, Elasticsearch, MongoDB, etc.) requires:

1. Architecture plan approval FIRST (write plan, wait for user OK)
2. Add service to `docker-compose.yml` with:
   - `extra_hosts: host.docker.internal:host-gateway`
   - Healthcheck
   - Volume mount under `./data/[service-name]/`
3. Assign port from project's port block
4. Update `.env.example` with new connection variables
5. Document in `docs/setup/environment.md`
6. Update CHANGELOG
