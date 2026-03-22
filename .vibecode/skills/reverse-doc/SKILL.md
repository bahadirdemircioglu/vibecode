---
name: reverse-doc
description: "Generate documentation from existing code. Use when codebase lacks docs, or when onboarding to an undocumented project."
---

# Reverse Documentation Skill

## Purpose

Generate structured documentation from existing code when a codebase lacks
documentation, or when onboarding to an undocumented project. Produces API
specs, architecture docs, or ADRs derived from source analysis.

---

## Protocol

### Step 1 — Analyze Target Code Path

Accept a directory or file path as input. For each file found, extract:

- **API endpoints:** HTTP method, path, request/response schemas, auth requirements
- **Data models:** Fields, types, relationships, constraints, indexes
- **Service dependencies:** What each service calls, external APIs, database queries
- **Patterns used:** Repository pattern, service layer, event-driven, etc.
- **Configuration:** Environment variables, feature flags, constants
- **Error handling:** Exception types, error response formats, retry logic

### Step 2 — Ask Clarifying Questions About Intent

Code tells you WHAT exists, not WHY it was built that way. Before generating
docs, ask the user about:

- **Business context:** What problem does this solve?
- **Design decisions:** Why was this approach chosen over alternatives?
- **Known limitations:** What does the code NOT handle that it should?
- **User expectations:** Who uses this and what do they expect?

If the user cannot answer (e.g., inherited codebase), document these as
"UNCLEAR INTENT" sections.

### Step 3 — Mark Unclear Areas Explicitly

When code intent is ambiguous, do not guess. Mark it clearly:

```markdown
> **UNCLEAR INTENT:** The `retry_with_backoff` wrapper in `payment_service.py`
> retries up to 5 times with exponential backoff. It is unclear whether this
> is for network resilience or to handle eventual consistency in the payment
> gateway. The retry count (5) may need adjustment based on SLA requirements.
```

### Step 4 — Generate Appropriate Document Type

Based on the target scope, generate one of:

| Scope | Document Type | Output Location |
|-------|--------------|-----------------|
| Single API route file | API endpoint spec | `docs/api/` |
| Full `api/v1/` directory | API reference | `docs/api/` |
| Models + services | Architecture overview | `docs/architecture/` |
| A single design decision | ADR (Architecture Decision Record) | `docs/decisions.md` |
| Full project | Onboarding guide | `docs/admin/` |

### Step 5 — Add Metadata

Every reverse-documented file must include a metadata header:

```markdown
---
status: reverse-documented
source: backend/src/services/payment.py
date: 2026-03-22
author: Claude (reverse-doc skill)
confidence: high | medium | low
---
```

Confidence levels:
- **High:** Code is well-structured with clear naming; intent is obvious
- **Medium:** Code is functional but some decisions are unclear
- **Low:** Code is complex, poorly named, or lacks context; many UNCLEAR INTENT markers

### Step 6 — Flag Concerns

While documenting, flag any concerns found:

| Concern Type | Example |
|-------------|---------|
| **Balance concern** | Service handles both auth AND billing — SRP violation |
| **Missing edge case** | No handling for empty cart in checkout flow |
| **Incomplete implementation** | TODO comment with unfinished logic |
| **Security concern** | Raw SQL query without parameterization |
| **Performance concern** | N+1 query pattern in list endpoint |
| **Dead code** | Function defined but never called |

---

## Output Format

```
## Reverse Documentation: [target path]

### Metadata
- Status: reverse-documented
- Source: [path]
- Date: [date]
- Confidence: [high/medium/low]

### Overview
[1-2 paragraph summary of what this code does]

### API Endpoints (if applicable)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/users | JWT | List all users |
| POST | /api/v1/users | Public | Create new user |

### Data Models (if applicable)
| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| User | id, email, hashed_password | has_many: Orders |

### Dependencies
- External: Stripe API, SendGrid
- Internal: UserService -> OrderService -> PaymentService

### Patterns
- Repository pattern for data access
- Service layer for business logic
- Dependency injection via FastAPI Depends

### UNCLEAR INTENT
1. [Description of unclear area]
2. [Description of unclear area]

### Concerns
- [ ] **Balance:** PaymentService handles refunds AND notifications
- [ ] **Missing edge case:** No handling for duplicate email registration
- [ ] **TODO:** `# TODO: implement webhook verification` at line 142

### Recommendations
1. [Most important action to improve this code/docs]
2. [Second priority]
```

---

## When to Use

| Trigger | Scope |
|---------|-------|
| Onboarding to undocumented project | Full project scan |
| Inherited/legacy code with no docs | Target directory scan |
| User asks "what does this code do?" | Single file analysis |
| Pre-refactor documentation | Target module scan |
| Audit before handoff to another team | Full project scan |

---

## Anti-patterns

```
NEVER generate documentation without reading the actual source code.
  -> Do not guess what code does based on file names alone.

NEVER omit UNCLEAR INTENT markers.
  -> Guessing intent and stating it as fact creates misleading documentation.

NEVER generate docs for node_modules/, .next/, dist/, __pycache__/, .git/.
  -> These are excluded from all analysis.

NEVER present reverse-documented files as authoritative design docs.
  -> Always include the "reverse-documented" status marker so readers know
     this was inferred, not authored by the original developer.

NEVER skip the clarifying questions step.
  -> Even if you think the code is clear, ask about intent. The user may
     reveal context that changes the documentation significantly.
```
