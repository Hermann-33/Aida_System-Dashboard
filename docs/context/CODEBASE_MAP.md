# Codebase Map

Updated: 2026-08-14

## Customer repository — `Hermann-33/Aida_System`

### Current customer runtime

- `apps/customer/android/app/src/main/AndroidManifest.xml` — production Android permissions, including required network access.
- `apps/customer/test/android_release_manifest_test.dart` — release-permission regression.
- `apps/customer/lib/data/repository/supabase_member_repository.dart` — customer account/member repository and trusted member/profile reads.
- `apps/customer/lib/data/cache/offline_member_cache.dart` — per-user minimum member-code cache only.
- `apps/customer/lib/data/repository/supabase_catalogue_repository.dart` — shared catalogue snapshot + revision invalidation.
- `apps/customer/lib/application/providers.dart` — customer account/member/catalogue/cart/order provider composition.
- `apps/customer/lib/features/menu/` — shared-catalogue menu/customization UI.

### Integrated customer ordering

- `apps/customer/lib/domain/model/order.dart` — schedule policy, selection payload, quote lines and persisted order snapshots/statuses.
- `apps/customer/lib/domain/repository/order_repository.dart` and `data/repository/supabase_order_repository.dart` — policy/quote/place/history/detail and owner-scoped order invalidation.
- `apps/customer/lib/application/order_checkout.dart` — schedule-slot derivation and retry-stable placement request IDs.
- `apps/customer/lib/features/cart/cart_screen.dart` and `order_checkout_sheet.dart` — local selection state, authoritative quote, ASAP/scheduled choice, Pay at counter and persisted placement.
- `apps/customer/lib/features/cart/order_confirmation_screen.dart` — persisted status presentation; no local progression timer.
- `apps/customer/lib/features/history/order_history_screen.dart` and `order_detail_screen.dart` — backend order history/detail.

### Canonical backend ownership

- `supabase/` — canonical migration/test workspace for both clients.
- `supabase/migrations/20260812182212_create_authoritative_orders_and_scheduling.sql` — order/schedule schema, RPCs, RLS and Realtime publication.
- `supabase/migrations/20260812183029_index_order_foreign_keys.sql` — order FK index hardening.
- `supabase/tests/auth_membership_integration.sql` — account/member regression.
- `supabase/tests/catalogue_integration.sql` — catalogue regression.
- `supabase/tests/order_integration.sql` — quote/schedule/idempotency/authorization/status regression.

## Dashboard repository — `Hermann-33/Aida_System-Dashboard`

### Trusted server boundaries

- `server/employeeBff.ts` — employee/management account/session and protected Members boundary.
- `server/catalogueBff.ts` — public/admin catalogue boundary.
- `server/orderBff.ts` — order policy/queue/detail/quote/place/status/admin-policy boundary.
- `server/viteBffPlugin.ts` — local Vite route mounting.
- `api/v1/**` — production/serverless adapters for the same server boundaries.

### Integrated Dashboard frontend

- `src/auth/ProtectedRoute.tsx`, `src/auth/employeeSession.ts`, `src/pages/AdminLoginPage.tsx` — protected management navigation/session UI.
- `src/features/admin/AdminMembersLoyaltyReportPage.tsx` + `memberDirectory.ts` — protected Members read; loyalty activity remains deferred/preview.
- `src/features/admin/AdminMenuPage.tsx` / `AdminMenuEditorPage.tsx` — shared catalogue management.
- `src/features/catalogue/catalogueClient.ts` and `src/features/pos/posCatalogue.ts` — shared catalogue browser contracts.
- `src/features/pos/CounterWorkspace.tsx` / `ModifierSheet.tsx` — POS selection/customization UI; TASK-CLOSEOUT-001 is replacing preview live-order authority with the existing order server boundary.

### Dashboard order closeout target

The existing order server endpoints already provide:

- ordering policy;
- live queue/detail;
- authoritative POS quote/place;
- versioned status transition;
- management schedule-policy update.

The remaining React integration must use those endpoints for final totals/order identity, scheduled pickup, live Orders rail and legal status controls. The employee browser boundary remains protected; the live order board uses short same-origin polling/refetch rather than weakening that architecture for direct privileged browser Realtime.

## Shared design constraint

Current closeout work is integration, not a redesign. Existing AIDA theme tokens, layout patterns, components and reviewed test/golden behavior remain the visual source of truth.

See `docs/context/CLOSEOUT_EVIDENCE_2026-08-14.md` for the dated validation snapshot and `docs/context/ROADMAP.md` for deferred domains.
