# Lint Remediation History

This document tracks every lint issue resolved during the current cleanup effort, along with the concrete approach used to remediate each warning or error. It covers work performed from the start of the engagement through the latest `pnpm lint` run on 2025-10-28.

## Summary

- ✅ Cleared all `@typescript-eslint/no-explicit-any` violations across admin, API, worker, and shared component layers by introducing concrete domain types and helper utilities.
- ✅ Addressed hook dependency warnings introduced during the type-safety refactor by memoising helpers or expanding dependency arrays only where behaviour remained stable.
- ✅ Hardened asynchronous UI flows (modals and camera utilities) by tightening promise handling and guarding unknown errors, satisfying lint and improving runtime resilience.
- ⚠️ Remaining warnings (primarily `@next/next/no-img-element` and a handful of hook dependency advisories in worker dashboards) are documented separately for the next pass.

## Detailed Fix Log

| File(s) | Original Lint Issue | Resolution Strategy | Key Artifacts |
| --- | --- | --- | --- |
| `app/admin/task-management/page.tsx` | `no-explicit-any` on task definition state and dialog payloads | Introduced `TaskDefinition`, `CustomTaskDefinition`, and a `ShiftDraft`-style union for optional photo categories. Updated state initialisers and dialog handlers to use the explicit types. | `app/admin/task-management/page.tsx` |
| `app/api/tasks/route.ts`, `app/api/tasks/[id]/*`, `app/api/workers/status/route.ts` | `no-explicit-any` on RPC payload construction and Supabase responses | Created DTO helper types, re-used `databaseUserToApp`, and cast Supabase rows via shared type guards. Replaced ad-hoc casts with typed transformation functions. | `lib/database-types.ts`, `lib/types.ts`, API route files |
| `lib/database-types.ts`, `lib/types.ts` | `no-explicit-any` in conversion tables and status maps | Introduced precise conversion helpers (e.g., `databaseTaskStatusToApp`) and extended enums with the new `"VERIFIED"` status so lookups remain exhaustive without fallbacks to `any`. | `lib/database-types.ts`, `lib/types.ts` |
| `app/worker/tasks/page.tsx` | `no-explicit-any` on task filter utilities and tab state | Defined `FilterOption` union, typed helper functions, and aligned date formatting imports to remove cast noise. | `app/worker/tasks/page.tsx` |
| `app/worker/[taskId]/page.tsx` | `no-explicit-any` for categorized photo state and pause history; later `react-hooks/exhaustive-deps` | Added `PhotoCategoryRequirement` alias, typed pause records, and expanded the photo sync effect to depend on the full `task` object, resetting local state when the task changes. | `app/worker/[taskId]/page.tsx` |
| `components/edit-task-definition-modal.tsx` | `no-explicit-any` on error handling and async save flow | Switched to `unknown` error typing, performed type narrowing before logging, and awaited the save mutation to maintain type guarantees. | `components/edit-task-definition-modal.tsx` |
| `components/photo-capture-modal.tsx` | `no-explicit-any` on captured photo handlers | Refined handlers to use concrete `string[]` state, introduced explicit `FileList` guards, and propagated errors as `unknown` with friendly messaging. | `components/photo-capture-modal.tsx` |
| `components/categorized-photo-capture-modal.tsx`, `components/camera-only-capture.tsx`, `components/simple-photo-capture.tsx` | `no-explicit-any` in camera/capture flows | Typed camera refs and upload progress values, ensuring capture pipelines surface predictable data without fallback casts. | respective component files |
| `components/task-verification-view.tsx`, `components/task-assignment-form.tsx`, `components/front-desk-active-task-modal.tsx` | `no-explicit-any` on task photo summaries and scheduling helpers | Extended shared domain types (`TaskWithLegacyPhoto`, `WorkerWithAvailability`) and refactored helper functions to rely on the strongly typed data model. | respective component files |
| `app/front-office/page.tsx` | `react-hooks/exhaustive-deps` on shift template effect after refactor | Wrapped `createShiftDraft`/`buildShiftTemplate` in `useCallback` and added the memo to the effect dependency list, preserving behaviour while satisfying the rule. | `app/front-office/page.tsx` |
| `app/front-office/shifts/page.tsx` | `react-hooks/exhaustive-deps` on normalisation helper | Memoised `normalizeShiftState` with `useCallback([])` and referenced it in dependent effects to avoid re-runs. | `app/front-office/shifts/page.tsx` |
| `app/front-office/shifts/dual-shift-ui.tsx` | `react-hooks/exhaustive-deps` due to derived `secondShiftEnabled` flag | Included `secondShiftEnabled` in the `useMemo` dependency array so the summary recalculates only when inputs change. | `app/front-office/shifts/dual-shift-ui.tsx` |
| `components/task-assignment-form.tsx` | `react-hooks/exhaustive-deps` after introducing time-zone aware shift options | Added `shiftOptions` to the memoised staff list dependency array to keep availability calculations stable. | `components/task-assignment-form.tsx` |
| `lib/use-realtime-tasks.ts` | `react-hooks/exhaustive-deps` and implicit `any` in subscription callback | Added the filter object to the `setupChannel` dependency list, annotated the Supabase `.subscribe` parameters, and trimmed redundant property deps flagged as unnecessary. | `lib/use-realtime-tasks.ts` |

## Techniques Applied

- **Type propagation across layers:** Whenever `any` surfaced, the surrounding data flow was traced back to shared domain definitions (`lib/types.ts`, `lib/database-types.ts`). We either extended those definitions or added DTO helpers so UI and API surfaces consumed strongly typed results.
- **Memoisation for hook compliance:** Functions that were recreated every render (e.g., shift builders, normalisers) were wrapped in `useCallback` and referenced via dependency lists to prevent stale closures without re-triggering effects.
- **Explicit dependency alignment:** For memoised arrays and computed values, dependency arrays now align with the actual inputs (`secondShiftEnabled`, `shiftOptions`). Where the dependency itself was a composite object, the object reference was memoised upstream or included directly.
- **Error handling hardening:** Async flows in modals convert unknown errors into user-friendly messages while keeping TypeScript satisfied via `unknown` narrowing, removing the need for `any` and reducing runtime surprises.
- **Targeted annotation:** Supabase realtime callbacks and other third-party handlers now carry explicit parameter types, eliminating implicit `any` warnings without altering logical behaviour.

## Outstanding Items

- The project still references raw `<img>` tags in camera previews, galleries, and verification views. Replacing them with `next/image` (with `unoptimized` enabled for data URLs) or documenting device-specific exceptions will clear the remaining `@next/next/no-img-element` warnings.
- A small set of hook dependency advisories in `app/worker/page.tsx` and `app/worker/profile/page.tsx` remain. These will be tackled once we confirm whether the additional dependencies alter analytics/logging behaviour.

## Verification

- Every remediation here was validated by running `pnpm lint` immediately after the change. The current lint output (2025-10-28) contains only the outstanding warnings noted above.
