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
> `.vibecode/standards/` and are loaded on demand — never read upfront.

---

## Standards Index — Load Before Writing Code

| Before doing...            | Read this file first                          |
|---------------------------|-----------------------------------------------|
| Any backend code           | `.vibecode/standards/backend.md`              |
| Any frontend code          | `.vibecode/standards/frontend.md`             |
| Any tests                  | `.vibecode/standards/testing.md`              |
| Docker / infra changes     | `.vibecode/standards/docker.md`               |
| Architecture / new feature | `.vibecode/standards/architecture.md`         |
| Git commits / branching    | `.vibecode/standards/git.md`                  |
| Documentation updates      | `.vibecode/standards/documentation.md`        |
| Port assignments           | `.vibecode/standards/ports.md`                |
| Security / auth work       | `.vibecode/standards/security.md`             |
| Backup / data management   | `.vibecode/standards/backup.md`               |
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
  → MCP health (Serena + Context7) — if unavailable, install and configure automatically
  → Scan ~/.claude/skills/ + .vibecode/skills/ → load matching skills
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
  └── ❌ → Install and configure Serena MCP automatically → retry
```

**Context7 startup:**
```
Test Context7 availability
  ├── ✅ → "Context7 ready"
  └── ❌ → Install and configure Context7 MCP automatically → retry
```

**Never skip MCP setup. Never ask user. Install, configure, and continue.**
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
├── .vibecode/                      # Template infrastructure — gitignored
│   ├── standards/                  # Coding standards (from vibecode template)
│   │   ├── architecture.md
│   │   ├── backend.md
│   │   ├── frontend.md
│   │   ├── testing.md
│   │   ├── docker.md
│   │   ├── git.md
│   │   ├── documentation.md
│   │   ├── ports.md
│   │   ├── security.md
│   │   └── backup.md
│   └── skills/                     # AI skills (from vibecode template)
│       ├── self-check/
│       ├── handoff-protocol/
│       ├── project-workflow/
│       ├── mobile/
│       ├── incremental-writing/
│       ├── gap-detection/
│       ├── phase-gate/
│       ├── scope-check/
│       └── reverse-doc/
│
├── .claude/                        # Claude Code config — committed
│   ├── commands/                   # Slash commands (/go, /done, /compact...)
│   ├── hooks/                      # Lifecycle hooks
│   ├── rules/                      # Path-scoped coding rules
│   └── settings.json               # Hook registrations, permissions
│
├── docs/                           # Project documentation — committed
│   ├── architecture/               # Pre-coding approval plans + specs
│   ├── constraints/                # Project-specific constraints
│   ├── setup/
│   │   └── environment.md
│   ├── user/                       # End-user docs (Tome)
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
├── HANDOFF.md                      # Session state — written by /done, read by /go
├── .serena/memories/               # Serena project memory (when Serena MCP active)
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
Read HANDOFF.md → load previous session state
        │
        ▼
Scan ~/.claude/skills/ + .vibecode/skills/ → matching skills?
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
  ├── Yes → Context7 first → then read relevant .vibecode/standards/ file
  └── No  → read relevant .vibecode/standards/ file as needed
        │
        ▼
Affects 5+ files?
  ├── Yes → use subagent to investigate → get summary → plan
  └── No  → max 3 files per step
        │
        ▼
New project or major feature?
  ├── Yes → read .vibecode/standards/architecture.md → write plan → WAIT for user OK
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
Run Documentation Checklist (.vibecode/standards/documentation.md)
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
2. Scan project .vibecode/skills/      → project-specific skill overrides
      │
      ▼
3. Match skills to task
   → Load ALL matching skill files
   → Hangisi daha spesifik/kaliteli ise o kullanılır
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
| `/plan [feature]` | Read `.vibecode/standards/architecture.md` → write plan → wait for approval |
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
3. Run Documentation Checklist (.vibecode/standards/documentation.md)
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
- **Load standards on demand** — do not read `.vibecode/standards/` files unless the task requires them
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

These 6 rules are **non-negotiable**. Everything else is in `.vibecode/skills/self-check/SKILL.md`.

```
1. 📖 Load the relevant standard BEFORE writing code
   → backend/ code? Read .vibecode/standards/backend.md first
   → frontend/ code? Read .vibecode/standards/frontend.md first

2. 🔍 Verify library APIs from Context7 or official docs
   → Never write third-party library calls from memory

3. 🧪 Write tests for every new feature or change
   → No feature is delivered without tests
   → Test first (TDD) when possible

4. ✅ Run make verify BEFORE reporting task completion
   → If it fails → fix → rerun → do NOT skip

5. 📝 Update CHANGELOG.md after EVERY change
   → No exceptions — not even "small" changes

6. 🚫 Never proceed past a CHECKPOINT without confirming it passed
   → Silence is not compliance
```

> **Full prohibited actions list:** See `.vibecode/skills/self-check/SKILL.md` for the
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
Port assignment?      →  .vibecode/standards/ports.md
Searching code?       →  Serena (never grep)
3rd party library?    →  Context7 first + check ~/.claude/skills/
Backend code?         →  .vibecode/standards/backend.md + matching skills
Frontend code?        →  .vibecode/standards/frontend.md + matching skills
Writing tests?        →  .vibecode/standards/testing.md
Docker / infra?       →  .vibecode/standards/docker.md
Security / auth?      →  .vibecode/standards/security.md
Git / commits?        →  .vibecode/standards/git.md
API changed?          →  run generate-types → commit api.generated.ts
Done with task?       →  /done (make verify + docs + HANDOFF.md)
Context bloating?     →  /compact (CHANGELOG + HANDOFF.md first)
Session state?        →  /status
Project constraints?  →  docs/constraints/*.md
Skills?               →  ~/.claude/skills/ (user) + .vibecode/skills/ (project)
Self-check?           →  .vibecode/skills/self-check/SKILL.md
Verification?         →  make verify (lint + test + audit)
```
