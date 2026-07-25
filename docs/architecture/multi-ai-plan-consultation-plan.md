# Architecture Plan: Multi-AI Plan Consultation (DeepSeek)

> **Kaynak istek:** "Plan yapma sürecine başka bir yapay zeka ile konuşma eklemek istiyorum. Önce
> bizim model planı hazırlayacak ve diğer modele/provider'a soracak. Nihai haline beraber
> getirecekler. Bunun için provider ve apikey eklenecek bir şey lazım. İlk etapta sadece DeepSeek
> olacak."
> **Ortam notu:** Bu oturumda Serena kapalıydı — kod navigasyonu Grep/Read ile yapıldı. Repo bir
> framework/meta-repo (backend/frontend app yok); bu yüzden Database Schema / Docker / Port
> bölümleri N/A.

---

## Overview & Goals

`/vibe-plan` bugün tek modelli: Fable subagent standartları okur, araştırır, planı yazar, onay
kapısına sunar. Bu plan bir **opsiyonel danışma turu** ekliyor: Fable taslağı bitirdikten sonra,
yapılandırılmışsa, planı harici bir sağlayıcıya (v1: **DeepSeek**) gönderip eleştiri/öneri alır,
makul olanları plana entegre eder ve orijinal harici görüşü şeffaflık için plana ek olarak bırakır.

**Hedefler:**
1. `/vibe-plan` çıktısının kalitesini ikinci bir modelin bakış açısıyla artırmak.
2. Provider + API key için **genişletilebilir ama minimal** bir config katmanı kurmak — sadece
   DeepSeek ile başla, gelecekte başka OpenAI-uyumlu sağlayıcı eklemek "config satırı" seviyesinde
   kalsın.
3. Danışma turu **tamamen opsiyonel**: provider yapılandırılmamışsa/key yoksa/hata olursa `/vibe-plan`
   mevcut (tek-modelli) akışına **sessizce ve kesintisiz** düşsün.
4. Aşırı mühendislik yapmamak: convergence'a kadar **bounded çok-tur** danışma (`max_rounds` cap'i
   ile sınırlı), tek dosya config, bash+curl script — SDK yok, yeni agent/hook zinciri yok, döngü
   mantığı script'te değil orkestrasyonda kalır (script basit/tek-istekli kalır).

**Bu planın kapsamı dışı (bilinçli):** Gerçek implementasyon (script/config dosyalarının
yazılması). `architecture.md §1`'e göre kod/implementasyon `/vibe-go` onaydan SONRA başlar. Bu
belge sadece mimariyi tarif eder.

---

## Directory Structure Changes

Hepsi config/doc/script — framework kaynak kodu değişmiyor (bu repo zaten sadece config+script+md
barındırıyor, backend/frontend app yok):

```
Yeni dosyalar:
├── .vibecode/config/ai-providers.json          # YENİ — provider registry (non-secret config)
├── .vibecode/scripts/consult-provider.sh        # YENİ — genel OpenAI-uyumlu REST çağrısı
├── .env.example                                 # YENİ (root) — DEEPSEEK_API_KEY placeholder
└── docs/architecture/multi-ai-plan-consultation-plan.md   # bu dosya

Değişecek dosyalar:
├── .gitignore                                   # GÜNCEL — root'a .env / .env.local eklenir
│                                                 #   (şu an root .gitignore'da .env YOK — sadece
│                                                 #   .vibecode/templates/.gitignore'da, o üretilen
│                                                 #   projeler için; framework'ün KENDİSİ artık bir
│                                                 #   secret dosyasına ihtiyaç duyuyor)
├── .claude/commands/vibe-plan.md                # GÜNCEL — Step 1.5 "Consultation (opsiyonel)"
├── .vibecode/standards/security.md              # GÜNCEL — §8 harici AI danışma + secret hijyeni
├── .claude/settings.json                        # GÜNCEL (opsiyonel, /vibe-go aşamasında) —
│                                                 #   consult-provider.sh için allow-list satırı
├── docs/CHANGELOG.md                            # GÜNCEL — onay sonrası, implementasyonda
└── docs/decisions.md                            # GÜNCEL — ADR (onay sonrası)

Değişmeyecek:
├── .claude/hooks/*                              # Dokunulmuyor — bu bir hook DEĞİL (bkz. Tech Decisions §3)
└── .claude/agents/*                             # Dokunulmuyor — mevcut 8 rol yeterli
```

---

## Tech Decisions

