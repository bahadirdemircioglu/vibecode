---
name: code-simplification
description: "Simplify existing complex code while preserving behavior. Use when refactoring, reviewing messy code, or reducing technical debt."
---

## Overview

Code simplification is the disciplined practice of reducing complexity in existing code without altering its observable behavior. Unlike clean-code (which applies proactively during writing), this skill is applied reactively — on code that already exists and has grown hard to reason about. Simpler code directly improves token efficiency during AI-assisted work: smaller, clearer functions are easier to analyze, modify, and test. It also reduces cognitive load for human reviewers, lowers the risk of introducing bugs, and makes future changes cheaper.

## When to Use

- After feature completion, before PR
- When reviewing code with high cyclomatic complexity
- When touching legacy code that's hard to understand
- NOT when writing new code from scratch (use clean-code instead)

## Core Process

1. **Understand First (Chesterton's Fence)** — Before removing or changing anything, understand WHY it exists. Read git blame, check tests, understand the intent. Never remove code you don't understand.
2. **Identify Patterns** — Use the pattern tables below to spot complexity signals in the code.
3. **Apply Incrementally** — One simplification at a time, test after each change.
4. **Verify** — Confirm all existing tests pass and no behavior has changed.

## Pattern Identification Tables

### Structural Complexity

| Signal | Simplification |
|--------|----------------|
| Deep nesting (3+ levels) | Guard clauses / early returns |
| Long function (>30 lines) | Extract focused functions |
| Boolean parameters | Options object or separate functions |
| Switch/if chains on type | Polymorphism or strategy pattern |
| Repeated conditionals | Extract predicate function |
| Nested ternaries | if/else or guard clause |

### Naming & Clarity

| Signal | Simplification |
|--------|----------------|
| Single-letter variables | Descriptive names |
| Negated booleans (`!isNotValid`) | Positive form (`isValid`) |
| Generic names (`data`, `info`, `temp`) | Domain-specific names |
| Abbreviated names | Full words |

### Redundancy

| Signal | Simplification |
|--------|----------------|
| Dead code / unused imports | Remove |
| Duplicate logic (3+ occurrences) | Extract shared function |
| Wrapper that only delegates | Inline or remove |
| Comments explaining obvious code | Remove comments, improve names |
| Try/catch that only re-throws | Remove |

## Rules

1. **Scope Discipline** — Only simplify code you're already touching. No drive-by refactors.
2. **Separate refactoring from features** — Never mix simplification with new functionality in the same commit.
3. **One pattern at a time** — Apply one simplification, test, commit. Then next.
4. **Rule of 500** — If simplification touches >500 lines, consider automated codemods instead.
5. **Balance** — Don't over-simplify. Inlining everything or removing all abstractions makes code worse.

## Anti-patterns

- Removing code you don't understand (Chesterton's Fence violation)
- Simplifying untested code without adding tests first
- Mixing feature work with refactoring in one commit
- Drive-by refactors outside your current task scope
- Over-abstracting (creating helpers for one-time operations)
