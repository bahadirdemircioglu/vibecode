# Docker & Environment Standards

> **When to read:** Before any Docker, infrastructure, or environment variable changes.
> **Core principle:** Everything runs inside Docker containers. Nothing is installed on
> the host machine. The host is only used to run `docker compose` and `make` commands.

---

## 1. Standard Services Template

**Source of truth:** `.vibecode/templates/docker-compose.yml` — copy it to the project root.
Do not duplicate or hand-write the base compose file; change the template instead.

**Rules** (the template satisfies all of them — keep it that way):
- Base services: `backend`, `frontend`, `postgres`, `postgres-test`, `tome`.
  `redis` / `elasticsearch` / others only after architecture-plan approval.
- `extra_hosts: "host.docker.internal:host-gateway"` on **every** service.
- **Healthcheck on every service**, using a tool that exists in the image —
  `python:3.12-slim` and `node:20-alpine` have **no `curl`**:
  backend → `python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"`,
  frontend → `wget -qO- http://localhost:3000` (busybox), postgres → `pg_isready`.
- Published ports bind to **`127.0.0.1`** (`"127.0.0.1:${BACKEND_PORT}:8000"`), never `0.0.0.0`.
- **`postgres` is not published** in the base file — host access (GUI tools) goes in the override (§2).
  `postgres-test` is never published and uses `tmpfs`.
- Frontend (Vite) listens on **3000** in the container (`--port 3000` in the frontend Dockerfile
  template); mapping and healthcheck use 3000 too.
- Port numbers come from the ports file via `.env` (`.vibecode/templates/.env.example`).

---

## 2. Docker Compose Override — Local Dev Customization

`docker-compose.override.yml` is for developer-specific overrides that should NOT be committed.

**Rules:**
- `docker-compose.override.yml` MUST be in `.gitignore`
- It is auto-loaded by `docker compose` — no `-f` flag needed
- Use for: custom port mappings, debug tools, extra volumes, resource limits
- NEVER put production secrets or shared config here

**Example `docker-compose.override.yml`:**
```yaml
# docker-compose.override.yml — gitignored, per-developer overrides
services:
  backend:
    environment:
      - DEBUG=true
      - LOG_LEVEL=debug
    ports:
      - "127.0.0.1:5678:5678"       # debugpy remote debugger
    command: >
      python -m debugpy --listen 0.0.0.0:5678
      -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    environment:
      - VITE_DEV_TOOLS=true
    command: npm run dev -- --host 0.0.0.0

  postgres:
    ports:
      - "127.0.0.1:54321:5432"      # Expose DB to host for GUI tools (DBeaver etc.)

  # Add dev-only services
  mailhog:
    image: mailhog/mailhog
    ports:
      - "127.0.0.1:8025:8025"       # Email testing UI
      - "127.0.0.1:1025:1025"       # SMTP
```

**When to use override vs. main compose:**

| Setting | `docker-compose.yml` | `docker-compose.override.yml` |
|---------|---------------------|------------------------------|
| Service definitions | ✅ | ❌ |
| Port assignments from ports file | ✅ | ❌ |
| Debug ports (debugpy, etc.) | ❌ | ✅ |
| Exposing DB to host for GUI tools | ❌ | ✅ |
| Dev-only services (mailhog, etc.) | ❌ | ✅ |
| Resource limits for local machine | ❌ | ✅ |
| Custom environment overrides | ❌ | ✅ |
| `extra_hosts` declaration | ✅ | ❌ |
| Health checks | ✅ | ❌ |

---

## 3. Volume & Data Rules

- All persistent data lives under `./data/` inside the project directory
- `./data/` is in `.gitignore` — contents are never committed
- `postgres-test` uses `tmpfs` — RAM-backed, resets on every restart, no disk I/O
- When adding a new data service → create `./data/[service-name]/` and mount it

---

## 4. Environment Variables

```
.env.example   → always committed — placeholder values + inline comment per variable
.env           → never committed — real secrets
```

Required variables every project must define:

```bash
# Primary dev database
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/dbname

# Test database — always postgres-test, never postgres
TEST_DATABASE_URL=postgresql+asyncpg://test_user:test_password@postgres-test:5432/test_db
```

When adding a new variable:
1. Add to `.env.example` with placeholder and comment
2. Add to `.env` with real value
3. Document in `docs/setup/environment.md`
4. Update CHANGELOG with note about new env var

---

## 5. Allowed Commands

```bash
# ✅ Preferred — use Makefile targets
make verify              # lint + test + audit — single command
make test                # all tests
make lint                # all linters
make format              # auto-format all code
make audit               # security audit
make migrate             # run Alembic migrations
make generate-types      # regenerate frontend API types

# ✅ Also correct — direct Docker commands when Makefile target doesn't exist
docker compose exec backend pytest tests/ -v --tb=short
docker compose exec backend alembic upgrade head
docker compose exec frontend npm run build

# ❌ Wrong — never on host
pip install ... / npm install ... / python ... / pytest ... / uv sync ...
```

---

## 6. Package Management & Adding Dependencies

**Backend — `uv` (mandatory):**

`uv` is the standard Python package manager for all projects. Never use `pip`, `poetry`,
or `pipenv` directly.

```bash
# Adding a dependency — always edit pyproject.toml, then rebuild
docker compose build backend
```

**Frontend — `npm` (mandatory):**

```bash
# Adding a dependency — always edit package.json, then rebuild
docker compose build frontend
```

**Lock file rules — CRITICAL:**
- `uv.lock` (backend) and `package-lock.json` (frontend) MUST be committed
- Lock files ensure reproducible builds — without them, every build may pull different versions
- Dockerfile MUST copy lock file before installing dependencies (for Docker layer caching):

```dockerfile
# ✅ Correct — lock file copied first for cache efficiency
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# ❌ Wrong — no lock file, non-reproducible
COPY pyproject.toml ./
RUN uv sync
```

- When a dependency is added/updated → verify lock file is updated → commit both files
- Never manually edit lock files

---

## 7. Makefile — Single Entry Point for Dev Commands

Every project MUST include a `Makefile` at the root.

**Source of truth:** `.vibecode/templates/Makefile` — copy it to the project root. `make verify`
= `lint` (ruff check + format check, eslint, prettier, `tsc --noEmit`) + `test` + `audit`.
Every target runs through `docker compose exec` — never on the host.

**Rules:**
- Claude MUST run `make verify` after writing code, before reporting task completion
- If `make verify` fails → fix → rerun → do NOT skip
- Add new targets as services grow

---

## 8. Dockerfile Standards — Non-Root User (MANDATORY)

All Dockerfiles MUST run as a non-root user.

**Templates (source of truth):** `.vibecode/templates/backend.Dockerfile` → `backend/Dockerfile`,
`.vibecode/templates/frontend.Dockerfile` → `frontend/Dockerfile`. Both copy the lock file before
installing (§6), end with a non-root `USER`, and the frontend runs Vite with `--port 3000`.

**Rules:**
- Never use `USER root` in final stage
- Always create/use a non-root user before `CMD`
- `./data/` directory permissions: ensure the container user can write to mounted volumes
- Dev override can temporarily use root for debugging — never in main Dockerfile
