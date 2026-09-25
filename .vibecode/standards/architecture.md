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

Sonnet subagent'a kod yazdırırken **üç fazlı protokol** uygulanır.

**İlke: Opus "ne"yi ve "bitti"yi tanımlar, "nasıl"ı Sonnet yazar.** Pseudo-code yazan Opus kodu
iki kez ödetir — önce pahalı çıktı token'ıyla tarif eder, sonra Sonnet aynısını yeniden yazar.
Sözleşme + kabul vakaları hem daha ucuz hem daha kesindir (makine doğrular).

**Faz 1 — SPEC (Opus):** Her kod değişikliği için sözleşme-spec yaz:
- **Dosya yolu** ve değişiklik türü (create / modify)
- **Sözleşme** — fonksiyon/endpoint imzaları, tipler, veri şekli, hata davranışı (hangi durumda hangi hata / HTTP kodu)
- **Kabul vakaları** — tablo: `girdi / durum → beklenen sonuç`; happy path + uç durumlar + hata yolları. "Bitti" tanımı budur
- **Pattern referansı** — mevcut codebase'den örnek dosya/fonksiyon göster
- **YAPMA listesi** — scope dışı eklemeler, gereksiz abstraction'lar
- **Pseudo-code YAZMA** — istisna: derin reasoning gerektiren kod (concurrency, kompleks algoritma, cryptography) → Opus doğrudan yazar
- **1-2 satır değişiklik** → spec atla, Opus direkt Edit ile yazsın
- **Mekanik iş** (rename, mevcut pattern'den boilerplate, doc/CHANGELOG güncelleme, kod taşıma) → spec yerine kısa talimat, `mechanic` rolü (Haiku)

Kabul vakası örneği:

| # | Girdi / durum | Beklenen |
|---|---------------|----------|
| 1 | Geçerli e-posta + şifre | 200, `{access_token}` |
| 2 | Yanlış şifre | 401, `invalid_credentials` — hangi alanın yanlış olduğu sızdırılmaz |
| 3 | 5. başarısız deneme / 15 dk | 429 |

**Faz 2 — WRITE (Sonnet subagent):**
- Önce kabul vakalarını test olarak yaz (RED), sonra kodu yaz; testler geçene kadar düzelt (GREEN)
- Kabul vakalarını değiştirme / zayıflatma — bir vaka yanlış görünüyorsa `BELIRSIZ: [vaka # + neden]` raporla
- Sözleşmedeki imza/tip/hata davranışına birebir uy — ekleme/çıkarma yapma
- Pattern referansı varsa o dosyayı oku, aynı stili kullan
- Belirsizlik varsa **kod yazma**, `BELIRSIZ: [soru]` olarak raporla
- Skill/standard içeriğini Opus prompt'a ekler — Sonnet aramaz

Subagent prompt şablonu:
```
Sen bir kod yazma asistanısın. Verilen sözleşme-spec'i uygula.
KURALLAR:
1. Önce kabul vakalarını test olarak yaz, sonra kodu yaz; tüm testler geçene kadar düzelt
2. Kabul vakalarını değiştirme veya zayıflatma — yanlış görünüyorsa "BELIRSIZ: [vaka # + neden]"
3. Sözleşmedeki imza/tip/hata davranışına birebir uy — ekleme yapma
4. Pattern referansı varsa o dosyayı oku ve aynı stili kullan
5. YAPMA listesindeki şeyleri YAPMA
6. Belirsizlik varsa kod yazma — "BELIRSIZ: [soru]" olarak raporla
7. Test komutunun gerçek çıktı özetini raporla — çalıştırmadan "geçti" deme

SPEC:
[spec içeriği buraya]
```

**Faz 3 — REVIEW (Opus):** Sonnet döndükten sonra **zorunlu kontrol**:
1. **Test çıktısı** — tüm kabul vakaları geçiyor mu? Ana kapı budur; geçmiyorsa kodu okumadan geri gönder
2. **Vaka sadakati** — testler kabul vakalarıyla birebir mi (atlanmış / zayıflatılmış vaka yok)?
3. **Diff'i oku** (tüm dosyayı değil) — sözleşme + YAPMA listesine uygunluk, pattern tutarlılığı, security
4. Karar:
   - ✅ OK → sonraki spec'e geç
   - 🔧 Küçük fix (1-5 satır) → Opus kendi düzeltir (Edit tool)
   - ❌ Büyük sorun → spec'i / vakaları netleştir, Sonnet'e tekrar gönder
   - **Max 2 Sonnet denemesi** — 2. denemede de başarısızsa Opus kendi yazar

**Paralel delegasyon:** Bağımsız dosyalar için birden fazla Sonnet subagent paralel çalışabilir. Dosyalar arası bağımlılık varsa sıralı çalıştır.

---

### Sonnet-First Eskalasyon Protokolü

> **Bağlam:** Default model **Sonnet**. Yukarıdaki üç fazlı protokol Opus *main context*'tey­ken geçerli. Sonnet main olduğunda aşağıdaki eskalasyon kuralları çalışır.

| Tetikleyici | Eylem | Notlar |
|-------------|-------|--------|
| Planlama / mimari karar | `Agent(model:opus, subagent_type:Plan)` | `/vibe-plan` zaten zorunlu Opus |
| Kararsızlık (kod kararı) | "BELIRSIZ: [soru]" — kullanıcıya rapor | Sonnet tahmin yapmaz |
| 2x kod başarısızlığı | `Agent(model:opus, prompt:"Diagnose + fix: [error + 2 attempts]")` | Otomatik, kullanıcı onayı gerekmez |
| Derin reasoning gerektiren kod | `Agent(model:opus)` doğrudan kod yazar | Concurrency, kompleks algoritma, cryptography |

**"Aynı sorun" tanımı (2-deneme kuralı için):**
- Aynı dosya path'i + aynı veya benzer hata mesajı (substring match)
- Test başarısızlığı durumunda: aynı test adı + aynı assertion error
- Kararsızsanız → eskalasyona gidin (under-escalation, over-escalation'dan ucuzdur)

**Geri dönüş kuralı:**
- Opus *talimat* döndürür ("Şu fix'i uygula: [step-by-step]") → Sonnet uygular
- İstisna: derin reasoning gerektiren kod → Opus doğrudan yazar; Sonnet review eder
- Token tasarrufu için ana akış Sonnet'te kalmalı — Opus subagent ayrı context'tir

**Anti-pattern'ler:**
- ❌ Her belirsizlikte Opus'a sormak (eskalasyon overhead'i tasarrufu bozar)
- ❌ 3. denemeyi Sonnet'le yapmak (2 deneme sonrası otomatik eskalasyon zorunlu)
- ❌ Plan kalitesini test etmek için Sonnet'le plan üretmek (plan = Opus zorunlu)
