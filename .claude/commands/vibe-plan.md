---
description: "Create an architecture plan for a new feature or project"
---

## Feature: $ARGUMENTS

Create a detailed architecture plan. Do NOT write any code until the plan is approved.

> **Model:** Planlama muhakemesi **Fable** üzerinde koşar. Bu oturum (ana oturum) hangi modelde olursa olsun yalnızca **orkestrasyon** yapar: MCP kurulumu, Serena planning-mode, harici AI danışma turu (Step 1.5), sunum ve onay kapısı. Asıl araştırma + plan yazımı bir **Fable subagent'ına** dispatch edilir: `Agent(subagent_type: "claude", model: "fable")` — bu tipin `Write` + Serena/Context7 erişimi vardır (`architect` tipinde Write yok, bu yüzden kullanılmaz). Sonnet'e delege ETME.

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
- This disables all write tools in Serena — only read/search/analysis tools remain active. The Fable subagent shares this Serena connection, so it also inherits read-only mode.
- After plan is approved and implementation begins (via `/vibe-go`), mode automatically returns to `["editing", "interactive"]`

### 1. Dispatch Fable Planning Subagent
Steps 1a–1d (standart yükleme, araştırma, plan yazımı, INDEX güncelleme) **tek bir Fable subagent'ında** koşar. Ana oturum bu subagent'ı `Agent(subagent_type: "claude", model: "fable", run_in_background: false)` ile **senkron** çağırır (onay kapısından önce plan dosyası hazır olmalı).

Subagent'a verilecek mikro-spec (aynen ilet):

> **Görev:** `$ARGUMENTS` için mimari plan yaz. Model: Fable. KOD YAZMA — sadece plan dosyası.
>
> **1a. Standartları yükle**
> - Read `.vibecode/standards/architecture.md`
> - Read all files in `docs/constraints/*.md`
>
> **1b. Araştır**
> - Read `docs/architecture/INDEX.md` — bir satır özetlerden ilgili eski planları tespit et (mevcut planların tek otoritesi; `ls docs/architecture/` ÇEKME).
> - Sadece **ilgili** plan dosyalarını targeted Read et (hepsini değil).
> - Serena ile mevcut kod tabanında ilgili kodu analiz et (`get_symbols_overview` → `find_symbol`).
> - Üçüncü parti kütüphane kararları için Context7 kullan.
> - `docs/decisions.md` içindeki önceki mimari kararları gözden geçir.
>
> **1c. Plan dosyasını yaz** — `docs/architecture/$ARGUMENTS-plan.md`, şu şablonla (N/A bölümleri atla):
>
> ```markdown
> # Architecture Plan: $ARGUMENTS
>
> ## Overview & Goals
> [What this feature does and why it's needed]
>
> ## Directory Structure Changes
> [New directories, files to create or modify]
>
> ## Tech Decisions
> [Libraries, patterns, approaches — with rationale for each]
>
> ## Database Schema
> [New tables, columns, relationships, indexes — skip if N/A]
>
> ## API Contract
> [New endpoints: method, path, request/response shapes — skip if N/A]
>
> ## Docker Services
> [New containers, volumes, networks — skip if N/A]
>
> ## Port Assignments
> [Read from `.vibecode/standards/ports.md` — assigned ports for any new services]
>
> ## Security Considerations
> [Auth, CORS, rate limiting, input validation relevant to this feature]
>
> ## Migration Plan
> [Steps to implement without breaking existing functionality]
>
> ## Open Questions
> [Decisions that need user input before proceeding]
> ```
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

Subagent döndükten sonra ana oturum plan dosyasını okur ve devam eder.

### 1.5 Consultation — Harici AI Danışma Turu (OPSİYONEL, bounded convergence loop)

> Taslak plan hazır olduktan sonra, yapılandırılmışsa, plan harici bir AI sağlayıcısına
> (v1: **DeepSeek**) eleştiri için gönderilir; makul öneriler entegre edilir; DeepSeek yeni
> esaslı itiraz üretmeyene (`CONVERGED`) **veya** `max_rounds`'a ulaşana kadar tekrarlanır.
> **Son söz her zaman Fable'dadır** — DeepSeek yalnızca danışman. Tüm döngü mantığı burada,
> orkestrasyonda; `consult-provider.sh` script'i çok-tur bilmez (her round tek istek/tek cevap).
> Mekanizma **fail-open**: her hata/eksik yapılandırma normal akışa sessizce/kesintisiz döner —
> bu bir güvenlik kapısı değil, opsiyonel bir kalite adımıdır (bkz. `security.md §8`).

