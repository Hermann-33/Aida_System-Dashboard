# Active Context

**As of:** 2026-08-13
**Current implementation task:** `TASK-AUTH-003 — dashboard deployment, approved identity bootstrap, and deployed Auth/Menu E2E`
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

## TASK-AUTH-003 deployment attempt

Vercel project `aida-system-dashboard` (`prj_lOHi9DTbwLYRZRlBBrrnmfRTRfIn`) now exists in team `hermann-33s-projects`. Clean application deployment `dpl_FUniG8DnSkkKWJvhNjPNBWkdpT8W` built successfully, but `/api/v1/catalogue` returns 502 because the connected deployment boundary cannot configure project environment variables. A temporary diagnostic deployment proved `AIDA_SUPABASE_URL` and `AIDA_SUPABASE_PUBLISHABLE_KEY` are absent at runtime; it was superseded by the clean application deployment. No service-role key was requested, exposed or shipped.

The live Supabase baseline remains unchanged: zero Auth users/profiles/members/admins/staff; catalogue revision 1 with 4 categories, 16 items, 27 variants and 27 add-on links. Identity creation and all catalogue mutations were deliberately skipped rather than manufacturing credentials or leaving partial test data. Deployed Auth/Menu E2E and negative-role browser evidence therefore remain open, so ADR-0004 keeps the verdict `PARTIAL`.

Dashboard `npm ci`, lint, strict typecheck, 19 Vitest files / 85 tests, 6 preview Playwright tests, production build and `git diff --check` pass. Lint retains two pre-existing Fast Refresh warnings; build retains the existing chunk-size warning. `npm audit` reports 5 known dependency findings (1 moderate, 4 high); package upgrades were not mixed into this deployment/E2E boundary task.

## Next product task

An operator must configure the two publishable Supabase variables in Vercel Preview (and Production if promoted), redeploy, and provide approved test identities through a secure channel or create them through Supabase Auth administration. Then resume this same task for deployed Auth/Menu/role E2E and reversible cleanup. Do not start `TASK-ORDER-001` until these gates close.
