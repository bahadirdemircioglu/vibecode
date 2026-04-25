# Architecture Plan: Sonnet-First Model Routing

> Original query: "ilk açılışta modelin kontrolü yapılmalı, eğer model sonet değilse 'kesinlikle' sonet ile başlamalısın. sonet tüm süreci yönetmeli, sonrasında opusa sormalı."
> Slug kısaltıldı: `model-routing-sonnet-first-plan.md`

---

## Overview & Goals

**Problem:** Şu anki vibecode delegasyon protokolünde Opus *main context* olarak çalışıyor, Sonnet sadece subagent olarak kod yazıyor. Bu, rutin işlerde (basit edit, dosya okuma, küçük debug) Opus token'ını gereksiz harcıyor. Mevcut memory tercihiniz "default Sonnet, Opus sadece planlama" diyor ama harness bu kuralı *uygulamıyor* — kullanıcı yanlışlıkla Opus'la açılan oturumda fark etmeden Opus burnsa, tüm rutin işler Opus tarifesinde işliyor.

**Hedef:** Modelin kim olduğunu *session start*'ta tespit eden ve gerekirse Sonnet'e geçmeyi öneren bir sistem kurmak. Çalışma akışını ters çevirmek:

| Mevcut akış | Yeni akış |
|-------------|-----------|
| Opus main → Sonnet subagent (kod yazma) | **Sonnet main** → Opus eskalasyon (planlama / çıkmaz) |
| Opus her tool call'da reasoning yapıyor | Sonnet rutin işleri yapıyor, Opus sadece "stuck" durumda |
| Token: ~%80 Opus, %20 Sonnet | Token hedefi: ~%70 Sonnet, %30 Opus |

**Kullanıcı kuralları (bu görüşmede onaylandı):**
1. **Hook prompt** — Session start'ta Opus tespit edilirse: *"Opus'tasın, Sonnet'e geçmek ister misin?"* (auto-switch YOK, sadece sor)
2. **Sonnet eskalasyon (planlama)** — Sonnet kararsız kaldığı her noktada Opus'a danışacak
3. **Sonnet eskalasyon (kodlama)** — Sonnet bir sorunu **2 kere** deneyip çözemezse direkt Opus'a verecek; Opus çözüp Sonnet'e geri döndürecek

---

## Token Etkisi Analizi (Kullanıcının Asıl Sorusu)

> "sence bu token kullanımını azaltır mı arttırır mı?"

**Net beklenti: AZALTIR**, ancak eskalasyon kuralları sıkı tutulursa.

### Niceliksel tahmin

Anthropic fiyatlandırma (yaklaşık, 2026 tarifesi):
- **Opus 4.7**: ~$15/M input, ~$75/M output
- **Sonnet 4.6**: ~$3/M input, ~$15/M output
- Oran: **Opus, Sonnet'in ~5 katı**

Tipik bir vibecode oturumu (~60 dk, ~80K token harcaması) için:

| Senaryo | Sonnet token | Opus token | Yaklaşık maliyet |
|---------|--------------|------------|------------------|
| **Mevcut (Opus main)** | 16K (subagent) | 64K | ~$2.40 |
| **Yeni (Sonnet main + nadir Opus)** | 56K | 24K (planlama + 1-2 eskalasyon) | ~$1.20 |
| **Worst case (her şey Opus'a eskale ederse)** | 56K | 64K | ~$2.55 |

**Sonuç:** İdeal akışta ~%50 tasarruf. Worst case'te %5-10 artış (eskalasyon overhead'i).

### Tasarruf koşulu

Tasarruf, **eskalasyon disiplinine** bağlı:

| Eskalasyon davranışı | Token etkisi |
|----------------------|---------------|
| Sonnet rutin işleri çözer, sadece gerçekten kararsızken Opus'a sorar | ✅ %40-50 azalma |
| Sonnet her tool call'da "emin değilim" deyip Opus'a sorar | ❌ %10-20 artış (her eskalasyon context yeniden yüklemesi) |
| Sonnet 2 deneme → Opus disiplini sıkı uygulanır | ✅ %30-40 azalma |
| Sonnet sürekli aynı hatada takılır, Opus her seferinde kurtarmaya gelir | ❌ Değişmez veya artar |

### Gizli maliyetler

1. **Context handoff** — Sonnet → Opus eskalasyonunda Opus, Sonnet'in context'ini yeniden yüklemeli (~2-5K token overhead her eskalasyonda)
2. **Tekrar iş riski** — Sonnet yanlış yola sapar, Opus düzeltmeye geldiğinde Sonnet'in yaptığı işin yarısını atması gerekir
3. **Plan kalitesi** — Sonnet'in planlaması Opus'unkinden zayıf — Sonnet plan yapıp sonra Opus'a "onayla" derse, plan hatalıysa hem plan tokenları hem revize tokenları çift sayılır

