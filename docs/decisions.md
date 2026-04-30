# Architecture Decision Records

> This file tracks all architectural decisions for the project.
> Format follows `.vibecode/standards/documentation.md §3`.
> New ADRs are added at the bottom. Status updates are made in-place.

---

## ADR-001: Error Memory — Yapılandırılmış Hata Analiz Hafızası
**Date:** 2026-03-26 | **Status:** Accepted

### Context

Claude Code session'ları arasında hata bilgisi kayboluyor. Aynı hatalar tekrar
ediliyor, çözümler yeniden keşfediliyor. HANDOFF.md "Open Questions" bölümü
session-scoped — bir sonraki session'da okunup sonra siliniyor. Kalıcı,
yapılandırılmış ve aranabilir bir hata hafızası mevcut değil.

**Problem boyutu:**
- `make verify` başarısızlıklarında hata + çözüm kaydedilmiyor
- Aynı lint/test/build hataları farklı session'larda tekrar oluyor
- Bilgi sadece HANDOFF.md'de geçici olarak tutuluyor
- 110+ skill + 862 user skill havuzunda hata bağlamı kayıp

### Decision

`.vibecode/memories/errors/` altında yapılandırılmış hata kayıtları tutulacak.

**Dosya formatı:** `[YYYY-MM-DD]-[kategori]-[kısa-açıklama].md`

**YAML frontmatter şeması:**
```yaml
---
date: YYYY-MM-DD
category: build-error | test-failure | lint-error | runtime-error | type-error | migration-error
module: backend/api | frontend/components | docker | alembic | ...
technology: fastapi | react | sqlalchemy | typescript | ...
severity: critical | high | medium | low
resolved: true | false
resolution_session: session-id veya tarih
tags: [ilgili-anahtar-kelimeler]
---
```

**İçerik yapısı:**
```markdown
## Hata
[Hata mesajı / stack trace özeti]

## Bağlam
[Hangi dosya, hangi işlem sırasında, hangi koşullar altında]

## Kök Neden
[Root cause analizi]

## Çözüm
[Ne yapıldı, neden işe yaradı]

## Önlem
[Gelecekte bu hatanın tekrarını önlemek için ne yapılmalı]
```

**İki katmanlı çalışma modeli:**

1. **Otomatik yakalama (auto-capture):**
   - `make verify` başarısız olduğunda → hata + çözüm otomatik kaydedilir
   - `/vibe-done` sırasında çözülen hatalar → memory'ye yazılır

2. **Proaktif kontrol (pre-check):**
   - Yeni task başlarken → ilgili modül/teknoloji hata kayıtları otomatik yüklenir
   - Skill Orchestrator (ADR-002) ile entegre çalışır

**Yaşam döngüsü ve temizlik:**
- 90 günden eski + `resolved: true` → `.vibecode/memories/errors/archive/` altına taşınır
- `resolved: false` kayıtlar süresi ne olursa olsun aktif kalır
- Arşiv, sadece istatistik amaçlı tutulur (hata pattern analizi)

### Alternatives Considered

1. **Serena memories kullanmak:** `.serena/memories/` zaten var ama Serena'ya
   bağımlılık yaratır ve format kontrolü sınırlıdır. Ayrı bir dizin daha
   taşınabilir ve MCP-agnostik.

2. **HANDOFF.md'yi genişletmek:** Session-scoped yapı kalıcı hafıza için
   uygun değil. HANDOFF.md'nin amacı session geçişi, kalıcı bilgi değil.

3. **Claude auto-memory kullanmak:** `~/.claude/projects/` altındaki memory
   sistemi genel amaçlı. Hata kayıtları proje-spesifik ve yapılandırılmış
   olmalı — ayrı bir format gerektirir.

### Consequences

**Olumlu:**
- Aynı hata iki kez yapılmaz → token ve zaman tasarrufu
- Hata pattern analizi yapılabilir → proaktif önlem alınır
- Session bağımsız → her yeni session önceki deneyimlerden faydalanır
- ADR-002 (Skill Orchestrator) ile entegre → "bu modülde sık yapılan hatalar" bağlamı

