---
paths: ["backend/src/services/**"]
---

# Backend Services

- Services contain **all business logic** -- no HTTP concerns (no Request, no Response, no status codes)
- Accept **typed parameters**, not Request objects
- Raise **domain exceptions**, not `HTTPException` -- let the API layer translate to HTTP
- All service methods are `async def`
- Use **structlog** for logging -- structured key-value pairs, never f-string interpolation
- Services receive dependencies (db session, current user) as parameters, not via global state
- Keep methods focused: one responsibility per method
