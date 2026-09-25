# Vibecode Fleet & Hardening — Kullanım Kılavuzu

> **Bu kılavuz kime?** Hiç bilmeyen birine. Aşağıdaki her özelliği "ne işe yarar, neden
> kullanılır, nasıl kullanılır, hangi senaryoda" başlıklarıyla anlatır. WrongStack projesinden
> ilham alıp vibecode (Claude Code) framework'üne eklediğimiz **3 komut (+ HANDOFF `## Goal`), 9 rol, 2 skill ve
> 2 güvenlik hook'unun** tam kullanım rehberidir.
>
> İlgili mimari karar: `docs/architecture/wrongstack-pattern-adoption-plan.md` ve `docs/decisions.md` ADR-006
> (güncellemeler: ADR-008 sözleşme-spec, ADR-009 `/vibe-goal` → HANDOFF `## Goal`, `/vibe-sdd` plan üzerinden).

---

## 0. 30 saniyede özet (cheat sheet)

| Ne istiyorsun? | Komut | Bölüm |
|----------------|-------|-------|
| Bir görevi birden çok uzman alt-agent'a paralel böldürmek | `/vibe-fleet [görev]` | §3 |
| Onaylı plan üzerinden soru-cevap → kabul vakaları → görev listesi ile yürütmek | `/vibe-sdd [özellik]` | §4 |
| Zor bir bug'ı 3 uzmanla (avcı→planlayıcı→eleştirmen) çözmek | `/vibe-collab-debug [bug]` | §5 |
| Çok-oturumlu bir hedefi kilitleyip günlük tutmak | HANDOFF.md `## Goal` | §6 |
| Tehlikeli komutların (rm -rf, force push…) otomatik bloklanması | (otomatik — hook) | §7 |

> Hiçbir şey kurmana gerek yok. Komutlar `/` ile çalışır, hook'lar arka planda otomatik devrede.

---

## 1. Neden bunlar var? (Arka plan)

WrongStack, Claude Code'a alternatif eksiksiz bir terminal AI agent'ı. İncelediğimizde 4 fikrinin
çok güçlü ama bizde eksik olduğunu gördük:

1. **Rol tabanlı çoklu-agent (fleet):** Tek bir agent yerine, her biri tek işte uzman
   ("kâşif", "mühendis", "eleştirmen" gibi) alt-agent'lardan oluşan bir ekip.
2. **Spec-Driven Development:** Koda başlamadan önce soru sorup spec çıkaran disiplinli akış.
3. **İşbirlikçi debugging:** Bir bug'a üç farklı uzman bakışıyla saldırıp, bulguları *çürütmeye*
   çalışan bir eleştirmenle doğrulamak.
4. **Sıkı izin/güvenlik:** Yıkıcı komutları ve SSRF/dosya kaçışlarını agent seviyesinde bloklamak.

vibecode bir *config framework* olduğu için WrongStack'in motorunu (kernel, kendi agent loop'u,
arayüzleri) **kopyalamadık** — onları zaten Claude Code sağlıyor. Sadece bu **davranış desenlerini**
Claude Code'un kendi yapı taşlarıyla (slash command, subagent, hook, settings) hayata geçirdik.

> Provider katmanı (OpenAI/Google/models.dev) **bilinçli olarak alınmadı** — biz sadece Claude
> kullanıyoruz.

---

## 2. Önce kavram: "Fleet" ve "rol" nedir?

**Fleet (filo)** = bir görevi parçalara bölüp her parçayı en uygun **role** veren orkestrasyon.
Her rol, `.claude/agents/` altında bir tanım dosyasıdır ve Claude Code'un **subagent** mekanizmasıyla
ayrı bir bağlamda (kendi penceresinde) çalışır. Ana sohbet sadece **sonucu** alır, ham dosya
dökümünü değil — bağlam temiz kalır.

### 9 rol

