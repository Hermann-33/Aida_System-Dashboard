# Roadmap

Updated: 2026-08-13

## Completed foundations

- WF governance/import tasks: COMPLETE.
- DB-001 identity/member foundation: COMPLETE for scoped DB foundation.

## Auth/member

Source implementation exists across customer + dashboard BFF, but final validation/deployment E2E remains deferred. Formal status: PARTIAL under ADR-0004.

## Shared catalogue — TASK-MENU-001

Implemented:
- authoritative Supabase catalogue schema + RLS/audit/revision;
- former customer hardcoded 16-item menu seeded live;
- Flutter reads the shared catalogue and responds to revision invalidation;
- Admin Menu creates/updates shared categories/items/variants/add-on compatibility through caller-JWT BFF;
- dashboard POS browses/configures the same shared categories/items/availability/base prices/variants/compatible add-ons without a preview fallback;
- production customer menu hardcodes and `ItemSize` removed.

Dashboard install/lint/typecheck/85 Vitest tests/6 preview Playwright tests/build and live public-BFF/security checks pass. Real admin/customer/staff identities and an AIDA deployment are absent, so deployed Auth E2E, Admin mutation/revision/cleanup, and Flutter refresh evidence remain open. Formal status remains PARTIAL.

## Next product phase

`TASK-AUTH-003 — dashboard deployment, approved identity bootstrap, and deployed Auth/Menu E2E` is in progress. The Vercel project exists and a source deployment builds, but its runtime lacks the required publishable Supabase environment variables and no approved test identities exist. After an operator configures the project and identities, resume deployed Auth/Menu/negative-role E2E and cleanup. Only then should `TASK-ORDER-001` establish server-owned pricing validation, quote/order IDs, idempotency and legal order transitions.
