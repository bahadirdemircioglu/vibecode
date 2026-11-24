# vibecode — core rules (injected by the vibecode plugin at session start)

**Framework root:** `{{VIBECODE_ROOT}}`
Paths written as `.vibecode/standards/…`, `.vibecode/skills/…`, `.vibecode/templates/…`, `.vibecode/scripts/…`,
`.vibecode/prompts/…`, `.vibecode/rules/…`, `.vibecode/config/…` in vibecode commands, standards and skills live under
the framework root. A same-named file in THIS project overrides it (project wins). Project data stays in the project:
`HANDOFF.md`, `docs/`, `.vibecode/memory/`, `.vibecode/state/`, `.vibecode/sdd/`, `.vibecode/providers.env`, `.serena/`.

## Standards — read the relevant one before writing code in that area

`backend.md` · `frontend.md` · `testing.md` · `docker.md` · `architecture.md` (new feature / architecture) ·
`delegation.md` (model routing) · `git.md` · `documentation.md` · `ports.md` · `security.md` · `backup.md`
— all in `{{VIBECODE_ROOT}}/.vibecode/standards/`. Project-specific decisions: `docs/constraints/*.md`.
Architecture plans index: `docs/architecture/INDEX.md` (single authority — don't list the directory).

## Commands

`/vibe-go [task]` start (loads HANDOFF + matching skills) · `/vibe-plan` architecture plan, waits for approval ·
`/vibe-sdd` spec-driven delivery of an approved plan · `/vibe-fleet` parallel role subagents ·
`/vibe-collab-debug` · `/vibe-security-review` · `/vibe-doc-sync` · `/vibe-done` verify + docs + HANDOFF + commit
proposal · `/vibe-compact` · `/vibe-status` · `/vibecode:init` set up / migrate this project.

## Core rules

1. Read the relevant standard before writing code in that area.
2. Verify library APIs from docs (Context7 or official) — don't guess.
3. Write tests for every new feature or change.
4. Run `make verify` (or the project's equivalent) before reporting a task complete — fix failures, don't skip.
5. Update `docs/CHANGELOG.md` after every change.
6. Serena first when active: `get_symbols_overview` → `find_symbol(include_body=False)` → bodies only as needed.
   Whole-file Read only for config/doc files or files Serena does not cover. If Serena/Context7 are unavailable,
   fall back to Grep/Read and official docs — never block on MCP setup.
7. Max 3 files per step — use subagents for larger changes.
8. New feature or architecture change → write a plan and wait for approval.
9. Model routing, Sonnet-first: default Sonnet; planning on Opus (`/vibe-plan` → Opus subagent); mechanical work →
   `mechanic` (Haiku). Delegate code with a contract spec + acceptance cases, not pseudo-code. Ambiguity →
   `BELIRSIZ: [question]`. After a second failed Sonnet attempt an Opus subagent writes the fix itself.
   If an `advisor` tool is available, consult it before a big plan, when the same error recurs, and before marking a
   long task done. Single authority: `delegation.md`.

## Skills

Lazy: do NOT read skill files at task start — list matching skills by name (`{{VIBECODE_ROOT}}/.vibecode/skills/`,
plus this project's `.vibecode/skills/` if present). Load a SKILL.md only when working in that area, preferably
inside the subagent that needs it. If a skill defines a template, use it; if it defines an anti-pattern, avoid it.

## Project memory

Claude auto memory lives in the repo: `.vibecode/memory/` (set via `autoMemoryDirectory` in
`.claude/settings.local.json`), Serena memories in `.serena/memories/`. Commit memory changes with the work
(`/vibe-done`, `/vibe-compact`). **Never write secrets** into memory — it enters git history.
