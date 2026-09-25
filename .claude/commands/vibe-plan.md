---
description: "Create an architecture plan for a new feature or project"
---

## Feature: $ARGUMENTS

Create a detailed architecture plan. Do NOT write any code until the plan is approved.

> **Model:** Planlama muhakemesi **Opus** üzerinde koşar. Bu oturum (ana oturum) hangi modelde olursa olsun yalnızca **orkestrasyon** yapar: MCP kurulumu, Serena planning-mode, harici AI danışma turu (Step 1.5), sunum ve onay kapısı. Asıl araştırma + plan yazımı bir **Opus subagent'ına** dispatch edilir: `Agent(subagent_type: "general-purpose", model: "opus")` — bu tipin `Write` + Serena/Context7 erişimi vardır (`architect` tipinde Write yok, bu yüzden kullanılmaz). Sonnet'e delege ETME. Routing kuralları: `.vibecode/standards/delegation.md`.

### 0. MCP Setup & Check
Ensure MCP servers are configured and running before any work begins:

1. **Check `.mcp.json`** — Should already exist (tracked in git). If missing for any reason, create it with Serena (`--project-from-cwd`) and Context7 servers, then WARN: "`.mcp.json` was missing and recreated — restart session for MCP servers." Then **STOP**.

2. **Check `.serena/project.yml`** — NOT tracked in git (it is in `.gitignore`); the session-start hook auto-creates it from `.vibecode/templates/serena-project.yml` on first run. If missing, auto-detect languages and create it. If task needs a language not listed, add it and note restart is needed.

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

### 1. Dispatch Opus Planning Subagent
Steps 1a–1d (standart yükleme, araştırma, plan yazımı, INDEX güncelleme) **tek bir Opus subagent'ında** koşar. Ana oturum bu subagent'ı `Agent(subagent_type: "general-purpose", model: "opus", run_in_background: false)` ile **senkron** çağırır (onay kapısından önce plan dosyası hazır olmalı).

Subagent'a verilecek görev tanımı (aynen ilet):

> **Görev:** `$ARGUMENTS` için mimari plan yaz. Model: Opus. KOD YAZMA — sadece plan dosyası.
>
> **1a. Standartları yükle**
> - Read `.vibecode/standards/architecture.md` (§1.1 plan şablonu dahil)
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
> **1c. Plan dosyasını yaz** — `docs/architecture/$ARGUMENTS-plan.md`, `.vibecode/standards/architecture.md` §1.1 şablonuyla (tek şablon; N/A bölümleri atla). Portlar kullanıcının ports dosyasından gelir (`ports.md` §1) — uydurma.
>
> **1d. INDEX'i güncelle** — `docs/architecture/INDEX.md` içinde "Aktif Planlar" altına tek satır ekle:
> ```
> - [$ARGUMENTS]($ARGUMENTS-plan.md) — bir cümlelik özet (~80 karakter)
> ```
> Bu plan önceki bir planı geçersiz kılıyorsa, o satırı "Superseded / Arşivlenmiş" bölümüne **taşı**: `superseded by [$ARGUMENTS]`.
>
> **DÖNÜŞ:** Yazdığın plan dosyasının yolunu + 3-5 maddelik özet + Open Questions listesini döndür.
>
> **YAPMA:** Kod yazma, uygulama yapma, test yazma, plan dosyası dışında dosya değiştirme, `ls docs/architecture/` çekme, onay kapısını atlama.

Subagent döndükten sonra ana oturum yalnızca dönen özeti tutar; plan dosyası Step 2'de bir kez okunur.

### 1.5 Consultation — Harici AI Danışma Turu (OPSİYONEL, bounded)

