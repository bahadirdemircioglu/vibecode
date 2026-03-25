---
name: vue-expert
description: "Vue.js 3 development patterns with Composition API, TypeScript, Pinia, Vue Router, and Vite. Use when writing Vue components, composables, or Vue-based frontend code."
---

# Vue.js 3 Expert Skill

## Version
Vue 3.4+ / TypeScript / Composition API / Pinia / Vue Router 4

## Rules

### Core
- **Composition API only** — no Options API in new code
- **`<script setup lang="ts">`** — default for all SFCs
- TypeScript strict mode, no `any`
- Use `defineProps<T>()` and `defineEmits<T>()` with type-only declarations
- Use `ref()` for primitives, `reactive()` for objects — never mix
- `computed()` for derived state — never store derived values in `ref()`
- `watch()` with explicit sources — never watch entire reactive objects
- `toRefs()` when destructuring reactive objects to maintain reactivity

### File Structure
```
src/
├── components/          # Reusable UI components (PascalCase.vue)
├── pages/               # Route-level views
├── composables/         # useXxx() hooks (camelCase)
├── stores/              # Pinia stores
├── api/                 # API client + typed endpoints
├── types/               # TypeScript interfaces
├── router/              # Vue Router config
└── utils/               # Pure utility functions
```

### Pinia Stores
- One store per domain (useUserStore, useAuthStore)
- Use `defineStore()` with setup syntax for TypeScript
- Actions are async, getters are computed
- Never access `$patch` from components — use actions

### Vue Router
- Lazy load all route components: `() => import('./pages/Xxx.vue')`
- Navigation guards in `router/guards.ts`, not in components
- Use `useRoute()` and `useRouter()` composables, not `this.$route`

### API Layer
- Composables for API calls: `useUsers()`, `useAuth()`
- Use VueQuery (TanStack Query for Vue) or custom composables with `ref` + `watchEffect`
- Auto-generated types from OpenAPI — never write API types manually

### Testing
- Vitest + Vue Test Utils
- Mount with `mount()`, not `shallowMount()` (test real behavior)
- Test composables with `renderHook` pattern

## Anti-patterns
```
❌ Options API (data, methods, computed, watch)
❌ Mixins — use composables instead
❌ this.$refs for component communication — use props/emits/provide-inject
❌ Global event bus — use Pinia or provide/inject
❌ Mutating props directly
❌ v-html with user input (XSS risk)
❌ Watchers that could be computed properties
❌ Store logic inside components — extract to composables or stores
```
