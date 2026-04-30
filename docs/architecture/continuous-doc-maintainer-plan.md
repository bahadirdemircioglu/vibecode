# Architecture Plan: Continuous Documentation Maintainer (v4 entegrasyonu)

> **Kaynak:** Kullanıcının `~/Downloads/continuous-doc-maintainer-v4.md` dosyasında hazırladığı "AI Skill v4: Continuous Documentation Maintainer (Auditable & Concurrent-Safe)" tasarımı.
> **Hedef:** Bu tasarımı vibecode projesinin mevcut `.vibecode/skills/` + `.claude/commands/` + `.claude/hooks/` mimarisine **kalıcı, idempotent ve auditable** şekilde entegre etmek.

---

## Overview & Goals

**Ne yapıyor?**
Kod değişikliklerinden sonra dökümantasyonu otomatik olarak: (1) sınıflandırıyor, (2) doğru hedef dosyaya yönlendiriyor, (3) eski içeriği prune ediyor, (4) şema kaynağı (OpenAPI / SQLAlchemy) ile senkronize ediyor, (5) güvenlik linter'ından geçiriyor (secret/PII bloklar), (6) audit trail yazıyor.

**Neden gerekli?**
Mevcut akışta dökümantasyon disiplini `docs/CHANGELOG.md` + `/vibe-done` checklist + `pre-tool-use.js` advisory hook üzerine kurulu. Ama:

| Mevcut eksik | v4 ile gelen yetenek |
|---|---|
| Silinen endpoint/UI doc'da kalıyor (manuel takip) | Step 3: Pruning Engine — orphaned anchor/example temizliği |
| OpenAPI değişince `docs/api/*.md` örnekleri tutarsızlaşıyor | Step 6: Schema-driven regeneration |
| Doc'a yanlışlıkla token/PII yazılabilir | Step 9: Security linter — BLOCK update |
| "Bu doc neden değişti?" sorusu — git blame ile araştırılır | Step 12: `CHANGELOG_INTERNAL.md` audit log |
| Aynı change üzerinde aynı doc tekrar tekrar update edilir | İdempotency: hash + semantic diff |
| Format-only diff'ler doc update tetikliyor (gürültü) | Step 5: hash-only-on-content + meaningful change check |

**Goal'ler (öncelikli):**
1. **Auditable** — her doc update için neden/önce-sonra/mode kayıtlı
2. **Idempotent** — aynı diff iki kere update tetiklemez
3. **Secure** — secret/PII içeren içerik doc'a yazılmaz (block)
4. **Schema-truth** — OpenAPI/SQLAlchemy/Pydantic değişimleri otomatik yansır
5. **Mevcut akışa eklenir, kırmaz** — `/vibe-done` ve advisory hook çalışmaya devam eder

---

## Directory Structure Changes

### Yeni dosyalar

```
.vibecode/skills/continuous-doc-maintainer/
├── SKILL.md                                  # Ana skill (v4 mantığını operationalize eder)
└── resources/
    ├── input-schema.json                     # v4 input schema (referans)
    ├── output-schema.json                    # v4 output schema (referans)
    └── audit-log-template.md                 # CHANGELOG_INTERNAL.md başlık şablonu

.claude/commands/
└── vibe-doc-sync.md                          # /vibe-doc-sync slash command (manuel tetik)

docs/
└── CHANGELOG_INTERNAL.md                     # Audit trail (yeni — public CHANGELOG.md'den ayrı)
```

### Değişen dosyalar

```
.vibecode/standards/documentation.md          # §6: continuous-doc-maintainer skill referansı
.claude/commands/vibe-done.md                 # Step 4 (Documentation Checklist) altına opsiyonel skill çağrısı
CLAUDE.md                                     # Slash commands tablosuna /vibe-doc-sync ekle
docs/architecture/INDEX.md                    # Bu plana satır ekle
docs/CHANGELOG.md                             # Skill ekleme kaydı (uygulama fazında)
docs/decisions.md                             # ADR-005: Continuous Doc Maintainer
docs/progress.md                              # continuous-doc-maintainer modülü
```

