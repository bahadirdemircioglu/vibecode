---
name: vibecode-plugin-goal
description: vibecode is a Claude Code plugin (done 2026-09-25, ADR-012) — install, dev setup, known auto-install gap
metadata:
  type: project
---

Completed 2026-09-25 (ADR-012, commit df5bbfc): vibecode is packaged as a Claude Code plugin; repo root = plugin = marketplace. Install: `/plugin marketplace add bahadirdemircioglu/vibecode` + `/plugin install vibecode@vibecode` (private repo — shorthand and SSH URL both work); per project `/vibecode:init`.

**Target workflow (user):** the user clones an existing project X from its own repo, opens `claude` inside X and invokes vibecode there — vibecode is NOT a base repo that projects are cloned from.

**Why:** avoid copying the framework into every project, the risky fresh-clone bootstrap and `/vibe-update` merges.

**How to apply:**
- Dev machine: `~/Dev/vibecode` is added as a user-scope *directory* marketplace, so it loads in place (edits apply next session); it wins over the GitHub source that project settings declare.
- Server-rebuild gap: project `extraKnownMarketplaces`+`enabledPlugins` re-add the marketplace on folder trust, but Claude Code 2.1.282 does not cache the plugin ("not cached") → one `/plugin install vibecode@vibecode` is needed. Re-test on newer Claude Code versions.
- Hooks only act in projects with a `.vibecode/` dir; skills are deliberately not registered (≈6.4k always-on tokens).

Related: [[vibecode-only]], [[repo-local-memory]].
