---
name: repo-local-memory
description: Project memory is stored in the repo (.vibecode/memory, .serena/memories) and committed — never secrets
metadata:
  type: project
---

Since 2026-09-25 Claude's auto memory lives in `.vibecode/memory/` (committed) instead of `~/.claude/projects/…`. The session-start hook writes `autoMemoryDirectory` (absolute path, required by Claude Code) into the gitignored `.claude/settings.local.json`; CLAUDE.md @imports `MEMORY.md` so the first session after a clone also sees it. Serena memories (`.serena/memories/`) are tracked too.

**Why:** The user develops privately and sometimes deletes the whole server and re-clones; memory in `~/.claude` was lost each time. Repos are private (GitHub API 404 without auth).
**How to apply:** Commit memory changes with the work (`/vibe-done`). Never store secrets (keys, passwords, customer data) — they would enter git history. On a new server the first session sets the path; it is active from the second session. Related: [[vibecode-plugin-goal]].
