# Architecture Decision Records

> This file tracks all architectural decisions for the project.
> Format follows `.vibecode/standards/documentation.md §3`.
> New ADRs are added at the bottom. Status updates are made in-place.

---

## ADR-001: Error Memory — Yapılandırılmış Hata Analiz Hafızası
**Date:** 2026-03-26 | **Status:** Proposed — not implemented

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
**Date:** 2026-03-26 | **Status:** Accepted

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

---

## ADR-006: WrongStack Pattern Adoption — Fleet + Hardening (Claude-only)
**Date:** 2026-06-04 | **Status:** Accepted — amended by ADR-009 (/vibe-goal → HANDOFF `## Goal`)

### Context

WrongStack (https://github.com/WrongStack/WrongStack.git) tam teşekküllü, Claude Code'a
alternatif bir terminal AI agent'ı (TypeScript monorepo, ~110 provider, 505-satır kernel,
Director/fleet, SDD, goal engine, AES-256-GCM vault + per-tool permission policy, REPL/TUI/Web).
Kullanıcı bu projeyi inceleyip "iyi fikirleri vibecode'a uyarlayalım, biz sadece Claude için
yapıyoruz, provider kısımlarını dikkate alma" dedi.

vibecode bir agent değil, Claude Code'u yapılandıran bir meta-framework. Dolayısıyla WrongStack'in
**runtime mekaniği** (kernel, kendi agent loop'u, provider katmanı, üç yüzey) doğrudan taşınamaz —
bunları Claude Code zaten sağlıyor. Taşınabilir olan **davranış/politika desenleridir**.

### Decision

WrongStack'in dört desenini Claude Code primitive'leriyle (slash command, subagent, hook, settings)
uyarla. Provider katmanı (OpenAI/Google/models.dev) **tamamen kapsam dışı**. Fork edilmedi,
greenfield agent kurulmadı.

1. **İzin + güvenlik (en yüksek ROI):**
   - `.claude/hooks/permission-policy.js` — risk-tier gate (destructive→hard block exit 2,
     standard→advisory). subjectKey çıkarımı. `VIBE_YOLO=1` kaçış kapısı.
   - `.claude/hooks/net-fs-guard.js` — SSRF guard (private/loopback/metadata + non-http blok,
     `VIBE_ALLOW_PRIVATE_FETCH=1` kaçış) + sistem-yolu containment + symlink-escape blok.
   - `settings.json` deny listesi genişletildi; iki hook PreToolUse'a kaydedildi.
   - Standart: `security.md §7`.

2. **Fleet / multi-agent:** `.claude/agents/*.md` altında 8 rol (explorer, architect, engineer,
   tester, reviewer, bug-hunter, refactor-planner, critic) — WrongStack'in 46-rol kataloğundan
   indirgendi. `agent-dispatch` (heuristik routing) + `subagent-budget-protocol` (delegasyon
   disiplini) skill'leri. `/vibe-fleet` orkestrasyon komutu.

3. **Akış komutları:** `/vibe-sdd` (Spec-Driven Development döngüsü), `/vibe-collab-debug`
   (BugHunter→RefactorPlanner→Critic üçlüsü).

4. **Skill manifest şeması:** `documentation.md §7` — yeni skill'ler için `triggers`/`scope`/`model`
   frontmatter; mevcut 110+ skill opportunistic migrate (mass migration YOK).

**Açık soruların kararı (kullanıcı "full yetki sende" dedi):**
- **8 rol** (46 değil) — config framework için pratik minimum.
- **`/vibe-goal` otonom DEĞİL** — kilitli hedef + günlük (pusula+defter), `/loop` ile denetimli
  tekrar. Otonom eternal-engine reddedildi (kontrolsüz token/komut riski).
- **SSRF default blok + env kaçış kapısı** (sert blok değil) — local-API testi için
  `VIBE_ALLOW_PRIVATE_FETCH=1`.
- **Migration sadece şema + yeni skill** — 110+ skill toplu migrate edilmez.
- **Dosya adı** `wrongstack-pattern-adoption-plan.md` (ham görev string'i yerine).

### Alternatives Considered

1. **Greenfield Claude-only agent kur:** WrongStack mimarisiyle kendi terminal agent'ımızı yaz.
   Reddedildi — devasa effort; Claude Code zaten agent. Kullanıcı "pattern'leri taşı" seçti.
2. **WrongStack'i fork'la, provider katmanını sök:** TS monorepo'yu miras al. Reddedildi —
   bakım yükü + Claude Code ile çift agent. Kullanıcı seçimi: uyarla.
3. **AES-256-GCM secret vault'u taşı:** Reddedildi — Claude Code kendi credential store'unu
   yönetir; kapsam dışı.
4. **46 rolün tamamı:** Reddedildi — config framework için aşırı; 8 öz rol yeterli.
5. **Otonom goal/eternal engine:** Reddedildi (yukarıda) — güvenlik/maliyet riski.

### Consequences

**Positive:**
- Yıkıcı komutlar (rm -rf, force push, fork bomb, curl|bash) ve SSRF/dosya kaçışı artık
  fail-closed bloklanıyor (14 test senaryosu doğrulandı).
- Boş olan `.claude/agents/` artık 8 üretken rolle dolu; subagent fan-out yapılandırılmış.
- `/vibe-sdd` ve `/vibe-collab-debug` gerçek boşlukları dolduruyor (spec-driven + doğrulanmış debug).
- Tüm eklemeler additive ve config-only — çekirdek Claude Code değişmedi, geri alınabilir.
- Newcomer guide (`docs/guides/wrongstack-features-guide.md`) sıfırdan kullanıma izin veriyor.

**Negative:**
- İki yeni PreToolUse hook'u her Bash/Write/Edit/WebFetch'te küçük bir overhead ekler (saf Node,
  bağımlılıksız, parse hatasında exit 0 — session'ı kırmaz).
- Hook'lar nadiren meşru bir komutu bloklayabilir (false positive) — env kaçış kapıları bunu çözer.
- 8 rol + 4 komut + 2 skill bakım yüzeyi ekler.

**Out of scope (bilinçli):**
- Provider soyutlaması, models.dev, üç yüzey (REPL/TUI/Web), kendi kernel/agent loop'u,
  secret vault, better-sqlite3 session storage.

### Migration

Additive — mevcut hiçbir şey kırılmadı. Plan: `docs/architecture/wrongstack-pattern-adoption-plan.md`
(INDEX'e eklendi). Kullanım kılavuzu: `docs/guides/wrongstack-features-guide.md`.

---

## ADR-007: Multi-AI Plan Consultation — DeepSeek Danışma Turu
**Date:** 2026-07-25 | **Status:** Accepted — amended by ADR-009 (planlama Opus, max 1 round)

### Context

`/vibe-plan` tek modelli: Fable subagent standartları okur, araştırır, planı yazar, onay kapısına
sunar. Kullanıcı, plan kalitesini ikinci bir modelin bakış açısıyla artırmak istedi: "önce bizim
model planı hazırlasın, sonra diğer provider'a sorsun, nihai haline beraber getirsinler." İlk etapta
sadece DeepSeek, ama provider + API key eklenebilir/genişletilebilir bir yapı gerekiyor.

Bu, ADR-006'nın (WrongStack) **kasıtlı olarak kapsam dışı** bıraktığı "provider katmanı"na dokunuyor —
o karar WrongStack'in ~110-provider ağır soyutlamasını reddetmişti. Fark: kullanıcı şimdi *gerçekten*
ikinci bir provider istiyor, ama minimal ve config-driven biçimde (ağır registry değil).

### Decision

`/vibe-plan`'e opsiyonel **Step 1.5 "consultation"** eklendi — bir **bounded convergence loop**:

1. **Çok-tur, convergence'a kadar (tek-tur değil).** `max_rounds` cap (default 3). Her round: DeepSeek
   eleştirir → Fable subagent makul önerileri entegre eder + `CONVERGED`/`CONTINUE` verdict verir.
   Döngü `CONVERGED` **veya** `max_rounds` ile durur. **Son söz her zaman Fable'da** — DeepSeek
   danışman; entegrasyon/durdurma kararını asla vermiyor. Döngü orkestrasyonda; script döngüsüz.

2. **İki katmanlı config.** `.vibecode/config/ai-providers.json` (non-secret, git'e girer — provider/
   model/endpoint + `api_key_env` **ismi**, key değeri yok) + ayrı bir **framework secret'ı**. Key
   **projenin kendi `.env`'ine KOYULMAZ**: vibecode başka bir projenin içinde katman olarak
   çalıştığından kök `.env` o uygulamanın env'idir (bkz. kullanıcı geri bildirimi, aşağıdaki refinement).
   Çözüm sırası: (1) shell'de export'lu env var, (2) `$VIBECODE_ENV_FILE`, (3) `.vibecode/providers.env`
   (proje-yerel, gitignored), (4) `~/.config/vibecode/providers.env` (makine-geneli, önerilen).
   Sadece `.vibecode/providers.env.example` tracked.

3. **Danışma turu hook değil, ayrı script.** `.vibecode/scripts/consult-provider.sh` (bash+curl+jq),
   `/vibe-plan` orkestrasyonundan Bash tool ile explicit çağrılır. Hook reddedildi: network I/O + uzun
   timeout hook katmanına uymaz, "opsiyonel + görünür" davranış hook'un sessiz doğasıyla çelişir,
   ADR-006 zaten hook overhead'ini not etmişti. `vibe-update` script deseniyle tutarlı.

4. **Minimal provider abstraction (YAGNI).** Sadece `openai-compatible` kod yolu implemente edildi.
   `request_shape` alanı şemaya **şimdiden** eklendi (ileri-uyum) ama tek geçerli değer var; farklı
   wire-format'lar (anthropic-native/gemini-native) gelecekte `case` dalı olarak eklenecek — şimdi
   yazılmadı.

5. **Fail-open.** Bu bir güvenlik kapısı değil, kalite adımı. Config yok / disabled / key yok / hata /
   timeout → normal tek-modelli akışa sessizce döner. §7 hook'larının fail-closed felsefesinden
   **bilinçli** sapma.

**Kullanıcı kararları ("full otonom, kalan soruların cevabını sen ver"):**
- **Çok-tur** (convergence'a kadar), `max_rounds=3` cap.
- **Tetikleme:** `enabled: true` = otomatik + `--no-consult` per-call kaçış kapısı.
- **Appendix:** aynı plan dosyasında, tur-tur log (`### Round N`).
- **Uzun plan:** round 2+ Appendix hariç gönderilir; token hatası → kısmi-başarıyla dur.
- **Hata logu:** sadece oturum-içi advisory (başarı zaten Appendix'te iz bırakır).
- **`request_shape`:** şimdiden şemada, tek değer destekli.

### Alternatives Considered

1. **PreToolUse/PostToolUse hook** ile Write'ı yakalayıp otomatik tetikle → reddedildi (path filtresi
   kırılgan, network I/O hook'a uymaz, sessiz doğa "görünür danışma" ile çelişir).
2. **Custom MCP tool** olarak danışma → reddedildi (tek REST çağrısı için MCP server aşırı mühendislik).
3. **Tek-tur danışma** → reddedildi (kullanıcı "nihai hale gelene kadar" dedi → convergence loop).
4. **Ağır provider registry** (WrongStack tarzı) → reddedildi (YAGNI; config-driven minimal yeter).
5. **Node/SDK ile script** → reddedildi (repo script'leri bash+jq; yeni runtime tutarsızlık yaratır).

### Consequences

**Positive:**
- Plan kalitesi ikinci bir modelin eleştirisiyle artabilir; şeffaflık (Appendix + tur bildirimi) korunur.
- Provider/apikey katmanı genişletilebilir ama minimal — 2. OpenAI-uyumlu provider = config satırı.
- `enabled: false` default + fail-open → sıfır regresyon riski, geri alınabilir, additive.

**Negative:**
- Plan içeriği üçüncü parti API'ye gidiyor (opt-in + `--no-consult` + `enabled:false` ile yönetiliyor).
- Çok-turlu danışma her round için ek gecikme/maliyet (`max_rounds` cap ile sınırlı).
- Yeni bakım yüzeyi: 1 config + 1 script + Step 1.5 akışı.

**Design refinement (plandan sapma, kayıt altında):** Plan Security §3 "script `.env`'i parse etmesin,
kullanıcı manuel `source .env` etsin" diyordu. İlk implementasyon bunun yerine root `.env`'den tek-key
okuyordu; ancak **kullanıcı geri bildirimi** üzerine bu düzeltildi: vibecode başka bir projenin içinde
kullanıldığından kök `.env` o uygulamanın env'idir ve framework key'i oraya karışmamalı. Nihai tasarım:
script **projenin `.env`'ini hiç okumaz**; key'i env var → `$VIBECODE_ENV_FILE` → `.vibecode/providers.env`
(gitignored) → `~/.config/vibecode/providers.env` (makine-geneli, önerilen) sırasıyla, yalnızca ilgili
tek satırı çıkararak alır (`source`/`eval` YOK, key asla yazdırılmaz). Deny-list'in amacı tam korunur.
Gerekçe: `security.md §8.1–8.2`.

### Migration

Additive — mevcut hiçbir şey kırılmadı; `enabled: false` ile `/vibe-plan` davranışı birebir aynı.
Plan: `docs/architecture/multi-ai-plan-consultation-plan.md` (INDEX'te). Gelecek: 2. provider talebi
gelince `request_shape` case dalı + config satırı (kod değişikliği minimal).

---

## ADR-008: Sözleşme-Spec + Kabul Vakaları — Pseudo-code'suz Sonnet Delegasyonu
**Date:** 2026-09-25 | **Status:** Accepted

### Context

Sonnet-first politikasında Opus, Sonnet'e "mikro-spec" veriyordu: dosya + değişiklik türü +
**pseudo-code** + pattern + YAPMA. Kullanıcı kodu üst modelle değil alt modelle yazdırmanın token /
maliyet dengesini sordu. Analiz: pseudo-code seviyesinde spec yazan Opus kodu fiilen kendisi yazıyor —
en pahalı token türüyle (Opus çıktısı) — ve Sonnet aynısını yeniden yazıyor: iki kez ödeme. Tasarruf
kodlama *döngüsünden* (dosya okuma, test çalıştırma, hata düzeltme) gelir; spec'in görevi bu döngüyü
ucuz modele devretmek ve "bitti"yi makine-doğrulanır kılmak. Ayrıca kabul kriterlerini uygulayıcı
Sonnet'in kendisi test'e çeviriyordu; "bitti" tanımı ucuz modelde kalıyordu.

### Decision

1. **Mikro-spec → sözleşme-spec.** Opus "ne" (imza, tip, veri şekli, hata davranışı) ve "bitti"yi
   (**kabul vakaları tablosu**: `girdi / durum → beklenen`, uç + hata yolları dahil) tanımlar;
   **pseudo-code yazmaz**. İstisna aynen kalır: concurrency / kompleks algoritma / kriptografi → Opus yazar.
2. **Sonnet önce vakaları test yazar (RED), testler geçene kadar kodlar (GREEN).** Vakaları değiştiremez /
   zayıflatamaz; yanlış görünen vaka `BELIRSIZ` olarak raporlanır.
3. **Review'da ana kapı test çıktısı** — geçmiyorsa kod okunmadan geri gönderilir; sonra vaka sadakati
   ve yalnızca diff okunur (tüm dosya değil).
4. **Haiku katmanı: `mechanic` rolü** (9. rol) — rename, pattern'den boilerplate, kod taşıma, doc /
   CHANGELOG. Mantık yazması yasak; mantık gerekirse `engineer`'a yeniden yönlendirilir.
5. 2 deneme kuralı değişmedi.

**Alternatifler:** (a) Mevcut pseudo-code'lu mikro-spec — Opus çıktı token'ını en çok harcayan yol,
reddedildi. (b) Opus kabul testlerini *kod olarak* yazsın — architect read-only ve test kodu yazmak da
Opus çıktı token'ı; vaka tablosu aynı kesinliği çok daha az token'la veriyor. (c) Haiku'yu genel
uygulayıcı yapmak — mantık hatalarında yeniden deneme maliyeti kazancı siler, reddedildi.

### Consequences

- Opus çıktı token'ı azalır (tarif yerine sözleşme + vaka tablosu); pahalı döngü Sonnet'te.
- "Bitti" Opus'un tanımladığı, makinenin doğruladığı bir hedef olur; review daha kısa.
- Belirsiz vakalar erken yüzeye çıkar (`BELIRSIZ`) — Opus'a dönüş sayısı başta artabilir.
- Etkilenen: `.vibecode/standards/architecture.md`, `CLAUDE.md` #9, `engineer` / `architect` /
  `refactor-planner` / yeni `mechanic` ajanları, `agent-dispatch`, `/vibe-fleet`, `/vibe-sdd`,
  `sdd-implementer` prompt'u. Kardeş repo `vibeplan`: `/vibe-breakdown` görevleri aynı "uygulayıcı
  sözleşmesi" alanlarını üretir.


---

## ADR-009: Kural Tutarlılığı + Maliyet Temizliği — Opus Planlama, Tek Delegasyon Standardı, Komut Birleştirme
**Date:** 2026-09-25 | **Status:** Accepted

### Context

Bir denetim, aynı kuralların birden çok yerde farklı ifade edildiğini ve bazı komutların her
çalışmada gereksiz token harcadığını gösterdi:
- Planlama modeli çelişkiliydi: `/vibe-plan` bir "Fable" subagent'ına (`subagent_type: "claude"` —
  bu tip yalnızca yazarın makinesinde var, repo'da tanımlı değil) dispatch ediyordu; CLAUDE.md,
  `architecture.md`, `architect` ajanı ve `/vibe-sdd` ise Opus diyordu.
- Model routing + delegasyon protokolü CLAUDE.md #9-10, `architecture.md §4` ve `/vibe-go §6`'da üç
  kopya halindeydi; 2 deneme kuralı çelişiyordu ("Opus devralır / kendi yazar" vs "Opus talimat
  döndürür → Sonnet uygular").
- `/vibe-goal` ayrı bir `GOAL.md` tutuyordu; HANDOFF.md ile iki ayrı durum dosyası.
  `/vibe-sdd` `/vibe-plan`'dan bağımsız ayrı bir spec dosyası yazıyordu.
- DeepSeek danışma döngüsü default 3 round'du ve her round'da ham eleştiri ana context'e akıyordu.
- `/vibe-done` her çalışmada security-review SKILL'ini (~10 KB), `documentation.md`'yi ve doc-sync
  skill'ini yüklüyor, CHANGELOG'u iki kez güncelliyordu (~6.5k token/çalışma).

### Decision

1. **Planlama = Opus.** `/vibe-plan` plan yazımını `Agent(subagent_type: "general-purpose", model: "opus")`
   ile yapar (Write gerekir; `architect` read-only kalır, `/vibe-fleet` için plan metni döndürür).
   Tüm "Fable" planlama referansları kaldırıldı.
2. **`.vibecode/standards/delegation.md` tek otorite:** model routing, sözleşme-spec protokolü
   (ADR-008 içeriği), 2 deneme kuralı, eskalasyon, `BELIRSIZ:` vs `BLOCKER`. CLAUDE.md, `/vibe-go`,
   README, ajanlar ve `agent-dispatch` yalnızca işaret eder. `architecture.md` sadece planlama
   rehberi + tek plan şablonu (§1.1) tutar.
3. **2 deneme kuralı tek ifade:** 2. başarısız Sonnet denemesinden sonra bir Opus subagent fix'i
   kendisi yazar; 3. Sonnet denemesi yok.
4. **`/vibe-goal` → HANDOFF.md `## Goal`.** Komut ve `GOAL.md` kaldırıldı; `/vibe-go` okur,
   `/vibe-done` günlüğe satır ekler. Otonom değil (ADR-006 kararı korunur). `/vibe-done` ve
   `/vibe-compact` HANDOFF'u yalnızca `.vibecode/templates/HANDOFF.md` şablonuyla yazar.
5. **`/vibe-sdd` onaylı `/vibe-plan` dosyasından başlar:** Requirements + Acceptance Cases + Tasks aynı
   plan dosyasına eklenir; görevler `### Task N:` başlığı taşır (`task-brief` bunlarla ayrıştırır);
   INDEX.md güncellenir. Ayrı `-spec.md` dosyası yok.
6. **DeepSeek danışma: max 1 round** (config default), ana context'e yalnızca entegrasyon özeti.
   API key için vibecode + vibeplan ortak dosyası: `~/.config/vibe/providers.env`.
7. **`/vibe-done` ağır adımları opt-in / delege:** güvenlik taraması `reviewer` subagent'ına
   devredilir (yalnızca bulgular döner, kaynak değişikliği yoksa atlanır); doc-sync yalnızca
   `/vibe-done --full` ile; `documentation.md` okunmaz (satır içi checklist); CHANGELOG tek adım.
   Skill frontmatter şeması `docs/guides/skill-authoring.md`'ye taşındı.

**Alternatifler:** (a) Fable'da kalmak — model repo'da tanımlı olmayan bir ajan tipine bağlıydı,
taşınabilir değil. (b) Planlamayı repo-tanımlı `architect`'e Write vererek yapmak — `architect`'in
read-only garantisini bozar; reddedildi. (c) `/vibe-goal`'ı tutmak — ikinci durum dosyası ve ek
komut yüzeyi, kazancı yok.

### Consequences

- Bir kural değişikliği tek dosyada yapılır; CLAUDE.md küçüldü (her oturumda yüklenen token azaldı).
- `/vibe-done` standart çalışması ana context'e skill/standart yüklemez; tam kapsam için `--full`.
- Planlama maliyeti Opus fiyatında; danışma turu tek round ile sınırlı.
- `/vibe-goal` kullananlar HANDOFF `## Goal`'a geçer; `GOAL.md` artık okunmaz.
- Etkilenen: `CLAUDE.md`, `README.md`, `.claude/commands/{vibe-plan,vibe-go,vibe-sdd,vibe-done,vibe-compact,vibe-status,vibe-collab-debug,vibe-fleet}.md`,
  `.claude/agents/{architect,engineer,refactor-planner}.md`, `.vibecode/standards/{architecture,delegation,documentation}.md`,
  `.vibecode/prompts/sdd-implementer.md`, `agent-dispatch` + `handoff-protocol` skill'leri,
  `.vibecode/templates/HANDOFF.md`, `docs/architecture/INDEX.md`, `docs/guides/`.

---

## ADR-010: vibeplan Akışının vibecode'a Taşınması — Keşif + Understanding Lock, Madde Bazlı DeepSeek Tartışması
**Date:** 2026-09-25 | **Status:** Accepted

### Context

Kardeş planlama reposu vibeplan'da `/vibe-plan` iki özellik kazandı: (1) fikirden başlayan keşif
soruları + Understanding Lock (onayla / düzelt / "sadece fikir olarak kaydet"), (2) planı DeepSeek'e
eleştirten ve her itiraz maddesinde uzlaşılana kadar dönen madde bazlı tartışma döngüsü. Kullanıcı bu
oturumda konuşulan her şeyin vibecode'da da olmasını istedi. vibecode'un `/vibe-plan`'ı ise keşif
yapmadan doğrudan plana geçiyor ve DeepSeek'i yalnızca tek turluk, madde takibi olmayan bir danışman
olarak kullanıyordu (ADR-007, varsayılan kapalı).

### Decision

1. **Step 0.7 — Keşif + Understanding Lock** ana oturumda: tek tek sorular (problem/kullanıcılar,
   kapsam/kapsam dışı, entegrasyon/ölçek; stack tercihi sorulmaz), sonra onay kapısı. "Sadece fikir"
   seçeneği planı `**Status:** concept` ile yazar; sonraki `/vibe-plan <slug>` kaldığı yerden devam eder.
   Onaylı Lock metni Opus planlayıcıya bağlayıcı girdi olarak verilir.
2. **Madde bazlı tartışma** — `.vibecode/scripts/deepseek-debate.js` (vibeplan'daki
   `deepseek-critique.js`'in uyarlaması; bağımlılıksız Node, testli). Opus planlama subagent'ı planı
   yazdıktan sonra aynı bağlamda döngüyü yürütür (Step 1e): DeepSeek itiraz eder, planlayıcı her maddeyi
   kabul edip planı düzeltir ya da gerekçeyle reddeder; `open → resolved → agreed`, `reopen`,
   tur limitinde `decided-by-claude` (plana Open Question olarak düşer). Yakınsama: tur 1 ≤ 8, sonra
   ≤ 3 yeni itiraz, tur 3+ yalnızca `high`. Kayıt `docs/architecture/debates/<slug>.{json,md}`,
   plan başlığında `**Revision:** N`. `consult-provider.sh` kaldırıldı.
3. **Config ve anahtar aynen** — `.vibecode/config/ai-providers.json` (sağlayıcı, model, zaman aşımı,
   `max_tokens`) ve anahtar çözüm sırası (env → `$VIBECODE_ENV_FILE` → `.vibecode/providers.env` →
   `~/.config/vibe/providers.env` → eski yol). Değişen: `enabled: true` (anahtar yoksa zaten atlanır),
   `max_rounds: 4` (ADR-009'daki 1 turluk sınır yerine — madde bazlı tartışma tek turda anlamsız).
   Bayrak: `--no-debate` (`--no-consult` takma adı).
4. Plan şablonu (`architecture.md §1.1`): `**Status:**`, `**Revision:**`, *Non-Goals*, *Assumptions*,
   *Decision Log* eklendi.
5. Hook komutları `"$CLAUDE_PROJECT_DIR"/.claude/hooks/...` ile mutlak — çalışma dizini değişince kırılmaz.

**Alternatifler:** (a) Tek turluk danışmayı korumak — kullanıcının istediği "her konuda karar kılana kadar"
davranışını sağlamıyor. (b) Tartışmayı ana oturumda (Sonnet) yürütmek — planlama kararları Opus'ta
(ADR-009); itirazlara cevap planlama işidir. (c) Keşfi Opus subagent'ında yapmak — subagent kullanıcıya
soru soramaz.

### Consequences

- vibecode ve vibeplan aynı planlama akışına sahip; iki repo aynı anahtar dosyasını paylaşır.
- Anahtar tanımlıysa plan metni varsayılan olarak DeepSeek'e gider — hassas planlarda `--no-debate`
  ya da `enabled: false` (bkz. `docs/guides/framework-security.md §2`).
- Bir `/vibe-plan` en fazla 4 DeepSeek turu + planlayıcının cevapları kadar ek maliyet getirir.
- ADR-007 ve ADR-009'un DeepSeek kısmı (tek tur) bu kararla değişti.

---

## ADR-011: Proje Hafızası Repoda
**Date:** 2026-09-25 | **Status:** Accepted

### Context

Kullanıcı private geliştirme yapıyor ve zaman zaman sunucuyu tamamen silip repoyu yeni sunucuya
çekiyor. Claude'un auto memory'si `~/.claude/projects/<proje>/memory/`, Serena hafızası `.serena/`
(gitignore'da) altındaydı — her yeniden kurulumda kayboluyordu.

### Decision

- Claude Code'un `autoMemoryDirectory` ayarı ile auto memory `.vibecode/memory/`'ye (commit edilir)
  yönlendirilir. Ayar mutlak yol istediği için commit edilen `settings.json`'a değil, makineye özel ve
  gitignore'daki `.claude/settings.local.json`'a session-start hook'u yazar (mevcut anahtarlar korunur,
  idempotent). Ayar açılışta okunduğu için değişiklik bir sonraki oturumda etkinleşir.
- CLAUDE.md `@.vibecode/memory/MEMORY.md` import eder — yeni sunucudaki ilk oturum da hafızayı görür.
- `.serena/memories/` git'e alınır (`.serena/*` + `!.serena/memories/`); Serena config/cache makineye özel kalır.
- `/vibe-done` önerdiği commit'e hafıza değişikliklerini dahil eder; `/vibe-compact` listeler.
- Fresh-clone bootstrap vibecode'un kendi hafızalarını siler (yeni proje devralmaz).
- **Sır yazılmaz** — hafıza git geçmişine girer; yalnızca private repolar için.

### Consequences

- Sunucu silinip `git clone` yapıldığında hafıza geri gelir (ilk oturum import ile, ikinci oturumdan
  itibaren yazma da repoya).
- Hafıza içeriği repo erişimi olan herkese görünür — public repoda kullanılmamalı.
- Plugin tasarımında (HANDOFF Goal) hafıza "projede kalanlar" arasındadır.

