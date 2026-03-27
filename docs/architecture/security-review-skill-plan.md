# Architecture Plan: Security Review Skill

## Overview & Goals

Arkadaşınızın önerdiği "Senior Application Security Engineer" prompt'unu, projeye kalıcı bir **skill + slash command** olarak entegre etmek.

**Mevcut durum:** Projede güvenlikle ilgili 3 skill var ama hiçbiri tam olarak bu ihtiyacı karşılamıyor:

| Mevcut Skill | Ne Yapıyor | Eksik Kalan |
|---|---|---|
| `security-auditor` | Genel güvenlik denetimi, compliance, DevSecOps | Çok geniş kapsamlı, kod satırı bazlı review yapmıyor |
| `vulnerability-scanner` | OWASP Top 10 tarama metodolojisi | Sadece ilkeler, pratik kod review yok |
| `backend-security-coder` | Güvenli kod yazma rehberi | Yazma odaklı, mevcut kodu review etmiyor |
| `find-bugs` | Branch diff'i üzerinden bug/güvenlik taraması | Branch diff'e bağımlı, tek dosya review desteklemez, patch kodu sunmuyor |

**Hedef:** Yazılan Python/FastAPI kodunu satır satır OWASP Top 10'a göre tarayan, sorunlu satırları işaret eden ve **düzeltilmiş kodu sunan** yeni bir skill.

## Directory Structure Changes

```
Yeni dosyalar:
├── .vibecode/skills/security-review/
│   └── SKILL.md                          # Ana skill tanımı
├── .claude/commands/
│   └── security-review.md                # /security-review slash command

Değişen dosyalar:
├── docs/CHANGELOG.md                     # Yeni skill kaydı
├── docs/decisions.md                     # ADR-004 eklenir
```

**Toplam:** 2 yeni dosya, 2 güncelleme — mevcut hiçbir dosya bozulmaz.

## Tech Decisions

### 1. Skill mi, Slash Command mi, Hook mu?

**Karar:** Skill + Slash Command (ikisi birlikte)

| Seçenek | Avantaj | Dezavantaj |
|---|---|---|
| **Sadece Skill** | Otomatik yüklenir | Manuel tetikleme yok, Claude'un inisiyatifine bağlı |
| **Sadece Slash Command** | `/security-review` ile kolay tetikleme | Skill orkestratöründen faydalanamaz |
| **Skill + Slash Command** | Hem otomatik hem manuel | 2 dosya bakımı (minimal) |
| **Hook (post-tool-use)** | Her Write sonrası otomatik | Çok gürültülü, her dosya yazımında çalışır, token israfı |

**Neden hook değil:** Her kod yazımında otomatik çalışması aşırı token tüketir. Güvenlik review'u bilinçli bir karar olarak tetiklenmeli.

### 2. Kapsam: Sadece Python mı, genel mi?

**Karar:** Python/FastAPI odaklı, genişletilebilir yapıda

Projenin backend'i FastAPI, frontend'i React+TS. Arkadaşınızın prompt'u Python odaklı. Skill, Python/FastAPI için derinlemesine, diğer diller için temel OWASP kontrollerini kapsayacak.

### 3. Mevcut skill'lerle ilişki

**Karar:** Bağımsız skill, mevcut skill'leri tamamlayıcı

```
Geliştirme akışı:
  1. Kod yaz          → backend-security-coder rehberlik eder
  2. /security-review → YENİ SKILL: yazılan kodu review eder, patch sunar
  3. /done            → find-bugs branch diff'ini tarar (son kontrol)
```

## Database Schema
N/A — Veritabanı değişikliği yok.

## API Contract
N/A — API değişikliği yok.

## Docker Services
N/A — Docker değişikliği yok.

## Port Assignments
N/A — Port atanması yok.

## Security Considerations
- Skill, güvenlik amaçlı olduğu için kendi içinde güvenlik riski oluşturmaz
- Skill içeriğinde örnek zaafiyetli kod bulunacak (eğitim amaçlı) — bu beklenen davranış
- Skill, hassas bilgileri (token, password) loglamamayı kontrol edecek

## Migration Plan

Sıfırdan ekleme — mevcut sisteme müdahale yok.

1. **Adım 1:** `.vibecode/skills/security-review/SKILL.md` oluştur
2. **Adım 2:** `.claude/commands/security-review.md` oluştur
3. **Adım 3:** `docs/decisions.md`'ye ADR-004 ekle
4. **Adım 4:** `docs/CHANGELOG.md`'yi güncelle

## Skill İçeriği (Detaylı Tasarım)

### SKILL.md Yapısı

```markdown
---
name: security-review
description: Senior AppSec Engineer olarak Python/FastAPI kodunu OWASP Top 10'a
  göre review eder. IDOR, SQL Injection, veri sızıntısı kontrolü yapar, sorunlu
  satırları işaret eder ve düzeltilmiş kodu sunar.
metadata:
  model: opus
---
```

**Review kapsamı (OWASP Top 10 odaklı):**

| Kontrol | Açıklama |
|---|---|
| IDOR (A01) | Kullanıcı ID'si ile erişim kontrolü, path parameter doğrulama |
| SQL Injection (A05) | Raw query kullanımı, ORM bypass, string interpolation |
| Veri Sızıntısı (A02/A04) | Response'da hassas alan döndürme, log'da secret yazma |
| Auth Bypass (A07) | Eksik auth dependency, token doğrulama atlanması |
| Mass Assignment | Pydantic model'de fazla alan kabul etme |
| Path Traversal | Dosya yolunda kullanıcı girdisi |
| SSRF | Dışarıya yapılan isteklerde URL doğrulama eksikliği |
| Insecure Deserialization | pickle, eval, exec kullanımı |

**Çıktı formatı:**

```markdown
## 🔍 Security Review: [dosya_adı]

### [CRITICAL/HIGH/MEDIUM/LOW] — [Zafiyet Adı]
**Satır:** [satır numarası]
**Sorun:** [Açıklama]
**Etki:** [Ne olabilir]

Mevcut kod:
[sorunlu kod bloğu]

Düzeltilmiş kod:
[patch edilmiş kod bloğu]

**Neden:** [Düzeltmenin açıklaması]
```

### Slash Command Yapısı

```markdown
/security-review [dosya_yolu veya "last" veya boş]
```

- `dosya_yolu` verilirse → o dosyayı review eder
- `last` verilirse → son yazılan/düzenlenen dosyayı review eder
- Boş bırakılırsa → son commit'teki değişiklikleri review eder

## Open Questions

1. **Scope:** Skill sadece Python/FastAPI mı kapsasın, yoksa frontend (React/TS) için de XSS/injection kontrolleri eklensin mi?

2. **Otomatik tetikleme:** İleride `/done` sırasında otomatik olarak security review çalıştırılsın mı? (Token maliyeti artırır ama güvenliği artırır)

3. **Dil:** Skill içeriği Türkçe mi İngilizce mi olsun? (Mevcut skill'ler İngilizce, ADR'ler Türkçe)
