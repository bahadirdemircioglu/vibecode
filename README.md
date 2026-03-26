# Vibecode — Vibe Coding Template System

> AI destekli yazılım geliştirmede tutarlı, güvenli ve token-verimli projeler
> oluşturmak için kapsamlı bir şablon ve yönetişim sistemi.

---

## Ne İşe Yarar?

Vibecode, Claude Code (ve benzeri agent tabanlı araçlar) ile yazılım geliştirirken
karşılaşılan 4 temel sorunu çözer:

| Sorun | Çözüm |
|-------|-------|
| Claude kuralları atlıyor | **Five Absolute Rules** + **self-check skill** + **pre-tool-use hook** |
| Her projede aynı dosyaları tekrar yazıyorsun | **`/scaffold`** komutu + hazır **`.vibecode/templates/`** |
| Context doluyor, kalite düşüyor | **Context Budget** eşikleri + **notification hook** + **`/compact`** |
| Session geçişlerinde bağlam kaybı | **HANDOFF.md** protokolü + **`/go`** ile otomatik yükleme |
| Aynı hatalar tekrar ediyor | **Error Memory** (ADR-001) — yapılandırılmış hata hafızası |
| Doğru skill yüklenemiyor | **Skill Orchestrator** (ADR-002) — otomatik skill öneri sistemi |

---

## Hızlı Başlangıç

### 1. Ön Gereksinimler

```
- Claude Code (terminal veya IDE plugin)
- Docker & Docker Compose
- MCP Sunucuları:
  - Serena  → kod arama, sembol bulma, dependency analizi (token tasarrufu)
  - Context7 → kütüphane dokümantasyonu (hallucination önleme)
```

### 2. Bu Repoyu Kur

```bash
# Vibecode template'ini klonla
git clone <this-repo> ~/Dev/vibecode

# Claude Code'da bu dizini aç
cd ~/Dev/vibecode
```

### 3. İlk Projeyi Oluştur

Claude Code'u aç ve şunu yaz:

```
/scaffold my-awesome-app ~/Dev/my-awesome-app
```

Bu komut otomatik olarak:
- Tüm dizin yapısını oluşturur (backend, frontend, docs, data, .vibecode)
- Standart dosyaları kopyalar (10 standard .md → `.vibecode/standards/`)
- CLAUDE.md'yi projeye uyarlar
- `.gitignore`, `.env.example`, `Makefile`, `docker-compose.yml` kopyalar
- Port ataması yapar (ports dosyasından)
- İlk `CHANGELOG.md`, `VERSION`, `progress.md`, `decisions.md` oluşturur

---

## Proje Yaşam Döngüsü

### Adım 1: Scaffold — Projeyi Oluştur

```
/scaffold proje-adi /hedef/dizin

# veya shell script ile (Claude Code dışından):
./.vibecode/scripts/scaffold.sh proje-adi /hedef/dizin
```

**Ne olur:**
```
proje-adi/
├── backend/src/{api/v1, services, models, schemas, core}
├── backend/tests/
├── frontend/src/{components, pages, hooks, store, api, types, utils}
├── .vibecode/                ← Standartlar + skill'ler + scriptler (gitignored, şablondan regenerate)
│   ├── standards/            ← Kodlama standartları (on-demand yüklenir)
│   ├── skills/               ← Proje-seviyesi skill'ler
│   └── scripts/              ← Yardımcı scriptler (db-backup, db-restore)
├── docs/{constraints, architecture, setup, user, admin, api}
├── data/                     ← Docker volume'ları (gitignored)
├── CLAUDE.md                 ← Ana yönetişim dosyası
├── docker-compose.yml        ← Port'lar atanmış
├── Makefile                  ← make verify, make test, make up...
├── .env.example              ← Tüm env var'lar
├── .gitignore                ← Standart ignore kuralları
└── HANDOFF.md                ← İlk session state
```

