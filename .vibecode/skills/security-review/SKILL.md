---
name: security-review
description: >
  Senior Application Security Engineer. Reviews code for OWASP Top 10
  vulnerabilities across all languages and frameworks. Identifies exact
  lines where issues occur and provides patched code. Covers IDOR, injection,
  data leaks, auth bypass, mass assignment, path traversal, SSRF, XSS,
  insecure deserialization, and improper error handling.
metadata:
  model: opus
---

# Security Review Skill

> Act as a Senior Application Security Engineer. Review code for OWASP Top 10
> vulnerabilities. Point out the exact lines where issues occur and provide
> the patched code.

## When to Use

- After writing or modifying code — before marking a task complete
- When `/vibe-security-review` is invoked
- During `/vibe-done` — automatic security pass on changed files
- When reviewing pull requests or branch diffs

## When NOT to Use

- Reading config files or documentation (no executable code)
- Exploring code without intent to ship changes

## Review Scope — OWASP Top 10 (2025)

Check EVERY item for EVERY file under review:

### A01 — Broken Access Control
- [ ] **IDOR**: User-supplied IDs used to fetch resources without ownership check
- [ ] **Missing auth**: Endpoints or functions accessible without authentication
- [ ] **Privilege escalation**: Regular user can access admin-only operations
- [ ] **Path traversal**: User input in file paths without sanitization
- [ ] **CORS misconfiguration**: Overly permissive origins (`*` in production)

### A02 — Cryptographic Failures
- [ ] **Sensitive data in responses**: Passwords, tokens, secrets returned in API responses
- [ ] **Sensitive data in logs**: Tokens, passwords, PII written to logs
- [ ] **Weak hashing**: MD5, SHA1 for passwords instead of bcrypt/argon2
- [ ] **Missing encryption**: Sensitive data stored or transmitted in plaintext
- [ ] **Hardcoded secrets**: API keys, passwords, tokens in source code

### A03 — Injection
- [ ] **SQL injection**: String concatenation or f-strings in SQL queries
- [ ] **Command injection**: User input in `os.system()`, `subprocess`, `exec`
- [ ] **NoSQL injection**: Unvalidated input in MongoDB/NoSQL queries
- [ ] **LDAP injection**: User input in LDAP queries
- [ ] **Template injection**: User input in server-side template rendering
- [ ] **XSS** (frontend): Unsanitized user input rendered in HTML/DOM
- [ ] **Header injection**: User input in HTTP headers without validation

### A04 — Insecure Design
- [ ] **Mass assignment**: Accepting all fields from request without allowlist
- [ ] **Missing rate limiting**: Auth endpoints without throttling
- [ ] **No input validation**: Missing type/length/range checks on user input
- [ ] **Business logic flaws**: Missing state checks, race conditions in workflows

### A05 — Security Misconfiguration
- [ ] **Debug mode in production**: Debug flags, verbose errors exposed
- [ ] **Default credentials**: Default passwords, admin accounts
- [ ] **Unnecessary features enabled**: Unused endpoints, admin panels exposed
- [ ] **Missing security headers**: CSP, HSTS, X-Frame-Options absent

### A06 — Vulnerable Components
- [ ] **Known vulnerable dependencies**: Outdated packages with CVEs
- [ ] **Unverified sources**: Dependencies from untrusted registries

### A07 — Authentication Failures
- [ ] **Weak password policy**: No length/complexity requirements
- [ ] **Missing MFA**: Critical operations without multi-factor
- [ ] **Token issues**: No expiration, predictable tokens, missing rotation
- [ ] **Session fixation**: Session ID not regenerated after login

### A08 — Data Integrity Failures
- [ ] **Insecure deserialization**: `pickle.loads()`, `eval()`, `unserialize()`, `JSON.parse()` on untrusted data
- [ ] **Missing integrity checks**: Unsigned updates, tampered data accepted

### A09 — Logging & Monitoring Failures
- [ ] **Silent failures**: `except: pass`, empty catch blocks swallowing errors
- [ ] **Missing audit trail**: Security events not logged
- [ ] **Log injection**: User input written directly to logs without sanitization

### A10 — Server-Side Request Forgery (SSRF)
- [ ] **Unvalidated URLs**: User-supplied URLs fetched without allowlist
- [ ] **Internal network access**: Requests to internal services via user input
- [ ] **Protocol smuggling**: File://, gopher://, dict:// protocols allowed

## Language-Specific Checks

### Python / FastAPI / Django / Flask
| Pattern | Risk | Look For |
|---------|------|----------|
| `f"SELECT ... {user_input}"` | SQL Injection | Raw SQL with string formatting |
| `os.system(cmd)`, `subprocess.call(shell=True)` | Command Injection | Shell commands with user input |
| `pickle.loads(data)` | RCE | Deserialization of untrusted data |
| `eval()`, `exec()` | RCE | Dynamic code execution |
| `open(user_path)` | Path Traversal | File access with user input |
| `requests.get(user_url, verify=False)` | SSRF + TLS bypass | Outbound requests |
| `**request.dict()` in ORM create | Mass Assignment | Unfiltered model creation |
| Response model exposing `password_hash` | Data Leak | Sensitive fields in response |
| `logger.info(f"token={token}")` | Secret Leak | Sensitive data in logs |
| Bare `except: pass` | Silent Failure | Swallowed exceptions |

