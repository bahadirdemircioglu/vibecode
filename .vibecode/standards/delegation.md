# Model Routing & Delegation Standard

> **When to read:** Before delegating work to a subagent, choosing a model, or escalating a
> failing task. **Tek otorite:** Model routing, Sonnet/Opus/Haiku delegasyonu, sözleşme-spec
> formatı ve 2 deneme kuralı SADECE burada tanımlanır — CLAUDE.md, komutlar, ajanlar ve skill'ler
> buraya işaret eder, kopyalamaz. (ADR-008, ADR-009)

---

## 1. Model Routing

| Model | Ne için |
|-------|---------|
| **Sonnet** (default) | Kod yazma, edit, dosya okuma, basit debug, orkestrasyon |
| **Opus** | Planlama (`/vibe-plan`, `/vibe-sdd` faz 1-4), mimari/pattern kararı, derin reasoning kodu (concurrency, kompleks algoritma, kriptografi), 2. başarısız denemeden sonraki fix, review |
| **Haiku** (`mechanic`) | Mekanik iş: rename, mevcut pattern'den boilerplate, kod taşıma, doc/CHANGELOG — mantık yok |

- **Planlama = Opus.** `/vibe-plan` plan yazımını `Agent(subagent_type: "general-purpose", model: "opus")`
  ile dispatch eder (Write gerekir; `architect` read-only olduğu için yalnızca plan *metni* döndüren
  `/vibe-fleet` işlerinde kullanılır). Plan üretimi Sonnet'e delege EDİLMEZ.
- Session-start hook'u Opus main context tespit ederse uyarır; kullanıcı `/model sonnet` ile geçer (auto-switch YOK).
- Rol → model eşlemesi (9 rol): `.vibecode/skills/agent-dispatch/SKILL.md`.

---

## 2. Ne Zaman Subagent

- **5+ dosya etkileyen iş:** önce subagent ile etki alanını araştır → etkilenen dosya/bağımlılık
  özeti → adım planı (adım başına max 3 dosya) → sıralı uygula, her adımı doğrula.
- **Çok servisli debug** (backend + frontend + DB): araştırmayı subagent'a ver, ana context karar
  için temiz kalsın, bulguları aksiyondan önce yaz.
- **Paralel:** bağımsız dosyalar için birden fazla subagent paralel; dosyalar arası bağımlılık varsa sıralı.

---

## 3. Sözleşme-Spec Delegasyon Protokolü (üç faz)

**İlke: Üst model "ne"yi ve "bitti"yi tanımlar, "nasıl"ı uygulayıcı (Sonnet) yazar.** Pseudo-code
yazan üst model kodu iki kez ödetir — önce pahalı çıktı token'ıyla tarif eder, sonra Sonnet aynısını
yeniden yazar. Sözleşme + kabul vakaları hem daha ucuz hem daha kesindir (makine doğrular).

### Faz 1 — SPEC

