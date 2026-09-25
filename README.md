# Vibecode — Claude Code Plugin

> AI destekli yazılım geliştirmede tutarlı, güvenli ve token-verimli projeler için
> iş akışı, standartlar ve yönetişim — **Claude Code plugin'i** olarak. Makineye bir kez kurulur,
> her projede `/vibecode:init` ile açılır.

---

## Ne İşe Yarar?

Vibecode, Claude Code ile yazılım geliştirirken karşılaşılan temel sorunları çözer:

| Sorun | Çözüm |
|-------|-------|
| Her projede aynı dosyaları tekrar yazıyorsun | **Plugin** — framework tek yerde; proje yalnızca kendi verisini tutar (`/vibecode:init`) |
| Session geçişlerinde bağlam kaybı | **HANDOFF.md** + **`/vibe-go`** ile otomatik yükleme |
| Uzun SDD çalışmalarında context compaction = ilerleme kaybı | **`.vibecode/sdd/progress-<feature>.md`** ledger — kaldığın yerden devam |
| Subagent prompt'ları görev metniyle şişiyor | **File handoff scripts** — görev ve diff dosyaya yazılır, path geçilir |
| Hangi skill'i yüklemem gerektiği belirsiz | **Otomatik stack detection** — config dosyalarından skill tespiti |
| Doğru standart yüklenemiyor | **pre-tool-use hook** — dosya path'ine göre uyarı |
| Opus'ta rutin iş = pahalı | **Sonnet-first routing** — hook Opus tespit ederse `/model sonnet` önerir |
| Plan discovery için `ls` token yiyor | **`docs/architecture/INDEX.md`** — tek otorite, targeted Read |
| vibecode gelişince projelerin eski sürümde kalıyor | **`/plugin marketplace update vibecode`** — tüm projeler aynı anda güncellenir |
| Sunucu silinip repo yeniden çekilince her şey kayboluyor | Proje `.claude/settings.json`'da plugin bildirimi + hafıza repoda — klasöre güvenince geri gelir |
| Plan tek modelin bakış açısıyla sınırlı | **DeepSeek tartışması** — `/vibe-plan` planı DeepSeek'e eleştirtir, her itiraz madde madde uzlaşılana (en fazla 4 tur) kadar tartışılır |

---

## Hızlı Başlangıç

### 1. Plugin'i kur (makinede bir kez)

Claude Code içinde:

```
/plugin marketplace add bahadirdemircioglu/vibecode
/plugin install vibecode@vibecode
```

(`add` tam adresi de kabul eder: `https://github.com/bahadirdemircioglu/vibecode`. Terminalden:
`claude plugin marketplace add …` + `claude plugin install vibecode@vibecode`.)

Gereksinimler: Node.js ≥ 18 (hook'lar, kurulum script'i, Context7) ve `uv` (Serena). **Önceden kurman gerekmez** —
`/vibecode:init` eksikse kendisi kurar (aşağıda). Node yokken plugin'in hook'ları hata vermeden atlanır ve oturum
başında tek satırlık bir `MISSING` uyarısı çıkar.

### 2. Projede başlat (proje başına bir kez)

```bash
git clone <projen> && cd <projen>
claude
```
```
/vibecode:init
```

