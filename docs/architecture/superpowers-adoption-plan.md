# Architecture Plan: obra/superpowers Adoption (Non-Installation)

## Overview & Goals

Bu plan, [obra/superpowers](https://github.com/obra/superpowers) reposunun
kurulum dışı bölümlerini inceleyerek vibecode setup'a eklenebilecek değerli
ögeleri belirler.

**Kapsam dışı:** Platform entegrasyonu (CLAUDE.md, hooks.json), skill
dosyalarının kopyalanması (zaten `superpowers:*` prefix'i ile tüm 14 skill
kullanıcı seviyesinde kurulu).

**Hedef:** SDD iş akışını daha sağlam hale getirecek 3 mekanik eklenti —
context bloat'ı azalt, bağlam derlemesi (context compaction) sonrasında
ilerlemeyi koru, subagent el değiştirmelerini dosya tabanlı tut.

---

## Mevcut Durum: Ne Zaten Var

| Superpowers bileşeni | Vibecode karşılığı | Durum |
|----------------------|--------------------|-------|
| 14 skill (brainstorming, systematic-debugging vb.) | `superpowers:*` prefix ile kullanıcı seviyesinde kurulu | ✅ Tam |
| Brainstorming → plan → execute döngüsü | `/vibe-plan` → `/vibe-sdd` → `/vibe-done` | ✅ Tam |
| Paralel subagent yönetimi | `/vibe-fleet` + `agent-dispatch` skill | ✅ Tam |
| Doğrulama kapısı | `make verify` zorunlu, `verification-before-completion` skill | ✅ Tam |
| Session state | HANDOFF.md (end-of-session) | ✅ Tam |
| Micro-spec → Sonnet → Opus review | `.vibecode/standards/architecture.md §4` | ✅ Tam |

---

## Ne Eksik: Gerçekten Değerli Üç Eklenti

### 1. SDD Shell Scripts (YÜKSEK DEĞER)

Superpowers SDD workflow'unda görevleri subagent'lara iletmek için dosya
tabanlı bir el değiştirme (file handoff) deseni kullanır. Görev metni ve
diff'leri prompt içine yapıştırmak yerine dosyalara yazar, subagent yalnızca
dosya yolunu alır. Bu context boyutunu dramatik biçimde küçültür.

**Üç script:**
- `task-brief PLAN_FILE TASK_N [OUTFILE]` — plan dosyasından N. görevi
  çıkarıp `.vibecode/sdd/task-<N>-brief.md` dosyasına yazar
- `review-package BASE HEAD [OUTFILE]` — iki git ref arasındaki commit log +
  istatistik + unified diff'i tek dosyaya toplar (reviewer subagent okur)
- `sdd-workspace` — SDD klasörü (`/.vibecode/sdd/`) ve boş `progress.md`
  ledger dosyasını oluşturur

**Nereye eklenecek:** `.vibecode/scripts/` (repo içi, `make` hedefleri
aracılığıyla erişilebilir)

**`/vibe-sdd` güncelleme gereksinimi:** Phase 5'te her görev öncesi
`task-brief` çalıştır, her görev sonrası `review-package` çalıştır.

### 2. Prompt Şablon Dosyaları (ORTA DEĞER)

Superpowers iki sabit prompt şablonu tutar: implementer (görev uygulayıcısı)
ve task-reviewer (spec uyumu + kalite denetçisi). Bunlar dosya olarak saklanır
— her çağrıda prompt içine gömülmez. Şablonlar değiştiğinde tüm çağrılar
otomatik güncellenir.

**Eklenecek dosyalar:**
- `.vibecode/prompts/sdd-implementer.md` — implementer subagent sözleşmesi
  (görev brief'ini oku → uygula → self-review → raporla)
- `.vibecode/prompts/sdd-reviewer.md` — reviewer subagent kriterleri (spec
  uyumu + kod kalitesi; her ikisi için verdict zorunlu)

**`/vibe-sdd` güncelleme gereksinimi:** Phase 5 dispatch'lerinde bu dosyaların
içeriğini prompt'a ekle.

### 3. Mid-Execution Progress Ledger (ORTA DEĞER)

HANDOFF.md session sonu için yazılır. Uzun SDD çalışmalarında bağlam
derlemesi (context compaction) oluşursa ara ilerleme kaybolur.
`.vibecode/sdd/progress.md` her görev tamamlandıkça güncel kalır; session
yeniden başlasa da okuyarak kaldığın yerden devam edebilirsin.

**Format:**
```markdown
# SDD Progress: <feature-name>
Started: YYYY-MM-DD
Plan: docs/architecture/<feature>-spec.md

## Tasks
- [x] Task 1: ... (commit: abc1234)
- [x] Task 2: ... (commit: def5678)
- [ ] Task 3: ... (IN PROGRESS)
- [ ] Task 4: ...

## Blockers
(varsa)
```

**`/vibe-sdd` güncelleme gereksinimi:** Phase 5 başlangıcında
`sdd-workspace` çalıştır, her görev tamamlandığında progress.md güncelle.

---

## Ne Alınmayacak

| Öge | Gerekçe |
|-----|---------|
| `docs/superpowers/specs/` dizin kuralı | `docs/architecture/` iyi yerleşmiş; taşıma gereksiz sürtünme |
| Visual brainstorming companion | Web sunucu bileşeni, CLI-first kurulumumuzla uyumsuz |
| Platform hooks (hooks.json, hooks-codex.json) | Zaten kendi hook sistemimiz mevcut |
| `using-superpowers` SKILL.md'nin kopyalanması | `superpowers:using-superpowers` zaten yüklü |
| Eval/drill test altyapısı | Ayrı repo; kendi `make verify` yeterli |

---

## Directory Structure Changes

```
.vibecode/
├── scripts/
│   ├── task-brief          # YENİ — plan → brief extractor
│   ├── review-package      # YENİ — diff package generator
│   └── sdd-workspace       # YENİ — SDD çalışma alanı kurulumu
├── prompts/
│   ├── sdd-implementer.md  # YENİ — implementer subagent sözleşmesi
│   └── sdd-reviewer.md     # YENİ — reviewer subagent kriterleri
└── sdd/                    # GİTİGNORED — çalışma zamanı SDD dosyaları
    ├── progress.md         # (çalışma zamanında oluşturulur)
    └── task-<N>-brief.md   # (çalışma zamanında oluşturulur)
```

`.gitignore`'a eklenecek:
```
.vibecode/sdd/
```

`.claude/commands/vibe-sdd.md` güncellenecek (Phase 5 adımları).

---

## Tech Decisions

**Bash scripts:** `task-brief` ve `review-package` basit bash script'leri.
Superpowers'ın orijinal implementasyonundan adapte edilecek; `#!/usr/bin/env bash`
+ `set -euo pipefail`. Bağımlılık yok — sadece `git`, `awk`, `wc`.

**`.vibecode/sdd/` konumu (`.git/sdd/` değil):** Superpowers başlangıçta
`.git/sdd/` kullanıyordu, sonradan `.superpowers/sdd/`'ye taşıdı çünkü `.git/`
kopyalanmıyor ve görünmüyor. Biz `.vibecode/sdd/` kullanacağız (mevcut
`.vibecode/` yapısıyla tutarlı) ve gitignore'a ekleyeceğiz.

**Prompt dosyaları vs inline:** Şablonlar değiştiğinde tüm `/vibe-sdd`
çalışmaları güncellensin diye dosya olarak tutulacak.

---

## Database Schema

Yok — bu değişiklikler pure tooling/scripting.

---

## API Contract

Yok.

---

## Docker Services

Yok.

---

## Port Assignments

Yok.

---

## Security Considerations

- `task-brief` ve `review-package` script'leri `eval` veya komut enjeksiyonu
  içermemeli; `awk` ve `git` sabit argümanlarla çağrılacak.
- `.vibecode/sdd/` gitignore'da olacağı için commit'e karışmaz; ama içerik
  duyarlı veri barındırmıyor (plan çıktıları + diff'ler).

---

## Migration Plan

**Adım 1 — Scripts (etki alanı: 3 dosya):**
1. `.vibecode/scripts/task-brief` — superpowers orijinalinden adapte
2. `.vibecode/scripts/review-package` — superpowers orijinalinden adapte
3. `.vibecode/scripts/sdd-workspace` — yeni (minimaldir: mkdir + progress.md init)
4. `chmod +x` üçü için
5. `.gitignore`'a `.vibecode/sdd/` ekle

**Adım 2 — Prompt şablonları (etki alanı: 2 dosya):**
6. `.vibecode/prompts/sdd-implementer.md` — yaz
7. `.vibecode/prompts/sdd-reviewer.md` — yaz

**Adım 3 — `/vibe-sdd` güncellemesi (etki alanı: 1 dosya):**
8. Phase 5'e şu adımlar eklenir:
   - Başlangıç: `sdd-workspace` çalıştır (veya mevcut progress.md varsa devam
     et)
   - Her görev dispatch'i öncesi: `task-brief` ile brief dosyası oluştur;
     implementer subagent'a dosya yolunu ver
   - Her görev sonrası: `review-package BASE HEAD` çalıştır; reviewer
     subagent'a diff dosyasını ver
   - Her görev tamamlandığında: `progress.md` güncelle

**Bağımlılık:** Adım 1 ve 2 paralel yapılabilir. Adım 3, her ikisine bağımlı.

**Mevcut workflow'a etkisi:** Sıfır. `/vibe-sdd` hâlâ kullanılabilir;
script'ler opsiyonel araçlar. `/vibe-fleet` ve diğer komutlar değişmez.

---

## Open Questions

1. **Script'leri şimdi mi yazalım, yoksa bir sonraki SDD kullanımında mı?**
   Üç script de küçük (30-50 satır bash), prompt dosyaları birkaç paragraf.
   Şimdi yazıp bir kere hazır etmek mi, yoksa gerçekten ihtiyaç duyulduğunda
   mı yapalım?

2. **`make` hedefleri:** `task-brief` ve `review-package`'i Makefile'a hedef
   olarak eklemek ister misin (`make task-brief PLAN=... N=...` gibi), yoksa
   doğrudan script çağrısı yeterli mi?

3. **Superpowers orijinal script'lerini mi adapte edelim, yoksa sıfırdan mı
   yazalım?** Orijinaller bash + awk ile yaklaşık 50 satır. Doğrudan
   kopyalayıp `.vibecode/` yollarını güncellemek en hızlı yol.
