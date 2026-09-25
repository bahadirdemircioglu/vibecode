'use strict';

// Tests for .vibecode/scripts/install-deps.sh with stub binaries (nothing is really installed).
// run: node --test .vibecode/scripts/tests/

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'install-deps.sh');
const REAL_UTILS = ['bash', 'sh', 'sed', 'grep', 'head', 'tr', 'cat', 'env', 'id', 'dirname', 'basename', 'awk', 'mkdir', 'chmod'];

function which(bin) {
  const r = spawnSync('bash', ['-c', `command -v ${bin}`], { encoding: 'utf-8' });
  return r.stdout.trim();
}

// A sandbox: bin/ with only basic utils + the given stubs, a log file every stub appends to.
function sandbox(stubs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-deps-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(dir, 'home'));
  for (const u of REAL_UTILS) fs.symlinkSync(which(u), path.join(bin, u));
  const log = path.join(dir, 'calls.log');
  fs.writeFileSync(log, '');
  for (const [name, body] of Object.entries(stubs)) {
    fs.writeFileSync(path.join(bin, name), `#!/bin/bash\nBIN="${bin}"\nLOG="${log}"\necho "${name} $*" >> "$LOG"\n${body}\n`, { mode: 0o755 });
  }
  return { dir, bin, log };
}

const NODE22 = 'echo v22.1.0';
const mkNode = (ver) => `printf '#!/bin/bash\\necho ${ver}\\n' > "$BIN/node"; chmod +x "$BIN/node"; printf '#!/bin/bash\\n' > "$BIN/npx"; chmod +x "$BIN/npx"`;
const OK_UVX = { uvx: 'exit 0', uv: 'echo "uv 0.9.0"' };

function run(sb, extraEnv = {}) {
  const r = spawnSync('/bin/bash', [SCRIPT], {
    encoding: 'utf-8',
    env: { PATH: sb.bin, HOME: path.join(sb.dir, 'home'), VIBE_DEPS_UID: '1000', ...extraEnv },
  });
  return { code: r.status, out: r.stdout, log: fs.readFileSync(sb.log, 'utf-8') };
}

test('everything present → OK lines, nothing installed, no RESTART', () => {
  const sb = sandbox({ node: NODE22, npx: '', ...OK_UVX, 'apt-get': '' });
  const r = run(sb);
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /^OK node v22\.1\.0$/m);
  assert.match(r.out, /^OK uv 0\.9\.0$/m);
  assert.match(r.out, /^OK serena/m);
  assert.doesNotMatch(r.out, /RESTART/);
  assert.doesNotMatch(r.log, /apt-get/);
});

test('apt, node missing, distro candidate >= 18 → apt installs nodejs npm, RESTART', () => {
  const sb = sandbox({
    sudo: 'if [[ "$1" == "-n" ]]; then exit 0; fi; exec "$@"',
    'apt-cache': 'echo "nodejs:"; echo "  Candidate: 20.11.0-1"',
    'apt-get': `if [[ " $* " == *" install "* ]]; then ${mkNode('v20.11.0')}; fi`,
    ...OK_UVX,
  });
  const r = run(sb);
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.log, /apt-get install -y -qq nodejs npm/);
  assert.match(r.out, /^INSTALLED node v20\.11\.0 \(via apt-get\)$/m);
  assert.match(r.out, /^RESTART:/m);
});

test('apt, distro node too old → NodeSource setup, then nodejs only', () => {
  const sb = sandbox({
    sudo: 'if [[ "$1" == "-n" ]]; then exit 0; fi; exec "$@"',
    'apt-cache': 'echo "  Candidate: 12.22.9~dfsg-1ubuntu3"',
    curl: 'echo "echo nodesource-setup-ran >> \\"$LOG\\""',
    'apt-get': `if [[ " $* " == *" install "* ]]; then ${mkNode('v22.3.0')}; fi`,
    ...OK_UVX,
  });
  const r = run(sb);
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.log, /curl -fsSL https:\/\/deb\.nodesource\.com\/setup_22\.x/);
  assert.match(r.log, /nodesource-setup-ran/);
  assert.match(r.log, /apt-get install -y -qq nodejs$/m);
  assert.match(r.out, /^INSTALLED node v22\.3\.0/m);
});

test('not root and no passwordless sudo → FAIL with the sudo command, exit 1', () => {
  const sb = sandbox({ 'apt-get': '', ...OK_UVX });
  const r = run(sb);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /^FAIL node: installing system packages needs root — run: sudo bash ".*install-deps\.sh"$/m);
  assert.doesNotMatch(r.log, /apt-get install/);
});

test('uv missing (non-root) → Astral installer into ~/.local/bin, RESTART', () => {
  const sb = sandbox({
    node: NODE22, npx: '', 'apt-get': '',
    curl: 'cat <<\'EOS\'\nmkdir -p "$HOME/.local/bin"\nprintf \'#!/bin/bash\\nexit 0\\n\' > "$HOME/.local/bin/uvx"; chmod +x "$HOME/.local/bin/uvx"\nEOS',
  });
  const r = run(sb);
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.log, /curl -fsSL https:\/\/astral\.sh\/uv\/install\.sh/);
  assert.match(r.out, /^INSTALLED uv at .*\/home\/\.local\/bin\/uvx$/m);
  assert.match(r.out, /^OK serena/m);
  assert.match(r.out, /^RESTART:/m);
});

test('Serena cannot be fetched → FAIL serena, exit 1', () => {
  const sb = sandbox({ node: NODE22, npx: '', uv: 'echo "uv 0.9.0"', uvx: 'exit 1' });
  const r = run(sb);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /^FAIL serena/m);
});
