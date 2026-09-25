---
paths: ["frontend/src/api/**", "frontend/src/types/api.generated.ts"]
---

# Frontend API Layer

- `api.generated.ts` is **AUTO-GENERATED** -- never edit it manually; run `generate-types` instead
- Use **TanStack Query** hooks for all API calls; never raw `fetch` or `useEffect` for data fetching
- Define **query key factories** per resource for consistent cache management
- Mutations must handle **optimistic updates** or **cache invalidation** via `onSettled`
- Error handling: use `onError` callback; never silently catch errors
- Mock API calls in tests with **MSW**, not by mocking `fetch` directly
- Import generated types from `@/types/api.generated` in query hooks
