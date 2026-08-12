# AIDA POS/Admin Dashboard Import Audit

Audit task: `TASK-WF-002`  
Audit date: 2026-08-12 (Asia/Singapore)  
Dashboard repository: `https://github.com/Hermann-33/Aida_System-Dashboard`  
Shared backend context supplied for this audit: Supabase project **Aida System**, ref `eswovqxqzfevcdwwcmuh`

## Scope and audit verdict

This document records the dashboard source exactly as imported. It does not define a new backend schema, alter application behavior, synchronize governance documentation, or make changes to Supabase or the customer application repository. The current application is a frontend-first preview with deterministic fixtures and a small set of planned HTTP API adapters. It is not connected to Supabase and is not production-ready as a transactional POS or administration system.

## Repository/runtime

| Item | Current implementation |
|---|---|
| Framework | React 19.2.7, Vite 8.1.5 |
| Language | TypeScript 6.0.3 (strict, no emit) plus CSS |
| Runtime | Browser SPA; local tooling tested with Node.js 24.11.1 |
| Package manager | npm 11.6.2 with `package-lock.json` |
| Entry point | `index.html` -> `src/main.tsx` -> `src/App.tsx` |
| Routing | React Router DOM 7.18.1 using `BrowserRouter`, `Routes`, and nested layout routes |
| Styling/UI | Tailwind CSS 4 via Vite, project CSS tokens, Radix primitives, shadcn-style local components, Lucide icons |
| State/data tools | React component state and module stores; TanStack Query provider is configured but no query hooks currently consume it; TanStack Table is used by the preview table page |
| Unit/component tests | Vitest 4.1.10, Testing Library, jsdom |
| Browser tests | Playwright 1.61.1 |

Key commands discovered in `package.json`:

- Development: `npm run dev` (default `http://localhost:5173`)
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit/component tests: `npm test`
- Production build: `npm run build`
- Preview-only E2E: `npm run test:e2e`
- API-backed E2E: `npm run test:e2e:api` (requires a separate API environment)
- Browser setup: `npm run test:e2e:install`
- Screenshot/closure evidence: `npm run capture:closure`

## Directory map

| Path | Responsibility |
|---|---|
| `src/main.tsx` | React root mount and global CSS imports |
| `src/App.tsx` | Query client, router, route tree, and top-level access boundaries |
| `src/auth/` | Employee identity types, client-side permission helpers, cookie-oriented HTTP session adapter, terminal credential adapter, and route guard |
| `src/pages/` | Employee entry/enrolment, role selection, POS shell orchestration, unauthorized page, and legacy/general shell components |
| `src/layouts/` | Separate employee, POS, and admin layouts plus admin navigation/sidebar |
| `src/features/pos/` | Cart, modifiers, member/reward lookup, manager PIN approval, payment simulation, receipts, orders, shifts, and terminal/help rails |
| `src/features/admin/` | Dashboard, reports, operations, catalogue, inventory, rewards, marketing, audit, integration, settings, and table-preview pages |
| `src/preview/` | Preview-mode gate, demo identities/codes, deterministic fixtures, and in-memory/session-storage repositories |
| `src/components/` | Shared application components and local Radix/shadcn-style UI primitives |
| `src/shared/` | Formatting and reusable display/confirmation components |
| `src/styles/` | Design tokens and Tailwind entry stylesheet |
| `src/a11y/`, `src/test/` | Accessibility-oriented tests and Vitest setup |
| `e2e/` | Preview closure tests and separate API-backed critical-flow tests |
| `scripts/` | Build assertions and screenshot/closure capture automation |
| `docs/`, `docs_screenshots/` | Existing visual QA evidence and screenshot documentation |
| `public/`, `src/assets/` | Static icons and image assets |

Generated/local paths include `node_modules/`, `dist/`, `test-results/`, Playwright reports/cache, coverage, logs, IDE state, and `.env.development`; these are ignored. The existing `docs_screenshots/aida-pos-admin-all-screens.zip` is a reproducible archive of already-present screenshot files and is also ignored as a generated duplicate. Source screenshots remain included as existing audit evidence.

