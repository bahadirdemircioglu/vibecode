// Run: node --test .vibecode/scripts/tests/
// Drives .vibecode/scripts/deepseek-debate.js against a mock DeepSeek server and a
// throwaway project root — no network, no API cost.

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'deepseek-debate.js');

// Mock server: replies are consumed in order; each is {status, content} or a raw object
async function startMock(replies) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.url === '/user/balance') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ balance_infos: [{ currency: 'USD', total_balance: '1.00' }] }));
        return;
      }
      requests.push(JSON.parse(body));
      const next = replies.shift() || { status: 500, content: 'no more replies' };
      if (next.status && next.status !== 200) {
        res.writeHead(next.status);
        res.end(next.content || 'error');
        return;
      }
      const content = typeof next.content === 'string' ? next.content : JSON.stringify(next.content);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { role: 'assistant', content } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, completion_tokens_details: { reasoning_tokens: 5 } },
      }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + server.address().port, requests, close: () => server.close() };
}

function makePlans(enabled = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecode-debate-'));
  fs.mkdirSync(path.join(root, '.vibecode', 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, '.vibecode', 'config', 'ai-providers.json'), JSON.stringify({
    active_provider: 'deepseek',
    max_rounds: 4,
    providers: { deepseek: { enabled, base_url: 'http://unused', chat_path: '/chat/completions', model: 'm', api_key_env: 'DEEPSEEK_API_KEY', timeout_seconds: 30, max_tokens: 1000 } },
  }));
  fs.mkdirSync(path.join(root, 'docs', 'architecture'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'constraints'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'constraints', 'filled.md'), '# Filled\n\nNo Redis.\n');
  fs.writeFileSync(path.join(root, 'docs', 'constraints', 'template.md'), '# Tpl\n\n- DB: [e.g., PostgreSQL 16]\n');
  fs.writeFileSync(path.join(root, 'docs', 'architecture', 'demo-plan.md'),
    '# Architecture Plan: Demo\n\n**Status:** draft\n\n## Overview & Goals\n\nShip\n');
  return root;
}

const PLAN = 'docs/architecture/demo-plan.md';
const debateFile = (root, f) => path.join(root, 'docs', 'architecture', 'debates', f);

function run(args, env, input) {
  return new Promise((resolve) => {
    const child = execFile('node', [SCRIPT, ...args], {
      env: { ...process.env, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'vibecode-home-')), DEEPSEEK_API_KEY: 'test-key', DEBATE_RETRY_DELAY_MS: '10', ...env },
    }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, stdout, stderr });
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

const ledger = (plans) => JSON.parse(fs.readFileSync(debateFile(plans, 'demo.json'), 'utf-8'));
const obj = (o) => ({ file: 'plan.md', section: 'Goals', severity: 'high', objection: o, suggestion: 'fix ' + o });

test('consensus: accept + reject, DeepSeek withdraws → consensus, revision bumped', async () => {
  const mock = await startMock([
    { content: { verdicts: [], new_objections: [obj('A'), obj('B')], summary: 'r1' } },
    { content: { verdicts: [{ id: 'D2', action: 'withdraw', reason: 'convinced' }], new_objections: [], summary: 'r2' } },
  ]);
  const plans = makePlans();
  const env = { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans };
  try {
    let r = await run(['critique', PLAN, '--new'], env);
    assert.strictEqual(r.code, 0, r.stderr);
    assert.match(r.stdout, /NEXT: respond$/m);
    assert.strictEqual(ledger(plans).items.length, 2);

    r = await run(['respond', PLAN, '-'], env, JSON.stringify([
      { id: 'D1', decision: 'accept', response: 'fixed goals' },
      { id: 'D2', decision: 'reject', response: 'out of scope because X' },
    ]));
    assert.strictEqual(r.code, 0, r.stderr);
    assert.match(r.stdout, /NEXT: critique$/m);

    r = await run(['critique', PLAN], env);
    assert.strictEqual(r.code, 0, r.stderr);
    assert.match(r.stdout, /NEXT: done$/m);
    const l = ledger(plans);
    assert.strictEqual(l.status, 'consensus');
    assert.deepStrictEqual(l.items.map((i) => i.status), ['agreed', 'agreed']);
    assert.strictEqual(l.items[0].history.at(-1).action, 'confirm-implicit');
    assert.match(fs.readFileSync(path.join(plans, PLAN), 'utf-8'), /^\*\*Status:\*\* draft\n\*\*Revision:\*\* 1$/m);
    assert.ok(fs.existsSync(debateFile(plans, 'demo.md')));
    // Round 2 prompt must carry Claude's rebuttal to DeepSeek
    assert.match(mock.requests[1].messages[1].content, /out of scope because X/);
    assert.deepStrictEqual(mock.requests[0].response_format, { type: 'json_object' });
  } finally {
    mock.close();
  }
});

