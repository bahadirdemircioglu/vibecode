'use strict';

// Plugin hook behaviour — run: node --test .vibecode/scripts/tests/

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '..', '..', '..');
const HOOKS = path.join(PLUGIN, 'hooks');
const { matchingRules, globToRegExp } = require(path.join(HOOKS, 'pre-tool-use.js'));

function project(vibecode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-hooks-'));
  if (vibecode) fs.mkdirSync(path.join(root, '.vibecode'));
  return root;
}

function hook(script, root, input) {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: root, CLAUDE_PLUGIN_ROOT: PLUGIN };
  delete env.VIBE_YOLO;
  const cmd = script.endsWith('.sh') ? 'bash' : 'node';
  const r = spawnSync(cmd, [path.join(HOOKS, script)], { input: JSON.stringify(input), encoding: 'utf-8', env, cwd: root });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const bash = (command) => ({ session_id: 's1', tool_name: 'Bash', tool_input: { command } });
const write = (root, rel) => ({ session_id: 's1', tool_name: 'Write', tool_input: { file_path: path.join(root, rel), content: 'x' } });

test('non-vibecode project: every hook is silent and allows', () => {
  const root = project(false);
  assert.deepStrictEqual(hook('permission-policy.js', root, bash('rm -rf /tmp/x')), { code: 0, stdout: '', stderr: '' });
  assert.deepStrictEqual(hook('pre-tool-use.js', root, write(root, 'backend/src/api/a.py')), { code: 0, stdout: '', stderr: '' });
  assert.deepStrictEqual(hook('notification.js', root, { session_id: 's1' }), { code: 0, stdout: '', stderr: '' });
  const s = hook('session-start.sh', root, {});
  assert.strictEqual(s.code, 0);
  assert.strictEqual(s.stdout, '');
});

test('vibecode project: destructive Bash is blocked with exit 2', () => {
  const root = project(true);
  const r = hook('permission-policy.js', root, bash('rm -rf /tmp/x'));
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /BLOCKED/);
  assert.strictEqual(hook('permission-policy.js', root, bash('ls -la')).code, 0);
});

test('vibecode project: path rule injected once per session, skill hint once per path', () => {
  const root = project(true);
  const first = hook('pre-tool-use.js', root, write(root, 'backend/src/api/users.py'));
  assert.strictEqual(first.code, 0, first.stderr);
  const ctx = JSON.parse(first.stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /vibecode rule "backend-api"/);
  assert.match(ctx, /Route handlers must be \*\*thin\*\*/);
  assert.match(ctx, /Skills for backend\/src\/api\/users\.py/);

  const other = hook('pre-tool-use.js', root, write(root, 'backend/src/api/items.py'));
  const ctx2 = JSON.parse(other.stdout).hookSpecificOutput.additionalContext;
  assert.doesNotMatch(ctx2, /vibecode rule/, 'rule already shown this session');
  assert.match(ctx2, /Skills for backend\/src\/api\/items\.py/);

  assert.strictEqual(hook('pre-tool-use.js', root, write(root, 'backend/src/api/items.py')).stdout, '');
});

test('session start in a vibecode project injects the core rules with the real plugin root', () => {
  const root = project(true);
  const r = hook('session-start.sh', root, {});
  assert.strictEqual(r.code, 0, r.stderr);
  assert.match(r.stdout, /# vibecode — core rules/);
  assert.ok(r.stdout.includes(`**Framework root:** \`${PLUGIN}\``));
  assert.doesNotMatch(r.stdout, /\{\{VIBECODE_ROOT\}\}/);
});

test('session start flags a legacy clone-based install', () => {
  const root = project(true);
  fs.mkdirSync(path.join(root, '.vibecode', 'standards'));
  assert.match(hook('session-start.sh', root, {}).stdout, /^LEGACY: .*\/vibecode:init/m);
});

test('rule globs', () => {
  const names = (p) => matchingRules(p).map((r) => r.name);
  assert.deepStrictEqual(names('backend/src/api/users.py'), ['backend-api']);
  assert.deepStrictEqual(names('frontend/src/a/b.test.tsx'), ['tests']);
  assert.deepStrictEqual(names('frontend/src/a.spec.ts'), ['tests']);
  assert.deepStrictEqual(names('docker-compose.yml'), ['docker']);
  assert.deepStrictEqual(names('sub/Dockerfile'), []);
  assert.deepStrictEqual(names('../outside/backend/src/api/x.py'), []);
  assert.ok(globToRegExp('a/**/b.md').test('a/b.md'));
  assert.ok(globToRegExp('a/**/b.md').test('a/x/y/b.md'));
  assert.ok(!globToRegExp('a/*.md').test('a/x/b.md'));
});