`/vibecode:init` önce **bağımlılıkları zorunlu olarak kurar** (`.vibecode/scripts/install-deps.sh`), kurulamazsa durur:
- **Node.js ≥ 18** + npm/npx — paket yöneticisiyle (apt/dnf/yum/apk/pacman/brew); dağıtımın sürümü 18'den eskiyse
  NodeSource (Node.js'in resmi apt/rpm paketleri)
- **uv** — brew/pacman paketi, yoksa Astral'ın resmi kurulum script'i (root iken `/usr/local/bin`'e, değilse `~/.local/bin`'e)
- **Serena** — bir kez çalıştırılıp uv önbelleğine alınır (ilk oturumda MCP hemen açılsın diye)

Sistem paketi için root ya da şifresiz sudo gerekir; ikisi de yoksa çalıştırman gereken komutu yazar
(`! sudo bash …/install-deps.sh`). Bir şey kurulduysa oturumu yeniden başlatmanı ister. Hook'lar hiçbir zaman
kendiliğinden kurulum yapmaz — kurulum yalnızca bu komutla, senin çağırmanla olur.

Sonra projeyi hazırlar — yalnızca **eksik** olanı oluşturur, hiçbir dosyanın üzerine yazmaz:
- `docs/` iskeleti (CHANGELOG, decisions, progress, `architecture/INDEX.md`, `constraints/`) ve `.vibecode/memory/`
- `.gitignore`'a vibecode satırları
- `.claude/settings.json`: vibecode izinleri (birleştirilir) + **plugin bildirimi** (`extraKnownMarketplaces` +
  `enabledPlugins`) — repo başka bir makinede/sunucuda klonlanınca klasöre güven verildiğinde vibecode marketplace'i
  kendiliğinden eklenir; plugin'i etkinleştirmek için bir kez `/plugin install vibecode@vibecode` yeterli (aşağıya bak)
- `.claude/settings.local.json`: hafıza konumu (`autoMemoryDirectory` → `.vibecode/memory`)
- `.serena/project.yml` (yoksa)

Sonra önerilen commit'i onayla. Plugin'in hook'ları **yalnızca init edilmiş projelerde** (kökte `.vibecode/` dizini
olan) çalışır; diğer projelerinde vibecode sessiz kalır.

### 3. Çalışmaya başla

Her oturum `/vibe-go <görev>` ile başlar (görev adı serbest metin — örnek: `/vibe-go kullanici-yonetimi-ekle`);
önceki oturumdan devam ediyorsan `/vibe-go devam` yeterli (HANDOFF.md okunur). Sonrası işin türüne göre:

| Durum | Komut |
|-------|-------|
| Her oturumun başı — durumu ve uygun skill'leri yükle | `/vibe-go <görev>` |
| Yeni özellik / mimari değişiklik (fikirden onaylı plana) | `/vibe-plan <fikir>` |
| Onaylanmış planı adım adım, testli uygula | `/vibe-sdd <özellik>` |
| Büyük işi paralel rol ajanlarına dağıt | `/vibe-fleet <görev>` |
| Çözülemeyen bug | `/vibe-collab-debug <bug>` |
| Güvenlik taraması | `/vibe-security-review [dosya]` |
| İş bitti — doğrula, dokümante et, HANDOFF yaz, commit öner | `/vibe-done` |
| Bağlam doldu / göreve ara ver | `/vibe-compact` |
| Oturum durumu | `/vibe-status` |

Tipik büyük özellik akışı: `/vibe-go` → `/vibe-plan` → (onay) → `/vibe-sdd` → `/vibe-done`. Küçük işte:
`/vibe-go` → doğrudan çalış → `/vibe-done`.

Komutlar öneksiz çalışır (`/vibe-go`); çakışma olursa tam adı `/vibecode:vibe-go`.

### Güncelleme

```
/plugin marketplace update vibecode
```

### Eski (klonlama tabanlı) projelerden geçiş

