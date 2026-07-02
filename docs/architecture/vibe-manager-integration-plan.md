# Architecture Plan: vibe-manager Skill Entegrasyonu

> **Kaynak istek:** "https://github.com/buraksu42/vibe-manager adresinde vibedeçoding için güzel bir tool var. bunu incele ve projeye eklenebilirliğini belirle"
> **Slug normalizasyonu:** Orijinal /vibe-plan argümanı URL+açıklama içeriyordu → temiz slug `vibe-manager-integration` (URL'i dosya adına yazmak XFS/ext4'te bile sorunlu)

---

## Overview & Goals

### vibe-manager nedir?

`buraksu42/vibe-manager` — tek bir 4,270 satırlık markdown dosyasından oluşan bir **Claude Code skill**'i. Bir cümlelik proje fikrini alıp, Claude Code'un "elinden tutarak" çalıştırabileceği **1-6 spesifikasyon dosyasına** çeviriyor.

**Repo metadata** (gh API üzerinden teyit edildi, 2026-05-03):
- Created: `2026-05-01` (2 gün önce — çok yeni)
- Stars: 1 | Forks: 0 | Watchers: 1
- License: MIT
- Default branch: `main`
- Pushed: `2026-05-02T10:26:29Z`
- Içerik: `vibe-manager.md` (192,659 byte / 4,270 satır), `README.md`, `LICENSE`, `diagrams/`

**Çalışma mantığı:**