**Mitigation:** Plan/architecture işlerinde **Sonnet plan yapmasın** — `/vibe-plan` komutu zaten Opus'a forced. Bu kural korunmalı.

---

## Directory Structure Changes

Yeni dosya YOK. Mevcut dosyalar güncellenir:

```
Değişecek dosyalar:
├── .claude/hooks/session-start.sh             # Model detection + prompt
├── CLAUDE.md                                   # Core Rules — Sonnet-first kuralı
├── .claude/commands/vibe-go.md                # Model routing reverse
└── .vibecode/standards/architecture.md         # §4 — eskalasyon kuralları
```

---

## Tech Decisions

### Karar 1: Hook ile auto-switch YAPMA, sadece SOR

**Yaklaşım:** SessionStart hook current model'i tespit eder. Opus ise stdout'a soru çıkarır:
```
MODEL: Opus tespit edildi. Sonnet ile başlamak için: /model sonnet
       (Bilinçli olarak Opus istediyseniz görmezden gelin)
```

**Neden auto-switch değil:**
- Hook'un `/model` komutu çalıştırma yetkisi sınırlı (Claude Code hook protokolü)
- Bilinçli Opus oturumu (planlama, derin debug) için friction yaratır
- Kullanıcı kararı: "sorsun" (auto-switch reddedildi)

### Karar 2: Model detection mekanizması

Claude Code SessionStart hook input JSON'ında `model` alanı **garantili değil** (hook protokolü versiyonuna bağlı). İki katmanlı tespit:

```bash
# Birincil: hook input JSON'da varsa oku
MODEL=$(echo "$HOOK_INPUT" | jq -r '.model // empty')

# Yedek: ~/.claude/projects/<encoded>/<session>.jsonl son satırından parse et
if [[ -z "$MODEL" ]]; then
  SESSION_FILE=$(ls -t ~/.claude/projects/-Users-bahdem-Dev-vibecode/*.jsonl 2>/dev/null | head -1)
  [[ -f "$SESSION_FILE" ]] && MODEL=$(tail -1 "$SESSION_FILE" | jq -r '.message.model // empty' 2>/dev/null)
fi
```

**Neden iki katman:** Hook input zayıf garanti verir. Session JSONL'lerin format'ı stable ama Claude Code güncellemelerinde değişebilir. İki katman → resilience.

**Eğer ikisi de başarısız:** Sessizce çık (hook kullanıcıyı bloklamaz).

### Karar 3: Sonnet eskalasyon kuralları (CLAUDE.md'de tanımlı)

Üç eskalasyon tetikleyicisi:

| Tetikleyici | Eylem |
|-------------|-------|
| **Planlama / mimari karar** | Sonnet doğrudan Opus subagent çağırır (`Agent(model:opus)`) |
| **Kararsızlık (kod kararı)** | Sonnet "BELIRSIZ: [soru]" raporlar → main thread (kullanıcı) Opus'a danışır |
| **2x başarısız çözüm** | Sonnet otomatik `Agent(model:opus, prompt: "Bu sorunu çöz: [hata + 2 deneme])` |

### Karar 4: "Geri dönüş" mekanizması

Opus eskalasyon sonrası işin Sonnet'e geri dönmesi:

```
Sonnet stuck → Agent(model:opus, prompt:"diagnose + fix instruction")
            → Opus döner: "Şunu yap: [fix instruction]"
Sonnet uygular (kendi context'inde, fix'i Edit/Write ile)
```

**Neden Opus kodu doğrudan yazmıyor:** Opus subagent ayrı context — ana akış Sonnet'te kalmalı ki token tasarrufu sürsün. Opus *talimat* verir, *kod yazmaz* (bu eskalasyon flow'unda).

**İstisna:** Eğer hata derin reasoning gerektiriyorsa (örn. concurrency bug, complex algorithm), Opus subagent'a kodu yazdır — sonra Sonnet review eder.

### Reddedilen alternatifler

1. **Auto-switch (hook `/model sonnet` çalıştırsın):**
   - ❌ Kullanıcı reddetti
   - ❌ Hook protokolünde bu yetki yok (Claude Code güvenlik kısıtı)

2. **Sonnet hep Opus'a danışsın (her belirsizlikte):**
   - ❌ Token artırır — eskalasyon overhead'i toplamı bozar
   - ✅ Kullanıcı kuralı: "kararsız kaldığı her noktada" — burada "her noktada" = "gerçekten kararsız kaldığında", bilinçli yorum gerekiyor

