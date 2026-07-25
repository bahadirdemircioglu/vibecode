# Vibecode — Vibe Coding Template System

> AI destekli yazılım geliştirmede tutarlı, güvenli ve token-verimli projeler
> oluşturmak için şablon ve yönetişim sistemi.

---

## Ne İşe Yarar?

Vibecode, Claude Code ile yazılım geliştirirken karşılaşılan temel sorunları çözer:

| Sorun | Çözüm |
|-------|-------|
| Her projede aynı dosyaları tekrar yazıyorsun | **Clone workflow** + hazır **`.vibecode/templates/`** |
| Session geçişlerinde bağlam kaybı | **HANDOFF.md** + **`/vibe-go`** ile otomatik yükleme |
| Uzun SDD çalışmalarında context compaction = ilerleme kaybı | **`.vibecode/sdd/progress.md`** ledger — kaldığın yerden devam |
| Subagent prompt'ları görev metniyle şişiyor | **File handoff scripts** — görev ve diff dosyaya yazılır, path geçilir |
| Hangi skill'i yüklemem gerektiği belirsiz | **Otomatik stack detection** — config dosyalarından skill tespiti |
| Aynı hatalar tekrar ediyor | **Error Memory** — yapılandırılmış hata hafızası |
| Doğru standart yüklenemiyor | **pre-tool-use hook** — dosya path'ine göre uyarı |
| Opus'ta rutin iş = pahalı | **Sonnet-first routing** — hook Opus tespit ederse `/model sonnet` önerir |
| Plan discovery için `ls` token yiyor | **`docs/architecture/INDEX.md`** — tek otorite, targeted Read |
| vibecode gelişince türetilmiş projen eski sürümde kalıyor | **`/vibe-update`** — framework dosyalarını upstream'den hash-tabanlı güvenli merge ile senkronize eder |
| Plan tek modelin bakış açısıyla sınırlı | **Multi-AI consultation** — `/vibe-plan` planı DeepSeek'e danışıp convergence'a kadar birlikte olgunlaştırır (opt-in, kapalı gelir) |

---

## Hızlı Başlangıç

### 1. Kur

```bash
git clone <this-repo> ~/Dev/vibecode
cd ~/Dev/vibecode
```

### 2. Yeni Proje Oluştur

```bash
git clone <vibecode-repo> my-awesome-app
cd my-awesome-app
rm -rf .git README.md
claude
```

Session-start hook otomatik olarak:
- `git init` + ilk commit yapar
- `docs/architecture/` template planlarını siler, INDEX'i boş başlatır
- `.serena/project.yml` proje ismini dizin adından günceller
- MCP server'lar (Serena + Context7) hemen kullanılabilir
- Aktif model Opus ise `/model sonnet` önerisi verir (auto-switch yok)

### 3. Çalışmaya Başla

```
/vibe-go kullanici-yonetimi-ekle
```

---

## Proje Yaşam Döngüsü

### /vibe-plan — Mimariyi Tasarla

```
/vibe-plan uygulama-adi
```

1. `docs/architecture/INDEX.md` okunur (tek otorite — `ls` çekilmez)
2. İlgili eski planlar targeted Read edilir
3. Yeni plan `docs/architecture/<slug>-plan.md` olarak yazılır
4. INDEX'e bir satır özet eklenir
5. (Opsiyonel) Harici AI danışma turu — bkz. aşağıdaki bölüm
6. Onay beklenir

### /vibe-plan — Harici AI Danışma (Multi-AI Consultation, DeepSeek)

`/vibe-plan` taslak planı yazdıktan sonra, **isteğe bağlı olarak** ikinci bir AI sağlayıcısına
(şu an **DeepSeek**) danışabilir: plan eleştiri için gönderilir, makul öneriler entegre edilir,
DeepSeek yeni esaslı itiraz üretmeyene (`CONVERGED`) **veya** `max_rounds`'a ulaşana kadar tekrar
edilir. **Son söz her zaman senin modelinde** kalır — DeepSeek yalnızca danışman. Varsayılan
**kapalı**; açmadıkça `/vibe-plan` eskisi gibi tek modelle çalışır.

