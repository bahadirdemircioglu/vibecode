---
description: "Create an architecture plan for a new feature or project"
---

## Feature: $ARGUMENTS

Create a detailed architecture plan. Do NOT write any code until the plan is approved.

> **Model:** This command runs entirely on Opus. Do NOT delegate to Sonnet subagents — planning requires deep reasoning.

### 0. MCP Setup & Check
Ensure MCP servers are configured and running before any work begins:

1. **Check `.mcp.json`** — If it does NOT exist in the project root, create it:
```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--project-from-cwd"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```
If the file was just created, tell the user: "`.mcp.json` created — session restart needed for MCP servers to load. Run `/vibe-go` again after restart."  Then **STOP**.

2. **Check `.serena/project.yml`** — If it does NOT exist, auto-detect and create:
   - Detect languages from project files:
     - `*.py`, `pyproject.toml`, `requirements.txt` → `python`
     - `package.json`, `*.ts`, `*.tsx` → `typescript`
     - `go.mod` → `go`
     - `Cargo.toml` → `rust`
     - `Gemfile` → `ruby`
     - `pom.xml`, `build.gradle` → `java`
     - `build.gradle.kts` → `kotlin`
     - `*.csproj`, `*.sln` → `csharp`
     - `pubspec.yaml` → `dart`
     - `mix.exs` → `elixir`
     - `composer.json` → `php`
     - `*.tf` → `terraform`
     - `*.sh` → `bash`
     - `*.swift`, `Package.swift` → `swift`
     - `*.scala`, `build.sbt` → `scala`
     - `*.zig` → `zig`
     - `*.lua` → `lua`
     - `*.cpp`, `*.c`, `CMakeLists.txt` → `cpp`
   - Create `.serena/project.yml` with detected languages
   - Create `.serena/.gitignore` with: `/cache`, `/project.local.yml`, `/memories`
   - WARN: "`.serena/project.yml` created with languages: [list]. Restart session for Serena to pick it up." Then **STOP**.

3. **Verify MCPs** — Call `get_current_config` on Serena:
   - Active project with correct languages → "Serena: OK"
   - No active project → "Serena: UNAVAILABLE — restart session"
   - Context7: try a Context7 tool call
     - responds → "Context7: OK"
     - silent → "Context7: UNAVAILABLE — falling back to official docs"

If Serena is unavailable, WARN the user and ask if they want to continue without it. Serena is critical for token-efficient code navigation.

### 1. Load Standards
- Read `.vibecode/standards/architecture.md`
- Read all files in `docs/constraints/*.md`

### 2. Research
- Use Serena to analyze existing codebase for related code
- Use Context7 for any third-party library decisions
- Review `docs/decisions.md` for prior architectural decisions

### 3. Create Architecture Plan
Write `docs/architecture/$ARGUMENTS-plan.md` with these sections:

```markdown
# Architecture Plan: $ARGUMENTS

## Overview & Goals
[What this feature does and why it's needed]

## Directory Structure Changes
[New directories, files to create or modify]

## Tech Decisions
[Libraries, patterns, approaches — with rationale for each]

## Database Schema
[New tables, columns, relationships, indexes — skip if N/A]

## API Contract
[New endpoints: method, path, request/response shapes — skip if N/A]

## Docker Services
[New containers, volumes, networks — skip if N/A]

## Port Assignments
[Read from ports file — assigned ports for any new services]

## Security Considerations
[Auth, CORS, rate limiting, input validation relevant to this feature]

## Migration Plan
[Steps to implement without breaking existing functionality]

## Open Questions
[Decisions that need user input before proceeding]
```

### 4. Present Plan
Show the complete plan to the user.

### 5. Wait for Approval
**STOP HERE.** Do NOT proceed without explicit user approval.

Say: "Plan written to `docs/architecture/$ARGUMENTS-plan.md`. Please review and approve before I begin implementation."
