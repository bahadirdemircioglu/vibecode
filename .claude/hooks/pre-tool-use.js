#!/usr/bin/env node

/**
 * Pre-Tool-Use Hook — Standards Enforcement (Advisory)
 *
 * Checks if the relevant standard file was likely loaded before
 * writing/editing code in backend/ or frontend/ directories.
 *
 * This hook is advisory — it warns but does not block.
 * Source pattern: GSD's gsd-workflow-guard hook
 */

const fs = require('fs');
const path = require('path');

function main() {
  const input = process.argv[2];
  if (!input) return;

  let event;
  try {
    event = JSON.parse(input);
  } catch {
    return;
  }

  const toolName = event.tool_name;
  if (!['Write', 'Edit'].includes(toolName)) return;

  const filePath = event.tool_input?.file_path || event.tool_input?.path || '';
  if (!filePath) return;

  const warnings = [];

  // Check backend code without backend standard
  if (filePath.includes('/backend/') || filePath.includes('/src/api/') || filePath.includes('/src/services/') || filePath.includes('/src/models/')) {
    warnings.push('⚠️ Writing backend code — ensure docs/standards/backend.md was loaded first.');
  }

  // Check frontend code without frontend standard
  if (filePath.includes('/frontend/') || filePath.includes('/components/') || filePath.includes('/pages/') || filePath.includes('/hooks/') || filePath.includes('/store/')) {
    warnings.push('⚠️ Writing frontend code — ensure docs/standards/frontend.md was loaded first.');
  }

  // Check Docker files without docker standard
  if (filePath.includes('docker-compose') || filePath.includes('Dockerfile')) {
    warnings.push('⚠️ Writing Docker config — ensure docs/standards/docker.md was loaded first.');
  }

  // Check test files without testing standard
  if (filePath.includes('/tests/') || filePath.includes('.test.') || filePath.includes('.spec.')) {
    warnings.push('⚠️ Writing tests — ensure docs/standards/testing.md was loaded first.');
  }

  // Check security-related files
  if (filePath.includes('/auth') || filePath.includes('/security') || filePath.includes('middleware')) {
    warnings.push('⚠️ Writing security/auth code — ensure docs/standards/security.md was loaded first.');
  }

  if (warnings.length > 0) {
    console.error(warnings.join('\n'));
  }
}

main();