| Rol | Faz | Model | Yazabilir mi? | Ne zaman |
|-----|-----|-------|---------------|----------|
| **explorer** | Keşif | sonnet | Hayır (salt-okunur) | "Bul / nerede / nasıl çalışıyor" — kod haritalama |
| **architect** | Planlama | opus | Hayır | "Tasarla / planla / hangi yapı" — derin reasoning |
| **engineer** | İnşa | sonnet | **Evet** | "Uygula / ekle / değiştir" — sözleşme-spec'i (kabul vakaları önce test) koda çevirir |
| **mechanic** | İnşa | haiku | **Evet** | "Rename / taşı / pattern'den boilerplate / doc" — mantık yok |
| **tester** | Doğrulama | sonnet | **Evet** | "Test yaz / reprodüksiyon / suite çalıştır" |
| **reviewer** | İnceleme | opus | Hayır | "Bu diff'i incele / standartlara uygun mu" |
| **bug-hunter** | Debug | sonnet | Hayır | "Bug'ı bul / kök neden" |
| **refactor-planner** | Debug | opus | Hayır | "Düzeltmeyi planla / nasıl refactor" |
| **critic** | Debug/Meta | opus | Hayır | "Bu bulgu gerçek mi / çürüt / doğrula" |

> **Model mantığı (`.vibecode/standards/delegation.md`):** planlama/mimari/eleştiri → **Opus**; kod yazma/test/keşif →
> **Sonnet**; mekanik iş → **Haiku**. Salt-okunur roller asla dosya değiştiremez (güvenlik için araç listesi kısıtlı).

Bu rolleri **doğrudan** da çağırabilirsin (aşağıda §8), ama çoğu zaman onları senin yerine
`/vibe-fleet` ve `/vibe-collab-debug` yönetir.

---

## 3. `/vibe-fleet` — Görevi paralel role böl

### Ne işe yarar
Tek bir görevi alır, mantıklı alt-parçalara böler, her parçayı uygun role **paralel** dağıtır,
sonra hepsini tek bir özetde ("roll-up") toplar. WrongStack'in "Director" deseninin karşılığı.

### Neden kullanmalısın
- Bir iş birden çok bağımsız parçaya ayrılıyorsa (ör. "şu 3 modülü ayrı ayrı incele").
- Ana bağlamı temiz tutmak istiyorsan — her alt-agent kendi penceresinde çalışır, sana sadece sonuç döner.
- Hız: bağımsız parçalar aynı anda çalışır.

### Nasıl kullanılır
```
/vibe-fleet [görev açıklaması]
```

### Senaryo 1 — Çok yönlü keşif
```
/vibe-fleet auth modülünü, ödeme modülünü ve bildirim modülünü ayrı ayrı incele;
her biri için "ne yapıyor + riskli noktalar" çıkar
```
Olan: 3 `explorer` alt-agent'ı paralel başlar, her biri bir modülü okur, sonra şöyle bir roll-up gelir:
```
FLEET ROLL-UP
- explorer · auth modülü · ok · JWT refresh akışı src/auth/jwt.py:42'de; risk: refresh token rotasyonu yok
- explorer · ödeme modülü · ok · Stripe webhook imza doğrulaması eksik (services/pay.py:88)
- explorer · bildirim modülü · ok · e-posta kuyruğu retry'sız (services/notify.py:31)
Decision: en kritik bulgu ödeme webhook imzası — önce onu ele alalım mı?
Open: -
```

### Senaryo 2 — Tasarla + uygula zinciri
```
/vibe-fleet rate-limiting ekle: önce tasarla, sonra uygula, sonra test yaz
```
Olan: `architect` (Opus) tasarımı + sözleşme-spec'leri üretir → `engineer` (Sonnet) kodu yazar →
`tester` testleri ekler. Çakışan dosyalar olduğu için bunlar **sıralı** çalışır.

### Ne beklemelisin (çıktı)
Her zaman bir **FLEET ROLL-UP**: satır başına bir alt-görev (rol · iş · durum · sonuç/`dosya:satır`),
bir "Decision" satırı ve varsa açık sorular.

### YAPMA / sınırlar
- Aynı dosyayı değiştiren işler paralel verilmez (otomatik sıralanır).
- Uçsuz görev verme ("kodu iyileştir") — her alt-görevin net hedefi olmalı.
- Bir alt-görev 2 kez başarısızsa bir Opus subagent düzeltmeyi kendisi yazar (3. Sonnet denemesi yok).

---

## 4. `/vibe-sdd` — Spec-Driven Development

### Ne işe yarar
Büyük bir özelliği **koda başlamadan önce** netleştiren disiplinli akış:
onaylı `/vibe-plan` dosyası → soru sor → gereksinim + kabul vakalarını plana ekle → görevlere böl → onay → uygula.
`/vibe-plan`'ın devamıdır; ayrı spec dosyası yazmaz.

