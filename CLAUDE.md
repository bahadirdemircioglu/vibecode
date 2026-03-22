# CLAUDE.md

> **Scope:** Governs Claude's behavior across all projects in this workspace.
> Applies to Claude Code (terminal / IDE plugin) and future IDE integrations.
> All rules are mandatory unless marked `[OPTIONAL]`.
>
> **Enforcement:** Every rule in this file and referenced standards is a hard constraint.
> Claude MUST NOT proceed to the next step until the current step is verified.
> If a step fails or is skipped, Claude MUST stop and inform the user.
> Silence is not compliance — every checkpoint requires explicit confirmation.
>
> **Architecture:** This file is the entry point. All detailed rules live in
> `docs/standards/` and are loaded on demand — never read upfront.

---

## Standards Index — Load Before Writing Code

| Before doing...            | Read this file first                          |
|---------------------------|-----------------------------------------------|
| Any backend code           | `docs/standards/backend.md`                   |
| Any frontend code          | `docs/standards/frontend.md`                  |
| Any tests                  | `docs/standards/testing.md`                   |
| Docker / infra changes     | `docs/standards/docker.md`                    |
| Architecture / new feature | `docs/standards/architecture.md`              |
| Git commits / branching    | `docs/standards/git.md`                       |
| Documentation updates      | `docs/standards/documentation.md`             |
| Port assignments           | `docs/standards/ports.md`                     |
| Security / auth work       | `docs/standards/security.md`                  |
| Backup / data management   | `docs/standards/backup.md`                    |
| Project-specific decisions | `docs/constraints/*.md`                       |

---

## 1. Session Startup — Three Gates

> **ENFORCEMENT:** Claude MUST NOT write any code until all 3 gates pass.
> Use `/go [task]` for the full startup sequence. Below is the summary.

```
Gate 1: Load State
  → HANDOFF.md exists? Read it → summarize previous session
  → No HANDOFF.md? → "Fresh session — no prior state"

Gate 2: Check Tools & Context
  → MCP health (Serena + Context7)
  → Scan ~/.claude/skills/ + project skills/ → load matching skills
  → Read ports file → confirm port assignments
  → Read docs/constraints/*.md

Gate 3: Confirm Scope
  → "✅ Ready: [task] | Skills: [list] | State: [summary]"
```

---

## 2. MCP Rules — MANDATORY

| Task | Tool |
|------|------|
| Find symbol / route / class in project code | **Serena** — never `grep` / `find` |
| Dependency and impact analysis before editing | **Serena** |
| FastAPI, SQLAlchemy, Alembic, React, TypeScript, TanStack Query, Zustand, shadcn/ui, Pydantic v2, Tome | **Context7** — never from memory |

**Serena startup:**
```
Call mcp__serena__initial_instructions
  ├── ✅ → "Serena ready"
  └── ❌ → warn user → fallback to find → note in CHANGELOG as "⚠ Degraded session"
```

**Context7 fallback:** If unreachable → `web_fetch` the official library docs URL.
Never write guessed API calls. Never rely on memory for library APIs.

> **ENFORCEMENT:** If Claude writes a third-party library call without first
> consulting Context7 or official docs, that code is INVALID and must be rewritten.

**Future MCPs** `[OPTIONAL — add when needed]`

| MCP | Add when... |
|-----|-------------|
| GitHub MCP | CI/CD pipeline is introduced |
| Brave Search / Tavily | Research-heavy tasks arise |
| Playwright MCP | E2E testing is needed |

---

## 3. Project Structure

