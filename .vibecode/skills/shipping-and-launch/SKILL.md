---
name: shipping-and-launch
description: "Production launch management: pre-launch checklist, staged rollout, feature flags, monitoring, rollback. Use when shipping features to production."
---

## Overview

Launch management layer above deployment. Covers what to check before going live, how to roll out safely, and how to verify after launch.

This skill sits above `deployment-procedures` (which handles the mechanics of deploying). Here, the concern is: is this feature ready to be live, and how do we expose it to users safely?

## When to Use

- Before any production deployment
- When rolling out a new feature to users
- When planning a migration that affects live traffic

## Pre-Launch Checklist

### Code Quality
- [ ] All tests pass (`make verify`)
- [ ] No TODO/FIXME in shipped code
- [ ] Error handling covers all failure modes
- [ ] Logging added for key operations

### Security
- [ ] Authentication/authorization verified
- [ ] Input validation on all endpoints
- [ ] No secrets in code or logs
- [ ] CORS configured correctly
- [ ] Rate limiting in place

### Performance
- [ ] Database queries optimized (no N+1)
- [ ] Response times within SLA (<200ms p95)
- [ ] Bundle size checked (frontend)
- [ ] Caching strategy defined

### Accessibility
- [ ] Semantic HTML used
- [ ] Keyboard navigation works
- [ ] Screen reader tested
- [ ] Color contrast meets WCAG AA
- [ ] Focus management correct

### Infrastructure
- [ ] Health check endpoint exists
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Monitoring/alerting configured

### Documentation
- [ ] API docs updated
- [ ] CHANGELOG updated
- [ ] User-facing docs updated if needed

## Staged Rollout

### Sequence

1. **Staging** — Full test on staging environment
2. **Production (flag off)** — Deploy code, feature flag disabled
3. **Team canary** — Enable for internal team only
4. **5% rollout** — Small user segment
5. **25% → 50% → 100%** — Incremental expansion

### Decision Thresholds

| Metric | Green (advance) | Yellow (hold) | Red (rollback) |
|--------|----------------|---------------|-----------------|
| Error rate | Within baseline | 10-100% above | >2x baseline |
| p95 latency | Within SLA | 10-50% above SLA | >2x SLA |
| Business metrics | No regression | <5% regression | >10% regression |

At each stage, observe for a minimum of 15 minutes before advancing. For high-traffic features, extend to 30-60 minutes per stage.

## Feature Flag Lifecycle

1. **Create** — Flag defaults to OFF
2. **Enable for team** — Internal testing
3. **Canary** — Small percentage
4. **Full rollout** — 100%
5. **Cleanup** — Remove flag within 2 weeks of full rollout. Dead flags are tech debt.

Never ship code that depends on a flag that has not been created yet. Create the flag first, then deploy.

## Rollback Strategy

- Document rollback steps BEFORE launching
- Database migrations must be backward-compatible
- Keep previous version deployable for 24h minimum
- If rollback needed: revert flag first, then investigate

Rollback order:
1. Disable feature flag (immediate, no redeploy needed)
2. If flag rollback is insufficient, redeploy previous image
3. If data was affected, run compensating migration
4. Post-mortem within 48h

## Post-Launch Verification (First Hour)

- [ ] Error rates normal
- [ ] Response times normal
- [ ] Key user flows working (smoke test)
- [ ] No new error types in logs
- [ ] Business metrics tracking

Check at: 5 min, 15 min, 30 min, 60 min after enabling for each rollout stage.

## Anti-patterns

- Launching on Friday afternoon
- Big-bang rollout (0% → 100%) without staging
- Skipping accessibility checks
- No rollback plan
- Removing feature flags before confirming stability
- Deploying migrations that are not backward-compatible with the running version
- Enabling a flag in production before smoke-testing on staging