### Neden kullanmalısın
- "Hadi başlayalım" demenin gereksinimleri kaçıracağı, orta-büyük özellikler için.
- Spec'i ve görev listesini **yazılı** ve onaylı hale getirir — sonradan "bunu istememiştim" olmaz.
- Bağımlılık sıralı görev listesi + kritik yol çıkarır; bağımsız görevler `/vibe-fleet` ile paralelleşir.

### Nasıl kullanılır
```
/vibe-sdd [özellik adı]
```

### Senaryo — Yorum sistemi ekleme
```
/vibe-sdd gönderilere yorum yapma özelliği
```
Akış:
1. **Soru fazı:** "Yorumlar iç içe mi olacak? Düzenleme/silme var mı? Moderasyon? Anonim?" gibi
   3-6 soru (`AskUserQuestion` ile).
2. **Gereksinim fazı:** Cevaplardan `docs/architecture/yorum-sistemi-plan.md`'ye `## Requirements` +
   `## Acceptance Cases` ekler. Onayını ister.
3. **Görev fazı:** Plana `### Task N: …` başlıklı, bağımlılık sıralı görevler (her biri ≤3 dosya, rol atanmış, kabul vakaları).
4. **Görev onayı:** Liste + kritik yol gösterilir. "OK" demeden kod yazılmaz.
5. **Uygulama:** Görevler sırayla; bağımsız olanlar `/vibe-fleet` ile. Her görevden sonra `make verify`.
6. **Bitiş:** Tüm kabul kriterleri geçince `/vibe-done`'a devreder.

### `/vibe-plan` ile farkı
- `/vibe-plan` = tek atış **mimari plan** (yapı kararları).
- `/vibe-sdd` = aynı plan dosyası üzerinde **soru-cevap + kabul vakaları + görev kırılımı + yürütme**. Daha operasyonel.

---

## 5. `/vibe-collab-debug` — Üçlü işbirlikçi debugging

### Ne işe yarar
Zor bir bug'a üç rolle saldırır: **BugHunter** (kök nedeni bulur) → **RefactorPlanner** (en küçük
güvenli düzeltmeyi tasarlar) → **Critic** (her ikisini *çürütmeye* çalışır). Sadece Critic'in
onayladığı düzeltmeler uygulanır. WrongStack'in `CollabSession`'ı.

### Neden kullanmalısın
- Bug açık değil, "şuradadır" tahminleri yanlış çıkıyor.
- "Makul ama yanlış" teşhisten korunmak istiyorsun — Critic tam da bunu yakalar.
- Düzeltmeyi uygulamadan önce **doğrulanmış** bir kök neden istiyorsun.

### Nasıl kullanılır
```
/vibe-collab-debug [bug açıklaması ve/veya dosya yolları]
```

### Senaryo — Aralıklı 500 hatası
```
/vibe-collab-debug kullanıcı profili kaydederken bazen 500 dönüyor, src/api/profile.py
```
Akış:
1. **BugHunter:** "Olası kök neden: `profile.py:54`'te async session aynı anda iki istekte
   paylaşılıyor (race). Güven: olası."
2. **RefactorPlanner:** "Düzeltme sözleşme-spec'i (reprodüksiyon vakası dahil): her istek için yeni session aç; `get_db()`
   dependency'sini kullan. Blast radius: 3 endpoint. Test: eşzamanlı 50 istek."
3. **Critic:** "CONFIRMED — `profile.py:54` gerçekten paylaşılan session; ama önerilen fix
   `service.py:20`'deki cache'i de güncellemeli yoksa stale kalır. UNCERTAIN: …"
4. **Sentez:** Birleşik rapor — kök neden, onaylı düzeltmeler, eklenmesi gereken testler.
5. **Uygulama (onaydan sonra):** Onaylı sözleşme-spec'ler `engineer`'a verilir, `tester` reprodüksiyon
   testini yazar, `make verify`.

### Çıktı
```
COLLAB-DEBUG REPORT
Root cause:      profile.py:54 — paylaşılan async session (race)
Confirmed fixes: per-request session (profile.py) + cache invalidation (service.py:20)
Dropped/uncertain: "timeout'tan kaynaklı" hipotezi REFUTED
Tests to add:    eşzamanlı 50 istek reprodüksiyon testi
```

---

## 6. Çok-oturumlu hedef — HANDOFF.md `## Goal` (otonom DEĞİL)

