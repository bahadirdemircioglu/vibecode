---
description: "Spec-Driven Development: question → spec → task breakdown → review → execute. Sits between /vibe-plan and /vibe-go for non-trivial features."
---

## SDD feature: $ARGUMENTS

Run a **Spec-Driven Development** cycle (adapted from WrongStack's `/sdd`). Where `/vibe-plan`
produces an architecture plan, `/vibe-sdd` drives the full loop from clarifying questions to a
dependency-ordered task list you execute one task at a time. Use it for features big enough that
"just start coding" would miss requirements.

> **Model:** questioning + spec + task design is planning work → use **Opus** for steps 1-4.
> Execution (step 5) follows normal Sonnet-first routing.

### Phase 1 — Questioning
Ask the user 3-6 targeted clarifying questions (scope, inputs/outputs, edge cases, non-goals,
acceptance criteria). Use the `AskUserQuestion` tool. Do NOT write a spec yet.

### Phase 2 — Spec
From the answers, write `docs/architecture/<feature>-spec.md`:
- **Goal & non-goals**
- **Requirements** (numbered, testable)
- **Acceptance criteria** (how we'll know it's done)
- **Constraints** (from `docs/constraints/*` and standards)
Present it and ask the user to confirm or correct. Loop until approved.

### Phase 3 — Task breakdown
Decompose the spec into a dependency-ordered task list. For each task:
`id · title · files touched (≤3) · depends-on · role (per agent-dispatch) · acceptance check`.
Identify the **critical path** (longest dependency chain). Tasks with no shared deps can run in
parallel via `/vibe-fleet`.

### Phase 4 — Task review
Show the task list + critical path. Ask the user to approve before any code. This is the gate —
no implementation until "OK".

### Phase 5 — Execute
**Setup (once):** `.vibecode/scripts/sdd-workspace <feature-name>` çalıştır — `.vibecode/sdd/progress.md` oluşturur (veya mevcut ledger'ı devam ettirir).

Work tasks in dependency order:
- **Her görev öncesi:** `.vibecode/scripts/task-brief <spec-file> <N>` → `.vibecode/sdd/task-<N>-brief.md`
  - Implementer subagent'a dosya yolunu ver (içeriği prompt'a gömme).
  - Prompt şablonu: `.vibecode/prompts/sdd-implementer.md` + `TASK_BRIEF=<path>` + global constraints özeti.
- Independent tasks → fan out with `/vibe-fleet` (engineer/tester roles).
- Each task: implement → test → `make verify` → commit → mark done.
- **Her görev sonrası:** `.vibecode/scripts/review-package <BASE_COMMIT> HEAD` → `.vibecode/sdd/review-*.md`
  - Reviewer subagent'a diff dosyasını ver (içeriği prompt'a gömme).
  - Prompt şablonu: `.vibecode/prompts/sdd-reviewer.md` + `REVIEW_PACKAGE=<path>` + `TASK_BRIEF=<path>`.
  - Critical/Important bulgu varsa fix subagent → re-review.
- **Her görev tamamlandığında:** `.vibecode/sdd/progress.md` ledger'ını güncelle (`- [x] Task N: ...`).
- On a blocker, stop and report.
- After each task, update CHANGELOG.md.

### Phase 6 — Done
When all acceptance criteria pass, summarize and hand to `/vibe-done` (verify + HANDOFF + commit).

### YAPMA
- ❌ Don't write the spec before asking questions.
- ❌ Don't start Phase 5 without explicit approval of the task list.
- ❌ Don't create tasks that touch > 3 files — split them.
- ❌ Don't skip `make verify` between tasks.
