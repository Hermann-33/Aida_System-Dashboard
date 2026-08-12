# Codebase Map

Updated: 2026-08-13

## Customer

- `lib/data/repository/supabase_catalogue_repository.dart` — live catalogue snapshot + revision stream.
- `lib/domain/repository/catalogue_repository.dart` — customer read-only catalogue capability.
- `lib/domain/model/catalogue_snapshot.dart`, `menu_variant.dart`, `menu_item.dart` — backend catalogue contract.
- `lib/application/providers.dart` — one catalogue snapshot feeds featured/categories/popular/menu providers.
- `lib/features/menu/` — renders DB variants/add-ons/prices.
- `lib/domain/model/item_size.dart` — removed.
- `mock_member_repository.dart` — no runtime menu data.
- `test/support/test_catalogue_repository.dart` — test-only fixture; never production fallback.
- `supabase/migrations/20260812231500_create_shared_catalogue.sql` and `20260812235000_harden_catalogue_rls_policies.sql` — canonical catalogue schema.
- `supabase/tests/catalogue_integration.sql` — RLS/mutation/revision/audit regression.

## Dashboard

- `server/config.ts` — server-only loader for `AIDA_SUPABASE_URL` and the publishable key; rejects missing configuration without exposing values.
- `server/authBff.ts` / `server/employeeSession.ts` — same-origin employee Auth BFF and HttpOnly cookie session contract.
- `api/v1/auth/*` / `api/v1/admin/members.ts` — Vercel function adapters for login/session/refresh/logout and Admin Members.
- `server/catalogueBff.ts` — public/admin catalogue handlers using publishable key or validated caller JWT.
- `api/v1/catalogue.ts` and `api/v1/admin/catalogue*` — deployment adapters.
- `src/features/catalogue/catalogueClient.ts` — browser contracts.
- `AdminMenuPage.tsx` / `AdminMenuEditorPage.tsx` — live DB management.
- `src/features/pos/posCatalogue.ts` — maps the shared snapshot into POS category/product/variant/compatible-add-on presentation.
- `src/features/pos/CounterWorkspace.tsx` / `ModifierSheet.tsx` — shared catalogue browsing/configuration; cart/order/payment remains preview and untrusted.
- `server/catalogueBff.test.ts` — BFF authorization contract tests.
- `AdminMenuFlows.test.tsx`, `posCatalogue.test.ts`, `CounterWorkspace.test.tsx` — Admin payload and POS shared-catalogue coverage.

POS order, total, checkout and payment preview remain separate from catalogue authority.

## Deployment

- Vercel project `aida-system-dashboard` builds the Vite client and eight Node functions from the existing adapters.
- Runtime requires project-scoped `AIDA_SUPABASE_URL` and `AIDA_SUPABASE_PUBLISHABLE_KEY`; neither belongs in the Vite bundle.
- TASK-AUTH-003 clean preview deployment is built but the BFF is blocked until an operator configures those project variables.