### Adım 2: Plan — Mimariyi Tasarla

```
/plan uygulama-adi
```

**Ne olur:**
- `.vibecode/standards/architecture.md` okunur
- `docs/constraints/*.md` dosyaları kontrol edilir
- `docs/architecture/uygulama-adi-plan.md` oluşturulur:
  - Overview ve hedefler
  - Dizin yapısı değişiklikleri
  - Tech stack kararları ve gerekçeleri
  - Veritabanı şeması
  - API kontratı
  - Docker servisleri ve port atamaları
  - Güvenlik düşünceleri
- **Onayın beklenir** — onay olmadan kod yazılmaz

> **Kural:** Yeni proje veya major feature'da mimari plan **zorunludur**.
> Bu adımı atlamak yasaktır.

### Adım 3: Go — Çalışmaya Başla

```
/go kullanici-yonetimi-endpoint-ekle
```

**Ne olur (Three Gates):**

```
Gate 1: Load State
  └── HANDOFF.md varsa okunur → önceki session özeti
  └── Yoksa → "Fresh session"

Gate 2: Check Tools & Context
  ├── Serena MCP → hazır mı? (kod arama için)
  ├── Context7 MCP → hazır mı? (kütüphane docs için)
  ├── Skills → eşleşen skill'ler yüklenir
  ├── Error Memory → ilgili hata kayıtları yüklenir (ADR-001)
  ├── Ports → port atamaları kontrol edilir
  └── Constraints → proje kısıtlamaları okunur

Gate 3: Confirm Scope
  └── "✅ Ready: [task] | Skills: [list] | State: [summary]"
```

### Adım 4: Geliştirme — Kod Yaz

Her kod yazma adımında Claude otomatik olarak:

1. **İlgili standardı yükler** (backend.md, frontend.md, vb.)
2. **Kütüphane API'lerini Context7'den doğrular**
3. **Kod arama için Serena kullanır** (grep/find yerine — token tasarrufu)
4. **Max 3 dosya/adım** kuralına uyar
5. **Önce test yazar** (TDD yaklaşımı)

### Adım 5: Done — Tamamla ve Belgele

```
/done
```

**Ne olur:**
1. Tüm değişiklikler özetlenir
2. `make verify` çalıştırılır (lint + test + security audit)
   - Başarısız olursa → hata `.vibecode/memories/errors/`'e kaydedilir (ADR-001)
3. Documentation Checklist kontrol edilir
4. `CHANGELOG.md` güncellenir
5. `HANDOFF.md` yazılır (sonraki session için)
6. Git commit mesajı önerilir (Conventional Commits)

### Adım 6: Compact — Context Temizle (Gerektiğinde)

```
/compact
```

**Ne olur:**
1. `CHANGELOG.md` güncellenir
2. `HANDOFF.md` yazılır (tüm session state)
3. Context güvenle sıkıştırılır — hiçbir bağlam kaybolmaz

---

## Komut Referansı

| Komut | Ne Yapar | Ne Zaman Kullan |
|-------|----------|-----------------|
| `/scaffold [isim]` | Yeni proje oluşturur | Sıfırdan proje başlarken |
| `/plan [feature]` | Mimari plan yazar | Yeni özellik veya büyük değişiklik öncesi |
| `/go [task]` | Session başlatır, state yükler | Her session başında |
| `/done` | Doğrulama + dokümantasyon + commit | Her task sonunda |
| `/compact` | State kaydeder, context temizler | Context büyüdüğünde (60K+ token) |
| `/status` | Session durumunu gösterir | Durumu kontrol etmek istediğinde |

---

## Dizin Yapısı ve Ne Nerede?

