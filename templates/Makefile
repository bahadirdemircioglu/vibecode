.PHONY: verify test lint format audit up down build logs

# === Primary Commands ===

verify: lint test audit  ## Run full verification: lint + test + security audit
	@echo "All checks passed"

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
