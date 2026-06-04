---
description: "Track a locked, multi-session goal with a journal. Bounded driver — NOT an autonomous loop. Subcommands: set | status | journal | clear."
---

## Goal command: $ARGUMENTS

Manage a **locked goal** that survives across sessions, with an append-only journal. This is the
*bounded, supervised* adaptation of WrongStack's goal engine — deliberately **not** an autonomous
"eternal loop". It keeps a north star and progress log; the human (or an explicit `/loop`) drives
each step. (Decision: autonomous unbounded execution was rejected as unsafe for a config framework.)

State lives in `GOAL.md` at the project root (next to HANDOFF.md), git-ignored or committed as you prefer.

### Subcommands (parse from `$ARGUMENTS`)

**`set <description>`** — Lock a new goal.
- Write `GOAL.md` with: `## Goal`, the description, `## Acceptance` (how we'll know it's done,
  ask the user if unclear), `## Journal` (empty), `Status: active`.
- If a goal is already active, ask before overwriting.

**`status`** (or empty `$ARGUMENTS`) — Show the current goal, acceptance criteria, last 5 journal
entries, and `Status`. Then suggest the single next step toward the goal.

**`journal <note>`** — Append a dated entry to `## Journal`: what was done, what's next, blockers.
Convert relative dates to absolute. Do this after each meaningful chunk of progress.

**`clear`** — Mark `Status: completed` (or `abandoned`) and stop treating the goal as active.
Verify acceptance criteria are met before marking completed; if not, say what's missing.

### How a session uses the goal
- `/vibe-go` and `/vibe-done` should read `GOAL.md` if present and keep work pointed at it.
- To make real progress, do the work normally (optionally `/vibe-fleet` for fan-out), then
  `/vibe-goal journal` the result. The goal is a **compass + ledger**, not an executor.

### Optional supervised iteration
If you want repeated automatic ticks, drive it with the user-level **`/loop`** skill wrapping a
concrete step (e.g. `/loop 30m /vibe-goal status`). Always bounded by `/loop`'s interval/limit and
the permission hooks — there is no hidden unbounded autonomy.

### YAPMA
- ❌ Don't run an unbounded autonomous loop. Every tick is human-initiated or `/loop`-bounded.
- ❌ Don't mark a goal completed without checking the acceptance criteria.
- ❌ Don't overwrite an active goal without asking.
- ❌ Don't let goal pursuit bypass the permission/security hooks or the 2-attempt escalation rule.