test('round limit: maintained objection becomes decided-by-claude', async () => {
  const mock = await startMock([
    { content: { verdicts: [], new_objections: [obj('A')], summary: 'r1' } },
    { content: { verdicts: [{ id: 'D1', action: 'maintain', reason: 'still wrong' }], new_objections: [], summary: 'r2' } },
  ]);
  const plans = makePlans();
  const env = { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans, DEBATE_MAX_ROUNDS: '2' };
  try {
    await run(['critique', PLAN], env);
    await run(['respond', PLAN, '-'], env, JSON.stringify([{ id: 'D1', decision: 'reject', response: 'no' }]));
    await run(['critique', PLAN], env);
    const r = await run(['respond', PLAN, '-'], env, JSON.stringify([{ id: 'D1', decision: 'reject', response: 'still no' }]));
    assert.strictEqual(r.code, 0, r.stderr);
    assert.match(r.stdout, /Open Questions/);
    assert.match(r.stdout, /NEXT: done$/m);
    const l = ledger(plans);
    assert.strictEqual(l.status, 'decided');
    assert.strictEqual(l.items[0].status, 'decided-by-claude');
    assert.strictEqual(l.revision, 2);
  } finally {
    mock.close();
  }
});

test('reopen: DeepSeek rejects an accepted fix', async () => {
  const mock = await startMock([
    { content: { verdicts: [], new_objections: [obj('A')], summary: '' } },
    { content: { verdicts: [{ id: 'D1', action: 'reopen', reason: 'fix incomplete' }], new_objections: [], summary: '' } },
  ]);
  const plans = makePlans();
  const env = { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans };
  try {
    await run(['critique', PLAN], env);
    await run(['respond', PLAN, '-'], env, JSON.stringify([{ id: 'D1', decision: 'accept', response: 'done' }]));
    const r = await run(['critique', PLAN], env);
    assert.match(r.stdout, /NEXT: respond$/m);
    assert.strictEqual(ledger(plans).items[0].status, 'open');
  } finally {
    mock.close();
  }
});

test('convergence caps: 8 in round 1, high-only from round 3', async () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ ...obj('X' + i), severity: i < 2 ? 'low' : 'high' }));
  const withdrawAll = (n) => ({ verdicts: Array.from({ length: n }, (_, i) => ({ id: 'D' + (i + 1), action: 'withdraw' })) });
  const mock = await startMock([
    { content: { verdicts: [], new_objections: many, summary: '' } },
    { content: { ...withdrawAll(8), new_objections: [obj('Y')], summary: '' } },
    { content: { ...withdrawAll(9), new_objections: [{ ...obj('lowZ'), severity: 'medium' }, obj('highZ')], summary: '' } },
  ]);
  const plans = makePlans();
  const env = { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans };
  const rejectAll = () => JSON.stringify(ledger(plans).items.filter((i) => i.status === 'open')
    .map((i) => ({ id: i.id, decision: 'reject', response: 'no' })));
  try {
    await run(['critique', PLAN], env);
    let l = ledger(plans);
    assert.strictEqual(l.items.length, 8);
    assert.ok(l.items.every((i) => i.severity === 'high'), 'high severity kept first');
    await run(['respond', PLAN, '-'], env, rejectAll());
    await run(['critique', PLAN], env);
    await run(['respond', PLAN, '-'], env, rejectAll());
    await run(['critique', PLAN], env);
    l = ledger(plans);
    assert.deepStrictEqual(l.items.slice(9).map((i) => i.objection), ['highZ']);
  } finally {
    mock.close();
  }
});