**Toplam:** 5 yeni dosya, 7 güncelleme. Mevcut hiçbir akış kırılmaz — `/vibe-done` → skill çağrısı **opsiyonel** olarak eklenir.

---

## Tech Decisions

### 1. Skill mi, Slash Command mi, Hook mu?

**Karar:** **Skill + Slash Command.** Hook değil.

| Seçenek | Neden bu? Neden değil? |
|---|---|
| **Skill** | ✅ Lazy loaded — gereksiz token harcamaz. ✅ `/vibe-done` Step 4'ten + manuel `/vibe-doc-sync`'tan çağrılabilir. ✅ Mevcut pattern (security-review, find-bugs gibi) |
| **Slash Command** (`/vibe-doc-sync`) | ✅ Manuel tetik. Argüman: `[--mode shadow|live] [--tier fast|full] [dosya-yolu...]`. ✅ Bağımsız tetik (commit yapmadan da çalışsın) |
| **Hook (post-tool-use)** | ❌ Her Write sonrası çalışırsa token israfı. ❌ "Format-only" diff'leri filtrelemek için zaten skill içi semantic diff lazım — hook layer'ı gereksiz. ❌ Mevcut `pre-tool-use.js` advisory; v4 BLOCK gerektiriyor — hook'a koymak güvenli değil (atlatılabilir; advisory zaten var) |

**İstisna:** v4 Step 9 (Security Linter — secret/PII detection) `pre-tool-use.js`'e **opsiyonel olarak** taşınabilir. Mevcut hook advisory mode'da; secret regex'i eklenip Write/Edit blocking yapılabilir. **Bu plan kapsamı dışında — ayrı bir plana ihtiyaç var.**

### 2. Mintlify (.mdx + mint.json) → Plain Markdown adaptasyonu

**Sorun:** v4 spec Mintlify-centric (`docs/api/{scope}.mdx`, `mint.json`, anchors, deep-links). Bu proje **plain Markdown** kullanıyor — `.mdx` yok, `mint.json` yok. Sadece `docs/user/`, `docs/admin/`, `docs/api/` (hepsi şu an boş) ve `docs/CHANGELOG.md`, `docs/decisions.md`, `docs/progress.md`, `docs/architecture/`, `docs/constraints/` var.

**Karar:** v4 mantığını koru, Mintlify-spesifik kısımları plain MD'ye adapte et:

| v4 Konsept | Mintlify | Bu projede karşılığı |
|---|---|---|
| Target dosya | `docs/api/{scope}.mdx` | `docs/api/{scope}.md` |
| Navigation index | `mint.json` | `docs/architecture/INDEX.md` (mevcut pattern) + `docs/CHANGELOG.md` (üst link) |
| Anchor / deep-link | `<a id=...>` MDX | Markdown başlık slug (`## Heading`) — auto-generated |
| Frontmatter | YAML | YAML (zaten skill dosyalarında kullanılıyor) |

**Mintlify'a geçmek istemiyoruz çünkü:** projenin mevcut build/deploy akışı plain MD'ye dayanıyor (Tome container live-mounted volume — `.vibecode/standards/documentation.md §5`). Mintlify ekleme **bu plan kapsamı dışında**.

### 3. Concurrency Control (Step 0) — Single-developer için over-engineered mi?

**Karar:** **Lite versiyon — file-level lock atla, idempotency yeterli.**

| v4 v.s. proje gerçeği | Sebep |
|---|---|
| v4: READ/WRITE lock per doc file | Single-user/single-session Claude'da tek aktör var |
| v4: Multi-tier (FAST acquire WRITE, FULL waits) | Multi-agent senaryosu (gelecekte gerekirse eklenir) |
| **Bizim kararımız:** Lock atla, **hash-tabanlı idempotency yeterli** (`previous_hashes`) | Aynı diff 2x çağrılırsa hash eşleşir → skip |

