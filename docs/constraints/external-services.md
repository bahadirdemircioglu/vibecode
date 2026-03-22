# External Services Constraints

> Fill this file when starting a new project. Delete sections that don't apply.
> These constraints override general standards for this specific project.

## Decisions
- Email service: [e.g., Resend, SendGrid, SMTP relay, none]
- File storage: [e.g., local volume, S3-compatible, Cloudflare R2]
- Payment provider: [e.g., Stripe, none]
- Search engine: [e.g., PostgreSQL full-text, Meilisearch, none]

## Requirements
- API keys: [e.g., stored in .env, never committed]
- Fallback: [e.g., queue emails if provider is down]
- Upload limits: [e.g., 10MB per file, images only]
- Webhook security: [e.g., signature verification required]

## Restrictions
- [e.g., No AWS services — use S3-compatible alternatives]
- [e.g., No direct third-party calls from frontend — proxy through backend]
- [e.g., No paid services in MVP — free tiers only]

## Review Date
YYYY-MM-DD — revisit when [trigger, e.g., adding payment processing]
