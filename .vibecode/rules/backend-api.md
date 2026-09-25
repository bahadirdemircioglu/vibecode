---
paths: ["backend/src/api/**"]
---

# Backend API Routes

- Route handlers must be **thin** -- delegate all business logic to `services/`
- All error responses use **RFC 7807 ProblemDetail** format; no bare strings or unstructured dicts
- Every endpoint must have **type hints** on all parameters and return type
- Use `Depends()` for authentication, database sessions, and shared logic
- Never import models directly in route handlers -- use **schemas** for request/response
- All endpoints are `async def`
- Group routes with `APIRouter`, one router per resource
- Return appropriate HTTP status codes: 201 for creation, 204 for deletion
