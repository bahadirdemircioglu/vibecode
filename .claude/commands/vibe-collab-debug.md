---
description: "Collaborative debugging: BugHunter → RefactorPlanner → Critic trio on a shared file set, then a verified fix plan."
---

## Collab-debug target: $ARGUMENTS

Run a three-role collaborative debugging session (adapted from WrongStack's `CollabSession`).
`$ARGUMENTS` is the bug description and/or the file paths to investigate. Use this when a bug is
non-obvious and you want a diagnosis you can trust before touching code.

> **Flow:** BugHunter finds the defect → RefactorPlanner designs the minimal fix → Critic tries to
> refute both. Only Critic-confirmed findings get implemented.

### 1. Snapshot the target
Identify the exact files in scope (from `$ARGUMENTS`, `git diff`, or the stack trace). Keep the set
tight — the trio reads only these plus their direct call chain.

### 2. Stage A — BugHunter (subagent: `bug-hunter`)
Spawn the `bug-hunter` agent with the bug description + file set. It returns ranked defects
(confidence · `file:line` · why it triggers the symptom). Read-only.

### 3. Stage B — RefactorPlanner (subagent: `refactor-planner`)
Pass the BugHunter's findings to the `refactor-planner` agent. It returns a minimal root-cause fix
per defect as a micro-spec (file · change type · pseudo-code · pattern reference), plus blast-radius
and tests to add. Read-only.

### 4. Stage C — Critic (subagent: `critic`)
Pass BOTH the defects and the fix plan to the `critic` agent. It returns REFUTED / CONFIRMED /
UNCERTAIN per item with `file:line` evidence, and says which fixes are safe to apply now.

### 5. Synthesize
Present a consolidated report:
```
COLLAB-DEBUG REPORT
Root cause:      <one line, Critic-confirmed>
Confirmed fixes: <micro-spec list, ready to implement>
Dropped/uncertain: <what the Critic refuted or flagged>
Tests to add:    <list>
```

### 6. Implement (only after confirmation)
On user OK, hand the confirmed micro-specs to the `engineer` agent (and `tester` for the
reproduction test), then `make verify`. For a single small fix, Opus may apply it directly.

### YAPMA
- ❌ Don't implement a fix the Critic refuted or marked uncertain without resolving it first.
- ❌ Don't let the trio expand scope beyond the snapshot file set.
- ❌ Don't fix the symptom — the RefactorPlanner targets the root cause.
- ❌ Don't skip the reproduction test.
