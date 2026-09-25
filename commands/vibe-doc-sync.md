---
description: "Run continuous-doc-maintainer skill — sync docs with code changes (default: shadow mode, fast tier)"
---

Execute the `continuous-doc-maintainer` skill against the current change set.

## Argument parsing

Parse `$ARGUMENTS` as space-separated tokens:

| Token | Effect |
|---|---|
| `--live` | `mode = live` (default: `shadow`) |
| `--tier full` | `execution_tier = full` (default: `fast`) |
| `<path>` (any token not starting with `--`) | Add to `changed_files` (limits scope to that file) |
| (none) | All staged + unstaged changes (`git diff --name-only`) — shadow, fast |

## Execution

### 1. Load skill
Read `${CLAUDE_PLUGIN_ROOT}/.vibecode/skills/continuous-doc-maintainer/SKILL.md`.

### 2. Build input payload
- `diff` = `git diff` output (staged + unstaged) OR diff for the specified paths
- `changed_files` = parsed from arguments OR `git diff --name-only`
- `metadata.type` = inferred from file paths (api / ui / config / admin / user)
- `metadata.scope` = inferred from path segments (e.g., `backend/src/api/auth.py` → `auth`)
- `mode` / `execution_tier` = from args
- `existing_docs` = `find docs -name "*.md" -type f`
- `schema_sources` = `["backend/openapi.json", "backend/src/schemas/**/*.py", "backend/src/models/**/*.py"]` (skip non-existent)
- `previous_hashes` = read from `.vibecode/state/doc-hashes.json` (empty `{}` if missing)

### 3. Run the 13 steps
Execute Step 0 → Step 13 from the skill. STOP at Step 9 BLOCK if security violation detected.

### 4. Output
- Print the full output JSON (matching `resources/output-schema.json`)
- For each change in `changes[]`:
  - **shadow:** show proposed diff, do NOT call Edit/Write
  - **live:** call Edit/Write through normal Claude Code permission flow
- Append audit entry to `docs/CHANGELOG_INTERNAL.md`
- Update `.vibecode/state/doc-hashes.json` with new hash (live mode only — shadow does NOT mutate state)

### 5. Report to user
Summary table:

```
Action     | Target                       | Mode    | Reason
update     | docs/api/auth.md             | shadow  | API_CHANGE | schema-sync
skip       | docs/setup/environment.md    | shadow  | format-only diff
blocked    | docs/api/payments.md         | live    | secret-detected: bearer token
```

If `mode=shadow` and any `action=update|create|delete`, ask user:
> "Apply N proposed changes? (y / pick / n)"

## Examples

```
/vibe-doc-sync                                  # all changes, shadow, fast
/vibe-doc-sync --live                           # all changes, live, fast
/vibe-doc-sync --tier full                      # global ref-graph, shadow
/vibe-doc-sync --live --tier full               # full sweep, write
/vibe-doc-sync backend/src/api/auth.py          # single file, shadow
/vibe-doc-sync --live backend/src/api/auth.py   # single file, live
```

## Notes

- **Shadow mode is default** — no writes occur without explicit `--live` OR user confirmation after preview
- BLOCKED actions (Step 9 security) are reported but NOT auto-fixed — user must remove the secret first
- Audit entries are written for ALL actions (skip, blocked, update, create, delete) — full trace