## Screen/page inventory

All current data sources below are frontend fixtures or local component/session state unless a planned API adapter is explicitly named.

| Page/route | File | Intended role | Purpose | Current data source | Current status |
|---|---|---|---|---|---|
| Employee access `/employee` | `src/pages/EmployeeWelcomePage.tsx` | Anonymous/staff/admin | Terminal enrolment and shared-terminal staff PIN sign-in; legacy password functions remain in the auth adapter | Demo accounts/roster and preview terminal repository; non-preview paths call employee and terminal APIs | Preview functional; live API unverified |
| Workspace selection `/employee/select-role` | `src/pages/RoleSelectPage.tsx` | Dual-role admin | Explicitly choose POS or Admin workspace | Current employee session | Preview functional |
| POS workspace `/pos` | `src/pages/PosShellPage.tsx`, `src/features/pos/CounterWorkspace.tsx` | Staff; explicitly enabled dual-role admin | Terminal/shift gate and full counter workspace | Preview fixtures, component state, preview shift/terminal repositories; planned `/api/v1` adapters | Broad interactive simulation; no durable order backend |
| Unauthorized `/unauthorized` | `src/pages/UnauthorizedPage.tsx` | Any denied identity | Access-denied boundary | Route guard state | Functional UI |
| Executive dashboard `/admin` | `src/features/admin/AdminOverviewPage.tsx` | Admin | Period KPIs, trend, payments, counter/staff sales, live operations, alerts | Derived preview transactions, terminals, shifts, and URL `period` query | Read-only preview statistics |
| Sales & Performance `/admin/reports/sales` | `src/features/admin/AdminSalesPerformancePage.tsx` | Admin | Overview, product, payment, void/refund, staff, and branch reporting | Preview transactions/menu and derived aggregates | Read-only preview; export disabled |
| Transactions `/admin/reports/transactions` | `src/features/admin/AdminTransactionsPage.tsx` | Admin | Order-level list and detail drawer | `PREVIEW_TRANSACTIONS` | Read-only preview |
| Members & Loyalty `/admin/reports/members` | `src/features/admin/AdminMembersLoyaltyReportPage.tsx` | Admin | Member mix, balances, verification, and rewards activity | Preview members, transactions, and reward rules | Read-only preview |
| Locations `/admin/operations/branches` | `src/features/admin/AdminLocationsPage.tsx` | Admin | Branch and sales-point directory; add/edit/toggle controls | `PREVIEW_ORG` copied into React state | Session-only interactive preview |
| Terminals `/admin/operations/terminals` | `src/features/admin/AdminTerminalsPage.tsx` | Admin | Terminal health, issue enrolment code, revoke terminal | Preview terminal fixtures and session-storage simulator | Session-only interactive preview |
| Shifts `/admin/operations/shifts` | `src/features/admin/AdminShiftsPage.tsx` | Admin | Shift list and cash variance review | Preview shift rows and threshold | Read-only preview |
| Employees `/admin/operations/employees` | `src/features/admin/AdminEmployeesPage.tsx` | Admin | Employee directory, role/branch/global-manager settings, active status | Preview employees copied into React state | Session-only interactive preview; no directory API |
| Menu `/admin/catalogue/menu` | `src/features/admin/AdminMenuPage.tsx` | Admin | Items, categories, variants/modifiers, add-item dialog | Preview menu/modifiers copied into React state | Session-only additions; no catalogue/photo API |
| Menu editor `/admin/catalogue/menu/:id` | `src/features/admin/AdminMenuEditorPage.tsx` | Admin | Inspect/edit price and availability, view modifiers | Lookup into preview menu | Save disabled; read-only sample boundary |
| Inventory `/admin/inventory/stock` | `src/features/admin/AdminInventoryPage.tsx` | Admin | Stock, recipes, wastage, and transfers | Menu/org-derived local arrays and React state | Session-only transfer simulation; no inventory API |
| Loyalty program `/admin/rewards/loyalty` | `src/features/admin/AdminLoyaltyProgramPage.tsx` | Admin | Points rules, stamp cards, offers/deals | Preview reward rules and members | Read-only preview |
| Marketing `/admin/rewards/campaigns` | `src/features/admin/AdminMarketingPage.tsx` | Admin | Campaign and customer-app banner composition/preview | Hardcoded defaults and React state | Campaign publish disabled; ad “publish” only toggles local state |
| Audit log `/admin/system/audit` | `src/features/admin/AdminAuditPage.tsx` | Admin | Search, date filter, and paginate audit events | Local sample audit rows | Read-only preview, not immutable/server-backed |
| Integrations `/admin/system/integrations` | `src/features/admin/AdminIntegrationsPage.tsx` | Admin | MyInvois integration status | Static placeholder | Configuration disabled |
| Settings `/admin/system/settings` | `src/features/admin/AdminSettingsPage.tsx` | Admin | Organisation defaults | Static values | Save disabled |
| Data table preview `/admin/preview/data-table` | `src/features/admin/AdminTableDemoPage.tsx` | Admin/developer preview | Demonstrate filter/sort/select/paginate table pattern | Local `SAMPLE_MEMBERS` | Interactive UI sample; not in sidebar and not backend-backed |

