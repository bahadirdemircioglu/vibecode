#!/usr/bin/env node

/**
 * Pre-Tool-Use Hook — Standards + MCP + Doc Enforcement (Advisory)
 *
 * Four-layer advisory system:
 * 1. Standards enforcement — reminds to load relevant standard files
 * 2. MCP availability — reminds to verify Serena + Context7 before code ops
 * 3. Skill suggestions — recommends relevant skills based on file paths (ADR-002)
 * 4. Doc update reminder — reminds that documentation must be updated
 *
 * This hook is advisory — it injects context (additionalContext) but never
 * blocks or auto-approves. The normal permission flow always proceeds.
 * Input: JSON from stdin (Claude Code hook protocol)
 * Output: JSON to stdout with optional "message" for warnings
 */

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function main() {
  let input;
  try {
    const raw = await readStdin();
    input = JSON.parse(raw);
  } catch {
    // No valid input — allow silently
    process.exit(0);
  }

  const toolName = input.tool_name;
  if (!['Write', 'Edit'].includes(toolName)) {
    process.exit(0);
  }

  const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
  if (!filePath) {
    process.exit(0);
  }

  const warnings = [];
  const skillSuggestions = [];
  const mcpReminders = [];
  const docReminders = [];

  // --- MCP availability reminders ---
  // Remind Claude to verify Serena and Context7 before code operations

  const isCodeFile = filePath.match(/\.(py|ts|tsx|js|jsx|sql|yml|yaml)$/);
  const isBackendCode = filePath.includes('/backend/') || filePath.includes('/src/api/') || filePath.includes('/src/services/') || filePath.includes('/src/models/');
  const isFrontendCode = filePath.includes('/frontend/') || filePath.includes('/components/') || filePath.includes('/pages/');

  if (isCodeFile) {
    mcpReminders.push('Verify Serena MCP is available — use Serena for ALL code search (never grep/find).');
  }
  if (isCodeFile && (isBackendCode || isFrontendCode)) {
    mcpReminders.push('Verify Context7 MCP for any third-party library calls.');
  }

  // --- Doc update reminders ---
  // Every code change requires documentation update

  if (isCodeFile) {
    docReminders.push('MANDATORY: Update docs after this change (CHANGELOG.md + relevant docs).');
  }
  if (filePath.includes('/api/') || filePath.includes('routes')) {
    docReminders.push('API change detected — update docs/api/ + run generate-types.');
  }
  if (filePath.includes('/models/') || filePath.includes('alembic')) {
    docReminders.push('Schema change detected — update docs/constraints/database.md if needed.');
  }

  // --- Standards enforcement ---

  // Check backend code
  if (filePath.includes('/backend/') || filePath.includes('/src/api/') || filePath.includes('/src/services/') || filePath.includes('/src/models/')) {
    warnings.push('Writing backend code — ensure .vibecode/standards/backend.md was loaded first.');
  }

  // Check frontend code. Exclude .claude/hooks/ — those are Claude Code
  // lifecycle hooks, not React hooks, and must not trip the frontend rule.
  const isClaudeInternal = filePath.includes('/.claude/') || filePath.startsWith('.claude/');
  if (!isClaudeInternal && (filePath.includes('/frontend/') || filePath.includes('/components/') || filePath.includes('/pages/') || filePath.includes('/hooks/') || filePath.includes('/store/'))) {
    warnings.push('Writing frontend code — ensure .vibecode/standards/frontend.md was loaded first.');
  }

  // Check Docker files
  if (filePath.includes('docker-compose') || filePath.includes('Dockerfile')) {
    warnings.push('Writing Docker config — ensure .vibecode/standards/docker.md was loaded first.');
  }

  // Check test files
  if (filePath.includes('/tests/') || filePath.includes('.test.') || filePath.includes('.spec.')) {
    warnings.push('Writing tests — ensure .vibecode/standards/testing.md was loaded first.');
  }

  // Check security-related files
  if (filePath.includes('/auth') || filePath.includes('/security') || filePath.includes('middleware')) {
    warnings.push('Writing security/auth code — ensure .vibecode/standards/security.md was loaded first.');
  }

  // --- Skill suggestions (ADR-002: Skill Orchestrator) ---
  // Advisory only — suggests relevant skills based on file paths

  // Backend skills
  if (filePath.includes('/api/') || filePath.includes('routes')) {
    skillSuggestions.push('fastapi-pro', 'api-design-principles');
  }
  if (filePath.includes('/models/') || filePath.includes('alembic')) {
    skillSuggestions.push('postgresql', 'database-migrations-sql-migrations');
  }
  if (filePath.includes('/schemas/')) {
    skillSuggestions.push('pydantic-models-py');
  }
  if (filePath.includes('/services/')) {
    skillSuggestions.push('fastapi-pro', 'error-handling-patterns');
  }

  // Frontend skills
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    skillSuggestions.push('react-patterns');
  }
  if (filePath.includes('/store/')) {
    skillSuggestions.push('react-state-management');
  }
  if (filePath.includes('tailwind') || filePath.includes('.css')) {
    skillSuggestions.push('tailwind-patterns');
  }

  // Infra skills
  if (filePath.includes('Dockerfile')) {
    skillSuggestions.push('docker-expert');
  }

  // Build output
  const messages = [];
  if (mcpReminders.length > 0) {
    messages.push('🔌 ' + mcpReminders.join(' | '));
  }
  if (warnings.length > 0) {
    messages.push('⚠️ ' + warnings.join(' | '));
  }
  if (skillSuggestions.length > 0) {
    const unique = [...new Set(skillSuggestions)];
    messages.push('💡 Suggested skills: ' + unique.join(', '));
  }
  if (docReminders.length > 0) {
    messages.push('📝 ' + docReminders.join(' | '));
  }

  if (messages.length > 0) {
    // Advisory only — inject as additionalContext (PreToolUse hook schema).
    // Does NOT block or auto-approve; the normal permission flow proceeds.
    // NOTE: legacy {decision:"approve", message} is NOT valid for PreToolUse
    // and was silently dropped — additionalContext is the supported channel.
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: messages.join('\n')
      }
    }));
  }

  process.exit(0);
}

main();
