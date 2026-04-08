# Architecture Plan: Serena Otomatik Aktivasyon ve Dil Yapılandırması

## Overview & Goals

**Problem:** `/vibe-go` çalıştırıldığında Serena "Python not in active languages" hatası veriyor.
Scaffold ile oluşturulan projelerde Serena düzgün başlamıyor.

**Kök neden (3 parça):**

1. `.mcp.json` içinde `--project-from-cwd` flag'i eksik — Serena proje olmadan başlıyor
2. Scaffold edilen projelerde `.serena/project.yml` oluşturulmuyor — dil tanımı yok
3. `/vibe-go` komutu Serena aktivasyonunu yönetmiyor — sadece tool call deneyip başarısız oluyor

**Hedef:** Herhangi bir vibecode projesi açıldığında Serena otomatik olarak doğru dillerle aktif olsun.

---

## Çözüm Planı

### Değişiklik 1: `.mcp.json` template — `--project-from-cwd` ekle

**Dosya:** `.mcp.json` (ve bu dosyayı üreten tüm yerler)

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": [
        "--from", "git+https://github.com/oraios/serena",
        "serena", "start-mcp-server",
        "--project-from-cwd"
      ]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

**Gerekçe:** `--project-from-cwd` Claude Code için özel olarak tasarlanmış bir flag.
Serena başlatıldığında CWD'den `.serena/project.yml` arayarak projeyi otomatik aktive eder.
Bu sayede `/vibe-go` içinde `activate_project` tool call'una gerek kalmaz.

**Etkilenen dosyalar:**
- `.claude/commands/vibe-go.md` (MCP check adımındaki `.mcp.json` template)
- `.claude/commands/vibe-plan.md` (aynı template)

---

### Değişiklik 2: `.serena/project.yml` template oluştur

**Yeni dosya:** `.vibecode/templates/serena-project.yml`

```yaml
project_name: "{{PROJECT_NAME}}"

languages:
- python
- typescript

encoding: "utf-8"
line_ending: native
language_backend:

ignore_all_files_in_gitignore: true
ls_specific_settings: {}
ignored_paths: []
read_only: false
excluded_tools: []
included_optional_tools: []
fixed_tools: []
base_modes:
default_modes:
initial_prompt: ""
symbol_info_budget:
read_only_memory_patterns: []
ignored_memory_patterns: []
```

**Gerekçe:** Vibecode şablonu Python (backend) + TypeScript (frontend) stack'i kullanıyor.
Bu template, scaffold sırasında `.serena/project.yml` olarak kopyalanacak.

---

### Değişiklik 3: `.serena/.gitignore` template oluştur

**Yeni dosya:** `.vibecode/templates/serena-gitignore`

```
/cache
/project.local.yml
/memories
```

**Gerekçe:** `project.yml` git'te takip edilmeli (dil yapılandırması takım genelinde paylaşılmalı).
`cache`, `project.local.yml` ve `memories` kişiye özel, takip edilmemeli.

---

### Değişiklik 4: `/vibe-scaffold` güncelle

**Dosya:** `.claude/commands/vibe-scaffold.md`

**Ekleme — Step 2 (Create Directory Structure) sonrasına:**

```
### 2b. Configure Serena
- Create `.serena/` directory
- Copy `.vibecode/templates/serena-project.yml` → `.serena/project.yml`
  - Replace `{{PROJECT_NAME}}` with actual project name
- Copy `.vibecode/templates/serena-gitignore` → `.serena/.gitignore`
```

---

### Değişiklik 5: `/vibe-go` MCP check adımını güncelle

**Dosya:** `.claude/commands/vibe-go.md`

Mevcut Step 0 (MCP Setup & Check) şu şekilde güncellenecek:

```markdown
### 0. MCP Setup & Check

1. **Check `.mcp.json`** — If it does NOT exist, create it with `--project-from-cwd`:
   [updated template with --project-from-cwd flag]

2. **Check `.serena/project.yml`** — If it does NOT exist:
   - Detect languages from project files:
     - `backend/pyproject.toml` or `*.py` files exist → add `python`
     - `frontend/package.json` or `*.ts` files exist → add `typescript`
     - `*.sh` files exist → add `bash`
   - Create `.serena/project.yml` with detected languages
   - Create `.serena/.gitignore`
   - WARN: "`.serena/project.yml` created — restart session for Serena to pick it up."

3. **Verify MCPs** — Try `get_current_config`:
   - Active project with correct languages → "Serena: OK"
   - No active project → "Serena: UNAVAILABLE — session restart needed"
   - Active but missing language → WARN which language is missing
```

---

### Değişiklik 6: `/vibe-plan` MCP check adımını güncelle

**Dosya:** `.claude/commands/vibe-plan.md`

`/vibe-go` ile aynı MCP check mantığı — DRY tutmak için aynı template kullanılacak.

---

### Değişiklik 7: Bu projenin `.serena/project.yml` düzelt

**Dosya:** `.serena/project.yml` (vibecode template projesi)

Bu proje sadece bash/markdown/yaml içerdiği için `bash` doğru.
Ancak `.gitignore` template'inin `.serena/` klasörünü kapsamadığından emin ol.

Mevcut `.vibecode/templates/.gitignore`'da `.serena/` yok — iyi, scaffold edilen
projelerde `.serena/project.yml` git'te takip edilecek.

---

## Directory Structure Changes

```
.vibecode/templates/
├── serena-project.yml          # YENİ — Serena proje yapılandırma template
├── serena-gitignore            # YENİ — Serena .gitignore template
├── ... (mevcut dosyalar)

.claude/commands/
├── vibe-go.md                  # GÜNCELLE — MCP check adımı
├── vibe-plan.md                # GÜNCELLE — MCP check adımı
├── vibe-scaffold.md            # GÜNCELLE — Serena setup adımı ekle
```

---

## Migration Plan (Mevcut Projelere Etki)

1. Değişiklikler geriye uyumlu — mevcut projeler etkilenmez
2. Mevcut projelerde `.serena/project.yml` yoksa, `/vibe-go` ilk çalışmada oluşturacak
3. Session restart gerekli olduğunda kullanıcıya açıkça bildirilecek
4. `.mcp.json` zaten `.gitignore`'da — auto-generated olarak yeniden oluşturulacak

---

## Kararlar (Onaylandı)

1. **Dil tespiti:** Tüm Serena destekli diller tespit edilecek (Python, TS, Go, Rust, Java, vb.)
2. **Serena onboarding:** Otomatik çalışacak
3. **Fallback davranışı:** Kabul edilebilir — `.serena/project.yml` yoksa `/vibe-go` otomatik oluşturacak