vibecode'u projeye kopyalayarak kurduğun eski projelerde: plugin'i kur → projede `/vibecode:init`. Kopyalanmış
framework dosyalarını `LEGACY` olarak listeler (plugin'le aynı olanlar, farklılaşmışlar, `.claude/settings.json`'daki
hook kayıtları, `.mcp.json`'daki serena/context7); onay verirsen `--migrate` ile kaldırır. Farklılaşmış dosyalar
istersen **proje override'ı** olarak kalır. `CLAUDE.md`'ye hiç otomatik dokunulmaz. Proje verisi (docs, HANDOFF,
hafıza) korunur.

---

## Proje Yaşam Döngüsü

### /vibe-plan — Fikirden Onaylı Mimariye

```
/vibe-plan odeme-sistemi "kartla ve havaleyle ödeme alınsın"
/vibe-plan odeme-sistemi --no-debate     # hassas plan: DeepSeek'e gönderme
```

1. **Keşif** (ana oturum) — tek tek sorular: problem ve kullanıcılar, kapsam ve kapsam dışı,
   entegrasyonlar ve ölçek. Stack zorunlu olduğu için tercih sorulmaz
2. **Understanding Lock** — 5-7 maddelik özet + varsayımlar + açık sorular. Seçenekler: düzelt ·
   onayla ve planla · **sadece fikir olarak kaydet** (plan `Status: concept` olarak yazılır, sonra
   aynı komut kaldığı yerden devam eder)
3. **Plan** — bir **Opus** subagent'ı (`Agent(subagent_type: "general-purpose", model: "opus")`)
   INDEX'i ve ilgili eski planları okur, `docs/architecture/<slug>-plan.md`'yi
   `architecture.md §1.1` şablonuyla yazar, INDEX'e bir satır ekler
4. **DeepSeek tartışması** — aynı Opus subagent'ı planı DeepSeek'e eleştirtir; her itirazı kabul
   eder (planı düzeltir) veya gerekçeyle reddeder. Her maddede uzlaşılana ya da 4 tur dolana kadar
   döner; çözülmeyen maddelerde planlayıcı karar verir ve madde plana "Open Questions" olarak düşer.
   Plan başlığındaki `**Revision:**` her turda artar
5. **Onay** — plan + tartışma özeti sunulur; onaydan sonra Serena düzenleme moduna geri alınır

Ana oturum yalnızca orkestrasyon ve soruları yapar; routing kuralları: `.vibecode/standards/delegation.md`.

### DeepSeek Tartışması — Ayarlar

- **Motor:** `.vibecode/scripts/deepseek-debate.js` (`critique` / `respond` / `status <plan-file>`),
  bağımlılıksız Node. Madde bazlı kayıt: `docs/architecture/debates/<slug>.json` + okunur özet
  `<slug>.md` (script üretir, elle düzenlenmez). Testler: `node --test .vibecode/scripts/tests/`
- **Durumlar:** `open` → Claude kabul ederse `resolved` → DeepSeek onaylarsa `agreed` (yetersizse
  yeniden açar); reddedilen madde DeepSeek geri çekene kadar `open`; tur limitinde `decided-by-claude`
- **Yakınsama:** 1. turda en fazla 8, sonraki turlarda en fazla 3 yeni itiraz; 3. turdan itibaren
  yalnızca `high` önemde
- **Config:** plugin'in `.vibecode/config/ai-providers.json`'ı — `enabled: true`, `max_rounds: 4`,
  `model: deepseek-v4-pro` (ucuz: `deepseek-flash`), `timeout_seconds: 300`, `max_tokens: 32000`.
  Bir projede değiştirmek/kapatmak için dosyayı projenin `.vibecode/config/ai-providers.json`'ına kopyala
  (proje kopyası önce okunur) ve `enabled: false` yap
- **API key** — projenin `.env`'ine **koyma** (vibecode başka projenin içinde çalışır; kök `.env`
  uygulamanındır). Script şu sırayla arar: `DEEPSEEK_API_KEY` ortam değişkeni → `$VIBECODE_ENV_FILE`
  → `.vibecode/providers.env` (gitignore'da) → **`~/.config/vibe/providers.env` (önerilen, vibeplan
  ile ortak)** → `~/.config/vibecode/providers.env` (eski yol)

  ```bash
  mkdir -p ~/.config/vibe
  printf 'DEEPSEEK_API_KEY=%s\n' 'sk-...' > ~/.config/vibe/providers.env && chmod 600 ~/.config/vibe/providers.env
  ```