`src/pages/AdminShellPage.tsx` is present but the current route tree uses feature pages directly under `AdminLayout`; it is not routed. `src/pages/employee/EmployeeAuthShell.tsx` and the legacy password adapter remain in source, while the visible employee flow emphasizes shared-terminal name/PIN selection.

## Navigation

- `src/App.tsx` defines a single browser-history SPA route tree.
- `/` and unknown routes redirect to `/employee`.
- `ProtectedRoute` refreshes the employee session, allows anonymous employee entry, redirects unauthenticated users to `/employee`, and redirects identities without the requested product scope to `/unauthorized`.
- `EmployeeLayout`, `PosLayout`, and `AdminLayout` keep product surfaces separate. Admin routes are nested under one layout/sidebar; POS is a single route with internal rails (`sale`, `orders`, `member`, `shift`, `terminal`, `help`).
- Admin navigation is declared in `src/features/admin/adminNav.ts`. The data-table preview route is intentionally absent from the main nav.
- Development-only `VITE_ALLOW_AUTH_BYPASS=true` can bypass guards. `vite.config.ts` rejects auth bypass and preview mode in production builds.
- These guards are usability controls, not an authorization boundary; every live operation still requires server-side authorization and branch scoping.

## State/data flow

- Most state is local React `useState`/`useMemo`; there is no global Redux/Zustand-style store.
- Employee session is a module-level external store consumed through `useSyncExternalStore`. Live mode uses credentialed same-origin HTTP requests and expects an HttpOnly cookie. Preview identity fields are stored in `sessionStorage`; passwords, PINs, and tokens are not stored.
- Terminal preview enrolment is stored in `sessionStorage`. The live adapter expects an HttpOnly terminal credential and exposes only status/location to JavaScript.
- Preview shift state is module memory and is lost on reload. POS cart, held tickets, completed receipt, manager action logs, cash moves, and connection simulations are component memory and are lost on remount/reload.
- Admin edits for employees, branches/sales points, terminals, menu additions, inventory transfers, marketing state, alert read state, and table-demo rows are component memory only.
- `@tanstack/react-query` wraps the app but currently has no query/mutation consumers, caching policy, repository layer, or Supabase client integration.
- Fixture reporting data is centralized in `src/preview/fixtures/catalog.ts`; several totals are derived from the transaction array, while week/month values multiply a single sample day.

## Current POS functionality

