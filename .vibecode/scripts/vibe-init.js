#!/usr/bin/env node
/**
 * vibe-init — set up (or migrate) a project for the vibecode plugin. Run by /vibecode:init.
 *
 * Usage: node vibe-init.js [--root DIR] [--migrate [--all]]
 *
 * Idempotent and non-destructive by default: it only CREATES missing files and MERGES settings.
 *   1. Project skeleton from the plugin templates (never overwrites):
 *      .vibecode/memory/MEMORY.md, docs/{CHANGELOG,CHANGELOG_INTERNAL,decisions,progress}.md,
 *      docs/architecture/INDEX.md, docs/constraints/
 *   2. .gitignore — appends the missing vibecode lines
 *   3. .claude/settings.json — union of the framework permissions, plus
 *      extraKnownMarketplaces.vibecode + enabledPlugins["vibecode@vibecode"] so a fresh clone
 *      (e.g. after a server rebuild) offers the plugin again
 *   4. .claude/settings.local.json — autoMemoryDirectory → <root>/.vibecode/memory (absolute, per machine)
 *   5. .serena/project.yml from the template when missing (per machine, gitignored)
 *   6. Legacy (clone-based) framework copies are REPORTED: `LEGACY same|differs <path>`.
 *      --migrate removes the `same` ones (identical to the plugin), the vibecode hook entries in
 *      .claude/settings.json and the serena/context7 entries in .mcp.json; --all also removes
 *      files that differ from the plugin (otherwise they are kept and act as project overrides).
 *
 * Output: one line per action (CREATED / UPDATED / OK / LEGACY / REMOVED / KEPT / WARN), last line `NEXT: ...`.
 * Exit codes: 0 OK, 1 error (e.g. invalid JSON in a settings file — nothing written to it), 2 usage.
 * Env: VIBECODE_MARKETPLACE_REPO (default bahadirdemircioglu/vibecode).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATES = path.join(PLUGIN_ROOT, '.vibecode', 'templates');
const MARKETPLACE_REPO = process.env.VIBECODE_MARKETPLACE_REPO || 'bahadirdemircioglu/vibecode';
const PLUGIN_ID = 'vibecode@vibecode';

const SKELETON = [
  ['docs/CHANGELOG.md', 'docs-CHANGELOG.md'],
  ['docs/CHANGELOG_INTERNAL.md', 'docs-CHANGELOG_INTERNAL.md'],
  ['docs/decisions.md', 'docs-decisions.md'],
  ['docs/progress.md', 'docs-progress.md'],
  ['docs/architecture/INDEX.md', 'architecture-INDEX.md'],
];
const MEMORY_INDEX = '<!-- Project memory index (Claude auto memory, committed with the repo). One line per memory: - [Title](file.md) — hook -->\n';
const GITIGNORE_LINES = [
  '.serena/*',
  '!.serena/memories/',
  '.vibecode/state/',
  '.vibecode/sdd/',
  '.vibecode/providers.env',
  '.claude/settings.local.json',
];
// Framework directories a clone-based install copied into the project.
const LEGACY_DIRS = ['standards', 'skills', 'templates', 'scripts', 'prompts'];
// Hook scripts older clone-based versions shipped (current ones are read from the plugin).
const LEGACY_HOOK_EXTRA = ['statusline.sh', 'scaffold.sh', 'skill-hint.js'];
const LEGACY_COMMAND_EXTRA = ['vibe-update.md', 'vibe-goal.md'];

const out = [];
const log = (tag, msg) => out.push(`${tag} ${msg}`);

function parseArgs(argv) {
  const a = { root: process.env.CLAUDE_PROJECT_DIR || process.cwd(), migrate: false, all: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--root') a.root = argv[++i];
    else if (t === '--migrate') a.migrate = true;
    else if (t === '--all') a.all = true;
    else throw new UsageError(`unknown argument: ${t}`);
  }
  if (!a.root) throw new UsageError('--root needs a directory');
  if (a.all && !a.migrate) throw new UsageError('--all only makes sense with --migrate');
  return a;
}

class UsageError extends Error {}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf-8');
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch { /* fall through */ }
  throw new Error(`${file} is not a valid JSON object — fix it and re-run (nothing was written to it)`);
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

const rel = (root, p) => path.relative(root, p) || '.';

