# Feature & Module Progress Tracker

> Format follows `.vibecode/standards/documentation.md §4`.

---

## Error Memory System (ADR-001)
**Added:** 2026-03-26 | **Version:** v0.1.0
**Status:** 🟡 In Progress

### Scope
- `.vibecode/memories/errors/` dizin yapısı ve YAML şeması
- Auto-capture: `make verify` başarısızlıklarında otomatik kayıt
- Pre-check: task başında ilgili hata kayıtlarının yüklenmesi
- Yaşam döngüsü: 90 gün arşivleme kuralı

### Dependencies
- Yok (bağımsız olarak uygulanabilir)

### Open Tasks
- [ ] `.vibecode/memories/errors/` dizin yapısını oluştur
- [ ] Hata kaydı YAML şemasını doğrula (örnek dosya)
- [ ] Auto-capture mantığını hook veya `/done` akışına entegre et
- [ ] Pre-check mantığını `/go` akışına entegre et

---

## Skill Orchestrator (ADR-002)
**Added:** 2026-03-26 | **Version:** —
**Status:** 🔴 Blocked (ADR-001 tamamlanmasını bekliyor)

### Scope
- `pre-tool-use.js` hook genişletmesi
- Dosya yolu + teknoloji + hata hafızası bazlı skill eşleştirme
- Advisory (bloklayıcı olmayan) öneri formatı

### Dependencies
- ADR-001 (Error Memory) — hata bazlı skill önerileri için

### Open Tasks
- [ ] Eşleşme kuralları matrisini tanımla
- [ ] `pre-tool-use.js`'e öneri mantığı ekle
- [ ] Test: yanlış pozitif oranını ölç

---

## Doc-Sync System (ADR-003)
**Added:** 2026-03-26 | **Version:** —
**Status:** 🔴 Blocked (ADR-001 ve ADR-002 sonrası)

### Scope
- Session-scoped "etkilenen dokümanlar" listesi
- Hook bazlı dosya-doküman eşleştirme
- `/done` entegrasyonu — toplu güncelleme

### Dependencies
- ADR-002 (Skill Orchestrator) — hook altyapısı paylaşımı

### Open Tasks
- [ ] Dosya yolu → doküman eşleşme kurallarını tanımla
- [ ] Tracking state formatını belirle
- [ ] `/done` komutuna entegre et