```
vibecode/                        ← Bu repo (şablon sistemi)
├── CLAUDE.md                    ← Ana yönetişim — Claude'un tüm davranışını yönetir
│
├── .vibecode/                   ← Standartlar + skill'ler + scriptler + şablonlar
│   ├── standards/               ← Kodlama standartları (on-demand yüklenir)
│   │   ├── backend.md           ← FastAPI + SQLAlchemy + Pydantic v2 kuralları
│   │   ├── frontend.md          ← React + TypeScript + TanStack Query + Zustand
│   │   ├── testing.md           ← pytest-asyncio, test DB, coverage kuralları
│   │   ├── docker.md            ← Docker, Makefile, Dockerfile, env vars
│   │   ├── architecture.md      ← Mimari planlama, DB seçimi, mobil, subagent
│   │   ├── git.md               ← Semantic versioning, branching, commit format
│   │   ├── documentation.md     ← CHANGELOG, ADR, progress, HANDOFF.md
│   │   ├── ports.md             ← Port yönetimi workflow'u
│   │   ├── security.md          ← CORS, rate limiting, auth, logging
│   │   └── backup.md            ← Yedekleme stratejisi
│   ├── memories/                ← Kalıcı AI hafızası (ADR-001)
│   │   └── errors/              ← Yapılandırılmış hata kayıtları (YAML frontmatter)
│   │       └── archive/         ← 90 günden eski çözülmüş hatalar
│   ├── skills/                  ← 110 skill (gerçek dosya, symlink yok — portable)
│   │   ├── self-check/SKILL.md  ← 30 maddelik compliance checklist
│   │   ├── handoff-protocol/SKILL.md ← Session state koruma protokolü
│   │   ├── project-workflow/SKILL.md ← Build/test/deploy workflow referansı
│   │   ├── mobile/SKILL.md      ← React Native / Flutter patterns
│   │   ├── gap-detection/SKILL.md ← Eksik test/doc/migration tespiti
│   │   ├── phase-gate/SKILL.md  ← Faz geçiş doğrulama (PASS/FAIL)
│   │   ├── scope-check/SKILL.md ← Kapsam kayması tespiti
│   │   ├── incremental-writing/SKILL.md ← Bölüm bölüm doc yazma (token tasarrufu)
│   │   ├── reverse-doc/SKILL.md ← Koddan doküman üretme
│   │   ├── vue-expert/SKILL.md  ← Vue 3 Composition API, Pinia, TypeScript
│   │   └── ... (101 teknoloji skill'i: fastapi, python, react, postgresql, tdd, vb.)
│   ├── scripts/                 ← Yardımcı shell scriptler
│   │   ├── scaffold.sh          ← Proje oluşturma (Claude Code dışından da çalışır)
│   │   ├── db-backup.sh         ← PostgreSQL yedekleme
│   │   └── db-restore.sh        ← PostgreSQL geri yükleme
│   └── templates/               ← Scaffold'un kopyaladığı şablonlar
│       ├── HANDOFF.md           ← Session handoff şablonu
│       ├── .gitignore           ← Standart gitignore
│       ├── .env.example         ← Environment variables şablonu
│       ├── docker-compose.yml   ← Tüm servisler (port placeholder'lı)
│       └── Makefile             ← make verify, test, lint, format, audit...
│
├── .claude/
│   ├── settings.json            ← Hook registrations
│   ├── commands/                ← Slash komutları
│   │   ├── go.md                ← /go — session başlatma
│   │   ├── done.md              ← /done — task tamamlama
│   │   ├── compact.md           ← /compact — güvenli sıkıştırma
│   │   ├── plan.md              ← /plan — mimari planlama
│   │   ├── scaffold.md          ← /scaffold — yeni proje
│   │   └── status.md            ← /status — durum raporu
│   └── hooks/                   ← Otomatik kontroller
│       ├── pre-tool-use.js      ← Standart kontrolü + skill öneri (ADR-002, advisory)
│       └── notification.js      ← Context büyüklüğü monitörü
│
└── repos.txt                    ← Araştırılan referans repolar
```

---

## Token Tasarrufu Stratejisi