**Olumsuz:**
- `.vibecode/memories/errors/` dizini büyüyebilir → temizlik mekanizması gerekli (90 gün kuralı)
- Her `make verify` başarısızlığında yazma işlemi → minimal disk I/O overhead
- Hata kayıtlarının kalitesi Claude'un analiz kapasitesine bağlı

**Token etkisi:**
- Task başında ilgili hata kayıtlarını okumak ~500-1000 token → kabul edilebilir
- Temizlik mekanizması dosya sayısını kontrol altında tutar

---

## ADR-002: Skill Orchestrator — Otomatik Skill Öneri Sistemi
**Date:** 2026-03-26 | **Status:** Proposed

### Context

110+ proje skill'i ve 862 kullanıcı skill'i mevcut. `pre-tool-use.js` hook'u
sadece "standart yükledin mi?" uyarısı veriyor — hangi skill'in yüklenmesi
gerektiğini önermez. Skill eşleşmesi tamamen Claude'un kararına bırakılmış
durumda; bu da bazen alakasız skill'lerin yüklenmesine veya kritik skill'lerin
atlanmasına yol açabiliyor.

### Decision

`pre-tool-use.js` hook'u, **bloklayıcı olmayan** bir skill öneri mekanizmasına
kavuşturulacak. Hook, dosya yolları ve task bağlamını analiz ederek ilgili
skill'leri öneri olarak sunacak. Son karar Claude'da kalacak.

**Eşleşme kuralları:**
- Dosya yolu bazlı: `backend/api/` → `fastapi-pro`, `api-design-principles`
- Teknoloji bazlı: `*.tsx` → `react-patterns`, `tailwind-patterns`
- İşlem bazlı: migration dosyası → `database-migrations-sql-migrations`
- Hata hafızası bazlı (ADR-001): modüle özel sık hatalar varsa → ilgili skill öner

**Çıktı formatı:** Advisory (bloklayıcı değil), hook message olarak.

### Alternatives Considered

1. **Ayrı bir skill dosyası:** `.vibecode/skills/skill-orchestrator/SKILL.md` —
   skill olarak tasarlanırsa Claude her session başında okur ama runtime
   eşleşme yapamaz.

2. **Tam otomatik yükleme:** Önermek yerine otomatik yüklemek — token israfı
   riski yüksek, yanlış eşleşmelerde gereksiz context tüketimi.

### Consequences

**Olumlu:** Doğru skill'in doğru zamanda yüklenmesi, token verimliliği
**Olumsuz:** Hook'a eklenen mantık hook çalışma süresini artırabilir

---

## ADR-003: Doc-Sync — Hibrit Doküman Senkronizasyonu
**Date:** 2026-03-26 | **Status:** Superseded by ADR-005 (2026-04-30)

### Context

Doküman güncellemesi şu an tamamen `/vibe-done` checklist'ine bağlı. Session
boyunca hangi dokümanların etkilendiği takip edilmiyor. Geliştirici `/done`
demeyi unutursa veya session beklenmedik şekilde biterse dokümanlar güncel
kalmıyor.

### Decision

**Hibrit yaklaşım:**
1. Session boyunca bir "etkilenen dokümanlar" listesi tutulacak (lightweight tracking)
2. Her dosya yazımında hook, değişikliğin hangi dokümanları etkilediğini listeye ekleyecek
3. `/vibe-done` aşamasında bu liste işlenecek — toplu güncelleme yapılacak

Bu yaklaşım her edit'te tam analiz yapmak yerine sadece dosya yolunu
listeye ekler → minimal token maliyeti.

### Alternatives Considered

1. **Tam otomatik:** Her edit sonrası ilgili dokümanı hemen güncele — token
   maliyeti çok yüksek.
2. **Mevcut durumu korumak:** Sadece checklist ile devam — session kesilmesi
   riskini çözmez.

### Consequences