İleride paralel subagent'lar doc yazmaya başlarsa **lockfile-based** çözüm eklenir (`.vibecode/.doc-locks/{file}.lock`). Şimdilik kapsam dışı.

### 4. Audit Trail (Step 12) — `CHANGELOG_INTERNAL.md` ayrı mı, mevcut `CHANGELOG.md`'ye mi?

**Karar:** **Ayrı dosya — `docs/CHANGELOG_INTERNAL.md`.**

| Mevcut `docs/CHANGELOG.md` | Yeni `docs/CHANGELOG_INTERNAL.md` |
|---|---|
| Public, kullanıcı/PM odaklı | Internal — agent run trace'i |
| Format: human-readable (What/Why/How) | Format: machine-parsable (timestamp, action, hash before/after, mode, reasoning) |
| Manual / `/vibe-done` ile yazılır | `continuous-doc-maintainer` skill yazar |
| Versiyonlu (`v0.2.0`) | Versiyonsuz, append-only ledger |

İki dosya birbirini **referanslar ama içerik dublicate etmez.** Public CHANGELOG'da "docs auto-sync ran (see CHANGELOG_INTERNAL.md#timestamp)" linki yer alabilir.

### 5. Schema kaynağı (Step 6) — Hangi dosyalar?

**Karar:** İlk versiyon: **OpenAPI + Pydantic + SQLAlchemy** (proje stack'i).

```
schema_sources = [
  "backend/openapi.json",                # FastAPI auto-generated
  "backend/src/schemas/**/*.py",         # Pydantic v2 modeller
  "backend/src/models/**/*.py"           # SQLAlchemy modeller
]
```

`backend/` henüz oluşmamışsa skill no-op (skip; uyarı verir, hata vermez).

### 6. Execution Mode — Default `shadow`, `live` opt-in

**Karar:** İlk uygulamada **shadow mode** default. `live` ancak `--mode live` flag'i ile.

- **Shadow:** Skill ne yapacağını planlar, çıktıyı `output-schema.json` formatında raporlar, **dosyaya yazmaz**.
- **Live:** Yazar — ama her dosya değişikliği `Edit/Write` tool'undan geçer (`pre-tool-use.js` hook'u devrede; user onay verir).

Bu sayede yeni skill **incremental rollout**'a uygun.

### 7. AST Patch Engine (Step 8) — Markdown için ne demek?

**Karar:** **Plain string-based section ops** (gerçek AST değil — overkill).

Markdown için "AST patch" = başlık-tabanlı section bul/değiştir/sil:

```python
# pseudo
def modify_section(file, heading, new_content): ...
def insert_section(file, after_heading, new_section): ...
def delete_section(file, heading): ...
```

Reasoning: Markdown'ı tam AST'ye parse etmek (`mistune`, `marko`) ekstra dependency. Heading-based string manipulation Claude'un Edit tool'uyla doğal olarak çalışır. Line numbers'ı `Edit` tool zaten gösteriyor.

### 8. Visual Diff Guard (Step 7) — Bu projede skip

**Karar:** **İlk versiyonda devre dışı.**

Sebep: Frontend dökümantasyonu henüz yok (`docs/user/` boş). Screenshot-driven update use-case'i yok. İlerde `docs/user/` dolduğunda eklenir.

Skill'de bu adım `if screenshots: ... else: skip` olarak yer alır — feature gate.

---

## Database Schema

N/A — DB değişikliği yok. Skill sadece dosya işlemi yapar.

---

## API Contract

N/A — Yeni endpoint yok. Skill `backend/openapi.json` dosyasını **okur** (input olarak), endpoint **yaratmaz**.

---

## Docker Services

N/A — Yeni container yok. Skill mevcut Tome dökümantasyon container'ından bağımsız çalışır (Tome live-mount volume zaten dosya değişikliklerini yansıtıyor).

---

## Port Assignments

N/A — Skill bir servis değil, dosya işlemi yapan agent davranışı.

---

## Security Considerations

