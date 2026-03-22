---
paths: ["frontend/src/components/**", "frontend/src/pages/**"]
---

# Frontend Components

- **Functional components only** -- no class components, ever
- Props defined with TypeScript `interface` (not `type` alias) -- better error messages
- No business logic in components -- delegate to **hooks** or **Zustand store**
- Use `@/` import alias for all imports; no deep relative paths (`../../..`)
- **Accessibility:** all interactive elements need `aria-label` or visible label association
- No `any` -- use `unknown` and narrow, or define a proper type
- Use shadcn/ui components directly; do not wrap them in unnecessary abstractions
- Co-locate test files with components: `Button.tsx` + `Button.test.tsx`
