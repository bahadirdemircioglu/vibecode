---
name: mobile
description: "Mobile development patterns for React Native (Expo) and Flutter projects. Use when writing mobile app code, configuring Expo, or working with React Navigation / Go Router."
---

# Mobile Development Skill

## Framework Selection Criteria

| Choose | When |
|--------|------|
| React Native (Expo) | Team knows React/TypeScript, sharing code with web frontend, rapid prototyping |
| Flutter | Performance-critical UI, custom animations, no existing web codebase to share with |

Default to **React Native (Expo)** when the project already has a React web frontend.

## React Native / Expo Patterns

### File Structure

```
mobile/
├── app/                        # Expo Router file-based routes (preferred)
│   ├── (tabs)/                 # Tab navigator group
│   ├── (auth)/                 # Auth flow group
│   └── _layout.tsx             # Root layout
├── components/                 # Reusable UI components
│   ├── ui/                     # Primitives (Button, Input, Card)
│   └── [feature]/              # Feature-specific components
├── hooks/                      # Custom React hooks
├── services/                   # API client, storage, notifications
├── store/                      # Zustand stores
├── types/                      # TypeScript types
│   └── api.generated.ts        # AUTO-GENERATED — never edit manually
├── utils/                      # Pure utility functions
├── constants/                  # Theme, config, feature flags
├── assets/                     # Images, fonts
├── app.json                    # Expo config
└── package.json
```

### Workflow

- Use **Expo managed workflow** — avoid ejecting unless native modules require it.
- Use **Expo Router** for file-based routing (preferred over React Navigation direct).
- When React Navigation is used directly: Stack, Tab, Drawer navigators only.
- Use **expo-dev-client** for custom native modules instead of ejecting.

### State Management

- **Zustand** for client state (same patterns as web frontend).
- **TanStack Query** for server state (same query keys and patterns as web).
- Share query key factories between web and mobile when possible.

### Platform-Specific Code

- Use `.ios.tsx` / `.android.tsx` suffixes for platform-divergent components.
- Use `Platform.select()` for minor style differences.
- Keep platform-specific code under 10% of total codebase.

### Shared Types with Web

- Import from `@shared/types` or use the same `api.generated.ts` from OpenAPI spec.
- Never duplicate API response types between web and mobile.
- Use a shared package or monorepo workspace for type definitions.

### Styling

- Use **StyleSheet.create()** or **Nativewind** (Tailwind for RN).
- Design tokens (colors, spacing, typography) shared with web via constants file.
- No inline style objects in render — always extract to StyleSheet.

## Flutter Patterns (Brief)

### State & Architecture

- **Riverpod** for dependency injection and state management.
- **Go Router** for declarative routing.
- **Freezed** for immutable data classes and union types.
- **Dio** for HTTP client with interceptors.

### File Structure

```
lib/
├── features/                   # Feature-first organization
│   └── [feature]/
│       ├── data/               # Repositories, data sources
│       ├── domain/             # Models, use cases
│       └── presentation/       # Screens, widgets, providers
├── core/                       # Shared utilities, theme, routing
└── main.dart
```

### Code Generation

- Run `build_runner` for Freezed, Riverpod generators, and JSON serialization.
- Generated files use `.g.dart` / `.freezed.dart` suffixes — never edit manually.

## Shared Code Strategy

- **OpenAPI types**: Generate types for both web and mobile from the same spec.
- **API client**: Mirror the web API client structure; share query keys if monorepo.
- **Design tokens**: Export theme values (colors, spacing) to a shared JSON/TS file.
- **Validation rules**: Share Zod/Yup schemas or replicate server-side validation.

## Testing

| Framework | Tool | Scope |
|-----------|------|-------|
| React Native | Jest + React Native Testing Library | Unit / component tests |
| React Native | Detox | E2E on device/simulator |
| Flutter | flutter_test | Unit / widget tests |
| Flutter | integration_test | E2E on device/emulator |

- Mock API calls with MSW (RN) or Mockito (Flutter).
- Test on both platforms in CI before release.

## Anti-Patterns

- Do NOT use platform-specific native modules unless Expo/managed alternatives are exhausted.
- Do NOT duplicate API types manually — always generate from OpenAPI spec.
- Do NOT eject from Expo managed workflow without explicit approval.
- Do NOT use Redux or MobX — use Zustand + TanStack Query for consistency with web.
- Do NOT write platform-specific code when a cross-platform solution exists.
- Do NOT skip testing on one platform — both iOS and Android must be verified.
- Do NOT store secrets in app code or app.json — use environment config (expo-constants).
- Do NOT ignore large bundle sizes — monitor with `npx expo export` analysis.