**Olumlu:** Doküman güncelliği garanti altına alınır, token maliyeti düşük
**Olumsuz:** Tracking state'i session-scoped, beklenmedik session kaybında
liste de kaybolur (HANDOFF.md'ye yedekleme ile azaltılabilir)

---

## ADR-004: Security Review Skill — Otomatik OWASP Top 10 Kod Güvenlik Taraması
**Date:** 2026-03-27 | **Status:** Accepted

### Context

Yazılan kodun güvenliğini doğrulamak için sistematik bir mekanizma yoktu.
Mevcut güvenlik skill'leri (security-auditor, vulnerability-scanner, backend-security-coder)
ya çok geniş kapsamlı ya da yazma odaklıydı — hiçbiri satır bazlı review +
düzeltilmiş kod sunmuyordu. `find-bugs` skill'i branch diff'e bağlıydı ve
tek dosya review desteklemiyordu.

### Decision

Üç katmanlı bir güvenlik review mekanizması oluşturuldu:

1. **Skill:** `.vibecode/skills/security-review/SKILL.md` — Tüm diller için
   OWASP Top 10 kontrol listesi, dil-spesifik pattern'ler (Python, JS/TS,
   Go, Java, C#), satır bazlı bulgu + düzeltilmiş kod formatı.

2. **Slash Command:** `/vibe-security-review [file|last|staged|branch]` — Manuel
   tetikleme için. Dosya yolu, son değişiklik veya branch bazlı review.

3. **`/vibe-done` Entegrasyonu:** Adım 3 olarak otomatik security review. Her task
   tamamlandığında değişen kaynak dosyalar OWASP Top 10'a göre taranır.

**Kapsam kararları:**
- Tüm yazılım dilleri ve framework'ler (sadece Python değil)
- `/done` sırasında otomatik çalışma (onaylandı)
- Skill içeriği İngilizce (proje standardı)

### Alternatives Considered

1. **Hook (post-tool-use):** Her dosya yazımında otomatik çalışma — çok
   gürültülü, aşırı token tüketimi.

2. **Mevcut skill'leri genişletme:** security-auditor veya find-bugs'a ekleme
   — mevcut skill'lerin odağını bulandırır, SRP ihlali.

3. **Sadece skill, command yok:** Otomatik yükleme Claude'un inisiyatifine
   bağlı kalır — manuel tetikleme gerekli.

### Consequences

**Olumlu:**
- Her task tamamlandığında güvenlik review otomatik çalışır
- Satır bazlı bulgular + düzeltilmiş kod → anında aksiyon alınabilir
- Tüm diller desteklenir → frontend + backend birlikte taranır
- `/vibe-security-review` ile isteğe bağlı manuel tetikleme

**Olumsuz:**
- `/vibe-done` akışına eklenen adım toplam token maliyetini artırır (~500-2000 token/dosya)
- Sadece bilinen pattern'leri tarar — sıfır-gün veya iş mantığı hataları kapsamda değil

---

## ADR-005: Continuous Documentation Maintainer — Auditable v4 Skill
**Date:** 2026-04-30 | **Status:** Accepted (supersedes ADR-003)

### Context

ADR-003 doc-sync için "hibrit yaklaşım" önerdi (session tracking + `/vibe-done`
batch update) ama implementasyon ADR-001/ADR-002'ye blocked kaldı. Bu süreçte
manuel checklist (`documentation.md §1`) tek koruma katmanı oldu ve şu eksikleri
ortaya çıkardı:

- **Pruning yok:** Silinen endpoint/UI dökümanlarda kalıyor — manuel takip
- **Schema drift:** OpenAPI/Pydantic değişimi `docs/api/*.md` örneklerine yansımıyor
- **Idempotency yok:** Aynı change için doc tekrar tekrar update edilebiliyor
- **Audit yok:** "Bu doc neden değişti?" sorusu git blame ile araştırılıyor
- **Security riski:** Doc'a yanlışlıkla token/secret yazılabilir (advisory hook
  var ama blocking yok)
- **Format-only diff gürültüsü:** Whitespace değişikliği bile doc update tetikliyor

ADR-003'ün önerdiği session-scoped tracking bu sorunları yapısal olarak çözmüyor —
state session ile birlikte kayboluyor, schema-truth bağlantısı yok, audit trail yok.

Kullanıcı tarafından hazırlanan **"AI Skill v4: Continuous Documentation Maintainer
(Auditable & Concurrent-Safe)"** spec'i bu eksikleri kapsamlı biçimde adresliyor:
13 adımlı pipeline (classification → target → prune → schema-sync → security-lint
→ AST patch → audit), shadow/live mode, idempotency hash, blocking security linter.

### Decision

ADR-003'ün hibrit yaklaşımını **plain-Markdown adapte v4 spec ile değiştir**:

