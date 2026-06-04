# Architecture Plan: WrongStack Pattern Adoption (Claude-only)

> **Kaynak görev:** "https://github.com/WrongStack/WrongStack.git projesini incele … biz sadece
> Claude için yaptığımız için diğer provider kısımlarını dikkate alma."
> **Karar (kullanıcı onayı ile):** WrongStack'in **iyi fikirlerini mevcut vibecode Claude Code
> framework'üne** skill / hook / slash-command / standard / agent-definition olarak uyarla.
> Yeni bir agent **kurmuyoruz**, WrongStack'i fork **etmiyoruz**.
> **Not:** Dosya adı `/vibe-plan` şablonundaki ham görev string'i yerine anlamlı slug ile yazıldı.

---

## Overview & Goals

WrongStack, Claude Code'a alternatif **kendi başına çalışan terminal AI coding agent**'ıdır:
TypeScript pnpm-monorepo, 505-satırlık çekirdek (Container · Pipeline · EventBus · RunController),
agent loop, 36 tool, 16 skill, Director/fleet çoklu-agent sistemi (46 rol), otonom goal loop'ları,
SDD döngüsü, MCP client, AES-256-GCM secret vault + per-tool permission policy ve üç yüzey
(REPL · Ink TUI · Web UI). ~110 provider'ı models.dev'den canlı çeker.

**vibecode ise bir agent değil** — Claude Code'u yapılandıran bir meta-framework'tür: 110+ skill,
`vibe-` slash command'ları, lifecycle hook'ları, path-scoped rule'lar, 10 standard. Dolayısıyla
WrongStack'in **runtime mekaniği** (kernel, agent loop, provider katmanı, üç yüzey) bize **doğrudan
taşınamaz** — onları Claude Code zaten sağlıyor. Taşınabilir olan, WrongStack'in **davranış ve
politika tasarımı**dır.

**Hedef:** WrongStack'in en değerli, vibecode'da **henüz karşılığı olmayan** desenlerini, Claude
Code primitive'leri (`settings.json` permission, PreToolUse hook, `.claude/agents/` subagent
tanımları, Agent tool ile subagent fan-out, slash command) üzerinden hayata geçirmek. Mevcut 110+
skill ile **çakışma/duplikasyon yaratmadan**, sadece gerçek boşlukları doldurmak.

### Provider katmanı = kapsam dışı (bilinçli)

WrongStack'in `packages/providers/` (OpenAI, Google, OpenAI-compatible), `models-registry.ts`
(models.dev fetch), wire-format soyutlaması — hepsi **bize gereksiz**. vibecode zaten Claude'a bağlı.
Bu plan provider soyutlamasını **tamamen yok sayar**; sadece Anthropic'e özgü davranışları
(prompt caching, extended thinking, tool use) "Claude Code zaten yapıyor" diye geçer.

---

## Mapping: WrongStack subsystem → vibecode'da karşılığı

Q2'de dört alan da seçildi. Her birinin vibecode'a **taşınabilirlik** durumu:

| WrongStack alanı | Taşınabilir mi? | vibecode karşılığı |
|---|---|---|
| **Çekirdek + tek-agent loop** | Kısmen — loop Claude Code'un | Skill manifest şeması, layered skill override (zaten var), HANDOFF=session-state, /vibe-compact=compaction. **Çoğu zaten mevcut.** |
| **İzin + güvenlik** | ✅ Yüksek | `settings.json` risk-tier permission + PreToolUse policy hook + SSRF/symlink/env-hardening hook + standard. **Gerçek boşluk.** |
| **Multi-agent / fleet** | ✅ Yüksek | `.claude/agents/*.md` rol roster'ı (şu an **boş**) + `/vibe-fleet` dispatcher + SDD/goal/collab komutları. **En büyük boşluk.** |
| **Surface'ler (REPL/TUI/Web)** | ❌ Hayır | Claude Code yüzeyi sağlar. Sadece statusline UX deseni (opsiyonel). **Büyük ölçüde kapsam dışı.** |

> **Dürüst kısıt:** "Surface" ve "core loop" maddeleri Q2'de seçildi ama bir *config framework*'e
> taşınamaz çünkü bunları Claude Code'un kendisi sağlıyor. Aşağıda her biri için en yakın analog
> verildi ve neden kapsam dışı olduğu işaretlendi. Asıl yatırım **İzin+Güvenlik** ve **Fleet**'e.

---

## Directory Structure Changes

Yeni/değişen dosyalar (hepsi config/doc — kaynak kod değil):