| Risk | Mitigasyon |
|---|---|
| Skill yanlışlıkla secret yazar | **Step 9: Security Linter** — secret/PII regex (api_key, token, password, JWT pattern, email/SSN PII) → BLOCK update |
| Skill silmemesi gereken doc'u siler (false-positive prune) | **Shadow mode default** + idempotency hash + dry-run rapor; `live` mode'da her Edit user onayından geçer (`pre-tool-use.js` advisory + Claude Code permission) |
| Audit log tahrif edilir | Append-only — eski entry düzenlenmez. Git tracking zaten history'i koruyor |
| Schema kaynağı (OpenAPI) compromised → doc'a kötü içerik | Schema kaynak path'leri **whitelist** (`schema_sources` config) — keyfi dosyadan okumaz |
| BLOCK kararı kullanıcıya bildirilmez (sessizce skip) | Output schema'da `"action": "blocked"` + `reasoning` zorunlu — Claude'un kullanıcıya raporlaması garanti |

**Bu plan kapsamı dışı (ayrı plan):**
- `pre-tool-use.js`'i secret-scanning ile BLOCKING yapma — şu an advisory; v4 Step 9 mantığı oraya taşınabilir.

---

## Migration Plan

> **3-fazlı, max 3 dosya/step kuralına uygun.**

### Faz 1 — Skill iskeleti (3 dosya)
1. `.vibecode/skills/continuous-doc-maintainer/SKILL.md` — v4 spec'in operationalize edilmiş hali (frontmatter + use-cases + 13 adım talimatı + output format)
2. `.vibecode/skills/continuous-doc-maintainer/resources/input-schema.json` — referans
3. `.vibecode/skills/continuous-doc-maintainer/resources/output-schema.json` — referans

### Faz 2 — Slash command + audit dosya (3 dosya)
4. `.claude/commands/vibe-doc-sync.md` — `/vibe-doc-sync [--mode shadow|live] [--tier fast|full] [paths...]`
5. `docs/CHANGELOG_INTERNAL.md` — audit ledger (boş header ile başlat)
6. `.vibecode/skills/continuous-doc-maintainer/resources/audit-log-template.md` — entry şablonu

### Faz 3 — Mevcut sistem entegrasyonu (3 dosya)
7. `.vibecode/standards/documentation.md` — §6: skill referansı
8. `.claude/commands/vibe-done.md` — Step 4'e: "Run continuous-doc-maintainer in shadow mode → review → optional live"
9. `CLAUDE.md` — Slash commands tablosuna `/vibe-doc-sync`