Vibe coding'de en büyük maliyet **token tüketimi**dir. Bu şablon sistemi
token'ları şu şekillerde korur:

### 1. On-Demand Yükleme

Standart dosyaları **asla önceden yüklenmez**. Sadece ilgili dosya tipi
yazılacağı zaman yüklenir:

```
Backend kodu yazacaksan → backend.md yüklenir
Frontend kodu yazacaksan → frontend.md yüklenir
Hiçbir şey yazılmıyorsa → hiçbir standart yüklenmez
```

Bu yaklaşım, her session başında 10 standart dosyasının (toplam ~30K token)
gereksiz yere yüklenmesini önler.

### 2. Serena MCP — Akıllı Kod Arama

```
❌ Yanlış: grep ile dosya ara → tüm sonuçlar context'e dolar
✅ Doğru: Serena ile sembol ara → sadece ilgili sonuç gelir
```

Serena, dosyaları açmadan sembol, route ve class bulur. Bu, context'e
gereksiz dosya içeriği yüklenmesini engeller. **En büyük token tasarrufu
kaynağıdır.**

### 3. Context Budget Eşikleri

```
0–60K token    →  Normal çalışma
60K–80K token  →  ⚠ Uyarı: /compact düşün
80K+ token     →  🔴 Zorunlu: /compact çalıştır
```

`notification.js` hook'u bu eşikleri otomatik izler ve uyarı verir.
80K token'dan sonra Claude'un kalitesi ciddi şekilde düşer.

### 4. HANDOFF.md — Sıfır Kayıpla Yeniden Başla

`/compact` çalıştırmadan önce tüm session state `HANDOFF.md`'ye yazılır.
Yeni session'da `/go` komutu bunu otomatik okur. Context temizlenir ama
**hiçbir bağlam kaybolmaz**.

### 5. Max 3 Dosya / Adım

Claude bir seferde en fazla 3 dosya düzenler. Bu:
- Her adımda context'e minimum dosya yükler
- Değişiklikleri atomik ve takip edilebilir tutar
- Hata yapıldığında geri almayı kolaylaştırır

### 6. Subagent Delegasyonu

5+ dosyayı etkileyen görevler subagent'a devredilir. Subagent tüm
araştırmayı yapar, özetler ve ana context temiz kalır.

---

## Güvenlik Katmanları

### Kod Seviyesi

| Kural | Neden |
|-------|-------|
| RFC 7807 ProblemDetail hata formatı | Tutarlı, parse edilebilir hata yanıtları |
| bcrypt ile password hashing (passlib yok) | Daha basit, daha güvenli |
| Yapılandırılmış loglama (structlog) | Log injection önleme |
| JWT: 15 dk access + 7 gün refresh | Token çalınma riskini minimize |
| Rate limiting (5/dk auth, 60/dk API) | Brute force koruması |

### Altyapı Seviyesi

| Kural | Neden |
|-------|-------|
| Tüm Dockerfile'larda non-root USER | Container escape koruması |
| `.env` asla commit edilmez | Secret sızıntısı önleme |
| `postgres-test` tmpfs üzerinde çalışır | Test veritabanı asla diske yazmaz |
| `make audit` (pip-audit + npm audit) | Dependency güvenlik taraması |
| Lock dosyaları (uv.lock, package-lock.json) commit edilir | Reproducible build |
| `docker-compose.override.yml` gitignored | Kişisel config sızıntısı önleme |

### Session Seviyesi

| Kural | Neden |
|-------|-------|
| `pre-tool-use.js` hook | Standart yüklenmeden kod yazılmasını uyarır |
| `self-check` skill | 30 maddelik compliance checklist |
| `make verify` zorunlu | lint + test + audit her task sonunda |
| Verification Watermark | Hangi kuralların uygulandığını görünür kılar |

---

## Skills Sistemi

### Nasıl Çalışır?

