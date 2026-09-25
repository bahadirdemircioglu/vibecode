# Framework Security — Agent Hooks & Provider Secrets

> Moved from `.vibecode/standards/security.md` §7–8. That standard covers the **app** you build;
> this guide covers how the **vibecode framework** protects the agent (hooks) and its own
> `/vibe-plan` provider secret.

---

## 1. Agent Permission & Net/FS Hardening (WrongStack-inspired)

> **When to read:** Before changing `.claude/settings.json` permissions or the security hooks.
> These layers protect the *agent itself* (the tools Claude runs), not the app it builds.

Adapted from WrongStack's `permission-policy.ts`, `fetch.ts`, `replace.ts`, `_env.ts`. Two
defensive layers sit in front of every tool call:

### 1.1 Static deny-list (`settings.json` → `permissions.deny`)
First line of defense — glob patterns the harness blocks before the tool runs. Covers the
known-bad shapes (`rm -rf`, force push, `git clean -fd`, `sudo`, `chmod 777`, `dd if=`, `mkfs`,
`.env` reads/writes, raw `node`/`python`/installs). Add a new glob here when you find a class of
command that should never run.

### 1.2 Risk-tier policy hook (`.claude/hooks/permission-policy.js`)
Second layer — a `PreToolUse` hook on **Bash only** (matcher `Bash`). It inspects the command
(quoted data stripped unless an `eval`/`sh -c` construct is present) and classifies it. File
paths and URLs are not matched against command rules (a path containing "sudo" is data):

| Tier | Action | Examples |
|------|--------|----------|
| **destructive** | **hard block** (exit 2, fail-closed) | `rm -rf` (any flag order: `-fr`, `-r -f`, `--recursive --force`), `sudo` in command position, force push, `git reset --hard`, fork bomb, `curl\|bash`, overwrite `.env` |
| **standard** | advisory warning (allow) | plain `git push`, `docker compose down -v`, `npm publish`, `DROP TABLE` |

Escape hatch: `VIBE_YOLO=1` downgrades destructive blocks to warnings — **sandboxed/disposable
environments only**.

### 1.3 Net/FS guard (`.claude/hooks/net-fs-guard.js`, run inside `pre-tool-use.js`)
Second layer for network and filesystem reach. Wiring: settings.json registers ONE hook,
`pre-tool-use.js`, for `Write|Edit|NotebookEdit|WebFetch`; it `require()`s `net-fs-guard.js`
(one node process per call) and then emits the advisory skill hint once per path per session.
`net-fs-guard.js` still runs standalone for piped-JSON tests:
- **SSRF:** `WebFetch` to a private/loopback/link-local target (incl. cloud metadata
  `169.254.169.254`, `localhost`, `*.internal`) is blocked; non-`http(s)` schemes too. Escape
  hatch: `VIBE_ALLOW_PRIVATE_FETCH=1` for local-API testing.
- **System-path containment:** `Write`/`Edit` into `/etc`, `/usr`, `/bin`, `/boot`, `/sys`,
  `/proc`, `/dev`, `/root/.ssh`, … is blocked. Project, `/tmp`, and `~/.claude` writes stay allowed
  (so memory writes work).
- **Symlink escape:** writing *through* a symlink whose real target leaves the workspace is blocked.

### 1.4 Rules
- Hooks are **fail-closed**: a destructive/SSRF match blocks the tool (exit code 2).
- Never weaken a hook to get past a legitimate block — do the action manually or use the documented
  env escape hatch for that one session.
- Both hooks are pure Node, no dependencies, and exit 0 on any parse error (never break the session).
- Test changes with piped JSON before committing (see `docs/guides/wrongstack-features-guide.md`).

---

## 2. External AI Consultation — Secret Hygiene (`/vibe-plan` Step 1.5)

> **When to read:** Before touching `.vibecode/config/ai-providers.json`,
> `.vibecode/scripts/consult-provider.sh`, the framework provider secret, or `/vibe-plan` Step 1.5.