The preview supports terminal enrolment, employee PIN selection, role routing, shift open/lock/resume/close, opening/closing cash and variance display, menu search/category filtering, availability, modifier validation, item notes and quantities, dine-in/takeaway/pickup selection, cart clearing, held-ticket park/resume/discard, member search or simulated scan, reward selection, cash tender/change, simulated non-cash processing, receipt generation, order-history filtering, reason capture plus manager-PIN approval for void/refund/cancel previews, cash paid-in/paid-out/safe-drop logs, KDS ticket preview, terminal health, offline/degraded/syncing state simulation, and help text.

All transactional outcomes are local. No order, line, tender, refund, inventory, loyalty, KDS, audit, or settlement record is durably written.

## Current admin functionality

The admin surface presents executive KPIs, reports, transactions, members/loyalty, locations/sales points, terminals, shifts/variance, employees/access, catalogue/menu/modifiers, inventory/recipes/wastage/transfers, loyalty rules/offers, marketing creatives, audit rows, integrations, settings, and an internal table pattern. Some add/edit/toggle flows update local state; critical publish/save/export/integration actions are disabled or simulated.

## Member/QR functionality

- Member lookup filters hardcoded members by display name or member code.
- “Scan member QR” is a timed simulation that selects a fixture member; there is no camera/scanner API, signature verification, QR parsing, or backend lookup.
- Fixtures distinguish student/general members, active state, student verification (`verified`, `pending`, `expired`, `not_applicable`), points, stamps, member code, and reward eligibility.
- No customer identity, live member profile, student verification authority, balance ledger, or QR replay protection is connected.

## Menu/catalogue functionality

- Fixtures define menu IDs, SKUs, categories, prices in sen, availability, route (`bar`/`kitchen`), modifier group/option IDs, min/max selection rules, and remote Unsplash thumbnail URLs.
- POS cart price is calculated from client-side menu and modifier values.
- Admin can add an item only to current component state. Editor price/availability controls do not save. Categories and modifier variants are read-only previews.
- There is no durable catalogue, media storage/upload, availability publication, price versioning, tax configuration, or customer-app catalogue synchronization.

## Inventory functionality

The page provides stock-on-hand samples, low-stock signals, recipe views, an empty wastage state, and session-only transfers between sales points. It assumes one shared inventory pool (`INV-MAIN`) for the preview branch. There is no stock ledger, unit conversion authority, recipe depletion, count/adjustment approval, wastage persistence, transfer state machine, concurrency control, or order-driven decrement.

## Orders/POS functionality

Cart lines use client-generated IDs from timestamp plus `Math.random`; held tickets also remain local. Receipts use an in-memory sequence beginning near sample order `A-10522`. Historical orders are fixtures. Void/refund/cancel only append a descriptive string to local state after preview manager approval. Live order creation, idempotency, tax/discount calculation, queue/KDS routing, order status transitions, offline sync/reconciliation, receipt numbering, refunds, and audit records are required from the backend.

## Loyalty/rewards functionality

Preview labels assume RM 1 = 1 point, one stamp per purchase, ten stamps for a free drink, and sample point-priced vouchers. Eligibility and discount outcomes are trusted from fixture objects and client calculations. Redemptions do not reserve or consume a reward, points, stamps, or voucher. A server-authoritative ledger and atomic order/redemption transaction are required.

## Staff/employees/access functionality

Roles modeled are `staff`, `admin`, and a preview `dual` concept represented by an admin identity with `dualRolePosEnabled`. `customer` is explicitly denied. Identities include global-manager status, assigned branch IDs, selected product, and authentication method. Staff can access POS; admin access depends on selected product; dual-role users explicitly select a workspace. Employee edits, active status, permissions, and branch assignment are illustrative. The server must own authentication, session revocation, role/permission policy, branch scope, manager approval, employee lifecycle, badge/PIN handling, rate limiting, and audit.

## Marketing functionality

Campaign form values and mobile creative previews are local. Campaign publishing is disabled; ad/banner publish merely switches a local `live` flag. Customer-app placement names currently include `home-hero` and `offers-rail`. The shared backend needs creative/media storage, placement contracts, audience/branch/time targeting, publication workflow, approvals, versioning, expiry, customer-app delivery/cache behavior, and audit.

