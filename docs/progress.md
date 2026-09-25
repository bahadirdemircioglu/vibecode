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
- [ ] `.vibecode/memories/errors/` dizin yapısını oluştur — *uygulanmadı (ADR-001 Proposed)*
- [ ] Hata kaydı YAML şemasını doğrula (örnek dosya)
- [ ] Auto-capture mantığını hook veya `/vibe-done` akışına entegre et
- [ ] Pre-check mantığını `/vibe-go` akışına entegre et

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

## Security Review Skill (ADR-004)
**Added:** 2026-03-27 | **Version:** —
**Status:** 🟢 Complete

### Scope
- `.vibecode/skills/security-review/SKILL.md` — OWASP Top 10 review skill (all languages)
- `.claude/commands/security-review.md` — `/vibe-security-review` slash command
- `/vibe-done` entegrasyonu — otomatik güvenlik taraması (Step 3)

### Dependencies
- Yok (bağımsız)

### Completed Tasks
- [x] Security review skill oluştur (tüm diller, OWASP Top 10)
- [x] `/vibe-security-review` slash command oluştur
- [x] `/vibe-done` akışına otomatik security review entegre et
- [x] CLAUDE.md slash commands tablosunu güncelle
- [x] Architecture plan yaz

---

## Continuous Doc Maintainer (ADR-005, supersedes ADR-003)
**Added:** 2026-04-30 | **Version:** —
**Status:** 🟢 Complete

### Scope
- `.vibecode/skills/continuous-doc-maintainer/SKILL.md` — 13-step v4 pipeline
  (classification → target → prune → schema-sync → security-lint → patch → audit)
- `.claude/commands/vibe-doc-sync.md` — `/vibe-doc-sync [--live] [--tier full] [paths...]`
- `docs/CHANGELOG_INTERNAL.md` — append-only audit ledger
- `.vibecode/state/doc-hashes.json` — idempotency state (gitignored)
- `/vibe-done` Step 4b — auto-shadow run with user confirmation

### Dependencies
- None (independent of ADR-001/ADR-002)

### Completed Tasks
- [x] Skill SKILL.md (13 adım, plain-MD adaptasyonu)
- [x] Input/output JSON schema
- [x] Audit log template + initial CHANGELOG_INTERNAL.md
- [x] /vibe-doc-sync slash command
- [x] documentation.md §6 referansı
- [x] /vibe-done Step 4b entegrasyonu
- [x] CLAUDE.md slash commands tablosu
- [x] .gitignore — state file
- [x] Architecture plan + ADR-005
