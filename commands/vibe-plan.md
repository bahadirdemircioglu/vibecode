---
description: "Idea → discovery → Understanding Lock → Opus architecture plan → DeepSeek debate → approval"
---

## Feature: $ARGUMENTS

From a rough idea to an approved architecture plan. Do NOT write any code until the plan is approved.

**Arguments:** `<feature-slug> [idea text] [--no-debate]` (`--no-consult` is an alias). Derive a
kebab-case slug from the idea if only a description was given, and confirm it. `--no-debate` skips
the DeepSeek debate (sensitive plans — the plan text leaves the machine).

> **Model:** Planlama muhakemesi **Opus** üzerinde koşar. Bu oturum (ana oturum) hangi modelde olursa olsun yalnızca **orkestrasyon** yapar: MCP kurulumu, Serena planning-mode, keşif soruları + Understanding Lock (Step 0.7), sunum ve onay kapısı. Asıl araştırma + plan yazımı bir **Opus subagent'ına** dispatch edilir: `Agent(subagent_type: "general-purpose", model: "opus")` — bu tipin `Write` + Serena/Context7 erişimi vardır (`architect` tipinde Write yok, bu yüzden kullanılmaz). Sonnet'e delege ETME. Routing kuralları: `${CLAUDE_PLUGIN_ROOT}/.vibecode/standards/delegation.md`.

### 0. MCP Setup & Check
Ensure MCP servers are configured and running before any work begins:

1. **MCP servers** — Serena and Context7 come from the vibecode plugin (no `.mcp.json` needed). If their tools are unavailable, say so once ("Serena/Context7 not connected — check `/mcp`") and continue with Grep/Read and official docs. Do NOT create `.mcp.json`.

2. **Check `.serena/project.yml`** — NOT tracked in git (it is in `.gitignore`); the session-start hook auto-creates it from `${CLAUDE_PLUGIN_ROOT}/.vibecode/templates/serena-project.yml` on first run. If missing, auto-detect languages and create it. If task needs a language not listed, add it and note restart is needed.

3. **Verify MCPs** — Call `get_current_config` on Serena:
   - Active project with correct languages → "Serena: OK"
   - No active project → "Serena: UNAVAILABLE — restart session"
   - Context7: try a Context7 tool call
     - responds → "Context7: OK"
     - silent → "Context7: UNAVAILABLE — falling back to official docs"

If Serena is unavailable, WARN the user and ask if they want to continue without it. Serena is critical for token-efficient code navigation.

### 0.5 Serena Planning Mode
Switch Serena to read-only planning mode to prevent accidental file writes during planning:
- Call `switch_modes` with `["planning", "interactive"]`
- This disables all write tools in Serena — only read/search/analysis tools remain active. The planning subagent shares this Serena connection, so it also inherits read-only mode.
- Nothing switches it back automatically — Step 3 calls `switch_modes(["editing", "interactive"])` after the approval gate.

### 0.7 Discovery + Understanding Lock (ana oturum — HARD GATE)
Skip questions already answered in the arguments or in an existing `docs/architecture/<slug>-plan.md`
with `**Status:** concept` (then go straight to Step 1 with that file as input).

Ask **ONE question per message**, prefer multiple-choice; if the user is unsure, propose a default and
mark it as an **assumption**:
1. **Problem & users** — what problem, for whom, what if it's never built?
2. **Scope** — smallest valuable version, explicit non-goals, hard constraints (deadline, team, regulatory)
3. **Technical** — the stack is fixed (`docs/constraints/`, `${CLAUDE_PLUGIN_ROOT}/.vibecode/standards/`): don't ask for a
   preference. Ask: integrations, scale (users / data / traffic), anything the stack can't cover

Then present the **Understanding Lock**: summary (5-7 bullets: what, why, for whom, key constraints,
non-goals, success criteria), **assumptions**, **open questions**, and ask:

> "Bu anlayış doğru mu? **(1)** düzelt · **(2)** onayla ve planla · **(3)** onayla ama şimdilik sadece fikir olarak kaydet"

- **(1)** → correct and repeat the Lock
- **(3)** → write `docs/architecture/<slug>-plan.md` with only *Overview & Goals*, *Non-Goals*,
  *Assumptions*, *Decision Log*, *Open Questions* and `**Status:** concept`; add it to INDEX.md with
  `(concept)`. STOP. A later `/vibe-plan <slug>` resumes at Step 1.
- **(2)** → Step 1. **DO NOT proceed without explicit confirmation.**

### 1. Dispatch Opus Planning Subagent
Steps 1a–1d (standart yükleme, araştırma, plan yazımı, INDEX güncelleme) **tek bir Opus subagent'ında** koşar. Ana oturum bu subagent'ı `Agent(subagent_type: "general-purpose", model: "opus", run_in_background: false)` ile **senkron** çağırır (onay kapısından önce plan dosyası hazır olmalı).

Subagent'a verilecek görev tanımı (aynen ilet; `<LOCK>` = onaylanan Understanding Lock metni):