1. **Skill:** `.vibecode/skills/continuous-doc-maintainer/SKILL.md` — 13 adımlı
   pipeline (Step 0 idempotency, Step 1 classification, Step 2 target resolve,
   Step 3 prune, Step 4 global ref-graph [full tier], Step 5 semantic diff,
   Step 6 schema-sync, Step 7 visual diff [disabled], Step 8 section patch,
   Step 9 security linter [BLOCKING], Step 10 nav sync, Step 11 atomic commit,
   Step 12 audit trail, Step 13 validation gate)

2. **Slash command:** `/vibe-doc-sync [--live] [--tier full] [paths...]`

3. **Audit log:** `docs/CHANGELOG_INTERNAL.md` (append-only, machine-parsable,
   git-tracked) — separate from public `docs/CHANGELOG.md`

4. **State (gitignored):** `.vibecode/state/doc-hashes.json` — idempotency
   hashes; local cache, not part of repo

5. **`/vibe-done` integration:** Step 4b runs skill in shadow mode, asks user
   before applying

**Mode policy:** `shadow` is default. `live` requires explicit `--live` OR user
confirmation after shadow preview. Step 9 BLOCK is non-bypassable.

**Mintlify decision:** v4 spec is Mintlify-centric (`.mdx`, `mint.json`). Project
uses plain Markdown — v4 adapted to plain MD. Skill remains Mintlify-portable
via 1-line path config when/if migration happens.

**Concurrency decision:** v4 file-level locks dropped. Single-user assumption →
hash-based idempotency at Step 0 + Step 5 is sufficient. Lockfile-based
concurrency reserved for future multi-agent scenarios.

### Alternatives Considered

1. **Hook-based (`post-tool-use`):** Every Write triggers doc sync. Rejected —
   excessive token cost; format-only filtering needs semantic diff (Step 5)
   which belongs in skill, not hook.

2. **Keep ADR-003's session tracking:** Lightweight but doesn't solve schema
   drift, pruning, audit, security. v4 is structurally superior.

3. **Add Mintlify infrastructure first:** Adopt `.mdx` + `mint.json`, then run
   v4 unmodified. Rejected — Mintlify migration is a separate, larger effort
   (Tome container + build pipeline changes). Plain-MD adaptation gets value now.

4. **Real Markdown AST (mistune/marko):** v4 Step 8 says "AST patch engine."
   Rejected — heading-based string ops cover required use cases without an
   extra dependency. Edit tool's line-number response is sufficient.

5. **Move Step 9 security linter to `pre-tool-use.js`:** Would protect ALL
   Write/Edit (not just docs). Deferred to a separate plan
   (`pre-tool-use-secret-scan-plan.md`) — out of scope here. Skill keeps
   blocking enforcement at the doc boundary for now.

### Consequences

**Positive:**
- Schema-driven sync ensures `docs/api/*.md` examples never drift from OpenAPI
- Pruning eliminates orphaned doc sections after deletions
- Idempotency hash + semantic diff filter eliminates spurious updates
- Blocking security linter prevents secret leakage to docs (closes a real risk
  not covered by current advisory hook)
- Append-only audit log answers "why did this doc change" without git archaeology
- Shadow mode default + user confirmation = incremental rollout, low blast radius
- Replaces manual checklist drift with automated, auditable pipeline

**Negative:**
- `/vibe-done` token cost rises ~1k-3k tokens for shadow run (was ~0 — manual)
- New state file (`.vibecode/state/doc-hashes.json`) must be gitignored
- New audit file (`docs/CHANGELOG_INTERNAL.md`) grows over time — quarterly
  archive policy deferred (low priority)
- Single-user concurrency assumption — multi-agent scenarios need lockfile
  enhancement (deferred)
- Visual diff guard (Step 7) disabled until `docs/user/` populated with
  screenshots

**Out of scope (separate plans):**
- Mintlify migration
- `pre-tool-use.js` blocking secret scan
- Multi-agent doc lockfile

### Migration

ADR-003 status updated to "Superseded by ADR-005." `progress.md` Doc-Sync System
entry replaced by Continuous Doc Maintainer entry. Architecture plan file:
`docs/architecture/continuous-doc-maintainer-plan.md`.