```
.claude/
├── agents/                              # ŞU AN BOŞ — doldurulacak (rol roster'ı)
│   ├── explorer.md                      # discovery/araştırma
│   ├── architect.md                     # planlama
│   ├── engineer.md                      # build (Sonnet micro-spec uygulayıcı)
│   ├── tester.md                        # verify
│   ├── reviewer.md                      # review/critic
│   ├── bug-hunter.md                    # collab-debug rolü
│   ├── refactor-planner.md              # collab-debug rolü
│   └── critic.md                        # collab-debug rolü
├── hooks/
│   ├── permission-policy.js             # YENİ — risk-tier + subjectKey PreToolUse gate
│   └── net-fs-guard.js                  # YENİ — SSRF/private-IP + symlink + bash-env guard
├── commands/
│   ├── vibe-fleet.md                    # YENİ — Director/dispatcher orkestrasyonu
│   ├── vibe-sdd.md                      # YENİ — Spec-Driven Development döngüsü
│   ├── vibe-goal.md                     # YENİ — kilitli goal + journal + loop sürücü
│   └── vibe-collab-debug.md             # YENİ — 3-rol paralel debugging
└── settings.json                        # GÜNCEL — risk-tier permission grupları + yeni hook'lar

.vibecode/
├── standards/
│   └── security.md                      # GÜNCEL — §X risk-tier permission + net/fs hardening
└── skills/
    ├── agent-dispatch/                  # YENİ — heuristik rol routing skill'i
    └── subagent-budget-protocol/        # YENİ — budget/checkpoint disiplini

docs/
├── architecture/wrongstack-pattern-adoption-plan.md   # bu dosya
├── architecture/INDEX.md                              # GÜNCEL — bir satır eklenir
└── decisions.md                                       # GÜNCEL — ADR eklenir (onaydan sonra)
```

---

## Tech Decisions (her biri gerekçeli)

### 1. Permission: risk-tier + subjectKey modeli (WrongStack `permission-policy.ts`'den)

WrongStack'in 6-adımlı policy'si: namespace → tool-name → **subjectKey** (input'un hangi alanı
güven konusu: bash→`command`, fetch→`url`) → session soft-deny/allow → trust kuralları → **riskTier
gating** (YOLO modunda bile `destructive` tool onay ister). vibecode'un mevcut `settings.json`'ı düz
allow/deny glob listesi — risk katmanı ve subjectKey eşleştirmesi yok.

**Karar:** `settings.json`'a risk-tier'a göre gruplanmış allow/deny + bir **PreToolUse
`permission-policy.js`** hook'u ekle. Hook, tool input'unu subjectKey mantığıyla okuyup
`destructive` desenleri (ör. `rm -rf`, `git reset --hard`, `chmod 777`, `> .env`) için
**fail-closed** (exit kod ile blok) uygular. Mevcut deny listesi korunur, hook ek savunma katmanıdır.
**Gerekçe:** Claude Code hook + permission API'si bu deseni native destekler; glob escaping +
subjectKey, "crafted `bash:git **`" gibi kaçışları kapatır.

### 2. Net/FS hardening hook (WrongStack `fetch.ts` / `replace.ts` / `_env.ts`'den)

WrongStack: SSRF guard (private IPv4/IPv6 aralıkları + her redirect hop'ta yeniden doğrulama),
symlink containment (`lstat`+`realpath` ile projectRoot dışına yazmayı reddet), bash env allowlist
(TOKEN/SECRET/PASSWORD/KEY strip).

**Karar:** Bir **PreToolUse `net-fs-guard.js`** hook'u: (a) `WebFetch` URL'lerini private/loopback
IP'lere karşı kontrol et (DNS lookup + numeric range check), (b) `Write`/`Edit` hedefini symlink/
projectRoot-dışı için kontrol et, (c) `Bash` komutlarında secret-env passthrough kalıplarını uyar.
**Gerekçe:** Claude Code'un kendi sandbox'ı var ama proje-seviyesi defensive katman, özellikle
WebFetch SSRF'i için ek güvence sağlar. `bash-defensive-patterns` skill'i zaten mevcut — hook onu
**zorlayıcı** hale getirir.

### 3. `.claude/agents/` rol roster'ı + dispatcher (WrongStack Director/`dispatcher.ts`'den)

WrongStack'in en güçlü deseni: 46-rol roster + iki aşamalı dispatcher (heuristik keyword scoring →
düşük güvende LLM fallback) + subagent izolasyonu (budget + JSONL transcript + fail-closed).
vibecode'da `.claude/agents/` **boş** — Claude Code subagent tanımlarını native destekliyor.