> **Görev:** `<slug>` için mimari plan yaz. Model: Opus. KOD YAZMA — sadece plan dosyası.
> **Onaylı anlayış (bağlayıcı):** <LOCK>
>
> **1a. Standartları yükle**
> - Read `${CLAUDE_PLUGIN_ROOT}/.vibecode/standards/architecture.md` (§1.1 plan şablonu dahil)
> - `docs/constraints/*.md`: önce `grep -L '\[e.g.,' docs/constraints/*.md` ile doldurulmuş dosyaları bul;
>   yalnızca doldurulmuş **ve** bu feature'la ilgili olanları oku (placeholder şablonları okuma)
>
> **1b. Araştır**
> - Read `docs/architecture/INDEX.md` — bir satır özetlerden ilgili eski planları tespit et (mevcut planların tek otoritesi; `ls docs/architecture/` ÇEKME).
> - Sadece **ilgili** plan dosyalarını targeted Read et (hepsini değil).
> - Serena ile mevcut kod tabanında ilgili kodu analiz et (`get_symbols_overview` → `find_symbol`).
> - Üçüncü parti kütüphane kararları için Context7 kullan.
> - Önceki kararlar: `grep -n '^## ADR\|\*\*Status:\*\*' docs/decisions.md` ile yalnızca ADR başlık/durumlarını al; sadece ilgili ADR'nin gövdesini targeted oku.
>
> **1c. Plan dosyasını yaz** — `docs/architecture/<slug>-plan.md`, `${CLAUDE_PLUGIN_ROOT}/.vibecode/standards/architecture.md` §1.1 şablonuyla (tek şablon; N/A bölümleri atla). Portlar kullanıcının ports dosyasından gelir (`ports.md` §1) — uydurma.
>
> **1d. INDEX'i güncelle** — `docs/architecture/INDEX.md` içinde "Aktif Planlar" altına tek satır ekle:
> ```
> - [<slug>](<slug>-plan.md) — bir cümlelik özet (~80 karakter)
> ```
> Bu plan önceki bir planı geçersiz kılıyorsa, o satırı "Superseded / Arşivlenmiş" bölümüne **taşı**: `superseded by [<slug>]`.
>
> **1e. DeepSeek tartışması** (görevde `--no-debate` yoksa) — sen eleştirilen tarafsın, planı yalnızca sen düzenlersin:
> 1. `node "${CLAUDE_PLUGIN_ROOT}/.vibecode/scripts/deepseek-debate.js" critique docs/architecture/<slug>-plan.md --new` (sonraki turlarda `--new` yok).
>    Exit 4 (`SKIPPED`: config kapalı / anahtar yok) veya exit 1 (API hatası — script zaten yeniden denedi) → tartışmayı
>    bırak, dönüşte belirt. **Plan asla DeepSeek yüzünden bloklanmaz.** `NEXT: done` → adım 4.
> 2. Her açık maddeye karar ver: **accept** → önce planı düzelt, sonra yaptığın değişikliği yaz; **reject** → somut
>    gerekçe. DeepSeek yalnızca plan dosyasını görür: gerekçe onaylı anlayışa/keşfe dayanıyorsa önce bunu plana
>    (Assumptions / Decision Log) yaz. Standartlar, `docs/constraints/` ve onaylı anlayış DeepSeek'ten önce gelir.
>    Tartışmayı bitirmek için kabul etme, inat için reddetme.
> 3. `node "${CLAUDE_PLUGIN_ROOT}/.vibecode/scripts/deepseek-debate.js" respond docs/architecture/<slug>-plan.md - <<'EOF'` +
>    `[{"id":"D1","decision":"accept|reject","response":"..."}]` + `EOF` — her açık madde için bir kayıt.
>    `NEXT: critique` → adım 1. `NEXT: done` → adım 4.
> 4. Çıktı `decided-by-claude` maddeler listelediyse (tur limiti) her birini planın **Open Questions**'ına ekle:
>    `- [ ] [DeepSeek Dx] <itiraz> — Planlayıcı kararı: <gerekçe>`.
>
> **DÖNÜŞ:** Plan dosyasının yolu + 3-5 maddelik özet + Open Questions + tartışma özeti (tur sayısı, agreed /
> decided-by-claude sayıları, DeepSeek'in tetiklediği ana değişiklikler; ya da neden atlandığı).
>
> **YAPMA:** Kod yazma, uygulama yapma, test yazma, plan dosyası dışında dosya değiştirme (tartışma kayıtlarını
> script yazar), `ls docs/architecture/` çekme, onay kapısını atlama.

Subagent döndükten sonra ana oturum yalnızca dönen özeti tutar; plan dosyası Step 2'de bir kez okunur.
Tartışma kaydı: `docs/architecture/debates/<slug>.md` (script üretir — elle düzenlenmez).

### 2. Present Plan
Plan dosyasını **bir kez** oku ve kullanıcıya göster (subagent özeti + dosya içeriği + tartışma özeti).

### 3. Wait for Approval
**STOP HERE.** Do NOT proceed without explicit user approval.

Say: "Plan written to `docs/architecture/<slug>-plan.md` (INDEX güncellendi, Opus ile yazıldı). Please review and approve before I begin implementation."

**Onay (veya planlamanın iptali) sonrası:** Serena'yı düzenleme moduna geri al — `switch_modes` with `["editing", "interactive"]`. Uygulama `/vibe-go` veya `/vibe-sdd` ile başlar.
