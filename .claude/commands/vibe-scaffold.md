---
description: "Initialize a new project from the vibecode template"
---

## Project: $ARGUMENTS

Set up a new project using the vibecode template structure.

### 1. Gather Info
If not provided in `$ARGUMENTS`, ask the user for:
- **Project name** (kebab-case, e.g., `my-app`)
- **Project path** (where to create it)

### 2. Create Directory Structure
At the target path, create:
```
backend/src/api/v1/
backend/src/services/
backend/src/models/
backend/src/schemas/
backend/src/core/
backend/tests/
backend/alembic/
frontend/src/components/
frontend/src/pages/
frontend/src/hooks/
frontend/src/store/
frontend/src/api/
frontend/src/types/
frontend/src/utils/
.vibecode/standards/
docs/constraints/
docs/architecture/
docs/setup/
docs/user/
docs/admin/
docs/api/
data/
.vibecode/skills/
.claude/commands/
```

### 3. Copy Template Files
From vibecode, copy:
- All `.vibecode/standards/*.md` files
- `CLAUDE.md` (substitute project name)
- `.vibecode/templates/.gitignore` → `.gitignore`
- `.vibecode/templates/.env.example` → `.env.example`
- `.vibecode/templates/Makefile` → `Makefile`
- `.vibecode/templates/docker-compose.yml` → `docker-compose.yml`

### 4. Port Assignment
- Ask user for their ports file path
- Read the file, find the next available 10-port block
- Propose range to user, WAIT for approval
- Substitute port placeholders in `docker-compose.yml` and `.env.example`

### 5. Create Initial Docs
- `docs/CHANGELOG.md` — first entry: "Project scaffolded"
- `docs/VERSION` — `0.1.0`
- `docs/progress.md` — empty template
- `docs/decisions.md` — empty template
- `HANDOFF.md` — initial state noting project was just scaffolded

### 6. Confirm
Report:
```
Project scaffolded at [path].
  Ports: [range]
  Structure: [count] directories created
  Templates: [count] files copied

Run /vibe-go to begin development.
```
