# Architecture Plan: Serena Optimizasyonu & Yetki Kontrolü

## Overview & Goals

**İki ayrı sorun çözülecek:**

### Sorun 1: Serena Yetersiz Kullanılıyor
- **Onboarding hiç yapılmamış** → memory'ler boş → her session sıfırdan başlıyor
- **project.yml sadece `bash`** → semantic code navigation (symbol search, find references) çalışmıyor çünkü doğru language server yok
- **Serena'nın symbol-level araçları kullanılmıyor** → dosyalar Read ile tümüyle okunuyor (token israfı)
- **Serena memory'leri kullanılmıyor** → proje bilgisi her session'da kaybolıyor
- **Think tools aktif değil** → agent karar noktalarında yapısal düşünme yapmıyor

### Sorun 2: Yetki Eksikliği İş Akışını Bozuyor
- Claude Code bazı tool call'larda kullanıcıdan onay bekliyor → iş akışı kesiliyor
- Hangi yetkilerin gerektiği önceden bilinmiyor → task ortasında bloklanma riski
- `pip install`, `npm install`, `python`, `node` gibi komutlar bloklu → bazı task'larda sorun

---

## Bölüm 1: Serena Optimizasyonu

### 1.1 project.yml Düzeltmesi

**Mevcut durum:** Sadece `bash` dili tanımlı.

**Sorun:** Serena'nın symbol-level araçları (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`) ancak doğru language server çalışırken işe yarar. `bash` LSP'si Python/TypeScript dosyalarını anlamaz.

**Çözüm:** project.yml'deki `languages` alanını projenin gerçek dil yapısına göre dinamik ayarlama.

Ancak bu **proje-spesifik** bir ayar — vibecode framework'ü farklı projelerde kullanılacağı için sabit bir dil listesi koymak yanlış olur. Bunun yerine:

1. **vibe-go komutu** language detection yapacak (zaten yapıyor ama project.yml'i güncellemiyordu)
2. **Session başında** project.yml'deki diller ile projedeki gerçek diller karşılaştırılacak
3. Eksik dil varsa → otomatik ekle + uyarı ver (restart gerekebilir)

**Desteklenen diller (otomatik, ek kurulum gerektirmeyen):**
- `python` / `python_jedi` — Python projeleri
- `typescript` / `typescript_vts` — TypeScript + JavaScript projeleri
- `bash` — Shell script'ler
- `yaml` / `toml` / `markdown` — Config dosyaları

**Ek kurulum gerektiren (uyarı verilecek):**
- `go` → `gopls` gerekli
- `rust` → `rustup` gerekli
- `cpp` → `clangd` gerekli

### 1.2 Onboarding Çalıştırma

**Mevcut durum:** `check_onboarding_performed` → "not performed"

**Serena onboarding ne yapar:**
1. Proje dosyalarını okuyarak temel bilgileri toplar
2. `write_memory` ile kalıcı memory dosyaları oluşturur (`.serena/memories/` altında)
3. Oluşturulacak memory'ler:
   - `suggested_commands.md` — make verify, make test, vb.
   - `code_style.md` — naming conventions, patterns
   - `project_structure.md` — dizin yapısı
   - `task_completion.md` — task bitirme checklist'i
   - `tech_stack.md` — kullanılan teknolojiler

**Önemli:** Onboarding context window'u doldurur → onboarding'den sonra yeni session başlatılmalı.

**Çözüm:** `vibe-go` komutuna onboarding kontrolü ekle:
```
Serena onboarding kontrolü:
  check_onboarding_performed → 
    not performed → "Serena onboarding gerekli. /vibe-go onboarding çalıştırın."
    performed → devam et
```

### 1.3 Serena Memory'leri vs Claude Auto-Memory

**İki farklı memory sistemi var — hangisi ne için:**

| Özellik | Serena Memories | Claude Auto-Memory |
|---------|----------------|-------------------|
| Konum | `.serena/memories/` (proje içinde) | `~/.claude/projects/.../memory/` |
| Scope | Proje-spesifik, takım genelinde paylaşılabilir | Kullanıcı-spesifik |
| Git tracking | Evet — commit'lenebilir | Hayır |
| Format | Markdown dosyaları | Markdown + frontmatter |
| Yönetim | Serena araçları veya dosya sistemi | Claude otomatik |
| Kullanım | Proje bilgisi, kod standartları, komutlar | Kullanıcı tercihleri, feedback |

**Kural:**
- **Serena memories** → Proje hakkındaki bilgiler (yapı, standartlar, komutlar, tech stack)
- **Claude auto-memory** → Kullanıcı hakkındaki bilgiler (tercihler, feedback, çalışma tarzı)
- **HANDOFF.md** → Session-spesifik durum (devam eden iş, açık sorular)

### 1.4 Symbol-Level Okuma Kuralları

**Mevcut sorun:** Dosyalar Read ile tümüyle okunuyor → büyük dosyalarda token israfı.

**Serena'nın önerdiği akış:**
```
Kodu anlamak istiyorum
    │
    ├── Dosya yapısını bilmiyorum
    │   └── get_symbols_overview(file) → dosyadaki tüm symbol'lerin listesi
    │
    ├── Symbol adını biliyorum
    │   └── find_symbol(name, include_body=False) → konum + imza
    │       └── Detay gerekli → find_symbol(name, include_body=True) → tam gövde
    │
    ├── Symbol'ün nereden çağrıldığını bilmek istiyorum
    │   └── find_referencing_symbols(symbol) → referans listesi
    │
    ├── Pattern arıyorum (regex)
    │   └── search_for_pattern(pattern) → eşleşmeler
    │
    └── Tüm dosyayı okumam GERÇEKTEN gerekli
        └── read_file(path) — sadece config/doc dosyaları veya çok küçük dosyalar
```

**CLAUDE.md'ye eklenecek kural:**
```
Serena aktifken kod okuma sırası:
1. get_symbols_overview → dosya yapısını gör
2. find_symbol(include_body=False) → imzaları gör
3. find_symbol(include_body=True) → sadece gerekli gövdeleri oku
4. read_file → SADECE config/doc veya tüm dosya gerçekten gerekli ise
```

### 1.5 Think Tools Aktivasyonu

**Mevcut durum:** Think tools mevcut ama `included_optional_tools` listesinde değil → aktif değil.

**Think tools ne yapar:**
- `think_about_collected_information` — Araştırma sonrası: "Yeterli bilgi topladım mı?"
- `think_about_task_adherence` — Kod yazmadan önce: "Task'tan sapıyor muyum?"
- `think_about_whether_you_are_done` — Bitirirken: "Gerçekten bitti mi?"

**Bunlar agent'ın kendine checkpoint koymasını sağlar.** Tool olarak çağrılır ama aslında LLM'e yapısal düşünme prompt'u döner.

**Karar:** Bu tool'lar `vibe-done` ve `vibe-go` akışlarında zaten checklist olarak var. Ekstra token maliyeti yaratmadan aynı işi görebilirler. **Şimdilik eklemeyelim** — ancak büyük projelerde faydalı olabilir. Kullanıcı kararına bırakılacak (Open Question).

### 1.6 Serena Mode Kullanımı

**Mevcut aktif modlar:** `editing`, `interactive`

**Kullanılmayan ama faydalı modlar:**
- `planning` — Sadece okuma, yazma araçları devre dışı. Plan yaparken yanlışlıkla kod yazılmasını engeller.
- `one-shot` — Otonom çalışma, soru sormadan tamamla.

**Çözüm:** `vibe-plan` çalıştığında Serena'yı `planning` moduna geçir, `vibe-go` kodlamaya başladığında `editing` moduna geri al. Bu şekilde plan aşamasında yanlışlıkla dosya değişikliği yapılamaz.

---

## Bölüm 2: Yetki Kontrolü (Permission Check)

### 2.1 Mevcut Yetki Durumu

**Otomatik izinli:**
- MCP araçları (Serena, Context7) → `enableAllProjectMcpServers: true`
- Read, Write, Edit → explicit deny yok
- Git read komutları (status, diff, log, branch, show)
- Make komutları (verify, test, lint, format, audit)
- Docker compose read komutları (ps, logs)

**Onay gerektiren (her seferinde popup):**
- `mkdir`, `cp`, `mv` gibi dosya sistemi komutları
- `curl`, `wget` gibi network komutları
- Listede olmayan herhangi bir Bash komutu

**Bloklu (deny listesinde):**
- `rm -rf`, `git push --force`, `git reset --hard`, `sudo`, `chmod 777`
- `.env` dosyalarını okuma/yazma
- `pip install`, `npm install`, `python`, `node`

**Local override ile eklenen:**
- `git add`, `git commit`, `git push`, `git rm`
- WebFetch (github.com, raw.githubusercontent.com, api.github.com)

### 2.2 Yetki Kontrolü Mekanizması

**vibe-go'ya eklenecek adım:**

```markdown
### 1.5 Permission Check
Task'ın gerektirdiği yetkileri kontrol et:

**Zorunlu yetkiler (her task için):**
- Write/Edit → dosya yazma
- Bash(git *) → versiyon kontrolü
- Bash(make *) → verify/test/lint
- MCP tools → Serena + Context7

**Task'a göre ek yetkiler:**
- Yeni dependency → `pip install` veya `npm install` gerekebilir
- Script çalıştırma → `python` veya `node` gerekebilir
- Dosya sistemi → `mkdir`, `cp`, `mv` gerekebilir
- Docker → `docker compose up`, `docker compose build` gerekebilir

**Eksik yetki varsa:**
"Bu task için şu ek yetkiler gerekli: [liste].
settings.local.json'a eklenmesini önerir misiniz?"

Kullanıcı onaylarsa → settings.local.json'a ekle.
```

### 2.3 "Full Yetki" Profilleri

Task tipine göre önceden tanımlı yetki profilleri:

**Profil: Backend Development**
```json
{
  "allow": [
    "Bash(pip install*)",
    "Bash(python -m pytest*)",
    "Bash(alembic *)",
    "Bash(docker compose up*)",
    "Bash(docker compose build*)",
    "Bash(docker compose down*)",
    "Bash(docker compose restart*)",
    "Bash(mkdir *)",
    "Bash(cp *)",
    "Bash(mv *)"
  ]
}
```

**Profil: Frontend Development**
```json
{
  "allow": [
    "Bash(npm install*)",
    "Bash(npm run *)",
    "Bash(npx *)",
    "Bash(node *)",
    "Bash(mkdir *)",
    "Bash(cp *)",
    "Bash(mv *)"
  ]
}
```

**Profil: Full Stack**
Backend + Frontend profillerin birleşimi.

---

## Directory Structure Changes

```
Değişecek dosyalar:
├── CLAUDE.md                                    # Serena kullanım kuralı ekleme
├── .claude/commands/vibe-go.md                  # Onboarding + permission check ekleme
├── .claude/commands/vibe-plan.md                # Serena planning mode entegrasyonu
├── .serena/project.yml                          # languages güncelleme (proje-spesifik)

Oluşturulacak dosyalar:
(yok — tüm değişiklikler mevcut dosyalarda)

Onboarding sonrası otomatik oluşacak dosyalar:
├── .serena/memories/
│   ├── suggested_commands.md
│   ├── code_style.md
│   ├── project_structure.md
│   ├── task_completion.md
│   └── tech_stack.md
```

---

## Tech Decisions

| Karar | Yaklaşım | Gerekçe |
|-------|----------|---------|
| Dil tespiti | vibe-go'da dinamik | Vibecode farklı projelerde kullanılacak — sabit dil listesi yanlış |
| Onboarding zamanlaması | vibe-go'da kontrol + ayrı session | Onboarding context'i doldurur, ayrı session önerisi |
| Think tools | Şimdilik eklenmeyecek | vibe-done checklist'i aynı işlevi görüyor, ek token maliyeti |
| Serena mode switching | vibe-plan → planning, vibe-go → editing | Yanlışlıkla plan aşamasında kod yazılmasını engeller |
| Permission profilleri | settings.local.json'a ekleme | Proje bazlı, git-tracked olmayan yerel ayar |

---

## Database Schema
N/A

## API Contract
N/A

## Docker Services
N/A

## Port Assignments
N/A

## Security Considerations
- Permission profilleri `.settings.local.json`'da → git'e commit'lenmez → her dev kendi ayarlar
- `pip install` / `npm install` yetkisi verildiğinde supply chain riski → kullanıcı bilinçli karar vermeli
- `.env` dosya erişim yasağı korunacak — bu asla açılmayacak

---

## Migration Plan

### Adım 1: project.yml Güncelleme
- Vibecode framework projesinin kendisi için: `languages: [bash]` olarak kalsın (sadece shell script'ler var)
- Kullanıcı projeleri için: vibe-go dil tespiti yapıp güncelleyecek

### Adım 2: CLAUDE.md Güncelleme
- Core Rules'a Serena symbol-level okuma kuralı ekle
- Serena memory vs Claude memory ayrımını belirt

### Adım 3: vibe-go.md Güncelleme
- Onboarding kontrolü ekle
- Permission check adımı ekle
- Dil tespiti + project.yml güncelleme

### Adım 4: vibe-plan.md Güncelleme
- Serena planning mode entegrasyonu

### Adım 5: Onboarding Çalıştır
- Bu session'da onboarding'i çalıştır → memory'ler dolsun
- Yeni session başlat

---

## Open Questions — RESOLVED

1. **Think tools:** Evet, eklendi (`included_optional_tools` in project.yml). ✅ Onaylandı.

2. **Serena mode switching:** Evet, vibe-plan'a `switch_modes(["planning", "interactive"])` eklendi. ✅ Onaylandı.

3. **Onboarding:** Evet, çalıştırıldı. 5 memory oluşturuldu: project_overview, suggested_commands, code_style, task_completion, tech_stack. ✅ Tamamlandı.