```
project-root/
├── backend/                        # FastAPI application
│   ├── src/
│   │   ├── api/v1/                 # Route handlers — thin, delegate to services
│   │   ├── services/               # Business logic
│   │   ├── models/                 # SQLAlchemy models
│   │   ├── schemas/                # Pydantic v2 schemas
│   │   └── core/                   # Config, DB, security, exceptions, dependencies
│   ├── tests/                      # Mirrors src/ structure exactly
│   ├── alembic/                    # Database migrations
│   ├── Dockerfile
│   └── pyproject.toml
│
├── frontend/                       # React + TypeScript application
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   ├── pages/                  # Route-level page components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── store/                  # Zustand stores
│   │   ├── api/                    # TanStack Query hooks + API client
│   │   ├── types/
│   │   │   └── api.generated.ts    # AUTO-GENERATED — never edit manually
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
│
├── docs/
│   ├── architecture/               # Pre-coding approval plans
│   ├── standards/                  # Detailed coding & process standards
│   │   ├── architecture.md         # Architecture planning, DB selection
│   │   ├── backend.md              # Python/FastAPI coding standards
│   │   ├── frontend.md             # React/TypeScript coding standards
│   │   ├── testing.md              # Test rules, pytest-asyncio, coverage
│   │   ├── docker.md               # Docker, Makefile, Dockerfile, env vars
│   │   ├── git.md                  # Versioning, branching, commit format
│   │   ├── documentation.md        # CHANGELOG, ADR, progress, Tome docs
│   │   ├── ports.md                # Port management workflow & format
│   │   ├── security.md             # CORS, rate limiting, auth, logging
│   │   └── backup.md               # Database & file backup strategy
│   ├── constraints/                # Project-specific constraints
│   │   ├── infrastructure.md
│   │   ├── backend.md
│   │   ├── api.md
│   │   ├── frontend.md
│   │   ├── auth.md
│   │   ├── database.md
│   │   └── external-services.md
│   ├── setup/
│   │   └── environment.md          # All env variables documented here
│   ├── user/                       # End-user docs (served via Tome)
│   ├── admin/                      # Administrator docs
│   ├── api/                        # API reference
│   ├── CHANGELOG.md                # Updated after every task — mandatory
│   ├── decisions.md                # Architecture Decision Records
│   ├── progress.md                 # Feature/module tracker
│   └── VERSION                     # Semantic version — plain text
│
├── data/                           # Docker volume mount point — never committed
│   ├── postgres/
│   ├── uploads/
│   └── [service]/
│
├── .serena/memories/               # Serena project memory
├── skills/                         # Project-specific Claude skill definitions
├── docker-compose.yml
├── docker-compose.override.yml     # Local dev overrides — gitignored
├── Makefile                        # All dev commands — single entry point
├── .env.example                    # Always committed, always current
├── .env                            # Never committed
└── CLAUDE.md                       # This file — index only
```

---

## 4. Task Decision Tree

```
New task received
        │
        ▼
Read .serena/memories/ → load project state
        │
        ▼
Scan ~/.claude/skills/ + project skills/ → matching skills?
  ├── Yes → read + apply all matching (project overrides user)
  └── No  → continue with general standards
        │
        ▼
Touches existing code?
  ├── Yes → Serena dependency analysis first
  └── No  → continue
        │
        ▼
Uses a third-party library?
  ├── Yes → Context7 first → then read relevant docs/standards/ file
  └── No  → read relevant docs/standards/ file as needed
        │
        ▼
Affects 5+ files?
  ├── Yes → use subagent to investigate → get summary → plan
  └── No  → max 3 files per step
        │
        ▼
New project or major feature?
  ├── Yes → read docs/standards/architecture.md → write plan → WAIT for user OK
  └── No  → continue
        │
        ▼
Write / update tests first
        │
        ▼
Run make verify → all must pass (lint + test + audit)
  └── ❌ Fix failures → rerun → do NOT skip
        │
        ▼
Run Documentation Checklist (docs/standards/documentation.md)
  ← ALWAYS, no exceptions
        │
        ▼
✅ CHECKPOINT: "Task complete. Docs updated: [list]"
```

---

## 5. Skills System — MANDATORY

> **ENFORCEMENT:** Claude MUST scan for matching skills before starting ANY task.
> Skipping skill check = invalid session.

### 5.1 Skill Sources (Priority Order)

```
Task received
      │
      ▼
1. Scan ~/.claude/skills/              → user-level technology skills
   Contains per-technology skill files:
   ├── fastapi.md
   ├── sqlalchemy.md
   ├── react.md
   ├── typescript.md
   ├── tailwindcss.md
   ├── tanstack-query.md
   ├── zustand.md
   ├── pydantic.md
   └── [technology].md
      │
      ▼
2. Scan project skills/                → project-specific skill overrides
      │
      ▼
3. Match skills to task
   → Load ALL matching skill files
   → Apply in order: user skill → project skill (project overrides user)
      │
      ▼
✅ CHECKPOINT: "Skills loaded: [fastapi.md, react.md, ...]"
   or: "No matching skills found — proceeding with general standards"
```

### 5.2 Skill File Convention

```markdown
# [Technology] Skill

## Version
[Target version of the technology]

## Rules
[Mandatory patterns, naming conventions, do's and don'ts]

## Templates
[Code templates and boilerplate for common patterns]

## Anti-patterns
[What to avoid — Claude MUST NOT generate these patterns]
```

### 5.3 Priority Resolution

```
Conflict detected between sources?
  │
  ├── Hangisi daha spesifik/kaliteli ise o kullanılır
  ├── Teknoloji skill'leri projede kullanılan stack'e göre otomatik devreye girer
  ├── Both override general CLAUDE.md rules
  └── Log override in CHANGELOG: "Skill override: [what] from [which skill]"
```

### 5.4 Skill Usage Rules

