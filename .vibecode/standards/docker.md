# Docker & Environment Standards

> **When to read:** Before any Docker, infrastructure, or environment variable changes.
> **Core principle:** Everything runs inside Docker containers. Nothing is installed on
> the host machine. The host is only used to run `docker compose` and `make` commands.

---

## 1. Standard Services Template

```yaml
services:
  backend:
    build: ./backend
    env_file: .env
    extra_hosts:
      - "host.docker.internal:host-gateway"    # MANDATORY on all services
    volumes:
      - ./backend:/app              # Live reload in dev
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build: ./frontend
    env_file: .env
    extra_hosts:
      - "host.docker.internal:host-gateway"    # MANDATORY on all services
    volumes:
      - ./frontend:/app             # Live reload in dev
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    env_file: .env
    extra_hosts:
      - "host.docker.internal:host-gateway"    # MANDATORY on all services
    volumes:
      - ./data/postgres:/var/lib/postgresql/data   # Persisted on host
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgres-test:
    image: postgres:16-alpine
    extra_hosts:
      - "host.docker.internal:host-gateway"    # MANDATORY on all services
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
    tmpfs:
      - /var/lib/postgresql/data    # RAM-backed — no persistence, maximum speed
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user -d test_db"]
      interval: 5s
      timeout: 3s
      retries: 5
    # Internal network only — not exposed to host

  tome:
    image: ghcr.io/vxcozy/tome:latest
    extra_hosts:
      - "host.docker.internal:host-gateway"    # MANDATORY on all services
    volumes:
      - ./docs:/docs:ro             # Read-only live mount
    ports:
      - "[TOME_PORT]:4000"          # Port assigned from ports file

  # redis / elasticsearch / mongodb — add only after architecture plan approval

  # === Mobile (React Native / Expo) — add when architecture plan includes mobile ===
  # expo:
  #   build: ./mobile
  #   env_file: .env
  #   extra_hosts:
  #     - "host.docker.internal:host-gateway"
  #   volumes:
  #     - ./mobile:/app
  #   ports:
  #     - "[EXPO_PORT]:8081"             # Expo dev server
  #   healthcheck:
  #     test: ["CMD", "curl", "-f", "http://localhost:8081"]
  #     interval: 30s
  #     timeout: 10s
  #     retries: 3
```

> **Scaffold integration:** Use `/scaffold` command to generate this template
> with port placeholders automatically filled from your ports file.

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
      - "5678:5678"                 # debugpy remote debugger
    command: >
      python -m debugpy --listen 0.0.0.0:5678
      -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    environment:
      - VITE_DEV_TOOLS=true
    command: npm run dev -- --host 0.0.0.0

  postgres:
    ports:
      - "54321:5432"                # Expose DB to host for GUI tools (DBeaver etc.)

  # Add dev-only services
  mailhog:
    image: mailhog/mailhog
    ports:
      - "8025:8025"                 # Email testing UI
      - "1025:1025"                 # SMTP
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

```makefile
.PHONY: verify test lint format audit up down build logs

# === Primary Commands ===

verify: lint test audit  ## Run full verification: lint + test + security audit
	@echo "✅ All checks passed"

up:                      ## Start all services
	docker compose up -d

down:                    ## Stop all services
	docker compose down

build:                   ## Rebuild all containers
	docker compose build

logs:                    ## Tail all service logs
	docker compose logs -f

# === Backend ===

lint:                    ## Run linting and formatting check
	docker compose exec backend ruff check src/
	docker compose exec backend ruff format --check src/
	docker compose exec frontend npx eslint src/
	docker compose exec frontend npx prettier --check src/

format:                  ## Auto-format all code
	docker compose exec backend ruff format src/
	docker compose exec backend ruff check --fix src/
	docker compose exec frontend npx prettier --write src/

test:                    ## Run all tests
	docker compose exec backend pytest tests/ -v --tb=short
	docker compose exec frontend npm test -- --run

audit:                   ## Run security audits
	docker compose exec backend pip-audit
	docker compose exec frontend npm audit

migrate:                 ## Run database migrations
	docker compose exec backend alembic upgrade head

generate-types:          ## Generate frontend API types from OpenAPI schema
	docker compose exec frontend npm run generate-types

# === Shortcuts ===

test-backend:            ## Run backend tests only
	docker compose exec backend pytest tests/ -v --tb=short

test-frontend:           ## Run frontend tests only
	docker compose exec frontend npm test -- --run

shell-backend:           ## Open a shell in backend container
	docker compose exec backend bash

shell-frontend:          ## Open a shell in frontend container
	docker compose exec frontend sh
```

**Rules:**
- Claude MUST run `make verify` after writing code, before reporting task completion
- If `make verify` fails → fix → rerun → do NOT skip
- Add new targets as services grow

---

## 8. Dockerfile Standards — Non-Root User (MANDATORY)

All Dockerfiles MUST run as a non-root user.

**Backend Dockerfile pattern:**
```dockerfile
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
    && chown -R appuser:appuser /app
USER appuser

CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend Dockerfile pattern:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

USER node

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

**Rules:**
- Never use `USER root` in final stage
- Always create/use a non-root user before `CMD`
- `./data/` directory permissions: ensure the container user can write to mounted volumes
- Dev override can temporarily use root for debugging — never in main Dockerfile
