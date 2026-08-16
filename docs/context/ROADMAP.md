# Roadmap

Updated: 2026-08-17

## Current tranche

Implemented and validated to the current closeout standard:

- governance and shared-backend ownership;
- trusted identity/member foundation;
- customer Supabase Auth/member integration and physical signup;
- same-origin employee/Admin session boundary;
- protected Dashboard Members;
- shared catalogue, protected Admin mutation, POS/customer reads and customer revision refresh;
- TASK-AUTH-005 preview/live session separation;
- Android release networking and reproducible committed build toolchain;
- authoritative quote/order/schedule/status backend;
- customer authoritative quote/place/history/detail/status frontend;
- Dashboard authoritative POS quote/place and server-policy scheduling;
- Dashboard live polled order queue and versioned fulfilment transitions;
- customer and Dashboard full local toolchain/test/build gates for the implemented tranche.

## Current status

`TASK-CLOSEOUT-001`: **COMPLETE** for implementation and applicable ADR-0004 validation.

Live proof completed on 2026-08-17:

customer placement
→ persisted order
→ Dashboard observation
→ preparing
→ customer authorized refresh
→ ready
→ customer authorized refresh
→ completed
→ customer authorized refresh.

The retained evidence is order `100006` (`7cf027dc-3ff0-4604-a3fd-c7a943aac603`), authoritative total 1,290 sen, completed at status version 4. Approved demo credentials were process-local, were not committed and were removed after the run.

## Merge gate

Customer PR #13 and Dashboard PR #12 remain draft pending independent cross-repository mirror and final PR verification. The live order E2E no longer blocks merge readiness.

Hosted/Vercel deployment is **DEFERRED** for the accepted local-PC + cloud-Supabase + installed-phone demo topology.

## Security operations

Current Supabase security-advisor evidence has one WARN: leaked-password protection is disabled. Enabling it is hosted Auth configuration work and does not justify weakening application Auth/RLS boundaries.

## Deferred product domains

Do not start these during closeout:

1. trusted payment capture/refunds;
2. loyalty earning/redemption and voucher lifecycle;
3. inventory/recipes/depletion;
4. promotions/discount authority;
5. tax/accounting and trusted reporting;
6. branch-scoped staff/order visibility and branch hours/capacity;
7. delivery;
8. hosted production deployment, signing/distribution and operational release work.
