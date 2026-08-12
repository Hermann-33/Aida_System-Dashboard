# Active Context

**As of:** 2026-08-13
**Current implementation task:** `TASK-MENU-001 — shared catalogue/menu persistence and dual-client integration`
**Current task verdict:** PARTIAL

## Current product reality

Customer auth/member source from TASK-AUTH-001 is implemented but its final client/deployment validation remains deferred by user instruction. TASK-AUTH-002 dashboard BFF source also remains stacked/unmerged.

TASK-MENU-001 now adds the shared catalogue on top of that stack:

- live Supabase tables for categories, items, per-item variants, compatible add-ons, revision and audit evidence;
- 4 categories / 16 customer menu items / 27 variants / 27 add-on links seeded from the former customer hardcodes;
- customer Flutter runtime reads `public.get_catalogue()` and has no production menu fixture fallback;
- customer watches the singleton `catalogue_revision` Realtime signal and re-fetches the RLS-filtered snapshot after Admin changes;
- Admin Menu reads and writes the shared catalogue through the same-origin BFF using the administrator caller JWT;
- the POS sale browser reads the same public BFF snapshot for categories, products, publication/availability, base prices, per-item variants and compatible add-ons, with no preview-menu fallback;
- size deltas and add-on compatibility are database data; the old Dart `ItemSize` enum and runtime menu constants are removed;
- fake ratings/reward bonus values were not promoted to catalogue truth.

Live Supabase catalogue regression passes transactionally. Security advisor is 0 lints; performance advisor has only expected unused-index INFO on the new schema.

## Deliberately still preview

POS cart/order/payment transaction state and its checkout-specific preview wiring are not made authoritative by this menu task. Trusted quote/order pricing remains a separate backend task.

## Deferred validation debt

Dashboard `npm ci`, lint, strict typecheck, 85 Vitest tests, 6 preview Playwright tests and production build now pass. A local BFF configured with the real publishable key read revision 1 (4 categories, 16 published items, 27 variants) from Supabase; anonymous Admin Catalogue/Admin Members access and cross-origin mutation were rejected. The live project has zero Auth users/admins/staff/members and no linked AIDA Vercel project, so real admin writes, Auth E2E, deployed E2E and Flutter refresh evidence remain blocked. ADR-0004 therefore keeps the formal verdict `PARTIAL`.

## Next product task

First close `TASK-AUTH-003 — dashboard deployment, identity bootstrap and Auth/Menu cross-client E2E`; then proceed to `TASK-ORDER-001 — authoritative quote/cart/order foundation`.
