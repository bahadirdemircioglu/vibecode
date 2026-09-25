/**
 * Plugin hooks run in EVERY project where the vibecode plugin is enabled
 * (a user-scope install enables it everywhere). They must only act in
 * projects initialized with /vibecode:init — marked by a `.vibecode/`
 * directory at the project root. Everywhere else they exit 0 silently.
 */

const fs = require('node:fs');
const path = require('node:path');

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function isVibecodeProject(root = projectRoot()) {
  try {
    return fs.statSync(path.join(root, '.vibecode')).isDirectory();
  } catch {
    return false;
  }
}

module.exports = { projectRoot, isVibecodeProject };
