# Vibecode — Vibe Coding Template System

> AI destekli yazılım geliştirmede tutarlı, güvenli ve token-verimli projeler
> oluşturmak için şablon ve yönetişim sistemi.

---

## Ne İşe Yarar?

Vibecode, Claude Code ile yazılım geliştirirken karşılaşılan temel sorunları çözer:

| Sorun | Çözüm |
|-------|-------|
| Her projede aynı dosyaları tekrar yazıyorsun | **`/scaffold`** + hazır **`.vibecode/templates/`** |
| Session geçişlerinde bağlam kaybı | **HANDOFF.md** + **`/go`** ile otomatik yükleme |
| Hangi skill'i yüklemem gerektiği belirsiz | **Otomatik stack detection** — config dosyalarından skill tespiti |
| Aynı hatalar tekrar ediyor | **Error Memory** — yapılandırılmış hata hafızası |
| Doğru standart yüklenemiyor | **pre-tool-use hook** — dosya path'ine göre uyarı |

---

## Hızlı Başlangıç

### 1. Kur

```bash
git clone <this-repo> ~/Dev/vibecode
cd ~/Dev/vibecode
```

### 2. İlk Projeyi Oluştur

```
/scaffold my-awesome-app ~/Dev/my-awesome-app
```

Bu komut otomatik olarak:
- Dizin yapısını oluşturur (backend, frontend, docs, data, .vibecode)
- Standart dosyaları kopyalar (10 standard → `.vibecode/standards/`)
- CLAUDE.md, Makefile, docker-compose.yml, .env.example kopyalar
- İlk CHANGELOG.md, progress.md, decisions.md oluşturur

### 3. Çalışmaya Başla

```
/go kullanici-yonetimi-ekle
```

---

## Proje Yaşam Döngüsü

### /scaffold — Projeyi Oluştur

```
/scaffold proje-adi /hedef/dizin
```

### /plan — Mimariyi Tasarla

```
/plan uygulama-adi
```

`docs/architecture/` altına plan yazar, onay bekler.

### /go — Çalışmaya Başla

```
/go kullanici-profil-sayfasi-ekle
```

1. HANDOFF.md varsa okunur
2. Config dosyalarından ilgili skill'ler tespit edilir (otomatik)
3. "Ready: [task] | Skills: [list]" ile başlar

### /done — Tamamla

```
/done
```

1. `make verify` çalıştırır (lint + test + audit)
2. CHANGELOG.md ve ilgili dokümanları günceller
3. HANDOFF.md yazar
4. Commit mesajı önerir

### /compact — Context Temizle

```
/compact
```

State'i HANDOFF.md'ye kaydeder, context'i sıkıştırır.

---

## Komut Referansı

| Komut | Ne Yapar |
|-------|----------|
| `/scaffold [isim]` | Yeni proje oluşturur |
| `/plan [feature]` | Mimari plan yazar, onay bekler |
| `/go [task]` | State + skills yükler, başlar |
| `/done` | Verify + docs + HANDOFF.md + commit önerisi |
| `/compact` | State kaydeder, context temizler |
| `/status` | Session durumunu gösterir |

---

## Otomatik Stack Detection

`session-start.sh` hook'u her session başında projenin config dosyalarını tarar ve ilgili skill'leri tespit eder:

| Config Dosyası | Taranan Bağımlılıklar | Eşleşen Skill'ler |
|----------------|----------------------|-------------------|
| `pyproject.toml` / `requirements.txt` | fastapi, sqlalchemy, pydantic, alembic, pytest, django, celery | fastapi-pro, postgresql, pydantic-models-py, python-testing-patterns, ... |
| `package.json` | react, next, zustand, tanstack, tailwindcss, vue, angular, prisma, jest/vitest, express, nestjs | react-patterns, nextjs-best-practices, zustand-store-ts, tailwind-patterns, ... |
| `docker-compose.yml` | — | docker-expert |
| `go.mod` | — | golang-pro, go-concurrency-patterns |
| `Cargo.toml` | — | rust-pro |
| `Gemfile` | — | ruby-pro |
| `main.tf` | — | terraform-specialist |

Session başında çıktı:
```
SKILLS: fastapi-pro, postgresql, pydantic-models-py, react-patterns, zustand-store-ts, docker-expert
```

---

## Skills Sistemi

110+ skill `.vibecode/skills/` altında. Gerçek dosya, symlink yok — herhangi bir makineye klonlayınca çalışır.

| Kategori | Örnekler |
|----------|----------|
| **Python / FastAPI** | fastapi-pro, python-pro, pydantic-models-py, async-python-patterns |
| **Database / SQL** | postgresql, postgres-best-practices, sql-optimization-patterns, database-migrations |
| **Frontend (React)** | react-patterns, react-best-practices, react-state-management, zustand-store-ts |
| **TypeScript / JS** | typescript-expert, javascript-pro, modern-javascript-patterns |
| **Testing / TDD** | test-driven-development, tdd-workflow, python-testing-patterns, javascript-testing-patterns |
| **Code Quality** | clean-code, code-reviewer, find-bugs, legacy-modernizer |
| **Documentation** | changelog-automation, readme, docs-architect, openapi-spec-generation |
| **Architecture** | architecture-patterns, architecture-decision-records, api-design-principles |
| **DevOps / Infra** | docker-expert, bash-pro, deployment-engineer, server-management |
| **Context Mgmt** | context-compression, context-optimization, context-window-management |

