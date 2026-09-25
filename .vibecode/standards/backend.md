# Backend Standards

> **When to read:** Before writing ANY backend code.
> **Stack:** FastAPI + SQLAlchemy async + Pydantic v2 + Alembic + Ruff

---

## 1. Core Rules

- **Async everywhere:** All endpoints and services use `async def`
- **Pydantic v2:** All schemas — use `model_validator`, `field_validator`
- **Type hints:** Mandatory on every function including return type
- **SQLAlchemy async:** `async_session_factory`, `select()`, `await session.execute()`
- **Ruff:** Run `ruff check` + `ruff format` before every commit
- **Layers:** `api/v1/` handles HTTP only → delegates to `services/` → uses `models/`
- **Migrations:** Every model change requires an Alembic migration — no exceptions
- **bcrypt:** Use bcrypt directly (not passlib) — passlib has bcrypt>=5.0 incompatibility
- **Logging:** structlog, structured JSON — see `security.md` §4

---

## 2. Standard Error Format — RFC 7807 (MANDATORY)

All API errors must return this structure. No bare strings, no unstructured dicts.

```python
# backend/src/core/schemas/error.py
class ProblemDetail(BaseModel):
    type: str      # URI identifying the error type
    title: str     # Short, human-readable summary (same for all occurrences)
    status: int    # HTTP status code
    detail: str    # Explanation specific to this occurrence
    instance: str  # [OPTIONAL] URI of the request that caused the error
```

```json
{
  "type": "https://api.yourproject.com/errors/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "The requested user with id '42' does not exist."
}
```

Register a global exception handler in `core/exception_handlers.py`.
HTTP status codes in use: `400 / 401 / 403 / 404 / 409 / 422 / 429 / 500`

---

## 3. API Type Synchronization — MANDATORY

**Never write API request/response types manually in the frontend.**

All types are generated from the FastAPI OpenAPI schema.

```bash
docker compose exec frontend npm run generate-types
# Output: frontend/src/types/api.generated.ts
```

**Rules:**
- `src/types/api.generated.ts` is auto-generated — never edit it manually
- `generate-types` must be run and the result committed alongside every API change
- `package.json` must define the `generate-types` script using `openapi-typescript`
