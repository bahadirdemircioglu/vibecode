---
description: "Review code for OWASP Top 10 security vulnerabilities with line-level findings and patched code"
---

## Security Review: $ARGUMENTS

Execute a security code review following the `security-review` skill from `.vibecode/skills/security-review/SKILL.md`.

### 1. Load Skill
- Read `.vibecode/skills/security-review/SKILL.md` for the full review checklist

### 2. Identify Target Files

**If `$ARGUMENTS` is a file path:**
- Review that specific file

**If `$ARGUMENTS` is "last" or empty:**
- Run `git diff --name-only HEAD~1` to find recently changed files
- Filter to source code files only (exclude docs, configs, lock files)

**If `$ARGUMENTS` is "staged":**
- Run `git diff --cached --name-only` to find staged files

**If `$ARGUMENTS` is "branch":**
- Run `git diff --name-only $(git merge-base HEAD main)..HEAD` to find all files changed in current branch

### 3. Read Each File
- Read every target file completely
- Understand the context before reviewing

### 4. Run Security Review
- Follow the full OWASP Top 10 checklist from the skill
- Check every item for every file
- Apply language-specific checks based on the file type
- Verify findings are real (check for existing mitigations)

### 5. Report
- Use the output format from the skill
- Include vulnerable code + patched code for each finding
- End with a summary

### 6. Ask
After presenting findings, ask:
> "Shall I apply the patches? (all / pick specific ones / skip)"
