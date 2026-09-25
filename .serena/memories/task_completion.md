# Task Completion Checklist

When a task is completed, follow the `/vibe-done` workflow:

## Steps
1. **Summarize changes** — What was done and why
2. **Run `make verify`** — lint + test + audit. Fix failures before continuing
3. **Security review** — Run OWASP Top 10 check on changed source files
4. **Update docs:**
   - `docs/CHANGELOG.md` — Add entry under appropriate category
   - Relevant docs if API, schema, or architecture changed
5. **Write `HANDOFF.md`** — Session state for next session:
   - What was done
   - Current status
   - Open questions
   - Next steps
6. **Propose commit message** — Conventional Commits format

## Verification Order
1. Lint passes (ruff, eslint, prettier)
2. Tests pass (pytest, vitest)
3. Security audit clean (pip-audit, npm audit)
4. Security review of changed files
5. Documentation updated
6. HANDOFF.md written

## Common Pitfalls
- Don't skip `make verify` even for "small" changes
- Don't forget CHANGELOG.md
- Don't commit .env files (blocked by settings)
- Don't force push (blocked by settings)