- Claude MUST read skill files at the START of a task, not mid-task
- If a skill defines a template → use the template
- If a skill defines an anti-pattern → Claude MUST NOT generate that pattern
- When Claude uses a skill → mention it: "Using [technology].md skill for this"
- If no skill exists for a technology in use → note this to the user as a suggestion

---

## 6. Slash Commands

| Command | Action |
|---------|--------|
| `/go [task]` | Load HANDOFF.md → MCP health → skills → ports → constraints → begin task |
| `/done` | `make verify` → Documentation Checklist → HANDOFF.md → propose commit |
| `/plan [feature]` | Read `docs/standards/architecture.md` → write plan → wait for approval |
| `/compact` | Update CHANGELOG + HANDOFF.md first → then compact context |
| `/scaffold [name]` | Initialize new project from vibecode template |
| `/status` | Show session state: loaded skills, context estimate, MCP health |

---

## 7. /done Command

When `/done` is called, execute in order:

```
1. Summarize all changes made in this session
2. Run make verify:
     make verify   (lint + test + security audit — all in one)
   → If any step fails → fix → rerun → do NOT skip
3. Run Documentation Checklist (docs/standards/documentation.md)
4. Update docs/CHANGELOG.md
5. Update docs/decisions.md      (if applicable)
6. Update docs/progress.md       (if applicable)
7. Update docs/VERSION           (if version changed)
8. Update Tome docs              (if user-facing change)
9. Write/update HANDOFF.md        (session state for next session — see handoff-protocol skill)
10. Propose git commit message    (Conventional Commits format)
11. Remind: "Run /compact if context is large before the next session"
```

---

## 8. Token Economy & Context Budget

- **Max 3 files** edited per step — more requires step-by-step progression
- **Load standards on demand** — do not read `docs/standards/` files unless the task requires them
- **Load skills at task start** — read matching skill files once, not repeatedly
- **Subagent triggers** — say `use subagent to investigate X` when:
  - Debugging spans multiple services
  - Dependency tree affects 5+ files
  - Security audit or performance profiling needed
- **Context hygiene:**
  - Switching to unrelated task → `/clear`
  - Context growing large → `/compact` — update CHANGELOG + HANDOFF.md **before** compacting
  - Ask Serena before opening files — unnecessary reads are the biggest token waste

### Context Budget Thresholds

```
0–60K tokens   → Normal operation
60K–80K tokens → ⚠ Warning: consider /compact soon
80K+ tokens    → 🔴 Mandatory: run /compact before continuing
```

Quality degrades significantly beyond 80K tokens. The `/compact` command
saves state to HANDOFF.md before compacting, ensuring no context is lost.

---

## 9. Five Absolute Rules

These 5 rules are **non-negotiable**. Everything else is in `skills/self-check/SKILL.md`.

```
1. 📖 Load the relevant standard BEFORE writing code
   → backend/ code? Read docs/standards/backend.md first
   → frontend/ code? Read docs/standards/frontend.md first

2. 🔍 Verify library APIs from Context7 or official docs
   → Never write third-party library calls from memory

3. ✅ Run make verify BEFORE reporting task completion
   → If it fails → fix → rerun → do NOT skip

4. 📝 Update CHANGELOG.md after EVERY change
   → No exceptions — not even "small" changes

5. 🚫 Never proceed past a CHECKPOINT without confirming it passed
   → Silence is not compliance
```

> **Full prohibited actions list:** See `skills/self-check/SKILL.md` for the
> complete 30-item checklist. Run it after every code change.

---

## 10. Verification Watermark

After completing substantive code changes, append a brief status line:

```
[Standards: backend.md | Skills: fastapi-pro | Verified: lint-pass, test-pass]
```

This makes rule-following visible and auditable. Omit for non-code responses.

---

## 11. Quick Reference

```
New project?          →  /scaffold → /plan → /go
Existing project?     →  /go [task]
Port assignment?      →  docs/standards/ports.md
Searching code?       →  Serena (never grep)
3rd party library?    →  Context7 first + check ~/.claude/skills/
Backend code?         →  docs/standards/backend.md + matching skills
Frontend code?        →  docs/standards/frontend.md + matching skills
Writing tests?        →  docs/standards/testing.md
Docker / infra?       →  docs/standards/docker.md
Security / auth?      →  docs/standards/security.md
Git / commits?        →  docs/standards/git.md
API changed?          →  run generate-types → commit api.generated.ts
Done with task?       →  /done (make verify + docs + HANDOFF.md)
Context bloating?     →  /compact (CHANGELOG + HANDOFF.md first)
Session state?        →  /status
Project constraints?  →  docs/constraints/*.md
Skills?               →  ~/.claude/skills/ (user) + skills/ (project)
Self-check?           →  skills/self-check/SKILL.md
Verification?         →  make verify (lint + test + audit)
```
