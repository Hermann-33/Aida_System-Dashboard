# POS/Admin State and Data Flow

Updated: 2026-09-15

## Trusted employee/terminal boundary

```text
employee login -> same-origin BFF -> Supabase Auth + trusted role/branch scope
 -> HttpOnly access/refresh cookies
terminal enrolment -> server validation -> HttpOnly terminal credential
```

React receives identity/status projections, not reusable bearer/terminal secrets.

## Shift and POS boundary

```text
employee + terminal credential
 -> current/open shift BFF/RPC
 -> open | lock | resume | close / cash movements
 -> live POS quote/place
```

New POS placement requires an open shift. Matching `clientRequestId` retries may resolve a persisted order after the original shift locks/closes only under current terminal/caller authority.

## Scheduling and inventory

Admin branch pickup configuration uses trusted BFF/RPCs. POS/customer quote consumes server branch schedule/capacity and inventory sufficiency. Placement is final inventory authority and performs transactional non-negative depletion. Dashboard Inventory uses live branch stock and recipe RPCs; Preview inventory is separate.

## Loyalty Admin flow

```text
Admin/Owner browser
 -> same-origin loyalty BFF
 -> caller JWT
 -> loyalty admin/program/reward/member-support RPCs
 -> server-owned balances/config/rewards
```

Adjustment results are server-derived and record actor/reason.

## POS member/voucher flow

```text
employee session + HttpOnly terminal credential + open shift
 -> POS member-code lookup BFF
 -> minimal trusted wallet/voucher projection
 -> optional memberCode/voucherId intent
 -> authoritative quote
 -> authoritative place
 -> atomic voucher consumption + immutable discount snapshot
```

Changing/removing the selected member or voucher invalidates the previous trusted quote.

## Order/status propagation

Dashboard list/detail/status uses BFF caller-JWT requests and trusted branch scope. Status mutations require legal transition + `statusVersion`. Customer Realtime remains invalidation followed by authorized refetch; Dashboard does not expose employee JWT for browser Realtime.

## Preview boundary

Preview staff/topology/shift/inventory/loyalty/payment/reporting values are demonstration-only. They cannot authorize live APIs or become database foreign keys/commercial state.

## Validation

Dashboard CI #126 passed lint, typecheck, unit tests, blocking live-POS browser authority regression and production build. Backend #190 and customer #281 are also complete.