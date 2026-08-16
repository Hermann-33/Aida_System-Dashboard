# Audit Log

## 2026-08-17 — TASK-CLOSEOUT-001 final live order E2E

**Verdict:** COMPLETE for Dashboard implementation and applicable ADR-0004 live validation.

Using approved credentials only through process-local environment variables, a real customer authenticated with trusted `app_role=customer` and an active member. The public catalogue selected the currently published/available Sandwich item with no required variant/add-on. `quote_order` returned an authoritative ASAP total of 1,290 sen, and `place_customer_order` persisted order `100006` (`7cf027dc-3ff0-4604-a3fd-c7a943aac603`) as `confirmed` version 1.

A real Owner authenticated through the Dashboard same-origin HttpOnly BFF. `GET /api/v1/orders` observed the exact UUID, order number, total, status and version. Versioned BFF transitions persisted `preparing` version 2, `ready` version 3 and `completed` version 4; the customer's authorized `get_order` RPC observed each changed state. Dashboard detail and the final all-status queue confirmed the terminal record. The live retained-order count is now 1.

Final Dashboard checks passed: lint with the two established Fast Refresh warnings, strict typecheck, 25 Vitest files / 111 tests, production build plus legacy-token assertion, Playwright 8/8, `npm audit` with 0 vulnerabilities and `git diff --check`. The local Admin login rendered without console errors.

No service role, direct SQL order insertion, password reset, client-trusted price/status, browser employee bearer-token persistence or credential-bearing repository file was used. The four E2E credential variables were removed after authenticated work. The hosted leaked-password-protection WARN remains open and hosted deployment remains DEFERRED.

## 2026-08-14 — TASK-CLOSEOUT-001 dashboard tranche closeout

**Verdict:** PARTIAL pending one credential-bound live cross-client order journey.

Accepted current evidence replaces stale zero-identity claims: physical Android release signup provisioned a real customer/member visible in Dashboard Members; a real Owner logged into the local dashboard and changed catalogue price; the installed phone observed that change. Fresh read-only Supabase evidence is 9 Auth users, 9 profiles, 6 members, roles 1 owner/1 admin/1 staff, 0 baseline orders and catalogue revision 15.

Implemented the missing React order frontend over the existing BFF: selection-only quote payload, server-authoritative total, stable idempotent placement retry, ASAP/server-policy scheduled pickup, Pay-at-counter/unpaid wording, persisted order receipt, 2.5-second live queue polling, versioned legal transitions, conflict refetch and no preview-order fallback. TASK-AUTH-005 behavior remains covered.

Security scan found no new privileged credential or browser bearer-token persistence. Supabase security advisor currently reports one hosted Auth WARN, `auth_leaked_password_protection`; zero-finding claims were removed. Hosted deployment remains DEFERRED and is not a local-demo merge blocker.

`npm audit` initially reported 1 moderate and 4 high advisories, including the direct React Router advisory. A lockfile-respecting non-major `npm audit fix` updated five packages; the final audit reports 0 vulnerabilities.

The final fresh customer placement → Dashboard transition → customer authorized refresh proof could not run because approved account passwords are absent from repository/environment state. No identity was invented, no durable password was reset, no service role was used, and no order was directly inserted with SQL.

## 2026-08-13 — TASK-AUTH-005 preview/live Admin session loop

**Verdict:** COMPLETE for the bounded dashboard regression.

Reproduced before editing with `VITE_UI_PREVIEW_MODE=true`: preview Siti Manager opened Admin, then Members and Menu repeatedly oscillated with `/admin/login`. `GET /api/v1/admin/members`, `GET /api/v1/admin/catalogue`, and `GET /api/v1/auth/employee/session` returned HTTP 401 / `EMPLOYEE_SESSION_REQUIRED`; public `GET /api/v1/catalogue` returned 200. Source and runtime evidence showed preview identity persisted locally without a valid HttpOnly employee session, the shared 401 handler cleared in-memory identity, and duplicate route/login refresh ownership restored it and navigated back into the next 401.

Separated preview failure handling from the real employee session. Preview BFF 401s no longer clear preview identity; real `EMPLOYEE_SESSION_EXPIRED` still clears live state. ProtectedRoute is the route refresh owner. Preview Members stays mounted with no privileged request or fabricated member data. Preview Menu uses the public live catalogue in read-only mode and exposes no write controls; live mode retains privileged Admin endpoints and mutations.

