---
name: force-install-deps
description: User prefers vibecode to force-install Node.js and Serena (uv) during /vibecode:init instead of only printing MISSING hints
metadata:
  type: feedback
---

The user prefers that vibecode **installs** Node.js (with npm/npx) and uv/Serena itself during `/vibecode:init`, and does not proceed without them — not just print `MISSING` hints (said 2026-09-25 after a server test where node/npx/uvx were absent).

**Why:** Their servers are often fresh (rebuilt from scratch); without node the setup script and hooks cannot run, without uv Serena fails.
**How to apply:** Installation happens only in the explicitly invoked `/vibecode:init` (`.vibecode/scripts/install-deps.sh`), never silently from a hook. Related: [[vibecode-plugin-goal]].
