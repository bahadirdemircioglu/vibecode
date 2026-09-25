---
name: handoff-protocol
description: "Session state preservation protocol. Use when ending sessions, running /vibe-compact, or starting new sessions to maintain context continuity."
---

# Handoff Protocol Skill

## Purpose

Preserve session context across session boundaries to prevent context loss.
This protocol ensures that every session ends with a structured handoff document
and every session starts by reading it.

---

## HANDOFF.md Format

**Single source:** `.vibecode/templates/HANDOFF.md` — copy it and fill every section (use `N/A`,
never omit a section). Do not keep a copy of the format elsewhere. The template's parser contract
(`- **Status:**` line, `- [ ]` Next Steps items) is read by the session-start hook; its `## Goal`
section carries the optional multi-session goal.

---

## When to Write HANDOFF.md

| Trigger              | Action                                              |
|----------------------|-----------------------------------------------------|
| `/vibe-done` command      | Write HANDOFF.md as part of the /vibe-done sequence       |
| `/vibe-compact` command   | Write HANDOFF.md BEFORE compacting context           |
| Session ending       | Write HANDOFF.md before the session closes           |
| Switching tasks      | Write HANDOFF.md to preserve state of current task   |

---

## When to Read HANDOFF.md

| Trigger              | Action                                              |
|----------------------|-----------------------------------------------------|
| `/vibe-go [task]`         | Read HANDOFF.md as part of the startup sequence      |
| New session          | Read HANDOFF.md during Session Startup Checklist     |
| After `/vibe-compact`     | Read HANDOFF.md to restore context                   |

---

## How to Write

- Be concise and structured — no prose paragraphs
- Focus on actionable items, not narrative
- Use file paths (absolute) for all references
- List concrete next steps, not vague goals
- Include the branch name and its status
- Record which skills were loaded and used
- If blocked, clearly state what is blocking and what is needed to unblock

---

## How to Read

1. Read "Current State" to understand where things stand
2. Read "Goal" — if active, keep the task pointed at it
3. Read "Open Questions" to identify blockers
4. Read "Next Steps" to know what to do first
5. Read "Changes This Session" for recent context
6. Read "Active Skills" to reload the same skills
7. Cross-reference with .serena/memories/ for deeper project context

---

## Location

- **File:** `HANDOFF.md` in the project root
- **Template:** `.vibecode/templates/HANDOFF.md` provides the blank structure
- **Lifecycle:** Overwritten each session (not appended). Previous state is
  preserved in .serena/memories/ and docs/CHANGELOG.md.
