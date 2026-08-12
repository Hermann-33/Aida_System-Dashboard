# Current Handoff

Updated: 2026-08-13

## Current task

`TASK-AUTH-003 — dashboard deployment, approved identity bootstrap, and deployed Auth/Menu E2E`

**Verdict:** PARTIAL because the Vercel project exists and builds, but runtime environment configuration and approved identities require operator action.

Dashboard branch: `codex/task-auth-003-deployed-e2e`, stacked on `codex/task-menu-001-shared-catalogue` at `238e0ff211fe550f42ec4d4423724e3642282295`. Customer validation commit remains `7c7d91c2e3cf07e319dce1881c1322525881584f`; this task did not modify that repository.

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

## Deployment evidence

- Vercel project: `aida-system-dashboard` / `prj_lOHi9DTbwLYRZRlBBrrnmfRTRfIn`.
- Current clean application deployment: `dpl_FUniG8DnSkkKWJvhNjPNBWkdpT8W` (`READY`).
- Runtime request: `/api/v1/catalogue` returned 502.
- A temporary diagnostic deployment reported both required environment variables absent and was then superseded by the clean application deployment.
- Attempting to pass environment values in deployment payloads did not configure the project; the available connector has no project-environment mutation operation.
- No browser/service-role secret was used. No identity or catalogue data was changed.

## Exact operator handoff

1. Open `https://vercel.com/hermann-33s-projects/aida-system-dashboard/settings/environment-variables`.
2. Add `AIDA_SUPABASE_URL=https://eswovqxqzfevcdwwcmuh.supabase.co` and the active `AIDA_SUPABASE_PUBLISHABLE_KEY` to Preview; add them to Production only if production promotion is intended.
3. Redeploy the task branch. Allow test-browser access to the protected preview (share/bypass access or an approved protection setting).
4. Supply approved customer/admin/staff test emails and operator-owned passwords via a secure channel, or create confirmed users through Supabase Auth administration. Promote admin/staff only through the trusted operator/database boundary; never expose public role self-assignment.
5. Resume TASK-AUTH-003 to run Auth E2E, member-directory/disabled-employee gates, Menu edit/revision/Flutter refresh tests, negative authorization tests, and cleanup.

## Remaining gates

- Deployed Admin edit -> revision -> customer Flutter refresh E2E.
- Auth signup -> provisioning -> real Admin Members E2E.
- Live availability/publication/temp-item/variant/add-on mutation and cleanup evidence.
- Supabase still has zero Auth users/admins/staff/members.
- Runtime Vercel environment configuration and approved test identities are unavailable to this automation boundary.

## Non-goal retained

Dashboard POS cart/order/totals/payment still use preview/local transaction state. Shared catalogue display does not make those values trusted.

## Next product task

Resume `TASK-AUTH-003` at the operator handoff above. After all ADR-0004 gates pass, the next product task is `TASK-ORDER-001 — authoritative quote/cart/order foundation`.