### Yeni Skill Ekleme

```markdown
# .vibecode/skills/my-skill/SKILL.md
---
name: my-skill
description: "Bu skill'in ne zaman aktif olacağını açıklayan kısa açıklama."
---

## Rules
[Zorunlu pattern'ler]

## Templates
[Kod şablonları]

## Anti-patterns
[Yapılmaması gerekenler]
```

---

## Hooks

### session-start.sh — Session Durumu + Stack Detection

Her session başında çalışır:
- HANDOFF.md durumunu kontrol eder
- Test/source oranını kontrol eder
- CHANGELOG güncelliğini kontrol eder
- **Config dosyalarından ilgili skill'leri tespit eder** (otomatik)

### pre-tool-use.js — Standart + Skill Uyarısı

Write/Edit öncesinde çalışır (advisory — bloklamaz):
- Dosya path'ine göre ilgili standardı hatırlatır
- İlgili skill'leri önerir
- Doküman güncelleme hatırlatması yapar

### notification.js — Context Monitor

Mesaj sayısını izler, context büyüdüğünde uyarı verir.

---

## Core Rules

1. İlgili standardı oku, sonra kod yaz
2. Kütüphane API'lerini dokümantasyondan doğrula — hafızadan yazma
3. Her yeni özellik veya değişiklik için test yaz
4. `make verify` çalıştır, sonra tamamlandı de — hata varsa düzelt, atlama
5. Her değişiklikten sonra CHANGELOG.md güncelle
6. Kod arama için Serena'yı tercih et (varsa)
7. Max 3 dosya/adım — büyük değişikliklerde subagent kullan
8. Yeni özellik veya mimari değişiklik — plan yaz, onay bekle

---

## Tools

**Serena** (kod navigasyonu) — varsa grep/find yerine tercih et:
- Sembol, route, class, function bulma
- Dependency ve impact analizi

**Context7** (kütüphane docs) — varsa hafıza yerine tercih et:
- FastAPI, SQLAlchemy, React, TypeScript, Zustand, TanStack Query, shadcn/ui, Pydantic v2

Her ikisi de yoksa standart Grep/Read ve resmi dokümantasyon ile devam edilir.

---

## Dizin Yapısı

```
vibecode/
├── CLAUDE.md                    ← Ana yönetişim (~130 satır)
├── .vibecode/
│   ├── standards/               ← Kodlama standartları (10 dosya, on-demand yüklenir)
│   ├── skills/                  ← 110+ AI skill
│   ├── memories/errors/         ← Hata hafızası
│   ├── scripts/                 ← Yardımcı shell scriptler
│   └── templates/               ← Scaffold şablonları
├── .claude/
│   ├── commands/                ← Slash komutları (/go, /done, /compact, /plan, /scaffold, /status)
│   ├── hooks/                   ← session-start.sh, pre-tool-use.js, notification.js
│   ├── rules/                   ← Path-scoped kodlama kuralları (8 dosya)
│   └── settings.json            ← Hook registrations, permissions
└── docs/
    ├── constraints/             ← Proje kısıtlamaları
    ├── CHANGELOG.md
    ├── decisions.md             ← ADR'ler
    └── progress.md
```

> `backend/`, `frontend/`, `Makefile`, `docker-compose.yml` — `/scaffold` ile oluşturulur.

---

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| **Backend** | FastAPI + SQLAlchemy async + Pydantic v2 |
| **Frontend** | React + TypeScript + Vite |
| **State** | Zustand |
| **Data fetching** | TanStack Query |
| **UI** | shadcn/ui |
| **Database** | PostgreSQL 16 |
| **Migrations** | Alembic |
| **Package (backend)** | uv |
| **Package (frontend)** | npm |
| **Container** | Docker Compose |
| **Testing** | pytest-asyncio + httpx (backend), Vitest + RTL (frontend) |
| **Linting** | Ruff (Python) + ESLint (JS) |

---

## Sık Karşılaşılan Durumlar

| Durum | Çözüm |
|-------|-------|
| Context doldu | `/compact` |
| Farklı task'a geçmem gerekiyor | `/compact` → `/go yeni-task` |
| Session kapandı, nerede kalmıştım? | `/go devam-et` |
| Yeni servis eklemem gerekiyor | `/plan redis-cache-ekleme` |
| Hangi skill'i yüklemeliyim? | Otomatik — session başında tespit edilir |
| Claude kuralları atladı | `pre-tool-use.js` hook uyarı verir |

---

## Referans Repolar

| Repo | Ne Alındı |
|------|-----------|
| [superpowers](https://github.com/obra/superpowers) | SKILL.md formatı, verification-before-completion |
| [everything-claude-code](https://github.com/affaan-m/everything-claude-code) | 5-layer architecture, strategic-compact |
| [get-shit-done](https://github.com/gsd-build/get-shit-done) | HANDOFF.md, context monitor, workflow guard |
| [obsidian-skills](https://github.com/kepano/obsidian-skills) | YAML frontmatter, minimal skill design |
| [claude-mem](https://github.com/thedotmack/claude-mem) | Progressive disclosure, session lifecycle |
