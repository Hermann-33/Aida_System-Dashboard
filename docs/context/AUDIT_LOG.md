# Audit Log

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