3. **Hook her oturumda Sonnet zorlasın (Opus'u disable etsin):**
   - ❌ `/vibe-plan` Opus gerektiriyor — disable etmek planlamayı bozar

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
- Hook input JSON parse'ında jq kullanımı zaten mevcut bash hook'ta yok — yeni dependency mi? **Hayır**, mevcut macOS/Linux'ta `jq` yaygın ama garantili değil. Fallback: `grep -o '"model":"[^"]*"'` (regex parse). Hook bu yedeği kullanmalı.
- Session JSONL okuma: dosya world-readable, hassas içerik var (transcript). Hook sadece `model` alanını çıkarıyor — diğer alanlara dokunmuyor.

---

## Implementasyon Detayı: Dosya Değişiklikleri

### 1. `.claude/hooks/session-start.sh` — Model Detection Bloğu

Hook'un başına (mevcut `OUTPUT=""` satırından sonra) eklenecek blok:

```bash
# 0d. Model check — Sonnet-first politikası
# Hook input STDIN'den gelir; current model tespiti için iki katmanlı strateji
MODEL=""

# Birincil: hook input JSON'dan
if [[ -p /dev/stdin ]] || [[ ! -t 0 ]]; then
  HOOK_INPUT=$(cat 2>/dev/null || echo "{}")
  if command -v jq &>/dev/null; then
    MODEL=$(echo "$HOOK_INPUT" | jq -r '.model // empty' 2>/dev/null)
  else
    # jq yoksa basit regex
    MODEL=$(echo "$HOOK_INPUT" | grep -o '"model":"[^"]*"' | head -1 | sed 's/.*"model":"\([^"]*\)".*/\1/')
  fi
fi

# Yedek: en güncel session JSONL'den son assistant mesajının modeli
if [[ -z "$MODEL" ]]; then
  ENCODED_PROJECT="$(echo "$PROJECT_ROOT" | sed 's|/|-|g')"
  SESSION_DIR="$HOME/.claude/projects$ENCODED_PROJECT"
  if [[ -d "$SESSION_DIR" ]]; then
    LATEST_SESSION=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)
    if [[ -f "$LATEST_SESSION" ]] && command -v jq &>/dev/null; then
      MODEL=$(tac "$LATEST_SESSION" 2>/dev/null | head -50 | jq -r 'select(.message.model) | .message.model' 2>/dev/null | head -1)
    fi
  fi
fi

# Sonnet/Opus/Haiku tespiti — exact ID değil, family check
if [[ -n "$MODEL" ]]; then
  case "$MODEL" in
    *opus*)
      OUTPUT+="MODEL: Opus tespit edildi (${MODEL}). Sonnet'e geçmek için: /model sonnet"$'\n'
      OUTPUT+="       Bilinçli olarak Opus istediyseniz (planlama/derin debug) görmezden gelin."$'\n'
      ;;
    *sonnet*)
      # Hedef model — sessiz geç
      ;;
    *haiku*)
      OUTPUT+="MODEL: Haiku tespit edildi. Karmaşık iş için Sonnet öneriliyor: /model sonnet"$'\n'
      ;;
  esac
fi
```

**Önemli notlar:**
- `tac` macOS'ta yok — `tail -r` kullanılmalı. Cross-platform: `awk '{a[NR]=$0} END{for(i=NR;i>0;i--) print a[i]}'`
- `[[ -p /dev/stdin ]]` STDIN'de hook input olup olmadığını test eder
- Hook protokolü hook event verisini stdin'den verir; mevcut session-start.sh stdin'i okumuyor — bu eklemeyle birlikte stdin tüketilir, sonraki bloklarda problem yaratmaz

### 2. `CLAUDE.md` — Core Rules Güncellemesi

**Mevcut Rule 8** (Sonnet subagent mikro-spec) korunur. **Yeni Rule 9** eklenecek:

```markdown
9. **Model routing — Sonnet-first politikası:**
   - Default model: Sonnet. Opus sadece planlama (`/vibe-plan`), mimari karar, derin reasoning için.
   - Session start'ta hook Opus tespit ederse uyarır — kullanıcı `/model sonnet` ile geçer (auto-switch yok).
   - **Sonnet eskalasyon kuralları:**
     - Planlama/mimari karar → Sonnet doğrudan `Agent(model:opus, ...)` çağırır
     - Belirsizlik (kod kararı) → "BELIRSIZ: [soru]" raporlar, kod yazmaz
     - **2 deneme kuralı:** Aynı kod sorununda 2 kez başarısız → otomatik Opus subagent (model:opus) çağrısı
   - Opus eskalasyon dönüşü: Opus *talimat* verir → Sonnet uygular. (İstisna: derin reasoning gerektiren kod doğrudan Opus subagent'ta yazılır.)
```

### 3. `.claude/commands/vibe-go.md` — Model Routing Bölümü Reverse