```
Claude bir task alır
    │
    ├── .vibecode/skills/ taranır (110 skill — gerçek dosya, portable)
    │
    ├── Task'ın tech stack'ine göre eşleşen skill'ler yüklenir
    │   Örnek: FastAPI kodu → fastapi-pro skill otomatik aktif
    │
    └── Hangisi daha spesifik/kaliteli ise o kullanılır
```

### 110 Skill — Kategoriler

| Kategori | Skill Sayısı | Örnekler |
|----------|-------------|----------|
| **Proje Workflow** | 9 | self-check, handoff-protocol, phase-gate, scope-check, gap-detection |
| **Python / FastAPI** | 9 | fastapi-pro, python-pro, pydantic, async-python, uv-package-manager |
| **Database / SQL** | 8 | postgresql, postgres-best-practices, sql-pro, database-design, migrations |
| **Frontend (React)** | 7 | react-patterns, react-best-practices, react-state-management, zustand |
| **Frontend (Vue)** | 1 | vue-expert (Composition API, Pinia, Vue Router 4, TypeScript) |
| **TypeScript / JS** | 9 | typescript-expert, javascript-pro, modern-javascript-patterns |
| **Testing / TDD** | 10 | test-driven-development, tdd-workflow, python-testing, js-testing |
| **Code Quality** | 5 | clean-code, code-reviewer, find-bugs, simplify, legacy-modernizer |
| **Documentation** | 7 | changelog-automation, readme, docs-architect, openapi-spec-generation |
| **Architecture** | 4 | architecture-patterns, architecture-decision-records, api-design |
| **Security** | 4 | security-auditor, vulnerability-scanner, auth-patterns, backend-security |
| **DevOps / Infra** | 8 | docker-expert, bash-pro, deployment-engineer, server-management |
| **Context Management** | 5 | context-degradation, compression, optimization, window-management |
| **Workflow / Planning** | 8 | brainstorming, plan-writing, executing-plans, verification, prompting |
| **Diğer** | 6 | tailwind, i18n, mermaid, mobile, performance-profiling, environment-setup |

Tüm skill'ler gerçek dosya olarak `.vibecode/skills/` altında — symlink yok,
herhangi bir makineye klonlayınca çalışır.

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

`description` alanı trigger olarak kullanılır — Claude task açıklamasıyla
eşleştiğinde skill otomatik yüklenir.

---

## Hooks Sistemi

### pre-tool-use.js — Standart Enforcement + Skill Öneri (ADR-002)

Dosya yazma/düzenleme öncesinde çalışır. İki katmanlı:

**Katman 1 — Standart kontrolü:**
```
backend/ kodu yazılıyor → "⚠️ backend.md yüklendi mi?"
frontend/ kodu yazılıyor → "⚠️ frontend.md yüklendi mi?"
Dockerfile düzenleniyor → "⚠️ docker.md yüklendi mi?"
```

**Katman 2 — Skill önerisi (ADR-002):**
```
api/ veya routes dosyası  → 💡 fastapi-pro, api-design-principles
models/ veya alembic/     → 💡 postgresql, database-migrations
schemas/                  → 💡 pydantic-models-py
*.tsx / *.jsx             → 💡 react-patterns
store/                    → 💡 react-state-management
Dockerfile                → 💡 docker-expert
```

**Advisory modda** çalışır — bloklamaz, uyarır ve önerir. Claude uyarıyı
görünce kendini düzeltir.

### notification.js — Context Monitor

Session boyunca mesaj sayısını izler:

```
~40 mesaj (~60K token) → ⚠️ "/compact düşün"
~50 mesaj (~80K token) → 🔴 "/compact ZORUNLU"
```

---

## Five Absolute Rules

Claude'un **asla** atlamaması gereken 5 kural:

