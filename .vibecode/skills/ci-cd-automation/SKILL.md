---
name: ci-cd-automation
description: "CI/CD pipeline setup with GitHub Actions: quality gates, testing, deployment automation. Use when setting up or maintaining CI/CD pipelines."
---

## Overview

CI/CD pipeline design and maintenance. Quality gates that cannot be skipped, concrete GitHub Actions templates, and CI optimization strategies.

## When to Use

- Setting up a new project's CI/CD pipeline
- Adding quality gates to an existing pipeline
- Optimizing slow CI builds
- Configuring branch protection and PR checks

## Quality Gate Pipeline (Order Matters)

```
lint → type-check → unit-tests → build → integration-tests → e2e → security-audit → bundle-size
```

No gate can be skipped. If a gate fails, later gates don't run.

## GitHub Actions Templates

### Basic CI (Python + Node)

```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install uv && uv sync
      - run: ruff check .
      - run: ruff format --check .
      - run: pytest --cov -q
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage
```

### With Database (Integration Tests)

```yaml
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install uv && uv sync
      - run: pytest tests/integration/ -q
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
```

### Security Audit

```yaml
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install pip-audit && pip-audit
      - run: npm audit --audit-level=high
```

## Environment Management

- `.env.example` committed (template with placeholder values)
- `.env` NEVER committed (in .gitignore)
- CI secrets in GitHub Settings → Secrets and variables
- Use `env:` in workflow steps, not hardcoded values

## Branch Protection

- Require PR reviews (minimum 1)
- Require status checks to pass before merge
- Require branches to be up to date
- No force-push to main/master

## CI Optimization (Priority Order)

1. **Cache dependencies** — `actions/cache` for pip, npm, docker layers
2. **Parallelize jobs** — backend/frontend/security run simultaneously
3. **Path filters** — Only run backend CI when backend/ changes
4. **Test sharding** — Split large test suites across workers
5. **Larger runners** — Last resort, costs money

## CI Failure Feedback Loop

When CI fails:

1. Read the failure log
2. Identify the failing gate (lint? test? build?)
3. Fix locally, verify with `make verify`
4. Push fix — do NOT skip the gate

## Anti-patterns

- Skipping gates with `[skip ci]` to merge faster
- Running all tests on every file change (use path filters)
- Secrets in workflow files
- No caching (slow CI = developers skip it)
- Manual deployment steps in CI (automate everything)
