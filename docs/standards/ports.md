# Port Management Standards

> **When to read:** At session start, and when adding new services.
> **Rule:** Claude never invents ports — always reads the ports file.

---

## 1. Workflow

```
Session start
      │
      ▼
Ask user: "What is the path to your ports file?"
      │
      ▼
Read file → is this project already listed?
  ├── Yes → use existing range → confirm with user
  └── No  → find highest used port in file
           → propose next free 10-port block
           → WAIT for user approval — do NOT proceed without it
           → append new block to file (preserve format below)
           → apply ports in docker-compose.yml and .env.example
```

---

## 2. Ports File Format

Preserve the existing format exactly when appending:

```
# === [ProjectName] ([/full/project/path]) — Port Range: XXXX-XXXX ===
XXXX  [ProjectName]/backend       FastAPI API server
XXXX  [ProjectName]/frontend      React dev server (Vite)
XXXX  [ProjectName]/postgres      PostgreSQL 16
XXXX  [ProjectName]/tome          Tome documentation server
# Add more service lines below as the project grows
```

---

## 3. Block Size

Default: 10 ports per project.
If the architecture plan lists more than 10 services, reserve the next appropriate multiple of 10.
