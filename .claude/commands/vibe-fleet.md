---
description: "Orchestrate a task across parallel fleet roles (Director pattern): dispatch → fan-out subagents → roll up results"
---

## Fleet task: $ARGUMENTS

You are the **Director**. Decompose the task, dispatch each piece to the right role, fan out in
parallel where safe, then roll up. This is the vibecode adaptation of WrongStack's Director/fleet.

> **Model:** the Director (this orchestration) is judgment work — stay on the current model.
> Individual subagents use the model their role defines (`.claude/agents/*.md`).

### 1. Load the protocol
Load the `agent-dispatch` and `subagent-budget-protocol` skills (read their SKILL.md). They define
the 9 roles, the routing heuristic, and the delegation contract.

### 2. Decompose
Break `$ARGUMENTS` into the smallest independent sub-tasks. For each, note:
- the role it maps to (use `agent-dispatch` heuristic)
- its inputs (files/specs) and expected output shape
- whether it conflicts with another sub-task (shared files → must be sequential)

Show the user this plan as a short table **before** spawning. If the task is a single obvious
unit, skip straight to dispatch with one subagent.

### 3. Dispatch (fan-out)
For each sub-task, call the Agent tool with the matching `subagent_type` and a prompt that
includes the full delegation contract (objective · scope fence/YAPMA · inputs · output shape ·
2-attempt cap). Launch **independent** sub-tasks in parallel (multiple Agent calls in one message);
run conflicting ones sequentially.

- Read-only roles: explorer, architect, reviewer, bug-hunter, refactor-planner, critic.
- Write roles: engineer, tester, mechanic (Haiku — mechanical edits only).
- If any sub-task needs design/architecture, route to `architect` (opus) and feed its contract specs (contract + acceptance cases) to `engineer`.

### 4. Roll up
When subagents return, write the **FLEET ROLL-UP** (per `subagent-budget-protocol`):
one line per sub-task (role · task · status · key result/`file:line`), a Decision line, and any
Open / `BELIRSIZ` items. Keep each subagent's conclusion; drop the raw dumps.

### 5. Decide & continue
Based on the roll-up, either: take the next step yourself, spawn a follow-up wave, or hand back to
the user with open questions. If anything was written, remind to run `make verify` and update CHANGELOG.

### YAPMA
- ❌ Don't fan out subagents that edit the same file in parallel.
- ❌ Don't spawn an open-ended subagent — every one gets an objective + scope fence.
- ❌ Don't retry a failed sub-task a third time on Sonnet — escalate to `Agent(model:opus)`.
- ❌ Don't let raw subagent transcripts flood the main context — keep conclusions only.
