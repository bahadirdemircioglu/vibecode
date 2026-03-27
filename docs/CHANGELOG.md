# Changelog

> Format follows `.vibecode/standards/documentation.md §2`.
> Updated after EVERY change — no exceptions.

---

## [2026-03-27] — Add security-review skill and /security-review command

### Changes
- **What:** Created `security-review` skill for OWASP Top 10 code review across all languages (Python, JS/TS, Go, Java, C#). Added `/security-review` slash command for manual triggering. Integrated automatic security review into `/done` flow (Step 3). Updated CLAUDE.md slash commands table.
- **Why:** Need for systematic security review of generated/written code with line-level findings and patched code suggestions. Inspired by "Senior AppSec Engineer" prompt pattern.
- **How:** New skill at `.vibecode/skills/security-review/SKILL.md` with full OWASP Top 10 checklist + language-specific patterns. Slash command at `.claude/commands/security-review.md`. `/done` flow updated with automatic security pass.

### Affected Files
- `.vibecode/skills/security-review/SKILL.md` — new skill (created)
- `.claude/commands/security-review.md` — new slash command (created)
- `.claude/commands/done.md` — added Step 3: Security Review (Automatic)
- `CLAUDE.md` — added `/security-review` to slash commands table
- `docs/architecture/security-review-skill-plan.md` — architecture plan (created)
- `docs/CHANGELOG.md` — this entry
- `docs/decisions.md` — ADR-004 added
- `docs/progress.md` — security-review module added

---

## [2026-03-26] v0.2.0 — Enforce mandatory Serena usage, pre-operation MCP checks, and doc updates

### Changes
- **What:** Strengthened MCP enforcement in CLAUDE.md (§2 rewritten with pre-operation health check, Serena non-negotiable usage). Added mandatory doc update enforcement in Task Decision Tree. Expanded absolute rules from 5 to 8 (added Serena, MCP check, doc update rules). Updated pre-tool-use.js with MCP availability reminders and doc update reminders. Updated README to reflect all changes.
- **Why:** Serena must be used for ALL code operations (not optional). Documentation must be updated after EVERY change (not just at /done). MCP availability must be verified before every operation, not just at session start.
- **How:** CLAUDE.md §2 split into §2.1 (pre-op MCP check), §2.2 (Serena non-negotiable), §2.3 (Context7). Hook now has 4 advisory layers: MCP, standards, skills, docs. Five Absolute Rules → Eight Absolute Rules.

### Affected Files
- `CLAUDE.md` — §2, §4, §9 rewritten/expanded
- `.claude/hooks/pre-tool-use.js` — MCP + doc reminder layers added
- `README.md` — hooks, rules, troubleshooting sections updated
- `docs/CHANGELOG.md` — this entry

---

## [2026-03-26] v0.1.2 — Update README with Error Memory, Skill Orchestrator, and ADR documentation

### Changes
- **What:** Updated README.md to document Error Memory (ADR-001), Skill Orchestrator (ADR-002), and ADR system. Added new sections, updated directory tree, hooks description, /done flow, FAQ, and philosophy.
- **Why:** README was out of date — strategic improvements (Error Memory, Skill Orchestrator, ADR system) were implemented in CLAUDE.md and hooks but not reflected in user-facing documentation.
- **How:** 7 sections updated/added: intro table, Gate 2, directory tree, hooks (skill suggestion), /done flow, Error Memory section, ADR section, FAQ entries, philosophy.

### Affected Files
- `README.md` — 7 sections updated, 2 new sections added
- `docs/CHANGELOG.md` — this entry

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
