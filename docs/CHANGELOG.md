# Changelog

> Format follows `.vibecode/standards/documentation.md §2`.
> Updated after EVERY change — no exceptions.

---

## [2026-09-25] — vibeplan akışı taşındı: keşif + Understanding Lock, madde bazlı DeepSeek tartışması (ADR-010)

### Changes
- **What:** `/vibe-plan` artık fikirden başlar: Step 0.7 keşif soruları + Understanding Lock (düzelt / onayla /
  "sadece fikir olarak kaydet" → `Status: concept`). Opus planlayıcı planı yazdıktan sonra Step 1e'de DeepSeek
  ile madde bazlı tartışır (en fazla 4 tur, yakınsama sınırları, çözülmeyenler Open Questions'a). Yeni
  `.vibecode/scripts/deepseek-debate.js` + `tests/` (15 test, mock sunucu); `consult-provider.sh` kaldırıldı.
  Plan şablonuna Status / Revision / Non-Goals / Assumptions / Decision Log. Config: `enabled: true`,
  `max_rounds: 4`. Hook komutları `$CLAUDE_PROJECT_DIR` ile mutlak yol. Fresh-clone tartışma kayıtlarını da temizler.
- **Why:** Kullanıcı, vibeplan'da bu oturumda geliştirilen her şeyin vibecode'da da olmasını istedi.
- **Source:** Kullanıcı isteği; vibeplan ADR-002 / ADR-004 karşılığı.

## [2026-09-25] — Denetim temizliği (ADR-009)

### Changes
- **What:** Repo çapında denetim sonrası temizlik.
  - **Güvenlik:** `session-start.sh` artık git'siz projelerde dosya silip `git add -A` ile commit atmıyor (yalnızca `.vibecode/templates/fresh-clone.marker` koşulunda, açık yol listesiyle); oturum başında `curl|sh` / `sudo` / `npm -g` otomatik kurulumları kaldırıldı (MISSING satırı basılır); `.gitignore` + şablonu `.env*`, `backups/` dışlıyor; `permission-policy.js` yalnızca Bash'te, `rm -r -f` varyantlarını yakalıyor; `consult-provider.sh` API anahtarını argv yerine stdin'den veriyor.
  - **Bozuk araçlar:** `scaffold.sh` silindi (her çalıştırmada kırılıyordu); `task-brief` "Task 1" isteğinde Task 10'u almıyor; `sdd-workspace` özellik başına `progress-<feature>.md`; `vibe-update` config'i belirsiz yol sayıyor; compose şablonu çalışan healthcheck'ler, 127.0.0.1 port bağlama, postgres portu yalnızca override'da; Makefile'a `typecheck`.
  - **Kural çelişkileri:** Planlama modeli her yerde **Opus** (`/vibe-plan` → `general-purpose` + `model: opus`); model yönlendirme + delegasyon + 2 deneme kuralı tek kaynakta: `.vibecode/standards/delegation.md`; `BELIRSIZ` / `BLOCKER` ayrımı; HANDOFF tek şablon; `/vibe-goal` → HANDOFF `## Goal`; `/vibe-sdd` onaylı `/vibe-plan` dosyasından başlar.
  - **Maliyet:** `/vibe-done` güvenlik incelemesi `reviewer` subagent'ında, doc-sync `--full` ile; DeepSeek danışması 1 tur, 300 sn, ortak anahtar dosyası `~/.config/vibe/providers.env`; Write/Edit başına 3 → 1 node süreci, tekrar eden 525 B → 0 B; `docker.md`, `security.md` §7-8, `documentation.md` §7, `architecture.md` §4 ayrıştırıldı/kısaldı; yeni projeler framework geçmişini (ADR'ler, CHANGELOG) devralmıyor.
  - **Skill'ler:** stack dışı / kopya 6 skill silindi, 7 TDD skill'i `tdd-workflows-tdd-cycle`'da birleşti (~67 KB).
