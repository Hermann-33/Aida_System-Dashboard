# Roadmap

Updated: 2026-08-14

## Current tranche

Implemented:

- trusted identity/member provisioning and live Admin Members;
- same-origin HttpOnly employee/Admin BFF;
- shared catalogue read/Admin mutation and revision invalidation;
- preview/live session separation (TASK-AUTH-005);
- authoritative quote/order/schedule/status backend;
- customer authoritative order frontend on the coordinated customer stack;
- dashboard authoritative POS quote/place, ASAP/scheduled pickup, live polled order queue and versioned fulfilment transitions;
- Android release INTERNET/network fix and physical signup/member validation;
- physical Owner catalogue mutation → installed-phone refresh validation.

The remaining TASK-CLOSEOUT-001 gate is a fresh supported customer placement → Dashboard observation/transitions → customer authorized status refresh using approved account credentials. Source and test code must not manufacture or commit those credentials.

## Deployment

Hosted/Vercel deployment is **DEFERRED** operational debt. It is not a blocker for the accepted local-PC + cloud-Supabase + installed-phone tranche and must not be labelled complete without direct deployment evidence.

## Security operations

Enable Supabase Auth leaked-password protection through the hosted project configuration when operational ownership permits. Current security advisor state is one WARN: `auth_leaked_password_protection`.

## Deferred product domains

Do not start these during closeout:

- trusted payment capture/refunds;
- loyalty earning/redemption;
- inventory depletion;
- promotions/discount engine;
- tax/accounting and revenue reporting;
- delivery;
- branch opening hours, capacity and branch-scoped order queues.
