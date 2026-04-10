# Code Style and Conventions

## General Rules (from CLAUDE.md Core Rules)
1. Read relevant standard before writing code in that area
2. Verify library APIs from docs (Context7 or official) — don't guess
3. Write tests for every new feature or change
4. Run `make verify` before reporting task complete
5. Update CHANGELOG.md after every change
6. Use Serena for code navigation — symbol-level reading preferred
7. Max 3 files per step — use subagents for larger changes
8. Architecture changes require plan + approval first
9. Sonnet subagents get micro-specs, not high-level instructions

## File Naming
- Standards: `.vibecode/standards/{area}.md`
- Skills: `.vibecode/skills/{skill-name}/SKILL.md`
- Commands: `.claude/commands/vibe-{name}.md`
- Hooks: `.claude/hooks/{hook-name}.{js|sh}`
- Architecture plans: `docs/architecture/{feature}-plan.md`
- Constraints: `docs/constraints/{area}.md`

## Hook Code Style (JavaScript/Node.js)
- Use async/await pattern
- Read JSON from stdin (Claude Code hook protocol)
- Output JSON to stdout with `decision` and optional `message`
- Advisory hooks (warn but don't block) — use `decision: "approve"`

## Shell Script Style (Bash)
- Use `#!/usr/bin/env bash` shebang (or `#!/usr/bin/env node` for JS hooks)
- Error handling with proper exit codes

## Documentation
- Conventional Commits for git messages
- ADRs in `docs/decisions.md` with date, status, context, decision, alternatives, consequences
- CHANGELOG follows semantic versioning categories

## Model Routing
- Opus: planning, review, decision-making, micro-spec creation
- Sonnet: mechanical code writing from micro-specs only
- 1-2 line changes: Opus writes directly
- 3+ lines: micro-spec required for Sonnet
- Max 2 Sonnet attempts per task, then Opus takes over
