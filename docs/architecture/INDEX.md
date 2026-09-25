# Architecture Plans Index

> Bu index `/vibe-plan` tarafından otomatik okunur. Yeni plan eklendiğinde bu dosyaya **bir satır özet** ekleyin.
> Format: `- [slug](slug-plan.md) — bir cümlelik özet (~80 karakter)`

## Aktif Planlar

- [superpowers-adoption](superpowers-adoption-plan.md) — obra/superpowers'tan SDD scripts + prompt şablonları + progress ledger ekle (kurulum hariç)
- [continuous-doc-maintainer](continuous-doc-maintainer-plan.md) — Auditable+idempotent doc skill: prune, schema-sync, security-lint, audit log.
- [security-review-skill](security-review-skill-plan.md) — `/vibe-security-review` slash command + OWASP Top 10 skill entegrasyonu.
- [serena-auto-activation](serena-auto-activation-plan.md) — `.mcp.json` `--project-from-cwd` + `.serena/project.yml` otomatik dil tespiti.
- [serena-optimization](serena-optimization-plan.md) — Serena onboarding + symbol-level navigation + permission auto-grant.

## Uygulandı

- [clone-workflow](clone-workflow-plan.md) — Clone tabanlı proje setup; Serena/Context7 restart-free ilk oturumda çalışsın. (CLAUDE.md "New Project Setup" + session-start `git init`)
- [vibe-prefix-commands](vibe-prefix-commands-plan.md) — Custom slash command namespace çakışması için `vibe-` prefix kuralı. (tüm `.claude/commands/vibe-*.md`)
- [wrongstack-pattern-adoption](wrongstack-pattern-adoption-plan.md) — WrongStack'in permission/fleet/SDD desenlerini Claude-only vibecode'a uyarla. (Implementation Status: DONE 2026-06-04; `/vibe-goal` sonradan HANDOFF `## Goal`'a katlandı — ADR-009)

## Superseded / Arşivlenmiş

- [multi-ai-plan-consultation](multi-ai-plan-consultation-plan.md) — tek turluk DeepSeek danışması + provider/apikey config. **superseded by** madde bazlı DeepSeek tartışması (`.vibecode/scripts/deepseek-debate.js`, ADR-010); provider config ve anahtar çözümü aynen kaldı
- [model-routing-sonnet-first](model-routing-sonnet-first-plan.md) — Default Sonnet, Opus eskalasyon. **superseded by** `.vibecode/standards/delegation.md` (ADR-008, ADR-009)
- [opus-sonnet-delegation](opus-sonnet-delegation-plan.md) — Opus mikro-spec → Sonnet write → Opus review. **superseded by** `.vibecode/standards/delegation.md` (sözleşme-spec, ADR-008)
- [vibe-manager-integration](vibe-manager-integration-plan.md) — vibe-manager skill + `/vibe-init` wrapper (hiç uygulanmadı). **superseded by** `/vibe-plan` → `/vibe-sdd` akışı (ADR-009)

---

## Kullanım Notu

`/vibe-plan` yeni plan yazarken:
1. Bu INDEX'i okur (~300 token)
2. Mevcut planlar arasında ilgili olanları targeted Read eder
3. Yeni planı yazar
4. Bu INDEX'e bir satır ekler

Plan dosyalarını **silmeyin** — git history + ADR amacı taşıyor. Eski/yanlış olanı "Superseded" bölümüne taşıyın.
