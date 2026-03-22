---
name: self-check
description: "Self-verification checklist for rule compliance. Use after completing any code change to verify all rules were followed."
---

# Self-Check Skill

## Purpose

Run this checklist after completing any code change to verify compliance with
all project rules before reporting task completion.

---

## Checklist

### Standards
- [ ] Loaded the relevant standard file (backend.md / frontend.md / etc.) BEFORE writing code
- [ ] Read docs/constraints/*.md for project-specific rules

### Libraries
- [ ] Consulted Context7 or official docs for every third-party API call
- [ ] Did NOT write any library code from memory
- [ ] Checked ~/.claude/skills/ and project .vibecode/skills/ for matching skill files

### Testing
- [ ] Wrote or updated tests for all changes
- [ ] All tests pass (`make test`)
- [ ] Tests use postgres-test (tmpfs), NOT dev postgres

### Docker
- [ ] All commands run inside Docker containers (not on host)
- [ ] No `pip install` / `npm install` / `python` run on host
- [ ] Used Makefile targets where available

### Git
- [ ] Working on a feature branch (NOT main)
- [ ] Within 3-file-per-step limit
- [ ] Lock files (uv.lock, package-lock.json) committed

### Documentation
- [ ] Updated docs/CHANGELOG.md
- [ ] Updated docs/decisions.md (if architecture decision made)
- [ ] Updated docs/progress.md (if feature status changed)
- [ ] Updated docs/VERSION (if version changed)
- [ ] Updated Tome docs (if user-facing change)
- [ ] Updated .serena/memories/ (session context)
- [ ] Ran Documentation Checklist from .vibecode/standards/documentation.md

### Security
- [ ] No bare `except` / `pass` (silent exception swallowing)
- [ ] No secrets hardcoded in source code
- [ ] All error responses use RFC 7807 ProblemDetail format
- [ ] No .env or ./data/ contents committed

### Types
- [ ] Frontend API types auto-generated via `make generate-types` (not manually written)
- [ ] api.generated.ts committed after API changes

### Dockerfile
- [ ] Non-root USER directive present
- [ ] `extra_hosts: host.docker.internal:host-gateway` on every service
- [ ] Healthcheck defined for every service
- [ ] Lock files copied before install step (layer caching)

### Dependencies
- [ ] Backend uses `uv` (not pip/poetry/pipenv)
- [ ] Frontend uses `npm`
- [ ] Lock files are present and committed

### Verification
- [ ] Ran `make verify` (lint + test + audit) — all passed
- [ ] Did NOT skip any failing step

---

## Prohibited Actions Reference

The following actions are strictly forbidden. If any were performed, the task
is invalid and must be corrected.

```
 1. grep/find to search source files — use Serena
 2. Writing third-party library code without Context7 or skill file
 3. Finishing a task without running Documentation Checklist
 4. Finishing a task without updating CHANGELOG.md
 5. Modifying a DB model without an Alembic migration
 6. Editing more than 3 files in a single step
 7. Running complex multi-service investigation in main context — use subagent
 8. Running /compact without updating CHANGELOG + memories first
 9. Reading node_modules/, .next/, dist/, __pycache__/, .git/, *.pyc
10. Delivering a feature without tests
11. Starting a task without checking .vibecode/skills/ first
12. Running pip install / npm install / python on the host machine
13. Committing ./data/ contents or .env file
14. Committing directly to main branch
15. Writing API types manually in frontend — always use generate-types
16. Running tests against the dev postgres service — always use postgres-test
17. Returning unstructured error JSON — always RFC 7807 ProblemDetail
18. Starting to code before architecture plan is approved (new project / major feature)
19. Adding a new data service without architecture plan approval
20. Inventing port numbers — always read the ports file first
21. Using passlib for password hashing — use bcrypt directly
22. Omitting extra_hosts: host.docker.internal:host-gateway from any Docker service
23. Omitting healthcheck from any Docker service definition
24. Skipping documentation for "small" changes — ALL changes require docs
25. Proceeding past a CHECKPOINT without explicit verification
26. Writing code that catches exceptions silently (bare except, pass)
27. Committing without lock files (uv.lock, package-lock.json)
28. Dockerfile without non-root USER directive
29. Skipping make verify before reporting task completion
30. Using pip/poetry/pipenv instead of uv for Python dependency management
31. Running /compact without updating .serena/memories/ first
```
