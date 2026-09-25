# Session Handoff

<!-- Written by /vibe-done and /vibe-compact (fill THIS template — no other format), read by /vibe-go.
     Every section is mandatory; use N/A where it does not apply.
     Parser contract (session-start hook): keep the `- **Status:**` line and `- [ ]` items under
     Next Steps — the first `- [ ]` in the file is shown as "Next". Do not use `- [ ]` above Next Steps. -->

## Date
2026-09-25

## Current State
- **Branch:** `main` (tek dal — yerel ve GitHub)
- **Status:** in-progress

## Goal
- **Goal status:** active
- **Goal:** vibecode'u Claude Code **plugin**'i olarak paketlemek — GitHub linki verilince kurulsun, klonlama/`/vibe-update` gerekmesin
- **Acceptance:**
  - `.claude-plugin/marketplace.json` + plugin manifest; kurulum: `/plugin marketplace add bahadirdemircioglu/vibecode` + `/plugin install vibecode@vibecode` (tek adımlı `/plugin install vibecode --marketplace bahadirdemircioglu/vibecode` sürümde çalışıyorsa o da)
  - Komutlar, ajanlar (model: frontmatter'ları ile), skill'ler, hook'lar, script'ler, standartlar/şablonlar, MCP (Serena, Context7) plugin'den gelir; proje verisi (`docs/architecture/`, `docs/constraints/`, `HANDOFF.md`, izinler) projede kalır
  - Otomatik fresh-clone bootstrap yerine elle çağrılan `/vibecode:init` (proje iskeleti + izinler) — hook kendi kendine dosya silmez/commit atmaz
  - Mevcut klon-tabanlı projeler için geçiş yolu yazılı
- **Journal** (newest last, max ~10 lines — trim oldest):
  - 2026-09-25 — Denetim temizliği (ADR-009), sözleşme-spec + Haiku `mechanic` (ADR-008), vibeplan akışı taşındı: keşif + Understanding Lock + madde bazlı DeepSeek tartışması (ADR-010). README güncel. Tüm dallar silindi, yalnızca `main`.
  - 2026-09-25 — Plugin fikri konuşuldu; dokümantasyon kontrol edildi (bulgular aşağıda). Deneme (spike) henüz başlamadı — kullanıcı onayı bekleniyor.

## Changes This Session
- `.vibecode/scripts/deepseek-debate.js` + `tests/` — madde bazlı Claude ↔ DeepSeek tartışması (`consult-provider.sh` yerine), ADR-010
- `.claude/commands/vibe-plan.md` — Step 0.7 keşif + Understanding Lock ("sadece fikir" → `Status: concept`), Step 1e DeepSeek tartışması (Opus planlayıcı yürütür)
- `.vibecode/standards/delegation.md` (yeni) — model routing + sözleşme-spec + 2 deneme kuralı tek kaynak (ADR-008/009)
- `.claude/agents/mechanic.md` (yeni, Haiku) — mekanik işler
- `.claude/hooks/*` — güvenli fresh-clone (marker), otomatik kurulum yok, tek node süreci/düzenleme, `$CLAUDE_PROJECT_DIR` yolları
- 12 skill silindi/birleşti, `scaffold.sh`/`statusline.sh`/`/vibe-goal` kaldırıldı; README, ADR'ler, CHANGELOG güncel
- Ayrıntı: `docs/CHANGELOG.md` (2026-09-25 girdileri), `docs/decisions.md` ADR-008…010

## Tests
- **Added:** `.vibecode/scripts/tests/deepseek-debate.test.js` (15 test, mock DeepSeek sunucusu — `node --test .vibecode/scripts/tests/`)
- **Modified:** N/A
- **All passing:** yes (gerçek API ile duman testi de yapıldı)

## Open Questions
- **Plugin hook'ları exit 2 ile engelleyebiliyor mu?** Doküman kontrolü "hayır" dedi ama genel hook davranışıyla çelişiyor — doğrulanmalı. Engelleyemiyorsa `permission-policy.js` (rm -rf / sudo engeli) plugin'de değil projede kalmalı.
- Plugin'de **CLAUDE.md** ve **`.claude/rules`** desteklenmiyor (skill'e çevrilmeli) ve **izinler** plugin'den verilemiyor (projede/kullanıcı ayarında kalmalı) — bunun `/vibecode:init` tasarımına etkisi.
- Komut adları `/vibecode:vibe-plan` biçimine dönüşüyor (önek zorunlu) — kısaltma istenir mi (ör. `/vibecode:plan`)?
- Otomatik güncelleme kendi marketplace'lerde varsayılan kapalı — açık mı gelsin?

## Next Steps
- [ ] Plugin denemesi (spike) — geçici `CLAUDE_CONFIG_DIR` ile (kullanıcının `~/.claude`'una iz bırakmadan), yerel git marketplace'ten; GitHub'a push yok. Doğrula: (1) GitHub/marketplace kurulumu, iki adımlı + tek adımlı; (2) plugin hook exit 2 engellemesi; (3) komut metninde `${CLAUDE_PLUGIN_ROOT}` yolu
- [ ] Sonuca göre yazılı plugin tasarımı (neyin plugin'e, neyin projeye; `/vibecode:init`; geçiş yolu) → kullanıcı onayı → uygulama
- [ ] **vibeplan reposuna dokunma** (kullanıcı kararı, 2026-09-25); yanıtlar Türkçe

## Active Skills
- superpowers:brainstorming (plugin tasarımı mimari iş — spike → yazılı tasarım → onay)
