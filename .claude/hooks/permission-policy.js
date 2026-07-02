#!/usr/bin/env node

/**
 * Permission Policy Hook — Risk-Tier Gating (WrongStack-inspired)
 *
 * Adapted from WrongStack's `packages/core/src/security/permission-policy.ts`
 * (riskTier gating + subjectKey extraction), mapped onto Claude Code's
 * PreToolUse hook protocol.
 *
 * This is a SECOND defensive layer on top of the static deny-list in
 * settings.json. The deny-list catches known-bad globs; this hook adds:
 *   - patterns the static globs miss (short flags, fork bombs, curl|bash)
 *   - "subjectKey" extraction (which input field is the trust subject)
 *   - clear, actionable block reasons
 *
 * Two tiers:
 *   - DESTRUCTIVE  → hard block (exit code 2 + stderr) — fail-closed
 *   - STANDARD     → advisory warning (exit 0 + message) — does not block
 *
 * Escape hatch: set VIBE_YOLO=1 to downgrade destructive hard-blocks to
 * advisory warnings (use only in disposable/sandboxed environments).
 *
 * Input:  JSON on stdin (Claude Code hook protocol)
 * Output: exit 2 + stderr to BLOCK, or exit 0 (+ optional advisory JSON) to ALLOW
 */

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

// For Bash, keyword rules must match EXECUTED commands, not quoted DATA.
// A destructive word inside a `git commit -m "..."` message or an `echo "..."`
// is text, not a command, and must not trigger a hard block. We strip single-
// and double-quoted spans before matching — UNLESS the command uses a shell-
// eval construct (eval / sh -c / bash -c / ...), where quoted content IS
// executed and must stay inspected (fail-safe: inspect raw). Non-Bash tools
// (file paths, URLs) are returned unchanged.
function sanitizeForMatch(toolName, subject) {
  if (toolName !== 'Bash') return subject;
  const evalConstruct = /\beval\b|\b(?:ba|z|da)?sh\s+-c\b/i.test(subject);
  if (evalConstruct) return subject;
  // Double quotes first (may contain single quotes / heredoc bodies), then single.
  return subject.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
}

// subjectKey: which field of tool_input is the "trust subject" to inspect.
function extractSubject(toolName, input) {
  if (!input) return '';
  switch (toolName) {
    case 'Bash':
      return String(input.command || '');
    case 'Write':
    case 'Edit':
    case 'Read':
    case 'NotebookEdit':
      return String(input.file_path || input.path || '');
    case 'WebFetch':
      return String(input.url || '');
    default:
      return '';
  }
}

// DESTRUCTIVE: irreversible / dangerous. Hard block unless VIBE_YOLO=1.
const DESTRUCTIVE = [
  { re: /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*f|\brm\s+(-[a-z]*\s+)*-[a-z]*f[a-z]*r/i, why: 'recursive force delete (rm -rf)' },
  { re: /\brm\s+-[a-z]*\s*\/\s*($|\s)/i, why: 'delete of filesystem root' },
  { re: /\bgit\s+push\s+.*(--force\b|-f\b|--force-with-lease)/i, why: 'force push (rewrites remote history)' },
  { re: /\bgit\s+reset\s+--hard/i, why: 'hard reset (discards working tree)' },
  { re: /\bgit\s+clean\s+-[a-z]*f[a-z]*d|\bgit\s+clean\s+-[a-z]*d[a-z]*f/i, why: 'git clean -fd (deletes untracked files)' },
  { re: /\bchmod\s+(-[a-z]*\s+)*777\b/i, why: 'world-writable chmod 777' },
  { re: /\bsudo\b/i, why: 'privilege escalation (sudo)' },
  { re: /\bmkfs\b|\bdd\s+if=.*of=\/dev\/|\b>\s*\/dev\/sd[a-z]/i, why: 'raw disk / device write' },
  { re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/, why: 'fork bomb' },
  { re: /\bcurl\b[^|]*\|\s*(sudo\s+)?(ba)?sh\b|\bwget\b[^|]*\|\s*(sudo\s+)?(ba)?sh\b/i, why: 'pipe remote script straight into a shell (curl|bash)' },
  { re: />\s*\.env(\.|\b)|>>\s*\.env(\.|\b)/i, why: 'overwrite of a .env secrets file' },
];

// STANDARD: reversible but worth a heads-up. Advisory only.
const STANDARD = [
  { re: /\bgit\s+push\b(?!.*(--force|-f\b))/i, why: 'pushing to a remote' },
  { re: /\bdocker\s+compose\s+down\s+.*-v\b|\bdocker\s+volume\s+rm\b/i, why: 'deleting Docker volumes (data loss)' },
  { re: /\bnpm\s+publish\b|\bpnpm\s+publish\b/i, why: 'publishing a package' },
  { re: /\bfind\b.*-delete\b/i, why: 'bulk delete via find' },
  { re: /\bdropdb\b|\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, why: 'dropping a database object' },
];

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0); // no valid input — allow silently
  }

  const toolName = input.tool_name || '';
  const subject = extractSubject(toolName, input.tool_input);
  if (!subject) process.exit(0);

  // What the rules match against: executed commands, not quoted data.
  // `subject` is still used for the human-readable block/warning text.
  const matchTarget = sanitizeForMatch(toolName, subject);

  const yolo = process.env.VIBE_YOLO === '1';

  // --- Destructive tier ---
  for (const rule of DESTRUCTIVE) {
    if (rule.re.test(matchTarget)) {
      if (yolo) {
        // Downgraded to advisory because VIBE_YOLO=1 — inject as context,
        // do not block. (PreToolUse: additionalContext, not decision/message.)
        console.log(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext: `⛔→⚠️ [permission-policy] DESTRUCTIVE allowed via VIBE_YOLO: ${rule.why}\n   subject: ${subject.slice(0, 200)}`,
          },
        }));
        process.exit(0);
      }
      // Hard block: exit 2 + stderr is the most reliable PreToolUse block.
      process.stderr.write(
        `⛔ [permission-policy] BLOCKED — ${rule.why}.\n` +
        `   Tool: ${toolName}\n` +
        `   Subject: ${subject.slice(0, 300)}\n` +
        `   This action is irreversible. If you truly intend it, do it manually,\n` +
        `   or set VIBE_YOLO=1 for this session (sandboxed environments only).\n`
      );
      process.exit(2);
    }
  }

  // --- Standard tier (advisory) ---
  for (const rule of STANDARD) {
    if (rule.re.test(matchTarget)) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: `⚠️ [permission-policy] Heads-up — ${rule.why}. Proceed only if intended.`,
        },
      }));
      process.exit(0);
    }
  }

  process.exit(0);
}

main();
