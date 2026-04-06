---
name: deprecation-and-migration
description: "Deprecate code safely and migrate systems incrementally. Use when removing old APIs, replacing dependencies, or modernizing legacy code."
---

## Overview

Full playbook for safely deprecating code and migrating systems. Covers the decision to deprecate, communication, incremental migration, and cleanup.

## When to Use

- Removing an old API version
- Replacing a dependency or library
- Migrating from one system to another (e.g., database, auth provider)
- Cleaning up dead/unused code

## Deprecation Decision Framework

Before deprecating, answer these 5 questions:

1. **What replaces it?** — Never deprecate without a working replacement
2. **Who uses it?** — Internal only? External consumers? How many?
3. **What breaks?** — Map all dependencies and downstream effects
4. **What's the timeline?** — When will the replacement be ready? When will the old thing be removed?
5. **Who migrates?** — Apply the Churn Rule (see below)

## The Churn Rule

If you own the deprecated system, YOU do the migration for your consumers. Don't deprecate and expect others to migrate themselves. The team that creates churn absorbs the churn.

## Compulsory vs Advisory Deprecation

- **Compulsory:** Old system will be removed by a specific date. Used for security fixes, breaking changes.
- **Advisory:** Old system continues to work but new system is preferred. Used for improvements, better alternatives.

## Migration Process (4 Steps)

### 1. Build the Replacement

The replacement must be fully working before any deprecation announcement. Test it thoroughly.

### 2. Announce

- Add deprecation notice in code (language-appropriate decorator/comment)
- Update documentation
- Communicate timeline to affected teams/consumers

### 3. Migrate Incrementally

Use one of these patterns:

**Strangler Pattern:** New code uses new system, old code migrated piece by piece:

```
Request → Router → Old System (shrinking)
                 → New System (growing)
```

**Adapter Pattern:** Wrap old interface around new implementation:

```python
# Old interface preserved, new implementation underneath
class LegacyUserService:
    def __init__(self):
        self._new_service = NewUserService()

    def get_user(self, id):  # Old method signature preserved
        return self._new_service.find_by_id(id)  # Delegates to new
```

**Feature Flag Migration:** Toggle between old and new at runtime:

```python
if feature_flags.is_enabled("new_auth"):
    return new_auth_service.authenticate(request)
else:
    return legacy_auth_service.authenticate(request)
```

### 4. Remove

After all consumers are migrated:

- Remove old code completely (don't leave it commented out)
- Remove feature flags
- Remove adapter layers
- Update documentation
- Clean up tests for old code

## Deprecation Notice Template

```
@deprecated(
    reason="Replaced by NewService for better performance",
    replacement="NewService.method_name()",
    removal_date="2025-06-01",
    migration_guide="docs/migrations/old-to-new.md"
)
```

## Zombie Code

Code that nobody uses but nobody removes. Signs:

- No test coverage
- No recent commits
- No references in codebase (dead imports, unused exports)
- "Just in case" code

Response: Remove it. Version control has the history. If you need it again, git has it.

## Hyrum's Law

> "With a sufficient number of users, every observable behavior of your system will be depended on by somebody."

Design for deprecation from day one:

- Keep public APIs minimal
- Document what is/isn't guaranteed behavior
- Use semantic versioning
- Internal implementation details should not be observable

## Anti-patterns

- Deprecating without a replacement ready
- Expecting consumers to migrate themselves (Churn Rule violation)
- Leaving deprecated code forever (set a removal date and honor it)
- Commenting out code instead of deleting it
- Big-bang migration (all at once) instead of incremental
- No communication of deprecation timeline
