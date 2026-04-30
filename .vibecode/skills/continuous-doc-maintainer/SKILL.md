---
name: continuous-doc-maintainer
description: Continuously synchronize documentation with code changes. Auditable,
  idempotent, schema-driven, secret-aware. Use after code changes to keep
  docs/api/, docs/user/, docs/admin/ in sync. Default shadow mode (reports
  only); live mode applies changes through user-confirmed Edit/Write.
metadata:
  model: sonnet
  version: 4.0
---

# Continuous Documentation Maintainer (v4)

Maintain, validate, secure, and audit Markdown documentation with traceability and schema-driven accuracy. Plain-Markdown adaptation of the v4 spec — no Mintlify dependency.

## Use this skill when

- A code change has merged or is about to merge → docs may be stale
- Called automatically from `/vibe-done` Step 4 (shadow mode default)
- Called manually via `/vibe-doc-sync [--live] [--tier full] [paths...]`
- API contract change (`backend/openapi.json` updated) → regenerate examples
- Endpoint or UI feature deleted → prune docs + dangling references

## Do NOT use this skill when

- Docs-only PR (no code change) — return `"action": "skip"`
- Format-only diff (whitespace, comments, import order) — semantic-diff filter returns `"action": "skip"`
- `backend/` directory does not exist (project not yet scaffolded) — Step 6 no-ops, but prune + audit still run
- Output destination is outside `docs/` — refuse (security boundary)

## Execution Modes

```json
{
  "mode": "shadow | live",
  "execution_tier": "fast | full",
  "audit_log": true
}
```

- **shadow** (default) — produce structured action plan, do NOT call Write/Edit
- **live** — apply changes through Write/Edit (user confirms via permission prompt)
- **fast** — local file scope only, skip global reference graph (Step 4)
- **full** — include global reference graph + cross-doc dangling-link resolution

## Input Schema

See `resources/input-schema.json`. Minimum payload:

```json
{
  "diff": "<unified diff string>",
  "changed_files": ["backend/src/api/auth.py"],
  "metadata": { "type": "api", "scope": "auth" },
  "mode": "shadow",
  "execution_tier": "fast"
}
```

Optional: `existing_docs`, `doc_index`, `schema_sources`, `screenshots`, `previous_hashes`.

## Steps (v4 spec, plain-MD adaptation)

### Step 0 — Idempotency Check (Concurrency Lite)
- Load `.vibecode/state/doc-hashes.json` if present
- Compute hash of `(diff + changed_files)` → if matches a recent entry, return `"action": "skip"` with reason `"idempotent: same input already processed"`
- File-level locks NOT enforced (single-user assumption — see plan §Tech Decisions §3)

### Step 1 — Change Classification
Classify the diff into one of:
- `API_CHANGE` — `backend/src/api/`, `routes`, OpenAPI delta
- `UI_CHANGE` — `frontend/src/{components,pages}/`, `.tsx`/`.jsx`
- `CONFIG_CHANGE` — `.env.example`, `docker-compose.yml`, `Makefile`, `pyproject.toml`
- `DELETE_CHANGE` — file deletion in any of the above
- `NON_DOC_CHANGE` — tests, internal refactor, CI config → `"action": "skip"`

Skip immediately if the diff is **format-only** (whitespace, comments, reordering imports).

### Step 2 — Target Resolution

| Change type | Target file |
|---|---|
| `API_CHANGE` (scope=auth) | `docs/api/auth.md` |
| `API_CHANGE` (scope=dashboard) | `docs/api/dashboard.md` |
| `UI_CHANGE` (feature=settings) | `docs/user/settings.md` |
| `UI_CHANGE` admin context | `docs/admin/{feature}.md` |
| `CONFIG_CHANGE` env vars | `docs/setup/environment.md` + `.env.example` |
| `DELETE_CHANGE` | corresponding file in `docs/` (prune) |

Output target may be **multiple** files (e.g., schema change → `docs/api/auth.md` + `docs/setup/environment.md`).

### Step 3 — Pruning Engine
For deleted endpoints / UI:
- Remove the section whose heading matches the deleted symbol
- Remove related code examples within that section
- Remove anchor references in the same file (e.g., `[See login](#login)` if `## Login` is removed)
- Trigger Step 4 (global) if `--tier full` for cross-doc dangling references

### Step 4 — Global Reference Graph (FULL tier only)
- Walk `docs/**/*.md`
- Build `{anchor → file}` map
- Detect broken references (link target heading no longer exists)
- For each broken ref: action = `fix` (if obvious replacement) or `mark_deprecated` (insert `> ⚠️ Deprecated — see [...]`)

Skip in `fast` tier — local file only.

### Step 5 — Structural + Semantic Validation
- Compute hash of doc body **excluding** whitespace and code-fence formatting
- Compare to `previous_hashes` for the target file:
  - identical → `"action": "skip"` (idempotency)
  - meaningful diff → proceed
  - whitespace-only diff → `"action": "skip"`

### Step 6 — Schema-Driven Documentation
If `schema_sources` provided AND files exist:

```
schema_sources = [
  "backend/openapi.json",
  "backend/src/schemas/**/*.py",
  "backend/src/models/**/*.py"
]
```

