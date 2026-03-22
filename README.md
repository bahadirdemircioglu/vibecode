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
│   ├── skills/                  ← Proje-seviyesi skill'ler
│   │   ├── self-check/SKILL.md  ← 30 maddelik compliance checklist
│   │   ├── handoff-protocol/SKILL.md ← Session state koruma protokolü
│   │   ├── project-workflow/SKILL.md ← Build/test/deploy workflow referansı
│   │   └── mobile/SKILL.md      ← React Native / Flutter patterns
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
│       ├── pre-tool-use.js      ← Standart yükleme kontrolü (advisory)
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
    ├── ~/.claude/skills/ taranır (860+ user-level skill)
    ├── project .vibecode/skills/ taranır (proje-seviyesi skill)
    │
    ├── Task'ın tech stack'ine göre eşleşen skill'ler yüklenir
    │   Örnek: FastAPI kodu → fastapi-pro skill otomatik aktif
    │
    └── Hangisi daha spesifik/kaliteli ise o kullanılır
```

### Proje-Seviyesi Skill'ler

| Skill | Ne Yapar | Ne Zaman Aktif |
|-------|----------|----------------|
| `self-check` | 30 maddelik kural uyum checklist'i | Her kod değişikliğinden sonra |
| `handoff-protocol` | Session state koruma protokolü | `/done`, `/compact`, session sonu |
| `project-workflow` | Build/test/deploy workflow referansı | make komutları, Docker işlemleri |

### User-Level Skill'ler (Örnekler)

`~/.claude/skills/` dizininde 860+ skill mevcut. Bu projede otomatik
devreye girebilecek olanlar:

| Skill | Kapsam |
|-------|--------|
| `fastapi-pro` | Async patterns, Pydantic V2, SQLAlchemy 2.0+ |
| `react-patterns` | Hooks, composition, performance, React 19 |
| `typescript-expert` | Advanced types, strict checking, build perf |
| `zustand-store-ts` | State/action interfaces, selectors, middleware |
| `flutter-expert` | Widget patterns, state management, Dart 3 |
| `systematic-debugging` | 4-phase root cause analysis |
| `plan-writing` | Atomic task breakdown |

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

### pre-tool-use.js — Standart Enforcement

Dosya yazma/düzenleme öncesinde çalışır:

```
backend/ kodu yazılıyor → "⚠️ backend.md yüklendi mi?"
frontend/ kodu yazılıyor → "⚠️ frontend.md yüklendi mi?"
Dockerfile düzenleniyor → "⚠️ docker.md yüklendi mi?"
```

**Advisory modda** çalışır — bloklamaz, uyarır. Claude uyarıyı görünce
kendini düzeltir.

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
