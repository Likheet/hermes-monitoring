# Guidance for AI coding agents — hermes-monitoring

Short, concrete notes to help an AI be productive in this repo.

- Project type: Next.js (App Router, Next 15) TypeScript React app with Tailwind + PWA.
- Primary runtime: client-heavy app using React Context for state and mock data. Server integrations (Supabase) are present but optional/mocked.

Key concepts and where to look
- App entry & layout: `app/layout.tsx` — wraps `AuthProvider`, `TaskProvider`, `StorageCleaner`, `ErrorBoundary`. Use these providers when adding cross-cutting features.
- Routing: App Router under `app/` (e.g., `app/page.tsx`, `app/admin`, `app/worker`, `app/supervisor`). Follow directory-based routing conventions.
- Client-only logic and auth: `lib/auth-context.tsx` and `components/protected-route.tsx` — authentication is currently mocked via `localStorage` (see `userId` key). Don’t add server-side auth checks unless also updating middleware and Supabase wiring.
- Global state & domain logic: `lib/task-context.tsx` — contains most business logic (task lifecycle, pause/resume, localStorage persistence). Prefer editing here for behaviour changes; it also toggles Supabase realtime with `isRealtimeEnabled`.
- Supabase wiring: `lib/supabase/client.ts` — factory that uses env vars NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Realtime support is wired in `task-context.tsx` and `lib/use-realtime-tasks.ts` but disabled by default.
- Mock data: `lib/mock-data.ts` — primary source for initial users/tasks. Useful for local dev and unit tests.
- PWA: `next.config.mjs` + `components/pwa-install-prompt.tsx` + `@ducanh2912/next-pwa` usage. PWA caching rules include Supabase endpoints; keep these in mind when modifying network code.

Developer workflows & commands
- Dev: `pnpm install` (repo uses pnpm lockfile) then `pnpm dev` (script is `next dev`). package.json scripts: `dev`, `build`, `start`, `lint`.
- Build: `pnpm build` runs `next build`. `next.config.mjs` disables TypeScript/ESLint build-time errors (ignoreDuringBuilds / ignoreBuildErrors are true) — be careful: type/lint issues may be present but not blocking CI.
- Environment: Supabase requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` if enabling realtime or server features. Local dev can run without them due to mock data.

Project-specific conventions and patterns
- Mock-first: Many flows assume mock data + localStorage (see `TaskProvider`). When enabling real DB, toggle `isRealtimeEnabled` and ensure migrations + env are present.
- Single source of truth for domain logic: prefer `lib/task-context.tsx` over scattering complex task logic across components. Components are mostly UI-only and read from context.
- Client-only components: Many files use `"use client"` at the top (e.g., contexts, pages that read router/client hooks). Avoid moving heavy logic to server components unless you also adapt contexts/providers.
- Local storage keys: `userId`, `maintenance_schedules`, `maintenance_tasks`, `shift_schedules`, `pwa-install-dismissed`. Tests or changes should consider these keys.
- Routing + role redirects: `app/page.tsx` redirects based on `user.role` (worker/supervisor/front_office/admin). Keep redirects consistent with role strings in `lib/types.ts` and `mock-data.ts`.

Integration and extension notes (quick examples)
- Enable Supabase realtime: set env vars and change `isRealtimeEnabled` in `lib/task-context.tsx` to true. Realtime subscription code is in `task-context.tsx` and `lib/use-realtime-tasks.ts`.
- Add a global audit: wrap or extend `addAuditLog` in `lib/task-context.tsx` — UI components (e.g., `components/task-card.tsx`) read audit-derived fields, but primary writes should go through the context API.
- Add server API routes: use `app/api/` for Next.js handlers. If you add server handlers that touch Supabase, prefer the `createClient()` from `lib/supabase/client.ts`.

Files to reference when implementing changes
- app/layout.tsx — provider composition and fonts
- lib/task-context.tsx — domain logic, localStorage, realtime toggle
- lib/auth-context.tsx — mock auth via localStorage
- lib/mock-data.ts — baseline data model
- lib/supabase/client.ts — supabase client factory
- components/protected-route.tsx — role-based client redirects
- next.config.mjs — PWA config & image settings

Testing and safety notes for AI agents
- Make minimal changes to domain logic without running the app — prefer small unit-testable edits and update mock-data accordingly.
- Respect `"use client"` boundaries; moving components between client/server may break hooks (useRouter, localStorage, etc.).
- When touching caching or PWA settings, keep existing runtimeCaching entries for Supabase endpoints to avoid offline regressions.

If anything in this doc is unclear or you want more examples (component patterns, specific domain functions), tell me what area to expand and I will iterate.
