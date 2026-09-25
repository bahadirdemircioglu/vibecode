---
description: "Spec-Driven Development: starts from the approved /vibe-plan file → requirements + acceptance cases → task breakdown → review → execute."
---

## SDD feature: $ARGUMENTS

Run a **Spec-Driven Development** cycle (adapted from WrongStack's `/sdd`) on top of an approved
architecture plan. `/vibe-plan` produces the plan; `/vibe-sdd` extends **that same file** with
requirements, acceptance cases and a dependency-ordered task list, then executes it one task at a time.
Use it for features big enough that "just start coding" would miss requirements.

> **Model:** phases 1-4 are planning work → **Opus** (routing: `.vibecode/standards/delegation.md`).
> Execution (phase 5) follows normal Sonnet-first routing.

### Phase 0 — Locate the plan
Find the approved plan for `$ARGUMENTS` via `docs/architecture/INDEX.md` → `docs/architecture/<feature>-plan.md`.
No approved plan → STOP: "Run `/vibe-plan <feature>` first and approve it." Do not create a separate spec file.

### Phase 1 — Questioning
Read the plan's Overview, Open Questions and API Contract. Ask the user 3-6 targeted clarifying questions
only for what the plan leaves open (scope edges, inputs/outputs, edge cases, non-goals, acceptance
criteria). Use the `AskUserQuestion` tool. Do NOT write yet.

### Phase 2 — Requirements & Acceptance (append to the plan)
Append to the plan file (do not rewrite approved sections; resolve answered Open Questions in place):
- `## Requirements` — numbered, testable (`R1`, `R2`, …); constraints from `docs/constraints/*` and standards
- `## Acceptance Cases` — table `# · input / state → expected` covering happy path, edge and error cases,
  each mapped to a requirement
Present the additions and ask the user to confirm or correct. Loop until approved.

### Phase 3 — Task breakdown (append to the plan)
Append `## Tasks` to the plan file. Each task is its own heading — **`### Task N: <title>`** (exactly this
form; `.vibecode/scripts/task-brief` extracts tasks by it — use `####` or bold labels inside a task, never
`#`–`###`). Per task: files touched (≤3) · depends-on · role (per agent-dispatch: engineer / mechanic / opus) ·
contract · acceptance cases table (`input / state → expected`, incl. edge + error cases). The implementer
turns the cases into tests first. No pseudo-code (`.vibecode/standards/delegation.md` §3).
Identify the **critical path** (longest dependency chain). Tasks with no shared deps can run in
parallel via `/vibe-fleet`.

### Phase 4 — Task review
Show the task list + critical path. Ask the user to approve before any code. This is the gate —
no implementation until "OK". On approval update the plan's line in `docs/architecture/INDEX.md`
(append `— SDD: tasks approved`).

### Phase 5 — Execute
**Setup (once):** `.vibecode/scripts/sdd-workspace <feature-name>` çalıştır — `.vibecode/sdd/progress-<feature>.md` oluşturur (veya o özelliğin ledger'ını devam ettirir).

Work tasks in dependency order:
- **Her görev öncesi:** `.vibecode/scripts/task-brief docs/architecture/<feature>-plan.md <N>` → `.vibecode/sdd/task-<N>-brief.md`
  - Implementer subagent'a dosya yolunu ver (içeriği prompt'a gömme).
  - Prompt şablonu: `.vibecode/prompts/sdd-implementer.md` + `TASK_BRIEF=<path>` + global constraints özeti.
- Independent tasks → fan out with `/vibe-fleet` (engineer/tester roles).
- Each task: implement → test → `make verify` → commit → mark done.
- **Her görev sonrası:** `.vibecode/scripts/review-package <BASE_COMMIT> HEAD` → `.vibecode/sdd/review-*.md`
  - Reviewer subagent'a diff dosyasını ver (içeriği prompt'a gömme).
  - Prompt şablonu: `.vibecode/prompts/sdd-reviewer.md` + `REVIEW_PACKAGE=<path>` + `TASK_BRIEF=<path>`.
  - Critical/Important bulgu varsa fix subagent → re-review.
- **Her görev tamamlandığında:** `.vibecode/sdd/progress-<feature>.md` ledger'ını güncelle (`- [x] Task N: ...`).
- On STATUS: BLOCKER, stop and report; `BELIRSIZ:` questions go to the user before continuing.
- After each task, update CHANGELOG.md.

### Phase 6 — Done
When all acceptance cases pass, move the plan's line in `docs/architecture/INDEX.md` to the
"Uygulandı" section, summarize and hand to `/vibe-done` (verify + HANDOFF + commit).

### YAPMA
- ❌ Don't start without an approved `/vibe-plan` file, and don't write a separate spec file.
- ❌ Don't append requirements before asking questions.
- ❌ Don't start Phase 5 without explicit approval of the task list.
- ❌ Don't create tasks that touch > 3 files — split them.
- ❌ Don't skip `make verify` between tasks.
