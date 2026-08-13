# POS/Admin Dashboard Audit

## Current-state note — 2026-08-14

The original source audit below is historical baseline evidence, not current product status. Current project truth is in `docs/context/ACTIVE_CONTEXT.md`, `CLOSEOUT_EVIDENCE_2026-08-14.md`, `SUPABASE_STATUS.md`, `ROADMAP.md` and the accepted ADR/contracts.

Material changes since the original audit:

- real Owner/Admin/Staff identities now exist;
- same-origin employee/Admin BFF sessions are implemented;
- protected Admin Members is live and a physical Android signup has been observed there;
- shared Admin/POS catalogue integration is live and a real Owner price mutation propagated to the installed Android customer app;
- TASK-AUTH-005 fixed the preview/live Admin session-loop regression;
- authoritative order/scheduling backend and Dashboard order BFF/API endpoints are implemented;
- customer Flutter authoritative order integration is implemented;
- Dashboard React authoritative POS quote/place/order-board/status integration remains TASK-CLOSEOUT-001 work;
- current Supabase security advisor has one hosted Auth configuration warning rather than a current zero-finding result.

Do not use historical zero-identity/revision-1 statements as current evidence.

---

## Historical source audit

**Repository:** `Hermann-33/Aida_System-Dashboard`
**Historical verdict:** broad preview frontend; not fully backend-connected or production-transactional at the time of the source audit.

### Runtime baseline

React 19, TypeScript, Vite, React Router, Tailwind, component primitives, TanStack Query, Vitest and Playwright with npm lockfile.

### Major surfaces

- Employee access, terminal enrolment and role selection.
- POS sale/cart/modifiers/member lookup/rewards/payments/receipts/orders/shifts/terminal/help.
- Admin overview, sales/transactions/member reports, branches/locations, terminals, shifts, employees/access, menu/catalogue, inventory, loyalty, marketing, audit, integrations and settings.

### Historical preview behavior

At the original audit, most operational data came from fixtures, component/module memory or session storage. Critical non-authoritative behavior included local receipt/order IDs, simulated payment state, preview manager approval, non-durable orders/shifts/cash moves/held tickets, session-only Admin mutations and fixture reporting/loyalty data.

Later tasks have replaced some but not all of those boundaries. Current placeholder truth is maintained in `MOCKS_AND_PLACEHOLDERS.md` and the current task/status docs.

### Historical verification

Earlier audit/test passes remain historical evidence only. Current live counts, current security-advisor state and current integration coverage are documented in the 2026-08-14 closeout files.
