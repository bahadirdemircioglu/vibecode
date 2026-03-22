# Git & Versioning Standards

> **When to read:** Before committing, branching, or versioning changes.

---

## 1. Semantic Versioning

Stored in `docs/VERSION`. Format: `MAJOR.MINOR.PATCH`

| Increment | When |
|-----------|------|
| `MAJOR` | Breaking API change, major DB schema refactor |
| `MINOR` | New feature, backward-compatible |
| `PATCH` | Bug fix, docs update, small improvement |

---

## 2. GitHub Flow

```
main  ←─────────────────────── always deployable — never commit directly
  ├── feature/short-description
  ├── fix/short-description
  ├── docs/short-description
  └── refactor/short-description
```

**Conventional Commits format:**
```
feat: add JWT refresh token endpoint
fix: resolve race condition in file upload service
docs: add admin backup guide
refactor: extract pagination logic into shared util
chore: bump SQLAlchemy to 2.0.36
test: add edge cases for invoice PDF generation
```

---

## 3. CI/CD [FUTURE]

GitHub Actions will be added at stable v1.0.
Placeholder: `.github/workflows/ci.yml` (empty file, to be filled later).

**Planned CI pipeline (v1.0):**
- Run `make verify` (lint + test + audit) on every PR
- Pre-commit hooks (ruff, eslint, prettier) — to be added with CI, not before,
  since host-level pre-commit tooling conflicts with Docker-first principle
- Block merge if `make verify` fails