```
1. 📖 İlgili standardı ÖNCE yükle → sonra kod yaz
2. 🔍 Kütüphane API'lerini Context7'den doğrula → asla hafızadan yazma
3. ✅ make verify'ı çalıştır → sonra tamamlandı de
4. 📝 CHANGELOG.md'yi güncelle → her değişiklikten sonra
5. 🚫 CHECKPOINT'i doğrulamadan ilerleme → sessizlik uyum değildir
```

Tam 30 maddelik detaylı liste: `.vibecode/skills/self-check/SKILL.md`

---

## Error Memory — Hata Analiz Hafızası (ADR-001)

Claude'un aynı hatayı iki kez yapmaması için tasarlanmış kalıcı hafıza sistemi.

### Nasıl Çalışır?

```
make verify başarısız oldu
    │
    ├── Hata analiz edilir (kök neden, bağlam, çözüm)
    │
    ├── .vibecode/memories/errors/ altına kayıt yazılır
    │   Dosya: [tarih]-[kategori]-[kısa-açıklama].md
    │   Format: YAML frontmatter + yapılandırılmış içerik
    │
    └── Sonraki session'da /go çalıştırılınca
        → ilgili modül/teknolojiye ait hata kayıtları otomatik yüklenir
        → Claude aynı hatayı tekrarlamamak için önlem alır
```

### Kayıt Formatı

```yaml
---
date: 2026-03-26
category: build-error | test-failure | lint-error | runtime-error | type-error | migration-error
module: backend/api | frontend/components | docker | alembic | ...
technology: fastapi | react | sqlalchemy | typescript | ...
severity: critical | high | medium | low
resolved: true | false
tags: [ilgili-anahtar-kelimeler]
---

## Hata
[Hata mesajı / stack trace özeti]

## Kök Neden
[Root cause analizi]

## Çözüm
[Ne yapıldı, neden işe yaradı]

## Önlem
[Gelecekte bu hatanın tekrarını önlemek için ne yapılmalı]
```

### Yaşam Döngüsü

- **90 günden eski** + `resolved: true` → `archive/` altına taşınır
- `resolved: false` kayıtlar süresi ne olursa olsun **aktif kalır**
- Arşiv sadece istatistik amaçlı tutulur (hata pattern analizi)

---

## Architecture Decision Records (ADR)

Mimari kararlar `docs/decisions.md`'de ADR formatında kayıt altına alınır.
Her yeni teknoloji, kütüphane, yapısal değişiklik veya strateji kararı
bir ADR gerektirir.

### Mevcut ADR'ler

| ADR | Başlık | Durum |
|-----|--------|-------|
| ADR-001 | Error Memory — Yapılandırılmış Hata Analiz Hafızası | Accepted |
| ADR-002 | Skill Orchestrator — Otomatik Skill Öneri Sistemi | Proposed |
| ADR-003 | Doc-Sync — Hibrit Doküman Senkronizasyonu | Proposed |

### Ne Zaman ADR Yazılır?

- Yeni mimari tanıtıldığında
- Kütüphane eklendiğinde veya değiştirildiğinde
- Breaking DB schema değişikliğinde
- Auth stratejisi değiştiğinde
- CLAUDE.md standartlarından sapma olduğunda

---

## Tipik Bir Session Nasıl Görünür?

```
Sen:   /go kullanıcı profil sayfası ekle

Claude: ✅ Ready: kullanıcı profil sayfası ekle
        Session state: fresh
        Serena: ready | Context7: ready
        Ports: 5100–5109
        Skills: fastapi-pro, react-patterns, typescript-expert
        Constraints: none

Sen:   başla

Claude: [frontend.md yükler]
        [Context7'den TanStack Query docs kontrol eder]
        [Serena ile mevcut route yapısını bulur]
        [3 dosya düzenler: ProfilePage.tsx, useProfile.ts, queries/users.ts]
        [Standards: frontend.md | Skills: react-patterns | Verified: ...]

Sen:   backend tarafını da yap

Claude: [backend.md yükler]
        [Context7'den FastAPI docs kontrol eder]
        [3 dosya düzenler: users.py endpoint, user_service.py, test_users.py]
        [Standards: backend.md | Skills: fastapi-pro | Verified: ...]

Sen:   /done

Claude: Changes: 6 files modified (3 frontend, 3 backend)
        make verify: ✅ lint-pass, test-pass, audit-pass
        Documentation: CHANGELOG.md updated
        HANDOFF.md: written
        Commit: feat: add user profile page with API endpoint
```