## Reports/dashboard functionality

Reports use a fixed 21 July 2026 transaction set. Today totals are derived from those rows; week and month multiply that day by 7 and 25. Hourly trend values, operational counts, terminal status, shift variance, product/category presentations, alerts, and audit rows include hardcoded/sample values. Production reporting requires server-owned financial semantics, timezone/business-day boundaries, branch authorization, refund/void attribution, payment settlement status, loyalty attribution, reliable aggregation, exports, and realtime or refresh semantics.

## Payment functionality

- Methods modeled: cash, card, e-wallet, and student wallet.
- Cash tender/change is calculated in the browser.
- Non-cash flow uses timers and generates a `PREV-*` reference; no payment provider/device is called.
- Payment device state is a fixture. Decline/failure screens are simulations.
- Production requires provider/device integration, server-created payment intents/requests, idempotency, authoritative totals, confirmation/webhook handling, status reconciliation, refunds, receipt references, cash accountability, and separation of sensitive provider credentials from the browser. No card data should pass through or be persisted by this frontend.

## Branch/location functionality

The fixture organization has one branch (`BR-MAIN`), two sales points (`SP-MAIN`, `SP-SNACK`), three terminals, and one inventory pool. Employee identities use a different preview-form branch ID (`preview-branch-main`) from the admin organization fixture (`br-main`), making ID normalization a known integration boundary. Local forms allow branch and sales-point edits/additions only for the current session. Live authorization and queries must scope by stable backend branch/sales-point/terminal/inventory identifiers.

## Mock and placeholder register

- **Hardcoded/local data:** menu/catalogue, modifiers, members, rewards, transactions, terminals, shifts, employees, organization/locations, inventory/recipes, audit rows, settings, campaign copy, table-demo members, live-operation cards, and dashboard trends.
- **Fake statistics:** fixed hourly series; week/month projections from one day; fixed open-shift/variance values; derived sales and loyalty totals based on sample transactions.
- **Fake orders:** `A-10508` through `A-10521` fixtures; new receipt IDs use an in-memory counter; held tickets use generated timestamp/random IDs.
- **Fake customers/members:** Aisyah Lim, Daniel Ong, and an inactive member with sample codes, points, stamps, verification, and rewards.
- **Fake staff:** Nadia Rahman, Hafiz Ali, Siti Manager, Amir Dual, plus Aina in shift history; shared preview PIN and documented demo passwords are intentionally non-production.
- **Fake inventory:** local stock/recipe/alert data and session-only transfers; wastage starts empty.
- **Fake loyalty:** points/stamps/rules/reward eligibility and reward discounts are fixture/client values with no ledger mutation.
- **Placeholder/disabled controls:** sales export, menu editor save, campaign publish, integrations configuration, settings save, and other buttons explicitly marked API/integration pending.
- **Browser/local behavior:** preview identity and terminal enrolment use `sessionStorage`; sidebar preferences use `localStorage`; most operational/admin mutations use component memory only.
- **Generated IDs/references:** cart/held ticket IDs use `Date.now()` and `Math.random`; shifts use timestamps; receipt order numbers use an in-memory sequence; non-cash references use `PREV-` plus current time; local admin additions use local ID construction.
- **Simulated APIs/devices:** QR scan delay, non-cash terminal delay/outcome, KDS preview, terminal/peripheral health, network state, manager action audit strings, marketing publication, and shift cash-move logs.
- **External placeholder media:** menu thumbnails load from Unsplash URLs; no owned media pipeline exists.

## Backend requirements

No schema is proposed here. Required capabilities by UI area are:

| UI area | Shared backend capability required |
|---|---|
| Employee access | Employee authentication (password and badge/PIN as approved), secure cookie sessions, lock/reauth, role and branch claims, revocation, rate limiting, audit |
| Terminal enrolment | One-time expiring enrolment codes, HttpOnly terminal credential, terminal/location binding, status, heartbeat, revoke/reset, manager authorization |
| Shifts/cash | Open/current/lock/resume/close, terminal/staff exclusivity, floats, paid-in/out/drop ledger, expected/actual cash, variance approval, handover, audit |
| Catalogue | Stable menu/category/item/SKU/variant/modifier IDs, price and availability publication, media, branch/sales-point availability, customer/POS consistency |
| Orders | Server-authoritative pricing and eligibility, idempotent order creation, lines/modifiers/notes, order type, statuses, KDS routing, hold/resume if cross-device, void/cancel/refund approvals, receipt identity |
| Members/QR | Customer/member identity mapping, opaque or signed member QR/code lookup, active/student status, minimal POS disclosure, access audit |
| Loyalty/rewards | Atomic points/stamps ledger, reward catalogue, eligibility, voucher lifecycle, reservation/redemption/reversal tied to orders/payments |
| Payments | Provider/device orchestration, server-owned amount, payment/payment-status lifecycle, webhook/reconciliation, cash tender records, refund/settlement references; secrets server-side |
| Inventory | Item/unit/recipe definitions, stock ledger, counts/adjustments, wastage, transfers, depletion, branch/pool scope, concurrency and audit |
| Locations | Organization, branch, sales point, terminal, inventory-pool hierarchy and stable IDs; business hours and enabled order types |
| Employees | Directory lifecycle, roles/permissions, branch assignments, global-manager policy, manager approval credentials, audit |
| Marketing | Campaign/creative storage, media, placements, audience/branch/time rules, publish/expire workflow, customer-app delivery contract |
| Reports | Authorized server aggregation with agreed financial definitions, business timezone/day, exports, refresh/realtime behavior, immutable source links |
| Audit/settings/integrations | Append-only security/business audit, organization settings/versioning, server-side integration secrets and health |

The supplied shared platform is Supabase project `eswovqxqzfevcdwwcmuh`, but this source currently contains no Supabase SDK, URL/key variables, migrations, database functions, policies, or direct Supabase calls. Future work must first reconcile contracts with the customer app; this audit intentionally does not invent tables, policies, functions, or events.

## Security observations

- Client-side route and permission helpers explicitly state that they are not a security boundary. All role, permission, product, global-manager, and branch decisions require server enforcement.
- Preview credentials and PINs are public demo values and must never be enabled in production. Production builds already reject preview mode and auth bypass.
- Live employee requests are designed for `credentials: include`; expected cookie flags, CSRF strategy, session rotation, expiry, revocation, brute-force protection, and step-up authentication are backend responsibilities.
- Terminal secrets are intentionally expected in HttpOnly cookies and not exposed to JavaScript. One-time code issuance, consumption, terminal binding, and revocation require manager authorization and audit.
- Prices, discounts, totals, change, reward eligibility, order actions, and generated IDs are currently client-trusted simulations. A live system must calculate/validate these server-side and enforce idempotency.
- Manager approval is currently a preview PIN check and local log string. Void/refund/cancel, variance approval, inventory adjustment, and sensitive employee changes require server-side step-up authorization and immutable audit.
- QR/member search currently exposes fixture balances and verification status. Live lookup should use non-enumerable identifiers, minimize returned personal data, prevent replay/enumeration, and enforce staff purpose/scope.
- Reward/voucher selection has no atomic consumption or race protection. Redemption, payment, order completion, and reversal must be consistent.
- Inventory and employee/location mutations are local and unaudited. Live mutations need authorization, validation, concurrency control, and audit.
- Reports and audit routes are protected only by the client shell today. Backend report/audit endpoints must enforce role and branch scope and prevent data leakage.
- Integration credentials are described as server-side only; none are present in this source. `.env.development` contains only the preview flag and is excluded from Git; `.env.example` contains no secret.
- Payment is simulated; there is no processor SDK or card-data handling. Provider secrets and sensitive payment data must remain outside this frontend.
- `npm install` reported five dependency audit findings (one moderate, four high). No upgrades or automated audit fixes were applied because this task preserves the baseline.

