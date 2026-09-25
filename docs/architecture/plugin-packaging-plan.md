# Architecture Plan: plugin-packaging

**Status:** implemented (onay: kullanıcı "full yetki sende, projeyi tamamla", 2026-09-25) — ADR-012
**Revision:** 0

## Amaç

vibecode'u Claude Code plugin'i olarak dağıtmak. Kullanıcı akışı:

```
# makinede bir kez
/plugin marketplace add bahadirdemircioglu/vibecode
/plugin install vibecode@vibecode

# her projede
git clone <X> && cd X && claude
/vibecode:init          # ilk sefer
/vibe-go <görev>
```

Vibecode artık projelerin klonlandığı temel repo değil; mevcut bir projenin içinde çağrılır.

## Spike bulguları (Claude Code 2.1.282) — tasarımın dayanağı

| Soru | Sonuç |
|---|---|
| Plugin hook'u exit 2 ile engelleyebilir mi | Evet (headless + interaktif) |
| `${CLAUDE_PLUGIN_ROOT}` genişler mi | Komut, skill, ajan metni, hooks.json, `!` enjeksiyonu — evet |
| Öneksiz çağrı | `/vibe-go` ve `subagent_type: engineer` öneksiz çalışır (çakışma yoksa) |
| Plugin SessionStart stdout | Modelin bağlamına girer → CLAUDE.md yerine kullanılır |
| Plugin MCP sunucusu cwd | Proje dizini (`CLAUDE_PROJECT_DIR` + `CLAUDE_PLUGIN_ROOT` env'de) → Serena `--project-from-cwd` çalışır |
| Proje-bildirimli plugin | `extraKnownMarketplaces` + `enabledPlugins` → klasör güveninden sonra soru sormadan yüklenir (dizin kaynağıyla doğrulandı) |
| plugin.json özel yollar | `commands`/`skills` dizin kabul eder; `agents` dizin kabul etmez |
| Skill kaydı maliyeti | 105 skill plugin skill'i olarak kaydedilirse her oturuma ~6.4k token → **kaydedilmez** |
| Tek adımlı kurulum | Yok (`install --marketplace` bayrağı yok) |

## Yapı

Repo kökü = plugin kökü = marketplace kökü.

| Parça | Konum | Not |
|---|---|---|
| Manifest | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | MCP (Serena, Context7) plugin.json içinde; `.mcp.json` kalkar |
| Komutlar | `commands/` (← `.claude/commands/`) | Framework yolları `${CLAUDE_PLUGIN_ROOT}/.vibecode/...` |
| Ajanlar | `agents/` (← `.claude/agents/`) | Varsayılan dizin (manifest'te dizin verilemiyor) |
| Hook'lar | `hooks/hooks.json` + script'ler (← `.claude/hooks/`) | Yalnızca **vibecode projesinde** (`.vibecode/` dizini var) çalışır |
| Yol kuralları | `.vibecode/rules/` (← `.claude/rules/`) | Plugin `.claude/rules` gönderemez → `pre-tool-use.js` eşleşen yola ilk yazımda kuralı enjekte eder |
| Temel kurallar | `.vibecode/core-rules.md` | Plugin CLAUDE.md gönderemez → SessionStart hook bağlama basar, `{{VIBECODE_ROOT}}` gerçek yolla değişir |
| Standartlar, skill'ler, şablonlar, script'ler, prompt'lar, config | `.vibecode/` (yerinde) | Skill'ler plugin skill'i olarak **kaydedilmez**; `/vibe-go` gerektiğinde okur |

**Proje verisi projede kalır:** `HANDOFF.md`, `docs/`, `.vibecode/memory/`, `.vibecode/state/`, `.vibecode/sdd/`,
`.vibecode/providers.env`, `.serena/`, `.claude/settings*.json`.

## `/vibecode:init`

Komut `commands/init.md`, mekanik kısım `.vibecode/scripts/vibe-init.js` (idempotent, var olanın üzerine yazmaz):

1. `.vibecode/memory/MEMORY.md`, `docs/{CHANGELOG,decisions,progress}.md`, `docs/architecture/INDEX.md`,
   `docs/constraints/` — yoksa şablondan.
2. `.gitignore` — eksik vibecode satırlarını ekler.
3. `.claude/settings.json` — birleştirir: izinler (birleşim), `extraKnownMarketplaces.vibecode` (github kaynağı),
   `enabledPlugins["vibecode@vibecode"]`. Sunucu silinip repo yeniden çekilince plugin geri gelir.
4. `.serena/project.yml` — yoksa şablondan (proje adıyla).
5. Eski (klon-tabanlı) kurulum dosyalarını raporlar; `--migrate` ile kaldırır (kullanıcı onayından sonra).

## Kaldırılanlar

- Fresh-clone bootstrap (`session-start.sh` adım 0, `fresh-clone.marker`) — hook artık dosya silmez/commit atmaz.
- `/vibe-update` + `.vibecode/scripts/vibe-update` — güncelleme `/plugin marketplace update` ile.

## Geçiş (klon-tabanlı eski projeler)

Plugin'i kur → projede `/vibecode:init` → eski dosya listesini onayla (`--migrate`) → commit. Proje verisine dokunulmaz.

## Kabul

- Temiz config + boş proje: marketplace add + install (yerel ve GitHub) → `/vibecode:init` → `/vibe-status` çalışır,
  `rm -rf` engellenir, core rules bağlamda, `backend/src/api/x.py` yazımında kural ipucu gelir.
- Vibecode olmayan projede hook'lar sessiz.
- Temiz config + init edilmiş proje (sunucu yeniden kurulumu): güvenden sonra plugin kendiliğinden yüklenir.
- `node --test .vibecode/scripts/tests/` yeşil.
