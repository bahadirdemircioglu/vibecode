# Documentation Standards

> **When to read:** After EVERY change — no exceptions.
> **Rule:** No task, fix, feature, or change of any kind is considered complete
> until ALL applicable documentation is updated.

---

## 1. Documentation Checklist — Run After EVERY Change

> **ENFORCEMENT:** Claude MUST NOT report task completion or propose a commit
> message until this checklist is verified.

```
Change completed
        │
        ▼
1. Update docs/CHANGELOG.md                    ← ALWAYS, no exceptions
        │
        ▼
2. Does this introduce an architectural decision?
   ├── Yes → update docs/decisions.md (ADR format)
   └── No  → continue
        │
        ▼
3. Does this add a new feature, service, or module?
   ├── Yes → update docs/progress.md
   └── No  → continue
        │
        ▼
4. Does this change the version?
   ├── Yes → update docs/VERSION
   └── No  → continue
        │
        ▼
5. Does this affect user-facing behavior?
   ├── Yes → add/update page in docs/user/
   └── No  → continue
        │
        ▼
6. Does this affect admin settings or operations?
   ├── Yes → add/update page in docs/admin/
   └── No  → continue
        │
        ▼
7. Does this add/change environment variables?
   ├── Yes → update docs/setup/environment.md + .env.example
   └── No  → continue
        │
        ▼
8. Does this change API endpoints?
   ├── Yes → update docs/api/ + run generate-types
   └── No  → continue
        │
        ▼
9. Does this change a project constraint?
   ├── Yes → update relevant docs/constraints/*.md
   └── No  → continue
        │
        ▼
10. Update HANDOFF.md with session state
    → See skills/handoff-protocol/SKILL.md for format
    → Include: changes made, tests status, open questions, next steps
        │
        ▼
✅ CHECKPOINT: "Documentation updated: [list of updated files]"
```

---

## 2. CHANGELOG.md Format

Add at the top after every completed task:

```markdown
## [YYYY-MM-DD] v[X.Y.Z] — [task summary, max 60 chars]

### Changes
- **What:** [what changed, 1–2 sentences]
- **Why:** [rationale, what problem it solved]
- **How:** [brief technical approach]

### Affected Files
- `path/to/file.py` — [what changed]

### Notes
- [migration required, new env var, new port assigned — omit section if none]
```

---

## 3. decisions.md — ADR Format

Write an ADR when: new architecture introduced · library added or replaced ·
breaking DB schema change · auth strategy changed · storage backend decision ·
any deviation from CLAUDE.md standards.

```markdown
## ADR-[NNN]: [Title]
**Date:** YYYY-MM-DD | **Status:** Accepted | Revised | Superseded

### Context
### Decision
### Alternatives Considered
### Consequences
```

---

## 4. progress.md Format

Update when a new feature, service, or module is added:

```markdown
## [Feature Name]
**Added:** YYYY-MM-DD | **Version:** vX.Y.Z
**Status:** 🟡 In Progress | 🟢 Done | 🔴 Blocked

### Scope
### Dependencies
### Open Tasks
```

---

## 5. Tome Docs (`docs/user/`, `docs/admin/`, `docs/setup/`)

- Every new user-facing feature → page in `docs/user/`
- Every admin setting → entry in `docs/admin/`
- Every new env variable → entry in `docs/setup/environment.md`
- Tome container auto-reloads on file change (live-mounted volume)
- Write plain Markdown — no custom shortcodes unless confirmed Tome supports them
