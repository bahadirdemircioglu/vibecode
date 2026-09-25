---
name: tdd-workflows-tdd-cycle
description: Test-Driven Development RED-GREEN-REFACTOR cycle for this stack (pytest/FastAPI backend, Vitest/React Testing Library frontend). Use before writing any implementation code for a new feature, bug fix, or behavior change.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# TDD Workflow: Red-Green-Refactor

> Write the test first. Watch it fail. Write minimal code to pass. Refactor.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

## Use this skill when

- Implementing any new feature or bugfix, before writing implementation code
- Working on FastAPI endpoints/services (pytest) or React components/hooks (Vitest + RTL)
- Refactoring existing code that needs a safety net first

## Do not use this skill when

- Throwaway prototypes/spikes (ask your human partner, then throw away and redo with TDD before merging)
- Pure configuration files with no behavior
- Auto-generated code (e.g. `api.generated.ts`)

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote code before the test? Delete it. Don't keep it "as reference," don't adapt it — delete means delete. Implement fresh from tests.

## The Cycle

```
RED → write a failing test → verify it fails for the right reason
GREEN → write the minimum code to pass → verify it passes, nothing else breaks
REFACTOR → clean up, keep tests green
Repeat for the next behavior
```

---

## RED — Write a Failing Test

One behavior per test. Clear name describing the behavior. Real code, not mocked internals — mock only true external dependencies (DB, network, other services).

**Backend (pytest / FastAPI):**

```python
def test_create_user_rejects_duplicate_email(client, db_session):
    db_session.add(User(email="a@example.com"))
    db_session.commit()

    response = client.post("/users", json={"email": "a@example.com", "password": "x"})

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"
```

Use fixtures (`conftest.py`) for DB session / test client setup, `@pytest.mark.parametrize` for multiple cases, `pytest.raises` for expected exceptions. Test against a real test database (Docker `postgres-test`), not mocks, for integration-level tests; use plain pytest with no DB for pure logic/unit tests.

**Frontend (Vitest + React Testing Library):**

```typescript
describe("LoginForm", () => {
  it("shows validation error for empty email", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });
});
```

Query by role/label/text, not test IDs or class names. Mock network calls with MSW, never mock `fetch` directly.

**Verify RED — mandatory, never skip:**

```bash
docker compose exec backend uv run pytest path/to/test_file.py -v
docker compose exec frontend npm run test -- path/to/Component.test.tsx
```

Confirm: the test fails (not errors), the failure message matches what's missing, and it fails because the behavior doesn't exist yet — not because of a typo or setup bug. If it passes immediately, it's testing existing behavior — fix the test.

---

## GREEN — Minimal Code to Pass

Write the simplest code that makes the test pass. No extra features, no premature optimization, no unrelated refactoring.

**Backend:**

```python
@router.post("/users", status_code=201)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    await db.commit()
    return user
```

**Frontend:**

```typescript
export function LoginForm(): JSX.Element {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}
      <button type="submit">Log in</button>
    </form>
  );
}
```

**Verify GREEN — mandatory:**

```bash
docker compose exec backend uv run pytest -v
docker compose exec frontend npm run test
```

Confirm: the target test passes, the full suite still passes, output is clean (no warnings/errors). Test still fails? Fix the code, never the test (unless the test itself was wrong).

---

## REFACTOR — Clean Up, Stay Green

Only after green. Remove duplication, improve names, extract helpers/hooks/services. No new behavior. Small steps, re-run tests after each change.

Common moves in this stack:
- Backend: inline handler → service function → repository layer as complexity grows
- Frontend: inline logic → custom hook → extracted component
- Extract Pydantic/Zod schemas once reused in more than one place
- Replace magic values with named constants

Run the full test suite (`make test` or `docker compose exec backend uv run pytest` / `docker compose exec frontend npm run test`) after every refactor step. If anything goes red, revert the last change and take a smaller step.

---

## AAA Pattern

Every test: **Arrange** (set up data/fixtures) → **Act** (call the function/render/submit) → **Assert** (check the outcome). Keep to one logical assertion group per test; split `test('validates email and rejects duplicates')` into two tests.

## Rules

1. Test first, always — no exceptions without your human partner's explicit sign-off
2. Watch every test fail before making it pass
3. Minimal code in GREEN — YAGNI, no gold-plating
4. Tests stay green through REFACTOR — if not, revert and take smaller steps
5. Bug fix = write a failing test reproducing the bug first, then fix
6. Mock only true externals (network, third-party APIs) — never mock the thing under test

## Anti-Patterns

| Don't | Do instead |
|-------|-----------|
| Write implementation before the test | Write the test, watch it fail, then implement |
| Test passes immediately on first run | Something's wrong — you're testing existing behavior |
| Multiple unrelated assertions per test | One behavior per test |
| Mock `fetch` directly in frontend tests | Use MSW |
| Skip the refactor phase | Refactor is not optional — do it every cycle |
| "I'll add tests after, same result" | Tests-after verify what you built; tests-first verify what's required |
| Keep pre-TDD code "as reference" | Delete means delete — implement fresh from tests |
| Query DOM by class name/test ID | Query by role, label, or text |

## When Stuck

| Problem | Likely cause / fix |
|---------|--------------------|
| Don't know how to test it | Write the API you wish existed, write the assertion first |
| Test setup is huge | Extract fixtures/factories; if still huge, the design is too coupled |
| Must mock almost everything | Too much coupling — use dependency injection (FastAPI `Depends`, prop injection) |
| Can't explain why a test failed | Stop — you don't understand the requirement yet |
