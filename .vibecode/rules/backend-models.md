---
paths: ["backend/src/models/**"]
---

# Backend SQLAlchemy Models

- Every model change **requires an Alembic migration** -- no exceptions
- Use SQLAlchemy **async patterns**: `async_session`, `select()`, `await session.execute()`
- Define relationships with `back_populates`, never `backref`
- Add `__tablename__` explicitly on every model; never rely on auto-generation
- **Index** frequently queried columns
- Use `Mapped[]` and `mapped_column()` (SQLAlchemy 2.0 style)
- Always set `server_default` for timestamps, not Python-side defaults