> Taslak plan hazır olduktan sonra, yapılandırılmışsa, plan harici bir AI sağlayıcısına
> (v1: **DeepSeek**) eleştiri için gönderilir; makul öneriler entegre edilir. `max_rounds` config'ten
> okunur (**default 1**). **Son söz her zaman Opus planlama subagent'ındadır** — DeepSeek yalnızca
> danışman. `consult-provider.sh` çok-tur bilmez (her round tek istek/tek cevap). Mekanizma
> **fail-open**: her hata/eksik yapılandırma normal akışa döner — güvenlik kapısı değil, opsiyonel
> kalite adımı (bkz. `docs/guides/framework-security.md §2`). **Ana context'e ham eleştiri veya plan dosyası AKTARILMAZ** —
> yalnızca subagent'ın döndürdüğü kısa özet.

**0. Kaçış kapısı:** `$ARGUMENTS` içinde `--no-consult` varsa → bu adımı atla, Step 2. (Bayrağı Step 1'de
   plan dosya adı/slug'ından da çıkar.)

**1. Ön kontrol:** `.vibecode/config/ai-providers.json` yoksa → sessizce Step 2.

**2. Round döngüsü** — `round = 1`, `max_rounds` = config değeri (default 1):

   **a. Script'i çağır (Bash, round başına BİR kez), çıktıyı dosyaya yönlendir:**
   ```
   .vibecode/scripts/consult-provider.sh <plan-dosya-yolu> > "${TMPDIR:-/tmp}/vibe-consult-<slug>.md"                     # round 1
   .vibecode/scripts/consult-provider.sh <plan-dosya-yolu> --exclude-appendix > "${TMPDIR:-/tmp}/vibe-consult-<slug>.md"  # round 2+
   ```
   (`--exclude-appendix`: DeepSeek'e kendi önceki turlarını geri besleme.)

   **b. Sonucu yorumla (içeriği okumadan):**
   - **exit 0 + boş dosya** → provider disabled / key yok → sessizce Step 2 (`round==1` ise tek satır:
     "Danışma turu atlandı: provider yapılandırılmamış").
   - **exit ≠ 0** → "Danışma turu round N'de durdu: <stderr>" → o ana kadarki entegrasyonlar korunur → Step 2.
   - **exit 0 + dolu dosya** → tek satır: "Danışma turu round N: geri bildirim alındı." → adım c.

   **c. Entegrasyon (senkron Opus subagent):** `Agent(subagent_type: "general-purpose", model: "opus", run_in_background: false)`:
   > Round N. Plan dosyası: `<yol>`. Harici eleştiri: `<consult çıktı dosyası>` (ikisini de oku).
   > (1) Makul/isabetli önerileri plana ENTEGRE et; katılmadıklarını uygulama. (2) Plan dosyasının
   > SONUNA `## Appendix: External Review (DeepSeek)` yoksa oluştur; altına `### Round N`: eleştirinin
   > kısa özeti + alınan/reddedilen öneriler (gerekçeli). (3) DÖNÜŞ: en fazla 5 maddelik özet
   > (alınan/reddedilen) + son satırda `VERDICT: CONVERGED` veya `VERDICT: CONTINUE`. KOD YAZMA.

   Ana oturum yalnızca bu özeti kullanıcıya gösterir.

   **d. Döngü kontrolü:** `CONVERGED` veya `round == max_rounds` → Step 2. `CONTINUE` ve
   `round < max_rounds` → `round++`, adım a.

### 2. Present Plan
Plan dosyasını **bir kez** oku ve kullanıcıya göster (subagent özeti + dosya içeriği + varsa danışma özeti).

### 3. Wait for Approval
**STOP HERE.** Do NOT proceed without explicit user approval.

Say: "Plan written to `docs/architecture/$ARGUMENTS-plan.md` (INDEX güncellendi, Opus ile yazıldı). Please review and approve before I begin implementation."

**Onay (veya planlamanın iptali) sonrası:** Serena'yı düzenleme moduna geri al — `switch_modes` with `["editing", "interactive"]`. Uygulama `/vibe-go` veya `/vibe-sdd` ile başlar.
