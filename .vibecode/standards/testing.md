# Testing Standards

> **When to read:** Before writing ANY test code.
> **Rule:** No feature is delivered without tests.

---

## 1. Test Database Isolation — CRITICAL

```
Tests MUST NEVER run against the dev database (postgres service).
All test suites connect exclusively via TEST_DATABASE_URL → postgres-test service.
postgres-test uses tmpfs (RAM-backed): fast, isolated, zero persistent state.
```

`conftest.py` is responsible for (enforced, not optional):
1. Running `alembic upgrade head` on `postgres-test` at session start
2. Tearing down the schema after the session ends
3. Wrapping each test in a transaction — rolled back after the test completes

---

## 2. Async Test Configuration — MANDATORY

All backend tests use `pytest-asyncio` since the entire backend is async.

**`pyproject.toml` configuration:**
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"    # All async tests detected automatically — no manual markers needed
```

**Rules:**
- `asyncio_mode = "auto"` — never use `"strict"`
- All test fixtures that touch the database MUST be `async`
- Use `httpx.AsyncClient` for API endpoint testing (not `requests` or sync `TestClient`)
- Async fixtures use `@pytest_asyncio.fixture` — not `@pytest.fixture`

**Example pattern:**
```python
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

@pytest_asyncio.fixture
async def client(async_session):
    """Async test client with DB session override."""
    from src.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

async def test_create_user(client):
    """No marker needed — asyncio_mode=auto handles it."""
    response = await client.post("/api/v1/users", json={"email": "test@example.com"})
    assert response.status_code == 201
```

---

## 3. Test File Mapping

Mirror the source structure exactly:

```
backend/src/services/user_service.py  →  backend/tests/services/test_user_service.py
backend/src/api/v1/users.py           →  backend/tests/api/v1/test_users.py
frontend/src/components/UserCard.tsx  →  frontend/src/components/UserCard.test.tsx
```

---

## 4. Minimum Coverage per Module

- Happy path — normal expected usage
- Edge cases — empty input, boundary values, None / undefined
- Error scenarios — expected exceptions raised, correct error responses returned
- API endpoints — at least 1 success + 1 failure test per route

---

## 5. Security Audit — Run with Every Test Cycle

```bash
docker compose exec backend pip-audit
docker compose exec frontend npm audit
```

Include a summary in CHANGELOG when vulnerabilities are found.

---

## 6. Pass Criteria

- New feature PR: 100% of related tests pass
- Existing tests must not break
- New code coverage target: ≥ 80%
