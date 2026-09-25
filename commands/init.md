---
description: "Set up this project for vibecode (or migrate a clone-based install) — skeleton docs, settings, plugin auto-restore"
allowed-tools: Bash(bash *install-deps.sh*), Bash(node *vibe-init.js*)
---

## vibecode init: $ARGUMENTS

Prepare the CURRENT project for the vibecode plugin. Safe to re-run: the script only creates missing files and
merges settings; it never overwrites project content.

> **Model:** main session, no subagent. Mechanical work is done by the script; you only explain and ask.

### 0. Dependencies — mandatory, installed automatically

vibecode needs Node.js ≥ 18 (hooks, setup script, Context7) and uv (Serena). Install them first — run exactly this,
on its own (Bash `timeout: 600000`, the first Serena download can take minutes):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/.vibecode/scripts/install-deps.sh"
```

It prints `OK` / `INSTALLED` / `FAIL` per component (node, uv, serena) and `RESTART: …` when something was installed.
- **Exit 1 (`FAIL`)** — do NOT continue. Show the FAIL lines. If one says it needs root, tell the user to run the
  printed command themselves with the `!` prefix (e.g. `! sudo bash "<path>"`), then `/vibecode:init` again. STOP.
- **Exit 0** — continue with step 1 (a freshly installed `node` is usable right away). Remember whether `RESTART`
  was printed; mention it at the end.

### 1. Run the setup

Run exactly this command — on its own, with nothing appended (no `; echo`, no `&&`), so the pre-approved permission
matches; the exit code is reported by the tool anyway:

```bash
node "${CLAUDE_PLUGIN_ROOT}/.vibecode/scripts/vibe-init.js"
```

Exit codes: **0** done · **1** error (e.g. `.claude/settings.json` is not valid JSON — show the message, ask the user
to fix it, STOP) · **2** usage (report, STOP).

Summarize the `CREATED` / `UPDATED` / `WARN` lines in 2–5 bullets. Mention that `.claude/settings.json` now declares the
vibecode marketplace + plugin: after a fresh clone (e.g. a server rebuild) trusting the folder re-adds the marketplace,
and one `/plugin install vibecode@vibecode` (then restart) brings vibecode back.

### 2. Legacy install (only if the output has `LEGACY` lines)

The project still carries a copied, clone-based vibecode. Show the user the LEGACY list grouped as:
- **same / obsolete** — identical to the plugin or no longer used → safe to remove
- **differs** — changed locally; kept as a *project override* unless the user wants it gone
- hook entries in `.claude/settings.json`, serena/context7 in `.mcp.json` — duplicate what the plugin provides
- `CLAUDE.md` template copy — never removed automatically; offer to trim it to project-specific notes

Ask: **migrate now?** (and separately, for `differs` files: keep as overrides, or remove too?). The files are tracked
in git, so removal is reversible. On yes run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/.vibecode/scripts/vibe-init.js" --migrate
```

(append ` --all` to also remove the `differs` files — again nothing else appended)

If the user wants CLAUDE.md trimmed, remove only the vibecode template sections (standards index, commands table,
core rules, project structure) and keep anything project-specific; show the diff.

### 3. Finish

- Tell the user to **restart the session** when step 0 printed `RESTART`, `.serena/project.yml` was created or legacy
  hooks were removed.
- Propose a commit (do NOT commit automatically), e.g. `chore: set up vibecode plugin` — include `docs/`,
  `.gitignore`, `.claude/settings.json`, `.vibecode/memory/` and any migration removals.
- Next step: `/vibe-go <task>` (or `/vibe-plan <idea>` for a new feature).