function createIfMissing(root, relPath, content) {
  const file = path.join(root, relPath);
  if (fs.existsSync(file)) { log('OK', relPath); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  log('CREATED', relPath);
}

function skeleton(root) {
  createIfMissing(root, '.vibecode/memory/MEMORY.md', MEMORY_INDEX);
  for (const [dst, tpl] of SKELETON) {
    createIfMissing(root, dst, fs.readFileSync(path.join(TEMPLATES, tpl), 'utf-8'));
  }
  const constraints = path.join(root, 'docs', 'constraints');
  if (fs.existsSync(constraints)) log('OK', 'docs/constraints/');
  else createIfMissing(root, 'docs/constraints/.gitkeep', '');
}

function gitignore(root) {
  const file = path.join(root, '.gitignore');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  const have = new Set(text.split(/\r?\n/).map((l) => l.trim()));
  const missing = GITIGNORE_LINES.filter((l) => !have.has(l));
  if (missing.length === 0) { log('OK', '.gitignore'); return; }
  const sep = text === '' || text.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(file, `${text}${sep}${text ? '\n' : ''}# vibecode (runtime state, per-machine config, secrets)\n${missing.join('\n')}\n`);
  log(text ? 'UPDATED' : 'CREATED', `.gitignore (+${missing.length} lines)`);
}

function isVibecodeHookEntry(entry) {
  return (entry.hooks || []).some((h) => /\.claude\/hooks\//.test(String(h.command || '')));
}

function settings(root, migrate) {
  const file = path.join(root, '.claude', 'settings.json');
  const s = readJson(file);
  const tpl = readJson(path.join(TEMPLATES, 'claude-settings.json'));
  const changes = [];

  s.permissions = s.permissions || {};
  for (const kind of ['allow', 'deny']) {
    const cur = Array.isArray(s.permissions[kind]) ? s.permissions[kind] : [];
    const add = (tpl.permissions?.[kind] || []).filter((r) => !cur.includes(r));
    if (add.length) { s.permissions[kind] = [...cur, ...add]; changes.push(`+${add.length} ${kind}`); }
  }

  s.extraKnownMarketplaces = s.extraKnownMarketplaces || {};
  if (!s.extraKnownMarketplaces.vibecode) {
    s.extraKnownMarketplaces.vibecode = { source: { source: 'github', repo: MARKETPLACE_REPO } };
    changes.push('marketplace');
  }
  s.enabledPlugins = s.enabledPlugins || {};
  if (s.enabledPlugins[PLUGIN_ID] === false) {
    log('WARN', `.claude/settings.json disables ${PLUGIN_ID} — left as is`);
  } else if (s.enabledPlugins[PLUGIN_ID] !== true) {
    s.enabledPlugins[PLUGIN_ID] = true;
    changes.push('enabledPlugins');
  }

  // Legacy hook wiring (clone-based install) — duplicates the plugin's hooks.
  let legacyHooks = 0;
  for (const [event, entries] of Object.entries(s.hooks || {})) {
    if (!Array.isArray(entries)) continue;
    const keep = entries.filter((e) => !isVibecodeHookEntry(e));
    const n = entries.length - keep.length;
    if (!n) continue;
    legacyHooks += n;
    if (migrate) {
      if (keep.length) s.hooks[event] = keep; else delete s.hooks[event];
    }
  }
  if (legacyHooks) {
    if (migrate) {
      if (s.hooks && Object.keys(s.hooks).length === 0) delete s.hooks;
      changes.push(`-${legacyHooks} legacy hook entries`);
      log('REMOVED', `.claude/settings.json: ${legacyHooks} legacy vibecode hook entries`);
    } else {
      log('LEGACY', `.claude/settings.json: ${legacyHooks} hook entries point at .claude/hooks/ (duplicates the plugin)`);
    }
  }

  if (changes.length) {
    const existed = fs.existsSync(file);
    writeJson(file, s);
    log(existed ? 'UPDATED' : 'CREATED', `.claude/settings.json (${changes.join(', ')})`);
  } else {
    log('OK', '.claude/settings.json');
  }
}

function localSettings(root) {
  const file = path.join(root, '.claude', 'settings.local.json');
  const s = readJson(file);
  const mem = path.join(root, '.vibecode', 'memory');
  if (s.autoMemoryDirectory === mem) { log('OK', '.claude/settings.local.json'); return; }
  s.autoMemoryDirectory = mem;
  writeJson(file, s);
  log('UPDATED', '.claude/settings.local.json (autoMemoryDirectory → .vibecode/memory, active next session)');
}

function serena(root) {
  const file = path.join(root, '.serena', 'project.yml');
  if (fs.existsSync(file)) { log('OK', '.serena/project.yml'); return; }
  const tpl = fs.readFileSync(path.join(TEMPLATES, 'serena-project.yml'), 'utf-8');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, tpl.split('{{PROJECT_NAME}}').join(path.basename(root)));
  log('CREATED', '.serena/project.yml (check `languages:` — restart the session for Serena)');
}

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function walk(dir) {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else if (e.isFile()) files.push(p);
  }
  return files;
}