### Faz 4 — Doc + ADR (3 dosya)
10. `docs/CHANGELOG.md` — yeni skill kaydı
11. `docs/decisions.md` — **ADR-005**: Continuous Doc Maintainer (rationale, alternatives: hook vs skill, Mintlify adaptation)
12. `docs/progress.md` — `continuous-doc-maintainer` modülü
13. `docs/architecture/INDEX.md` — bu plana satır (zaten Faz 0'da yazılıyor)

### Doğrulama (her faz sonu)
- `make verify` (lint pass)
- Skill kuru çalıştırma: `/vibe-doc-sync --mode shadow` → output schema'ya uyumlu raporu kontrol et
- Audit log'a örnek entry yazılıyor mu kontrol et

### Rollback
- Tüm dosyalar git altında — `git revert <sha>` yeterli
- Mevcut hiçbir dosyanın **ana akışı** değişmiyor (sadece yeni satır/section ekleme); ana sistem skill yokken de çalışır

---

## Confirmed Decisions

> Kullanıcı onayı sonrası finalize edildi (2026-04-30).

| # | Konu | Karar |
|---|---|---|
| 1 | Mintlify (.mdx/mint.json) | **Plain Markdown ile başla.** İleride Mintlify hedeflenirse skill path konfigürasyonu revize edilir (1 satır path değişikliği). |
| 2 | Audit log konumu | **`docs/CHANGELOG_INTERNAL.md`** — v4 sadakati + tek doc dizini. |
| 3 | `/vibe-done` Step 4 entegrasyonu | **Otomatik, shadow mode.** Skill rapor üretir, yazma user onayıyla yapılır. |
| 4 | Security Linter (Step 9) `pre-tool-use.js`'e taşıma | **Bu plan kapsamı dışı.** Ayrı plan: `pre-tool-use-secret-scan-plan.md` (gelecek iş). v4 Step 9 skill içinde BLOCK olarak kalır. |
| 5 | Schema kaynak fallback | **Warn + skip.** `backend/openapi.json` yoksa Step 6 = no-op. Skill `backend/` yokken de çalışır (prune + audit). |
| 6 | Slash command argüman formatı | Onaylandı: `/vibe-doc-sync` (no args = tüm değişiklikler, shadow), `--live`, `--tier full`, `[paths...]` (tek dosya odaklı). |
| 7 | Idempotency hash kaynağı | **`.vibecode/state/doc-hashes.json`** — ayrı state dosyası, parse karmaşıklığı yok. Git tracking dışı (`.gitignore`). |

### Ek karar: state dosyası git tracking

`.vibecode/state/doc-hashes.json` **gitignore**'a eklenir — local cache niteliğinde, repo'ya commit edilmez. Audit log (`CHANGELOG_INTERNAL.md`) ise git'te kalır (kalıcı kayıt).

---

## Skill İçeriği — Önizleme

> Detay implementation aşamasında yazılır. Burada sadece SKILL.md yapı taslağı.

```markdown
---
name: continuous-doc-maintainer
description: Continuously synchronize documentation with code changes. Audited,
  idempotent, schema-driven, secret-aware. Use after every code change to keep
  docs/api, docs/user, docs/admin in sync. Outputs structured action plan
  (shadow) or applies changes (live).
metadata:
  model: sonnet  # operasyonel, derin reasoning gerekmez
  version: 4.0
---

## When to use
- Code change merged → docs may be stale → run skill
- Called automatically from /vibe-done Step 4 (shadow mode)
- Called manually via /vibe-doc-sync

## When NOT to use
- Docs-only PR (no code change) — skill returns "skip"
- Format-only changes (whitespace, comments) — semantic diff filters out

## Input
[v4 input schema — JSON example]

## Steps
0. Concurrency check (lite: idempotency hash compare)
1-13. v4 spec (target resolve → prune → schema-sync → security lint → AST patch → audit)

## Output
[v4 output schema — JSON example]

## Forbidden
- Writing secrets/PII (Step 9 BLOCK)
- Breaking docs/architecture/INDEX.md links
- Skipping schema validation when schema_sources present
- Duplicate sections in same doc
```

---

## Risk & Mitigation Özeti

| Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|
| Skill yanlış section sileri | Orta | Orta | Shadow mode default + git history + idempotency hash |
| Skill secret leak ediyor | Düşük | Yüksek | Step 9 BLOCK + Edit hook advisory (mevcut) |
| Audit log şişer | Düşük | Düşük | Quarter-bazlı arşiv (`CHANGELOG_INTERNAL_2026Q2.md`) — gelecek iş |
| Token maliyeti `/vibe-done`'da artar | Orta | Düşük | Shadow mode lightweight (yazma yok); FAST tier default |
| Concurrency edge-case (paralel subagent) | Düşük (single-user) | Orta | Lite skip — gelecekte lockfile (kapsam dışı) |

---

## Estimasyon

- **Faz 1-4 toplam:** ~10-12 dosya değişikliği (3 dosya/step kuralı kapsamında 4 step)
- **İmplementation süresi:** 1 oturum (skill yazımı + dökümantasyon — Sonnet ile)
- **Test:** Shadow mode dry-run × 3 senaryo (API change, UI change, delete change)
- **`make verify` pass** zorunlu

---

## Onay sonrası akış

`/vibe-go continuous-doc-maintainer` — uygulama Faz 1'den başlar.
