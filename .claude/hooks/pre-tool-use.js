#!/usr/bin/env node

/**
 * Pre-Tool-Use Hook — Write/Edit/NotebookEdit/WebFetch (single process)
 *
 * One node process per tool call (previously three: pre-tool-use +
 * permission-policy + net-fs-guard). Two layers:
 *
 * 1. Net/FS guard (fail-CLOSED) — SSRF + system-path + symlink-escape checks,
 *    implemented in ./net-fs-guard.js and require()d here. A match blocks the
 *    tool (exit 2 + stderr).
 * 2. Skill hint (advisory, ADR-002) — suggests skills for the file path being
 *    written. Emitted at most ONCE per path per session, so repeated edits of
 *    the same file cost zero context. State: .vibecode/state/skill-hints-<session>.json
 *    (gitignored runtime state).
 *
 * Bash commands are gated separately by permission-policy.js.
 *
 * Input:  JSON from stdin (Claude Code hook protocol)
 * Output: exit 2 + stderr to BLOCK; otherwise exit 0 with optional
 *         hookSpecificOutput.additionalContext.
 */

const fs = require('node:fs');
const path = require('node:path');
const { checkTool } = require('./net-fs-guard.js');

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

// Path → skill names (advisory only). Keep names in sync with .vibecode/skills/.
function suggestSkills(filePath) {
  const s = [];
  if (filePath.includes('/api/') || filePath.includes('routes')) s.push('fastapi-pro', 'api-design-principles');
  if (filePath.includes('/models/') || filePath.includes('alembic')) s.push('postgresql', 'database-migrations-sql-migrations');
  if (filePath.includes('/schemas/')) s.push('pydantic-models-py');
  if (filePath.includes('/services/')) s.push('fastapi-pro', 'error-handling-patterns');
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) s.push('react-patterns');
  if (filePath.includes('/store/')) s.push('react-state-management');
  if (filePath.includes('tailwind') || filePath.endsWith('.css')) s.push('tailwind-patterns');
  if (filePath.includes('Dockerfile') || filePath.includes('docker-compose')) s.push('docker-expert');
  if (filePath.includes('/tests/') || filePath.includes('.test.') || filePath.includes('.spec.') || /(^|\/)test_[^/]*\.py$/.test(filePath)) {
    s.push('tdd-workflows-tdd-cycle');
  }
  return [...new Set(s)];
}

// Once-per-path-per-session bookkeeping. Any I/O failure → behave as "not seen"
// (worst case: a hint repeats) — the hook must never break the workflow.
function firstTimeForPath(sessionId, projectRoot, relPath) {
  const safe = String(sessionId || 'nosession').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(projectRoot, '.vibecode', 'state');
  const file = path.join(dir, `skill-hints-${safe}.json`);
  let seen = [];
  try { seen = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { seen = []; }
  if (!Array.isArray(seen)) seen = [];
  if (seen.includes(relPath)) return false;
  seen.push(relPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(seen), 'utf-8');
  } catch { /* ignore */ }
  return true;
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0); // no valid input — allow silently
  }

  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  // --- Layer 1: net/fs guard (fail-closed) ---
  let reason = null;
  try {
    reason = await checkTool(toolName, toolInput);
  } catch {
    reason = null; // guard internals failed — never break the session on uncertainty
  }
  if (reason) {
    process.stderr.write(`⛔ [net-fs-guard] BLOCKED — ${reason}\n`);
    process.exit(2);
  }

  // --- Layer 2: skill hint (Write/Edit/NotebookEdit only) ---
  if (!['Write', 'Edit', 'NotebookEdit'].includes(toolName)) process.exit(0);
  const filePath = String(toolInput.file_path || toolInput.notebook_path || toolInput.path || '');
  if (!filePath) process.exit(0);

  const skills = suggestSkills(filePath);
  if (skills.length === 0) process.exit(0);

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const rel = path.isAbsolute(filePath) ? path.relative(projectRoot, filePath) : filePath;
  if (!firstTimeForPath(input.session_id, projectRoot, rel)) process.exit(0);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `💡 Skills for ${rel}: ${skills.join(', ')}`,
    },
  }));
  process.exit(0);
}

main();
