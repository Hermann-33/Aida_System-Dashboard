# Current Handoff

Updated: 2026-08-14

## Task

`TASK-CLOSEOUT-001 — complete current AIDA implementation tranche`

Dashboard branch: `codex/task-closeout-001-tranche-completion`

Dashboard PR: #12, targeting `main`, kept draft until every cross-client gate passes.

## Completed dashboard implementation

The POS now uses the existing ADR-0010 order BFF rather than creating a second backend:

- typed `/api/v1/orders/*` client through `employeeFetch` and HttpOnly cookies;
- cart-to-contract mapping sends item/variant/add-on IDs, quantity and optional note only;
- server quote total is rendered as authority; local total is labelled estimate;
- ASAP and scheduled pickup are derived from the server policy;
- one `clientRequestId` survives retry of the same placement attempt;
- cart/fulfilment state remains after quote/place failure and clears only after persisted success;
- persisted server order UUID/number/total/status are displayed;
- active commercial wording is `Pay at counter`/unpaid, with no fake settlement;
- live queue polls at 2.5 seconds, never falls back to preview transactions, and invalidates after mutations;
- legal next transitions submit the current `statusVersion` and refetch on HTTP 409 conflict;
- terminal states expose no mutation controls.

TASK-AUTH-005 remains intact: preview Members makes no privileged request, preview Menu reads the public live catalogue read-only, and live BFF 401 does not destroy preview identity.

## Current live evidence

Dated 2026-08-14, not permanent invariants:

- Auth users 9; profiles 9; members 6;
- roles: owner 1, admin 1, staff 1;
- orders 0 at baseline; catalogue revision 15;
- physical Android release signup provisioned a member visible in Dashboard Members;
- real Owner login succeeded locally;
- Owner Admin Menu price mutation propagated to the installed customer app;
- Android release networking/signup path is validated.

Employee identities are not loyalty/member rows.

## Remaining gate

A fresh live customer-place → Dashboard observe/preparing/ready/completed → customer authorized refresh run was not executable from repository/environment state because no approved account passwords are available. Do not invent an Auth user, reset durable demo passwords, use service role, or insert an order directly with SQL.

Acceptable next execution: inject approved customer and staff/Admin demo credentials ephemerally, run the supported customer placement RPC/client boundary and Dashboard UI/BFF transitions, then remove/retain only a clearly labelled demo order according to product preference.

## Security/deployment

- No service-role/secret or browser employee bearer token is used.
- Current Supabase advisor: one WARN, `auth_leaked_password_protection`.
- Hosted deployment: **DEFERRED**, not a local-demo merge blocker.
- Payment, loyalty, inventory, reporting, tax, delivery and branch capacity remain deferred.

## Customer mirror delta

Mirror the 2026-08-14 live counts/evidence, current security-advisor WARN, Android physical validation, catalogue physical E2E, dashboard authoritative order frontend status, deferred deployment status, and remaining credential-bound cross-client order E2E into the customer repository governance set. Do not copy dashboard-local implementation file maps into customer-local docs.
