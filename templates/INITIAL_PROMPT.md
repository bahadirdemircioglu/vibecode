# Proje Başlatma Prompt Şablonu

> Bu dosyayı her yeni projede Claude Code'a vereceğin ilk prompt olarak kullan.
> `[BÜYÜK HARFLE]` yazılı yerleri kendi projenle değiştir.
> Spec dosyalarını proje dizinine koy, prompt'ta yollarını belirt.

---

## Prompt

```
Yeni bir proje başlatacağım. Aşağıdaki adımları sırasıyla takip et:

## 1. Şablonu Oluştur

~/Dev/vibecode/scripts/scaffold.sh [PROJE-ADI] [PROJE-YOLU]

komutunu çalıştırarak proje iskeletini oluştur.

## 2. Spesifikasyonları Oku

Aşağıdaki dokümanları oku ve anla:
- [PROJE-YOLU]/docs/architecture/project-spec.md   ← Proje spesifikasyonu
- [PROJE-YOLU]/docs/architecture/technical-spec.md  ← Teknik spesifikasyon

Bu dokümanlar projenin ne yaptığını, neden yapıldığını, hangi özelliklerin
olacağını ve teknik kararları içeriyor.

## 3. Mimari Plan Yaz

/plan [PROJE-ADI]

Spec dokümanlarını temel alarak mimari planı yaz. Plana şunları dahil et:
- Veritabanı şeması (tablolar, ilişkiler, indeksler)
- API endpoint listesi (method, path, açıklama)
- Frontend sayfa/component haritası
- Docker servisleri ve port atamaları
- Güvenlik gereksinimleri
- Fazlara bölünmüş implementasyon sırası

Planı yazdıktan sonra onayımı bekle. Onay vermeden kod yazma.

## 4. Kısıtlamaları Belirle

docs/constraints/ dizinindeki şablon dosyalarını projeye özel olarak doldur:
- infrastructure.md — hosting, deployment hedefi
- backend.md — özel kütüphane kısıtlamaları
- api.md — API versiyonlama, pagination, auth
- frontend.md — tarayıcı desteği, erişilebilirlik
- auth.md — auth yöntemi, rol modeli
- database.md — şema kuralları, migration stratejisi
- external-services.md — üçüncü parti servisler

## 5. Geliştirmeye Başla

/go [İLK-FAZIN-ADI]

Mimari plandaki fazları sırayla uygula. Her faz için:
- İlgili standardı yükle (backend.md, frontend.md, vb.)
- Önce testleri yaz
- Max 3 dosya/adım kuralına uy
- Her adımda make verify çalıştır

## Kurallar

- Six Absolute Rules'a uy (CLAUDE.md Section 9)
- Kütüphane API'lerini Context7'den doğrula
- Kod aramak için Serena kullan
- Her task sonunda /done çalıştır
- Context 60K'yı geçerse /compact çalıştır
```

---

## Kullanım

1. Proje spec ve teknik spec dokümanlarını hazırla
2. Dosyaları proje dizininde `docs/architecture/` altına koy:
   - `docs/architecture/project-spec.md`
   - `docs/architecture/technical-spec.md`
3. Claude Code'u aç
4. Yukarıdaki prompt'u yapıştır (`[BÜYÜK HARFLER]`'i değiştirerek)
5. Claude sırasıyla: scaffold → spec oku → plan yaz → onay bekle → geliştir

---

## Örnek Kullanım

```
Yeni bir proje başlatacağım. Aşağıdaki adımları sırasıyla takip et:

## 1. Şablonu Oluştur

~/Dev/vibecode/scripts/scaffold.sh beegfs ~/Dev/beegfs

komutunu çalıştırarak proje iskeletini oluştur.

## 2. Spesifikasyonları Oku

Aşağıdaki dokümanları oku ve anla:
- ~/Dev/beegfs/docs/architecture/project-spec.md
- ~/Dev/beegfs/docs/architecture/technical-spec.md

Bu dokümanlar projenin ne yaptığını, neden yapıldığını, hangi özelliklerin
olacağını ve teknik kararları içeriyor.

## 3. Mimari Plan Yaz

/plan beegfs

Spec dokümanlarını temel alarak mimari planı yaz. Plana şunları dahil et:
- Veritabanı şeması (tablolar, ilişkiler, indeksler)
- API endpoint listesi (method, path, açıklama)
- Frontend sayfa/component haritası
- Docker servisleri ve port atamaları
- Güvenlik gereksinimleri
- Fazlara bölünmüş implementasyon sırası

Planı yazdıktan sonra onayımı bekle. Onay vermeden kod yazma.

## 4. Kısıtlamaları Belirle

docs/constraints/ dizinindeki şablon dosyalarını projeye özel olarak doldur.

## 5. Geliştirmeye Başla

/go backend-models-ve-auth

Mimari plandaki fazları sırayla uygula. Her faz için:
- İlgili standardı yükle
- Önce testleri yaz
- Max 3 dosya/adım kuralına uy
- Her adımda make verify çalıştır

## Kurallar

- Six Absolute Rules'a uy (CLAUDE.md Section 9)
- Kütüphane API'lerini Context7'den doğrula
- Kod aramak için Serena kullan
- Her task sonunda /done çalıştır
- Context 60K'yı geçerse /compact çalıştır
```
