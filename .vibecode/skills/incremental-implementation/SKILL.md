---
name: incremental-implementation
description: "Build features in thin vertical slices: implement, test, verify, commit. Use when implementing any feature to prevent scope creep and ensure testability."
---

## Overview

Execution discipline for code implementation. Each slice goes through Implement → Test → Verify → Commit before the next slice begins. Prevents the #1 AI agent failure mode: writing hundreds of lines before testing.

## When to Use

- Every feature implementation (this is the default working mode)
- Especially when implementing a plan from /vibe-plan
- When working on unfamiliar codebases

## The Increment Cycle

```
Implement (max 100 lines) → Test → Verify (make verify) → Commit → Next
```

Never write more than ~100 lines of production code before running tests.

## Slicing Strategies

### Vertical Slicing (Default)

Build one complete thin feature end-to-end rather than building all layers at once:

- BAD: Build all models → all services → all routes → all UI
- GOOD: Build login model → login service → login route → login UI → THEN registration model → ...

### Contract-First

1. Define the API contract (types/interfaces)
2. Build backend implementation
3. Build frontend implementation
4. Both sides already agree on the contract

### Risk-First

Build the riskiest/most uncertain piece first. If it fails, you fail fast before investing in the easy parts.

## Rules

### Rule 0: Simplicity First

Before implementing, ask: "What is the simplest thing that could work?"

- Does this need a new abstraction? (probably not)
- Does this need a new dependency? (probably not)
- Can I solve this with existing code? (probably yes)

### Rule 1: Scope Discipline

Only implement what the current task requires. When you notice something that needs fixing but is outside scope:

```
// NOTICED BUT NOT TOUCHING: [description of what needs work]
```

Create a separate task for it. Never mix scope.

### Rule 2: One Thing at a Time

Each increment does exactly ONE thing:

- Add a model (test it)
- Add a service method (test it)
- Add a route (test it)
- Wire up the UI (test it)

### Rule 3: Keep It Compilable

The codebase must compile/pass lint after every increment. Never leave it in a broken state.

### Rule 4: Feature Flags for Incomplete Work

If a feature spans multiple sessions or PRs:

- Use feature flags to merge incomplete but non-breaking code
- Flag defaults to OFF
- This allows trunk-based development without long-lived branches

### Rule 5: Safe Defaults

New code should be disabled/inactive by default. Additive changes (new files, new functions) are safer than modifications to existing code.

### Rule 6: Rollback-Friendly

Each increment should be independently revertable. Prefer:

- Adding new files over modifying existing ones
- Adding new functions over modifying existing ones
- Database migrations that work both forward and backward

## Anti-patterns

- Writing 500+ lines before running any test
- Building all layers before testing any layer
- Mixing feature work with refactoring in the same increment
- Scope creep ("while I'm here, let me also...")
- Long-lived feature branches instead of feature flags
- Modifying shared code without understanding downstream impact
