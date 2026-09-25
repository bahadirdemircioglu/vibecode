# Skill Authoring — Manifest Frontmatter Schema (WrongStack-inspired)

> Moved from `.vibecode/standards/documentation.md §7` so the per-change documentation standard
> stays lean. Read this only when creating or editing a skill.

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
- Layered override (unchanged, already in the vibecode core rules): **project skill > user skill > bundled**.
  Discovery walks highest-priority first and skips already-seen names.
- Keep skill bodies action-oriented: Purpose → How to work → Output shape → YAPMA (anti-patterns).