Post-fix browser sampling stayed continuously on Members and Menu with the expected messages, live Latte catalogue, no write controls, and no browser warnings/errors. Validation passed: lint (two existing warnings), typecheck, 22 Vitest files / 99 tests, production build + bundle assertion, 7 Playwright tests, and `git diff --check`. No Supabase, RLS, cookie architecture, service-role policy, order frontend, or customer repository change was made.

## 2026-08-13 — TASK-AUTH-004 — Customer Auth runtime + protected Admin access

**Verdict:** PARTIAL pending physical-device signup and a real trusted Admin identity.

Created coordinated branch `codex/task-auth-004-runtime-access-fix` in both repositories, stacked on `codex/fix-auth-signup-diagnostics`. Fresh Supabase evidence showed 0 Auth users and 0 admin/owner profiles; the existing Auth provisioning trigger/function and server-generated member-code boundary remained intact, and security advisor remained 0 lints.

Customer source now defaults to the active AIDA project URL and public publishable key while retaining `--dart-define` overrides, eliminating a fragile installed-build configuration dependency without embedding a secret. Unrecognized `AuthException` text is normalized/capped and surfaced so the next phone attempt exposes the actual hosted Auth reason instead of the prior generic fallback.

Dashboard local Vite/BFF now receives the same public project URL/publishable key by default with explicit environment override. Protected Admin routes remain fail-closed but preserve destination/session-error context when redirecting to `/admin/login`; Admin login explains the requirement, returns to the originally selected route after success, and distinguishes credential, authorization, disabled-account, configuration and network failures.

No RLS/member-directory authorization was weakened, no employee bearer token was exposed, and no service-role/secret key was shipped. A temporary exact-account Edge Function was deployed only to investigate supported Auth Admin bootstrapping; the available runtime could not invoke it, no user was created, and it was immediately superseded by an HTTP-410 disabled version. No direct `auth.users` SQL insert was used.

Required closure: pull/rebuild both local clients, run their normal suites, attempt signup on the physical phone and capture the new exact Auth response; then create/promote the intended trusted operator identity and verify Dashboard Members/Menu through the existing caller-JWT BFF/RLS path.

## 2026-08-13 — TASK-DEMO-ORDER-001 — Authoritative ordering and scheduled pickup backend

**Verdict:** PARTIAL for the end-user feature under ADR-0004; shared backend scope implemented and live-validated, frontend intentionally deferred to Codex.

Created the same task branch in both repos: `codex/task-demo-order-001-order-scheduling-backend`, stacked on each repo's AUTH-003 branch. No default branch was changed.

Applied live Supabase migrations `20260812182212_create_authoritative_orders_and_scheduling` and `20260812183029_index_order_foreign_keys`. Canonical customer-repo filenames were aligned to the exact live ledger versions without changing applied SQL.

Added FORCE-RLS order/scheduling tables, authoritative quote/order RPCs, immutable commercial snapshots, idempotent placement, server scheduling policy, versioned legal fulfilment transitions, append-only events, and `orders` Realtime publication. Scheduling begins with Asia/Kuala_Lumpur, 15-minute lead, 15-minute slots and 7-day horizon. Branch hours/capacity remain explicitly unmodeled.

Canonical `supabase/tests/order_integration.sql` passed transactionally. It proved forged totals are ignored, live catalogue pricing/variant/add-on compatibility is revalidated, invalid schedules fail, customer ownership/member derivation holds, idempotency works, direct customer order DML/status control fails, staff POS/queue access works, legal/stale/terminal status rules hold, and only admin can update schedule policy. Rollback cleanup left 0 Auth users/profiles/members/orders/lines/add-ons/events.

Security advisor returned 0 lints. Performance advisor initially identified four unindexed order foreign keys; a forward migration added covering indexes. Final performance findings are unused-index INFO only on the empty/new dataset.

Dashboard server-only implementation added `server/orderBff.ts`, Vercel/Vite API adapters, Vite route mounting and `server/orderBff.test.ts`. It retains the existing HttpOnly employee-session/caller-JWT model, requires same origin for POSTs, uses no service-role credential, and maps idempotency/status-version conflicts to HTTP 409. No React component or Flutter source file was changed by this backend task. An isolated strict TypeScript 5.8.3 compile of `server/orderBff.ts` passed under the repo's server compiler rules.

