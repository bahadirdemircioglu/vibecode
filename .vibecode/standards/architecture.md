# Architecture Planning Standards

> **When to read:** Before starting any new project or major feature.
> **Rule:** No code is written until the architecture document is approved by the user.

---

## 1. Planning Workflow — MANDATORY BEFORE CODING

> **ENFORCEMENT:** Claude MUST NOT create any source file, Dockerfile, or config
> before explicit user "OK" on the architecture plan.

```
New project or major feature
        │
        ▼
Create docs/architecture/[name]-plan.md
  Include:
  - Overview and goals
  - Directory structure
  - Tech stack decisions with rationale
  - Database schema (tables, relations)
  - API contract (endpoints, methods, payloads)
  - Docker services list with port assignments (from ports file)
  - Data storage decisions (§2)
  - Security considerations (see security.md)
  - Monitoring & logging approach (see security.md §4)
  - Open questions
        │
        ▼
Present plan → WAIT for explicit "OK" from user
  └── ❌ User says "change X" → revise plan → present again → WAIT
  └── ✅ User says "OK" → proceed to implementation
        │
        ▼
Only then: begin implementation
```

---

## 2. Database Selection Rule

Default is **PostgreSQL**. Claude proposes an alternative only when there is a clear
technical reason, stated in the architecture plan. User must approve before any new
service is added to `docker-compose.yml`.

| Signal | Proposal |
|--------|----------|
| Full-text search, log aggregation, analytics at scale | Elasticsearch |
| Key-value cache, session store, rate limiting | Redis |
| Flexible document store, rapid schema iteration | MongoDB |
| Time-series metrics or sensor data | TimescaleDB (PostgreSQL extension) |
| High concurrency (100+ simultaneous connections) | PgBouncer or SQLAlchemy pool tuning |
| Everything else | PostgreSQL — no justification needed |

> **Note:** For most dev/small-scale projects, SQLAlchemy's built-in async pool
> (`pool_size`, `max_overflow`) is sufficient. Add PgBouncer only when architecture
> plan identifies high-concurrency requirements. Document pool settings in `.env.example`.

---

## 3. Mobile App Planning

When the architecture includes a mobile application, the plan MUST specify:

| Decision | Options |
|----------|---------|
| Framework | **React Native** (shared JS/TS skills with frontend) or **Flutter** (better native performance, Dart) |
| Navigation | React Navigation (RN) or Go Router (Flutter) |
| State management | Zustand/TanStack Query (RN, shared with web) or Riverpod (Flutter) |
| API sharing | Shared OpenAPI types with web frontend (RN advantage) |
| Dev server | Expo dev server (RN) with port from ports file |

**Default recommendation:** React Native when the web frontend already uses React + TypeScript
(shared code, shared types, shared skills). Flutter only when native performance is critical
or the team has existing Flutter expertise.

---

## 4. Subagent Delegation Rules

When a task affects **5 or more files**, Claude MUST:

1. Use a subagent to investigate the impact scope first
2. Get a summary of all affected files and dependencies
3. Create a step-by-step plan (max 3 files per step)
4. Execute sequentially, verifying each step

When a task requires **multi-service debugging** (backend + frontend + DB):
- Spawn a subagent for investigation
- Keep the main context clean for decision-making
- Document findings before acting

### Sonnet Subagent Delegasyon Protokolü (Opus ↔ Sonnet)

Sonnet subagent'a kod yazdırırken **üç fazlı protokol** uygulanır:

**Faz 1 — SPEC (Opus):** Her kod değişikliği için mikro-spec yaz:
- **Dosya yolu** ve değişiklik türü (create / modify)
- **Pseudo-code** seviyesinde logic (adım adım ne yapılacak)
- **Pattern referansı** — mevcut codebase'den örnek dosya/fonksiyon göster
- **YAPMA listesi** — scope dışı eklemeler, gereksiz abstraction'lar
- **1-2 satır değişiklik** → mikro-spec atla, Opus direkt Edit ile yazsın

**Faz 2 — WRITE (Sonnet subagent):**
- Mikro-spec'i birebir koda çevir — ekleme/çıkarma yapma
- Pattern referansı varsa o dosyayı oku, aynı stili kullan
- Belirsizlik varsa **kod yazma**, `BELIRSIZ: [soru]` olarak raporla
- Skill/standard içeriğini Opus prompt'a ekler — Sonnet aramaz

Subagent prompt şablonu:
```
Sen bir kod yazma asistanısın. Verilen mikro-spec'i birebir koda çevir.
KURALLAR:
1. Spec'te yazanı AYNEN uygula — ekleme/çıkarma yapma
2. Pattern referansı varsa o dosyayı oku ve aynı stili kullan
3. YAPMA listesindeki şeyleri YAPMA
4. Belirsizlik varsa kod yazma — "BELIRSIZ: [soru]" olarak raporla

MIKRO-SPEC:
[spec içeriği buraya]
```

**Faz 3 — REVIEW (Opus):** Sonnet döndükten sonra **zorunlu kontrol**:
1. Yazılan kodu oku (Read tool)
2. Spec'e uygunluk: tüm talimatlar uygulandı mı, YAPMA listesine uyuldu mu?
3. Kalite: mevcut codebase pattern'leriyle tutarlı mı, security açığı var mı?
4. Karar:
   - ✅ OK → sonraki mikro-spec'e geç
   - 🔧 Küçük fix (1-5 satır) → Opus kendi düzeltir (Edit tool)
   - ❌ Büyük sorun → yeni mikro-spec yaz, Sonnet'e tekrar gönder
   - **Max 2 Sonnet denemesi** — 2. denemede de başarısızsa Opus kendi yazar

**Paralel delegasyon:** Bağımsız dosyalar için birden fazla Sonnet subagent paralel çalışabilir. Dosyalar arası bağımlılık varsa sıralı çalıştır.