## Fragile boundaries

- Preview branch identifiers are inconsistent (`preview-branch-main` versus `br-main`), and display names are sometimes used where stable IDs will be required.
- Monetary values are generally integer sen but some shift interfaces/inputs use numbers interpreted as ringgit; contract units must be explicit end-to-end.
- Employee response mapping accepts loosely shaped `Record<string, unknown>` data and mixes camelCase/fallback snake_case for only `fullName`; a versioned API DTO contract is needed.
- Preview `dual` is not an `EmployeeRole`; it is encoded as admin plus flags. Both repositories/backend must share one unambiguous role/capability model.
- Student verification values and reward rules are UI concepts without a current authority or freshness contract.
- Order status vocabulary differs by context (transaction `Completed/Refunded/Voided`; operational actions include cancel; future customer statuses may differ).
- Payment status is implicit in UI phases and transaction status rather than a shared domain type.
- Report semantics are labeled as a benchmark but are based on samples and multiplication; they must not be treated as accounting definitions.
- Offline state is cosmetic. There is no queue, idempotency key, durable local store, conflict policy, or reconciliation path.
- Same-origin `/api/v1` calls assume deployment routing that Vite currently does not proxy.
- The SPA requires host fallback to `index.html` for deep links.
- Remote Unsplash catalogue images introduce availability/privacy/caching/licensing considerations and do not establish a production media contract.
- The production bundle is relatively large (approximately 687 kB minified, 198 kB gzip), and the build warns about chunks over 500 kB; no optimization was attempted.

## Existing test/build status

Checks run on 2026-08-12 with the imported baseline:

| Check | Result |
|---|---|
| `npm install` | Completed lockfile-respecting install; audit reported 5 vulnerabilities (1 moderate, 4 high); no upgrades/fixes applied |
| `npm run lint` | Exit 0 with 5 warnings: three `react(only-export-components)`, one unused helper in API E2E, one missing `useEffect` dependency |
| `npm run typecheck` | Pass, exit 0 |
| `npm test` | Pass: 14 test files, 62 tests |
| `npm run build` | Pass; TypeScript + Vite production build + legacy-token assertion. Warning: JS chunk over 500 kB. Bundle assertion confirmed no `legacyAccessToken` and no employee `localStorage` writes |
| `npm run test:e2e` (first attempt) | Infrastructure failure before execution: pinned Playwright Chromium binary absent |
| `npm run test:e2e:install` | Pass; installed the Playwright-pinned Chromium runtime outside the repository |
| `npm run test:e2e` (rerun) | Pass: 6/6 preview closure tests |
| `npm run test:e2e:api` | Not run: it requires the separate API/temp database environment and the current frontend-only Vite config has no API proxy |

Test coverage focuses on auth mode, permissions, session/terminal behavior, routing, preview mode/banner, layouts, cart/payment behavior, accessibility basics, and preview browser closure. There is no verified live Supabase/API, payment provider, realtime, cross-device, migration/RLS, or customer-app contract test in this repository.

## Exact integration dependencies on the customer app

The following concepts must be reconciled in TASK-WF-003 and subsequent contract work. This list describes compatibility needs, not a proposed schema:

