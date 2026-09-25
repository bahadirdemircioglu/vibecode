'use strict';

// Tests for .vibecode/scripts/vibe-init.js — run: node --test .vibecode/scripts/tests/

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PLUGIN = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(PLUGIN, '.vibecode', 'scripts', 'vibe-init.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-init-'));
const run = (root, ...args) => {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync('node', [SCRIPT, '--root', root, ...args], { encoding: 'utf-8', env });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
};
const read = (root, p) => fs.readFileSync(path.join(root, p), 'utf-8');
const json = (root, p) => JSON.parse(read(root, p));
const write = (root, p, text) => {
  fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
  fs.writeFileSync(path.join(root, p), text);
};
const copyFromPlugin = (root, from, to) => write(root, to, fs.readFileSync(path.join(PLUGIN, from), 'utf-8'));

test('empty project: skeleton, settings, gitignore, local memory setting, serena config', () => {
  const root = tmp();
  const r = run(root);
  assert.strictEqual(r.code, 0, r.stderr);
  for (const p of ['.vibecode/memory/MEMORY.md', 'docs/CHANGELOG.md', 'docs/CHANGELOG_INTERNAL.md', 'docs/decisions.md',
    'docs/progress.md', 'docs/architecture/INDEX.md', 'docs/constraints/.gitkeep', '.serena/project.yml']) {
    assert.ok(fs.existsSync(path.join(root, p)), p);
  }
  const s = json(root, '.claude/settings.json');
  assert.deepStrictEqual(s.extraKnownMarketplaces.vibecode, { source: { source: 'github', repo: 'bahadirdemircioglu/vibecode' } });
  assert.strictEqual(s.enabledPlugins['vibecode@vibecode'], true);
  assert.ok(s.permissions.deny.includes('Bash(rm -rf *)'));
  assert.strictEqual(json(root, '.claude/settings.local.json').autoMemoryDirectory, path.join(root, '.vibecode', 'memory'));
  assert.match(read(root, '.gitignore'), /^\.vibecode\/state\/$/m);
  assert.match(read(root, '.serena/project.yml'), new RegExp(`project_name: "${path.basename(root)}"`));
  assert.match(r.stdout, /^NEXT: review `git status`/m);
});

test('idempotent: a second run changes nothing', () => {
  const root = tmp();
  run(root);
  const before = execFileSync('find', [root, '-type', 'f', '-exec', 'sha256sum', '{}', '+'], { encoding: 'utf-8' });
  const r = run(root);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /^(CREATED|UPDATED)/m);
  assert.strictEqual(execFileSync('find', [root, '-type', 'f', '-exec', 'sha256sum', '{}', '+'], { encoding: 'utf-8' }), before);
});

test('existing project files and settings are preserved; permissions merged without duplicates', () => {
  const root = tmp();
  write(root, 'docs/CHANGELOG.md', '# My changelog\n');
  write(root, '.gitignore', 'node_modules/\n.vibecode/state/');
  write(root, '.claude/settings.json', JSON.stringify({
    model: 'sonnet',
    permissions: { allow: ['Bash(npm run build)', 'Bash(git status*)'] },
    enabledPlugins: { 'other@x': true },
  }));
  const r = run(root);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.strictEqual(read(root, 'docs/CHANGELOG.md'), '# My changelog\n');
  const s = json(root, '.claude/settings.json');
  assert.strictEqual(s.model, 'sonnet');
  assert.strictEqual(s.enabledPlugins['other@x'], true);
  assert.strictEqual(s.permissions.allow[0], 'Bash(npm run build)');
  assert.strictEqual(s.permissions.allow.filter((a) => a === 'Bash(git status*)').length, 1);
  const gi = read(root, '.gitignore');
  assert.ok(gi.startsWith('node_modules/\n.vibecode/state/\n'), gi);
  assert.strictEqual(gi.match(/^\.vibecode\/state\/$/gm).length, 1);
});

test('plugin explicitly disabled in project settings → left disabled, WARN', () => {
  const root = tmp();
  write(root, '.claude/settings.json', JSON.stringify({ enabledPlugins: { 'vibecode@vibecode': false } }));
  const r = run(root);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.strictEqual(json(root, '.claude/settings.json').enabledPlugins['vibecode@vibecode'], false);
  assert.match(r.stdout, /^WARN .*disables vibecode@vibecode/m);
});

test('invalid settings.json → exit 1 and the file is not rewritten', () => {
  const root = tmp();
  write(root, '.claude/settings.json', '{ broken');
  const r = run(root);
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /not a valid JSON object/);
  assert.strictEqual(read(root, '.claude/settings.json'), '{ broken');
});

test('usage errors → exit 2', () => {
  const root = tmp();
  assert.strictEqual(run(root, '--all').code, 2);
  assert.strictEqual(run(root, '--bogus').code, 2);
  assert.strictEqual(run(path.join(root, 'nope')).code, 2);
});

