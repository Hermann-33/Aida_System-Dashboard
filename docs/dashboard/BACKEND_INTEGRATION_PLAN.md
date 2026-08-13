# POS/Admin Backend Integration Plan

Updated: 2026-08-14

## Current local-demo boundary

The validated topology is local Dashboard PC -> cloud Supabase -> installed Android customer app. Trusted Owner/Admin/Staff identities now exist.

Privileged Dashboard requests use the existing same-origin BFF with HttpOnly employee session cookies. The BFF validates trusted profile role/disabled state and calls Supabase as the current employee. Browser code must not receive privileged server credentials or persist employee bearer tokens.

A historical Vercel deployment exists, but its hosted BFF runtime was not completed. Hosted deployment remains deferred operational work for this closeout.

## Members — integrated and validated

Admin/owner Members uses `/api/v1/admin/members` through the protected BFF/RLS path. Preview mode does not fabricate privileged member data.

A physical Android signup created a trusted customer/member that appeared in Dashboard Members.

## Catalogue — integrated and validated

Admin Menu uses the shared catalogue BFF for management. POS browsing uses the same published categories/items/availability/prices/variants/add-ons. There is no runtime preview-catalogue fallback.

A real Owner changed a catalogue price and the installed Android customer app observed the updated value.

## Preview/live session separation — integrated

TASK-AUTH-005 is complete for its bounded regression:

- preview identity remains local/non-authoritative;
- live session failures no longer destroy preview identity;
- preview Members performs no privileged member read;
- preview Menu uses the public catalogue read-only;
- real employee session expiry still clears real session state.

## Ordering — server/BFF implemented, React closeout work remains

Existing endpoints:

- `GET /api/v1/orders/policy`
- `GET /api/v1/orders`
- `GET /api/v1/orders/detail?id=<uuid>`
- `POST /api/v1/orders/quote`
- `POST /api/v1/orders/place`
- `POST /api/v1/orders/status`
- `POST /api/v1/admin/orders/policy`

### Required POS integration

1. Keep cart/customization as selection state only.
2. Send catalogue item/variant/add-on IDs, quantities, notes and fulfilment intent—not trusted prices/totals/order state.
3. Offer ASAP / Schedule for later using server policy.
4. Render `/api/v1/orders/quote` as the authoritative line/subtotal/total result.
5. Reuse one `clientRequestId` for retries of the same intended placement.
6. Use `/api/v1/orders/place`; persisted order number/total/schedule/status come from the response.
7. Clear the sale only after successful persistence and retain it on failure.
8. Current POS placement is guest-order only; do not invent member attachment from preview state.

### Live Orders rail

Live mode must use `/api/v1/orders`, not `PREVIEW_TRANSACTIONS`, for Scheduled/Confirmed/Preparing/Ready state and terminal history where appropriate.

Status actions call `/api/v1/orders/status` with the current `statusVersion` as `expectedVersion`. A version conflict must refetch instead of overwriting newer state.

### Refresh model

Employee tokens remain HttpOnly. React therefore uses same-origin BFF polling/refetch rather than direct privileged Supabase Realtime:

- short 2–3 second refetch while the board is active;
- immediate invalidation after place/status mutation;
- focus/reconnection refresh where supported.

Customer Flutter can use its owner-scoped Supabase session for order invalidation/refetch.

## Scheduling policy

Current backend defaults:

- timezone `Asia/Kuala_Lumpur`
- 15-minute minimum lead
- 15-minute slots
- 7-day maximum advance

Branch opening hours/closures/capacity are not modeled and must not be implied by the UI.

## Payment boundary

No trusted payment processor exists. The authoritative demo order path is explicit **Pay at counter / unpaid**. Fulfilment completion is not evidence of payment settlement.

## Closeout checks

After React order integration run:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- focused quote/place/queue/status/version-conflict tests
- `git diff --check`
- production secret/token scans

Final tranche E2E must prove customer authoritative placement -> persisted order -> Dashboard transition -> customer authorized status refresh. Dated evidence is in `docs/context/CLOSEOUT_EVIDENCE_2026-08-14.md`.
