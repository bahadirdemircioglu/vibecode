---
name: subagent-budget-protocol
description: >
  Discipline for spawning subagents safely: bounded scope, attempt caps, and a
  roll-up manifest. Use when delegating to one or more subagents (Agent tool or
  /vibe-fleet) so fan-out stays fail-closed and the main context stays clean.
triggers: [subagent, budget, fan-out, /vibe-fleet, delegate, parallel agents]
scope: orchestration
model: sonnet
---

# Subagent Budget Protocol

WrongStack isolates every subagent with a hard `SubagentBudget` (iterations, tool calls,
tokens, cost, timeout) and records provenance in a `fleet.json` manifest. Claude Code's
Agent tool does not expose hard token budgets, so we enforce the same intent as **discipline
rules** instead. Goal: bounded, fail-closed delegation with auditable results.

## Before spawning — the contract

Give every subagent a written contract in its prompt:

1. **Single objective** — one clear deliverable. If it needs two, spawn two.
2. **Scope fence (YAPMA list)** — explicitly list what NOT to touch.
3. **Inputs** — the exact files/specs it needs, so it doesn't go exploring the whole repo.
4. **Output shape** — tell it the structure to return (findings list / contract spec per `.vibecode/standards/delegation.md` §3 / diff summary).
5. **Attempt cap** — "If you fail the same problem twice, stop and report; do not try a third time."
   ("Same problem" = same file path + similar error — substring match, per delegation.md §4.)

## During — isolation rules

- **Read vs write**: discovery/review/critic roles are read-only; only engineer/tester may write.
- **Parallel only when independent**: fan out subagents in parallel *only* if their files don't
  overlap. Shared files → run sequentially to avoid clobbering.
- **Fail-closed escalation**: on a second failure of the same problem, the work returns to Opus
  (`Agent(model:opus)`), never a third Sonnet attempt.

## After — roll-up manifest

When multiple subagents return, the orchestrator writes a compact roll-up (the vibecode analog
of `fleet.json`) — keep it in the response and/or HANDOFF.md:

```
FLEET ROLL-UP
- <role> · <task one-liner> · <status: ok|partial|failed> · <key result / file:line>
- ...
Decision: <what the main context will do with these results>
Open: <anything unresolved / BELIRSIZ from a subagent>
```

## YAPMA
- ❌ Don't spawn an open-ended subagent ("improve the codebase") — no objective, no budget.
- ❌ Don't let a subagent's full transcript leak into main context — keep the conclusion, drop the dumps.
- ❌ Don't retry the same failing task a third time — escalate to Opus.
- ❌ Don't parallelize subagents that edit the same file.