Her kod değişikliği için sözleşme-spec:
- **Dosya yolu** ve değişiklik türü (create / modify)
- **Sözleşme** — fonksiyon/endpoint imzaları, tipler, veri şekli, hata davranışı (hangi durumda hangi hata / HTTP kodu)
- **Kabul vakaları** — tablo: `girdi / durum → beklenen sonuç`; happy path + uç durumlar + hata yolları
  (bug fix'te reprodüksiyon vakası dahil). "Bitti" tanımı budur
- **Pattern referansı** — mevcut codebase'den örnek dosya/fonksiyon
- **YAPMA listesi** — scope dışı eklemeler, gereksiz abstraction'lar
- **Pseudo-code YAZMA** — istisna: derin reasoning kodu → Opus doğrudan yazar
- **1-2 satır değişiklik** → spec atla, direkt Edit
- **Mekanik iş** → spec yerine kısa talimat, `mechanic` (Haiku)

| # | Girdi / durum | Beklenen |
|---|---------------|----------|
| 1 | Geçerli e-posta + şifre | 200, `{access_token}` |
| 2 | Yanlış şifre | 401, `invalid_credentials` — hangi alanın yanlış olduğu sızdırılmaz |
| 3 | 5. başarısız deneme / 15 dk | 429 |

### Faz 2 — WRITE (Sonnet subagent)

Prompt şablonu (SDD görevlerinde `.vibecode/prompts/sdd-implementer.md` kullanılır):
```
Sen bir kod yazma asistanısın. Verilen sözleşme-spec'i uygula.
KURALLAR:
1. Önce kabul vakalarını test olarak yaz, sonra kodu yaz; tüm testler geçene kadar düzelt
2. Kabul vakalarını değiştirme veya zayıflatma — yanlış görünüyorsa "BELIRSIZ: [vaka # + neden]"
3. Sözleşmedeki imza/tip/hata davranışına birebir uy — ekleme yapma
4. Pattern referansı varsa o dosyayı oku ve aynı stili kullan
5. YAPMA listesindeki şeyleri YAPMA
6. Belirsizlik varsa kod yazma — "BELIRSIZ: [soru]" olarak raporla
7. Test komutunun gerçek çıktı özetini raporla — çalıştırmadan "geçti" deme

SPEC:
[spec içeriği]
```
Skill/standard içeriğini delege eden prompt'a ekler — Sonnet aramaz.

### Faz 3 — REVIEW

1. **Test çıktısı** — tüm kabul vakaları geçiyor mu? Ana kapı budur; geçmiyorsa kodu okumadan geri gönder
2. **Vaka sadakati** — testler kabul vakalarıyla birebir mi (atlanmış / zayıflatılmış vaka yok)?
3. **Diff'i oku** (tüm dosyayı değil) — sözleşme + YAPMA listesi, pattern tutarlılığı, security
4. Karar: ✅ OK → sonraki spec · 🔧 küçük fix (1-5 satır) → reviewer kendisi düzeltir ·
   ❌ büyük sorun → spec'i/vakaları netleştir, Sonnet'e tekrar gönder (§4 sınırı geçerli)

---

## 4. 2 Deneme Kuralı ve Eskalasyon

**Kural:** Aynı kod sorununda **2. başarısız Sonnet denemesinden sonra bir Opus subagent fix'i
kendisi yazar; 3. Sonnet denemesi YOK.** Otomatiktir, kullanıcı onayı gerekmez:
`Agent(model: "opus", prompt: "Diagnose + fix: [hata + 2 denemenin özeti]")`.

**"Aynı sorun":** aynı dosya path'i + aynı/benzer hata mesajı (substring match); test başarısızlığında
aynı test adı + aynı assertion. Kararsızsan eskale et (az eskalasyon, fazladan ucuzdur).

| Tetikleyici | Eylem |
|-------------|-------|
| Planlama / mimari karar | Opus (`/vibe-plan` veya `Agent(model: "opus")`) |
| Kararsızlık (kod kararı) | `BELIRSIZ: [soru]` — kullanıcıya/çağırana rapor, tahmin yok |
| 2x kod başarısızlığı | Opus subagent fix'i yazar (yukarıdaki kural) |
| Derin reasoning kodu | Opus subagent doğrudan yazar; Sonnet review eder |

**`BELIRSIZ:` vs `BLOCKER`:** `BELIRSIZ: [soru]` = belirsizlik/soru, cevapla devam edilir.
`BLOCKER` yalnızca subagent rapor `STATUS` değeridir (ilerlenemiyor: scope aşımı, 2 deneme doldu, ortam hatası).

---

## 5. Anti-pattern'ler

- ❌ Her belirsizlikte Opus'a sormak (eskalasyon overhead'i tasarrufu bozar)
- ❌ 3. denemeyi Sonnet'le yapmak
- ❌ Sonnet'le plan üretmek (plan = Opus)
- ❌ Spec'e pseudo-code yazmak (derin reasoning istisnası hariç)
- ❌ `mechanic`'e mantık kararı gerektiren iş vermek — gerekirse `engineer`'a yeniden yönlendir