| Faz | Eylem |
|-----|-------|
| Phase 1 | Idea capture + sessiz mode inference (Quick / Standard / Full) |
| Phase 1.5 | Deep research + iterasyon |
| Phase 2 | Spec lock-in |
| Phase 2.5 | Stack Defaults pre-flight (`~/.claude/CLAUDE.md`'de `## Stack Defaults` bloğu) |
| Phase 3a-e | 6 embedded specialist: architect → designer → engineer → orchestrator → prompter |
| Phase 4 | Cross-prompt analysis (tutarsızlık yakalama) |
| Phase 6 | Final output (CLAUDE.md + docs/) |

**Üç mod ve çıktıları:**

| Mod | Çıktı dosyaları | Süre |
|-----|----------------|------|
| Quick | 1 dosya: `CLAUDE.md` | ~10 dk |
| Standard | 2-3 dosya: `CLAUDE.md` + `docs/research.md` (+ opsiyonel `docs/design-prompts.md`) | ~20 dk |
| Full | 6 dosya: `CLAUDE.md` + `docs/research.md` + `docs/architecture.md` + `docs/design.md` + `docs/agents.md` + `docs/design-prompts.md` | ~40 dk |

### Vibecode'da hangi gerçek boşluğu dolduruyor?

`/Users/bahdem/Dev/vibecode/.vibecode/templates/INITIAL_PROMPT.md` (satır 22-28) şu varsayımı yapıyor:

> *"docs/architecture/project-spec.md ← Proje spesifikasyonu, docs/architecture/technical-spec.md ← Teknik spesifikasyon. Bu dokümanlar projenin ne yaptığını... içeriyor."*

**Kritik gözlem:** Vibecode bu spec dosyalarının **var olduğunu** varsayıyor ama bunları *üretmek* için herhangi bir araç sağlamıyor. Mevcut akış:

```
[BOŞLUK — kullanıcı specleri kendisi yazmalı]
       ↓
clone vibecode → /vibe-plan → /vibe-go
```

vibe-manager tam olarak bu boşluğu dolduruyor: **fikir → spec dosyaları**. Yani vibecode'un *öncesinde* çalışacak bir araç olarak konumlanabiliyor.

### Hedef

vibecode kullanıcısının fikirden çalışan bir vibecode projesine geçişini akıcılaştırmak. Üç adımda karar verilecek soru: **(a)** vibe-manager'ı entegre etmeli miyiz, **(b)** entegre edersek hangi entegrasyon derinliğinde, **(c)** structural çakışmaları nasıl çözeriz?

---

## Yapısal Çakışma Analizi

vibe-manager'ın varsaydığı dizin yapısı vs vibecode'un dayatığı yapı:

| Konu | vibe-manager varsayımı | vibecode gerçeği | Çakışma türü |
|------|------------------------|------------------|---------------|
| **`CLAUDE.md` (root)** | Project brief + engineering conventions için sahiplik | Governance / standards / model routing kuralları için sahiplik | 🔴 **HARD** — ikisi aynı dosyayı isteyemez |
| **`docs/architecture.md`** (tek dosya) | Architect specialist çıktısı | `docs/architecture/` **dizini** (plan dosyaları için, INDEX.md ile yönetiliyor) | 🔴 **HARD** — dosya/dizin çakışması |
| **`docs/research.md`** | Researcher çıktısı | Mevcut değil | 🟢 Çakışma yok |
| **`docs/design.md`** | Designer çıktısı | Mevcut değil | 🟢 Çakışma yok |
| **`docs/agents.md`** | Orchestrator çıktısı | Mevcut değil | 🟢 Çakışma yok |
| **`docs/design-prompts.md`** | Prompter çıktısı | Mevcut değil | 🟢 Çakışma yok |
| **`~/.claude/CLAUDE.md` `## Stack Defaults` bloğu** | Zorunlu pre-read | Vibecode user-level CLAUDE.md'de yok | 🟡 Eklenmesi gerekiyor (zararsız) |
| **Skill kurulum yolu** | `~/.claude/skills/vibe-manager/SKILL.md` | `.vibecode/skills/<name>/SKILL.md` (project-level) | 🟢 Çakışma yok — ikisi de mümkün |
| **Trigger isimleri** | "vibe-manager", "comprehensive project plan" vb. fraz tetikli | Vibecode `/vibe-*` slash command namespace kullanıyor | 🟢 Çakışma yok — farklı namespace (skill vs slash) |
| **`vibe-coder` companion skill** | vibe-manager bazı koşullarda buna defer ediyor | Yok | 🟡 Karar gerekiyor: kurulsun mu yoksa "vibecode'un kendisi vibe-coder yerine geçiyor" mu denilsin? |

**HARD çakışmalar nasıl çözülür?**

1. **CLAUDE.md** — vibe-manager'ın CLAUDE.md çıktısını ROOT'a yazmamak. İki seçenek:
   - **(a)** vibe-manager output'unu parse et: "Project brief" bölümü → `docs/architecture/project-spec.md`, "Engineering conventions" → `docs/constraints/*.md` güncelleme önerileri
   - **(b)** vibe-manager'a yazma izni vermeden çalıştır → çıktıyı incele → manuel remap

2. **`docs/architecture.md`** — vibe-manager'ın yazacağı tek dosyayı `docs/architecture/architecture-plan.md` olarak yeniden adlandır + `docs/architecture/INDEX.md`'ye satır ekle (vibecode'un mevcut INDEX kurallarına uygun).

---

## Tech Decisions

### Karar 1: Entegre etmeli miyiz?

**EVET, koşullu.** Gerekçeler:

✅ **Lehte:**
- Vibecode'un proje-spec üretme boşluğunu dolduruyor (yukarıdaki "kritik gözlem")
- MIT lisans, tek dosya — düşük dependency yükü
- Fikir → spec → /vibe-plan → /vibe-go akışı tam bir lifecycle oluşturuyor
- "Stack Defaults" konsepti vibecode'un "constraint files" yaklaşımıyla uyumlu

❌ **Aleyhte:**
- Repo 2 günlük (2026-05-01), 1 star — production maturity yok
- 192KB skill dosyası — token maliyeti (tetiklendiğinde ~50K context yer)
- Yapısal varsayımları vibecode'un opinionated yapısıyla çakışıyor (yukarıdaki HARD çakışmalar)
- Upstream API/format değişebilir → wrapper kodumuz kırılabilir

**Karar:** `evet, ama** wrapper aracılığıyla ve pinned commit SHA ile**`. Doğrudan ham skill'i kullanıcıya tetiklettirmek vibecode'un yapısını bozar.

### Karar 2: Hangi entegrasyon derinliği?

Dört seçeneği değerlendirdim:

| Seçenek | Tanım | Effort | Risk | Değer |
|---------|-------|--------|------|-------|
| **A — Pure install + manuel remap** | Skill'i `.vibecode/skills/`'e kur, kullanıcı manuel yönetsin | XS | Düşük | Düşük |
| **B — Wrapper komut `/vibe-init [idea]`** | Skill'i çalıştır, çıktıyı vibecode yapısına remap et | M | Orta | Yüksek |
| **C — Sadece dokümantasyon** | README'ye not düş "kurmak isterseniz şöyle..." | XS | Sıfır | Çok düşük |
| **D — Pattern theft (vibecode-native /vibe-init)** | vibe-manager'a hiç bağımlı olma, vibecode skill'leriyle benzer akış kur | XL | Düşük | Yüksek (uzun vade) |

**Seçilen: B (Wrapper) + A (fallback)**

Neden:
- Seçenek B en yüksek değeri orta effort'la veriyor
- Seçenek A'yı hem fallback hem manuel kullanım için kurulu tutuyoruz (B kırılırsa A çalışır)
- Seçenek D'yi *gelecek için ADR olarak işaretle* — şu an 4,270 satır orchestration kodu yeniden yazmaya değmez, ama vibe-manager 6 ay sonra hâlâ aktif değilse D'ye geçeriz

### Karar 3: Skill kurulum yeri

**`.vibecode/skills/vibe-manager/SKILL.md`** (project-level), `~/.claude/skills/` değil.

Neden:
- Vibecode self-contained olmalı — clone eden kullanıcı extra setup yapmasın
- Pinned SHA vendoring → upstream değişiklikleri controlled şekilde alırız
- Project skills user-level skills'i override eder (CLAUDE.md kuralı: "Project skills override user-level skills when both exist")

Vendoring stratejisi:
```bash
# Tek seferlik kurulum
git submodule add https://github.com/buraksu42/vibe-manager.git .vibecode/vendor/vibe-manager
# YA DA daha basit: copy + LICENSE preservation
mkdir -p .vibecode/skills/vibe-manager
curl -sL "https://raw.githubusercontent.com/buraksu42/vibe-manager/<PINNED_SHA>/vibe-manager.md" \
  -o .vibecode/skills/vibe-manager/SKILL.md
curl -sL "https://raw.githubusercontent.com/buraksu42/vibe-manager/<PINNED_SHA>/LICENSE" \
  -o .vibecode/skills/vibe-manager/LICENSE
```

**Submodule vs copy karşılaştırması:**

| Submodule | Copy + SHA dosyası |
|-----------|---------------------|
| ✅ Otomatik upstream takibi (`git submodule update`) | ❌ Manuel güncelleme |
| ❌ `git clone` extra adım gerektirir (`--recurse-submodules`) | ✅ `git clone` doğrudan çalışır |
| ❌ vibecode "clone et çalış" promise'ini bozar | ✅ Promise korunur |

**Karar: copy + SHA dosyası** (`.vibecode/skills/vibe-manager/.upstream-sha`).

### Karar 4: `vibe-coder` companion skill ne olacak?

vibe-manager `vibe-coder`'a (single-prompt bootstrap için) defer ediyor. Vibecode'un kendisi zaten o "single-prompt bootstrap" rolünü `/vibe-go` ile dolduruyor.

**Karar:** vibe-coder'ı **kurmayız**. Wrapper komutu (`/vibe-init`) vibe-manager'ı tetiklerken prompt'a şu ön-açıklamayı ekler:
```
Use vibe-manager (multi-spec). Do NOT defer to vibe-coder — vibecode handles
single-prompt bootstrap via /vibe-go.
```

### Karar 5: Stack Defaults nereye yazılır?

vibe-manager `~/.claude/CLAUDE.md` `## Stack Defaults` bloğu istiyor. İki seçenek:

- **User-level** (vibe-manager'ın varsayılanı) — bütün projelerde paylaşılır
- **Project-level** (`docs/constraints/stack-defaults.md`) — vibecode'un constraint dosya yaklaşımına uygun

**Karar:** İkisi de. Wrapper:
1. User-level CLAUDE.md'de `## Stack Defaults` blok varsa → onu kullan (kullanıcı tercihleri)
2. Yoksa → vibe-manager'ın inline walkthrough'unu çalıştır → çıktıyı *hem* user CLAUDE.md'ye *hem* `docs/constraints/stack-defaults.md`'ye yaz

### Reddedilen alternatifler

1. **Direkt skill triggerlama (wrapper olmadan):**
   - ❌ Reddedildi → vibe-manager output'u root CLAUDE.md ve docs/architecture.md yazıyor → vibecode yapısı bozulur
2. **Submodule kullanımı:**
   - ❌ Reddedildi → vibecode'un "clone et hemen çalış" promise'ini bozar
3. **vibe-manager'ı user-level'e kurmak:**
   - ❌ Reddedildi → vibecode self-containment kaybolur, clone eden user manuel install yapmak zorunda kalır
4. **vibe-manager'ı sadece README'de tavsiye etmek (Seçenek C):**
   - ❌ Reddedildi → değer / effort oranı düşük; user'ı serbest bırakmak ama hiçbir yapısal çakışmayı çözmemek
5. **vibe-coder companion skill kurmak:**
   - ❌ Reddedildi → vibecode zaten o rolü dolduruyor, kafa karıştırır

---

## Directory Structure Changes

```
Eklenecek dosyalar:
├── .claude/commands/vibe-init.md                          # Yeni wrapper komut
├── .vibecode/skills/vibe-manager/
│   ├── SKILL.md                                            # vibe-manager.md vendored copy (pinned SHA)
│   ├── LICENSE                                             # MIT (zorunlu license preservation)
│   └── .upstream-sha                                       # Pinned commit SHA + tarih
├── .vibecode/scripts/update-vibe-manager.sh                # SHA güncelleme yardımcı script
└── docs/architecture/INDEX.md                              # Bu plan için satır eklenecek

Değişecek dosyalar:
├── CLAUDE.md                                               # Slash Commands tablosuna /vibe-init ekle
├── README.md                                               # Quick Reference + workflow güncelle
└── .gitignore                                              # `.vibecode/skills/vibe-manager/.upstream-sha` HARİÇ olduğunu doğrula

Değişmeyecek dosyalar:
├── .vibecode/templates/INITIAL_PROMPT.md                   # Hâlâ "manuel spec yazma" senaryosu olarak kalır (alternatif yol)
├── .claude/commands/vibe-go.md                             # Değişmez — /vibe-init bittikten sonra /vibe-go akışına döner
├── .claude/commands/vibe-plan.md                           # Değişmez
└── docs/constraints/*.md                                   # Wrapper opsiyonel olarak stack-defaults.md ekleyebilir
```

---

## Database Schema

N/A — bu bir tooling/skill entegrasyonu, persistence katmanı yok.

---

## API Contract

N/A — slash command + skill, HTTP API değil.

---

## Docker Services

N/A — service eklemiyoruz.

---

## Port Assignments

N/A — network port kullanmıyoruz.

---

## Security Considerations

### Risk 1: Vendor edilen 192KB markdown — supply chain
- vibe-manager.md **prompt injection vektörü** olabilir (kullanıcı çağırdığında 4,270 satır içerik Claude context'ine giriyor)
- **Mitigation:** Pinned SHA → upstream değişikliği "otomatik" değil, manuel `update-vibe-manager.sh` çalıştırılınca alınır. SHA bump'ları PR review gerektirir.

### Risk 2: Skill çıktısının dosya sistemine yazılması
- vibe-manager kendi başına `CLAUDE.md` ve `docs/architecture.md` yazmaya çalışırsa vibecode yapısı bozulur
- **Mitigation:** Wrapper komutu vibe-manager'ı şu prompt prefix'iyle tetikler:
  ```
  IMPORTANT: Do NOT write any files directly. Output all content as
  markdown code blocks. The wrapper will route content to correct paths.
  ```
- Ek olarak `/vibe-init` çalışırken Serena planning mode'a alınabilir (read-only) — ama bu sadece Serena araçları için, Write/Edit'i bloklamaz. Tek güvenli yol: skill'in kendisinin write yapmamasını **prompt seviyesinde garantilemek** + wrapper'ın çıktıyı parse edip yazması.

### Risk 3: `~/.claude/CLAUDE.md` mutasyonu
- vibe-manager Stack Defaults yazmak için user CLAUDE.md'yi değiştiriyor
- **Mitigation:** Wrapper user'a sormadan user-level CLAUDE.md'ye yazmaz. Onay aldıktan sonra `cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-$(date +%s)` backup alır.

### Risk 4: License compliance
- MIT — `LICENSE` dosyasını vendoring sırasında muhafaza et + `.vibecode/skills/vibe-manager/SKILL.md`'nin başına `<!-- Vendored from buraksu42/vibe-manager @ <SHA>, MIT License -->` yorum satırı ekle

### Risk 5: Trigger pollution
- vibe-manager triggerları ("vibe-manager", "comprehensive project plan") *project-scope* skill olarak yüklendiğinde, kullanıcı vibecode dizininde başka bir context'te bu fraz geçerse istemeden tetiklenebilir
- **Mitigation:** Wrapper komut `/vibe-init` *zorunlu* giriş kapısı olsun. Skill'in trigger description'ında not düş: "Bu skill **sadece** /vibe-init wrapper'ı tarafından tetiklenir. Doğrudan kullanma."

---

## Migration Plan

### Faz 1: Vendor + skill kurulumu (1 dosya)

1. `.vibecode/skills/vibe-manager/` dizinini oluştur
2. Pinned SHA seç: en son commit `gh api repos/buraksu42/vibe-manager/commits/main --jq '.sha'` ile çek (şu an `2026-05-02` push)
3. `vibe-manager.md` ve `LICENSE`'ı indir
4. `.upstream-sha` dosyasına yaz: `<SHA>\n<DATE>\n<URL>`
5. SKILL.md'nin başına vendoring yorumu ekle

### Faz 2: Wrapper komut (`/vibe-init`)

`.claude/commands/vibe-init.md` oluştur. İçeriği (üst düzey):

```markdown
---
description: "Fikirden çalışan vibecode projesine: vibe-manager'ı tetikle, çıktıyı vibecode yapısına remap et"
---

## Idea: $ARGUMENTS

### 1. MCP Setup Check (vibe-go ile aynı)
[standart MCP check bloğu]

### 2. Skill Pre-flight
- `.vibecode/skills/vibe-manager/SKILL.md` var mı? Yoksa "vibe-manager skill kurulu değil — `.vibecode/scripts/update-vibe-manager.sh` çalıştır" diye DUR.
- `.upstream-sha` SHA'sını oku → kullanıcıya bildir ("vibe-manager @ <SHA>, <DATE>")

### 3. Stack Defaults Check
- `~/.claude/CLAUDE.md`'de `## Stack Defaults` bloğu var mı?
- Yoksa kullanıcıya sor: "Stack Defaults yok. (a) Şimdi inline walkthrough yap, (b) Atla, vibe-manager bunu kendi yönetsin"

### 4. Trigger vibe-manager (kontrollü)
Şu prompt'u tetikle:
```
vibe-manager skill çağırıyorum. ÖNEMLİ KURALLAR:
1. Hiçbir dosyayı doğrudan YAZMA — tüm çıktıyı markdown code block olarak ver
2. vibe-coder'a defer ETME — vibecode kendisi single-prompt bootstrap yapıyor
3. Mode auto-inference yap, ama final mode'u kullanıcıya doğrula
4. Final çıktı şu formatta gelsin:
   ## FILE: <relative-path>
   ```<lang>
   <content>
   ```
   (her dosya için bir blok)

PROJE FİKRİ: $ARGUMENTS
```

### 5. Output Remapping
vibe-manager çıktısını parse et ve şu remap tablosunu uygula:

| vibe-manager çıktı yolu | vibecode hedef yolu | Strateji |
|------------------------|---------------------|----------|
| `CLAUDE.md` (project brief bölümü) | `docs/architecture/project-spec.md` | Yeni dosya yaz |
| `CLAUDE.md` (engineering conventions) | `docs/architecture/technical-spec.md` | Yeni dosya yaz |
| `CLAUDE.md` (stack defaults bölümü) | `docs/constraints/stack-defaults.md` | Yeni dosya yaz |
| `docs/research.md` | `docs/research.md` | Doğrudan |
| `docs/architecture.md` | `docs/architecture/architecture-plan.md` | Yeniden adlandır + INDEX güncelle |
| `docs/design.md` | `docs/design.md` | Doğrudan |
| `docs/agents.md` | `docs/agents.md` | Doğrudan |
| `docs/design-prompts.md` | `docs/design-prompts.md` | Doğrudan |

### 6. INDEX Update
`docs/architecture/INDEX.md` "Aktif Planlar"'a satır ekle:
- [architecture-plan](architecture-plan.md) — vibe-manager tarafından üretildi (<SHA>): <kısa özet>

### 7. Next Steps
Kullanıcıya rapor et:
- "✅ Specler oluşturuldu: docs/architecture/{project-spec,technical-spec,architecture-plan}.md"
- "📍 Sıradaki: `/vibe-plan <feature>` ile ilk feature için implementasyon planı"
- "📍 Veya direkt `/vibe-go <faz-adı>` (mimari plan zaten architecture-plan.md'de)"
```

### Faz 3: Update script

`.vibecode/scripts/update-vibe-manager.sh` (yardımcı, opsiyonel):

```bash
#!/usr/bin/env bash
set -euo pipefail
SHA="${1:-$(curl -s https://api.github.com/repos/buraksu42/vibe-manager/commits/main | jq -r .sha)}"
TARGET=".vibecode/skills/vibe-manager"
mkdir -p "$TARGET"
curl -fsSL "https://raw.githubusercontent.com/buraksu42/vibe-manager/${SHA}/vibe-manager.md" \
  -o "$TARGET/SKILL.md"
curl -fsSL "https://raw.githubusercontent.com/buraksu42/vibe-manager/${SHA}/LICENSE" \
  -o "$TARGET/LICENSE"
echo "${SHA}" > "$TARGET/.upstream-sha"
date -u +"%Y-%m-%dT%H:%M:%SZ" >> "$TARGET/.upstream-sha"
echo "✅ vibe-manager updated to ${SHA}"
```

### Faz 4: Dokümantasyon güncelleme (3 dosya)

1. `CLAUDE.md` — Slash Commands tablosuna satır ekle:
   ```
   | `/vibe-init [idea]` | Fikirden spec dosyalarına: vibe-manager skill'i tetikle, çıktıyı vibecode yapısına remap et |
   ```

2. `CLAUDE.md` — Quick Reference güncelle:
   ```
   New project from idea? →  clone → /vibe-init [idea] → /vibe-go
   New project (specs ready)? →  clone → /vibe-go [task]
   ```

3. `README.md` — workflow bölümüne `/vibe-init` adımı ekle (alternatif giriş kapısı olarak)

### Faz 5: Smoke test

1. Yeni geçici dizin: `mkdir /tmp/vm-test && cd /tmp/vm-test`
2. Vibecode clone: `git clone <vibecode> .` + `rm -rf .git`
3. `claude` başlat
4. `/vibe-init` çalıştır, basit fikir ver: "todo app for personal use"
5. Quick mode tetiklenmeli, çıktı `docs/architecture/project-spec.md`'ye yazılmalı
6. `/vibe-go phase-1` ile implementasyona geçilebilmeli

### Faz 6: ADR yaz

`docs/decisions.md` içine:
```
## ADR-XXX: vibe-manager skill entegrasyonu (2026-05-03)
Status: Accepted
Context: Vibecode fikir→spec boşluğunu doldurmak için tool gerekli.
Decision: vibe-manager'ı vendor + /vibe-init wrapper.
Consequences: Upstream SHA pin, manuel update gerekli, skill'in 192KB context maliyeti.
Alternatives reddedildi: doğrudan trigger (yapı bozar), submodule (clone bozar), pattern theft (4270 satır kodu yeniden yazma maliyeti).
```

---

## Open Questions

### S1. Pinned SHA hangisi olsun?
Şu anki HEAD `gh api repos/buraksu42/vibe-manager/commits/main --jq '.sha'` ile öğrenilebilir. **Öneri:** En son commit'i pinle (henüz repo 2 günlük, sürekli değişiyor olabilir — pin koyup sonra explicit update yapmak en güvenlisi). Kullanıcı onayı: hangi tarihteki SHA'yı baseline alalım?

### S2. Quick mode default mı, Standard mı?
vibe-manager fikir framing'inden mode infer ediyor. Vibecode kullanıcısı muhtemelen "ciddi proje" yapıyor (yoksa vibecode clone etmezdi). Wrapper Standard mode'u **default** olarak önerebilir. **Öneri:** vibe-manager'ın inference'ını bozma, ama final mode'u kullanıcıya teyit ettirmek wrapper'ın step 4'üne ekle. Onaylar mısın?

### S3. `vibe-coder` skill'ini gerçekten *yasaklayalım* mı?
Wrapper prompt'unda "vibe-coder'a defer etme" diyoruz. Ya kullanıcı bilinçli olarak vibe-coder kullanmak isterse? **Öneri:** Wrapper **/vibe-init** içinde yasak; kullanıcı `/vibe-init --allow-vibe-coder` flag'iyle override edebilsin. Yoksa basit tut, hiç override yok mu?

### S4. `docs/architecture/architecture-plan.md` slug çakışması?
vibe-manager'ın çıktısı her seferinde aynı isimle (`architecture-plan.md`) gelirse, ikinci çağrıda eski plan'ı override eder. **Öneri:** İlk çağrıda `architecture-plan.md`, sonraki çağrılarda `architecture-plan-v2.md`, `-v3.md` gibi numara ekle + INDEX'te ilkini "Superseded"'e taşı. Yoksa her çağrı timestamp'li slug mı (`architecture-plan-20260503-1430.md`)?

### S5. INITIAL_PROMPT.md template'i kaldırılsın mı?
`/vibe-init` workflow'u INITIAL_PROMPT.md'nin manuel spec yazma akışını obsolete edebilir. Ama bazı kullanıcılar vibe-manager'ı kullanmak istemeyebilir. **Öneri:** INITIAL_PROMPT.md kalsın, içine "alternatif: /vibe-init [idea] kullan" notu eklensin. Onaylar mısın yoksa silelim mi?

### S6. Stack Defaults backup stratejisi
User-level `~/.claude/CLAUDE.md`'ye yazmadan önce backup alıyoruz. Backup ne kadar süre tutulacak? **Öneri:** 30 gün sonra `cleanup-backups.sh` ile temizleme cron'u — yoksa hiç temizleme yapmayalım, kullanıcı manuel halletsin?

### S7. vibe-manager 6 ay sonra abandoned olursa?
Şu an 1 star, 2 günlük repo. Üst-düzey "vendor olarak almak yerine pattern theft" zorunlu olabilir. **Öneri:** Bu plan'a ek olarak `docs/architecture/vibecode-native-init-plan.md` adlı taslak plan oluştur — ileride aktive edilmek üzere "Superseded by vibe-manager-integration" notuyla. Yoksa şimdilik atlayalım mı?

---

## Özet karar matrisi (kullanıcı onayı için)

| Karar | Önerim | Kabul / Red? |
|-------|--------|--------------|
| Entegre etmek | EVET, koşullu | ? |
| Yöntem | Wrapper komut + vendored skill | ? |
| Skill yeri | `.vibecode/skills/vibe-manager/` (project-level) | ? |
| Pinned SHA | En güncel HEAD | ? |
| vibe-coder yasakla | EVET (no override) | ? |
| Slug çakışması | Versiyonlu (`-v2`, `-v3`) | ? |
| INITIAL_PROMPT.md | Kalsın + not düş | ? |
