---
name: scope-check
description: "Compare current implementation against original plan to detect scope creep. Use periodically during development to keep projects on track."
---

# Scope Check Skill

## Purpose

Compare the current implementation against the original architecture plan to
detect scope creep, track progress, and recommend action on unplanned additions.
Run periodically during development to keep projects on track.

---

## Protocol

### Step 1 — Read the Original Plan

Load the architecture plan from `docs/architecture/*.md`. Extract:
- Planned features (each distinct capability)
- Planned data models
- Planned API endpoints
- Planned frontend pages/components
- Explicitly deferred items (noted as "out of scope" or "future")

### Step 2 — Scan Current Implementation

Analyze the current state from:
- File tree structure (what exists in `backend/src/`, `frontend/src/`)
- Git log (commit messages since project start or last scope check)
- TODO/FIXME comments in code (unplanned work in progress)
- HANDOFF.md next steps (queued work that may not be in the plan)

### Step 3 — Classify Every Item

For each item found, classify it:

| Category | Definition |
|----------|------------|
| **Planned & Done** | In the plan and implemented |
| **Planned & Missing** | In the plan but not yet implemented |
| **Unplanned Addition** | Implemented but not in the original plan |
| **Deferred (On Track)** | Marked out-of-scope and still not implemented |
| **Deferred (Crept In)** | Marked out-of-scope but partially implemented |

### Step 4 — Calculate Bloat Score

```
Bloat Score = (Unplanned Additions / Total Planned Items) * 100
```

| Score | Risk Level | Meaning |
|-------|------------|---------|
| 0-10% | On Track | Normal development variance |
| 10-25% | Minor Creep | Some extras, but manageable |
| 25-50% | Significant Creep | Scope expanding, timeline at risk |
| >50% | Out of Control | Project scope has fundamentally changed |

### Step 5 — Recommend Action for Each Unplanned Item

| Action | When to Use |
|--------|-------------|
| **Keep** | Genuinely needed, small effort, already done |
| **Defer** | Nice to have but not needed now, move to backlog |
| **Cut** | Not needed, adds complexity, remove it |
| **Flag** | Needs discussion with user before deciding |

---

## Output Format

```
## Scope Check Report — [date]

### Plan Source
`docs/architecture/[plan-name].md` (approved [date])

### Progress Summary
- Planned items: 15
- Completed: 8 (53%)
- Missing: 5 (33%)
- Unplanned additions: 3

### Bloat Score: 20% — Minor Creep

### Planned & Done
1. User authentication (login, register, logout)
2. Dashboard page with summary widgets
3. ...

### Planned & Missing
1. [ ] Password reset flow — not started
2. [ ] Email notifications — not started
3. ...

### Unplanned Additions
| # | Item | Effort | Recommendation | Reason |
|---|------|--------|----------------|--------|
| 1 | Dark mode toggle | Small | Keep | Already implemented, users expect it |
| 2 | Admin analytics dashboard | Large | Defer | Not needed for MVP, move to v2 |
| 3 | WebSocket real-time updates | Medium | Flag | Discuss with user — may change architecture |

### Deferred Items (Crept In)
- [ ] Multi-language support — marked out-of-scope but i18n setup found in `frontend/src/utils/i18n.ts`
      Recommendation: Cut — remove partial implementation to reduce complexity

### Risk Assessment
[Summary of timeline/quality/complexity risks from scope changes]

### Recommended Next Steps
1. [Most important action]
2. [Second priority]
3. [Third priority]
```

---

## When to Run

| Trigger | Action |
|---------|--------|
| Every 5th session | Quick scope check (bloat score + unplanned list) |
| Before phase gate | Full scope check with recommendations |
| User asks "are we on track?" | Full scope check with report |
| Large unplanned feature requested | Scope check before accepting the work |

---

## Anti-patterns

```
NEVER count infrastructure/tooling as scope creep.
  -> Makefile targets, Docker configs, CI setup are not features. Exclude them.

NEVER recommend "Cut" for items the user explicitly requested mid-project.
  -> If the user asked for it, classify as "plan amendment" not "creep."

NEVER run scope check without reading the original plan first.
  -> Without the plan, there is no baseline to compare against.

NEVER present the bloat score without context.
  -> A 30% bloat score on a 5-item plan (1.5 extras) is different from 30%
     on a 50-item plan (15 extras). Always show absolute numbers.
```
