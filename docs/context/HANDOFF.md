# Current Handoff

Updated: 2026-08-13

## Current task

`TASK-MENU-001 — shared catalogue/menu persistence and dual-client integration`

**Verdict:** PARTIAL because deployment/account-dependent cross-client validation is still unavailable.

Branch in both repos: `codex/task-menu-001-shared-catalogue`, stacked on TASK-AUTH-002.

## Implemented

- Live Supabase catalogue with forced RLS, audit evidence and Realtime revision signal.
- Seeded the exact 16 customer menu items that were previously hardcoded, including original prices/availability/images/flags.
- Moved Small/Medium/Large deltas into 27 per-item variant rows and drink add-on compatibility into 27 normalized links.
- Customer `CatalogueRepository` reads `get_catalogue()`; no production mock fallback exists.
- Flutter watches `catalogue_revision` and re-fetches after Admin writes.
- Admin Menu list/category creation/item editor now read/write shared DB data through BFF caller-JWT RPCs.
- POS sale browsing/configuration consumes shared categories, products, availability, publication, base prices, per-item variants and compatible add-ons; it does not fall back to `PREVIEW_MENU`.
- Old customer runtime menu constants and `ItemSize` enum removed.
- Fake rating/bonus-points catalogue presentation removed rather than persisted.
- Dashboard `npm ci`, lint, typecheck, 85 Vitest tests, 6 preview Playwright tests and build pass.
- A live local BFF read revision 1 with 4 categories, 16 published items and 27 variants; anonymous Admin endpoints, cross-origin mutation and a simulated authenticated non-admin catalogue mutation were rejected.

## Remaining blockers

- Flutter analyzer/tests.
- Deployed Admin edit -> revision -> customer Flutter refresh E2E.
- Auth signup -> provisioning -> real Admin Members E2E.
- Live availability/publication/temp-item/variant/add-on mutation and cleanup evidence.
- Supabase has zero Auth users/admins/staff/members; the Vercel team has no linked AIDA dashboard project.

## Non-goal retained

Dashboard POS cart/order/totals/payment still use preview/local transaction state. Shared catalogue display does not make those values trusted.

## Next product task

`TASK-AUTH-003 — dashboard deployment, identity bootstrap and Auth/Menu cross-client E2E`.
