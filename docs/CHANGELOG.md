# Changelog

> Format follows `.vibecode/standards/documentation.md §2`.
> Updated after EVERY change — no exceptions.

---

## [2026-03-26] v0.1.1 — Integrate ADR decisions into CLAUDE.md and hooks

### Changes
- **What:** Updated CLAUDE.md to reference Error Memory system (ADR-001) in session startup, task decision tree, /done command, project structure, and quick reference. Updated `pre-tool-use.js` with skill suggestion logic (ADR-002).
- **Why:** ADR decisions were recorded but not reflected in the governing files that Claude reads at session start. Without these references, the Error Memory and Skill Orchestrator systems would not be activated.
- **How:** Added error memory scan steps to Gates and Task Decision Tree. Added `.vibecode/memories/errors/` to project structure. Extended pre-tool-use hook with file-path-to-skill mapping (advisory, non-blocking).

### Affected Files
- `CLAUDE.md` — 5 sections updated (§1, §3, §4, §7, §11)
- `.claude/hooks/pre-tool-use.js` — skill suggestion logic added
- `docs/CHANGELOG.md` — this entry

---

## [2026-03-26] v0.1.0 — ADR system initialized with 3 architecture decisions

### Changes
- **What:** Created `docs/decisions.md` with ADR-001 (Error Memory), ADR-002 (Skill Orchestrator), ADR-003 (Doc-Sync). Created `docs/CHANGELOG.md` and `docs/progress.md` for tracking.
- **Why:** Project needs formal decision records for three proposed infrastructure improvements: structured error memory, automatic skill recommendation, and hybrid documentation sync.
- **How:** ADRs written following `documentation.md §3` format. Error Memory (ADR-001) accepted as highest ROI item; ADR-002 and ADR-003 in Proposed status pending implementation.

### Affected Files
- `docs/decisions.md` — new file, 3 ADRs
- `docs/CHANGELOG.md` — new file, initial entry
- `docs/progress.md` — new file, roadmap tracking
