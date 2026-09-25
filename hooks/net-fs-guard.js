#!/usr/bin/env node

/**
 * Net / FS Guard Hook — SSRF + Symlink + System-Path Containment
 *
 * Adapted from WrongStack's `packages/tools/src/fetch.ts` (SSRF guard),
 * `replace.ts` (symlink containment) and `_env.ts` (secret-env hygiene),
 * mapped onto Claude Code's PreToolUse hook protocol.
 *
 * Guards three things, fail-closed (exit code 2 blocks the tool):
 *
 *   1. WebFetch → SSRF: refuse non-http(s) schemes and any host that
 *      resolves to a private/loopback/link-local range (cloud metadata,
 *      127.0.0.1, 10/8, 192.168/16, 169.254.169.254, ::1, fc00::/7, ...).
 *      Escape hatch: VIBE_ALLOW_PRIVATE_FETCH=1 (e.g. testing a local API).
 *
 *   2. Write / Edit → System-path containment: refuse writes into
 *      protected system directories (/etc, /usr, /bin, /boot, /sys, ...).
 *      Does NOT block /tmp, the project, or ~/.claude (memory writes stay OK).
 *
 *   3. Write / Edit → Symlink escape: refuse writing THROUGH a symlink whose
 *      real target lands outside both the project root and the home dir.
 *
 * Wiring: NOT registered in hooks.json on its own. `hooks/pre-tool-use.js`
 * require()s this module and calls checkWrite()/checkWebFetch() in the SAME node
 * process (one process per Write/Edit instead of three). It still runs standalone
 * for piped-JSON testing:  echo '{"tool_name":"Write",...}' | node net-fs-guard.js
 *
 * Input:  JSON on stdin (Claude Code hook protocol)
 * Output: exit 2 + stderr to BLOCK, or exit 0 to ALLOW
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dns = require('node:dns');
const net = require('node:net');

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

// check*() functions RETURN a block reason (string) or null — they never exit,
// so a caller can combine them with other checks in one process.

// ---- SSRF: private/loopback/link-local IP detection ----
function ipv4IsPrivate(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  if (a === 0) return true;                         // 0.0.0.0/8
  if (a === 10) return true;                        // 10/8
  if (a === 127) return true;                       // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true;          // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true;          // 192.168/16
  if (a === 192 && b === 0 && p[2] === 0) return true; // 192.0.0/24
  if (a >= 224) return true;                         // multicast + reserved
  return false;
}

function ipv6IsPrivate(ip) {
  const x = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (x === '::' || x === '::1') return true;        // unspecified / loopback
  if (x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb')) return true; // fe80::/10
  if (x.startsWith('fc') || x.startsWith('fd')) return true; // fc00::/7 unique-local
  if (x.startsWith('ff')) return true;               // multicast
  const mapped = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);       // IPv4-mapped
  return false;
}

function hostnameLooksInternal(host) {
  const h = host.toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost') ||
         h.endsWith('.local') || h.endsWith('.internal') ||
         h === 'metadata.google.internal';
}

function resolveAll(host) {
  return new Promise((resolve) => {
    dns.lookup(host, { all: true }, (err, addrs) => {
      if (err || !addrs) return resolve([]);
      resolve(addrs.map((a) => a.address));
    });
  });
}

async function checkWebFetch(input) {
  if (process.env.VIBE_ALLOW_PRIVATE_FETCH === '1') return null;
  const raw = String((input && input.url) || '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null; // not a parseable URL — let normal flow handle it
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `disallowed URL scheme "${url.protocol}" (only http/https). URL: ${raw}`;
  }
  const host = url.hostname;
  if (hostnameLooksInternal(host)) {
    return `internal hostname "${host}". Set VIBE_ALLOW_PRIVATE_FETCH=1 to allow local targets.`;
  }
  // Direct IP literal
  if (net.isIP(host) === 4 && ipv4IsPrivate(host)) return `private/loopback IPv4 ${host}.`;
  if (net.isIP(host) === 6 && ipv6IsPrivate(host)) return `private/loopback IPv6 ${host}.`;
  // DNS resolution (best-effort anti-rebinding)
  if (net.isIP(host) === 0) {
    const addrs = await resolveAll(host);
    for (const ip of addrs) {
      if (net.isIP(ip) === 4 && ipv4IsPrivate(ip)) return `"${host}" resolves to private IPv4 ${ip}.`;
      if (net.isIP(ip) === 6 && ipv6IsPrivate(ip)) return `"${host}" resolves to private IPv6 ${ip}.`;
    }
  }
  return null;
}

// ---- FS containment ----
const PROTECTED_DIRS = ['/etc', '/usr', '/bin', '/sbin', '/boot', '/sys', '/proc', '/dev', '/lib', '/lib64', '/var/lib', '/root/.ssh'];

function checkWrite(input) {
  const fp = String((input && (input.file_path || input.notebook_path || input.path)) || '');
  if (!fp) return null;
  const abs = path.resolve(fp);

  for (const d of PROTECTED_DIRS) {
    if (abs === d || abs.startsWith(d + path.sep)) {
      return `write into protected system path: ${abs}`;
    }
  }

  // Symlink escape: if the target (or an existing ancestor) is a symlink whose
  // real path leaves both the project root and the home dir, refuse.
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const home = os.homedir();
  try {
    let probe = abs;
    while (probe && probe !== path.dirname(probe) && !fs.existsSync(probe)) {
      probe = path.dirname(probe); // walk up to nearest existing ancestor
    }
    if (fs.existsSync(probe)) {
      const real = fs.realpathSync(probe);
      const lst = fs.lstatSync(probe);
      const escapes = !real.startsWith(projectRoot) && !real.startsWith(home) && !real.startsWith('/tmp');
      if (lst.isSymbolicLink() && escapes) {
        return `write through a symlink that escapes the workspace: ${probe} → ${real}`;
      }
    }
  } catch {
    // stat/realpath failure — do not block on uncertainty
  }
  return null;
}

// Single entry point used by pre-tool-use.js and the standalone CLI.
async function checkTool(toolName, toolInput) {
  if (toolName === 'WebFetch') return checkWebFetch(toolInput || {});
  if (toolName === 'Write' || toolName === 'Edit' || toolName === 'NotebookEdit') return checkWrite(toolInput || {});
  return null;
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0);
  }
  const reason = await checkTool(input.tool_name || '', input.tool_input);
  if (reason) {
    process.stderr.write(`⛔ [net-fs-guard] BLOCKED — ${reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}

module.exports = { checkTool, checkWrite, checkWebFetch };

if (require.main === module) main();