### 1. Config formatı: JSON, tek dosya, non-secret

`.vibecode/config/ai-providers.json`:

```json
{
  "active_provider": "deepseek",
  "max_rounds": 3,
  "providers": {
    "deepseek": {
      "enabled": true,
      "request_shape": "openai-compatible",
      "base_url": "https://api.deepseek.com",
      "chat_path": "/chat/completions",
      "model": "deepseek-chat",
      "api_key_env": "DEEPSEEK_API_KEY",
      "timeout_seconds": 45,
      "max_tokens": 2048
    }
  }
}
```

**`max_rounds` (root-level, default 3):** Bounded-convergence döngüsünün güvenlik cap'i — kaç tur
danışma yapılacağının **üst sınırı**, hedef sayı değil (döngü `CONVERGED` verdict'i ile daha erken
de durabilir). Bkz. "/vibe-plan Akış Değişikliği".

**`request_shape` (provider başına, şimdilik tek değer: `"openai-compatible"`):** Provider'ın kabul
ettiği request/response şeklini işaretler. v1'de sadece `openai-compatible` kod yolu implemente
edilir (DeepSeek + gelecekteki benzer sağlayıcılar bu şekli paylaşır). Alan şimdiden şemaya
eklendi ki 2. provider native bir şekilde (`anthropic-native`, `gemini-native`) gelirse script'e
kırılmadan yeni bir `case` dalı eklenebilsin — bkz. Provider Abstraction.

