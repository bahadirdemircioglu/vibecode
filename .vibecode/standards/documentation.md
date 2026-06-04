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
    → See .vibecode/skills/handoff-protocol/SKILL.md for format
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

---

## 6. Continuous Doc Maintainer (skill)

Manual checklist (§1) is the floor; the `continuous-doc-maintainer` skill is the
ceiling — automated, auditable, schema-driven sync.

- **Skill:** `.vibecode/skills/continuous-doc-maintainer/SKILL.md`
- **Slash command:** `/vibe-doc-sync [--live] [--tier full] [paths...]`
- **Default:** `mode=shadow, tier=fast` — produces a proposed change set, does not write
- **Audit log:** `docs/CHANGELOG_INTERNAL.md` (append-only, machine-parsable)
- **State (gitignored):** `.vibecode/state/doc-hashes.json` — idempotency hashes
- **Auto-trigger:** `/vibe-done` Step 4 runs the skill in shadow mode and asks before applying

Use the skill when:
- Code change merged → API/UI/config docs may be stale
- Endpoint or feature deleted → prune doc sections + dangling references
- OpenAPI / Pydantic / SQLAlchemy schema changed → regenerate examples

Step 9 of the skill is a **blocking** security linter — secrets/tokens never reach
docs. If it blocks, fix the source (don't bypass the skill).

---

## 7. Skill Manifest Frontmatter Schema (WrongStack-inspired)

> Adapted from WrongStack's `SKILL.md` trigger/scope metadata. Applies to **new** skills.
> The 110+ existing skills are migrated opportunistically (only when otherwise edited) — no
> mass migration. `name` + `description` remain the only hard-required fields.

Every new `.vibecode/skills/<name>/SKILL.md` SHOULD carry this frontmatter:

```yaml
---
name: <kebab-case, matches the directory>
description: >
  One paragraph: WHAT it does and WHEN to use it. This is what the model reads to
  decide relevance during lazy-loading, so lead with the trigger condition.
triggers: [keyword, phrase, /slash-command]   # optional — aids dispatch/recall
scope: <backend | frontend | testing | orchestration | docs | security | meta>  # optional
model: <sonnet | opus | inherit>               # optional — hints which model the skill suits
---
```

**Rules:**
- `name` MUST equal the directory name.
- `description` MUST state the trigger ("Use when…") — vague descriptions break lazy-loading.
- Layered override (unchanged, already in CLAUDE.md): **project skill > user skill > bundled**.
  Discovery walks highest-priority first and skips already-seen names.
- Keep skill bodies action-oriented: Purpose → How to work → Output shape → YAPMA (anti-patterns).
