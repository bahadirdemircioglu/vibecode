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
 * 3. Path rules — a plugin cannot ship `.claude/rules/`, so the framework's
 *    path-scoped rules live in <plugin>/.vibecode/rules/*.md (same `paths:`
 *    frontmatter). The first write matching a rule injects its body, ONCE per
 *    rule per session (same state file).
 *
 * Bash commands are gated separately by permission-policy.js.
 *
 * Input:  JSON from stdin (Claude Code hook protocol)
 * Output: exit 2 + stderr to BLOCK; otherwise exit 0 with optional
 *         hookSpecificOutput.additionalContext.
 */

const { isVibecodeProject } = require('./vibecode-project.js');
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


// --- Path rules (<plugin>/.vibecode/rules/*.md) ---
const RULES_DIR = path.join(process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..'), '.vibecode', 'rules');

// Minimal glob → RegExp: `**/` = zero or more dirs, `**` = anything, `*` = one segment's chars, `?` = one char.
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

// Parse `paths: [..]` frontmatter; unreadable/malformed rule files are skipped.
function loadRules(dir = RULES_DIR) {
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort(); } catch { return []; }
  const rules = [];
  for (const f of files) {
    try {
      const text = fs.readFileSync(path.join(dir, f), 'utf-8');
      const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!m) continue;
      const pm = m[1].match(/^paths:\s*(\[.*\])\s*$/m);
      if (!pm) continue;
      const paths = JSON.parse(pm[1]);
      if (!Array.isArray(paths) || paths.length === 0) continue;
      rules.push({ name: f.replace(/\.md$/, ''), paths, res: paths.map(globToRegExp), body: m[2].trim() });
    } catch { /* skip malformed rule */ }
  }
  return rules;
}

function matchingRules(relPath, rules = loadRules()) {
  const p = String(relPath).split(path.sep).join('/');
  if (p.startsWith('../')) return []; // outside the project
  return rules.filter((r) => r.res.some((re) => re.test(p)));
}

async function main() {
  if (!isVibecodeProject()) process.exit(0); // plugin enabled, but not a vibecode project
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

  // --- Layers 2+3: skill hint + path rules (Write/Edit/NotebookEdit only) ---
  if (!['Write', 'Edit', 'NotebookEdit'].includes(toolName)) process.exit(0);
  const filePath = String(toolInput.file_path || toolInput.notebook_path || toolInput.path || '');
  if (!filePath) process.exit(0);

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const rel = path.isAbsolute(filePath) ? path.relative(projectRoot, filePath) : filePath;
  const parts = [];

  const skills = suggestSkills(filePath);
  if (skills.length > 0 && firstTimeForPath(input.session_id, projectRoot, rel)) {
    parts.push(`💡 Skills for ${rel}: ${skills.join(', ')}`);
  }
  for (const rule of matchingRules(rel)) {
    if (firstTimeForPath(input.session_id, projectRoot, `rule:${rule.name}`)) {
      parts.push(`📏 vibecode rule "${rule.name}" (applies to ${rule.paths.join(', ')}):\n${rule.body}`);
    }
  }
  if (parts.length === 0) process.exit(0);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: parts.join('\n\n'),
    },
  }));
  process.exit(0);
}

if (require.main === module) main();

module.exports = { globToRegExp, loadRules, matchingRules, suggestSkills };
