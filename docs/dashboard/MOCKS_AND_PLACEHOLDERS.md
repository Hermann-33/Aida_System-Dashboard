# POS/Admin Mocks and Placeholders Register

Updated: 2026-09-15

## Trusted live paths through Phase 6

Live backend integrations include employee/Admin sessions and branch assignments; catalogue/order quote/place/status; branches/sales points/terminals and enrolment; shifts/cash/reconciliation; branch pickup policy/hours/capacity; inventory/recipes/stock movements; Admin loyalty program/rewards/member support; and POS member/voucher lookup/placement.

## Allowed local browser state

Transient state may hold unsaved cart selections, quantity/note, local price estimate before quote, pickup/member/voucher selection intent, filters/dialog state, one retry-stable `clientRequestId`, and trusted status projections returned by APIs.

Local state is never authority for role/scope, terminal/shift identity, prices/totals/discount, schedule capacity, stock balance, loyalty balance, voucher status or persisted order attribution.

## Preview boundary

Explicit UI Preview may still demonstrate branches, terminals, employees, shifts, inventory, loyalty, payment and reports with fixtures. Live mode must never use preview identifiers or balances as fallback database/authorization/commercial truth.

## Forbidden fake authority in live mode

Do not use client-computed final totals/discounts, preview/local orders, fake payment success, local fulfilment progression, manufactured schedule slots, preview inventory sufficiency, preview loyalty balances/vouchers, or browser-stored employee/terminal secrets.

## Still deferred / placeholder

- employee Auth-user creation/role credential/badge-PIN lifecycle;
- generalized promotions/marketing campaign authority — Phase 7;
- trusted tax/accounting/reporting expansion — Phase 8;
- payment capture/refunds/processor settlement;
- printer/KDS/payment-device integrations;
- supplier/lot/expiry/procurement expansion;
- hosted/deployment-heavy production operations.

Phases 1–6 are `COMPLETE`; Phase 7 is next but not started.