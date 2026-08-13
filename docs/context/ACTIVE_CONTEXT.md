# Active Context

**As of:** 2026-08-14
**Current implementation task:** `TASK-CLOSEOUT-001 — complete current AIDA implementation tranche`
**Current dashboard verdict:** implementation complete; live cross-client order E2E pending approved runtime credentials

## Accepted closeout evidence

The following physical/manual paths are current project evidence and supersede earlier zero-identity blockers:

- a fresh Android release APK was installed on a physical phone;
- customer sign-up succeeded and Supabase provisioned Auth/profile/member state;
- the new customer appeared in Dashboard Members;
- a real Owner signed into the local Admin dashboard;
- that Owner changed a catalogue price through Admin Menu;
- the installed customer app observed the changed price.

Fresh read-only Supabase evidence collected on 2026-08-14:

- Auth users: **9**;
- `user_profiles`: **9**;
- members: **6**;
- trusted roles: **1 owner, 1 admin, 1 staff**;
- orders: **0** at the closeout baseline;
- catalogue revision: **15**.

These counts are dated evidence, not permanent invariants. Employee identities are not member/loyalty records. The trusted demo employees are `owner.evelyn.demo@aida.test`, `admin.marcus.demo@aida.test`, and `staff.nora.demo@aida.test`.

## Current tranche status

- Identity/member provisioning and live Admin Members: complete and physically validated.
- Same-origin HttpOnly employee/Admin session: complete; real Owner login validated.
- Shared catalogue/Admin Menu/POS catalogue: complete; Owner mutation to installed-phone refresh validated.
- TASK-AUTH-005 preview/live separation: complete; preview identity remains non-authoritative and no Members/Menu login oscillation occurs.
- Authoritative order/scheduling backend: complete with canonical transactional integration evidence.
- Customer quote/place/history/status frontend: implemented on the coordinated customer stack according to mirrored implementation evidence.
- Dashboard POS order frontend: implemented in TASK-CLOSEOUT-001. Cart state submits IDs/intent only; server quote total is rendered; POS place is idempotent; ASAP/scheduled pickup uses server policy; successful persistence is required before clearing the sale; payment wording is explicitly `Pay at counter`/unpaid; the live order rail polls the BFF and sends versioned legal transitions.

The remaining closeout proof is a fresh live customer-place → dashboard-observe/transition → customer-authorized-refresh journey. This checkout has no approved account passwords in repository or environment state, so source work must not invent credentials or reset durable demo accounts.

## Security and deployment

The dashboard retains ADR-0008: HttpOnly employee cookies, caller JWT forwarded only by the BFF, same-origin POST enforcement, no browser bearer-token persistence, and no service-role credential.

Supabase security advisor reports one hosted Auth warning: `auth_leaked_password_protection` / **Leaked Password Protection Disabled**. It is project-level operational configuration; source code must not fabricate a fix or claim zero findings.

Hosted/Vercel deployment remains **DEFERRED**. It is not a merge blocker for the accepted local-PC + cloud-Supabase + installed-phone demo tranche, and it must not be called complete until separately proven.

## Deferred product domains

Real payment settlement/refunds, loyalty authority, inventory depletion, promotions/discount engine, tax/accounting, revenue reporting, delivery, branch capacity/hours, and branch-scoped operations remain outside this tranche.
