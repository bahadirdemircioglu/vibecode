---
name: phase-gate
description: "Validate project readiness between development phases. Use when transitioning from planning to implementation, or before deployment."
---

# Phase Gate Skill

## Purpose

Define and enforce readiness criteria between development phases for web
projects. Each gate validates that required artifacts, tests, and documentation
exist before the project advances.

---

## Phases

### Phase 1: Planning

**Entry:** New project or major feature request received.

**Required Artifacts:**
- [ ] Architecture plan written and approved (`docs/architecture/*.md`)
- [ ] Project constraints defined (`docs/constraints/*.md`)
- [ ] Port range assigned and confirmed (`docs/standards/ports.md`)
- [ ] Tech stack decisions documented in `docs/decisions.md`
- [ ] Initial CHANGELOG.md entry created
- [ ] .env.example created with all known variables

**Gate Verdict:**
- PASS: All artifacts exist and are approved
- CONCERNS: Artifacts exist but have `[TBD]` or placeholder content
- FAIL: Missing architecture plan or constraints

---

### Phase 2: Backend

**Entry:** Planning gate passed.

**Required Artifacts:**
- [ ] SQLAlchemy models defined (`backend/src/models/`)
- [ ] Alembic migrations created and applied (`backend/alembic/versions/`)
- [ ] API endpoints implemented (`backend/src/api/v1/`)
- [ ] Services layer with business logic (`backend/src/services/`)
- [ ] Pydantic v2 schemas for all endpoints (`backend/src/schemas/`)
- [ ] Tests for all endpoints and services (`backend/tests/`)
- [ ] `make test-backend` passes

**Gate Verdict:**
- PASS: All models have migrations, all endpoints have tests, tests pass
- CONCERNS: Tests pass but coverage is incomplete (missing error case tests)
- FAIL: Missing migrations, missing tests, or tests failing

---

### Phase 3: Frontend

**Entry:** Backend gate passed.

**Required Artifacts:**
- [ ] API types generated from backend schema (`make generate-types`)
- [ ] Page components created (`frontend/src/pages/`)
- [ ] Reusable UI components (`frontend/src/components/`)
- [ ] API integration via TanStack Query hooks (`frontend/src/api/`)
- [ ] State management where needed (`frontend/src/store/`)
- [ ] Component tests (`*.test.tsx`)
- [ ] `make test-frontend` passes

**Gate Verdict:**
- PASS: All pages exist, API integration complete, tests pass
- CONCERNS: Tests pass but some components lack test coverage
- FAIL: api.generated.ts is stale, tests failing, or pages missing

---

### Phase 4: Integration

**Entry:** Frontend gate passed.

**Required Artifacts:**
- [ ] End-to-end flow works (user can complete primary use case)
- [ ] `make verify` passes (lint + test + audit)
- [ ] API types are freshly generated (`make generate-types`)
- [ ] Error handling works end-to-end (API errors surface in UI)
- [ ] No console errors or warnings in frontend
- [ ] CORS configured correctly for all environments
- [ ] All environment variables documented in `.env.example`

**Gate Verdict:**
- PASS: Full flow works, make verify passes, types current
- CONCERNS: Flow works but edge cases untested
- FAIL: make verify fails, types stale, or primary flow broken

---

### Phase 5: Deployment

**Entry:** Integration gate passed.

**Required Artifacts:**
- [ ] Dockerfiles use non-root USER directive
- [ ] All Docker services have healthchecks
- [ ] All Docker services have `extra_hosts: host.docker.internal:host-gateway`
- [ ] Security audit passes (no hardcoded secrets, proper auth)
- [ ] Rate limiting configured
- [ ] CHANGELOG.md complete and current
- [ ] docs/progress.md updated to reflect completed features
- [ ] User-facing documentation updated (Tome docs)
- [ ] `docs/setup/environment.md` lists all env vars with descriptions
- [ ] Lock files committed (`uv.lock`, `package-lock.json`)

**Gate Verdict:**
- PASS: All security, Docker, and docs requirements met
- CONCERNS: Docs exist but incomplete; security audit has warnings (not errors)
- FAIL: Missing healthchecks, non-root user, or security vulnerabilities found

---

## How to Run a Gate Check

```
1. Identify which phase the project is currently in
2. Read the required artifacts list for the NEXT phase gate
3. Check each item:
   - Artifact exists? Check the file path.
   - Tests pass? Run the appropriate make target.
   - Docs updated? Read the relevant doc files.
4. Produce verdict: PASS / CONCERNS / FAIL
5. If FAIL: list every failing item with remediation steps
6. If CONCERNS: list concerns but allow proceeding with acknowledgment
7. If PASS: confirm and proceed to next phase
```

---

## Output Format

```
## Phase Gate: [Phase Name] -> [Next Phase Name]

### Verdict: PASS / CONCERNS / FAIL

### Checks
- [x] Architecture plan approved
- [x] Constraints defined
- [ ] Port range assigned          <-- FAIL: no entry in ports file
- [x] Tech stack documented

### Blocking Issues (if FAIL)
1. No port range assigned — run /go to trigger port assignment

### Concerns (if CONCERNS)
1. constraints/auth.md has placeholder content — fill before backend phase

### Recommendation
[Proceed / Fix N issues before proceeding / Major rework needed]
```

---

## Anti-patterns

```
NEVER skip a gate check when the user asks to move to the next phase.
  -> Gates exist to catch problems early. Skipping creates compounding debt.

NEVER pass a gate with failing tests.
  -> Tests must pass. No exceptions.

NEVER treat CONCERNS as FAIL.
  -> CONCERNS means "proceed with awareness." Only FAIL blocks progress.

NEVER run gate checks without actually executing the test commands.
  -> Checking file existence is not enough. Tests must actually run and pass.
```