> **Değişiklik (ADR-009):** Eski `/vibe-goal` komutu ve `GOAL.md` kaldırıldı; hedef artık
> `HANDOFF.md`'nin `## Goal` bölümünde yaşar (şablon: `.vibecode/templates/HANDOFF.md`).

### Ne işe yarar
Oturumlar arası yaşayan bir **hedef**, kabul kriterleri ve kısa bir **günlük**. WrongStack'in
goal-engine'inin *sınırlı, insan-denetimli* versiyonu — bilinçli olarak **otonom sonsuz döngü değil**
(pusula + defter, yürütücü değil; ADR-006).

### Nasıl kullanılır
- **Kur:** "Hedef: tüm backend'i async SQLAlchemy'e taşı" de → Claude `## Goal`'a hedef + kabul
  kriterlerini yazar (belirsizse sorar), `Goal status: active`.
- **Oturum başı:** `/vibe-go` aktif hedefi ve kabul kriterlerini gösterir.
- **Oturum sonu:** `/vibe-done` günlüğe tarihli bir satır ekler; kriterler karşılandıysa `completed`
  işaretlemeyi sorar.
- İstersen denetimli tekrar: `/loop` ile süreli/sınırlı sar.

### `## Goal` neye benzer
```markdown
## Goal
- **Goal status:** active
- **Goal:** Tüm backend'i async SQLAlchemy'e taşı
- **Acceptance:**
  - Tüm repository'ler async; `make test` yeşil; sync session importu kalmadı
- **Journal** (newest last, max ~10 lines — trim oldest):
  - 2026-06-04 — users modülü async'e geçti, sırada orders
```

---

## 7. Güvenlik hook'ları — otomatik koruma (kurulum gerektirmez)

İki `PreToolUse` hook'u her araç çağrısından **önce** çalışır. Hiçbir şey yapmana gerek yok; arka
planda otomatik devrede. Yıkıcı bir şey denenirse araç çalışmadan **bloklanır** (exit code 2).

### 7.1 `permission-policy.js` — risk katmanlı izin
- **destructive → sert blok:** `rm -rf`, `git push -f`/`--force`, `git reset --hard`, fork bomb,
  `curl … | bash`, `.env` üzerine yazma, `sudo`, `chmod 777`, `dd if=…`.
- **standard → sadece uyarı:** düz `git push`, `docker compose down -v`, `npm publish`, `DROP TABLE`.

Bloklandığında şuna benzer bir mesaj görürsün:
```
⛔ [permission-policy] BLOCKED — recursive force delete (rm -rf).
   Subject: rm -rf build/
   This action is irreversible. ... or set VIBE_YOLO=1 ...
```

**Kaçış kapısı:** Tek seferlik, izole/atılabilir ortamda gerçekten gerekiyorsa
`VIBE_YOLO=1` ortam değişkeni blokları uyarıya indirir. Üretimde/değerli repoda **kullanma**.

### 7.2 `net-fs-guard.js` — SSRF + dosya kaçışı
`pre-tool-use.js` tarafından modül olarak yüklenir (tek node süreci); tek başına da çalışır.
- **SSRF:** `WebFetch` ile private/loopback hedefler (cloud metadata `169.254.169.254`,
  `localhost`, `*.internal`) ve `http(s)` olmayan şemalar (`file://`…) bloklanır.
  **Kaçış kapısı:** yerel API test ederken `VIBE_ALLOW_PRIVATE_FETCH=1`.
- **Sistem yolu koruması:** `/etc`, `/usr`, `/bin`, `/boot`, `/sys`, `/proc`, `/dev`, `/root/.ssh`
  altına `Write`/`Edit` bloklanır. Proje, `/tmp` ve `~/.claude` yazımları serbest (memory çalışsın).
- **Symlink kaçışı:** workspace dışına çıkan bir symlink üzerinden yazma bloklanır.

### Hook'ları test etme (değiştirirsen)
Hook'lar bağımsız, saf Node. Stdin'e örnek JSON verip exit kodunu kontrol et:
```bash
chmod +x .claude/hooks/permission-policy.js
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"rm -rf x"}}' \
  | ./.claude/hooks/permission-policy.js ; echo "exit=$?"   # -> exit=2 (blok)
```
> Not: bu projede `Bash(node *)` deny'li; hook'u `node x.js` yerine `./x.js` (shebang) ile çalıştır.

