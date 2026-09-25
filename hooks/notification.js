#!/usr/bin/env node

/**
 * Context Monitor Hook — UserPromptSubmit
 *
 * Tracks approximate context growth and warns when approaching degradation
 * thresholds. Uses a per-turn counter as a heuristic since exact token
 * counting is not available from hooks.
 *
 * WHY UserPromptSubmit (not Notification): the Notification event fires only
 * on sparse events (idle / permission prompts), so it does NOT correlate with
 * turns or token growth. UserPromptSubmit fires exactly once per user turn,
 * which is a far better proxy for conversation length.
 *
 * Input:  JSON from stdin (Claude Code hook protocol)
 * Output: exit 0; on threshold crossing, inject a reminder via
 *         hookSpecificOutput.additionalContext.
 *
 * Thresholds (based on claude-mem & context-degradation research):
 * - 0-60K tokens (~30 turns): Normal
 * - 60K-80K tokens (~40 turns): Warning
 * - 80K+ tokens (~50+ turns): Mandatory compact
 *
 * State is kept PER SESSION (keyed by session_id) so concurrent sessions in
 * different projects never clobber each other's counter.
 */

const { isVibecodeProject } = require('./vibecode-project.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Per-session state file — avoids cross-session/cross-project clobbering.
function stateFileFor(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(os.tmpdir(), `claude-context-monitor-${safe}.json`);
}

function loadState(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return { turnCount: 0, lastWarning: null };
  }
}

function saveState(file, state) {
  try {
    fs.writeFileSync(file, JSON.stringify(state), 'utf-8');
  } catch {
    // Silently fail — hook must never break the workflow.
  }
}

async function main() {
  if (!isVibecodeProject()) process.exit(0); // plugin enabled, but not a vibecode project
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0);
  }

  const sessionId = input.session_id || 'unknown';
  const file = stateFileFor(sessionId);
  const state = loadState(file);

  state.turnCount++;

  const WARNING_THRESHOLD = 40;   // ~60K tokens
  const CRITICAL_THRESHOLD = 50;  // ~80K tokens

  let message = null;
  if (state.turnCount >= CRITICAL_THRESHOLD && state.lastWarning !== 'critical') {
    message = "🔴 CONTEXT BUDGET: ~80K+ tokens estimated. Run /vibe-compact NOW to prevent quality degradation.";
    state.lastWarning = 'critical';
  } else if (state.turnCount >= WARNING_THRESHOLD && state.lastWarning !== 'warning' && state.lastWarning !== 'critical') {
    message = "⚠️ CONTEXT BUDGET: ~60K tokens estimated. Consider running /vibe-compact soon.";
    state.lastWarning = 'warning';
  }

  saveState(file, state);

  if (message) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: message
      }
    }));
  }

  process.exit(0);
}

main();
