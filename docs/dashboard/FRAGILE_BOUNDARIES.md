# POS/Admin Fragile Boundaries

Updated: 2026-09-15

## Session and secrets

- React route guards are presentation only; BFF + Supabase authorize.
- Employee access/refresh and terminal credential must remain HttpOnly.
- Never place reusable employee/terminal secrets in React state, storage, URLs or logs.
- No normal Dashboard flow may substitute service-role authority for caller JWT authority.

## Topology and shift

- Browser branch/sales-point/terminal IDs never replace terminal credential resolution.
- Ordinary staff branch scope comes from trusted assignments and fails closed.
- New POS orders require a matching open shift; lock/close blocks new placement.
- A matching persisted retry may resolve after lock/close but must not weaken current employee/terminal validation or create a second order.
- Cash expected value/variance remains server-derived; cash ledger history remains append-oriented.

## Scheduling/inventory

- Do not manufacture hours, slots, capacity or `prepareAt` locally.
- Quote inventory is a sufficiency check, not reservation.
- Placement inventory consumption is the authoritative non-negative transaction.
- Preview stock/recipe IDs must never become live authority.

## Loyalty/voucher

- Client points/stamps/reward eligibility/voucher status are display state only.
- POS member lookup requires employee + server-held terminal + open shift.
- `memberCode`/`voucherId` are intent; the server derives eligibility and discount.
- Changing member/voucher intent must invalidate an earlier trusted quote.
- Voucher consumption must remain atomic with accepted order creation and accepted discount snapshots immutable.
- Admin support adjustments must retain actor + reason and cannot accept client-authored resulting balances.

## Privacy

Whole-account deletion must continue deleting customer-owned loyalty state and detaching identifiers from retained commercial snapshots without weakening staff/POS audit history.

## Preview boundary

`src/preview/` remains demonstration-only. No preview employee, topology, shift, inventory, loyalty, payment or reporting value may authorize a live API or become persisted business truth.

## Deferred high-risk domains

General promotions/discounts, reporting/accounting, payment capture/refunds/settlement, employee credential lifecycle, hardware integrations and deployment-heavy production work remain later phases.