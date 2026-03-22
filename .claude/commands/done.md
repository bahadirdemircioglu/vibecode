---
description: "Complete a task: verify, document, create handoff state, propose commit"
---

Execute these steps in order. Do NOT skip any step. Fix failures before proceeding.

### 1. Summarize Changes
List all files created, modified, or deleted in this session with a brief description of each change.

### 2. Run Verification
```bash
make verify
```
- This runs lint + test + security audit
- If ANY step fails: fix the issue, rerun, do NOT skip
- Checkpoint: "make verify passed"

### 3. Documentation Checklist
Read `docs/standards/documentation.md` and run the full checklist:
1. Update `docs/CHANGELOG.md` — ALWAYS, no exceptions
2. Architectural decision made? → update `docs/decisions.md` (ADR format)
3. New feature/service/module? → update `docs/progress.md`
4. Version changed? → update `docs/VERSION`
5. User-facing behavior changed? → add/update page in `docs/user/`
6. Admin settings changed? → add/update page in `docs/admin/`
7. Env variables added/changed? → update `docs/setup/environment.md` + `.env.example`
8. API endpoints changed? → update `docs/api/` + run `generate-types`
9. Project constraint changed? → update relevant `docs/constraints/*.md`

Checkpoint: "Documentation updated: [list of files]"

### 4. Update CHANGELOG
Add entry at top of `docs/CHANGELOG.md` using the format from documentation standards.

### 5. Write HANDOFF.md
Create or update `HANDOFF.md` in the project root with:
- **Branch:** current git branch
- **Changes this session:** summary of all changes
- **Tests:** tests added or modified
- **Open questions:** anything unresolved
- **Next steps:** recommended follow-up tasks
- **Active skills:** skills that were loaded this session

### 6. Propose Commit Message
Generate a Conventional Commits format message:
```
type(scope): description

body with details
```
Present to user for approval. Do NOT commit automatically.

### 7. Remind
> Run `/compact` if context is large before starting the next task.
