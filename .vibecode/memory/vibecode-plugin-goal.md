---
name: vibecode-plugin-goal
description: Active goal (2026-09-25) — package vibecode as a Claude Code plugin installable from its GitHub link
metadata:
  type: project
---

Goal set 2026-09-25: turn vibecode into a Claude Code plugin; the user wants to install it just by giving the GitHub link (repo doubles as a marketplace: `/plugin marketplace add bahadirdemircioglu/vibecode` + `/plugin install vibecode@vibecode`).

**Why:** Avoid cloning the framework into every project and the risky fresh-clone bootstrap / `/vibe-update` merge.
**How to apply:** Spike done 2026-09-25 (results in `HANDOFF.md` → Spike Results): plugin hooks CAN block with exit 2, `${CLAUDE_PLUGIN_ROOT}` expands in commands/skills/hooks, no single-step install (two-step only), project-declared `extraKnownMarketplaces`+`enabledPlugins` loads the plugin after folder trust (tested with directory source only). Next step: written plugin design → user approval → implementation. Plugins cannot ship CLAUDE.md, `.claude/rules` or permissions — those need skills or stay in the project. Related: [[vibecode-only]].

Also requested 2026-09-25: memory lives in the project repo (git-tracked) because the user sometimes wipes the whole server — implemented in [[repo-local-memory]].

**Target workflow (user, 2026-09-25):** the user clones an existing project X from its own repo, opens `claude` inside X, and invokes vibecode there — vibecode is NOT the base repo that projects are cloned from. The README's clone-vibecode-as-project flow does not match how the user works; the plugin (installed once at user scope + `/vibecode:init` inside X) is the intended fix.