Accepted ADR-0010 and added the byte-identical `ORDER_AND_SCHEDULING_CONTRACT.md` in both repos. The remaining work is frontend integration: customer authoritative quote/ASAP-or-scheduled placement/history/Realtime status; dashboard POS authoritative quote/place and live order board/status controls; then full client toolchains and cross-client E2E.

No real payment authority was added. Frontends must use an explicit Pay-at-counter/unpaid demo path rather than claiming Card/E-wallet/Student Wallet processing.

## 2026-08-13 — TASK-AUTH-003 deployment boundary

**Verdict:** PARTIAL under ADR-0004.

Created Vercel project `aida-system-dashboard` (`prj_lOHi9DTbwLYRZRlBBrrnmfRTRfIn`) and produced clean application deployment `dpl_FUniG8DnSkkKWJvhNjPNBWkdpT8W` (`READY`). The deployed BFF returned 502 for `/api/v1/catalogue`; a temporary diagnostic deployment confirmed `AIDA_SUPABASE_URL` and `AIDA_SUPABASE_PUBLISHABLE_KEY` were absent at runtime, then was superseded by the clean application deployment. Supplying values in a deployment payload did not configure project environment settings, and the connected deployment boundary exposes no environment-setting operation.

Stopped at the required operator boundary. No credentials were manufactured, no public bootstrap or role self-assignment was added, and no service-role key was requested or shipped. Live Supabase remains at zero Auth users/profiles/members/admins/staff and catalogue revision 1 (4 categories, 16 items, 27 variants, 27 add-on links). No Auth, schema or catalogue mutation occurred, so there was nothing to clean up.

Local validation: `npm ci` passed after stopping the local Vite process that held a native dependency file open; lint passed with two existing Fast Refresh warnings; strict typecheck passed; 19 Vitest files / 85 tests passed; 6 no-backend preview Playwright tests passed; production build and legacy-token assertion passed with the existing bundle-size warning; `git diff --check` passed with line-ending notices only. The local development server was restarted on port 5174. `npm audit` reported 5 dependency findings (1 moderate, 4 high); no automatic or out-of-scope package upgrade was applied.

Supabase security advisor was re-run with 0 lints. Performance advisor reported six expected unused-index INFO observations. No backend/security-relevant change was made.

## 2026-08-13 — AUTH-002 / TASK-MENU-001 dashboard validation

**Verdict:** PARTIAL under ADR-0004.

Removed runtime POS browsing/configuration dependence on `PREVIEW_MENU`, `PREVIEW_CATEGORIES` and `PREVIEW_MODIFIER_GROUPS`. POS now reads the public catalogue BFF and maps active categories, published items, authoritative availability/base prices, per-item variants and compatible add-ons. Cart/order/payment state and totals remain preview/local and untrusted.

Dashboard `npm ci`, lint, strict typecheck, 19 Vitest files / 85 tests, 6 preview Playwright tests, and production build pass. The build legacy-token check also passes. Live local-BFF validation against Supabase returned revision 1, 4 categories, 16 published items and 27 variants; anonymous Admin Catalogue/Admin Members access returned 401, cross-origin mutation returned 403, and an authenticated non-admin mutation was rejected by the database.

No catalogue mutation was performed because the live project contains zero Auth users/admins/staff/members. There is also no AIDA Vercel project in the connected team. Therefore real Auth provisioning/Admin Members E2E, Admin mutation/revision/cleanup, deployed validation and Flutter refresh evidence remain open. No Supabase schema/data or customer-repository changes were made in this validation pass.

## 2026-08-12 — TASK-MENU-001 — Shared catalogue/menu integration

**Verdict:** PARTIAL because client/toolchain/deployed E2E validation was deferred by user instruction.

Implemented a live shared catalogue in Supabase, seeded the 16 former customer menu hardcodes, normalized per-item variants and compatible add-ons, added audit/revision signaling, removed the customer runtime catalogue fixture and hardcoded size enum, wired Flutter to the shared snapshot + Realtime invalidation, and replaced Admin Menu preview data with caller-JWT BFF reads/mutations.

Database verification passed for seed integrity, public read, admin create/update, revision advance, audit evidence, customer write denial and unpublished-row hiding. Security advisor ended at 0 lints; performance advisor has only expected unused-index INFO.

The auth stack remains independently PARTIAL because its requested validation/deployment closure was skipped. POS checkout/order/payment preview behavior was not promoted to trusted business authority by this task.
