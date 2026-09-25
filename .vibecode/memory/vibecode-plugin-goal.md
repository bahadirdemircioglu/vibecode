---
name: vibecode-plugin-goal
description: Active goal (2026-09-25) — package vibecode as a Claude Code plugin installable from its GitHub link
metadata:
  type: project
---

Goal set 2026-09-25: turn vibecode into a Claude Code plugin; the user wants to install it just by giving the GitHub link (repo doubles as a marketplace: `/plugin marketplace add bahadirdemircioglu/vibecode` + `/plugin install vibecode@vibecode`).

**Why:** Avoid cloning the framework into every project and the risky fresh-clone bootstrap / `/vibe-update` merge.
**How to apply:** Next step is a spike (throwaway `CLAUDE_CONFIG_DIR`, local git marketplace, no push) verifying marketplace install, whether plugin hooks can block with exit 2, and `${CLAUDE_PLUGIN_ROOT}` in command text; then a written design for user approval. Details and open questions live in `HANDOFF.md` (Goal + Next Steps). Plugins cannot ship CLAUDE.md, `.claude/rules` or permissions — those need skills or stay in the project. Related: [[vibecode-only]].

Also requested 2026-09-25: memory lives in the project repo (git-tracked) because the user sometimes wipes the whole server — implemented in [[repo-local-memory]].