- **Hata olursa** (anahtar yok, config kapalı, API hatası) tartışma atlanır, plan yine onaya gelir
- **Gizlilik:** plan metni DeepSeek sunucularına gider — hassas planlarda `--no-debate`. Anahtar asla
  loglanmaz ve plana/kayda yazılmaz. Detay: `docs/guides/framework-security.md §2`

**Başka provider eklemek:** Config, OpenAI-uyumlu chat-completions şekline (`request_shape:
"openai-compatible"`) uyan her sağlayıcıyı destekler — `providers`'a yeni bir giriş + `.env`'e key
eklemek yeter, kod değişmez. (OpenAI-uyumlu olmayan wire-format'lar ileride `case` dalı olarak eklenecek.)

### /vibe-go — Çalışmaya Başla

```
/vibe-go kullanici-profil-sayfasi-ekle
```

1. HANDOFF.md varsa okunur (aktif `## Goal` varsa hedef + kabul kriterleri gösterilir)
2. Config dosyalarından ilgili skill'ler tespit edilir (otomatik)
3. "Ready: [task] | Skills: [list]" ile başlar

### /vibe-sdd — Spec-Driven Development

Büyük özellikler için kullan: onaylı `/vibe-plan` dosyası üzerinden, kod yazmadan önce.

```
/vibe-sdd kullanici-yetkilendirme-sistemi
```

**Akış:**
0. **Plan** — `docs/architecture/<feature>-plan.md` bulunur (yoksa önce `/vibe-plan`)
1. **Soru Fazı** — planın açık bıraktıkları için 3-6 hedefli soru (kapsam, kabul kriterleri, non-goal'lar)
2. **Requirements + Acceptance Cases** — plan dosyasına eklenir, onay bekler (ayrı spec dosyası yok)
3. **Görev Listesi** — plana `### Task N: …` başlıklarıyla dependency sıralı görevler + kritik yol, onay bekler
   (INDEX.md'deki plan satırı güncellenir)
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
`refactor-planner`, `critic`, `mechanic` (Haiku — sadece mekanik iş).

### /vibe-done — Tamamla

```
/vibe-done           # standart
/vibe-done --full    # + doc-sync drift taraması
```

1. `make verify` çalıştırır (lint + test + audit)
2. Değişen kaynak dosyalar varsa güvenlik taramasını `reviewer` subagent'ına devreder (yalnızca bulgular döner)
3. CHANGELOG.md (tek kez) ve ilgili dokümanları günceller
4. HANDOFF.md'yi `.vibecode/templates/HANDOFF.md` şablonuyla yazar (aktif `## Goal` varsa günlüğe satır ekler)
5. Commit mesajı önerir

### /vibe-compact — Context Temizle

```
/vibe-compact
```

State'i HANDOFF.md'ye (`.vibecode/templates/HANDOFF.md` şablonu) kaydeder, context'i sıkıştırır.

### Çok-oturumlu hedef (HANDOFF `## Goal`)

Eski `/vibe-goal` komutu kaldırıldı (ADR-009). Günler süren bir hedef için HANDOFF.md'nin `## Goal`
bölümünü kullan: hedefi söyle → hedef + kabul kriterleri yazılır; `/vibe-go` gösterir, `/vibe-done`
günlüğe satır ekler. Otonom döngü değil — pusula + defter.

---

## SDD Scriptleri

`/vibe-sdd` komutunun arka planda kullandığı araçlar. Script'ler **plugin'in** içindedir; projeyi çalıştıkları dizinden
(git kökü) alırlar. Aşağıdaki örneklerde `.vibecode/scripts/…` plugin kökünü gösterir — Claude komutları bu yolu kendisi
çözer; elle çalıştırmak için `/vibe-status` ya da session başındaki "Framework root" satırındaki yolu kullan.

### task-brief — Görev Özeti Çıkar

Bir plan dosyasındaki `### Task N` görevini okuyup ayrı bir dosyaya yazar.
Subagent'a tüm plan yerine yalnızca o görevin dosya yolunu geçersin — prompt şişmez.

```bash
.vibecode/scripts/task-brief docs/architecture/auth-plan.md 3
# → .vibecode/sdd/task-3-brief.md (34 satır)

# Çıktı dosyasını kendin belirtmek istersen:
.vibecode/scripts/task-brief docs/architecture/auth-plan.md 3 /tmp/task3.md
```

**Kullanım senaryosu:**
```bash
# Görev 2'yi çıkar, engineer subagent'a gönder
.vibecode/scripts/task-brief docs/architecture/payment-plan.md 2
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

`.vibecode/sdd/` klasörünü oluşturur ve özelliğe özel `progress-<feature>.md` ledger dosyasını açar.
Komut zaten `/vibe-sdd` başlangıcında otomatik çalışır; uzun çalışmalarda
context compaction sonrası kaldığın yeri görmek için de kullanabilirsin.

```bash
.vibecode/scripts/sdd-workspace payment-sistemi
# → .vibecode/sdd/progress-<feature>.md oluşturuldu

# Mevcut session varsa özet gösterir:
.vibecode/scripts/sdd-workspace payment-sistemi
# sdd-workspace: resuming existing session at .vibecode/sdd/progress-<feature>.md
# # SDD Progress: payment-sistemi
# Started: 2026-06-20
# ...
```

**`progress-<feature>.md` örneği:**

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
| `/vibecode:init` | Projeyi vibecode için hazırlar / eski kurulumu taşır |
| `/vibe-plan [feature]` | Mimari plan yazar, onay bekler |
| `/vibe-go [task]` | State + skills yükler, başlar |
| `/vibe-sdd [feature]` | Onaylı plan → soru → requirements/kabul vakaları → görev listesi → execute |
| `/vibe-fleet [task]` | Director: görevi paralel subagent rollerine böler |
| `/vibe-collab-debug [bug]` | BugHunter → RefactorPlanner → Critic üçlüsü → doğrulanmış fix planı |
| `/vibe-done [--full]` | Verify + docs + HANDOFF.md + commit önerisi (`--full`: + doc-sync) |
| `/vibe-compact` | State kaydeder, context temizler |
| `/vibe-doc-sync [--live] [--tier full] [paths...]` | Dokümanları kodla senkronize eder |
| `/vibe-security-review [file]` | OWASP Top 10 güvenlik taraması |
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

110+ skill plugin'in `.vibecode/skills/` dizininde. Plugin skill'i olarak **kaydedilmez** (105 skill her oturuma
~6.4k token eklerdi); `/vibe-go` göreve uyanları adıyla listeler, gerektiğinde okunur. Projeye özel skill:
projede `.vibecode/skills/<ad>/SKILL.md` (plugin'dekini geçersiz kılar).

| Kategori | Örnekler |
|----------|----------|
| **Python / FastAPI** | fastapi-pro, python-pro, pydantic-models-py, async-python-patterns |
| **Database / SQL** | postgresql, postgres-best-practices, sql-optimization-patterns, database-migrations |
| **Frontend (React)** | react-patterns, react-best-practices, react-state-management, zustand-store-ts |
| **TypeScript / JS** | typescript-expert, javascript-pro, modern-javascript-patterns |
| **Testing / TDD** | tdd-workflows-tdd-cycle, python-testing-patterns, javascript-testing-patterns |
| **Code Quality** | clean-code, code-reviewer, find-bugs, legacy-modernizer |
| **Documentation** | changelog-automation, readme, docs-architect, openapi-spec-generation |
| **Architecture** | architecture-patterns, architecture-decision-records, api-design-principles |
| **DevOps / Infra** | docker-expert, bash-pro, deployment-engineer, server-management |
| **Context Mgmt** | context-compression, context-optimization, context-window-management |

### Yeni Skill Ekleme

Frontmatter şeması (`triggers` / `scope` / `model` alanları): `docs/guides/skill-authoring.md`.

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

Plugin'in `hooks/hooks.json`'ı ile kayıtlıdır. Hepsi önce projeye bakar: kökte `.vibecode/` yoksa hiçbir şey yapmadan
çıkar (`hooks/vibecode-project.js`).

### session-start.sh — Temel Kurallar + Session Durumu + Stack Detection

Her session başında çalışır:
- **Temel kuralları** (`.vibecode/core-rules.md`, CLAUDE.md'nin plugin karşılığı) framework kökünün gerçek yoluyla
  bağlama ekler
- HANDOFF.md durumunu ve ilk açık adımı gösterir
- Test/source oranını ve CHANGELOG güncelliğini kontrol eder
- **Config dosyalarından ilgili skill'leri tespit eder** (otomatik)
- Eksik araçlar için `MISSING` satırı basar ve `/vibecode:init`'e yönlendirir — hook'un kendisi hiçbir şey kurmaz
  (`curl | sh`, `sudo`, `npm -g` yok); Node yoksa JS hook'ları `run-node.sh` sayesinde sessizce atlanır
- Eksikse `.serena/project.yml`'ı şablondan oluşturur, hafıza konumunu ayarlar; eski klon-tabanlı kurulumu `LEGACY` olarak bildirir
- Hiçbir dosyayı silmez, commit atmaz

### pre-tool-use.js — Standart + Skill Uyarısı

Write / Edit / NotebookEdit / WebFetch öncesinde **tek node süreci** olarak çalışır:
- Dosya path'ine göre ilgili skill'i önerir — her dosya için oturumda **bir kez**
  (`.vibecode/state/`'te tutulur); tekrar eden düzenlemede context'e hiçbir şey eklenmez
- **Yol kuralları:** plugin `.claude/rules/` gönderemediği için kurallar `.vibecode/rules/*.md`'de (aynı `paths:`
  frontmatter'ı); eşleşen bir dosyaya ilk yazımda kuralın metni bağlama eklenir — kural başına oturumda bir kez
- `net-fs-guard.js`'i modül olarak çalıştırır (aşağıda) — bloklayan tek kısım bu

### permission-policy.js — Güvenlik Kapısı

Yalnızca `Bash` çağrılarında çalışır. Riskli komutları tier'a göre değerlendirir (hard-block veya uyarı):
- `rm -rf`, force push, `DROP TABLE` → hard-block
- `curl | bash`, eval with external input → hard-block
- Diğer riskli komutlar → uyarı + onay gerektirir

### net-fs-guard.js — Ağ + Dosya Sistemi Koruması

`pre-tool-use.js` içinden modül olarak çalışır (düzenleme başına tek node süreci).

- SSRF riskli URL'leri engeller
- Sistem yollarına (`/etc/`, `/usr/`) yazma girişimlerini engeller
- Symlink traversal saldırılarını önler

### notification.js — Context Monitor

Mesaj sayısını izler, context büyüdüğünde `/vibe-compact` önerir.

---

## Core Rules

Plugin bunları her oturumda `.vibecode/core-rules.md`'den bağlama ekler (özet):

1. İlgili standardı oku, sonra kod yaz
2. Kütüphane API'lerini dokümantasyondan doğrula — hafızadan yazma
3. Her yeni özellik veya değişiklik için test yaz
4. `make verify` çalıştır, sonra tamamlandı de — hata varsa düzelt, atlama
5. Her değişiklikten sonra CHANGELOG.md güncelle
6. Kod arama için Serena'yı tercih et (varsa)
7. Max 3 dosya/adım — büyük değişikliklerde subagent kullan
8. Yeni özellik veya mimari değişiklik — plan yaz, onay bekle
9. **Sonnet-first routing + delegasyon:** default Sonnet, planlama Opus, mekanik iş Haiku (`mechanic`); sözleşme-spec + kabul vakaları (pseudo-code değil); 2. başarısız Sonnet denemesinden sonra Opus subagent fix'i kendisi yazar. Tek otorite: `.vibecode/standards/delegation.md`

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

**Plugin (bu repo — repo kökü = plugin kökü = marketplace kökü):**

```
vibecode/
├── .claude-plugin/
│   ├── plugin.json              ← Manifest: ajan listesi, MCP (Serena + Context7)
│   └── marketplace.json         ← Tek plugin'lik marketplace
├── commands/                    ← Slash komutları (vibe-go, vibe-plan, vibe-sdd, …, init)
├── agents/                      ← Rol ajanları (architect, engineer, mechanic, tester, reviewer, …)
├── hooks/                       ← hooks.json + session-start.sh, pre-tool-use.js, permission-policy.js,
│                                  net-fs-guard.js, notification.js, vibecode-project.js (proje kapısı),
│                                  run-node.sh (node yoksa JS hook'larını atlar)
├── .vibecode/
│   ├── core-rules.md            ← Her oturuma eklenen temel kurallar (CLAUDE.md'nin plugin karşılığı)
│   ├── standards/               ← Kodlama standartları (11 dosya, on-demand; delegation.md = model routing)
│   ├── rules/                   ← Yol kuralları (8 dosya, pre-tool-use.js enjekte eder)
│   ├── skills/                  ← 110+ skill (lazy, kayıtsız)
│   ├── config/                  ← ai-providers.json (varsayılan; proje kendi kopyasıyla geçersiz kılabilir)
│   ├── scripts/                 ← install-deps.sh, vibe-init.js, task-brief, review-package, sdd-workspace, deepseek-debate.js,
│   │                              db-backup/restore (+ tests/)
│   ├── prompts/                 ← SDD implementer/reviewer şablonları
│   └── templates/               ← docs iskeleti, HANDOFF, izinler, serena, docker-compose, Makefile, Dockerfile'lar
└── docs/, HANDOFF.md, .vibecode/memory/   ← vibecode reposunun kendi proje verisi
```

**Senin projen (`/vibecode:init` sonrası) — yalnızca proje verisi:**

```
projen/
├── .claude/settings.json        ← izinler + vibecode plugin bildirimi (commit edilir)
├── .claude/settings.local.json  ← hafıza konumu (makineye özel, gitignore)
├── .vibecode/memory/            ← Claude hafızası (commit edilir)
├── .vibecode/{state,sdd}/       ← çalışma zamanı (gitignore)
├── .serena/memories/            ← Serena hafızası (commit edilir)
├── docs/                        ← architecture/ (+INDEX), constraints/, CHANGELOG, decisions, progress
└── HANDOFF.md                   ← /vibe-done yazar, /vibe-go okur
```

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
| SDD ortasında context sıkıştı | `/vibe-go` → `.vibecode/sdd/progress-<feature>.md`'e bak, kaldığın görevden devam |
| Yeni servis eklemem gerekiyor | `/vibe-plan redis-cache-ekleme` |
| Hangi skill'i yüklemeliyim? | Otomatik — session başında tespit edilir |
| Claude kuralları atladı | `pre-tool-use.js` hook uyarı verir |
| Yanlışlıkla Opus ile açıldım | Hook `/model sonnet` öneriyor — komutu çalıştır |
| Sonnet aynı bug'ı 2 kez çözemedi | Otomatik — Sonnet `Agent(model:opus)` çağırır |
| Riskli komut bloklandı | `permission-policy.js` hard-block — komutu gözden geçir |
| Sunucuyu sildim, repoyu yeni makineye çektim | `claude` aç, klasöre güven (marketplace projedeki bildirimden kendiliğinden eklenir) → `/plugin install vibecode@vibecode` → oturumu yeniden başlat. Hafıza, docs, HANDOFF repoyla gelir; sırlar (DeepSeek anahtarı) için `~/.config/vibe/providers.env`'i yeniden oluştur |
| Plugin başka projemde karışıyor | Karışmaz — hook'lar yalnızca `/vibecode:init` edilmiş projelerde çalışır |
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
