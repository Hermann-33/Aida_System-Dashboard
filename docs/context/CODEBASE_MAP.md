# Codebase Map

Updated: 2026-08-14

## Customer repository — `Hermann-33/Aida_System`

### Existing identity/catalogue runtime

- `apps/customer/lib/data/repository/supabase_member_repository.dart` — Supabase Auth plus owner member/profile reads and minimum cached member-code fallback.
- `apps/customer/lib/data/cache/offline_member_cache.dart` — per-user durable member ID/code cache only; excludes roles, verification, loyalty and pricing authority.
- `apps/customer/lib/data/repository/supabase_catalogue_repository.dart` — live `get_catalogue()` snapshot and `catalogue_revision` stream.
- `apps/customer/lib/domain/repository/catalogue_repository.dart` — customer read-only catalogue capability.
- `apps/customer/lib/domain/model/catalogue_snapshot.dart`, `menu_variant.dart`, `menu_item.dart` — shared catalogue model.
- `apps/customer/lib/application/providers.dart` — Auth/member/catalogue/cart/provider composition.
- `apps/customer/lib/features/menu/` — DB-driven menu/item customization UI.

### Coordinated customer order frontend

The coordinated customer stack now contains authoritative quote/place, ASAP/scheduled pickup, history/detail and persisted status refresh integration. Exact customer file-level facts must be mirrored from the customer closeout branch; this dashboard checkout does not edit or independently re-audit that repository.

### Canonical Supabase ownership

- `supabase/migrations/20260812182212_create_authoritative_orders_and_scheduling.sql` — authoritative order/schedule schema, RPCs, RLS, Realtime publication.
- `supabase/migrations/20260812183029_index_order_foreign_keys.sql` — forward FK index hardening.
- `supabase/tests/order_integration.sql` — canonical transactional pricing/schedule/idempotency/authorization/status regression.
- earlier identity/catalogue migrations remain canonical in this repository only.

### Frontend integration references

- `docs/decisions/ADR-0010-authoritative-ordering-and-scheduled-fulfilment.md`
- `docs/contracts/ORDER_AND_SCHEDULING_CONTRACT.md`

## Dashboard repository — `Hermann-33/Aida_System-Dashboard`

### Existing trusted server boundaries

- `server/employeeBff.ts` — employee login/session/logout/Admin Members boundary with HttpOnly cookies and caller-JWT semantics.
- `server/catalogueBff.ts` — public/admin catalogue BFF.
- `server/viteBffPlugin.ts` — mounts BFF routes in Vite dev/preview.
- `api/v1/auth/*`, `api/v1/admin/members.ts`, catalogue adapters — production/Vercel route adapters.

### New order backend/BFF

- `server/orderBff.ts` — public schedule-policy plus authenticated employee order queue/detail/quote/place/status/admin-policy handlers.
- `server/orderBff.test.ts` — origin/session/caller-JWT/conflict/admin-policy contract coverage.
- `api/v1/orders/policy.ts` — public schedule policy.
- `api/v1/orders.ts` — employee order queue.
- `api/v1/orders/detail.ts` — employee order detail.
- `api/v1/orders/quote.ts` — authoritative POS quote.
- `api/v1/orders/place.ts` — idempotent POS placement.
- `api/v1/orders/status.ts` — versioned staff status transition.
- `api/v1/admin/orders/policy.ts` — admin-only schedule-policy mutation.

### Integrated dashboard order frontend

- `src/features/catalogue/catalogueClient.ts` and `src/features/pos/posCatalogue.ts` — shared catalogue browser contracts.
- `src/features/orders/orderClient.ts` — typed same-origin policy/quote/place/queue/detail/status adapter, selection-only payload mapping, schedule-slot generation, polling constants and legal transition table.
- `src/features/orders/OrderCheckoutPanel.tsx` — authoritative quote review, ASAP/scheduled selection, stable idempotent placement retry, Pay-at-counter wording and persisted receipt.
- `src/features/orders/OrderBoard.tsx` — live polled queue/detail and versioned legal status transitions with conflict refetch.
- `src/features/pos/CounterWorkspace.tsx` / `ModifierSheet.tsx` — shared-catalogue selection UI and local cart estimate; no preview order/tender authority in the active placement or Orders rail.
- existing Admin/POS navigation, cards, dialogs, badges, table/queue patterns and theme tokens are the visual design source for the live order board.
- existing preview cart/tender/order objects may remain only as temporary UI selection state where needed; they must not be persisted or displayed as trusted server totals/order status.

### Dashboard refresh model

The employee access token remains HttpOnly by design. React does not receive/expose a Supabase staff JWT for Realtime. The order board uses TanStack Query against `/api/v1/orders` at 2.5-second intervals with immediate invalidation after place/status mutations. Customer Flutter owns the direct owner-scoped `orders` Realtime subscription.

## Shared frontend design constraint

TASK-DEMO-ORDER-001 frontend work is an **integration, not a redesign**. Codex must inspect and reuse each application's existing theme tokens, typography, spacing, radii, shadows, cards, sheets/dialogs, buttons, status pills, responsive patterns and existing golden/UI tests before adding scheduled-pickup or order-status surfaces. Do not introduce a parallel design system or arbitrary styling.