| Shared concept | Dashboard representation/current dependency | Compatibility requirement |
|---|---|---|
| User/member identity | `PreviewMember.id`, member code, display name, active flag, student/general kind | One stable identity relationship between customer account and POS-safe member view; avoid exposing unnecessary customer data |
| Member code / QR | `memberCode`; simulated QR selects a fixture | Customer-generated/displayed code format, rotation/signature/expiry and POS lookup response must agree |
| Student verification | `verified`, `pending`, `expired`, `not_applicable` | Shared status vocabulary, authority, timestamps/expiry, and eligibility effect |
| Menu IDs/SKUs | String item IDs and SKUs in fixtures | Customer catalogue and POS/admin mutations must reference the same stable product/version identity |
| Variant/modifier IDs | Modifier group and option string IDs, min/max/required, price deltas | Same option availability, constraints, labels, routing, and price version used when ordering and fulfilling |
| Pricing | Integer `priceSen`/`priceDeltaSen`; browser-computed totals | Shared currency/minor-unit convention; backend authoritative price, tax, discount, rounding, and effective-time rules |
| Quotes | No quote model exists in dashboard | If customer ordering uses quotes, POS/order creation must accept/validate the same quote identity, expiry, prices, and promotions |
| Order IDs | Fixture `A-*`; local generated ticket/receipt IDs | Stable server order ID plus human receipt/display number, idempotency key, and correlation visible to both apps |
| Order statuses | Dashboard uses completed/refunded/voided and local void/refund/cancel actions | One transition vocabulary and customer-visible mapping, including preparation/KDS/ready/pickup/cancel/refund outcomes |
| Payment statuses | UI-only phases and completed/refunded transaction status | Shared server-owned payment lifecycle, provider references, retries, failure, refund, and settlement mapping |
| Loyalty balances | Points and stamps on preview member; derived issuance totals | Same authoritative ledger/balance, earn timing, pending/reversed entries, and display freshness |
| Reward IDs | Fixture reward IDs and kinds | Shared reward catalogue/version, eligibility, cost, applicability, expiry, redemption and reversal |
| Voucher IDs/status | Voucher-like reward objects but no voucher instance/status model | Shared voucher instance identity and lifecycle (available/reserved/redeemed/expired/reversed as product rules define) |
| Employee roles | Staff/admin/customer plus dual-role flags, global manager, branch assignments | Backend-owned role/capability model separate from customer identity; customer role must never grant staff access |
| Branch IDs | Multiple preview ID forms plus branch code/name | One stable branch ID/code mapping used for catalogue availability, orders, pickup, staff scope, reports, and inventory |
| Sales point/terminal IDs | Fixture sales point and terminal IDs/codes | Stable routing/fulfilment identifiers and allowed customer pickup/order destinations |
| Inventory | Shared pool concept and recipe/stock previews | Agreed availability semantics exposed to customer app without leaking internal stock; atomic relationship to accepted orders |
| Promotions | Local campaign/ad copy and offer rewards | Shared promotion/campaign identity, targeting, effective dates, branch/product eligibility, stacking, and price effect |
| Realtime events | Cosmetic terminal state only; no event client | Agree which order, payment, fulfilment, catalogue, loyalty, and promotion changes are observable by each app, with authorization and version/order semantics |

No customer-app files were inspected or changed during this task; therefore the table identifies dashboard-side dependencies that the later synchronization task must compare against the customer repository rather than claiming current compatibility.

## Import exclusions and preservation notes

- Excluded as dependencies/build/test output: `node_modules/`, `dist/`, `dist-ssr/`, `test-results/`, `playwright-report/`, Playwright cache, `coverage/`, and logs.
- Excluded as machine/editor state: `.idea/`, most `.vscode/`, OS junk, solution/user files, and temporary files already covered by `.gitignore`.
- Excluded as local environment configuration: `.env.development` and future `.env*`; `.env.example` is explicitly included.
- Excluded as generated duplicate: `docs_screenshots/aida-pos-admin-all-screens.zip`; the underlying screenshots and documentation remain included.
- The parent-directory `Aida_System.zip` is outside the dedicated application repository and is not part of the import.
- No runtime source, dependency declaration, route, UI behavior, API behavior, or fixture value was intentionally changed. The only source-tree changes for TASK-WF-002 are this audit document and protective `.gitignore` entries.

## Handoff

The intended next task is `TASK-WF-003: Establish synchronized dual-repository AIDA project context and governance documentation.` This audit does not start or pre-empt that task.