- **Why:** Denetimde gerçek hatalar (veri kaybı / sır sızıntısı riski, hiç çalışmayan script'ler), birbirini tutmayan kurallar ve her oturum/komutta gereksiz token tüketimi bulundu.
- **Source:** Kullanıcı isteği ("mantıksız, kural hatası ya da pahalı olan yerleri çıkar"); kararlar: Opus planlama, hafif komut birleştirme, iki DeepSeek motoru ortak anahtarla.

## [2026-09-25] — Sözleşme-spec + kabul vakaları; Haiku `mechanic` rolü

### Changes
- **What:** Sonnet'e verilen mikro-spec'ten **pseudo-code kaldırıldı**; yerine sözleşme (imza / tip /
  hata davranışı) + **kabul vakaları tablosu** geldi. Sonnet vakaları önce test yazar, testler geçene
  kadar kodlar; review'da ana kapı test çıktısı. Yeni **`mechanic`** rolü (Haiku) mekanik işler için.
- **Why:** Pseudo-code yazan Opus kodu iki kez ödetiyordu (tarif + Sonnet'in yeniden yazması);
  tasarruf kodlama döngüsünü ucuz modele devretmekten gelir ve "bitti" makine-doğrulanır olmalı.
- **How:** `.vibecode/standards/architecture.md` delegasyon protokolü, `CLAUDE.md` #9, `engineer` /
  `architect` / `refactor-planner` ajanları, `agent-dispatch` (9 rol), `/vibe-fleet`, `/vibe-sdd`,
  `.vibecode/prompts/sdd-implementer.md`; yeni `.claude/agents/mechanic.md`. ADR-008.
- **Also:** `.gitignore`'a macOS AppleDouble (`._*`) eklendi — `.git/objects/pack/._pack-*.idx`
  dosyaları git'i bozuyordu ("index file ... is too small"); 2191 adet temizlendi.
- **Source:** Kullanıcı isteği (vibeplan oturumunda tartışıldı).

## [2026-07-25] — /vibe-plan: multi-AI consultation round (DeepSeek)

### Changes
- **What:** `/vibe-plan`'e opsiyonel bir **harici AI danışma turu (Step 1.5)** eklendi. Fable taslak
  planı yazdıktan sonra, yapılandırılmışsa plan bir sağlayıcıya (v1: **DeepSeek**) eleştiri için
  gönderilir; makul öneriler entegre edilir; DeepSeek yeni esaslı itiraz üretmeyene (`CONVERGED`)
  **veya** `max_rounds`'a (default 3) ulaşana kadar **bounded convergence loop** olarak tekrarlanır.
  Son söz her zaman Fable'dadır (DeepSeek yalnızca danışman).
  (1) `.vibecode/config/ai-providers.json` — non-secret provider registry (`active_provider`,
  `max_rounds`, provider başına `enabled`/`request_shape`/`base_url`/`model`/`api_key_env`/`timeout`/
  `max_tokens`). Ships `enabled: false` → varsayılan davranış BİREBİR eskisi gibi (sıfır dış çağrı).
  (2) `.vibecode/scripts/consult-provider.sh` — bash+curl+jq, tek istek/tek cevap; skip/error
  sözleşmesi (exit 0+boş=sessiz atla, exit 1+stderr=advisory atla); `--exclude-appendix` ile round 2+
  Appendix kırpma; API key'i env var → `$VIBECODE_ENV_FILE` → `.vibecode/providers.env` →
  `~/.config/vibecode/providers.env` sırasıyla tek-satır çıkararak okur (source/eval yok, key asla
  yazdırılmaz). **Projenin kendi `.env`'i asla okunmaz** — vibecode başka projenin içinde katman
  olduğundan kök `.env` o uygulamanındır (kullanıcı geri bildirimi).
  (3) `.vibecode/providers.env.example` (yeni) + `.gitignore`'a `.vibecode/providers.env` eklendi —
  framework secret'ı projenin env'inden ayrı; makine-geneli `~/.config/vibecode/providers.env` önerilir.
  (4) `.claude/commands/vibe-plan.md` — Step 1.5 convergence loop + `--no-consult` kaçış kapısı.
  (5) `.vibecode/standards/security.md` §8 — harici AI danışma secret hijyeni + fail-open gerekçesi.
  (6) `.claude/settings.json` — `consult-provider.sh` + DeepSeek curl allow-list satırları.
- **Why:** Plan kalitesini ikinci bir modelin bakış açısıyla artırmak; genişletilebilir ama minimal
  bir provider/apikey config katmanı kurmak (WrongStack'in provider soyutlamasının kasıtlı olarak
  hariç bıraktığı katman — ADR-006 — şimdi minimal, config-driven biçimde açıldı). Detay: ADR-007.
- **How:** Döngü mantığı tamamen `/vibe-plan` orkestrasyonunda; script çok-tur bilmez ve fail-open
  (opsiyonel kalite adımı, güvenlik kapısı değil — §7 hook'larının fail-closed felsefesinden bilinçli
  sapma). Design refinement: plan "kullanıcı `.env`'i manuel source etsin" diyordu; implementasyonda
  `db-backup.sh` deseniyle tutarlı, güvenli tek-key okuma yapıldı (deny-list'in amacı korunur — key
  Claude context'ine hiç girmez).
- **Verify:** Skip/error yolları (config yok / disabled / key yok / eksik arg / eksik dosya) + Appendix
  kırpma + payload jq inşası + lokal mock sunucuya karşı HTTP+parse başarı yolu test edildi.
- **Source:** Kullanıcı özelliği (Fable ile planlandı, Opus ile uygulandı).

### Affected Files
- `.vibecode/config/ai-providers.json` — provider registry (created)
- `.vibecode/scripts/consult-provider.sh` — consultation script (created)
- `.vibecode/providers.env.example` — framework secret template (created; projenin `.env`'inden ayrı)
- `.gitignore` — `.vibecode/providers.env` eklendi (modified)
- `.claude/commands/vibe-plan.md` — Step 1.5 + header notu (modified)
- `.vibecode/standards/security.md` — §8 (modified)
- `.claude/settings.json` — allow-list (modified)
- `docs/architecture/multi-ai-plan-consultation-plan.md` — mimari plan (created)
- `docs/architecture/INDEX.md` — plan referansı (modified)
- `docs/decisions.md` — ADR-007 (modified)
- `README.md` — özellik kullanım bölümü + problem tablosu + dizin ağacı (modified)

### Notes
- Varsayılan `enabled: false` — hiçbir plan bilinçli opt-in (config + key) olmadan dışarı gönderilmez.
- Kaçış kapısı: `/vibe-plan <feature> --no-consult` → o çağrıda danışmayı atlar.
- Yanıt ayrıştırma sağlamlaştırması: `content` boşsa `reasoning_content`/`text` alanlarına düşer
  (reasoner modelleri); parse başarısızsa advisory'de gövdenin ilk 300 karakteri gösterilir;
  `CONSULT_DEBUG=1` ham yanıtı stderr'e döker. HTTP 200 içinde gelen `error` objesi de yakalanır.
- **Model/quota düzeltmesi (canlı DeepSeek testi):** shipped default model `deepseek-chat` artık
  geçersiz → `deepseek-v4-pro` yapıldı (geçerli: `deepseek-v4-pro`|`deepseek-v4-flash`). v4-* reasoning
  modelleri token'ı önce reasoning'e harcadığından `max_tokens: 2048` yetmiyor (`content` boş,
  `finish_reason=length`) → default `max_tokens: 8192`, `timeout_seconds: 120`. Script artık
  `finish_reason=length` durumunda "max_tokens'ı artır" şeklinde net advisory verir. Gerçek 30KB'lik
  planla uçtan uca doğrulandı (JSON escaping `jq --arg` ile güvenli).

## [2026-07-02] — /vibe-update: upstream framework sync command

### Changes
- **What:** Türetilmiş projelerin, geliştikçe değişen vibecode framework dosyalarını
  (standards/skills/hooks/commands/CLAUDE.md) upstream'den güvenle güncelleyebilmesi
  için `/vibe-update` komutu eklendi.
  (1) `.vibecode/scripts/vibe-update` — GitHub tarball'ı çeker (`codeload.github.com`,
  `VIBECODE_UPSTREAM_DIR` ile lokal klon/offline modu), her framework dosyasını
  **hash-tabanlı 3-yön** (base/current/upstream) sınıflandırır: UPDATE/ADD auto-apply,
  CONFLICT sor, USERONLY/USERADD/DELETED dokunma. Self-guard (vibecode'un kendisinde no-op,
  exit 3) + dirty-tree guard (exit 4).
  (2) `.claude/commands/vibe-update.md` — scan → rapor → clean apply → çakışmalarda diff+onay
  → manifest yenile → CHANGELOG + commit önerisi.
  (3) `.vibecode/VERSION` — türeme anındaki baseline hash manifesti; `session-start.sh`
  fresh-clone'da yazar (ilk commit'e dahil), kullanıcı özelleştirmelerini tespit için.
- **Why:** vibecode'daki iyileştirmeler (ör. hook düzeltmeleri) türetilmiş projelere
  ulaşmıyordu; projeler eski framework sürümünde takılı kalıyordu.
- **Verify:** 13 senaryoluk offline entegrasyon testi (tüm bucket'lar + apply-clean +
  apply-one + dirty-guard + manifest) — hepsi geçti.
- **Source:** Dahili özellik.

## [2026-07-02] — Framework review fixes: hook schema + hardening

### Changes
- **What:** Proje geneli gözden geçirme bulgularının düzeltmesi.
  (1) **Hook çıktı şeması** — `pre-tool-use.js` ve `permission-policy.js` advisory çıktıları
  geçersiz `{decision:"approve", message}` yerine doğru `hookSpecificOutput.additionalContext`
  şemasına taşındı (eski şemada mesajlar Claude'a hiç ulaşmıyordu). Destructive hard-block
  exit-2 + stderr olarak korundu.
  (2) **notification.js** — `Notification` (seyrek olay) yerine `UserPromptSubmit` (tur başına)
  event'ine taşındı; state dosyası artık `session_id` ile anahtarlı (`os.tmpdir()`), böylece
  eşzamanlı projeler birbirinin sayacını ezmiyor.
  (3) **pre-tool-use.js** — ölü `filePath.includes('import')` koşulu kaldırıldı; frontend
  kuralı `.claude/hooks/` (Claude lifecycle hook'ları) için false-positive vermeyecek şekilde
  daraltıldı; JSDoc "Four-layer" olarak düzeltildi.
  (4) **session-start.sh** — `sudo` çağrıları `sudo -n` yapıldı (gizli şifre prompt'unda asılmayı
  önler); `set -e` kaldırıldı (best-effort startup); extended-stack skill'lerin user-level
  kataloğa zarifçe düştüğü belgelendi.
  (5) **settings.json** — aşırı geniş `Bash(python *)` / `Bash(node *)` deny kuralları kaldırıldı
  (normal dev'i blokluyordu; tehlikeli vektörler zaten permission-policy + net-fs-guard'da).
  (6) **Belgeler** — `.serena/project.yml`'in "tracked in git" iddiası düzeltildi (gerçekte
  gitignore'da, hook üretir); bayat analiz raporu güncellendi; `.DS_Store` dosyaları temizlendi.
  (7) **permission-policy.js false-positive** — destructive kalıplar (`sudo`, `rm -rf`, `DROP TABLE`)
  artık tırnak içi VERİ'de (ör. `git commit -m "..."` mesajı, `echo "..."`) eşleşmiyor; yalnızca
  gerçekten çalıştırılan komutlarda bloklar. `eval`/`sh -c`/`bash -c` gibi eval-construct'lar
  fail-safe olarak ham taranmaya devam eder (bypass yok). 6 senaryoluk davranış testi ile doğrulandı.
  (8) **`/vibe-plan` → Fable routing** — planlama muhakemesi ana oturum yerine senkron bir Fable
  subagent'ına (`Agent(subagent_type: "claude", model: "fable")`) dispatch edilir; ana oturum
  yalnızca MCP kurulumu + sunum + onay kapısını yönetir. CLAUDE.md model routing kuralı güncellendi.
- **Why:** Advisory hook mesajları sessizce kayboluyordu; context monitor yanlış event'te idi;
  belge/gerçek tutarsızlıkları ve aşırı-agresif deny kuralları vardı; destructive guard commit
  mesajlarında yanlış tetikleniyordu; planlama pahalı Opus yerine Fable'da koşmalıydı.
- **Source:** Dahili proje incelemesi.

## [2026-06-20] — obra/superpowers SDD tooling adoption

### Changes
- **What:** SDD workflow için dosya tabanlı el değiştirme (file handoff) mekanizması eklendi.
  (1) `.vibecode/scripts/task-brief` — plan dosyasından görev özeti çıkarır,
  `.vibecode/sdd/task-<N>-brief.md` yazar.
  (2) `.vibecode/scripts/review-package` — iki git ref arasındaki diff paketini
  `.vibecode/sdd/review-*.md` olarak üretir.
  (3) `.vibecode/scripts/sdd-workspace` — SDD çalışma alanı başlatır, `progress.md` ledger oluşturur.
  (4) `.vibecode/prompts/sdd-implementer.md` — implementer subagent sözleşmesi.
  (5) `.vibecode/prompts/sdd-reviewer.md` — reviewer subagent kriterleri (spec uyumu + kalite).
  (6) `/vibe-sdd` Phase 5 güncellendi — her görev öncesi/sonrası script çağrıları + ledger yönetimi.
  (7) `.gitignore`'a `.vibecode/sdd/` eklendi (çalışma zamanı dosyaları repo'ya karışmaz).
- **Why:** Uzun SDD çalışmalarında context compaction sonrası ilerleme kayboluyor, subagent
  prompt'ları görev metni + diff ile şişiyor. Dosya tabanlı el değiştirme her ikisini de çözer.
- **Source:** obra/superpowers — kurulum dışı tooling (skill'ler zaten `superpowers:*` prefix
  ile kuruluydu; sadece script/prompt/ledger katmanı eklendi).

## [2026-06-04] — WrongStack pattern adoption: fleet roles + security hardening (Claude-only)

### Changes
- **What:** WrongStack'in dört desenini vibecode'a uyarladık (provider katmanı hariç). (1) İki
  fail-closed PreToolUse güvenlik hook'u: `permission-policy.js` (risk-tier — destructive komutları
  hard-block, standard'ları uyar) ve `net-fs-guard.js` (SSRF + sistem-yolu + symlink containment).
  (2) Boş `.claude/agents/`'a 8 rol: explorer/architect/engineer/tester/reviewer/bug-hunter/
  refactor-planner/critic. (3) Dört slash command: `/vibe-fleet` (Director orkestrasyonu),
  `/vibe-sdd` (Spec-Driven Development), `/vibe-collab-debug` (3-rol debug), `/vibe-goal` (kilitli
  hedef + günlük, otonom değil). (4) İki skill: `agent-dispatch`, `subagent-budget-protocol`.
  (5) `settings.json` deny listesi genişletildi + iki hook kaydedildi. (6) Kapsamlı newcomer
  kılavuzu: `docs/guides/wrongstack-features-guide.md`.
- **Why:** WrongStack incelemesi 4 güçlü ama vibecode'da eksik desen ortaya çıkardı: rol-tabanlı
  fleet, spec-driven dev, işbirlikçi debug ve agent-seviyesi izin/güvenlik sertleştirmesi. Provider
  soyutlaması (OpenAI/Google/models.dev) ve runtime mekaniği (kernel/loop/yüzeyler) Claude Code
  zaten sağladığı için bilinçle dışarıda bırakıldı. Detay: ADR-006.
- **How:** Hook'lar saf Node (bağımlılıksız, parse hatasında exit 0), exit code 2 ile bloklar; 14
  test senaryosuyla doğrulandı (destructive→blok, standard→uyarı, SSRF→blok, env kaçış kapıları
  çalışıyor). Roller Claude Code subagent tanımı (frontmatter + tools + model). Komutlar `vibe-`
  prefix kuralına uygun. Açık sorular kullanıcı "full yetki" verdiği için belgelenip karara bağlandı
  (ADR-006): 8 rol, otonom-olmayan goal, SSRF env kaçışı, sadece-yeni-skill migration.

### Affected Files
- `.claude/hooks/permission-policy.js` — risk-tier permission hook (created)
- `.claude/hooks/net-fs-guard.js` — SSRF + FS containment hook (created)
- `.claude/agents/{explorer,architect,engineer,tester,reviewer,bug-hunter,refactor-planner,critic}.md` — 8 rol (created)
- `.claude/commands/{vibe-fleet,vibe-sdd,vibe-collab-debug,vibe-goal}.md` — 4 slash command (created)
- `.vibecode/skills/agent-dispatch/SKILL.md` — rol yönlendirme skill'i (created)
- `.vibecode/skills/subagent-budget-protocol/SKILL.md` — delegasyon disiplini skill'i (created)
- `.claude/settings.json` — deny listesi genişletildi + iki hook kaydedildi (modified)
- `.vibecode/standards/security.md` — §7 izin/net-fs sertleştirme (modified)
- `.vibecode/standards/documentation.md` — §7 skill manifest şeması (modified)
- `CLAUDE.md` — slash command tablosuna 4 komut eklendi (modified)
- `docs/architecture/wrongstack-pattern-adoption-plan.md` — mimari plan (created)
- `docs/architecture/INDEX.md` — plan referansı eklendi (modified)
- `docs/guides/wrongstack-features-guide.md` — kapsamlı kullanım kılavuzu (created)
- `docs/decisions.md` — ADR-006 (modified)

### Notes
- Tüm değişiklikler additive ve config-only — çekirdek Claude Code davranışı değişmedi, geri alınabilir.
- Hook kaçış kapıları: `VIBE_YOLO=1` (destructive blokları uyarıya indirir), `VIBE_ALLOW_PRIVATE_FETCH=1`
  (yerel API fetch). Yalnızca izole/dev ortamlarında kullan.

---

## [2026-04-30] — Add continuous-doc-maintainer skill and /vibe-doc-sync command

### Changes
- **What:** Created `continuous-doc-maintainer` skill (v4 spec, plain-Markdown adaptation) — 13-step pipeline with idempotency, schema-driven sync, blocking security linter, append-only audit trail. Added `/vibe-doc-sync` slash command for manual triggering. Integrated automatic shadow-mode run into `/vibe-done` Step 4b. Added `docs/CHANGELOG_INTERNAL.md` audit ledger. Added `.vibecode/state/` to gitignore. ADR-003 (Doc-Sync) superseded by ADR-005.
- **Why:** Manual `/vibe-done` checklist was the only doc-sync mechanism — no pruning of deleted endpoints, no schema-truth enforcement, no idempotency, no audit trail, no blocking security linter for secrets in docs. ADR-003's session-tracking proposal didn't address these structural gaps. v4 spec from user closes all of them.
- **How:** New skill at `.vibecode/skills/continuous-doc-maintainer/` with SKILL.md + input/output JSON schemas + audit-log template. New slash command at `.claude/commands/vibe-doc-sync.md`. `/vibe-done.md` Step 4b added. `documentation.md` §6 added. `CLAUDE.md` slash commands table updated. ADR-005 documents rationale + alternatives.

### Affected Files
- `.vibecode/skills/continuous-doc-maintainer/SKILL.md` — new skill (created)
- `.vibecode/skills/continuous-doc-maintainer/resources/input-schema.json` — new (created)
- `.vibecode/skills/continuous-doc-maintainer/resources/output-schema.json` — new (created)
- `.vibecode/skills/continuous-doc-maintainer/resources/audit-log-template.md` — new (created)
- `.claude/commands/vibe-doc-sync.md` — new slash command (created)
- `docs/CHANGELOG_INTERNAL.md` — new audit ledger (created)
- `docs/architecture/continuous-doc-maintainer-plan.md` — architecture plan (created)
- `docs/architecture/INDEX.md` — plan reference added
- `.vibecode/standards/documentation.md` — §6 added
- `.claude/commands/vibe-done.md` — Step 4b added
- `CLAUDE.md` — `/vibe-doc-sync` added to slash commands table
- `.gitignore` — `.vibecode/state/` added
- `docs/decisions.md` — ADR-003 superseded; ADR-005 added
- `docs/progress.md` — Doc-Sync System replaced by Continuous Doc Maintainer (Complete)

### Notes
- Default mode is `shadow` — no doc files are written without `--live` flag or user confirmation after preview
- Step 9 security linter (BLOCKING) prevents writing API keys, JWT, AWS access keys, private key blocks to docs
- `.vibecode/state/doc-hashes.json` is local-only (gitignored) — idempotency cache
- Out of scope (separate plans): Mintlify migration, `pre-tool-use.js` blocking secret scan, multi-agent doc lockfile

---

## [2026-03-27] — Add security-review skill and /security-review command

### Changes
- **What:** Created `security-review` skill for OWASP Top 10 code review across all languages (Python, JS/TS, Go, Java, C#). Added `/security-review` slash command for manual triggering. Integrated automatic security review into `/done` flow (Step 3). Updated CLAUDE.md slash commands table.
- **Why:** Need for systematic security review of generated/written code with line-level findings and patched code suggestions. Inspired by "Senior AppSec Engineer" prompt pattern.
- **How:** New skill at `.vibecode/skills/security-review/SKILL.md` with full OWASP Top 10 checklist + language-specific patterns. Slash command at `.claude/commands/security-review.md`. `/done` flow updated with automatic security pass.

### Affected Files
- `.vibecode/skills/security-review/SKILL.md` — new skill (created)
- `.claude/commands/security-review.md` — new slash command (created)
- `.claude/commands/done.md` — added Step 3: Security Review (Automatic)
- `CLAUDE.md` — added `/security-review` to slash commands table
- `docs/architecture/security-review-skill-plan.md` — architecture plan (created)
- `docs/CHANGELOG.md` — this entry
- `docs/decisions.md` — ADR-004 added
- `docs/progress.md` — security-review module added

---

## [2026-03-26] v0.2.0 — Enforce mandatory Serena usage, pre-operation MCP checks, and doc updates

### Changes
- **What:** Strengthened MCP enforcement in CLAUDE.md (§2 rewritten with pre-operation health check, Serena non-negotiable usage). Added mandatory doc update enforcement in Task Decision Tree. Expanded absolute rules from 5 to 8 (added Serena, MCP check, doc update rules). Updated pre-tool-use.js with MCP availability reminders and doc update reminders. Updated README to reflect all changes.
- **Why:** Serena must be used for ALL code operations (not optional). Documentation must be updated after EVERY change (not just at /done). MCP availability must be verified before every operation, not just at session start.
- **How:** CLAUDE.md §2 split into §2.1 (pre-op MCP check), §2.2 (Serena non-negotiable), §2.3 (Context7). Hook now has 4 advisory layers: MCP, standards, skills, docs. Five Absolute Rules → Eight Absolute Rules.

### Affected Files
- `CLAUDE.md` — §2, §4, §9 rewritten/expanded
- `.claude/hooks/pre-tool-use.js` — MCP + doc reminder layers added
- `README.md` — hooks, rules, troubleshooting sections updated
- `docs/CHANGELOG.md` — this entry

---

## [2026-03-26] v0.1.2 — Update README with Error Memory, Skill Orchestrator, and ADR documentation

### Changes
- **What:** Updated README.md to document Error Memory (ADR-001), Skill Orchestrator (ADR-002), and ADR system. Added new sections, updated directory tree, hooks description, /done flow, FAQ, and philosophy.
- **Why:** README was out of date — strategic improvements (Error Memory, Skill Orchestrator, ADR system) were implemented in CLAUDE.md and hooks but not reflected in user-facing documentation.
- **How:** 7 sections updated/added: intro table, Gate 2, directory tree, hooks (skill suggestion), /done flow, Error Memory section, ADR section, FAQ entries, philosophy.

### Affected Files
- `README.md` — 7 sections updated, 2 new sections added
- `docs/CHANGELOG.md` — this entry

---

## [2026-03-26] v0.1.1 — Integrate ADR decisions into CLAUDE.md and hooks

### Changes
- **What:** Updated CLAUDE.md to reference Error Memory system (ADR-001) in session startup, task decision tree, /done command, project structure, and quick reference. Updated `pre-tool-use.js` with skill suggestion logic (ADR-002).
- **Why:** ADR decisions were recorded but not reflected in the governing files that Claude reads at session start. Without these references, the Error Memory and Skill Orchestrator systems would not be activated.
- **How:** Added error memory scan steps to Gates and Task Decision Tree. Added `.vibecode/memories/errors/` to project structure. Extended pre-tool-use hook with file-path-to-skill mapping (advisory, non-blocking).

### Affected Files
- `CLAUDE.md` — 5 sections updated (§1, §3, §4, §7, §11)
- `.claude/hooks/pre-tool-use.js` — skill suggestion logic added
- `docs/CHANGELOG.md` — this entry

---

## [2026-03-26] v0.1.0 — ADR system initialized with 3 architecture decisions

### Changes
- **What:** Created `docs/decisions.md` with ADR-001 (Error Memory), ADR-002 (Skill Orchestrator), ADR-003 (Doc-Sync). Created `docs/CHANGELOG.md` and `docs/progress.md` for tracking.
- **Why:** Project needs formal decision records for three proposed infrastructure improvements: structured error memory, automatic skill recommendation, and hybrid documentation sync.
- **How:** ADRs written following `documentation.md §3` format. Error Memory (ADR-001) accepted as highest ROI item; ADR-002 and ADR-003 in Proposed status pending implementation.

### Affected Files
- `docs/decisions.md` — new file, 3 ADRs
- `docs/CHANGELOG.md` — new file, initial entry
- `docs/progress.md` — new file, roadmap tracking