**Karar:** WrongStack'in 46-rol kataloğunu **8 öz role indirgenmiş** `.claude/agents/*.md` olarak tanımla
(explorer, architect, engineer, tester, reviewer, bug-hunter, refactor-planner, critic). Her dosya:
frontmatter (`name`, `description`, `tools`, `model`) + sistem promptu (rol + YAPMA listesi).
**`agent-dispatch` skill'i** WrongStack'in heuristik scoring'ini taklit eder: serbest görevi
keyword'lere göre role yönlendirir, belirsizse kullanıcıya "BELIRSIZ" raporlar (Sonnet-first kuralı).
**Gerekçe:** 46 rol bir config framework için aşırı; 8 rol Claude Code'un 9-fazlı WrongStack
kataloğunu pratik olarak karşılar ve mevcut Opus↔Sonnet delegasyon protokolüyle (architecture.md §4)
hizalanır. Model routing: engineer/tester → Sonnet, architect/critic → Opus.

### 4. `/vibe-fleet` — Director orkestrasyonu

**Karar:** `Agent` tool ile paralel subagent fan-out yapan, sonuçları "roll-up" eden slash command.
WrongStack'in `FleetUsageAggregator` + `fleet.json` manifest'i → basit bir markdown roll-up + HANDOFF
güncellemesi. `subagent-budget-protocol` skill'i WrongStack'in `SubagentBudget`'ını **kural** olarak
kodlar: max 2 deneme (zaten CLAUDE.md'de), her subagent'a micro-spec, dönüşte Opus review.
**Gerekçe:** Claude Code Agent tool'u hard token-budget expose etmez; budget'ı **disiplin kuralı**
olarak (iterasyon/deneme sınırı + scope) uygularız.

### 5. `/vibe-sdd` — Spec-Driven Development döngüsü

**Karar:** WrongStack'in 6-fazlı SDD'sini (Questioning → Spec review → Implementation plan → Task
review → Executing → Done) `/vibe-plan` ile `/vibe-go` arasına oturan bir komut yap. Spec'i
`docs/architecture/<feature>-spec.md`'ye, task listesini dependency-sıralı yaz, `executing-plans` ve
`phase-gate` skill'lerini kullan. **Gerekçe:** `/vibe-plan` tek-atış mimari plan üretiyor; SDD
soru-cevap ile spec çıkarıp **task decomposition + critical-path** ekler — gerçek bir boşluk.

### 6. `/vibe-goal` ve `/vibe-collab-debug` (orta öncelik)

- **`/vibe-goal`:** WrongStack eternal/parallel engine'in (DECIDE→EXECUTE→REFLECT) hafif versiyonu.
  Kilitli hedef + journal'ı `HANDOFF.md` yanında `GOAL.md`'de tutar, user-level **`/loop`** skill'ini
  sürücü olarak kullanır (yeni loop motoru yazmayız). `[GOAL_COMPLETE]` marker + verification gate.
- **`/vibe-collab-debug`:** WrongStack `collab-debug.ts`'in 3-rol paralel deseni (bug-hunter →
  refactor-planner → critic), paylaşılan snapshot üzerinden. Mevcut `debugger`/`find-bugs`/
  `code-reviewer` skill'lerini rollere bağlar.

### 7. Skill manifest şeması standardizasyonu (düşük öncelik, "core loop" analog'u)

**Karar:** WrongStack'in `SKILL.md` frontmatter + trigger/scope metadata'sını referans alıp
vibecode skill'leri için **tutarlı frontmatter şeması** (`name`, `description`, `triggers`, `scope`,
`model`) standardize et. Layered override (project > user > bundled) zaten CLAUDE.md'de var —
sadece belgelenir. **Gerekçe:** Lazy-loading kararlarını iyileştirir; ama 110+ skill'i migrate etmek
büyük iş → sadece **şema + yeni skill'ler** için zorunlu, eskiler opportunistic.

---

## Database Schema

N/A — vibecode bir config framework'ü; veritabanı yok. WrongStack'in `better-sqlite3` session
storage'ı bize taşınmıyor (HANDOFF.md + Serena memory + error-memory zaten session state sağlıyor).

## API Contract

N/A — yeni HTTP endpoint yok. "Kontrat" burada **slash-command arayüzleri**dir:

| Command | Argümanlar | Çıktı |
|---|---|---|
| `/vibe-fleet [task]` | görev tanımı | paralel subagent sonuçları + roll-up + HANDOFF güncelleme |
| `/vibe-sdd [feature]` | özellik adı | `<feature>-spec.md` + task listesi → onay → execute |
| `/vibe-goal [set\|pause\|resume\|clear\|journal]` | hedef metni | `GOAL.md` + journal; /loop sürücü |
| `/vibe-collab-debug [paths]` | dosya yolları | bug-hunter+refactor+critic raporu |

## Docker Services

N/A — yeni container yok.

## Port Assignments

