#!/usr/bin/env node

/**
 * Context Monitor Hook — Notification
 *
 * Tracks approximate context usage and warns when approaching
 * degradation thresholds. Uses message count as a heuristic
 * since exact token counting is not available from hooks.
 *
 * Thresholds (based on claude-mem & context-degradation research):
 * - 0-60K tokens (~30 exchanges): Normal
 * - 60K-80K tokens (~40 exchanges): Warning
 * - 80K+ tokens (~50+ exchanges): Mandatory compact
 *
 * Source patterns: GSD's gsd-context-monitor, claude-mem's progressive disclosure
 */

const fs = require('fs');
const path = require('path');

// State file to track message count across hook invocations
const STATE_FILE = path.join(process.env.HOME || '/tmp', '.claude-context-monitor.json');

function loadState() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { messageCount: 0, lastWarning: null, sessionId: null };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch {
    // Silently fail — hook should not break workflow
  }
}

function main() {
  const input = process.argv[2];
  if (!input) return;

  let event;
  try {
    event = JSON.parse(input);
  } catch {
    return;
  }

  const state = loadState();

  // Reset counter on new session
  const sessionId = event.session_id || 'unknown';
  if (state.sessionId !== sessionId) {
    state.messageCount = 0;
    state.lastWarning = null;
    state.sessionId = sessionId;
  }

  state.messageCount++;

  const WARNING_THRESHOLD = 40;   // ~60K tokens
  const CRITICAL_THRESHOLD = 50;  // ~80K tokens

  if (state.messageCount >= CRITICAL_THRESHOLD && state.lastWarning !== 'critical') {
    console.error('🔴 CONTEXT BUDGET: ~80K+ tokens estimated. Run /compact NOW to prevent quality degradation.');
    state.lastWarning = 'critical';
  } else if (state.messageCount >= WARNING_THRESHOLD && state.lastWarning !== 'warning' && state.lastWarning !== 'critical') {
    console.error('⚠️ CONTEXT BUDGET: ~60K tokens estimated. Consider running /compact soon.');
    state.lastWarning = 'warning';
  }

  saveState(state);
}

main();
