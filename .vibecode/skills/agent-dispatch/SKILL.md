---
name: agent-dispatch
description: >
  Route a free-form task to the right fleet role (.claude/agents/*.md) using
  heuristic keyword scoring with a judgment fallback. Use whenever you are about
  to delegate work with the Agent tool and are unsure which subagent_type fits,
  or when /vibe-fleet needs to assign tasks to roles.
triggers: [delegate, dispatch, which agent, subagent, fan-out, /vibe-fleet]
scope: orchestration
model: sonnet
---

# Agent Dispatch (Role Routing)

Adapted from WrongStack's two-stage dispatcher (`packages/core/src/coordination/dispatcher.ts`):
a deterministic heuristic first, a judgment call only on ties.

## The 9 roles

| Role | Phase | Model | Read/Write | Use when the task is… |
|------|-------|-------|-----------|------------------------|
| `explorer` | Discovery | sonnet | read-only | "find / where is / how does X work / gather facts" |
| `architect` | Planning | opus | read-only | "design / plan / decide structure / trade-offs" |
| `engineer` | Build | sonnet | write | "implement / add / change / fix per a spec" |
| `mechanic` | Build | haiku | write | "rename / move / boilerplate from a pattern / update docs" — no logic |
| `tester` | Verify | sonnet | write | "write tests / reproduce / run the suite" |
| `reviewer` | Review | opus | read-only | "review this diff / check against standards" |
| `bug-hunter` | Debug | sonnet | read-only | "find the bug / root cause" |
| `refactor-planner` | Debug | opus | read-only | "plan the fix / how should we refactor" |
| `critic` | Debug/Meta | opus | read-only | "is this finding real / refute / verify" |

## Stage 1 — Heuristic (deterministic, instant)

Score each role by counting keyword/intent matches against the task:

- **explorer**: find, locate, where, search, map, understand, trace, list usages
- **architect**: design, plan, architecture, structure, approach, trade-off, decide, schema
- **engineer**: implement, add, build, write code, change, edit, fix, create file
- **mechanic**: rename, move, copy pattern, boilerplate, scaffold from, update docs, changelog, readme, format
- **tester**: test, spec, reproduce, coverage, verify, `make verify`, failing test
- **reviewer**: review, audit, check, standards, lint, quality, PR
- **bug-hunter**: bug, crash, error, broken, root cause, why does … fail
- **refactor-planner**: refactor, clean up, restructure, how to fix, fix plan
- **critic**: verify claim, is this right, refute, double-check, adversarial

Pick the highest-scoring role. **Model routing override** (single source: `.vibecode/standards/delegation.md`):
planning / architecture / deep-reasoning code → opus; purely mechanical edits (no logic, every decision already made)
→ haiku (`mechanic`); everything else → sonnet. If a `mechanic` task turns out to need a logic decision, re-dispatch
to `engineer`. Writing a plan *file* (`/vibe-plan`) → `general-purpose` + `model: "opus"` (architect has no Write).

## Stage 2 — Judgment fallback (only on a tie or score 0)

If two roles tie, or nothing matches, reason briefly about the *intent* and pick. If still
genuinely ambiguous, do **not** guess — report `BELIRSIZ: [which of X/Y, and why it matters]`
to the user (`delegation.md` §4).

## Output

```
DISPATCH → <role>  (model: <haiku|sonnet|opus>)
reason: <one line: which keywords / intent matched>
alternatives: <other plausible roles, if any>
```

## YAPMA
- ❌ Don't dispatch a write task to a read-only role (explorer/architect/reviewer/critic/*-planner).
- ❌ Don't run an opus-tier role (architect/critic/reviewer/refactor-planner) on sonnet to save tokens — the routing rules are deliberate.
- ❌ Don't send logic to `mechanic` to save tokens — Haiku failures cost more than the Sonnet run they replaced.
- ❌ Don't silently guess on a true tie — report BELIRSIZ.