N/A — yeni servis yok. (WrongStack'in 3456/3457 webui portları kapsam dışı.)

---

## Security Considerations

Bu planın **çekirdeği zaten güvenlik**. Eklenen savunma katmanları:

- **Fail-closed PreToolUse hook'ları:** `permission-policy.js` + `net-fs-guard.js` mevcut deny
  listesinin üstüne risk-tier ve SSRF/symlink kontrolü ekler. Hook hata verirse **blok** (fail-closed).
- **Secret hijyeni:** WrongStack secret-scrubber deseni → hook'lar log'a secret yazmaz; mevcut
  `Read(**/.env)` deny + `cat *.env` deny korunur, genişletilir (AWS/JWT/GitHub PAT kalıpları).
- **Subagent izolasyonu:** `subagent-budget-protocol` her subagent'ı scope + deneme limiti ile
  sınırlar; fail-closed (2 başarısızlıkta Opus devralır, sonsuz döngü yok).
- **Kapsam dışı (Claude Code yönetir):** AES-256-GCM vault — Claude Code kendi credential store'unu
  kullanır; kendi vault'umuzu yazmıyoruz. `docs/decisions.md`'ye ADR olarak not düşülür.

---

## Migration Plan (fazlı, kırmadan)

Mevcut hiçbir şeyi bozmadan, additive sırayla. Her faz bağımsız değer üretir.

**Faz 0 — Onay + ADR (kod yok)**
- Bu plan onaylanınca `docs/decisions.md`'ye ADR ekle: "WrongStack pattern adoption — Claude-only,
  provider katmanı kapsam dışı, fork değil."

**Faz 1 — İzin + Güvenlik (en yüksek ROI, en düşük risk)**
1. `security.md`'ye §X risk-tier permission + net/fs hardening bölümü ekle.
2. `permission-policy.js` PreToolUse hook + `settings.json` risk-tier grupları.
3. `net-fs-guard.js` PreToolUse hook (SSRF + symlink + bash-env).
4. Doğrulama: hook'lar mevcut allow'ları kırmıyor; destructive desenler bloklanıyor (manuel test).

**Faz 2 — Fleet / Multi-agent (en büyük boşluk)**
1. `.claude/agents/*.md` 8 rol tanımı (model routing ile).
2. `agent-dispatch` + `subagent-budget-protocol` skill'leri.
3. `/vibe-fleet` komutu (paralel fan-out + roll-up).
4. Doğrulama: küçük bir görevi `/vibe-fleet` ile 2-3 subagent'a böl, roll-up doğru.

**Faz 3 — SDD + Goal + Collab (akış komutları)**
1. `/vibe-sdd` (önce — `/vibe-plan` ile en çok sinerji).
2. `/vibe-collab-debug` (mevcut debug skill'lerini rollere bağlar).
3. `/vibe-goal` (en son — `/loop` bağımlılığı, dikkatli scope).

**Faz 4 — Skill manifest standardizasyonu (opportunistic)**
1. Frontmatter şemasını `documentation.md`'ye yaz.
2. Yeni skill'lere zorunlu; eski 110+ skill opportunistic migrate.

**Her faz sonunda:** `make verify` (varsa), CHANGELOG.md güncelle, INDEX güncel.

---

## Open Questions → RESOLVED (kullanıcı "full yetki sende" dedi — 2026-06-04)

Tüm açık sorular karara bağlandı ve **uygulandı**. Karar kaydı: `docs/decisions.md` ADR-006.

1. **Rol sayısı:** ✅ **8 öz rol** (WrongStack'in 46'sından indirgendi). `security-auditor`/
   `database-architect` zaten skill olarak mevcut — rol olarak tekrarlanmadı.
2. **`/vibe-goal` riski:** ✅ Otonom eternal-engine **reddedildi**. Komut "kilitli hedef + günlük"
   (pusula+defter); denetimli tekrar için `/loop` sarmalayıcı. Hiçbir unbounded autonomy yok.
3. **Hook agresifliği:** ✅ SSRF default **blok** + env kaçış kapısı: `VIBE_ALLOW_PRIVATE_FETCH=1`
   (local-API testi için). Ayrıca destructive izin için `VIBE_YOLO=1`.
4. **Migration kapsamı:** ✅ Sadece **şema + yeni skill**. 110+ skill toplu migrate edilmez
   (opportunistic). `documentation.md §7`.
5. **Dosya adı:** ✅ `wrongstack-pattern-adoption-plan.md` onaylandı.

## Implementation Status: DONE (2026-06-04)

Faz 1-3 tamamen uygulandı, Faz 4 (şema) belgelendi. Güvenlik hook'ları 14 senaryoyla test edildi.
Kullanım kılavuzu: `docs/guides/wrongstack-features-guide.md`. Tüm dosyalar CHANGELOG'da listeli.
```
