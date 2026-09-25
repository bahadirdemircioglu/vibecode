#!/usr/bin/env node

/**
 * DeepSeek Debate — Claude ↔ external-AI plan debate driver (/vibe-plan Step 2)
 *
 * The Opus planner writes the plan; the external provider (v1: DeepSeek) acts as
 * critic. Each round it reviews the plan plus the objection ledger, the planner
 * accepts or rejects every open objection, and the loop repeats until no
 * objection is open (consensus) or the round limit is hit (the planner decides).
 * Decision: docs/decisions.md ADR-010.
 *
 * Usage (run directly — shebang):
 *   .vibecode/scripts/deepseek-debate.js critique <plan-file> [--new]
 *   .vibecode/scripts/deepseek-debate.js respond  <plan-file> <responses.json | ->
 *   .vibecode/scripts/deepseek-debate.js status   <plan-file>
 *
 * <plan-file> e.g. docs/architecture/auth-plan.md (relative to the project root).
 * responses.json: [{"id": "D1", "decision": "accept|reject", "response": "..."}]
 * — one entry for every open item.
 *
 * Output: human-readable report, last line is `NEXT: respond|critique|done`.
 * Generated files (never edit by hand): docs/architecture/debates/<slug>.json + .md
 * (previous debates: docs/architecture/debates/history/).
 *
 * Config: .vibecode/config/ai-providers.json (active provider: enabled, base_url,
 * chat_path, model, api_key_env, timeout_seconds, max_tokens; top-level max_rounds).
 * Missing config / enabled:false / no key → skipped (exit 4).
 * Key lookup (first hit): env var named by api_key_env → $VIBECODE_ENV_FILE →
 * .vibecode/providers.env → ~/.config/vibe/providers.env → ~/.config/vibecode/providers.env
 *
 * Env overrides (tests/debugging): DEBATE_ROOT, DEBATE_BASE_URL, DEBATE_MODEL,
 * DEBATE_MAX_ROUNDS, DEBATE_TIMEOUT_MS, DEBATE_RETRY_DELAY_MS,
 * DEBATE_PRICE_IN / DEBATE_PRICE_OUT (USD per 1M tokens, optional cost estimate).
 *
 * Exit codes: 0 = OK, 1 = error (API/validation), 2 = usage, 4 = skipped
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(process.env.DEBATE_ROOT || path.join(__dirname, '..', '..'));
const DEBATES_DIR = path.join(ROOT, 'docs', 'architecture', 'debates');

function loadConfig() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.vibecode', 'config', 'ai-providers.json'), 'utf-8'));
  } catch {
    return null;
  }
  const p = (cfg.providers || {})[cfg.active_provider];
  if (!p) return null;
  return {
    provider: cfg.active_provider,
    enabled: p.enabled === true,
    url: (process.env.DEBATE_BASE_URL || p.base_url || '').replace(/\/+$/, '') + (p.chat_path || '/chat/completions'),
    balanceUrl: (process.env.DEBATE_BASE_URL || p.base_url || '').replace(/\/+$/, '') + '/user/balance',
    model: process.env.DEBATE_MODEL || p.model,
    keyEnv: p.api_key_env || 'DEEPSEEK_API_KEY',
    timeoutMs: parseInt(process.env.DEBATE_TIMEOUT_MS || String((p.timeout_seconds || 300) * 1000), 10),
    maxTokens: p.max_tokens || 32000,
    maxRounds: parseInt(process.env.DEBATE_MAX_ROUNDS || String(cfg.max_rounds || 4), 10),
  };
}

function loadApiKey(keyEnv) {
  if (process.env[keyEnv]) return process.env[keyEnv];
  const cfgHome = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || os.homedir(), '.config');
  const files = [
    process.env.VIBECODE_ENV_FILE,
    path.join(ROOT, '.vibecode', 'providers.env'),
    path.join(cfgHome, 'vibe', 'providers.env'),
    path.join(cfgHome, 'vibecode', 'providers.env'),
  ].filter(Boolean);
  const re = new RegExp('^\\s*(?:export\\s+)?' + keyEnv + '\\s*=\\s*["\']?([^"\'\\s#]+)', 'm');
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const m = text.match(re);
    if (m) return m[1];
  }
  return '';
}

const CONFIG = loadConfig();
const API_KEY = CONFIG ? loadApiKey(CONFIG.keyEnv) : '';
const MODEL = CONFIG ? CONFIG.model : '';
const MAX_ROUNDS = CONFIG ? CONFIG.maxRounds : 4;
const TIMEOUT_MS = CONFIG ? CONFIG.timeoutMs : 300000;
const RETRY_DELAY_MS = parseInt(process.env.DEBATE_RETRY_DELAY_MS || '2000', 10);
const MAX_RETRIES = 2;
const PRICE_IN = parseFloat(process.env.DEBATE_PRICE_IN || '');
const PRICE_OUT = parseFloat(process.env.DEBATE_PRICE_OUT || '');

// Context DeepSeek gets alongside the plan
const STANDARDS = ['architecture.md'];

// Convergence: cap new objections per round; from round 3 on only `high`
const NEW_CAP_FIRST = 8;
const NEW_CAP_LATER = 3;
const HIGH_ONLY_FROM_ROUND = 3;

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

class DebateError extends Error {}

// ---------- files ----------

// The debated plan + where its ledger lives
function resolveTarget(planArg) {
  if (!planArg) throw new DebateError('Missing <plan-file>.');
  const plan = path.resolve(ROOT, planArg);
  if (!plan.startsWith(ROOT + path.sep) || !plan.endsWith('.md') || !fs.existsSync(plan)) {
    throw new DebateError('Plan file not found (must be a .md inside the project): ' + planArg);
  }
  const slug = path.basename(plan, '.md').replace(/-plan$/, '');
  return {
    plan,
    slug,
    ledger: path.join(DEBATES_DIR, slug + '.json'),
    md: path.join(DEBATES_DIR, slug + '.md'),
    history: path.join(DEBATES_DIR, 'history'),
  };
}

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function newLedger(project, planFile) {
  return {
    project,
    planFile: planFile || null,
    model: MODEL,
    maxRounds: MAX_ROUNDS,
    round: 0,
    phase: 'awaiting-critique',
    status: 'running',
    revision: null,
    startedAt: new Date().toISOString(),
    updatedAt: null,
    lastError: null,
    usage: { promptTokens: 0, completionTokens: 0, reasoningTokens: 0, costUsd: 0 },
    rounds: [],
    items: [],
  };
}

function loadLedger(t) {
  const raw = readIfExists(t.ledger);
  return raw ? JSON.parse(raw) : newLedger(t.slug, path.relative(ROOT, t.plan));
}

function saveLedger(t, ledger) {
  ledger.updatedAt = new Date().toISOString();
  fs.mkdirSync(DEBATES_DIR, { recursive: true });
  fs.writeFileSync(t.ledger, JSON.stringify(ledger, null, 2) + '\n', 'utf-8');
  fs.writeFileSync(t.md, renderMarkdown(ledger), 'utf-8');
}

// Keep the previous debate when starting over — plan artifacts are never deleted
function archiveLedger(t) {
  const file = t.ledger;
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(t.history, t.slug + '-' + stamp + '.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(file, target);
  return path.relative(ROOT, target);
}

// `**Revision:** N` in the plan.md header; inserted after **Status:** if missing
function bumpRevision(t) {
  const file = t.plan;
  const text = fs.readFileSync(file, 'utf-8');
  const re = /^\*\*Revision:\*\*\s*(\d+)\s*$/m;
  let next;
  let out;
  if (re.test(text)) {
    next = parseInt(text.match(re)[1], 10) + 1;
    out = text.replace(re, '**Revision:** ' + next);
  } else {
    next = 1;
    const lines = text.split('\n');
    let at = lines.findIndex((l) => l.startsWith('**Status:**'));
    if (at === -1) at = lines.findIndex((l) => l.startsWith('# '));
    lines.splice(at + 1, 0, '**Revision:** ' + next);
    out = lines.join('\n');
  }
  fs.writeFileSync(file, out, 'utf-8');
  return next;
}

// ---------- DeepSeek ----------

function systemPrompt(round, maxRounds) {
  const cap = round === 1 ? NEW_CAP_FIRST : NEW_CAP_LATER;
  const severityRule = round >= HIGH_ONLY_FROM_ROUND
    ? 'Bu turda YALNIZCA severity "high" olan yeni itiraz ekleyebilirsin.'
    : 'Yeni itirazlarda severity high|medium|low kullan.';
  return [
    'Sen kıdemli bir proje planlama eleştirmenisin (hakem). Planı Claude yazdı; senin görevin',
    'planın zayıf noktalarını bulmak. Planı sen düzenlemezsin — itiraz ve öneri üretirsin.',
    '',
    'Kurallar:',
    '- Somut ol: hangi dosya, hangi bölüm, neden sorun, ne önerirsin.',
    '- Zevk meselesi, üslup ve küçük yazım konularında itiraz etme; plan kalitesini etkileyen konulara odaklan',
    '  (kapsam, tahmin gerçekçiliği, eksik risk, bağımlılık, ölçülebilir hedef, faz süresi, çelişki).',
    '- Verilen standartlar ve kısıtlar bağlayıcıdır. Zorunlu teknoloji yığınına aykırı öneri yapma.',
    '- Mevcut maddeler için karar ver:',
    '    status "open" (Claude itirazını gerekçesiyle reddetti): gerekçe ikna ediciyse "withdraw",',
    '      değilse "maintain" (yeni bir argümanla — aynı cümleyi tekrarlama).',
    '    status "resolved" (Claude kabul edip planı düzeltti): düzeltme yeterliyse "withdraw",',
    '      yetersizse "reopen" ve nedenini yaz.',
    '- Kapanmış (agreed / decided-by-claude) maddeleri yeniden gündeme getirme.',
    '- Amaç uzlaşma: haklı gerekçeye ikna olmaktan çekinme. Tur ' + round + '/' + maxRounds + '.',
    '- En fazla ' + cap + ' yeni itiraz. ' + severityRule + ' Gerçekten sorun yoksa new_objections boş olsun.',
    '- Cevap dili planın dili olsun.',
    '',
    'YALNIZCA şu şemada geçerli JSON döndür:',
    '{"verdicts":[{"id":"D1","action":"withdraw|maintain|reopen","reason":"..."}],',
    ' "new_objections":[{"file":"plan.md","section":"...","severity":"high|medium|low","objection":"...","suggestion":"..."}],',
    ' "summary":"bu turun 1-3 cümlelik özeti"}',
  ].join('\n');
}

function userPrompt(t, ledger) {
  const parts = [];
  parts.push('# Standartlar');
  for (const s of STANDARDS) {
    const text = readIfExists(path.join(ROOT, '.vibecode', 'standards', s));
    if (text) parts.push('## ' + s + '\n\n' + text);
  }
  // Only filled-in constraint files — unfilled templates contain `[e.g.,` placeholders
  parts.push('# Kısıtlar (bağlayıcı)');
  const constraintsDir = path.join(ROOT, 'docs', 'constraints');
  for (const f of (fs.existsSync(constraintsDir) ? fs.readdirSync(constraintsDir) : []).sort()) {
    if (!f.endsWith('.md') || f.startsWith('.')) continue;
    const text = fs.readFileSync(path.join(constraintsDir, f), 'utf-8');
    if (!text.includes('[e.g.,')) parts.push('## ' + f + '\n\n' + text);
  }
  parts.push('# Plan dosyası');
  parts.push('===== ' + path.relative(ROOT, t.plan) + ' =====\n' + fs.readFileSync(t.plan, 'utf-8'));

  const active = ledger.items.filter((i) => i.status === 'open' || i.status === 'resolved');
  const closed = ledger.items.filter((i) => i.status !== 'open' && i.status !== 'resolved');
  parts.push('# Karar bekleyen maddeler (her biri için verdict ver)');
  parts.push(active.length > 0 ? JSON.stringify(active.map((i) => ({
    id: i.id, file: i.file, section: i.section, severity: i.severity, status: i.status,
    objection: i.objection, suggestion: i.suggestion, history: i.history,
  })), null, 2) : '(yok)');
  parts.push('# Kapanmış maddeler (yeniden açma)');
  parts.push(closed.length > 0
    ? closed.map((i) => '- ' + i.id + ' [' + i.status + '] ' + i.objection).join('\n')
    : '(yok)');
  return parts.join('\n\n');
}

function estimateCost(usage) {
  if (Number.isNaN(PRICE_IN) || Number.isNaN(PRICE_OUT)) return null;
  return (usage.promptTokens * PRICE_IN + usage.completionTokens * PRICE_OUT) / 1e6;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// POST /chat/completions with retries on network errors, 429 and 5xx
async function chat(messages) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);
    try {
      const { status, body } = await httpJson(CONFIG.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + API_KEY,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: CONFIG.maxTokens,
        }),
      });
      if (status === 200) return JSON.parse(body);
      lastErr = new DebateError(CONFIG.provider + ' HTTP ' + status + ': ' + body.slice(0, 300));
      if (status !== 429 && status < 500) break; // auth/request errors won't fix themselves
    } catch (e) {
      lastErr = new DebateError('DeepSeek request failed: ' + (e.name === 'AbortError' ? 'timeout' : e.message));
    }
  }
  throw lastErr;
}

async function balanceUsd() {
  try {
    const { status, body } = await httpJson(CONFIG.balanceUrl, {
      headers: { Authorization: 'Bearer ' + API_KEY },
    });
    if (status !== 200) return null;
    const info = (JSON.parse(body).balance_infos || []).find((b) => b.currency === 'USD');
    return info ? parseFloat(info.total_balance) : null;
  } catch {
    return null;
  }
}

function parseCritique(content) {
  let obj;
  try {
    obj = JSON.parse(content);
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end <= start) throw new DebateError('no JSON object in response');
    obj = JSON.parse(content.slice(start, end + 1));
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new DebateError('response is not a JSON object');
  if (obj.verdicts !== undefined && !Array.isArray(obj.verdicts)) throw new DebateError('verdicts is not an array');
  if (obj.new_objections !== undefined && !Array.isArray(obj.new_objections)) throw new DebateError('new_objections is not an array');
  return {
    verdicts: obj.verdicts || [],
    newObjections: obj.new_objections || [],
    summary: typeof obj.summary === 'string' ? obj.summary : '',
  };
}

// One chat call; on unparseable JSON, one corrective retry
async function requestCritique(messages) {
  const usage = { promptTokens: 0, completionTokens: 0, reasoningTokens: 0 };
  const addUsage = (u) => {
    if (!u) return;
    usage.promptTokens += u.prompt_tokens || 0;
    usage.completionTokens += u.completion_tokens || 0;
    usage.reasoningTokens += (u.completion_tokens_details && u.completion_tokens_details.reasoning_tokens) || 0;
  };
  let res = await chat(messages);
  addUsage(res.usage);
  let content = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
  try {
    return { critique: parseCritique(content || ''), usage };
  } catch (e) {
    const retry = messages.concat([
      { role: 'assistant', content: content || '' },
      { role: 'user', content: 'Önceki cevabın geçerli JSON değildi (' + e.message + '). Yalnızca şemaya uygun geçerli JSON döndür.' },
    ]);
    res = await chat(retry);
    addUsage(res.usage);
    content = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
    try {
      return { critique: parseCritique(content || ''), usage };
    } catch (e2) {
      throw new DebateError('DeepSeek returned invalid JSON twice: ' + e2.message);
    }
  }
}

// ---------- ledger transitions ----------

function applyCritique(ledger, critique) {
  const round = ledger.round;
  const notes = [];
  const byId = new Map(ledger.items.map((i) => [i.id, i]));
  const seen = new Set();

  for (const v of critique.verdicts) {
    const item = v && byId.get(v.id);
    if (!item || (item.status !== 'open' && item.status !== 'resolved')) {
      notes.push('ignored verdict for unknown/closed item ' + (v && v.id));
      continue;
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const reason = typeof v.reason === 'string' ? v.reason : '';
    let action = v.action;
    if (action === 'maintain' && item.status === 'resolved') action = 'reopen';
    if (action === 'withdraw') {
      item.status = 'agreed';
    } else if (action === 'reopen' || action === 'maintain') {
      item.status = 'open';
    } else {
      notes.push('unknown action "' + v.action + '" for ' + item.id + ' — treated as maintain');
      action = 'maintain';
      item.status = 'open';
    }
    item.history.push({ round, by: 'deepseek', action, text: reason });
  }

  // Silence = accept Claude's fix / keep the objection standing
  for (const item of ledger.items) {
    if (seen.has(item.id)) continue;
    if (item.status === 'resolved') {
      item.status = 'agreed';
      item.history.push({ round, by: 'deepseek', action: 'confirm-implicit', text: '' });
    } else if (item.status === 'open') {
      item.history.push({ round, by: 'deepseek', action: 'maintain-implicit', text: '' });
    }
  }

  let fresh = critique.newObjections
    .filter((o) => o && typeof o.objection === 'string' && o.objection.trim())
    .map((o) => ({ ...o, severity: SEVERITY_RANK[o.severity] !== undefined ? o.severity : 'medium' }));
  const offered = fresh.length;
  if (round >= HIGH_ONLY_FROM_ROUND) fresh = fresh.filter((o) => o.severity === 'high');
  fresh.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  fresh = fresh.slice(0, round === 1 ? NEW_CAP_FIRST : NEW_CAP_LATER);
  const dropped = offered - fresh.length;
  if (dropped > 0) notes.push(dropped + ' new objection(s) dropped by convergence rules');

  let nextId = ledger.items.reduce((m, i) => Math.max(m, parseInt(i.id.slice(1), 10) || 0), 0);
  for (const o of fresh) {
    nextId += 1;
    ledger.items.push({
      id: 'D' + nextId,
      file: typeof o.file === 'string' ? o.file : '',
      section: typeof o.section === 'string' ? o.section : '',
      severity: o.severity,
      objection: o.objection.trim(),
      suggestion: typeof o.suggestion === 'string' ? o.suggestion : '',
      status: 'open',
      raisedRound: round,
      history: [{ round, by: 'deepseek', action: 'raise', text: o.objection.trim() }],
    });
  }

  return { added: fresh.length, dropped, notes };
}

function finalize(ledger) {
  for (const item of ledger.items) {
    if (item.status === 'resolved') item.status = 'agreed';
    if (item.status === 'open') item.status = 'decided-by-claude';
  }
  const decided = ledger.items.filter((i) => i.status === 'decided-by-claude');
  ledger.status = decided.length > 0 ? 'decided' : 'consensus';
  ledger.phase = 'done';
  return decided;
}

// ---------- rendering ----------

const cell = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

function counts(ledger) {
  const c = { open: 0, resolved: 0, agreed: 0, 'decided-by-claude': 0 };
  for (const i of ledger.items) c[i.status] = (c[i.status] || 0) + 1;
  return c;
}

function renderMarkdown(ledger) {
  const c = counts(ledger);
  const out = [];
  out.push('# Plan Tartışması: ' + ledger.project);
  out.push('');
  out.push('> Bu dosya `scripts/deepseek-critique.js` tarafından üretilir — elle düzenlemeyin.');
  out.push('');
  out.push('**Durum:** ' + ledger.status + ' | **Tur:** ' + ledger.round + '/' + ledger.maxRounds +
    ' | **Model:** ' + ledger.model + ' | **Plan revizyonu:** ' + (ledger.revision === null ? '-' : ledger.revision));
  out.push('');
  out.push('**Maddeler:** ' + ledger.items.length + ' toplam — agreed ' + c.agreed + ', open ' + c.open +
    ', resolved ' + c.resolved + ', decided-by-claude ' + c['decided-by-claude']);
  out.push('');
  out.push('**Kullanım:** ' + ledger.usage.promptTokens + ' girdi / ' + ledger.usage.completionTokens +
    ' çıktı token (' + ledger.usage.reasoningTokens + ' akıl yürütme)' +
    (ledger.usage.costUsd > 0 ? ' — ~' + ledger.usage.costUsd.toFixed(4) + ' USD' : ''));
  if (ledger.lastError) {
    out.push('');
    out.push('**Son hata:** ' + ledger.lastError);
  }
  out.push('');
  out.push('## Turlar');
  out.push('');
  if (ledger.rounds.length === 0) out.push('Henüz tur yok.');
  for (const r of ledger.rounds) {
    out.push('- **Tur ' + r.round + '** — ' + r.added + ' yeni itiraz' +
      (r.dropped ? ' (' + r.dropped + ' elendi)' : '') + '. ' + cell(r.summary));
  }
  out.push('');
  out.push('## Maddeler');
  out.push('');
  if (ledger.items.length === 0) {
    out.push('Madde yok.');
  } else {
    out.push('| ID | Dosya / Bölüm | Önem | Durum | İtiraz |');
    out.push('|----|---------------|------|-------|--------|');
    for (const i of ledger.items) {
      out.push('| ' + i.id + ' | ' + cell(i.file + (i.section ? ' / ' + i.section : '')) + ' | ' +
        i.severity + ' | ' + i.status + ' | ' + cell(i.objection) + ' |');
    }
    out.push('');
    out.push('## Madde Geçmişi');
    for (const i of ledger.items) {
      out.push('');
      out.push('### ' + i.id + ' — ' + i.status);
      out.push('');
      if (i.suggestion) out.push('**Öneri:** ' + cell(i.suggestion));
      if (i.suggestion) out.push('');
      for (const h of i.history) {
        out.push('- Tur ' + h.round + ' · ' + h.by + ' · ' + h.action + (h.text ? ': ' + cell(h.text) : ''));
      }
    }
  }
  out.push('');
  return out.join('\n');
}

function printItems(items) {
  for (const i of items) {
    console.log('');
    console.log('[' + i.id + '] ' + i.status.toUpperCase() + ' · ' + i.severity + ' · ' +
      (i.file || '?') + (i.section ? ' / ' + i.section : ''));
    console.log('  İtiraz: ' + i.objection);
    if (i.suggestion) console.log('  Öneri:  ' + i.suggestion);
    const last = i.history[i.history.length - 1];
    if (last && last.action !== 'raise' && last.text) console.log('  DeepSeek (' + last.action + '): ' + last.text);
  }
}

// ---------- commands ----------

async function cmdCritique(planArg, flags) {
  const t = resolveTarget(planArg);
  const project = t.slug;
  if (!CONFIG || !CONFIG.enabled || !API_KEY) {
    const why = !CONFIG ? 'no .vibecode/config/ai-providers.json' : !CONFIG.enabled ? 'provider disabled in ai-providers.json'
      : 'no ' + CONFIG.keyEnv + ' (env, .vibecode/providers.env or ~/.config/vibe/providers.env)';
    console.log('SKIPPED: ' + why + ' — debate skipped, plan goes to approval without it.');
    console.log('NEXT: done');
    return 4;
  }

  if (flags.includes('--new')) {
    const archived = archiveLedger(t);
    if (archived) console.log('Previous debate archived → ' + archived);
  }
  const ledger = loadLedger(t);

  if (ledger.phase === 'done') {
    console.log('Debate already finished (' + ledger.status + '). Use --new to start a fresh one.');
    console.log('NEXT: done');
    return 0;
  }
  if (ledger.phase === 'awaiting-response') {
    throw new DebateError('Round ' + ledger.round + ' is waiting for Claude\'s responses — run `respond` first.');
  }

  const round = ledger.round + 1;
  console.log('=== DeepSeek critique — ' + project + ' — round ' + round + '/' + ledger.maxRounds + ' (' + MODEL + ') ===');
  const messages = [
    { role: 'system', content: systemPrompt(round, ledger.maxRounds) },
    { role: 'user', content: userPrompt(t, ledger) },
  ];

  let result;
  try {
    result = await requestCritique(messages);
  } catch (e) {
    ledger.status = 'incomplete';
    ledger.lastError = e.message;
    saveLedger(t, ledger);
    throw e;
  }
  // Balance endpoint lags behind usage, so cost comes from tokens × configured price
  const cost = estimateCost(result.usage);

  ledger.round = round;
  ledger.status = 'running';
  ledger.lastError = null;
  ledger.usage.promptTokens += result.usage.promptTokens;
  ledger.usage.completionTokens += result.usage.completionTokens;
  ledger.usage.reasoningTokens += result.usage.reasoningTokens;
  if (cost !== null) ledger.usage.costUsd += cost;

  const applied = applyCritique(ledger, result.critique);
  ledger.rounds.push({
    round,
    at: new Date().toISOString(),
    summary: result.critique.summary,
    added: applied.added,
    dropped: applied.dropped,
    usage: result.usage,
    costUsd: cost,
  });

  const open = ledger.items.filter((i) => i.status === 'open');
  if (open.length === 0) {
    ledger.status = 'consensus';
    ledger.phase = 'done';
  } else {
    ledger.phase = 'awaiting-response';
  }
  saveLedger(t, ledger);

  const c = counts(ledger);
  console.log('Summary: ' + (result.critique.summary || '-'));
  for (const n of applied.notes) console.log('Note: ' + n);
  const balance = await balanceUsd();
  console.log('Usage: ' + result.usage.promptTokens + ' in / ' + result.usage.completionTokens + ' out tokens' +
    (cost !== null ? ', ~' + cost.toFixed(4) + ' USD (total ~' + ledger.usage.costUsd.toFixed(4) + ' USD)' : '') +
    (balance !== null ? ' | DeepSeek balance: ' + balance.toFixed(2) + ' USD' : ''));
  printItems(open);
  console.log('');
  console.log('STATUS: round=' + round + '/' + ledger.maxRounds + ' open=' + c.open + ' agreed=' + c.agreed +
    ' new=' + applied.added + ' status=' + ledger.status);
  console.log('NEXT: ' + (ledger.phase === 'done' ? 'done' : 'respond'));
  return 0;
}

function readResponses(source) {
  const raw = source === '-' ? fs.readFileSync(0, 'utf-8') : fs.readFileSync(source, 'utf-8');
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : parsed.responses;
  if (!Array.isArray(list)) throw new DebateError('responses must be a JSON array (or {"responses": [...]})');
  return list;
}

function cmdRespond(planArg, source) {
  const t = resolveTarget(planArg);
  if (!source) throw new DebateError('respond needs a responses file (or - for stdin)');
  const ledger = loadLedger(t);
  if (ledger.phase !== 'awaiting-response') {
    throw new DebateError('Nothing to respond to (phase: ' + ledger.phase + ').');
  }

  const responses = readResponses(source);
  const open = ledger.items.filter((i) => i.status === 'open');
  const openIds = new Set(open.map((i) => i.id));
  const errors = [];
  const byId = new Map();
  for (const r of responses) {
    if (!r || !openIds.has(r.id)) {
      errors.push('not an open item: ' + (r && r.id));
    } else if (r.decision !== 'accept' && r.decision !== 'reject') {
      errors.push(r.id + ': decision must be accept|reject');
    } else if (typeof r.response !== 'string' || !r.response.trim()) {
      errors.push(r.id + ': response text is required');
    } else {
      byId.set(r.id, r);
    }
  }
  const missing = open.filter((i) => !byId.has(i.id)).map((i) => i.id);
  if (missing.length > 0) errors.push('missing responses for: ' + missing.join(', '));
  if (errors.length > 0) throw new DebateError('Invalid responses — ledger unchanged:\n  ' + errors.join('\n  '));

  for (const item of open) {
    const r = byId.get(item.id);
    item.status = r.decision === 'accept' ? 'resolved' : 'open';
    item.history.push({ round: ledger.round, by: 'claude', action: r.decision, text: r.response.trim() });
  }
  ledger.revision = bumpRevision(t);

  let decided = [];
  if (ledger.round >= ledger.maxRounds) {
    decided = finalize(ledger);
  } else {
    ledger.phase = 'awaiting-critique';
  }
  saveLedger(t, ledger);

  const accepted = open.filter((i) => byId.get(i.id).decision === 'accept').length;
  console.log('Recorded ' + open.length + ' response(s): ' + accepted + ' accepted, ' + (open.length - accepted) +
    ' rejected. plan.md revision → ' + ledger.revision);
  if (ledger.phase === 'done') {
    console.log('Round limit reached (' + ledger.maxRounds + ') — debate closed: ' + ledger.status + '.');
    if (decided.length > 0) {
      console.log('Add these to "Open Questions" in plan.md (DeepSeek objection stands, Claude decided):');
      printItems(decided);
    }
    console.log('NEXT: done');
  } else {
    console.log('NEXT: critique');
  }
  return 0;
}

function cmdStatus(planArg) {
  const t = resolveTarget(planArg);
  const project = t.slug;
  const raw = readIfExists(t.ledger);
  if (!raw) {
    console.log('No debate yet for ' + project + '.');
    console.log('NEXT: critique');
    return 0;
  }
  const ledger = JSON.parse(raw);
  const c = counts(ledger);
  console.log('Debate ' + project + ': status=' + ledger.status + ' phase=' + ledger.phase + ' round=' +
    ledger.round + '/' + ledger.maxRounds + ' open=' + c.open + ' resolved=' + c.resolved + ' agreed=' + c.agreed +
    ' decided-by-claude=' + c['decided-by-claude'] + ' tokens=' +
    (ledger.usage.promptTokens + ledger.usage.completionTokens));
  if (ledger.lastError) console.log('Last error: ' + ledger.lastError);
  printItems(ledger.items.filter((i) => i.status === 'open' || i.status === 'decided-by-claude'));
  const next = ledger.phase === 'done' ? 'done' : ledger.phase === 'awaiting-response' ? 'respond' : 'critique';
  console.log('NEXT: ' + next);
  return 0;
}

async function main() {
  const [cmd, project, ...rest] = process.argv.slice(2);
  const usage = 'Usage: deepseek-debate.js critique <plan-file> [--new] | respond <plan-file> <file|-> | status <plan-file>';
  try {
    if (cmd === 'critique' && project) return await cmdCritique(project, rest);
    if (cmd === 'respond' && project) return cmdRespond(project, rest[0]);
    if (cmd === 'status' && project) return cmdStatus(project);
    console.error(usage);
    return 2;
  } catch (e) {
    if (!(e instanceof DebateError) && !(e instanceof SyntaxError)) throw e;
    console.error('ERROR: ' + e.message);
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => process.exit(code));
}

module.exports = { applyCritique, finalize, parseCritique, renderMarkdown, newLedger };