// [projectFile, pluginFile|null] pairs of a clone-based install.
function legacyCandidates(root) {
  const pairs = [];
  const add = (projFile, plugFile) => { if (fs.existsSync(projFile)) pairs.push([projFile, plugFile]); };
  const names = (dir) => { try { return fs.readdirSync(dir); } catch { return []; } };

  for (const n of [...names(path.join(PLUGIN_ROOT, 'commands')), ...LEGACY_COMMAND_EXTRA]) {
    add(path.join(root, '.claude', 'commands', n), path.join(PLUGIN_ROOT, 'commands', n));
  }
  for (const n of names(path.join(PLUGIN_ROOT, 'agents'))) {
    add(path.join(root, '.claude', 'agents', n), path.join(PLUGIN_ROOT, 'agents', n));
  }
  for (const n of [...names(path.join(PLUGIN_ROOT, 'hooks')), ...LEGACY_HOOK_EXTRA]) {
    add(path.join(root, '.claude', 'hooks', n), path.join(PLUGIN_ROOT, 'hooks', n));
  }
  for (const n of names(path.join(PLUGIN_ROOT, '.vibecode', 'rules'))) {
    add(path.join(root, '.claude', 'rules', n), path.join(PLUGIN_ROOT, '.vibecode', 'rules', n));
  }
  for (const d of LEGACY_DIRS) {
    const projDir = path.join(root, '.vibecode', d);
    if (!fs.existsSync(projDir)) continue;
    for (const f of walk(projDir)) add(f, path.join(PLUGIN_ROOT, '.vibecode', d, path.relative(projDir, f)));
  }
  add(path.join(root, '.vibecode', 'VERSION'), null);
  return pairs;
}

function removeEmptyDirs(root, dirs) {
  for (const d of dirs.sort((a, b) => b.length - a.length)) {
    try {
      if (d.startsWith(root + path.sep) && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
    } catch { /* ignore */ }
  }
}

function legacy(root, migrate, all) {
  const touchedDirs = new Set();
  let found = 0;
  for (const [proj, plug] of legacyCandidates(root)) {
    found++;
    const same = plug && fs.existsSync(plug) && sha(proj) === sha(plug);
    const kind = plug === null || !fs.existsSync(plug) ? 'obsolete' : same ? 'same' : 'differs';
    const r = rel(root, proj);
    if (!migrate) { log('LEGACY', `${kind} ${r}`); continue; }
    if (kind === 'differs' && !all) { log('KEPT', `differs ${r} (project override — re-run with --migrate --all to remove)`); continue; }
    fs.rmSync(proj);
    log('REMOVED', `${kind} ${r}`);
    for (let d = path.dirname(proj); d.startsWith(root + path.sep); d = path.dirname(d)) touchedDirs.add(d);
  }
  if (migrate) removeEmptyDirs(root, [...touchedDirs]);

  // .mcp.json: serena/context7 now come from the plugin.
  const mcpFile = path.join(root, '.mcp.json');
  if (fs.existsSync(mcpFile)) {
    const mcp = readJson(mcpFile);
    const dup = ['serena', 'context7'].filter((k) => mcp.mcpServers && mcp.mcpServers[k]);
    if (dup.length) {
      found++;
      if (!migrate) log('LEGACY', `.mcp.json: ${dup.join(', ')} (the plugin provides them)`);
      else {
        for (const k of dup) delete mcp.mcpServers[k];
        if (Object.keys(mcp.mcpServers).length === 0 && Object.keys(mcp).length === 1) {
          fs.rmSync(mcpFile);
          log('REMOVED', '.mcp.json');
        } else {
          writeJson(mcpFile, mcp);
          log('UPDATED', `.mcp.json (-${dup.join(', ')})`);
        }
      }
    }
  }

  // CLAUDE.md copied from the vibecode template — never touched automatically.
  const claudeMd = path.join(root, 'CLAUDE.md');
  if (fs.existsSync(claudeMd) && /Detailed rules live in `\.vibecode\/standards\/`/.test(fs.readFileSync(claudeMd, 'utf-8'))) {
    found++;
    log('LEGACY', 'CLAUDE.md is the vibecode template copy — the plugin now injects these rules; trim it to project-specific notes (manual)');
  }
  return found;
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`vibe-init: ${e.message}\nUsage: node vibe-init.js [--root DIR] [--migrate [--all]]\n`);
    return 2;
  }
  const root = path.resolve(args.root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    process.stderr.write(`vibe-init: not a directory: ${root}\n`);
    return 2;
  }
  const selfInit = fs.realpathSync(root) === fs.realpathSync(PLUGIN_ROOT);
  try {
    skeleton(root);
    gitignore(root);
    settings(root, args.migrate);
    localSettings(root);
    serena(root);
    const legacyCount = selfInit ? 0 : legacy(root, args.migrate, args.all);
    const next = legacyCount && !args.migrate
      ? 'legacy clone-based files found — review the LEGACY lines, then re-run with --migrate'
      : 'review `git status`, then commit (docs/, .gitignore, .claude/settings.json, .vibecode/memory/)';
    for (const l of out) console.log(l);
    console.log(`NEXT: ${next}`);
    return 0;
  } catch (e) {
    for (const l of out) console.log(l);
    process.stderr.write(`vibe-init: ${e.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { main };
