---
description: "Show current session state and health check"
---

Run a full status check and report. Read-only — do not modify any files.

### 1. Session State
- Check for `HANDOFF.md` in project root
  - Exists: show last modified date and summarize contents
  - Missing: note "No handoff file — fresh session or state not saved"

### 2. Skills
- List matching skill files from `~/.claude/skills/`
- List matching skill files from project `skills/`
- Note which were loaded this session (if any)

### 3. Standards Loaded
- List which `docs/standards/*.md` files were read during this session
- Note any that are relevant but not yet loaded

### 4. MCP Status
- Serena: available / unavailable / not initialized
- Context7: available / unavailable

### 5. Context Assessment
- Estimate context usage based on conversation length
- Count approximate tool calls and file reads this session

### 6. Recommendation
Based on context assessment:
- **Low usage:** "Continue — plenty of context remaining"
- **Moderate usage:** "Consider `/compact` soon to preserve context"
- **High usage:** "Recommend `/compact` now or start a fresh session"

### Report Format
```
Session Status
  State: [fresh / has HANDOFF.md from DATE]
  Skills: [loaded list or none]
  Standards: [loaded list]
  Serena: [status]
  Context7: [status]
  Context: [low / moderate / high]
  Recommendation: [continue / compact / fresh session]
```