---

## Sık Karşılaşılan Durumlar

### "Context çok doldu, Claude saçmalamaya başladı"

```
/compact
```

Tüm state HANDOFF.md'ye yazılır, context temizlenir. Sonraki session'da
`/go` ile kalınan yerden devam edilir.

### "Farklı bir task'a geçmem gerekiyor"

```
/compact     ← mevcut task'ın state'ini kaydet
/go yeni-task ← yeni task ile başla
```

### "Session kapandı, nerede kalmıştım?"

```
/go devam-et
```

`/go` otomatik olarak HANDOFF.md'yi okur ve son durumu özetler.

### "Yeni bir servis (Redis, Elasticsearch) eklemem gerekiyor"

```
/plan redis-cache-ekleme
```

Mimari plan onaylanmadan yeni servis eklenemez. Bu kural, düşünülmeden
altyapı eklenmesini önler.

### "Port çakışması var"

Ports dosyasını kontrol et. Her proje 10 port'luk bloklar halinde atanır.
`/go` komutu otomatik olarak port dosyasını kontrol eder.

### "Claude aynı hatayı tekrar yaptı"

Error Memory sistemi (ADR-001) devredeyse, `/go` sırasında ilgili hata
kayıtları otomatik yüklenir. Eğer hata henüz kaydedilmemişse, `/done`
sırasında `make verify` başarısızlığı otomatik olarak kayıt altına alınır.

### "Hangi skill'i yüklemem gerekiyor?"

`pre-tool-use.js` hook'u dosya yoluna göre ilgili skill'leri otomatik önerir
(ADR-002). Örneğin `backend/src/api/` altına yazarken `fastapi-pro` ve
`api-design-principles` skill'leri önerilir.

### "Mimari bir karar aldık, nereye kaydetmeliyiz?"

`docs/decisions.md` dosyasına ADR formatında ekleyin. Format:
`ADR-[NNN]: Başlık → Context → Decision → Alternatives → Consequences`

### "Claude kuralları yine atladı"

`pre-tool-use.js` hook'u uyarı verir. Ek olarak:
- `/done` çalıştırmadan commit yapma
- `make verify` her zaman çalıştır
- Verification Watermark'ı kontrol et

---

## Tech Stack

| Katman | Teknoloji | Neden |
|--------|-----------|-------|
| **Backend** | FastAPI + SQLAlchemy async + Pydantic v2 | Modern async Python, type-safe |
| **Frontend** | React + TypeScript + Vite | Component-based, strict typing |
| **State (client)** | Zustand | Minimal, performant, TypeScript-native |
| **Data fetching** | TanStack Query | Cache, retry, optimistic updates |
| **UI components** | shadcn/ui | Customizable, accessible, Radix-based |
| **Forms** | React Hook Form + Zod | Performant, schema-validated |
| **Database** | PostgreSQL 16 | Default; alternatifler plan gerektirir |
| **Migrations** | Alembic | SQLAlchemy-native |
| **Package (backend)** | uv | Hızlı, reproducible (pip/poetry yasak) |
| **Package (frontend)** | npm | Standart |
| **Container** | Docker Compose | Her şey container'da çalışır |
| **Testing (backend)** | pytest-asyncio + httpx | Async-native |
| **Testing (frontend)** | Vitest + React Testing Library | Hızlı, behavior-focused |
| **Linting** | Ruff (Python) + ESLint (JS) | Hızlı, opinionated |
| **Docs** | Tome | Live-reload, Markdown-native |
| **Mobil** | React Native / Flutter | Mimari plana göre seçilir |

