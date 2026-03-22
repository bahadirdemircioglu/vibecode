# Database Constraints

> Fill this file when starting a new project. Delete sections that don't apply.
> These constraints override general standards for this specific project.

## Decisions
- DB engine: [e.g., PostgreSQL 16]
- ORM: [e.g., SQLAlchemy 2.x with async driver]
- Migration tool: [e.g., Alembic with auto-generation]
- Naming convention: [e.g., snake_case tables, plural names]

## Requirements
- Backup frequency: [e.g., daily, with 7-day retention]
- Test database: [e.g., separate postgres-test container]
- Soft deletes: [e.g., required for user data, hard delete logs]
- Audit columns: [e.g., created_at, updated_at on all tables]

## Restrictions
- [e.g., No SQLite in production — PostgreSQL only]
- [e.g., No raw SQL in application code — ORM only]
- [e.g., No schema changes without Alembic migration]

## Review Date
YYYY-MM-DD — revisit when [trigger, e.g., adding read replicas]
