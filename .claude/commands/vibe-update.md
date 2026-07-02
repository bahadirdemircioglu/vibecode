---
description: "Sync vibecode framework files (standards, skills, hooks, commands) from upstream"
---

## Update vibecode framework: $ARGUMENTS

Pull the latest vibecode **framework** files into this project and apply them
safely, using hash-based 3-way classification. Only framework paths are touched
— the user's application code, plans, changelog and constraints are never
modified. The mechanical work is done by `.vibecode/scripts/vibe-update`; this
command handles the interactive conflict decisions.

> **Model:** Runs on the main session (orchestration + judgement on conflicts).
> No subagent. `$ARGUMENTS` may be a ref override, e.g. `main` or a tag.

### 1. Scan
Run: `.vibecode/scripts/vibe-update scan` (append `VIBECODE_REF=$ARGUMENTS` env if a ref was given).

Handle the exit code:
- **3 (SELF)** — origin is the vibecode source repo. Say "This IS the vibecode repo; nothing to update." and **STOP**.
- **2 (MISSING/ERROR)** — missing `curl`/`tar` or fetch failed. Report the message and **STOP** (suggest network check or `VIBECODE_UPSTREAM_DIR=<local-clone>` for offline).
- **0** — continue. The script printed a one-line summary and wrote `.vibecode/state/update-report.md`.

If UPDATE+ADD+CONFLICT are all `0`, say "Already up to date with `<sha>`." and **STOP**.

### 2. Show the plan
Read `.vibecode/state/update-report.md` and present the Summary table to the user.
Buckets: **UPDATE**/**ADD** auto-apply · **CONFLICT** ask · **USERONLY**/**USERADD** leave · **DELETED** leave + report.

### 3. Pre-flight: clean tree
The framework paths must be committed (so the update is one reviewable, revertible diff).
If `apply-clean` later returns **exit 4 (DIRTY)**, STOP and tell the user to commit/stash their framework changes first, then re-run.

### 4. Apply the clean buckets
Run: `.vibecode/scripts/vibe-update apply-clean`
This copies every **UPDATE** and **ADD** file into the project. Report the count applied.

### 5. Resolve conflicts (one at a time)
For each **CONFLICT** row in `.vibecode/state/update-plan.tsv`
(`awk -F'\t' '$1=="CONFLICT"{print $2}' .vibecode/state/update-plan.tsv`):

1. Let `UP="$(cat .vibecode/state/upstream-root)"`.
2. Show the diff: `diff -u "<path>" "$UP/<path>"` (local = "ours", upstream = "theirs").
3. Ask the user: **keep ours** / **take theirs** / **merge manually**.
   - take theirs → `.vibecode/scripts/vibe-update apply-one <path>`
   - keep ours → do nothing
   - merge manually → edit the file yourself combining both, using the diff as guide
   - For `.claude/settings.json` prefer **merge manually** (preserve project-specific permission entries while adopting new hook wiring).

### 6. Report DELETED
List any **DELETED** rows (upstream removed these). Do NOT delete them automatically —
tell the user and let them decide.

### 7. Refresh the manifest
Run: `.vibecode/scripts/vibe-update write-manifest`
This records the new baseline hashes + synced SHA in `.vibecode/VERSION`.

### 8. Update CHANGELOG + propose commit
- Append an entry to `docs/CHANGELOG.md`: `vibecode framework updated (<old-sha> → <new-sha>)`, listing applied + resolved files.
- Propose a commit (Conventional Commits), e.g.
  `chore(vibecode): update framework to <new-sha> (N files)`.
