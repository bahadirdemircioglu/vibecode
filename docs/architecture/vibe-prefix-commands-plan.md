# Architecture Plan: vibe- Prefix for Custom Commands

## Overview & Goals

Custom slash commands (`/go`, `/done`, `/plan`, `/compact`, `/scaffold`, `/status`, `/security-review`) conflict with Claude Code's built-in commands and the 800+ user-level skill commands in the ecosystem. For example, `/plan` could match both our custom command AND Claude's built-in planning, `/status` could conflict with other tools, etc.

**Goal:** Rename all 7 custom commands with a `vibe-` prefix so that typing `/vibe` instantly filters to show only vibecode's custom commands. This provides clear namespace isolation.

**Mapping:**

| Current | New |
|---------|-----|
| `/go` | `/vibe-go` |
| `/done` | `/vibe-done` |
| `/plan` | `/vibe-plan` |
| `/compact` | `/vibe-compact` |
| `/scaffold` | `/vibe-scaffold` |
| `/status` | `/vibe-status` |
| `/security-review` | `/vibe-security-review` |

## Directory Structure Changes

### File Renames (7 files)

```
.claude/commands/go.md              → .claude/commands/vibe-go.md
.claude/commands/done.md            → .claude/commands/vibe-done.md
.claude/commands/plan.md            → .claude/commands/vibe-plan.md
.claude/commands/compact.md         → .claude/commands/vibe-compact.md
.claude/commands/scaffold.md        → .claude/commands/vibe-scaffold.md
.claude/commands/status.md          → .claude/commands/vibe-status.md
.claude/commands/security-review.md → .claude/commands/vibe-security-review.md
```

### Content Updates (references to old command names)

**Critical files (direct command references):**

| File | Changes |
|------|---------|
| `CLAUDE.md` | Slash Commands table, Quick Reference, /done Checklist |
| `README.md` | Command references throughout (Hizli Baslangic, Yasam Dongusu, Komut Referansi, Sik Karsilasilan Durumlar, Dizin Yapisi) |
| `.vibecode/templates/INITIAL_PROMPT.md` | /plan, /go, /done, /compact references |
| `.claude/commands/vibe-done.md` (after rename) | Internal reference to `/compact` |
| `.claude/commands/vibe-scaffold.md` (after rename) | Internal reference to `/go` |

**Skill files with command references (update cross-references):**

These skill files in `.vibecode/skills/` reference commands and should be updated:
- `handoff-protocol/SKILL.md` — references /go, /done, /compact
- `self-check/SKILL.md` — references /done, /compact
- `phase-gate/SKILL.md` — references /done
- `gap-detection/SKILL.md` — references /compact
- `incremental-writing/SKILL.md` — references /compact
- `writing-plans/SKILL.md` — references /plan
- `code-review-checklist/SKILL.md` — references /done

**Docs files:**
- `docs/decisions.md` — ADR references to /done
- `docs/progress.md` — references to commands
- `docs/CHANGELOG.md` — historical references (leave as-is, they're historical)

## Tech Decisions

**Approach: Simple file rename + find-and-replace**
- No code logic changes needed — Claude Code resolves commands by filename in `.claude/commands/`
- The `settings.json` hooks are NOT affected (they reference hook scripts, not command names)
- The `session-start.sh` and `pre-tool-use.js` hooks are NOT affected (they don't reference command names)

**Historical references:** `docs/CHANGELOG.md` entries that mention old command names will NOT be updated — they're historical records of what happened at that time.

**Worktree copies:** `.claude/worktrees/flamboyant-fermat/` contains stale copies — these should be ignored (they're temporary git worktree artifacts).

## Database Schema

N/A

## API Contract

N/A

## Docker Services

N/A

## Port Assignments

N/A

## Security Considerations

No security impact — this is a pure naming refactor of documentation/command files.

## Migration Plan

### Step 1: Rename command files (7 files)
```bash
cd .claude/commands/
git mv go.md vibe-go.md
git mv done.md vibe-done.md
git mv plan.md vibe-plan.md
git mv compact.md vibe-compact.md
git mv scaffold.md vibe-scaffold.md
git mv status.md vibe-status.md
git mv security-review.md vibe-security-review.md
```

### Step 2: Update internal cross-references in command files
- `vibe-done.md`: `/compact` → `/vibe-compact`
- `vibe-scaffold.md`: `/go` → `/vibe-go`

### Step 3: Update CLAUDE.md
- Slash Commands table
- Quick Reference section
- /done Checklist header

### Step 4: Update README.md
- All command references throughout

### Step 5: Update INITIAL_PROMPT.md template
- All command references

### Step 6: Update skill files with command references
- ~7 skill files with /go, /done, /compact, /plan references

### Step 7: Update docs/decisions.md
- ADR references to /done

**NOT updated:**
- `docs/CHANGELOG.md` — historical entries stay as-is
- `.claude/worktrees/` — temporary artifacts, ignored
- `settings.json` — no command name references
- Hook scripts — no command name references

## Open Questions

1. **docs/CHANGELOG.md:** Eski entry'lerdeki `/done`, `/go` referanslarini da guncellemek ister misin? (Onerilen: hayir, tarihsel kayit olarak kalsin)
2. **Worktree copies:** `.claude/worktrees/flamboyant-fermat/` altindaki eski kopyalar temizlensin mi?
