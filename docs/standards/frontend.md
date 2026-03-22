# Frontend Standards

> **When to read:** Before writing ANY frontend code.
> **Stack:** React 18+ / TypeScript / Vite / TanStack Query / Zustand / shadcn/ui / React Hook Form + Zod

---

## 1. Core Rules

- **Functional components only:** No class components — ever
- **TypeScript strict mode:** `strict: true`, `noUncheckedIndexedAccess: true` in tsconfig
- **No `any`:** Use `unknown` and narrow, or define a proper type
- **Explicit return types:** Required on all exported functions and hooks
- **No `enum`:** Use `as const` objects or union types
- **No `as` assertions:** Unless unavoidable (DOM refs are acceptable)
- **PascalCase:** Components and types — `UserProfile.tsx`, `UserProfileProps`
- **camelCase:** Hooks, utilities, variables — `useAuth`, `formatDate`
- **Imports:** Use `@/` path alias for `src/` — no deep relative paths (`../../..`)
- **Auto-generated API types:** `src/types/api.generated.ts` — never edit manually
- **Interfaces for props:** Better error messages than `type` for object shapes

---

## 2. Directory Structure

```
frontend/src/
├── api/                  # TanStack Query hooks + typed fetch client
│   ├── client.ts         # Fetch wrapper with auth, error handling
│   └── queries/          # One file per resource (users.ts, projects.ts)
├── components/           # Reusable UI (not page-specific)
│   └── ui/               # shadcn/ui — managed by CLI, do not create manually
├── hooks/                # Custom hooks (shared across pages)
├── pages/                # Route-level components (page-specific children live here)
├── store/                # Zustand stores — one file per domain
├── types/
│   ├── api.generated.ts  # AUTO-GENERATED from OpenAPI — never edit
│   └── index.ts          # App-specific shared types
├── utils/                # Pure utility functions
├── lib/                  # Third-party config (Zod schemas, etc.)
└── App.tsx
```

Co-locate tests with components: `Button.tsx` + `Button.test.tsx` in the same directory.

---

## 3. TanStack Query Patterns

**Query key factory** — every resource gets one:

```typescript
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
};
```

**Query hook:**

```typescript
export function useUser(id: string): UseQueryResult<User> {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => apiClient.get<User>(`/users/${id}`),
    staleTime: 5 * 60 * 1000,
  });
}
```

**Mutation with optimistic update:** Use `onMutate` to snapshot + set optimistic data, `onError` to rollback from context, `onSettled` to invalidate.

**Cache invalidation:** After create/update/delete, invalidate the parent list with `queryClient.invalidateQueries({ queryKey: userKeys.all })`.

---

## 4. Zustand Patterns

Always use `subscribeWithSelector` middleware. Separate state and actions into distinct interfaces:

```typescript
interface AuthState { user: User | null; token: string | null; }
interface AuthActions { login: (creds: LoginInput) => Promise<void>; logout: () => void; }
type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set) => ({
    user: null, token: null,
    login: async (creds) => { /* ... */ set({ user, token }); },
    logout: () => set({ user: null, token: null }),
  }))
);
```

**Selector rules:**

```typescript
const user = useAuthStore((s) => s.user);     // GOOD — atomic selector
const { user, token } = useAuthStore();        // BAD — re-renders on ANY change
```

**When to use which:**
- **TanStack Query:** Server state (API data, cache, sync)
- **Zustand:** Client-only state (auth tokens, UI state, theme)

---

## 5. shadcn/ui Usage

- Import from `@/components/ui/` — project files, not a library
- Add components via CLI: `npx shadcn-ui add button`
- Customize via CSS variables in `globals.css`, not component props
- Use Radix primitives directly only when shadcn/ui lacks the component
- Do not wrap shadcn/ui components in unnecessary abstraction layers

---

## 6. Form Handling — React Hook Form + Zod

- Define Zod schemas in `lib/` or co-located with the form
- Use `zodResolver` from `@hookform/resolvers/zod`
- Derive form types with `z.infer<typeof schema>` — do not duplicate manually
- For async validation (e.g., uniqueness checks), use `.refine()` with an API call
- Wire mutations via TanStack Query `useMutation` in the submit handler

---

## 7. API Layer

- `api/client.ts` — typed fetch wrapper that reads auth token from Zustand store
- All errors must throw an `ApiError` with status code + RFC 7807 detail
- Env variable: `import.meta.env.VITE_API_URL`

**Type generation workflow:**
1. Backend changes an endpoint
2. Run `docker compose exec frontend npm run generate-types`
3. Output updates `src/types/api.generated.ts`
4. Import generated types in query hooks
5. Commit `api.generated.ts` alongside the API change

---

## 8. Testing — Vitest + React Testing Library

- Test **user behavior**, not implementation details
- Query by **role, label, text** — never by class name or test ID (unless no alternative)
- Use **MSW** (Mock Service Worker) for API mocking — do not mock `fetch` directly
- Co-locate test files with components: `Component.test.tsx`

```typescript
describe("LoginForm", () => {
  it("shows validation error for empty email", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });
});
```

---

## 9. Linting and Formatting

- **ESLint:** `eslint-plugin-react-hooks` + `@typescript-eslint/eslint-plugin`
- **Prettier:** Single config, runs on save
- **Vite:** Use `vite-plugin-checker` for TypeScript errors in dev overlay
- Run `npm run lint` + `npm run typecheck` before every commit (included in `make verify`)

---

## 10. Performance Guidelines

Only use `React.memo`, `useMemo`, or `useCallback` when:
1. You have **measured** a problem with React DevTools Profiler
2. The component re-renders frequently with **unchanged props**
3. The computation is genuinely **expensive**

**Lazy loading:** Use `lazy()` + `<Suspense>` for all route-level page components. Do not lazy-load small shared components.

**Images:** Use `loading="lazy"` below the fold, explicit `width`/`height`, WebP/AVIF when possible.

---

## 11. Anti-Patterns

| Do Not | Do Instead |
|--------|-----------|
| Use `any` | Use `unknown` and narrow |
| Destructure entire Zustand store | Use atomic selectors |
| Edit `api.generated.ts` manually | Run `generate-types` |
| Mock `fetch` directly in tests | Use MSW |
| Use `index` as React list key | Use stable unique ID |
| Prop-drill more than 2 levels | Use context or Zustand |
| Use `useEffect` for data fetching | Use TanStack Query |
| Catch errors silently (`catch {}`) | Handle or re-throw with context |
| Wrap shadcn/ui in abstraction layers | Use shadcn/ui directly |
| Store server state in Zustand | Use TanStack Query for server state |
| Use inline styles | Use Tailwind utility classes |
| Write `console.log` in committed code | Use a logger utility or remove |
