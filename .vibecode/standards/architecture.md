# Architecture Planning Standards

> **When to read:** Before starting any new project or major feature.
> **Rule:** No code is written until the architecture document is approved by the user.

---

## 1. Planning Workflow — MANDATORY BEFORE CODING

> **ENFORCEMENT:** Claude MUST NOT create any source file, Dockerfile, or config
> before explicit user "OK" on the architecture plan.

```
New project or major feature
        │
        ▼
Create docs/architecture/[name]-plan.md using the template below (§1.1)
        │
        ▼
Present plan → WAIT for explicit "OK" from user
  └── ❌ User says "change X" → revise plan → present again → WAIT
  └── ✅ User says "OK" → proceed to implementation
        │
        ▼
Only then: begin implementation
```

Planning runs on **Opus** (`/vibe-plan` → `Agent(subagent_type: "general-purpose", model: "opus")`);
routing and delegation rules live in `.vibecode/standards/delegation.md`.

### 1.1 Plan Template (tek şablon — `/vibe-plan`, `/vibe-sdd` ve `architect` bunu kullanır)

Skip sections that are N/A (write "N/A" only for Data Storage / Security / Monitoring if truly irrelevant).

```markdown
# Architecture Plan: [name]

## Overview & Goals
[What this feature does and why it's needed]

## Directory Structure Changes
[New directories, files to create or modify]

## Tech Decisions
[Libraries, patterns, approaches — with rationale for each]

## Data Storage Decisions
[Which store and why (§2) — PostgreSQL default; alternatives need a stated reason]

## Database Schema
[New tables, columns, relationships, indexes]

## API Contract
[New endpoints: method, path, request/response shapes]

## Docker Services & Ports
[New containers, volumes, networks + port assignments from the user's ports file
 (workflow: `.vibecode/standards/ports.md` §1 — never invent ports)]

## Security Considerations
[Auth, CORS, rate limiting, input validation — see security.md]

## Monitoring & Logging
[What is logged / measured and where — see security.md §4]

## Migration Plan
[Steps to implement without breaking existing functionality]

## Open Questions
[Decisions that need user input before proceeding]
```

---

## 2. Database Selection Rule

Default is **PostgreSQL**. Claude proposes an alternative only when there is a clear
technical reason, stated in the architecture plan. User must approve before any new
service is added to `docker-compose.yml`.

| Signal | Proposal |
|--------|----------|
| Full-text search, log aggregation, analytics at scale | Elasticsearch |
| Key-value cache, session store, rate limiting | Redis |
| Flexible document store, rapid schema iteration | MongoDB |
| Time-series metrics or sensor data | TimescaleDB (PostgreSQL extension) |
| High concurrency (100+ simultaneous connections) | PgBouncer or SQLAlchemy pool tuning |
| Everything else | PostgreSQL — no justification needed |

> **Note:** For most dev/small-scale projects, SQLAlchemy's built-in async pool
> (`pool_size`, `max_overflow`) is sufficient. Add PgBouncer only when architecture
> plan identifies high-concurrency requirements. Document pool settings in `.env.example`.

---

## 3. Mobile App Planning

When the architecture includes a mobile application, the plan MUST specify:

| Decision | Options |
|----------|---------|
| Framework | **React Native** (shared JS/TS skills with frontend) or **Flutter** (better native performance, Dart) |
| Navigation | React Navigation (RN) or Go Router (Flutter) |
| State management | Zustand/TanStack Query (RN, shared with web) or Riverpod (Flutter) |
| API sharing | Shared OpenAPI types with web frontend (RN advantage) |
| Dev server | Expo dev server (RN) with port from ports file |

**Default recommendation:** React Native when the web frontend already uses React + TypeScript
(shared code, shared types, shared skills). Flutter only when native performance is critical
or the team has existing Flutter expertise.

---

## 4. Delegation & Model Routing

Moved to `.vibecode/standards/delegation.md` (single source of truth: model routing,
contract-spec protocol, 2-attempt rule, escalation). Plans only name the executor per step
(`engineer` / `mechanic` / `opus`) and give each code step a contract spec per that standard.
