# Audit Log Entry Template — `docs/CHANGELOG_INTERNAL.md`

> Append-only ledger. Older entries MUST NOT be edited or removed. Skill writes; human reads.

## Entry format

```md
## [YYYY-MM-DDTHH:MM:SSZ]
- Action: <update|create|delete|skip|blocked> <target_file>
- Trigger: <changed_files joined by comma>
- Reason: <reasoning array joined by " | ">
- Hash before: <12-char sha256 prefix or "—" for create>
- Hash after: <12-char sha256 prefix or "—" for delete/skip/blocked>
- Mode: <shadow|live>
- Tier: <fast|full>
- Dependency: <atomic|independent>
```

## Examples

### Live update

```md
## [2026-04-30T14:32:11Z]
- Action: update docs/api/auth.md
- Trigger: backend/src/api/auth.py
- Reason: API_CHANGE on POST /login | schema-sync from openapi.json
- Hash before: a1b2c3d4e5f6
- Hash after: 9z8y7x6w5v4u
- Mode: live
- Tier: fast
- Dependency: atomic
```

### Shadow run (no write)

```md
## [2026-04-30T14:35:42Z]
- Action: update docs/api/auth.md
- Trigger: backend/src/api/auth.py
- Reason: shadow-mode dry-run | API_CHANGE detected
- Hash before: a1b2c3d4e5f6
- Hash after: —
- Mode: shadow
- Tier: fast
- Dependency: atomic
```

### Blocked (security)

```md
## [2026-04-30T14:40:18Z]
- Action: blocked docs/setup/environment.md
- Trigger: .env.example
- Reason: secret-detected: AWS access key pattern
- Hash before: 5f6e7d8c9b0a
- Hash after: —
- Mode: live
- Tier: fast
- Dependency: independent
```

### Skip (idempotent)

```md
## [2026-04-30T14:42:55Z]
- Action: skip docs/api/auth.md
- Trigger: backend/src/api/auth.py
- Reason: idempotent: same input hash already processed
- Hash before: a1b2c3d4e5f6
- Hash after: —
- Mode: shadow
- Tier: fast
- Dependency: independent
```