function legacyProject() {
  const root = tmp();
  copyFromPlugin(root, 'commands/vibe-go.md', '.claude/commands/vibe-go.md');                // same
  write(root, '.claude/commands/vibe-update.md', 'old\n');                                     // no plugin twin
  copyFromPlugin(root, 'agents/engineer.md', '.claude/agents/engineer.md');
  fs.appendFileSync(path.join(root, '.claude/agents/engineer.md'), '\ncustomized\n');           // differs
  copyFromPlugin(root, '.vibecode/standards/backend.md', '.vibecode/standards/backend.md');    // same
  write(root, '.vibecode/VERSION', 'abc\n');                                                    // obsolete
  write(root, '.claude/commands/my-own.md', 'mine\n');                                          // user's own
  write(root, '.claude/settings.json', JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.sh' }] }],
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/permission-policy.js' }] },
        { matcher: 'Write', hooks: [{ type: 'command', command: './my-hook.sh' }] },
      ],
    },
  }));
  write(root, '.mcp.json', JSON.stringify({ mcpServers: { serena: { command: 'uvx' }, context7: { command: 'npx' }, mine: { command: 'x' } } }));
  write(root, 'CLAUDE.md', '# CLAUDE.md\n\n> Entry point. Detailed rules live in `.vibecode/standards/`\n');
  return root;
}

test('legacy install: report mode lists everything and removes nothing', () => {
  const root = legacyProject();
  const r = run(root);
  assert.strictEqual(r.code, 0, r.stderr);
  assert.match(r.stdout, /^LEGACY same \.claude\/commands\/vibe-go\.md$/m);
  assert.match(r.stdout, /^LEGACY obsolete \.claude\/commands\/vibe-update\.md$/m);
  assert.match(r.stdout, /^LEGACY differs \.claude\/agents\/engineer\.md$/m);
  assert.match(r.stdout, /^LEGACY same \.vibecode\/standards\/backend\.md$/m);
  assert.match(r.stdout, /^LEGACY obsolete \.vibecode\/VERSION$/m);
  assert.match(r.stdout, /^LEGACY \.claude\/settings\.json: 2 hook entries/m);
  assert.match(r.stdout, /^LEGACY \.mcp\.json: serena, context7/m);
  assert.match(r.stdout, /^LEGACY CLAUDE\.md/m);
  assert.doesNotMatch(r.stdout, /my-own/);
  assert.match(r.stdout, /^NEXT: legacy clone-based files found/m);
  assert.ok(fs.existsSync(path.join(root, '.claude/commands/vibe-go.md')));
  assert.strictEqual(json(root, '.claude/settings.json').hooks.SessionStart.length, 1);
});

test('legacy install: --migrate removes same/obsolete + hook wiring + MCP dupes, keeps differing and user files', () => {
  const root = legacyProject();
  const r = run(root, '--migrate');
  assert.strictEqual(r.code, 0, r.stderr);
  for (const p of ['.claude/commands/vibe-go.md', '.claude/commands/vibe-update.md', '.vibecode/standards', '.vibecode/VERSION']) {
    assert.ok(!fs.existsSync(path.join(root, p)), `${p} should be removed`);
  }
  assert.ok(fs.existsSync(path.join(root, '.claude/agents/engineer.md')));
  assert.match(r.stdout, /^KEPT differs \.claude\/agents\/engineer\.md/m);
  assert.strictEqual(read(root, '.claude/commands/my-own.md'), 'mine\n');
  const s = json(root, '.claude/settings.json');
  assert.strictEqual(s.hooks.SessionStart, undefined);
  assert.deepStrictEqual(s.hooks.PreToolUse.map((e) => e.matcher), ['Write']);
  assert.deepStrictEqual(Object.keys(json(root, '.mcp.json').mcpServers), ['mine']);
  assert.ok(fs.existsSync(path.join(root, 'CLAUDE.md')), 'CLAUDE.md is never removed automatically');

  const r2 = run(root, '--migrate', '--all');
  assert.strictEqual(r2.code, 0, r2.stderr);
  assert.ok(!fs.existsSync(path.join(root, '.claude/agents')), 'emptied legacy dir removed');
});

test('running inside the plugin repo itself never reports its own framework as legacy', () => {
  // Work on a COPY of the plugin tree — never on the real repo.
  const copy = path.join(tmp(), 'vibecode');
  for (const d of ['commands', 'agents', 'hooks', '.vibecode/templates', '.vibecode/rules', '.vibecode/standards', '.vibecode/scripts']) {
    fs.cpSync(path.join(PLUGIN, d), path.join(copy, d), { recursive: true });
  }
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync('node', [path.join(copy, '.vibecode', 'scripts', 'vibe-init.js'), '--root', copy], { encoding: 'utf-8', env });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /^LEGACY/m);
  assert.ok(fs.existsSync(path.join(copy, '.vibecode', 'standards', 'backend.md')), 'own framework untouched');
});