`/vibe-plan` can optionally send a draft plan to an external provider (v1: DeepSeek) for a critique
round (see ADR-007, `docs/architecture/multi-ai-plan-consultation-plan.md`). Unlike §1's hooks, this
step is **fail-open** by design — it is a quality bonus, not a security gate, so any error or missing
config silently falls back to the normal single-model flow.

### 2.1 Secret storage
- **Provider registry** (`.vibecode/config/ai-providers.json`) is **non-secret** and git-tracked. It
  holds only *which* provider/model/endpoint and the **name** of the env var to read
  (`api_key_env`) — never a key value. The schema has no field to hold a key, so a key can't be
  committed here by accident.
- **The key itself is NEVER the project's own `.env`.** vibecode is usually layered inside another
  project, whose root `.env` belongs to *that app*; the framework must not mix its provider key into
  it (nor risk it being committed with the app). The key resolution order is:
  1. `$DEEPSEEK_API_KEY` (or the configured `api_key_env`) **already exported** in your shell rc.
  2. `$VIBECODE_ENV_FILE` — explicit path override.
  3. `.vibecode/providers.env` — project-local override, **gitignored** (root `.gitignore`). Use only
     when you are sure that path is gitignored *in the host project*.
  4. `~/.config/vibe/providers.env` — **machine-global, recommended**: outside every repo, set
     once, **shared by vibecode and vibeplan**, reused across all projects, impossible to commit.
  5. `~/.config/vibecode/providers.env` — legacy machine-global path, still read as a fallback.
  (`$XDG_CONFIG_HOME` replaces `~/.config` when set.)
  Only `.vibecode/providers.env.example` (placeholder) is tracked.

### 2.2 Key handling rules
- `consult-provider.sh` first checks the env var named by `api_key_env`; if unset it extracts **only
  that one line** from the first secret file found (order above) — **no `source`/`eval`**, so the file
  is never executed. The project's own `.env` is **never** read.
- The key travels **only** in the `curl` `Authorization: Bearer` header, which is piped to curl on
  **stdin** (`-H @-`) — never in argv, so it is not visible in `ps` / `/proc/<pid>/cmdline`. It is
  **never** printed to stdout/stderr, never logged, never interpolated into the plan or the critique.
- `curl -sS` (no verbose/echo); on error the script surfaces HTTP status + provider error *message*,
  **never** request headers.
- **Why this doesn't circumvent the §1.1 `.env` deny-list:** that deny-list stops *Claude's own*
  Read/`cat` tool calls from pulling secrets into the model's context. The script reads its own
  secret file inside a subprocess and emits only the critique text — the key never reaches the model.
  Running the script via Bash (`consult-provider.sh <plan>`) puts no secret path in the command
  string, so the deny-list is neither triggered nor bypassed.

### 2.3 Privacy & opt-in
- **Opt-in = configuring it.** No external call happens unless a maintainer sets
  `enabled: true` **and** provides a key. The shipped default is `enabled: false`.
- **Rounds:** `max_rounds` defaults to **1** (one critique pass). Reasoning models spend
  `max_tokens` on reasoning first, so the config ships `max_tokens: 32000`, `timeout_seconds: 300`.
- **Transparency:** every round prints a one-line notice ("plan DeepSeek'e gönderildi") so plan
  content is never sent to a third party without a visible trace.
- **Escape hatch:** `/vibe-plan <feature> --no-consult` skips consultation for one call (sensitive
  plans) without editing config.
- **Third-party retention:** plan content (architecture, possibly business context) leaves your
  machine. The provider's data-retention/training policy is out of scope (their ToS) — for
  confidential plans, keep `enabled: false` or use `--no-consult`.
- **Timeout is mandatory:** `curl --max-time` (config `timeout_seconds`) so a slow provider never
  blocks `/vibe-plan` indefinitely.