### JavaScript / TypeScript / React / Node.js
| Pattern | Risk | Look For |
|---------|------|----------|
| `innerHTML = userInput` | XSS | Unsanitized DOM manipulation |
| `dangerouslySetInnerHTML` | XSS | React HTML injection |
| `eval(userInput)` | RCE | Dynamic code execution |
| `new Function(userInput)` | RCE | Dynamic function creation |
| Template literals in SQL | SQL Injection | `db.query(\`SELECT ... ${id}\`)` |
| `document.location = userUrl` | Open Redirect | Unvalidated redirect |
| `JSON.parse(untrustedData)` | Prototype Pollution | Unvalidated parsing |
| Missing `httpOnly` on auth cookies | Session Theft | Cookie flags |
| `cors({ origin: '*' })` | CORS Bypass | Wildcard CORS |
| `console.log(secret)` | Secret Leak | Sensitive data in logs |

### Go
| Pattern | Risk | Look For |
|---------|------|----------|
| `fmt.Sprintf("SELECT ... %s", input)` | SQL Injection | String formatting in queries |
| `exec.Command(userInput)` | Command Injection | Shell commands |
| `http.Get(userURL)` | SSRF | Unvalidated outbound requests |
| `json.Unmarshal` into map | Mass Assignment | Untyped deserialization |
| Ignoring error returns `_ = fn()` | Silent Failure | Unchecked errors |

### Java / Kotlin / Spring
| Pattern | Risk | Look For |
|---------|------|----------|
| String concat in `PreparedStatement` | SQL Injection | Non-parameterized queries |
| `Runtime.exec(userInput)` | Command Injection | Shell execution |
| `ObjectInputStream.readObject()` | RCE | Deserialization of untrusted data |
| `@RequestBody` without validation | Mass Assignment | Missing `@Valid` |
| `@CrossOrigin("*")` | CORS Bypass | Wildcard CORS |

### C# / .NET
| Pattern | Risk | Look For |
|---------|------|----------|
| String concat in `SqlCommand` | SQL Injection | Non-parameterized queries |
| `Process.Start(userInput)` | Command Injection | Shell execution |
| `BinaryFormatter.Deserialize()` | RCE | Insecure deserialization |
| `[FromBody]` without `[ApiController]` | Mass Assignment | Missing model validation |

## Review Procedure

### Step 1 — Identify Target Files
- If file path given: review that file
- If "last" or no argument: find recently changed files via `git diff --name-only HEAD~1`
- For `/vibe-done` flow: review all files in `git diff --name-only` (staged + unstaged)

### Step 2 — Read Each File Completely
- Read the full file, not just the diff
- Understand the context: what does this code do? what data does it handle?

### Step 3 — Run Checklist
For each file, go through EVERY item in the Review Scope checklist above.
Mark each item as clean or flag it.

### Step 4 — Verify Findings
For each potential issue:
- Check if it's already mitigated elsewhere (middleware, decorator, base class)
- Check if there are existing tests covering the scenario
- Read surrounding context to confirm the issue is real
- Do NOT report false positives

### Step 5 — Report

For each confirmed issue, output:

```markdown
### [CRITICAL/HIGH/MEDIUM/LOW] — [Vulnerability Name] (OWASP [A0X])
**File:** `path/to/file.ext` **Line:** [line number]
**Problem:** [Clear explanation of what's wrong]
**Impact:** [What an attacker could do]

**Vulnerable code:**
\`\`\`[language]
[exact code from the file]
\`\`\`

**Patched code:**
\`\`\`[language]
[fixed version of the code]
\`\`\`

**Why this fix works:** [Brief explanation]
```

### Step 6 — Summary

End the review with:

```markdown
## Security Review Summary
- **Files reviewed:** [count]
- **Issues found:** [count by severity]
- **Clean areas:** [what was checked and found safe]
- **Limitations:** [what could NOT be verified and why]
```

## Severity Classification

| Severity | Criteria | Examples |
|----------|----------|---------|
| **CRITICAL** | Remote code execution, auth bypass, mass data exposure | SQL injection, deserialization RCE, broken auth |
| **HIGH** | Data exposure, privilege escalation, significant data leak | IDOR, XSS with session theft, path traversal |
| **MEDIUM** | Limited scope, requires specific conditions | CSRF, missing rate limiting, information disclosure |
| **LOW** | Best practice violation, minimal direct impact | Missing security headers, verbose errors in dev |

## Anti-Patterns — Do NOT Do These

| Anti-Pattern | Correct Approach |
|---|---|
| Report style/formatting issues | Focus only on security |
| Invent hypothetical issues | Only report confirmed, verifiable issues |
| Suggest complete rewrites | Provide minimal, targeted patches |
| Ignore framework protections | Check if the framework already mitigates the issue |
| Skip files because they "look safe" | Check every file against the full checklist |
| Report without line numbers | Always include exact file:line references |