test('invalid JSON then valid → corrective retry succeeds', async () => {
  const mock = await startMock([
    { content: 'sorry, here is my review...' },
    { content: { verdicts: [], new_objections: [], summary: 'fine' } },
  ]);
  const plans = makePlans();
  try {
    const r = await run(['critique', PLAN], { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans });
    assert.strictEqual(r.code, 0, r.stderr);
    assert.strictEqual(mock.requests.length, 2);
    assert.strictEqual(ledger(plans).status, 'consensus');
  } finally {
    mock.close();
  }
});

test('5xx is retried; persistent failure marks ledger incomplete', async () => {
  const mock = await startMock([
    { status: 503 },
    { content: { verdicts: [], new_objections: [obj('A')], summary: '' } },
  ]);
  const plans = makePlans();
  const env = { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans };
  try {
    let r = await run(['critique', PLAN], env);
    assert.strictEqual(r.code, 0, r.stderr);
    await run(['respond', PLAN, '-'], env, JSON.stringify([{ id: 'D1', decision: 'reject', response: 'no' }]));
    r = await run(['critique', PLAN], env); // mock is out of replies → 500s
    assert.strictEqual(r.code, 1);
    const l = ledger(plans);
    assert.strictEqual(l.status, 'incomplete');
    assert.strictEqual(l.round, 1, 'failed round is not counted');
  } finally {
    mock.close();
  }
});

test('respond validation: missing ids rejected, ledger unchanged', async () => {
  const mock = await startMock([{ content: { verdicts: [], new_objections: [obj('A'), obj('B')], summary: '' } }]);
  const plans = makePlans();
  const env = { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans };
  try {
    await run(['critique', PLAN], env);
    const before = fs.readFileSync(debateFile(plans, 'demo.json'), 'utf-8');
    const r = await run(['respond', PLAN, '-'], env, JSON.stringify([{ id: 'D1', decision: 'accept', response: 'ok' }]));
    assert.strictEqual(r.code, 1);
    assert.match(r.stderr, /missing responses for: D2/);
    assert.strictEqual(fs.readFileSync(debateFile(plans, 'demo.json'), 'utf-8'), before);
    const again = await run(['critique', PLAN], env);
    assert.match(again.stderr, /run `respond` first/);
  } finally {
    mock.close();
  }
});

test('no API key → skipped with exit 4', async () => {
  const plans = makePlans();
  const r = await run(['critique', PLAN], { DEEPSEEK_API_KEY: '', DEBATE_ROOT: plans });
  assert.strictEqual(r.code, 4);
  assert.match(r.stdout, /SKIPPED/);
  assert.ok(!fs.existsSync(debateFile(plans, 'demo.json')));
});

test('--new archives the previous debate instead of deleting it', async () => {
  const mock = await startMock([
    { content: { verdicts: [], new_objections: [], summary: 'first' } },
    { content: { verdicts: [], new_objections: [], summary: 'second' } },
  ]);
  const plans = makePlans();
  const env = { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans };
  try {
    await run(['critique', PLAN], env);
    const r = await run(['critique', PLAN, '--new'], env);
    assert.match(r.stdout, /archived/);
    assert.strictEqual(fs.readdirSync(debateFile(plans, 'history')).length, 1);
    assert.strictEqual(ledger(plans).rounds[0].summary, 'second');
  } finally {
    mock.close();
  }
});

test('applyCritique: maintain on a resolved item reopens it', () => {
  const { applyCritique, newLedger } = require(SCRIPT);
  const l = newLedger('demo');
  l.round = 2;
  l.items.push({ id: 'D1', status: 'resolved', severity: 'high', objection: 'A', history: [] });
  applyCritique(l, { verdicts: [{ id: 'D1', action: 'maintain', reason: 'fix is partial' }], newObjections: [], summary: '' });
  assert.strictEqual(l.items[0].status, 'open');
  assert.strictEqual(l.items[0].history[0].action, 'reopen');
});