Detay: `docs/guides/framework-security.md §1`.

---

## 8. Skill'ler ve rolleri doğrudan kullanma (ileri seviye)

### İki yardımcı skill
- **`agent-dispatch`** — serbest bir görevi 9 rolden birine yönlendiren sezgisel kural seti.
  `/vibe-fleet` bunu otomatik kullanır; sen de "hangi rol?" diye düşünürken yükleyebilirsin.
- **`subagent-budget-protocol`** — alt-agent çağırırken güvenli delegasyon kuralları (net hedef,
  YAPMA listesi, 2-deneme sınırı, roll-up). Fan-out yaparken bunu uygula.

### Bir rolü doğrudan çağırma
Komut kullanmadan tek bir uzman istersen, Agent tool'una `subagent_type` ver:
```
explorer rolünü çağır: "src/payments/ altında Stripe webhook doğrulamasının nerede yapıldığını bul"
```
Claude bunu `Agent(subagent_type="explorer", ...)` olarak çalıştırır; explorer salt-okunur olduğu
için yanlışlıkla bir şey değiştiremez.

---

## 9. Hangi komutu ne zaman? (karar tablosu)

| Durum | Komut |
|-------|-------|
| Yeni, orta-büyük özellik, gereksinimler net değil | `/vibe-sdd` |
| Sadece mimari yapı kararı lazım | `/vibe-plan` |
| Net bir iş ama birden çok bağımsız parça | `/vibe-fleet` |
| Tek, basit iş | normal `/vibe-go` |
| Kafa karıştıran bug | `/vibe-collab-debug` |
| Günler/oturumlar süren bir hedef | HANDOFF.md `## Goal` |
| Bir diff'i kalite/standart için incelet | `reviewer` rolü veya `/code-review` |

---

## 10. SSS / Sorun giderme

**S: Komutu yazdım ama bir şey olmadı.**
C: Slash komutları `/` ile başlamalı ve mesajın başında olmalı. `/vibe-fleet ...` şeklinde.

**S: Meşru bir komut "BLOCKED" oldu.**
C: Hook seni yıkıcı bir desenden korudu. Gerçekten istiyorsan ya komutu elle çalıştır ya da
o oturum için ilgili kaçış kapısını kullan (`VIBE_YOLO=1` / `VIBE_ALLOW_PRIVATE_FETCH=1`).
Hook'u zayıflatma.

**S: Alt-agent'lar ana sohbeti dolduruyor mu?**
C: Hayır. Her rol ayrı bağlamda çalışır; ana sohbete sadece özet (roll-up) döner.

**S: Otonom (kendi kendine sonsuz çalışan) bir mod var mı?**
C: Hayır, bilinçli olarak yok. HANDOFF `## Goal` sınırlı ve insan-denetimli. Tekrar istiyorsan
`/loop` ile süreli/sınırlı sar.

**S: Bu eklentiler Claude Code'un kendi davranışını mı değiştiriyor?**
C: Hayır — sadece config (slash command + subagent tanımı + hook + settings). Çekirdek Claude Code
değişmedi. İstersen dosyaları silerek geri alabilirsin.

---

## 11. Dosya haritası (ne nerede)

```
.claude/agents/*.md            9 rol tanımı (explorer, architect, engineer, mechanic, tester,
                               reviewer, bug-hunter, refactor-planner, critic)
.claude/commands/vibe-fleet.md         /vibe-fleet
.claude/commands/vibe-sdd.md           /vibe-sdd
.claude/commands/vibe-collab-debug.md  /vibe-collab-debug
.vibecode/templates/HANDOFF.md         ## Goal bölümü (eski /vibe-goal)
.claude/hooks/permission-policy.js     risk-tier izin hook'u
.claude/hooks/net-fs-guard.js          SSRF + dosya kaçışı hook'u
.claude/settings.json                  hook kayıtları + genişletilmiş deny listesi
.vibecode/skills/agent-dispatch/       rol yönlendirme skill'i
.vibecode/skills/subagent-budget-protocol/  delegasyon disiplini skill'i
docs/guides/framework-security.md §1   framework güvenlik rehberi
.vibecode/standards/delegation.md      model routing + delegasyon
docs/guides/skill-authoring.md         skill manifest şeması
docs/architecture/wrongstack-pattern-adoption-plan.md  mimari plan
docs/decisions.md ADR-006              karar kaydı
```
