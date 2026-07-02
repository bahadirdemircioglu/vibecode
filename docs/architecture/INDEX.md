# Architecture Plans Index

> Bu index `/vibe-plan` tarafından otomatik okunur. Yeni plan eklendiğinde bu dosyaya **bir satır özet** ekleyin.
> Format: `- [slug](slug-plan.md) — bir cümlelik özet (~80 karakter)`

## Aktif Planlar

- [superpowers-adoption](superpowers-adoption-plan.md) — obra/superpowers'tan SDD scripts + prompt şablonları + progress ledger ekle (kurulum hariç)

- [continuous-doc-maintainer](continuous-doc-maintainer-plan.md) — Auditable+idempotent doc skill: prune, schema-sync, security-lint, audit log.
- [clone-workflow](clone-workflow-plan.md) — Clone tabanlı proje setup; Serena/Context7 restart-free ilk oturumda çalışsın.
- [model-routing-sonnet-first](model-routing-sonnet-first-plan.md) — Default Sonnet, Opus eskalasyon (planlama / 2-fail / belirsizlik); session-start hook Opus uyarısı verir.
- [opus-sonnet-delegation](opus-sonnet-delegation-plan.md) — Üç fazlı protokol: Opus mikro-spec → Sonnet write → Opus review.
- [security-review-skill](security-review-skill-plan.md) — `/vibe-security-review` slash command + OWASP Top 10 skill entegrasyonu.
- [serena-auto-activation](serena-auto-activation-plan.md) — `.mcp.json` `--project-from-cwd` + `.serena/project.yml` otomatik dil tespiti.
- [serena-optimization](serena-optimization-plan.md) — Serena onboarding + symbol-level navigation + permission auto-grant.
- [vibe-prefix-commands](vibe-prefix-commands-plan.md) — Custom slash command namespace çakışması için `vibe-` prefix kuralı.
- [wrongstack-pattern-adoption](wrongstack-pattern-adoption-plan.md) — WrongStack'in permission/fleet/SDD desenlerini Claude-only vibecode'a uyarla (fork değil, provider katmanı hariç).
- [vibe-manager-integration](vibe-manager-integration-plan.md) — buraksu42/vibe-manager skill'inin (tek dosya, 4270 satır) vibecode'a eklenebilirliği + entegrasyon değerlendirmesi.

## Superseded / Arşivlenmiş

(Henüz yok — bir plan eski plan tarafından geçilirse buraya taşıyın ve "superseded by [slug]" notu ekleyin.)

---

## Kullanım Notu

`/vibe-plan` yeni plan yazarken:
1. Bu INDEX'i okur (~300 token)
2. Mevcut planlar arasında ilgili olanları targeted Read eder
3. Yeni planı yazar
4. Bu INDEX'e bir satır ekler

Plan dosyalarını **silmeyin** — git history + ADR amacı taşıyor. Eski/yanlış olanı "Superseded" bölümüne taşıyın.
