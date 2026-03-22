# Backup Strategy

> **When to read:** When setting up data persistence or backup procedures.

---

## 1. Development Database

- Dev database persists in `./data/postgres/` via Docker volume
- Developer is responsible for local backups
- Provide a convenience script:

```bash
# .vibecode/scripts/db-backup.sh
docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > \
  backups/$(date +%Y%m%d_%H%M%S).sql
```

---

## 2. Upload Files

- User uploads stored in `./data/uploads/`
- Include in backup strategy documentation in `docs/admin/`
- Never store uploads inside the container — always mount from host

---

## 3. Documentation

- Document full backup/restore procedure in `docs/admin/backup.md`
- Include: database dump, upload files, environment config
- Test restore procedure and document it
