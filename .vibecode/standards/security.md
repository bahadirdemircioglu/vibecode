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

## 7. Agent Permission & Net/FS Hardening (WrongStack-inspired)

> **When to read:** Before changing `.claude/settings.json` permissions or the security hooks.
> These layers protect the *agent itself* (the tools Claude runs), not the app it builds.

Adapted from WrongStack's `permission-policy.ts`, `fetch.ts`, `replace.ts`, `_env.ts`. Two
defensive layers sit in front of every tool call:

### 7.1 Static deny-list (`settings.json` → `permissions.deny`)
First line of defense — glob patterns the harness blocks before the tool runs. Covers the
known-bad shapes (`rm -rf`, force push, `git clean -fd`, `sudo`, `chmod 777`, `dd if=`, `mkfs`,
`.env` reads/writes, raw `node`/`python`/installs). Add a new glob here when you find a class of
command that should never run.

### 7.2 Risk-tier policy hook (`.claude/hooks/permission-policy.js`)
Second layer — a `PreToolUse` hook that extracts the **subjectKey** (Bash→`command`,
Write/Edit→`file_path`, WebFetch→`url`) and classifies it:

| Tier | Action | Examples |
|------|--------|----------|
| **destructive** | **hard block** (exit 2, fail-closed) | `rm -rf`, force push, `git reset --hard`, fork bomb, `curl\|bash`, overwrite `.env` |
| **standard** | advisory warning (allow) | plain `git push`, `docker compose down -v`, `npm publish`, `DROP TABLE` |

Escape hatch: `VIBE_YOLO=1` downgrades destructive blocks to warnings — **sandboxed/disposable
environments only**.

### 7.3 Net/FS guard hook (`.claude/hooks/net-fs-guard.js`)
Second layer for network and filesystem reach:
- **SSRF:** `WebFetch` to a private/loopback/link-local target (incl. cloud metadata
  `169.254.169.254`, `localhost`, `*.internal`) is blocked; non-`http(s)` schemes too. Escape
  hatch: `VIBE_ALLOW_PRIVATE_FETCH=1` for local-API testing.
- **System-path containment:** `Write`/`Edit` into `/etc`, `/usr`, `/bin`, `/boot`, `/sys`,
  `/proc`, `/dev`, `/root/.ssh`, … is blocked. Project, `/tmp`, and `~/.claude` writes stay allowed
  (so memory writes work).
- **Symlink escape:** writing *through* a symlink whose real target leaves the workspace is blocked.

### 7.4 Rules
- Hooks are **fail-closed**: a destructive/SSRF match blocks the tool (exit code 2).
- Never weaken a hook to get past a legitimate block — do the action manually or use the documented
  env escape hatch for that one session.
- Both hooks are pure Node, no dependencies, and exit 0 on any parse error (never break the session).
- Test changes with piped JSON before committing (see the guide in `docs/guides/`).

---

## 8. External AI Consultation — Secret Hygiene (`/vibe-plan` Step 1.5)

> **When to read:** Before touching `.vibecode/config/ai-providers.json`,
> `.vibecode/scripts/consult-provider.sh`, the framework provider secret, or `/vibe-plan` Step 1.5.

`/vibe-plan` can optionally send a draft plan to an external provider (v1: DeepSeek) for a critique
round (see ADR-007, `docs/architecture/multi-ai-plan-consultation-plan.md`). Unlike §7's hooks, this
step is **fail-open** by design — it is a quality bonus, not a security gate, so any error or missing
config silently falls back to the normal single-model flow.

### 8.1 Secret storage
- **Provider registry** (`.vibecode/config/ai-providers.json`) is **non-secret** and git-tracked. It
  holds only *which* provider/model/endpoint and the **name** of the env var to read
  (`api_key_env`) — never a key value. The schema has no field to hold a key, so a key can't be
  committed here by accident.
- **The key itself is NEVER the project's own `.env`.** vibecode is usually layered inside another
  project, whose root `.env` belongs to *that app*; the framework must not mix its provider key into
  it (nor risk it being committed with the app). The key resolution order is:
  1. `$DEEPSEEK_API_KEY` (or the configured `api_key_env`) **already exported** in your shell rc.
  2. `$VIBECODE_ENV_FILE` — explicit path override.
  3. `.vibecode/providers.env` — project-local override, **gitignored** (root `.gitignore`). Use only
     when you are sure that path is gitignored *in the host project*.
  4. `~/.config/vibecode/providers.env` — **machine-global, recommended**: outside every repo, set
     once, reused across all projects, impossible to commit.
  Only `.vibecode/providers.env.example` (placeholder) is tracked.

### 8.2 Key handling rules
- `consult-provider.sh` first checks the env var named by `api_key_env`; if unset it extracts **only
  that one line** from the first secret file found (order above) — **no `source`/`eval`**, so the file
  is never executed. The project's own `.env` is **never** read.
- The key travels **only** in the `curl` `Authorization: Bearer` header. It is **never** printed to
  stdout/stderr, never logged, never interpolated into the plan or the critique.
- `curl -sS` (no verbose/echo); on error the script surfaces HTTP status + provider error *message*,
  **never** request headers.
- **Why this doesn't circumvent the §7.1 `.env` deny-list:** that deny-list stops *Claude's own*
  Read/`cat` tool calls from pulling secrets into the model's context. The script reads its own
  secret file inside a subprocess and emits only the critique text — the key never reaches the model.
  Running the script via Bash (`consult-provider.sh <plan>`) puts no secret path in the command
  string, so the deny-list is neither triggered nor bypassed.

### 8.3 Privacy & opt-in
- **Opt-in = configuring it.** No external call happens unless a maintainer sets
  `enabled: true` **and** provides a key. The shipped default is `enabled: false`.
- **Transparency:** every round prints a one-line notice ("plan DeepSeek'e gönderildi") so plan
  content is never sent to a third party without a visible trace.
- **Escape hatch:** `/vibe-plan <feature> --no-consult` skips consultation for one call (sensitive
  plans) without editing config.
- **Third-party retention:** plan content (architecture, possibly business context) leaves your
  machine. The provider's data-retention/training policy is out of scope (their ToS) — for
  confidential plans, keep `enabled: false` or use `--no-consult`.
- **Timeout is mandatory:** `curl --max-time` (config `timeout_seconds`) so a slow provider never
  blocks `/vibe-plan` indefinitely.