test('cost estimate uses configured per-1M token prices', async () => {
  const mock = await startMock([{ content: { verdicts: [], new_objections: [], summary: '' } }]);
  const plans = makePlans();
  try {
    const r = await run(['critique', PLAN], {
      DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans, DEBATE_PRICE_IN: '1', DEBATE_PRICE_OUT: '10',
    });
    assert.match(r.stdout, /~0\.0003 USD/); // 100 in × $1 + 20 out × $10 per 1M
    assert.strictEqual(ledger(plans).usage.costUsd, 0.0003);
  } finally {
    mock.close();
  }
});

test('API key falls back to the shared ~/.config/vibe/providers.env file', async () => {
  const mock = await startMock([{ content: { verdicts: [], new_objections: [], summary: '' } }]);
  const plans = makePlans();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecode-home-'));
  fs.mkdirSync(path.join(home, '.config', 'vibe'), { recursive: true });
  fs.writeFileSync(path.join(home, '.config', 'vibe', 'providers.env'), 'export DEEPSEEK_API_KEY="from-file"\n');
  try {
    const r = await run(['critique', PLAN], { DEEPSEEK_API_KEY: '', HOME: home, DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans });
    assert.strictEqual(r.code, 0, r.stdout + r.stderr);
    assert.strictEqual(mock.requests.length, 1);
  } finally {
    mock.close();
  }
});

test('disabled provider in config → skipped with exit 4', async () => {
  const plans = makePlans(false);
  const r = await run(['critique', PLAN], { DEBATE_ROOT: plans });
  assert.strictEqual(r.code, 4);
  assert.match(r.stdout, /provider disabled/);
});

test('prompt carries only filled constraint files, not placeholder templates', async () => {
  const mock = await startMock([{ content: { verdicts: [], new_objections: [], summary: '' } }]);
  const plans = makePlans();
  try {
    await run(['critique', PLAN], { DEBATE_BASE_URL: mock.url, DEBATE_ROOT: plans });
    const prompt = mock.requests[0].messages[1].content;
    assert.match(prompt, /No Redis/);
    assert.doesNotMatch(prompt, /\[e\.g\., PostgreSQL 16\]/);
    assert.strictEqual(mock.requests[0].max_tokens, 1000);
  } finally {
    mock.close();
  }
});

test('plan path outside the project is rejected', async () => {
  const plans = makePlans();
  const r = await run(['status', '../../etc/passwd.md'], { DEBATE_ROOT: plans });
  assert.strictEqual(r.code, 1);
  assert.match(r.stderr, /Plan file not found/);
});

test('plugin layout: no DEBATE_ROOT → project = cwd, config falls back to the plugin copy', async () => {
  const mock = await startMock([
    { content: { verdicts: [], new_objections: [obj('A')], summary: 'r1' } },
  ]);
  const plans = makePlans();
  fs.rmSync(path.join(plans, '.vibecode', 'config'), { recursive: true }); // project has no own config
  const env = { ...process.env, HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'vibecode-home-')),
    DEEPSEEK_API_KEY: 'test-key', DEBATE_RETRY_DELAY_MS: '10', DEBATE_BASE_URL: mock.url };
  delete env.DEBATE_ROOT;
  delete env.CLAUDE_PROJECT_DIR;
  try {
    const r = await new Promise((resolve) => {
      execFile('node', [SCRIPT, 'critique', PLAN, '--new'], { cwd: plans, env },
        (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout, stderr }));
    });
    assert.strictEqual(r.code, 0, r.stderr);
    assert.strictEqual(ledger(plans).items.length, 1);   // written into the project, not the plugin
    assert.strictEqual(mock.requests[0].model, 'deepseek-v4-pro'); // model from the plugin's config
  } finally {
    mock.close();
  }
});