**0. Kaçış kapısı:** `$ARGUMENTS` içinde `--no-consult` varsa → bu adımı TAMAMEN atla, doğrudan
   Step 2. (Hassas planlar için; config değiştirmeye gerek kalmaz. Not: `--no-consult` bayrağını
   Step 1'de plan dosya adı/slug'ından da çıkar — dosya adına karışmasın.)

**1. Ön kontrol:** `.vibecode/config/ai-providers.json` yoksa → sessizce Step 2. Varsa devam.
   (Script zaten tüm kontrolleri kendi yapar; buradaki amaç gereksiz Bash çağrısından kaçınmak.)

**2. Convergence döngüsü** — `round = 1`, `max_rounds` = config'teki değer (default 3):

   **a. Script'i çağır (Bash tool ile, round başına BİR kez):**
   ```
   .vibecode/scripts/consult-provider.sh <plan-dosya-yolu>            # round 1
   .vibecode/scripts/consult-provider.sh <plan-dosya-yolu> --exclude-appendix   # round 2+
   ```
   `--exclude-appendix` (round 2+): DeepSeek'e kendi önceki turlarının çıktısını (Appendix)
   geri besleme — feedback-bloat/döngüsel referans önlemi (script Appendix başlığından itibaren kırpar).

   **b. Script sonucunu yorumla:**
   - **exit 0 + boş stdout** → provider disabled / key yok / config yok → **sessizce Step 2'ye geç**
     ("Danışma turu atlandı: provider yapılandırılmamış" — tek satır, `round==1` ise).
   - **exit ≠ 0 + stderr** → hata/timeout/non-200 → döngü BURADA durur ("Danışma turu round N'de
     durdu: <stderr>"). O ana kadarki entegrasyonlar KORUNUR → Step 2. (Sadece oturum-içi advisory,
     kalıcı log YOK.)
   - **exit 0 + eleştiri metni** → şeffaflık için tek satır bas: **"Danışma turu round N: plan
     DeepSeek'e gönderildi, geri bildirim alındı."** → adım c.

   **c. Entegrasyon + convergence kararı (senkron Fable subagent):** Step 1'deki aynı slug için
   `Agent(subagent_type: "claude", model: "fable", run_in_background: false)` çağır. Mikro-spec:
   > Round N. Sana mevcut plan dosyası (`<yol>`) + aşağıdaki harici eleştiri veriliyor. (1) Makul/
   > isabetli önerileri plana ENTEGRE et (ilgili bölümleri güncelle; katılmadıklarını uygulama).
   > (2) Plan dosyasının SONUNDA `## Appendix: External Review (DeepSeek)` bölümü yoksa oluştur;
   > altına `### Round N` alt-başlığı ekle: DeepSeek'in ham eleştirisi + hangi önerileri
   > aldığın/reddettiğin (gerekçeli, kısa liste). (3) Son satırında bir CONVERGENCE VERDICT döndür:
   > `VERDICT: CONVERGED` (yeni esaslı/aksiyon alınabilir itiraz kalmadı) VEYA `VERDICT: CONTINUE`
   > (DeepSeek'in görüşü tekrar sorulmaya değer yeni bir açı içeriyor). KOD YAZMA, sadece plan dosyası.
   >
   > **[buraya script'in stdout'undaki eleştiri metnini yapıştır]**

   **d. Döngü kontrolü:**
   - Verdict `CONVERGED` → döngü biter → Step 2.
   - Verdict `CONTINUE` **ve** `round < max_rounds` → `round++`, adım a'ya dön.
   - Verdict `CONTINUE` **ve** `round == max_rounds` → cap doldu, döngü biter
     ("Danışma turu: max_rounds (N) doldu, mevcut haliyle devam ediliyor") → Step 2.

Döngü bittiğinde nihai plan (bir/çok round entegre edilmiş veya hiç consultation olmamış) hazırdır.

### 2. Present Plan
Show the complete plan to the user (subagent'ın döndürdüğü özeti + dosya içeriğini).

### 3. Wait for Approval
**STOP HERE.** Do NOT proceed without explicit user approval.

Say: "Plan written to `docs/architecture/$ARGUMENTS-plan.md` (INDEX güncellendi, Fable ile yazıldı). Please review and approve before I begin implementation."