Mevcut "Model routing: Opus (planning/review) → Sonnet (code writing)" satırı şuna güncellenir:

```markdown
**Model routing — Sonnet-first:**
- Default: **Sonnet** (kod yazma, edit, dosya okuma, basit debug)
- Opus eskalasyonu (Sonnet → Agent(model:opus)):
  1. `/vibe-plan` çağrısı (planlama Opus'ta zorunlu)
  2. Mimari karar gerektiren durumlar
  3. 2 başarısız deneme sonrası kod sorunları
- Opus döner → talimat verir → Sonnet uygular
```

### 4. `.vibecode/standards/architecture.md` — §4 Genişletme

Mevcut **§4 Subagent Delegation Rules** sonuna eklenecek alt-bölüm:

```markdown
### Sonnet-First Eskalasyon Protokolü

Default model **Sonnet** olduğunda eskalasyon kuralları:

| Tetikleyici | Eylem | Notlar |
|-------------|-------|--------|
| Planlama / mimari karar | `Agent(model:opus, subagent_type:Plan, prompt:...)` | `/vibe-plan` zaten zorunlu Opus |
| Kararsızlık (kod kararı) | "BELIRSIZ: [soru]" — kullanıcıya rapor | Sonnet tahmin yapmaz |
| 2x kod başarısızlığı | `Agent(model:opus, prompt: "Diagnose + fix: [error + 2 attempts]")` | Otomatik, kullanıcı onayı gerekmez |
| Derin reasoning gereken kod | `Agent(model:opus)` doğrudan kod yazar | Sonnet review eder |

**Geri dönüş kuralı:** Opus eskalasyon sonrası talimat döndürür → Sonnet uygular. İstisna: derin reasoning kod (concurrency, kompleks algoritma) → Opus doğrudan yazar.

**2 deneme limiti:** Aynı hata 2 kez tekrarlanırsa Sonnet otomatik Opus eskalasyonu yapar — 3. deneme YOK. "Aynı hata" = aynı dosya + aynı stack trace pattern.
```

---

## Migration Plan

1. **`.claude/hooks/session-start.sh`** — Model detection bloğu ekle (en kritik: stdin parse'ında mevcut hook'u bozmamak)
2. **Test:** Hook'u manuel çağır, Opus oturumunda doğru uyarıyor mu kontrol et
3. **`CLAUDE.md`** — Rule 9 ekle
4. **`.claude/commands/vibe-go.md`** — Model routing satırını güncelle
5. **`.vibecode/standards/architecture.md`** — §4 sonuna eskalasyon protokolü tablosu ekle
6. **Doğrulama:**
   - Yeni oturum aç (Opus'la) → hook uyarısı görünmeli
   - `/model sonnet` → tekrar oturum aç → hook sessiz geçmeli
   - Sonnet oturumunda kasten 2x hata yarat → otomatik Opus subagent çağrısı tetiklenmeli (manuel test)

**Toplam değişiklik:** 4 dosya (1 shell + 3 markdown). Yeni kod yok, infrastructure değişikliği.

---

## Open Questions

1. **Hook stdin tüketimi** — Mevcut `session-start.sh` stdin okumuyor. Yeni model-detection bloğu stdin tüketecek. Sonraki bloklarda stdin'e gerek yok ama emin olmak için: hook'un başında `HOOK_INPUT=$(cat)` ile bir kez oku, sonra `$HOOK_INPUT` ile çalış — kabul ediyor musunuz?

2. **2 deneme sayacı** — Sonnet "aynı hata" kararını nasıl verecek? Önerim: hata mesajı + dosya path'i string match. Daha sofistike (semantic similarity) gerekli mi yoksa basit regex match yeterli mi?

3. **Model id format'ı** — `claude-opus-4-7` vs `claude-sonnet-4-6` family check. Hook'ta substring match (`*opus*`, `*sonnet*`) yeterli mi, yoksa daha sıkı regex (`claude-opus-[0-9]+-[0-9]+`) mı? Önerim: substring — yeni model release'lerine resilience.

4. **Haiku durumu** — Haiku da Sonnet'e mi yönlendirilsin? Önerim: evet, çünkü Haiku karmaşık reasoning için yetersiz. Ama bazı kullanıcılar bilinçli Haiku seçebilir (hızlı yanıt). Öneri: Haiku için "hızlı yanıt için OK ama karmaşık iş için sonnet" şeklinde *uyarı* ver, blok etme.

5. **Opus kodu doğrudan yazma istisnası** — "Derin reasoning gereken kod" subjektif. Net kriter gerekli mi (örn. "concurrency içeren kod", "algoritma kompleksitesi O(n²)+", "regex parsing")? Yoksa Sonnet'in yargısına mı bırakalım?