**Nasıl açılır (opt-in — iki adım):**

1. `.vibecode/config/ai-providers.json` içinde `enabled`'ı `true` yap:

   ```json
   {
     "active_provider": "deepseek",
     "max_rounds": 3,
     "providers": {
       "deepseek": {
         "enabled": true,              // ← false → true
         "request_shape": "openai-compatible",
         "base_url": "https://api.deepseek.com",
         "model": "deepseek-v4-pro",   // geçerli model'ler: deepseek-v4-pro | deepseek-v4-flash
         "api_key_env": "DEEPSEEK_API_KEY",
         "timeout_seconds": 120,
         "max_tokens": 8192            // reasoning modelleri önce reasoning'e token harcar → yüksek tut
       }
     }
   }
   ```

2. API key'i ver — **projenin `.env`'ine KOYMA.** vibecode başka bir projenin içinde
   katman olarak çalıştığı için kök `.env` senin uygulamanın env'idir; framework key'i
   oraya karışmamalı. Aşağıdakilerden **birini** seç (script bu sırayla arar):

   ```bash
   # (a) Shell rc'de export et — makine geneli, dosya gerekmez:
   echo 'export DEEPSEEK_API_KEY=sk-...' >> ~/.zshrc && source ~/.zshrc

   # (b) ÖNERİLEN — makine geneli dosya (bir kez ayarla, tüm projelerde çalışır,
   #     hiçbir repo'ya karışmaz):
   mkdir -p ~/.config/vibecode
   cp .vibecode/providers.env.example ~/.config/vibecode/providers.env
   # → ~/.config/vibecode/providers.env dosyasını düzenle, DEEPSEEK_API_KEY gir

   # (c) Proje-yerel override (gitignore'da) — yalnızca bu yolun host projede
   #     gitignore'landığından eminsen:
   cp .vibecode/providers.env.example .vibecode/providers.env
   ```

   Key adı, config'teki `api_key_env` ile aynı olmalı (`DEEPSEEK_API_KEY`).
   (key: https://platform.deepseek.com/api_keys)

**Kullanım:**

```
/vibe-plan odeme-sistemi                # enabled ise otomatik danışır
/vibe-plan odeme-sistemi --no-consult   # bu planda danışmayı atla (hassas plan)
```

**Nasıl çalışır:**
- Her turda tek satır bildirim: *"Danışma turu round N: plan DeepSeek'e gönderildi, geri bildirim alındı."*
- DeepSeek'in ham görüşü + hangi önerilerin alındığı/reddedildiği, plan dosyasının sonuna
  `## Appendix: External Review (DeepSeek)` bölümü olarak tur-tur eklenir (şeffaflık).
- Config yok / key yok / hata / timeout → **sessizce** normal tek-modelli akışa döner (fail-open —
  danışma bir kalite adımıdır, planı asla bloklamaz).

**Gizlilik:** Plan içeriği DeepSeek API'sine gider. Hassas planlar için `enabled: false` bırak veya
`--no-consult` kullan. API key asla loglanmaz/plana yazılmaz. Detay: `.vibecode/standards/security.md §8`.

**Başka provider eklemek:** Config, OpenAI-uyumlu chat-completions şekline (`request_shape:
"openai-compatible"`) uyan her sağlayıcıyı destekler — `providers`'a yeni bir giriş + `.env`'e key
eklemek yeter, kod değişmez. (OpenAI-uyumlu olmayan wire-format'lar ileride `case` dalı olarak eklenecek.)

### /vibe-go — Çalışmaya Başla

```
/vibe-go kullanici-profil-sayfasi-ekle
```

1. HANDOFF.md varsa okunur
2. Config dosyalarından ilgili skill'ler tespit edilir (otomatik)
3. "Ready: [task] | Skills: [list]" ile başlar

### /vibe-sdd — Spec-Driven Development

Büyük özellikler için kullan: `/vibe-plan`'dan sonra, kod yazmadan önce.

```
/vibe-sdd kullanici-yetkilendirme-sistemi
```

**Akış:**
1. **Soru Fazı** — 3-6 hedefli soru sorar (kapsam, kabul kriterleri, non-goal'lar)
2. **Spec** — `docs/architecture/<feature>-spec.md` yazar, onay bekler
3. **Görev Listesi** — dependency sıralı görevler + kritik yol, onay bekler
4. **Execute** — her görevi sırayla çalıştırır; bağımsız görevler `/vibe-fleet` ile paralel

> SDD çalışması sırasında dahili scriptler otomatik çalışır — bunları manuel
> kullanmak istersen bkz. [SDD Scriptleri](#sdd-scriptleri) bölümü.

### /vibe-fleet — Paralel Subagent Orkestrasyonu

```
/vibe-fleet authentication middleware'i yaz ve testlerini ekle
```

Director olarak çalışır: görevi bağımsız parçalara böler, her parçayı doğru
role gönderir, sonuçları toplar. Bağımsız alt görevler aynı anda çalışır.

Roller: `explorer`, `architect`, `engineer`, `tester`, `reviewer`, `bug-hunter`,
`refactor-planner`, `critic`.

### /vibe-done — Tamamla

```
/vibe-done
```

1. `make verify` çalıştırır (lint + test + audit)
2. CHANGELOG.md ve ilgili dokümanları günceller
3. HANDOFF.md yazar
4. Commit mesajı önerir

### /vibe-compact — Context Temizle

```
/vibe-compact
```

State'i HANDOFF.md'ye kaydeder, context'i sıkıştırır.

---

## SDD Scriptleri

`/vibe-sdd` komutunun arka planda kullandığı araçlar. Manuel çalıştırabilirsin.

### task-brief — Görev Özeti Çıkar

Bir plan/spec dosyasındaki N. görevi okuyup ayrı bir dosyaya yazar.
Subagent'a tüm plan yerine yalnızca o görevin dosya yolunu geçersin — prompt şişmez.

```bash
.vibecode/scripts/task-brief docs/architecture/auth-spec.md 3
# → .vibecode/sdd/task-3-brief.md (34 satır)

# Çıktı dosyasını kendin belirtmek istersen:
.vibecode/scripts/task-brief docs/architecture/auth-spec.md 3 /tmp/task3.md
```

**Kullanım senaryosu:**
```bash
# Görev 2'yi çıkar, engineer subagent'a gönder
.vibecode/scripts/task-brief docs/architecture/payment-spec.md 2
# Claude'da:
# "Şu görevi uygula: $(cat .vibecode/sdd/task-2-brief.md)"
```

### review-package — Diff Paketi Oluştur

İki git ref arasındaki commit log + istatistik + unified diff'i tek dosyaya toplar.
Reviewer subagent bu dosyayı okur — diff'i prompt'a yapıştırmana gerek kalmaz.

```bash
.vibecode/scripts/review-package HEAD~3 HEAD
# → .vibecode/sdd/review-a1b2c3..d4e5f6.md (commit log + stat + diff)

# Belirli commit'ler arası:
.vibecode/scripts/review-package abc1234 HEAD /tmp/review.md
```

**Kullanım senaryosu:**
```bash
# Görev 2 tamamlandı, reviewer subagent için diff paketi oluştur
BASE=$(git rev-parse HEAD~1)
.vibecode/scripts/review-package $BASE HEAD
# Claude'da:
# "Şu diff'i incele: .vibecode/sdd/review-*.md"
```

### sdd-workspace — SDD Çalışma Alanı Başlat

`.vibecode/sdd/` klasörünü oluşturur ve `progress.md` ledger dosyasını açar.
Komut zaten `/vibe-sdd` başlangıcında otomatik çalışır; uzun çalışmalarda
context compaction sonrası kaldığın yeri görmek için de kullanabilirsin.

```bash
.vibecode/scripts/sdd-workspace payment-sistemi
# → .vibecode/sdd/progress.md oluşturuldu

# Mevcut session varsa özet gösterir:
.vibecode/scripts/sdd-workspace payment-sistemi
# sdd-workspace: resuming existing session at .vibecode/sdd/progress.md
# # SDD Progress: payment-sistemi
# Started: 2026-06-20
# ...
```

**`progress.md` örneği:**

```markdown
# SDD Progress: payment-sistemi
Started: 2026-06-20

## Tasks
- [x] Task 1: Stripe webhook handler (commit: a1b2c3d)
- [x] Task 2: Payment model + migration (commit: e4f5g6h)
- [ ] Task 3: Frontend ödeme formu (IN PROGRESS)
- [ ] Task 4: E2E ödeme testi

## Blockers
(yok)
```

> `.vibecode/sdd/` gitignore'da — çalışma zamanı dosyaları repo'ya karışmaz.

---

## Prompt Şablonları

`/vibe-sdd` subagent dispatch'lerinde kullanılan sabit sözleşmeler.
Şablonu güncellersen tüm gelecek dispatch'ler otomatik yeni versiyonu kullanır.

| Dosya | Ne İşe Yarar |
|-------|-------------|
| `.vibecode/prompts/sdd-implementer.md` | Implementer subagent sözleşmesi: görevi oku → uygula → self-review → commit → raporla |
| `.vibecode/prompts/sdd-reviewer.md` | Reviewer subagent kriterleri: spec uyumu + kod kalitesi — iki boyutlu verdict |

### Reviewer Verdict Formatı

Reviewer her zaman iki boyutu ayrı değerlendirir:

```
VERDICT: Approved | Needs Fixes

## Spec Uyumu
- [OK] Tüm gereksinimler karşılandı
- [FAIL] Görev 2.3: rate limiting eksik — auth/middleware.py:45

## Kod Kalitesi
- [OK] Separation of concerns
- [FAIL] tests/test_auth.py: sadece mock test, gerçek davranış test edilmiyor

## Bulgular
### Critical
- auth/middleware.py:67 Token expiry kontrolü yok
### Important
- (yok)
```

Critical bulgu varsa fix subagent devreye girer; re-review sonrası merge edilir.

---

## Komut Referansı

| Komut | Ne Yapar |
|-------|----------|
| `/vibe-plan [feature]` | Mimari plan yazar, onay bekler |
| `/vibe-go [task]` | State + skills yükler, başlar |
| `/vibe-sdd [feature]` | Soru → spec → görev listesi → execute (non-trivial özellikler için) |
| `/vibe-fleet [task]` | Director: görevi paralel subagent rollerine böler |
| `/vibe-collab-debug [bug]` | BugHunter → RefactorPlanner → Critic üçlüsü → doğrulanmış fix planı |
| `/vibe-goal [set\|status\|journal\|clear]` | Kilitli çok-session hedefi + günlük |
| `/vibe-done` | Verify + docs + HANDOFF.md + commit önerisi |
| `/vibe-compact` | State kaydeder, context temizler |
| `/vibe-doc-sync [--live] [--tier full] [paths...]` | Dokümanları kodla senkronize eder |
| `/vibe-security-review [file]` | OWASP Top 10 güvenlik taraması |
| `/vibe-update [ref]` | Framework dosyalarını (standards/skills/hooks/commands) upstream vibecode'dan senkronize eder — hash-tabanlı güvenli merge |
| `/vibe-status` | Session durumunu gösterir |

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

### permission-policy.js — Güvenlik Kapısı

Riskli komutları tier'a göre değerlendirir (hard-block veya uyarı):
- `rm -rf`, force push, `DROP TABLE` → hard-block
- `curl | bash`, eval with external input → hard-block
- Diğer riskli komutlar → uyarı + onay gerektirir

### net-fs-guard.js — Ağ + Dosya Sistemi Koruması

- SSRF riskli URL'leri engeller
- Sistem yollarına (`/etc/`, `/usr/`) yazma girişimlerini engeller
- Symlink traversal saldırılarını önler

### notification.js — Context Monitor

Mesaj sayısını izler, context büyüdüğünde `/vibe-compact` önerir.

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
9. Sonnet subagent'lara mikro-spec ver, max 2 deneme — sonra Opus devralır
10. **Sonnet-first routing:** Default Sonnet. Opus sadece planlama / mimari karar / 2-fail eskalasyon / derin reasoning için. Sonnet kararsız kaldığında veya 2 kez başarısız olduğunda otomatik Opus'a eskale eder.

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
│   ├── config/                  ← ai-providers.json (harici AI provider registry — /vibe-plan danışma)
│   ├── scripts/                 ← Yardımcı shell scriptler
│   │   ├── task-brief           ← SDD: plan'dan görev özeti çıkarır
│   │   ├── review-package       ← SDD: diff paketi oluşturur
│   │   ├── sdd-workspace        ← SDD: çalışma alanı + progress ledger başlatır
│   │   ├── consult-provider.sh  ← /vibe-plan: harici AI danışma (DeepSeek)
│   │   ├── scaffold.sh
│   │   ├── db-backup.sh
│   │   └── db-restore.sh
│   ├── prompts/                 ← Subagent prompt şablonları
│   │   ├── sdd-implementer.md   ← Implementer subagent sözleşmesi
│   │   └── sdd-reviewer.md      ← Reviewer subagent kriterleri
│   └── templates/               ← Scaffold şablonları
├── .claude/
│   ├── commands/                ← Slash komutları (vibe-go, vibe-done, vibe-sdd, vibe-fleet, ...)
│   ├── hooks/                   ← session-start.sh, pre-tool-use.js, permission-policy.js, net-fs-guard.js, notification.js
│   ├── rules/                   ← Path-scoped kodlama kuralları (8 dosya)
│   └── settings.json            ← Hook registrations, permissions
└── docs/
    ├── architecture/            ← Plan dosyaları + INDEX.md (plan discovery'nin tek otoritesi)
    ├── constraints/             ← Proje kısıtlamaları
    ├── CHANGELOG.md
    ├── decisions.md             ← ADR'ler
    └── progress.md
```

> `backend/`, `frontend/`, `Makefile`, `docker-compose.yml` — proje setup sırasında oluşturulur.
> `.vibecode/sdd/` — gitignore'da; çalışma zamanı dosyaları (brief'ler, diff'ler, ledger).

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
| Context doldu | `/vibe-compact` |
| Farklı task'a geçmem gerekiyor | `/vibe-compact` → `/vibe-go yeni-task` |
| Session kapandı, nerede kalmıştım? | `/vibe-go devam-et` (HANDOFF.md okunur) |
| SDD ortasında context sıkıştı | `/vibe-go` → `.vibecode/sdd/progress.md`'e bak, kaldığın görevden devam |
| Yeni servis eklemem gerekiyor | `/vibe-plan redis-cache-ekleme` |
| Hangi skill'i yüklemeliyim? | Otomatik — session başında tespit edilir |
| Claude kuralları atladı | `pre-tool-use.js` hook uyarı verir |
| Yanlışlıkla Opus ile açıldım | Hook `/model sonnet` öneriyor — komutu çalıştır |
| Sonnet aynı bug'ı 2 kez çözemedi | Otomatik — Sonnet `Agent(model:opus)` çağırır |
| Riskli komut bloklandı | `permission-policy.js` hard-block — komutu gözden geçir |
| Büyük özellik, nereden başlayacağım? | `/vibe-plan` → `/vibe-sdd` → `/vibe-fleet` sırasıyla |

---

## Referans Repolar

| Repo | Ne Alındı |
|------|-----------|
| [superpowers](https://github.com/obra/superpowers) | SKILL.md formatı; `task-brief` / `review-package` / `sdd-workspace` scriptleri; implementer + reviewer prompt şablonları; progress ledger deseni |
| [everything-claude-code](https://github.com/affaan-m/everything-claude-code) | 5-layer architecture, strategic-compact |
| [get-shit-done](https://github.com/gsd-build/get-shit-done) | HANDOFF.md, context monitor, workflow guard |
| [obsidian-skills](https://github.com/kepano/obsidian-skills) | YAML frontmatter, minimal skill design |
| [claude-mem](https://github.com/thedotmack/claude-mem) | Progressive disclosure, session lifecycle |
