---
paths: ["backend/tests/**", "frontend/src/**/*.test.*", "frontend/src/**/*.spec.*"]
---

# Testing Rules

- Backend tests use **postgres-test** (tmpfs); NEVER the dev postgres service
- Backend: `pytest-asyncio` with async fixtures and `httpx.AsyncClient`
- Frontend: **Vitest + React Testing Library** -- test user behavior, not implementation details
- Every test file **mirrors** the source file it tests in directory structure
- Minimum coverage per function/endpoint: **happy path + error case**
- Frontend: query by **role, label, text** -- never by class name or test ID unless no alternative
- Frontend: use **MSW** for API mocking, never mock `fetch` directly
- No silent catches in tests -- assert expected errors explicitly
