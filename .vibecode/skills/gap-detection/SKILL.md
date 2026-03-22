---
name: gap-detection
description: "Detect missing documentation, tests, migrations, and other project gaps. Use at session start or when auditing project health."
---

# Gap Detection Skill

## Purpose

Systematically detect missing documentation, tests, migrations, and other
project gaps. Run at session start, before releases, or on-demand to audit
project health.

---

## Gap Checklist

### 1. Test Coverage Gaps (Critical)

- **API routes without test files:** Every route in `backend/src/api/v1/` must
  have a corresponding test in `backend/tests/api/v1/`. List any routes missing
  test coverage.
- **Services without error handling tests:** Every service in
  `backend/src/services/` must have tests that cover error/edge cases, not just
  the happy path.
- **Frontend components without test files:** Every component in
  `frontend/src/components/` and `frontend/src/pages/` should have a
  corresponding `.test.tsx` file.

### 2. Database Gaps (Critical)

- **Models without Alembic migrations:** Every SQLAlchemy model in
  `backend/src/models/` must have a corresponding migration in
  `backend/alembic/versions/`. Compare model fields against the latest
  migration to detect drift.

### 3. Configuration Gaps (Warning)

- **Environment variables in code but not in .env.example:** Scan source files
  for `os.environ`, `os.getenv`, `process.env`, and config references. Every
  variable must appear in `.env.example` with a comment.
- **Docker services without healthchecks:** Every service in
  `docker-compose.yml` must define a `healthcheck` block.

### 4. API Consistency Gaps (Warning)

- **Changed API endpoints without running generate-types:** Compare the
  OpenAPI schema timestamp against `frontend/src/types/api.generated.ts`
  modification time. If the schema is newer, types are stale.

### 5. Documentation Gaps (Warning)

- **docs/constraints/*.md files with placeholder content:** Scan constraint
  files for `[To be defined]`, `[TODO]`, `TBD`, or empty sections.
- **CHANGELOG.md not updated for recent commits:** Compare the last
  CHANGELOG entry date against the last 3 git commits. If commits are newer,
  the CHANGELOG is stale.

### 6. Security Gaps (Info)

- **Bare except / pass patterns:** Scan Python files for `except:` followed
  by `pass` or empty blocks. These silently swallow errors.
- **Hardcoded secrets:** Scan for patterns like `password=`, `secret=`,
  `api_key=` with literal string values in source files.

---

## Output Format

Present findings as a structured report:

```
## Gap Detection Report — [date]

### Critical
- [ ] `backend/src/api/v1/users.py` — no test file found
      Fix: Create `backend/tests/api/v1/test_users.py`
- [ ] `backend/src/models/order.py` — no migration for `discount_code` field
      Fix: Run `make migration msg="add discount_code to orders"`

### Warning
- [ ] `REDIS_URL` used in `backend/src/core/config.py` but missing from `.env.example`
      Fix: Add `REDIS_URL=redis://localhost:6379` to `.env.example`
- [ ] `docker-compose.yml` service `worker` — no healthcheck defined
      Fix: Add healthcheck block to worker service

### Info
- [ ] `backend/src/services/payment.py:42` — bare `except: pass`
      Fix: Add specific exception handling and logging

### Summary
- Critical: 2 gaps
- Warning: 2 gaps
- Info: 1 gap
```

---

## When to Run

| Trigger | Scope |
|---------|-------|
| Session start (`/go`) | Quick scan — critical gaps only |
| Before `/done` | Full scan — all categories |
| Before release / deployment | Full scan + security focus |
| On-demand audit request | Full scan with detailed report |

---

## Anti-patterns

```
NEVER report gaps without a suggested fix.
  -> Every gap must include a concrete remediation step.

NEVER treat Info-level gaps as blockers.
  -> Info items are suggestions. Only Critical gaps block progress.

NEVER skip the test coverage check.
  -> Missing tests are the most common and most dangerous gap.

NEVER scan node_modules/, .next/, dist/, __pycache__/, .git/.
  -> These are excluded from all scans.
```