For each changed endpoint / model:
- Parse OpenAPI → regenerate request/response example block
- Replace existing example block (delimited by `<!-- schema:auto -->` ... `<!-- /schema:auto -->`)
- If file does not exist → warn, skip Step 6, proceed with other steps

### Step 7 — Visual Diff Guard
**DISABLED in this version.** `docs/user/` is empty; no screenshot use-case.
Re-enable when `docs/user/` populated AND `screenshots` input provided. Threshold: skip update if visual diff < 5%.

### Step 8 — Section Patch Engine (heading-based)
Allowed operations on target file:
- `modify_section(heading, new_content)` — replace content under a heading until next same-level heading
- `insert_section(after_heading, new_section)` — insert new heading + body after target
- `delete_section(heading)` — remove heading + content until next same-level heading

Operations performed via `Edit` tool. Track line numbers from Edit response. NOT a real Markdown AST — string-based section ops.

### Step 9 — Security Linter (BLOCKING)
Before any write, scan the proposed content for:

| Pattern | Regex (illustrative) |
|---|---|
| API key | `(?i)(api[_-]?key\|secret[_-]?key)\s*[:=]\s*['"]?[\w\-]{20,}['"]?` |
| Bearer/JWT token | `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` |
| AWS access key | `AKIA[0-9A-Z]{16}` |
| Private key block | `-----BEGIN (RSA\|EC\|OPENSSH) PRIVATE KEY-----` |
| Email PII | `[\w.+-]+@[\w-]+\.[\w.-]+` (warn — not block) |
| SSN-like | `\b\d{3}-\d{2}-\d{4}\b` |

If any **blocking** pattern matches → `"action": "blocked"` with `reasoning: ["secret-detected: <pattern>"]`. Do NOT call Write/Edit. Report to user.

### Step 10 — Navigation Sync
- For new doc files: append entry to relevant index (e.g., `docs/architecture/INDEX.md` for plans, but doc files don't have a central index — leave as-is for now; only update INDEX.md when adding a new architecture plan)
- Maintain heading hierarchy (H1 → H2 → H3, no skips)
- Generated anchors follow GitHub-flavored slug rules (lowercase, hyphenated)

### Step 11 — Atomic Commit Logic
- Breaking API change (removed endpoint, changed method/path) → atomic: all related doc updates in single commit
- Minor changes (added optional field, doc clarification) → independent commits
- This skill does NOT call git directly — it groups its output `changes` array by `dependency_level`. The caller (`/vibe-done` or user) decides commit boundary.

### Step 12 — Audit Trail
Append to `docs/CHANGELOG_INTERNAL.md` using `resources/audit-log-template.md` format. Required fields per entry:

```md
## [ISO-8601 timestamp]
- Action: <update|create|delete|skip|blocked> docs/api/auth.md
- Trigger: <changed_files summary>
- Reason: <reasoning array joined>
- Hash before: <sha256 first 12 chars>
- Hash after: <sha256 first 12 chars>
- Mode: <shadow|live>
- Tier: <fast|full>
```

Always append (even for `skip` and `blocked` actions) — audit trail must be complete.

### Step 13 — Validation Checklist (pre-output gate)

Before returning, verify:
- [ ] No duplicate sections in target file
- [ ] No invented content (only what's in diff/schema sources)
- [ ] Pruning applied for deletions
- [ ] No broken local anchor references introduced
- [ ] Schema-driven blocks regenerated (if schema_sources active)
- [ ] Step 9 security pass cleared
- [ ] Audit log entry written

If any check fails → revise output, do NOT skip.

## Output Schema

See `resources/output-schema.json`. Example response:

```json
{
  "action": "update",
  "mode": "shadow",
  "execution_tier": "fast",
  "dependency_level": "atomic",
  "target_file": "docs/api/auth.md",
  "reasoning": [
    "API_CHANGE detected in backend/src/api/auth.py",
    "Endpoint POST /login signature changed",
    "Schema-sync: regenerated request example from openapi.json"
  ],
  "changes": [
    {
      "op": "modify_section",
      "heading": "## POST /login",
      "diff": "<proposed diff>"
    }
  ],
  "hash_before": "abc123def456",
  "hash_after": "789xyz012345",
  "commit_message": "docs(api): update /login signature after auth.py change"
}
```

## Forbidden Actions

- Writing files outside `docs/` (security boundary)
- Writing secrets/tokens/PII (Step 9 BLOCK)
- Breaking `docs/architecture/INDEX.md` link integrity
- Creating duplicate sections in same doc
- Skipping Step 9 security validation
- Writing in `live` mode without `previous_hashes` state (idempotency cannot be verified)

## Idempotency Guarantee

Same `(diff, changed_files, schema_sources)` input → same output. Hash check at Step 0 + Step 5 prevents duplicate updates. State file: `.vibecode/state/doc-hashes.json` (gitignored).

## Philosophy

Documentation is **audited**, **secured**, and **continuously maintained**. Single source of truth: code + schema. Doc drift is treated as a bug.

## Resources

- `resources/input-schema.json` — full input contract
- `resources/output-schema.json` — full output contract
- `resources/audit-log-template.md` — `CHANGELOG_INTERNAL.md` entry template
