# Architecture Plan: Opus-Sonnet Akıllı Delegasyon Sistemi

## Overview & Goals

**Problem:** Claude Code'da Opus model kodlama yaparken subagent olarak Sonnet'e geçiyor. Sonnet'e "bu feature'ı implement et" gibi yüksek seviye talimatlar veriliyor — Sonnet hem mimari kararlar veriyor, hem pattern seçiyor, hem de kodu yazıyor. Bu da kod kalitesinin düşmesine neden oluyor çünkü Sonnet, Opus seviyesinde reasoning yapamıyor.

**Hedef:** Opus'un güçlü yönleri (planlama, analiz, karar verme) ile Sonnet'in güçlü yönlerini (hızlı mekanik kod yazma) birleştiren bir delegasyon sistemi kurmak:

| Aşama | Model | Görev |
|-------|-------|-------|
| **PLAN** | Opus | Kodun nasıl yazılacağını detaylı şekilde belirle |
| **WRITE** | Sonnet | Sadece mekanik yazma işini yap (mikro-spec'e göre) |
| **REVIEW** | Opus | Yazılan kodu incele, sorunları tespit et ve düzelt |

**Temel prensip:** Sonnet'e karar alanı bırakma. Sonnet bir "typist" olmalı, "developer" değil.

---

## Mevcut Durum Analizi

### Şu anki routing (vibe-go.md, satır 54-61):
```
Model routing: Opus (planning/review) → Sonnet (code writing)
```

**Sorunlar:**
1. Sonnet subagent'a verilen prompt'lar çok yüksek seviye: "implement this feature"
2. Sonnet kendi başına mimari kararlar alıyor (hangi pattern, hangi error handling, hangi abstractions)
3. Opus, Sonnet'in çıktısını review etmiyor — yazıp geçiyor
4. Sonnet, skill/standard içeriğini kendi yorumluyor (yanlış uygulama riski)

### Mevcut dosyalar ve değişecekler:
- `CLAUDE.md` — Core Rules'a delegasyon kuralı eklenmeli
- `.claude/commands/vibe-go.md` — Model routing bölümü güncellenmeli
- `.vibecode/standards/architecture.md` — §4 Subagent Delegation genişletilmeli

---

## Çözüm: Üç Fazlı Delegasyon Protokolü

### Faz 1: SPEC (Opus — Main Context)

Opus, kodu yazmadan önce **mikro-spec** üretir. Bu spec, Sonnet'in hiçbir karar almasını gerektirmeyecek kadar detaylıdır.

**Mikro-spec formatı:**
```markdown
## Micro-Spec: [dosya adı]

### Hedef
[Bu dosyada ne yapılacağının kısa açıklaması]

### Dosya Yolu
`backend/src/services/user_service.py`

### Değişiklik Türü
create | modify | delete

### Tam Talimatlar
[MODIFY durumunda:]
- Satır ~45'ten sonra, `get_user` fonksiyonunun altına ekle:
- Fonksiyon adı: `update_user_email`
- Parametre: `user_id: UUID, new_email: str, db: AsyncSession`
- Return type: `UserResponse`
- Logic:
  1. DB'den user'ı çek (get_or_404 pattern — mevcut get_user ile aynı)
  2. Email uniqueness kontrolü (existing_user = await db.execute(...))
  3. Varsa raise HTTPException(409)
  4. user.email = new_email
  5. await db.commit()
  6. return UserResponse.model_validate(user)
- Error handling: Sadece 404 ve 409 — başka exception ekleme
- Import gerekli mi: Hayır, mevcut import'lar yeterli

### Kullanılacak Pattern'ler
[Mevcut codebase'den örnek:]
- `get_user` fonksiyonu (aynı dosya, satır 30) — aynı pattern'i takip et
- Error handling: `backend/src/core/exceptions.py` — mevcut helper'ları kullan

### YAPMA Listesi
- Yeni abstraction ekleme
- Ekstra validation ekleme (Pydantic schema hallediyor)
- Logging ekleme (bu scope'ta değil)
- Docstring ekleme (codebase convention'da yok)
```

**Neden bu kadar detaylı?** Çünkü Sonnet'e bırakılan her karar alanı, potansiyel bir kalite düşüşü noktasıdır. Sonnet'in yapması gereken tek şey: bu spec'i koda çevirmek.

---

### Faz 2: WRITE (Sonnet Subagent)

Sonnet subagent'a gönderilen prompt şablonu:

```
Sen bir kod yazma asistanısın. Sana verilen mikro-spec'i birebir koda çevir.

KURALLAR:
1. Mikro-spec'te yazanı AYNEN uygula — ekleme/çıkarma yapma
2. Pattern referansı varsa, o dosyayı oku ve aynı stili kullan
3. "YAPMA" listesindeki şeyleri YAPMA
4. Karar almanı gerektiren bir durum varsa, KOD YAZMA ve durumu raporla
5. Belirsizlik varsa tahmin etme — "BELIRSIZ: [soru]" olarak raporla

MIKRO-SPEC:
[spec içeriği]
```

**Kritik kural:** Sonnet subagent, mikro-spec'te belirtilmeyen hiçbir değişiklik yapmamalı. Eğer spec yetersizse, kod yazmak yerine eksikliği raporlamalı.

**Subagent spawn parametreleri:**
```
Agent(
  model: "sonnet",
  prompt: [yukarıdaki şablon + mikro-spec],
  description: "Write: [dosya adı] - [kısa açıklama]"
)
```

---

### Faz 3: REVIEW (Opus — Main Context)

Sonnet subagent döndükten sonra, Opus zorunlu olarak:

1. **Yazılan kodu okur** (Read tool ile)
2. **Spec'e uygunluğunu kontrol eder:**
   - Tüm talimatlar uygulandı mı?
   - "YAPMA" listesine uyuldu mu?
   - Gereksiz ekleme var mı?
3. **Kalite kontrolü yapar:**
   - Mevcut codebase pattern'leriyle tutarlı mı?
   - Security açığı var mı?
   - Edge case eksik mi?
4. **Karar verir:**
   - ✅ OK → Bir sonraki mikro-spec'e geç
   - 🔧 Küçük düzeltme → Opus kendi düzeltir (Edit tool ile, Sonnet'e geri göndermez)
   - ❌ Büyük sorun → Yeni mikro-spec yaz, Sonnet'e tekrar gönder

**Neden küçük düzeltmeleri Opus yapıyor?** Sonnet'e geri göndermek ekstra context + latency. 1-5 satırlık fix'ler Opus'un Edit tool ile yapması daha verimli.

---

## Directory Structure Changes

Yeni dosya oluşturma gerekmiyor. Mevcut dosyalarda güncelleme:

```
Değişecek dosyalar:
├── CLAUDE.md                                    # Core Rules'a delegasyon kuralı
├── .claude/commands/vibe-go.md                  # Model routing bölümü güncelleme
└── .vibecode/standards/architecture.md           # §4 genişletme
```

---

## Tech Decisions

| Karar | Yaklaşım | Gerekçe |
|-------|----------|---------|
| Mikro-spec formatı | Markdown inline (plan dosyası değil) | Ayrı dosya overhead'i gereksiz — spec Opus'un context'inde kalır |
| Review mekanizması | Opus main context'te Read → kontrol | Ayrı review agent yok — Opus zaten context'te, ek subagent gereksiz |
| Düzeltme stratejisi | Küçük = Opus Edit, Büyük = yeni Sonnet spec | Token verimliliği — her fix için subagent spawn etme |
| Spec detay seviyesi | Pseudo-code + pattern referans | Satır satır kod yazmak = Opus zaten kodu yazmış olur, anlamsız. Pseudo-code seviyesi Sonnet'e yeterli yönlendirmeyi verir |
| Sonnet belirsizlik kuralı | Belirsizse kod yazma, raporla | Sonnet'in yanlış tahmin yapmasını engeller |

### Alternatifler ve Neden Reddedildi

1. **Opus tüm kodu yazsın, Sonnet'i hiç kullanma:**
   - ❌ Token maliyeti çok yüksek (Opus 5x Sonnet fiyatı)
   - ❌ Opus yavaş — mekanik yazma için gereksiz
   - ❌ Büyük dosyalarda Opus context dolup taşabilir

2. **Sonnet'e daha iyi skill/standard ver, kalitesi yükselir:**
   - ❌ Temel sorun reasoning kapasitesi — daha fazla context vermek çözmez
   - ❌ Skill'leri yanlış yorumlama riski artar

3. **Ayrı bir "review agent" (Opus subagent) spawn et:**
   - ❌ Opus zaten main context'te — ikinci bir Opus subagent gereksiz maliyet
   - ❌ Review context'i main context'te zaten mevcut

---

## Implementasyon Detayı: Dosya Değişiklikleri

### 1. CLAUDE.md — Core Rules Güncellemesi

Mevcut "Core Rules" bölümüne eklenecek kural:

```markdown
8. Sonnet subagent'lara mikro-spec ver — yüksek seviye talimat verme.
   Mikro-spec: dosya yolu + değişiklik türü + pseudo-code + pattern referansı + YAPMA listesi.
   Sonnet döndükten sonra kodu oku ve review et — direkt geçme.
```

### 2. vibe-go.md — Model Routing Bölümü

Mevcut `### 5. Context Rules` bölümünün güncellenmesi:

```markdown
### 5. Context Rules & Model Routing
**Minimize context at all times:**
- Skills/Standards/Files: Lazy load — sadece o anda gerekeni yükle

**Üç Fazlı Delegasyon Protokolü (Opus ↔ Sonnet):**

**Faz 1 — SPEC (Opus):** Her kod değişikliği için mikro-spec yaz:
- Dosya yolu, değişiklik türü (create/modify)
- Pseudo-code seviyesinde logic (satır satır ne yapılacak)
- Mevcut codebase'den pattern referansı (hangi dosya/fonksiyon örnek alınacak)
- YAPMA listesi (gereksiz eklemeler, scope dışı işler)

**Faz 2 — WRITE (Sonnet subagent):** Mikro-spec'i birebir koda çevir:
- Spec'te olmayanı ekleme
- Belirsizlik varsa kod yazma, raporla
- Subagent prompt'una skill/standard içeriğini Opus ekler (Sonnet aramaz)

**Faz 3 — REVIEW (Opus):** Yazılan kodu oku ve kontrol et:
- Spec'e uygunluk, pattern tutarlılığı, security
- Küçük fix → Opus Edit ile düzeltir
- Büyük sorun → yeni mikro-spec ile tekrar Sonnet'e gönder
```

### 3. architecture.md — §4 Genişletme

Mevcut `§4. Subagent Delegation Rules` bölümüne ekleme:

```markdown
### Sonnet Subagent Delegasyon Kuralları

Sonnet subagent'a kod yazdırırken:

1. **Mikro-spec zorunlu** — "implement X" deme, detaylı spec ver
2. **Pattern referansı zorunlu** — mevcut codebase'den örnek göster
3. **YAPMA listesi zorunlu** — scope dışı eklemelerden korunma
4. **Belirsizlik kuralı** — Sonnet belirsiz durumda kod yazmamalı, raporlamalı
5. **Review zorunlu** — Sonnet döndükten sonra kodu oku, spec'e uygunluğu kontrol et
6. **Küçük düzeltme kuralı** — 1-5 satır fix Opus yapar, Sonnet'e geri göndermez
```

---

## Database Schema
N/A — Bu değişiklik altyapı/framework seviyesinde, veritabanı ilgisi yok.

## API Contract
N/A

## Docker Services
N/A

## Port Assignments
N/A

## Security Considerations
- Mikro-spec'lerde hassas bilgi (API key, secret) yazılmamalı
- Sonnet subagent'ın codebase'e erişimi mevcut — ek güvenlik katmanı gerekmez

---

## Migration Plan

1. **`CLAUDE.md`** — Core Rules'a 8. kural ekle
2. **`.vibecode/standards/architecture.md`** — §4'e Sonnet delegasyon kuralları ekle
3. **`.claude/commands/vibe-go.md`** — §5 Context Rules bölümünü güncelle
4. **Test:** Sonraki kodlama task'ında protokolü uygula, etkinliğini değerlendir

**Toplam değişiklik:** 3 dosya, sadece metin/markdown güncellemesi. Kod değişikliği yok.

---

## Open Questions — RESOLVED

1. **Spec detay seviyesi:** 1-2 satır değişiklik → Opus direkt yazsın. 3+ satır → mikro-spec zorunlu. ✅ Onaylandı.

2. **Paralel Sonnet subagent'lar:** Bağımsız dosyalar paralel OK. ✅ Onaylandı.

3. **Review başarısızlık limiti:** Max 2 Sonnet denemesi, sonra Opus devralır. ✅ Onaylandı.
