# Security, Auth & Monitoring Standards

> **When to read:** Before any security, auth, CORS, rate limiting, or logging work.

---

## 1. CORS Configuration

```python
# backend/src/core/config.py — CORS settings
CORS_ORIGINS: list[str]  # Explicit allowed origins — never use ["*"] in production
CORS_METHODS: list[str] = ["GET", "POST", "PUT", "DELETE", "PATCH"]
CORS_HEADERS: list[str] = ["Authorization", "Content-Type"]
```

**Rules:**
- Dev: Allow `localhost` origins only
- Production: Explicit domain whitelist — no wildcards
- Document all CORS settings in `docs/setup/environment.md`

---

## 2. Rate Limiting

Apply rate limiting to all public-facing endpoints:

```python
# Suggested defaults — adjust per project
AUTH_ENDPOINTS: 5 requests/minute       # login, register, password reset
API_ENDPOINTS: 60 requests/minute       # general API calls
UPLOAD_ENDPOINTS: 10 requests/minute    # file uploads
```

- Use Redis-backed rate limiting when Redis is available
- Use in-memory rate limiting for simple projects
- Return `429 Too Many Requests` with RFC 7807 format
- Include `Retry-After` header in 429 responses

---

## 3. Authentication & Authorization

- JWT tokens with short expiry (15 min access, 7 day refresh)
- Admin endpoints: use a `require_admin` dependency
- Never store plaintext passwords — bcrypt only (not passlib)
- Never log tokens, passwords, or sensitive headers
- If an external AI gateway or proxy is used → document its URL pattern and
  required headers in `docs/setup/environment.md`

---

## 4. Structured Logging — MANDATORY

All backend services MUST use structured JSON logging:

```python
import structlog

logger = structlog.get_logger()

# ✅ Correct — structured with context
logger.info("user_created", user_id=user.id, email=user.email)
logger.error("payment_failed", order_id=order.id, error=str(e))

# ❌ Wrong — unstructured string interpolation
logger.info(f"User {user.id} created")
print("Something happened")
```

**Rules:**
- Use `structlog` for all backend logging
- Every log entry must include: timestamp, level, event name, relevant IDs
- Never log passwords, tokens, API keys, or full request bodies with sensitive data
- Log levels: `debug` (dev only), `info` (normal operations), `warning` (recoverable), `error` (failures), `critical` (system down)

---

## 5. Health Check Endpoints

Every backend service MUST expose:

```
GET /health          → 200 OK if service is running
GET /health/ready    → 200 OK if service + all dependencies are ready
```

- `/health` — lightweight, no dependency checks
- `/health/ready` — checks DB connection, Redis connection, external service availability
- Used by Docker healthcheck and future load balancers

---

## 6. Request Logging

Log every API request with:
- Method, path, status code, duration (ms)
- User ID (if authenticated)
- Request ID (generated per request, passed in `X-Request-ID` header)
- Do NOT log request/response bodies (privacy + size concerns)

---

## 7. Framework Hardening (agent hooks, provider secrets)

Not app security — how vibecode protects the agent itself (permission/net-fs hooks) and the
`/vibe-plan` provider key: see `docs/guides/framework-security.md`.
