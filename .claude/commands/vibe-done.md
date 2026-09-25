---
description: "Complete a task: verify, document, create handoff state, propose commit. `--full` adds doc-sync drift scan."
---

Execute these steps in order. Do NOT skip any step. Fix failures before proceeding.
`$ARGUMENTS` içinde `--full` varsa Step 4b da çalışır (opt-in; ağır adım).

### 1. Summarize Changes
List all files created, modified, or deleted in this session with a brief description of each change.

### 2. Run Verification
```bash
make verify
```
- This runs lint + test + security audit
- If ANY step fails: fix the issue, rerun, do NOT skip
- Checkpoint: "make verify passed"

### 3. Security Review (delegated)
1. Changed source files: `git diff --name-only HEAD` filtered to source code only (no docs/config-only changes).
   None → "Security review: skipped — no source changes" → Step 4.
2. Otherwise dispatch the `reviewer` subagent (do NOT load the skill into the main context):
   > Security review only. Files: [list]. Load `.vibecode/skills/security-review/SKILL.md` and run its
   > OWASP Top 10 checklist on the diff of these files. Return ONLY findings
   > (severity · `file:line` · issue · 1-3 line patch), or "no findings".
3. Findings → ask: "Security issues found. Apply patches? (all / pick / skip)". None → "Security review passed".
- Checkpoint: "Security review completed"

### 4. Documentation Checklist
Run inline (do NOT Read `documentation.md` — CHANGELOG entry format: `.vibecode/standards/documentation.md §2`, ADR format: §3; open only the section you need):
1. `docs/CHANGELOG.md` — ALWAYS add one entry at the top (the only CHANGELOG step in this command)
2. Architectural decision made? → `docs/decisions.md` (ADR format)
3. New feature/service/module? → `docs/progress.md`
4. Version changed? → `docs/VERSION`
5. User-facing behavior changed? → `docs/user/`
6. Admin settings changed? → `docs/admin/`
7. Env variables added/changed? → `docs/setup/environment.md` + `.env.example`
8. API endpoints changed? → `docs/api/` + run `generate-types`
9. Project constraint changed? → relevant `docs/constraints/*.md`

Checkpoint: "Documentation updated: [list of files]"

### 4b. Doc-Sync Drift Scan (only with `--full`)
Run `/vibe-doc-sync` (shadow mode, fast tier). Proposals → ask "Apply N proposed doc updates? (y / pick / n)";
on approval re-run with `--live`. If its security linter blocks: report `blocked` items, do NOT bypass.
Without `--full`: one line — "Doc-sync skipped (run `/vibe-done --full` or `/vibe-doc-sync` for a drift scan)".

### 5. Write HANDOFF.md
Fill `.vibecode/templates/HANDOFF.md` (copy the template; every section, `N/A` where not applicable)
into `HANDOFF.md` at the project root. If `## Goal` is active: append one dated journal line; if all
acceptance criteria are met, ask the user whether to mark it `completed`.

### 6. Propose Commit Message
Generate a Conventional Commits format message:
```
type(scope): description

body with details
```
The proposed commit includes `HANDOFF.md`, `.vibecode/memory/` and `.serena/memories/` changes (project
memory lives in the repo — see CLAUDE.md → Project Memory). Present to user for approval. Do NOT commit automatically.

### 7. Remind
> Run `/vibe-compact` if context is large before starting the next task.