---

## Makefile Komutları

Tüm komutlar Docker container'ları içinde çalışır. Host'ta hiçbir şey
kurulmaz.

```bash
make verify          # lint + test + security audit (tek komut)
make test            # tüm testler
make test-backend    # sadece backend testleri
make test-frontend   # sadece frontend testleri
make lint            # linting kontrolü
make format          # otomatik format
make audit           # güvenlik taraması (pip-audit + npm audit)
make migrate         # Alembic migration
make generate-types  # OpenAPI → frontend types
make up              # docker compose up -d
make down            # docker compose down
make build           # container'ları rebuild et
make logs            # log takibi
make shell-backend   # backend container'a gir
make shell-frontend  # frontend container'a gir
```

---

## Referans Repolar

Bu şablon sistemi aşağıdaki açık kaynak projelerden ilham almıştır:

| Repo | Ne Alındı |
|------|-----------|
| [superpowers](https://github.com/obra/superpowers) | SKILL.md formatı, verification-before-completion, brainstorm-first |
| [everything-claude-code](https://github.com/affaan-m/everything-claude-code) | 5-layer architecture, strategic-compact, example CLAUDE.md'ler |
| [get-shit-done](https://github.com/gsd-build/get-shit-done) | HANDOFF.md, context monitor, workflow guard, wave execution |
| [obsidian-skills](https://github.com/kepano/obsidian-skills) | references/ pattern, YAML frontmatter, minimal skill design |
| [claude-mem](https://github.com/thedotmack/claude-mem) | Progressive disclosure, session lifecycle, token-aware retrieval |
| [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Ecosystem taxonomy, real-world CLAUDE.md örnekleri |
| [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Auto-triggering via description, multi-platform templates |
| [n8n-mcp](https://github.com/czlonkowski/n8n-mcp) | Multi-level validation, templates-first philosophy |
| [LightRAG](https://github.com/hkuds/lightrag) | Makefile-as-wizard pattern |

---

## Sorun Giderme

### Serena çalışmıyor

```
"⚠ Degraded session" — Serena olmadan çalışılabilir ama token tüketimi artar.
Claude grep/find'a düşer. MCP ayarlarını kontrol et.
```

### Context7 çalışmıyor

```
Fallback: web_fetch ile resmi dokümantasyon URL'si kullanılır.
Asla hafızadan kütüphane API'si yazılmaz.
```

### Hook'lar çalışmıyor

Hook'lar Node.js ile çalışır. Kontrol:
```bash
node .claude/hooks/pre-tool-use.js '{"tool_name":"Write","tool_input":{"file_path":"backend/src/test.py"}}'
```

### make verify başarısız oluyor

Claude otomatik olarak:
1. Hatayı analiz eder
2. Düzeltir
3. Tekrar çalıştırır
4. Atlamaz — bu Five Absolute Rules'un 3. kuralıdır

---

## Felsefe

> **"Measure twice, cut once."**

Bu şablon sistemi, AI destekli geliştirmenin en büyük risklerini — tutarsızlık,
hallucination, context kaybı, güvenlik ihmali — mekanik kontrol noktalarıyla
minimize eder. Amaç Claude'u kısıtlamak değil, **tutarlı kalite üretmesini
sağlamaktır**.

Kurallar basit:
- Önce düşün (`/plan`), sonra yaz (`/go`)
- Her adımda doğrula (`make verify`)
- Her session'ı belgele (`/done` → HANDOFF.md)
- Context'i temiz tut (`/compact`)
- Hafızaya güvenme, doğrula (Context7, Serena)
- Hatalardan öğren, tekrarlama (Error Memory)
- Kararları kaydet (ADR → `docs/decisions.md`)
