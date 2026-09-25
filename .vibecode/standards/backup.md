# Backup Strategy

> **When to read:** When setting up data persistence or backup procedures.

---

## 1. Development Database

- Dev database persists in `./data/postgres/` via Docker volume
- Developer is responsible for local backups
- Use the shipped scripts — don't hand-roll dumps:
  - `.vibecode/scripts/db-backup.sh` — `pg_dump --format=custom` → `backups/<db>_<timestamp>.dump`
    (keeps the last 10; `backups/` is gitignored)
  - `.vibecode/scripts/db-restore.sh [file.dump]` — lists backups without an argument; restores
    with `pg_restore --clean --if-exists` after confirmation

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
