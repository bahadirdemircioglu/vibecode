# CLAUDE.md — vibecode (plugin source repo)

This repo **is** the vibecode Claude Code plugin (repo root = plugin root = marketplace root). The general vibecode
rules (standards index, commands, core rules, skills, memory) are injected at session start by the plugin's
`hooks/session-start.sh` from `.vibecode/core-rules.md` — they are not repeated here. Architecture:
`docs/architecture/plugin-packaging-plan.md` (ADR-012).

@.vibecode/memory/MEMORY.md

## Layout

| Path | What |
|---|---|
| `.claude-plugin/plugin.json`, `marketplace.json` | Manifest (agents list, Serena + Context7 MCP) and single-plugin marketplace |
| `commands/` | Slash commands (`/vibe-*`, `/vibecode:init`) — framework paths as `${CLAUDE_PLUGIN_ROOT}/.vibecode/...` |
| `agents/` | Role subagents (listed in `plugin.json` — add new ones there too) |
| `hooks/` | `hooks.json` + scripts; every hook exits silently unless the project has a `.vibecode/` dir (`vibecode-project.js`); JS hooks go through `run-node.sh` (skipped when node is missing) |
| `.vibecode/core-rules.md` | Plugin-side CLAUDE.md replacement (`{{VIBECODE_ROOT}}` → plugin root). Keep it short — every session pays for it |
| `.vibecode/rules/` | Path-scoped rules (`paths:` frontmatter), injected by `hooks/pre-tool-use.js` on first matching write |
| `.vibecode/{standards,skills,templates,scripts,prompts,config}` | Framework content, read from the plugin root at runtime |
| `.vibecode/scripts/install-deps.sh` | `/vibecode:init` step 0 — installs Node.js ≥ 18, uv, Serena (never called from a hook) |
| `.vibecode/scripts/vibe-init.js` | `/vibecode:init` — project skeleton, settings merge, legacy migration |
| `.vibecode/memory/`, `docs/`, `HANDOFF.md` | This repo's own project data |

## Working on vibecode

- **Tests:** `node --test .vibecode/scripts/tests/` (debate script, vibe-init, hooks). Also `bash -n hooks/*.sh`,
  `node --check hooks/*.js`. There is no `make verify` in this repo — these are the verify step.
- **Dogfooding:** on the dev machine add this checkout as the `vibecode` marketplace once
  (`claude plugin marketplace add ~/Dev/vibecode` + `claude plugin install vibecode@vibecode`) — a directory
  marketplace is loaded in place, so edits apply on the next session without pushing.
- **Paths:** anything the model reads from a command/agent must use `${CLAUDE_PLUGIN_ROOT}` (substituted by Claude
  Code). Standards/skills keep `.vibecode/...` paths — core-rules maps them to the plugin root. Scripts must take the
  **project** from `CLAUDE_PROJECT_DIR`/cwd, never from their own location.
- **Release:** bump `version` in `.claude-plugin/plugin.json` for every pushed change — installed copies are cached per
  version, so `/plugin update vibecode@vibecode` only picks up a new version number.
- **Skills are not registered** as plugin skills (105 skills ≈ 6.4k always-on tokens); `/vibe-go` lists them lazily.
- Never `git add -A`; stage explicit paths. Update `docs/CHANGELOG.md` for every change.

## Project Memory

Hafıza **repoda** tutulur ve commit edilir — sunucu silinip repo yeniden çekilince geri gelir.
- Claude auto memory → `.vibecode/memory/` (session-start hook / `/vibecode:init` `.claude/settings.local.json`'a
  `autoMemoryDirectory` yazar; mutlak yol gerektiği için makineye özel dosyada). Serena → `.serena/memories/`.
- Hafıza değişikliklerini diğer değişikliklerle birlikte commit et (`/vibe-done`, `/vibe-compact`).
- **Asla sır yazma** (anahtar, parola, token, müşteri verisi) — hafıza git geçmişine girer.
