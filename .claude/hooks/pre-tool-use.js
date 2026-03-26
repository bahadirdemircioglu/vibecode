#!/usr/bin/env node

/**
 * Pre-Tool-Use Hook — Standards Enforcement (Advisory)
 *
 * Checks if the relevant standard file was likely loaded before
 * writing/editing code in backend/ or frontend/ directories.
 *
 * This hook is advisory — it warns but does not block.
 * Input: JSON from stdin (Claude Code hook protocol)
 * Output: JSON to stdout with optional "message" for warnings
 *
 * Source pattern: GSD's gsd-workflow-guard hook
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

  // --- Standards enforcement (existing) ---

  // Check backend code
  if (filePath.includes('/backend/') || filePath.includes('/src/api/') || filePath.includes('/src/services/') || filePath.includes('/src/models/')) {
    warnings.push('Writing backend code — ensure .vibecode/standards/backend.md was loaded first.');
  }

  // Check frontend code
  if (filePath.includes('/frontend/') || filePath.includes('/components/') || filePath.includes('/pages/') || filePath.includes('/hooks/') || filePath.includes('/store/')) {
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
  if (warnings.length > 0) {
    messages.push('⚠️ ' + warnings.join(' | '));
  }
  if (skillSuggestions.length > 0) {
    const unique = [...new Set(skillSuggestions)];
    messages.push('💡 Suggested skills: ' + unique.join(', '));
  }

  if (messages.length > 0) {
    // Output advisory message — does not block, just warns/suggests
    console.log(JSON.stringify({
      decision: "approve",
      message: messages.join('\n')
    }));
  }

  process.exit(0);
}

main();
