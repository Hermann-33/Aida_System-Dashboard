> Scope note: this map describes the current customer Flutter runtime, even when read from the mirrored Dashboard repository.

# Customer UI Screen Map

Updated: 2026-08-14

| Surface | Purpose | Current authority/status |
|---|---|---|
| Account gate and entry | restore/create customer session | Supabase customer session; Android runtime physically validated |
| Account recovery request | request account recovery | Supabase request boundary; delivery/callback not separately closed |
| App shell | customer navigation | local presentation state |
| Home | categories/featured/promos | shared catalogue plus deferred promo/loyalty presentation |
| Rewards | rewards/vouchers | preview/deferred loyalty |
| Membership QR | customer member code | owner-scoped member read + minimum per-user offline member-code cache |
| Menu | browse/filter/favorites | shared Supabase catalogue + revision invalidation; local favorites |
| Item detail | variant/add-ons/note/quantity | shared catalogue + local selection state |
| Cart | edit intended selections | local intent/estimate only; not commercial authority |
| Order checkout | quote, ASAP/scheduled pickup, Pay at counter, placement | ordering policy + authoritative quote/place RPCs |
| Order confirmation | persisted order identity/status | backend order snapshot; no fake status timer |
| Order history | customer orders | backend customer-order snapshots |
| Order detail | immutable placed-order detail | backend order snapshot |
| Profile | member/account presentation | trusted member read plus deferred profile features |
| Edit profile | profile-edit UI | trusted persistence not complete |

## Validated cross-system evidence

- Physical Android customer creation succeeded and the trusted member appeared in Dashboard Members.
- A real Owner catalogue price change in Dashboard Admin Menu propagated to the installed customer Menu.
- The Android release networking failure from TASK-AUTH-006 is closed.

## Boundaries still deferred

Local cart arithmetic may be an estimate, but final quote/total/order number/schedule/status come from the backend. No trusted payment processor exists; the authoritative demo order path is Pay at counter / unpaid.

Loyalty/rewards/offers/promotions, social providers, notifications, voucher consumption, profile-write persistence, settings/help and other roadmap domains remain separate work.

Final cross-client order fulfilment evidence remains a TASK-CLOSEOUT-001 gate while the Dashboard React order board is being integrated with the existing order BFF.