**Gerekçe:** JSON seçildi çünkü repo genelinde zaten `jq` bağımlılığı var (`session-start.sh`,
`vibe-update` script'i) — YAML için ek `yq` bağımlılığı gerekmez. Dosya **secret içermez**, sadece
"hangi provider, hangi model, hangi env var'dan key okunacak" — bu yüzden git'e commit edilebilir
(gitignore'a girmez), takım arkadaşları arasında paylaşılabilir. Gerçek key `.env`'de kalır.

### 2. Secret: `.env` (root, gitignore'da) — script env'den okur

**Gerekçe:** Mevcut `security.md §7` ve `settings.json` deny-list zaten `.env` okuma/yazmayı
Claude'un kendi tool'ları için engelliyor (`Read(**/.env)`, `Bash(cat *.env*)`, `Bash(*> .env*)`).
Bu, script'in kendisini (bash süreci olarak) etkilemez — script normal shell env genişletmesiyle
`$DEEPSEEK_API_KEY`'i okur, Claude'un Read/Bash-cat tool'ları .env dosyasının **içeriğini
Claude'un context'ine** sızdırmaz. Aynı desen zaten `.vibecode/templates/.env.example` ve
`db-backup.sh`'de kullanılıyor (üretilen projeler için); burada framework'ün kendisi için
tekrarlanıyor.

**Kritik fark:** Bu repo'nun **kendisinde** (üretilen projelerden farklı olarak) şimdiye kadar
root-level `.env` kavramı yoktu (backend/frontend olmadığı için). Bu plan, framework'ün ilk kez
kendi secret dosyasına ihtiyaç duyduğu an — root `.gitignore`'a `.env`/`.env.local` eklenmesi bu
yüzden zorunlu (şu an eksik).

### 3. Danışma turu NE olarak koşar: script, hook değil

Üç seçenek değerlendirildi:

| Seçenek | Trade-off |
|---|---|
| **PreToolUse/PostToolUse hook** (Write'ı yakalayıp plan dosyası yazılınca otomatik tetikle) | ❌ Reddedildi. Hook her matcher'a uyan tool call'da çalışır — plan dosyası dışındaki Write'ları da yakalar (path filtresi eklemek gerekir, kırılgan). ADR-006 zaten "iki hook her Bash/Write/Edit'te küçük overhead ekliyor" diye not düşmüş — üçüncü bir hook zinciri eklemek bunu büyütür. En önemlisi: hook'lar **network I/O + uzun timeout** için doğru katman değil (fail-closed/fail-open semantiği network hatası senaryosunda belirsizleşir), ve "opsiyonel + görünür" davranış hook'un sessiz/arka-plan doğasıyla çelişir. |
| **Ayrı script, `/vibe-plan` içinden explicit çağrılır (Bash tool)** ✅ **SEÇİLDİ** | ✅ Sadece bu tek akışta, bu tek adımda çalışır — path/scope belirsizliği yok. ✅ Timeout/hata/skip mantığı script içinde net (exit code + stdout/stderr ile orkestrasyona rapor). ✅ Mevcut `vibe-update` script deseniyle tutarlı (bash script, `.vibecode/scripts/`, orkestrasyon komuttan çağırıyor). ❌ Küçük dezavantaj: her `/vibe-plan` çağrısında komut dosyasının var olup olmadığı kontrol edilmeli (script kendi başına "yoksa sessiz atla" yapmalı). |
| **Subagent'ın çağırdığı bir "tool"** (custom MCP tool) | ❌ Reddedildi — over-engineering. Yeni bir MCP server yazmak/yapılandırmak, tek bir REST çağrısı için gereksiz altyapı; script + Bash tool aynı sonucu çok daha az yüzeyle verir. |

**Karar:** `.vibecode/scripts/consult-provider.sh` — bash + curl, Fable planning subagent'ı (veya
onu saran ana `/vibe-plan` orkestrasyonu) tarafından **Bash tool ile explicit çağrılır**. Script
kendi başına config/key kontrolü yapar, yoksa/hata varsa **exit 0 + boş/skip sinyali** verir (asla
`/vibe-plan` akışını fail ettirmez).

### 4. Script dili: bash + curl, SDK yok

**Gerekçe:** Görev talimatı zaten "basit REST — ağır SDK gerekmez" diyor; DeepSeek API OpenAI-uyumlu
düz REST endpoint'i (`POST https://api.deepseek.com/chat/completions`, `Authorization: Bearer
$KEY`, JSON body). Context7'den doğrulandı (`/websites/api-docs_deepseek`): endpoint, header ve
body şekli standart OpenAI chat-completions formatına birebir uyuyor. Node yerine bash seçildi çünkü
repo'daki script'ler (`session-start.sh`, `vibe-update`) zaten bash+`jq`; yeni bir runtime
(node script) sadece bu özellik için eklemek tutarsızlık yaratır. `jq` yoksa script sessizce atlar
(mevcut `session-start.sh`'deki "jq yoksa regex fallback" desenine benzer, ama burada JSON body
inşası regex ile güvenli yapılamayacağı için fallback "atla" olur, "regex ile dene" değil).

> **Not (model id çürümesi):** Context7'den çekilen güncel DeepSeek dokümantasyonu örneklerinde
> model id `deepseek-v4-pro` / `deepseek-v4-flash` görünüyor — daha eski, yaygın bilinen
> `deepseek-chat` / `deepseek-reasoner` isimlerinden farklı. Bu, sağlayıcı model isimlerinin
> zamanla değiştiğini gösteriyor. **Karar:** config dosyasındaki `model` alanı kullanıcı tarafından
> ayarlanır, script'te **hardcode edilmez**. Geçersiz model id → DeepSeek'in kendi hata mesajı
> script tarafından olduğu gibi yüzeye çıkarılır (bkz. Security Considerations — hata görünürlüğü).

---

## Config & Secrets (provider + apikey mekanizması)

| Katman | Dosya | İçerik | Git'e girer mi? |
|---|---|---|---|
| Provider registry (non-secret) | `.vibecode/config/ai-providers.json` | `active_provider`, `max_rounds` (root); `enabled`, `request_shape`, `base_url`, `chat_path`, `model`, `api_key_env`, `timeout_seconds`, `max_tokens` (provider başına) | ✅ Evet |
| Secret | `.env` (root) | `DEEPSEEK_API_KEY=sk-...` | ❌ Hayır — `.gitignore`'a eklenir |
| Secret template | `.env.example` (root) | `# DEEPSEEK_API_KEY=` (yorumlu, boş) | ✅ Evet |

**Akış:** script config'ten `active_provider` → `providers[active_provider]` okur → `enabled:
false` veya provider yoksa **atla**. `api_key_env` alanındaki isimle env var'ı okur (`$DEEPSEEK_API_KEY`)
→ boşsa **atla**. İkisi de doluysa çağrıyı yap.

**Neden `api_key_env` bir isim (indirection), doğrudan key değil:** Config dosyası git'e girdiği
için, hangi env var'ın okunacağı bilgisi (isim) commit edilebilir ama key'in kendisi asla
config dosyasına yazılmaz — bu, geliştiricinin yanlışlıkla key'i config'e yazıp commit etmesini
yapısal olarak zorlaştırır (config'te zaten bir "value" alanı yok, sadece "hangi env var" alanı var).

---

## Provider Abstraction (genişletilebilirlik — sadece DeepSeek ile başla)

**İlke:** Şu an tek bir somut sağlayıcı (`deepseek`) implemente edilir. Soyutlama **veri seviyesinde**
kalır (config'te `providers` bir map), **kod seviyesinde** yeni bir provider-interface/adapter
katmanı YAZILMAZ (YAGNI — bu, `wrongstack-pattern-adoption-plan.md`'nin bilinçli olarak "provider
katmanı kapsam dışı" dediği kararla aynı çizgide: WrongStack'in ~110-provider soyutlaması bize
gereksizdi, ama kullanıcı şimdi *gerçekten* ikinci bir provider istiyor — bu yüzden burada minimal,
config-driven bir istisna açılıyor, WrongStack'in ağır `models-registry.ts` mimarisi değil).

**Genişletme yolu (gelecekte 2. provider eklenince) — `request_shape` alanı ŞİMDİDEN şemada:**
1. `ai-providers.json`'a yeni bir `providers.<isim>` girişi ekle (base_url/chat_path/model/api_key_env/
   `request_shape`).
2. Girişin `request_shape: "openai-compatible"` ise (`messages` array + `choices[0].message.content`
   response — DeepSeek ve benzerleri) → **script değişmez**, sadece config + `.env`'e yeni key.
   Bu, v1'de implemente edilen **tek** kod yolu.
3. Girişin API şekli farklıysa (ör. Anthropic native `/v1/messages`, Google Gemini
   `generateContent`) → config'te `request_shape: "anthropic-native"` / `"gemini-native"` gibi yeni
   bir değer kullanılır; script'e o değer için provider-özel bir `case` dalı eklenir. **Bu dallar şu
   an yazılmıyor** — sadece alan şemada var olduğu için gelecekte kırılmadan (mevcut `deepseek`
   girişini bozmadan) eklenebiliyor.

**Sınır:** Bu plan **ikinci bir provider implement etmiyor** ve `openai-compatible` dışındaki
`case` dallarını yazmıyor — sadece config şemasının, alan seviyesinde, "DeepSeek dışında bir satır
daha eklenebilir" ve "farklı wire-format'lar için ileride kırılmadan genişletilebilir" şeklinde
tasarlandığını garanti ediyor (v1.0 kararı, bkz. Resolved Decisions #6).

---

## /vibe-plan Akış Değişikliği (taslak → danışma turu → nihai plan)

Mevcut akış (`vibe-plan.md`): **Step 0** (MCP check) → **Step 0.5** (Serena planning mode) →
**Step 1** (Fable subagent: standartları yükle → araştır → planı yaz → INDEX güncelle) → **Step 2**
(Present Plan) → **Step 3** (onay kapısı, STOP).

**Yeni akış — Step 1 ile Step 2 arasına eklenen Step 1.5, artık bir "bounded convergence loop":**

```
Step 1 (mevcut, değişmez): Fable subagent taslak planı docs/architecture/<slug>-plan.md'ye yazar
        │
        ▼
Step 1.5 — Consultation (OPSİYONEL, YENİ) — döngüyü ORKESTRASYON (/vibe-plan komutu) yönetir
  0. `--no-consult` argümanı geçildiyse → tamamen atla, doğrudan Step 2 (kaçış kapısı, bkz. Resolved
     Decisions #2). Aksi halde devam:
  1. .vibecode/config/ai-providers.json var mı + active_provider.enabled mı kontrol edilir.
     Yoksa/disabled ise → sessizce Step 2'ye geç (log: "Danışma turu atlandı: provider yapılandırılmamış").
  2. round = 1, max_rounds = config.max_rounds (default 3). Aşağıdaki döngü başlar:

     ┌─── ROUND N (N = 1..max_rounds) ──────────────────────────────────────────────┐
     │ a. Gönderilecek gövde hazırlanır:                                            │
     │      - Round 1 → plan dosyasının TAMAMI                                      │
     │      - Round 2+ → plan dosyası MINUS mevcut `## Appendix: External Review`   │
     │        bölümü (kendi önceki turlarının çıktısını DeepSeek'e geri besleme —   │
     │        bkz. Resolved Decisions #4, feedback-bloat / döngüsel referans önlemi)│
     │ b. consult-provider.sh Bash tool ile BİR KEZ çağrılır (script çok-tur bilmez,│
     │    sadece tek istek/tek cevap yapar — döngü mantığı script'te DEĞİL).        │
     │ c. Script sonucu:                                                            │
     │      - exit 1 / timeout / provider'ın token-limit hatası → döngü BURADA      │
     │        sonlanır (kısmi başarı: o ana kadarki round'ların entegrasyonları     │
     │        plan dosyasında KORUNUR). "Danışma turu N'de durdu: <kısa sebep>"     │
     │        advisory'si basılır → Step 2'ye geç.                                  │
     │      - exit 0 + eleştiri metni → devam:                                      │
     │ d. Fable subagent (senkron, aynı slug) çağrılır: "Round N — mevcut plan +    │
     │    DeepSeek eleştirisi verildi. Makul/isabetli önerileri plana entegre et.   │
     │    Plan dosyasının SONUNDAKİ '## Appendix: External Review (DeepSeek)'       │
     │    bölümüne 'Round N' alt-başlığı ekle: DeepSeek'in ham metni + hangi        │
     │    önerilerin alındığı/reddedildiği kısa liste. Son olarak bir CONVERGENCE   │
     │    VERDICT döndür: `CONVERGED` (yeni esaslı/aksiyon alınabilir itiraz kalmadı)│
     │    veya `CONTINUE` (entegre edildi ama DeepSeek'in görüşü tekrar sorulmaya   │
     │    değer yeni bir açı içeriyor)."                                            │
     │ e. Verdict `CONVERGED` → döngü biter → Step 2'ye geç.                        │
     │    Verdict `CONTINUE` VE round < max_rounds → round++, ROUND N+1'e dön.      │
     │    Verdict `CONTINUE` VE round == max_rounds → cap'e ulaşıldı, döngü biter   │
     │    ("Danışma turu: max_rounds (N) doldu, mevcut haliyle devam ediliyor"      │
     │    advisory'si basılır) → Step 2'ye geç.                                     │
     └───────────────────────────────────────────────────────────────────────────────┘

  3. Her round'un GERÇEKTEN çalıştığı anda (adım b başarıyla dönünce) kullanıcıya tek satır
     şeffaflık bildirimi basılır: "Danışma turu N: plan DeepSeek'e gönderildi, geri bildirim alındı."
     (Bkz. Security Considerations #6 — sessiz değil, her turda tekrar edilir.)
        │
        ▼
Step 2 (mevcut, değişmez): Present Plan — nihai (bir veya birden çok round entegre edilmiş VEYA
        hiç consultation olmamış) plan gösterilir
        │
        ▼
Step 3 (mevcut, değişmez): onay kapısı, STOP
```

**Son söz her zaman Fable'da.** DeepSeek yalnızca danışman rolünde — hangi önerinin plana
gireceğine, ne zaman "yeterince olgunlaştığına" (`CONVERGED`) karar veren her zaman Fable subagent'ı.
Bu, "kim son sözü söyler / ne zaman durur" belirsizliğinin çözümü (bkz. Resolved Decisions #1).

**Döngü nerede yaşıyor:** `consult-provider.sh` **çok-tur bilmez** — her çağrıda tek istek/tek
cevap yapar, script'in arayüzü (bkz. API Contract) değişmedi. Round sayacı, gövde hazırlama
(appendix hariç tutma), convergence-verdict okuma ve durma kararı tamamen `/vibe-plan`
orkestrasyonunun sorumluluğunda — script basit kalır.

---

## API Contract (DeepSeek chat completions çağrısı)

Bu bir yeni HTTP endpoint DEĞİL — script'in **dışarıya yaptığı** çağrının kontratı:

**Request** (script → DeepSeek):
```
POST https://api.deepseek.com/chat/completions
Content-Type: application/json
Authorization: Bearer $DEEPSEEK_API_KEY

{
  "model": "<config.model>",
  "messages": [
    {"role": "system", "content": "<sabit critique-prompt>"},
    {"role": "user", "content": "<plan dosyası tam metni>"}
  ],
  "stream": false,
  "max_tokens": <config.max_tokens>
}
```

**Response** (DeepSeek → script, başarı):
```json
{
  "choices": [
    {"message": {"role": "assistant", "content": "<eleştiri metni, markdown>"}}
  ]
}
```

Script `choices[0].message.content`'i `jq` ile çıkarır, stdout'a yazar (orkestrasyon bunu okuyup
o round'un Fable subagent çağrısına besler). Non-200 / timeout / `jq` parse hatası / provider'ın
token-limit hatası → script boş stdout + exit 1, orkestrasyon bunu "bu round'da durdur, önceki
round'ların entegrasyonlarını koru" olarak yorumlar (bkz. Flow adım 2c).

**Script'in KENDİ arayüzü** (orkestrasyonun gördüğü — döngüsüz, tek istek/tek cevap; **çok-tur
mantığı script'in DIŞINDA**):
```
consult-provider.sh <plan-content-file-path>
  exit 0 + stdout: eleştiri metni   → bu round başarılı
  exit 0 + boş stdout                → provider disabled/config yok (tüm consultation'ı sessizce atla)
  exit 1 + stderr: kısa sebep        → bu round başarısız (timeout/non-200/token-limit/jq yok);
                                        orkestrasyon döngüyü burada sonlandırır
```

**Çok-tur ↔ script çağrısı ilişkisi:** Her round, script'in **ayrı bir çağrısıdır** — script kendi
içinde round/tur kavramı bilmez, sadece "şu an elimde ne varsa onu bir kez gönder" yapar.
Orkestrasyon her çağrıdan önce `<plan-content-file-path>`'i hazırlar:
- **Round 1:** plan dosyasının tam içeriği, olduğu gibi geçici bir dosyaya kopyalanır (ya da
  doğrudan plan dosyası path'i verilir).
- **Round 2+:** plan dosyasının `## Appendix: External Review (DeepSeek)` bölümü **çıkarılmış**
  bir kopyası geçici bir dosyaya yazılır ve o path script'e verilir (bkz. Resolved Decisions #4 —
  DeepSeek'in kendi önceki çıktısını ona geri besleme). Bu kırpma **orkestrasyonun** işidir, script
  hiçbir filtreleme yapmaz — script her zaman "verilen dosyayı olduğu gibi gönder" davranışında
  kalır, basitliğini korur.

---

## Security Considerations

1. **API key asla commit edilmez:** `.env` root `.gitignore`'a eklenir (şu an eksik — bu planın en
   kritik tekil değişikliği). `.env.example` sadece placeholder içerir.
2. **API key asla loglanmaz/yazdırılmaz:** Script `curl -s` kullanır (verbose/echo yok), key'i
   sadece `Authorization` header'ında taşır, hiçbir noktada stdout/stderr'e yazmaz. Script hata
   mesajlarında HTTP status + kısa body snippet verebilir ama **header'ları asla** loglamaz.
3. **`.env` okuma mevcut deny-list'i kırmaz:** `settings.json`'daki `Read(**/.env)` /
   `Bash(cat *.env*)` deny kuralları Claude'un *kendi tool çağrılarını* hedefliyor — script'in
   normal shell env-genişletmesiyle env var okuması bu kısıtın kapsamı dışında (script zaten
   subprocess olarak env'i miras alır, Claude bir Read/cat çağrısı yapmıyor). Doğrulama: `/vibe-go`
   implementasyon aşamasında script'in `.env`'i `source` ETMEDİĞİNİ, sadece zaten export edilmiş
   `$DEEPSEEK_API_KEY`'i okuduğunu test et (yoksa kullanıcı `.env`'i manuel `source .env` etmeli —
   bu script'in dokümantasyonunda net yazılmalı, script kendisi `.env` dosyasını parse etmemeli ki
   deny-list'i dolanma şüphesi doğmasın).
4. **Timeout zorunlu:** `curl --max-time <config.timeout_seconds>` — hattaki bir yavaşlık
   `/vibe-plan`'ı asla süresiz bloklamaz.
5. **Fail-open (bu özellik için) — ADR-006'daki fail-closed hook felsefesinden BİLİNÇLİ sapma:**
   Bu script bir güvenlik kapısı değil, isteğe bağlı bir kalite-artırma adımı. Her hata durumunda
   **atla, devam et** — normal `/vibe-plan` akışını asla engellemez. (Karşılaştır: `net-fs-guard.js`
   / `permission-policy.js` fail-closed'dır çünkü onlar tehdit engelliyor; bu script fail-open'dır
   çünkü o sadece bir "bonus" adım.)
6. **Gizlilik / opt-in:** Plan içeriği (mimari düşünceler, muhtemelen proje/iş bağlamı) üçüncü
   parti bir API'ye gidiyor. **Opt-in mekanizması: config'i yapılandırmanın kendisi rıza sayılır**
   (`ai-providers.json`'da `enabled: true` yapmak + `.env`'e key koymak açık bir eylem, bkz.
   Resolved Decisions #2) — `enabled: true` iken **her** `/vibe-plan` çağrısı otomatik olarak
   consultation'ı tetikler. Her round'da **tek satır şeffaflık bildirimi** zorunlu kılındı (Flow
   adım 3) ki kullanıcı hiçbir zaman "farkında olmadan" veri göndermiş olmasın. **Kaçış kapısı:**
   `/vibe-plan <feature> --no-consult` — hassas/gizli bir plan için o çağrıda tüm consultation
   döngüsü (round 1 dahil) baştan atlanır, config değiştirmeye gerek kalmaz.
7. **Sağlayıcı tarafında saklama:** DeepSeek'in veri saklama/eğitim politikası bu planın kapsamı
   dışı (üçüncü parti ToS) — kullanıcıya, hassas/gizli proje planları için consultation'ı
   `enabled: false` yaparak kapatabileceği hatırlatılmalı (dokümantasyon notu, `/vibe-go` aşamasında
   `security.md §8`'e eklenecek).
8. **`settings.json` allow-list:** `consult-provider.sh` her çalıştığında Bash izin promptu
   çıkmaması için (`curl https://api.deepseek.com/*` gibi bir pattern) allow-list'e eklenmesi
   önerilir — ama bu bir UX iyileştirmesi, güvenlik gerekliliği değil (curl zaten deny-list'te yok,
   sadece her seferinde onay istenir). Migration Plan'da opsiyonel adım olarak işaretlendi.

---

## Migration Plan (kırmadan aşamalı uygulama)

Tamamı additive; hiçbir mevcut dosya davranışı bozulmuyor. **Bu plan onaylanmadan hiçbir adım
başlamaz** (`architecture.md §1`).

**Faz 0 — Onay + ADR**
- Kullanıcı bu planı onaylar → `docs/decisions.md`'ye ADR eklenir ("Multi-AI plan consultation —
  DeepSeek, opsiyonel, convergence'a kadar bounded çok-tur, config-driven").

**Faz 1 — Config + secret iskeleti (2 dosya + gitignore)**
1. `.vibecode/config/ai-providers.json` oluştur (yukarıdaki şema, `enabled: false` başlangıç
   değeriyle — kullanıcı bilinçli olarak `true` yapmadan hiçbir dış çağrı olmaz).
2. Root `.env.example` oluştur: `# DEEPSEEK_API_KEY=` (yorumlu).
3. Root `.gitignore`'a `.env` ve `.env.local` ekle.

**Faz 2 — Script**
1. `.vibecode/scripts/consult-provider.sh` yaz (bash + curl + jq, config/key/timeout/hata
   kontrolleri, yukarıdaki "Script'in kendi arayüzü" kontratına uygun).
2. Doğrulama: `DEEPSEEK_API_KEY` yokken çalıştır → exit 0 + boş stdout (sessiz atla) doğrula.
   Sahte/geçersiz key ile çalıştır → exit 1 + kısa stderr, key'in stderr'e SIZMADIĞINI doğrula.

**Faz 3 — `/vibe-plan` akış entegrasyonu**
1. `.claude/commands/vibe-plan.md`'ye Step 1.5 eklenir (yukarıdaki akış).
2. Doğrulama: `enabled: false` iken `/vibe-plan` mevcut davranışıyla BİREBİR aynı çalışmalı (regresyon
   yok). `enabled: true` + geçerli key ile bir deneme planında consultation gerçekten tetiklenmeli.

**Faz 4 — Dokümantasyon**
1. `security.md`'ye §8 "Harici AI Danışma (Multi-AI Plan Consultation)" eklenir (bu planın Security
   Considerations bölümünün özeti + kalıcı referans).
2. `docs/CHANGELOG.md` güncellenir.
3. (Opsiyonel, UX) `settings.json`'a `consult-provider.sh` için allow-list satırı.

**Faz 5 — Smoke test**
1. Config disabled → `/vibe-plan test-feature` çalıştır → consultation adımının sessizce
   atlandığını, planın normal üretildiğini doğrula.
2. Config enabled + `--no-consult` → `/vibe-plan test-feature --no-consult` çalıştır → döngü hiç
   başlamadan Step 2'ye geçildiğini doğrula (kaçış kapısı çalışıyor).
3. Config enabled + key yok (unset) → yine sessiz atlama doğrula (env-eksik senaryosu ayrı test
   edilmeli, config-disabled'dan farklı kod yolu).
4. **Çok-tur / convergence senaryosu:** Config enabled + gerçek/test key + `max_rounds: 3` →
   `/vibe-plan test-feature-2` çalıştır → en az 2 round'un gerçekleştiğini (her round'da tek satır
   "Danışma turu N" bildirimi göründüğünü), plan dosyasında `## Appendix: External Review
   (DeepSeek)` altında `Round 1`, `Round 2` alt-başlıklarının biriktiğini, Fable'ın bir round'da
   `CONVERGED` verdict'i verip döngüyü **max_rounds'a varmadan** durdurduğunu doğrula.
5. **`max_rounds` cap testi:** Fable'ın (test amaçlı) her round'da `CONTINUE` döndürdüğü bir senaryo
   kur → döngünün tam `max_rounds` (default 3) turunda durduğunu, cap advisory'sinin
   ("max_rounds (3) doldu...") göründüğünü doğrula — sonsuz döngüye girmediğini kanıtla.
6. **Round-2 appendix-hariç gönderim testi:** Round 1 sonrası plan dosyasında Appendix oluştuğunu,
   Round 2'nin script'e giden gövdesinin bu Appendix'i İÇERMEDİĞİNİ (orkestrasyonun kırpma adımının
   çalıştığını) doğrula — DeepSeek'in kendi önceki metnini geri almadığından emin ol.

---

## Resolved Decisions

Kullanıcı tarafından karara bağlandı (bu revizyonda uygulandı):

1. **Tek-tur DEĞİL — convergence'a kadar bounded çok-tur.** Config'e `max_rounds` (default 3)
   eklendi. Her round: DeepSeek'e danışılır → Fable entegre eder + `CONVERGED`/`CONTINUE` verdict'i
   verir. Döngü `CONVERGED` **veya** `max_rounds`'a ulaşınca durur. **Son söz her zaman Fable'da** —
   DeepSeek sadece danışman, entegrasyon/durdurma kararını asla vermiyor. Döngü mantığı
   `/vibe-plan` orkestrasyonunda; `consult-provider.sh` script'i döngüsüz kalıyor (her round ayrı,
   basit, tek istek/tek cevap çağrısı).

2. **Tetikleme: otomatik + kaçış kapısı.** `enabled: true` = her `/vibe-plan` çağrısında otomatik
   consultation (per-call zorunlu flag YOK). `--no-consult` argümanı, hassas planlar için o tek
   çağrıda tüm döngüyü (round 1 dahil) baştan atlar — config değiştirmeye gerek kalmaz.

3. **Appendix: aynı dosyada, tur-tur log.** Ayrı dosya YOK. Plan dosyasının sonunda
   `## Appendix: External Review (DeepSeek)` altında her round için `Round N` alt-başlığı: DeepSeek'in
   ham eleştirisi + hangi önerilerin alındığı/reddedildiği kısa liste. Tek dosyadan okunabilir,
   INDEX/okuma akışı karmaşıklaşmıyor.

4. **Uzun plan / token: appendix hariç tutularak gönderim + kısmi-başarı ile durma.** Plan olduğu
   gibi gönderilir, ama **round 2'den itibaren `## Appendix` bölümü çıkarılarak** gönderilir —
   DeepSeek'in kendi önceki çıktısını ona geri besleme, feedback-bloat/döngüsel referans önlenir.
   Provider token limitini aşarsa → o round atlanır ve döngü **o ana kadarki entegrasyonları
   koruyarak** sonlanır (kısmi başarı, veri kaybı yok).

5. **Hata logu: sadece oturum-içi, kalıcı iz YOK.** Consultation başarısız/durduğunda tek satırlık
   advisory yeterli — `HANDOFF.md`/`CHANGELOG.md`'ye ayrıca not düşülmüyor. Başarılı consultation
   zaten Appendix'te kalıcı iz bırakıyor; başarısızlık için ayrı bir kalıcı log gereksiz gürültü.

6. **2. provider ileri-uyumluluğu: alan şimdi var, tek değer destekleniyor.** Her provider girişine
   `request_shape` alanı **şimdiden** eklendi (v1'de tek geçerli değer: `"openai-compatible"`).
   Sadece bu kod yolu implemente edildi; `anthropic-native`/`gemini-native` gibi farklı wire-format'lar
   için `case` dalları **yazılmadı**, ama şema onları kırılmadan (mevcut `deepseek` girişini
   bozmadan) eklemeye hazır. YAGNI ihlali değil — sadece alan adı sabitlendi, davranış eklenmedi.
